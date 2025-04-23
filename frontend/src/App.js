import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import TableFoodImage from './assets/tableau.jpg';
import Logo from './assets/logo.png';

function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [correctLabel, setCorrectLabel] = useState('');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  useEffect(() => {
    if (!window.isSecureContext) {
      setError('This app requires HTTPS to access the camera.');
    } else if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported by this browser.');
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setIsCameraActive(true);
      setError(null);
    } catch (err) {
      setError(`Camera error: ${err.message}`);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    stream?.getTracks().forEach((track) => track.stop());
    videoRef.current.srcObject = null;
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const previewURL = URL.createObjectURL(blob);
      setPreview(previewURL);
      setImage(blob);
    }, 'image/jpeg');
  };

  const handleSubmit = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', image);
      const res = await axios.post('https://seefood-66db0271b856.herokuapp.com/upload', formData);
      setResult(res.data);
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setCorrectLabel('');
    setShowCorrectionModal(false);
    stopCamera();
  };

  const openCorrectionModal = () => setShowCorrectionModal(true);

  const handleCorrectionSubmit = async () => {
    try {
      await axios.post('https://seefood-66db0271b856.herokuapp.com/update-label', {
        corrected_label: correctLabel,
      });
      setShowCorrectionModal(false);
      setCorrectLabel('');
    } catch (err) {
      setError('Failed to submit correction.');
    }
  };

  return (
    <div className="app-container">
      <div className="circular-background" style={{ backgroundImage: `url(${TableFoodImage})` }}></div>
      <div className="container">
        <div className="card">
          <img src={Logo} alt="SeeFood Logo" className="logo" />
          <h1>SeeFood Image Recognition</h1>
          <p>Click the button below to capture food using your camera.</p>

          {error && <div className="error">{error}</div>}

          {isCameraActive ? (
            <div className="camera-container">
              <video ref={videoRef} autoPlay muted className="video-preview" />
              <button onClick={capturePhoto} disabled={loading}>📸 Capture Photo</button>
              <button onClick={stopCamera} disabled={loading}>❌ Close Camera</button>
            </div>
          ) : (
            <button onClick={startCamera} disabled={loading}>📷 Open Camera</button>
          )}

          {preview && <img src={preview} alt="Captured preview" className="image-preview" />}
          <button onClick={handleSubmit} disabled={!image || loading}>
            {loading ? 'Uploading...' : 'Upload to Recognize'}
          </button>
          <button onClick={resetState} disabled={loading}>Reset</button>

          {result && (
            <div className="result-container">
              <h2>Prediction Result:</h2>
              <p><strong>Class:</strong> {result.predicted_class}</p>
              <p><strong>Confidence:</strong> {result.confidence}</p>
              <button onClick={openCorrectionModal}>Wrong Prediction?</button>
            </div>
          )}

          {showCorrectionModal && (
            <div className="modal">
              <div className="modal-content">
                <h3>Submit a Correction</h3>
                <input
                  type="text"
                  value={correctLabel}
                  onChange={(e) => setCorrectLabel(e.target.value)}
                  placeholder="Enter correct label"
                />
                <div className="modal-buttons">
                  <button onClick={handleCorrectionSubmit} disabled={!correctLabel.trim()}>
                    Submit
                  </button>
                  <button onClick={() => setShowCorrectionModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  );
}

export default App;
