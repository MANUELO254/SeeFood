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
  const [startCameraRequested, setStartCameraRequested] = useState(false);

  useEffect(() => {
    if (!window.isSecureContext) {
      setError('This app requires HTTPS to access the camera.');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser.');
    }
  }, []);

  useEffect(() => {
    const checkDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        if (videoDevices.length === 0) {
          setError('No camera detected. Please connect a camera.');
        }
      } catch (err) {
        setError(`Device check failed: ${err.message}`);
      }
    };
    checkDevices();
  }, []);

  useEffect(() => {
    if (startCameraRequested && videoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsCameraActive(true);
            setError(null);
          };
        })
        .catch((err) => {
          let errorMessage = 'Unable to access camera.';
          if (err.name === 'NotAllowedError') {
            errorMessage = 'Camera access denied.';
          } else if (err.name === 'NotFoundError') {
            errorMessage = 'No camera found.';
          }
          setError(errorMessage);
        })
        .finally(() => {
          setStartCameraRequested(false);
        });
    }
  }, [startCameraRequested]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = () => setStartCameraRequested(true);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'captured.jpg', { type: 'image/jpeg' });
        setImage(file);
        const imageURL = URL.createObjectURL(blob);
        setPreview(imageURL);
      }
    }, 'image/jpeg');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
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
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    stopCamera();
  };

  const openCorrectionModal = () => setShowCorrectionModal(true);

  const handleCorrectionSubmit = async () => {
    if (!correctLabel.trim() || !image) return;
    setLoading(true);
    setShowCorrectionModal(false);

    const formData = new FormData();
    formData.append('image', image);
    formData.append('correct_label', correctLabel);

    try {
      await axios.post('https://seefood-66db0271b856.herokuapp.com/update-label', formData);
      alert('Correction submitted. Thanks!');
    } catch (err) {
      alert('Error submitting correction.');
    } finally {
      setLoading(false);
      setCorrectLabel('');
    }
  };

  return (
    <div className="app-container">
      <div className="circular-background" style={{ backgroundImage: `url(${TableFoodImage})` }}></div>
      <div className="container">
        <div className="card">
          <img src={Logo} alt="SeeFood Logo" className="logo" />
          <h1>SeeFood Image Recognition</h1>
          <p>Upload an image or take a photo to recognize the food.</p>

          {error && <div className="error">{error}</div>}

          {isCameraActive ? (
            <div className="camera-container">
              <video ref={videoRef} autoPlay className="video-preview" muted playsInline></video>
              <button onClick={capturePhoto} disabled={loading}>📸 Capture Photo</button>
              <button onClick={stopCamera} disabled={loading}>❌ Close Camera</button>
            </div>
          ) : (
            <div className="file-input-container">
              <button onClick={startCamera} disabled={loading}>📷 Take a Photo</button>
              <input type="file" accept="image/*" onChange={handleFileUpload} disabled={loading} />
            </div>
          )}

          {preview && <img src={preview} alt="Preview" className="image-preview" />}
          <button onClick={handleSubmit} disabled={loading || !image}>
            {loading ? 'Processing...' : '✅ Upload Image'}
          </button>
          <button onClick={resetState} disabled={loading}>🔄 Reset</button>

          {result && (
            <div className="result-container">
              <h2>Prediction Result:</h2>
              <p><strong>Class:</strong> {result.predicted_class}</p>
              <p><strong>Confidence:</strong> {result.confidence}</p>
              <button onClick={openCorrectionModal} className="correction-button">
                Wrong Prediction?
              </button>
            </div>
          )}
        </div>

        {showCorrectionModal && (
          <div className="modal">
            <div className="modal-content">
              <h3>Incorrect Prediction</h3>
              <p>Enter the correct label:</p>
              <input
                type="text"
                value={correctLabel}
                onChange={(e) => setCorrectLabel(e.target.value)}
                placeholder="e.g., samosa"
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

        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      </div>
    </div>
  );
}

export default App;
