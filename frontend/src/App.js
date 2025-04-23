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
  const [cameraRequested, setCameraRequested] = useState(false);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser.');
    }
  }, []);

  useEffect(() => {
    if (cameraRequested && videoRef.current) {
      console.log("🎥 Requesting camera access...");

      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          console.log("✅ Camera stream received:", stream);
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
              console.log("✅ Metadata loaded, playing video");
              video.play();
              setIsCameraActive(true);
              setError(null);
            };
          }
        })
        .catch((err) => {
          console.error("❌ Camera access failed:", err);
          setError('Camera access failed: ' + err.message);
        })
        .finally(() => {
          setCameraRequested(false);
        });
    }
  }, [cameraRequested]);

  const startCamera = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser.');
      return;
    }
    setCameraRequested(true);
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      const file = new File([blob], 'captured.jpg', { type: 'image/jpeg' });
      setImage(file);
      setPreview(URL.createObjectURL(blob));
    }, 'image/jpeg');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('image', image);

    try {
      const res = await axios.post('https://seefood-66db0271b856.herokuapp.com/upload', formData);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectionSubmit = async () => {
    if (!correctLabel || !image) return;

    const formData = new FormData();
    formData.append('image', image);
    formData.append('correct_label', correctLabel);

    try {
      await axios.post('https://seefood-66db0271b856.herokuapp.com/update-label', formData);
      alert('Correction submitted!');
      setShowCorrectionModal(false);
      setCorrectLabel('');
    } catch (err) {
      alert('Correction failed.');
    }
  };

  const resetAll = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCorrectLabel('');
    setShowCorrectionModal(false);
    stopCamera();
  };

  return (
    <div className="app-container">
      <div className="circular-background" style={{ backgroundImage: `url(${TableFoodImage})` }}></div>
      <div className="container">
        <div className="card">
          <img src={Logo} alt="Logo" className="logo" />
          <h1>SeeFood Image Recognition</h1>
          <p>Upload an image or take a photo to recognize the food.</p>

          {error && <div className="error">{error}</div>}

          {isCameraActive ? (
            <div className="camera-container">
              <video ref={videoRef} autoPlay muted playsInline className="video-preview" />
              <button onClick={capturePhoto} disabled={loading}>📸 Capture</button>
              <button onClick={stopCamera} disabled={loading}>❌ Close Camera</button>
            </div>
          ) : (
            <div className="file-input-container">
              <button onClick={startCamera} disabled={loading}>📷 Start Camera</button>
              <input type="file" accept="image/*" onChange={handleFileUpload} disabled={loading} />
            </div>
          )}

          {preview && <img src={preview} alt="Preview" className="image-preview" />}
          <button onClick={handleSubmit} disabled={loading || !image}>
            {loading ? '⏳ Processing...' : '✅ Upload Image'}
          </button>
          <button onClick={resetAll} disabled={loading}>🔄 Reset</button>

          {result && (
            <div className="result-container">
              <h2>Prediction Result:</h2>
              <p><strong>Class:</strong> {result.predicted_class}</p>
              <p><strong>Confidence:</strong> {result.confidence}</p>
              <button className="correction-button" onClick={() => setShowCorrectionModal(true)}>
                🛠️ Wrong Prediction?
              </button>
            </div>
          )}
        </div>

        {showCorrectionModal && (
          <div className="modal">
            <div className="modal-content">
              <h3>Submit Correction</h3>
              <input
                type="text"
                value={correctLabel}
                onChange={(e) => setCorrectLabel(e.target.value)}
                placeholder="Correct food label"
              />
              <div className="modal-buttons">
                <button onClick={handleCorrectionSubmit} disabled={!correctLabel}>Submit</button>
                <button onClick={() => setShowCorrectionModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      </div>
    </div>
  );
}

export default App;
