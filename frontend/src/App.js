import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Logo from './assets/logo.png';

function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [correctLabel, setCorrectLabel] = useState('');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraRequested, setCameraRequested] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Mobile viewport height fix
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', ${vh}px);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser.');
    } else if (!window.isSecureContext) {
      setError('Camera access requires a secure context (HTTPS).');
    }
  }, []);

  useEffect(() => {
    if (cameraRequested && videoRef.current) {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
              video.play();
              setIsCameraActive(true);
              setError(null);
            };
          }
        })
        .catch((err) => {
          setError('Camera access failed: ' + err.message);
          setIsCameraActive(false);
        })
        .finally(() => {
          setCameraRequested(false);
        });

      const timeout = setTimeout(() => {
        if (!isCameraActive) {
          setError('Camera failed to start. Please try again or use gallery.');
          setCameraRequested(false);
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [cameraRequested, isCameraActive]);

  const startCamera = () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError('Camera is not supported or context not secure.');
      return;
    }
    if (!videoRef.current) {
      setError('Camera initialization failed.');
      return;
    }
    setCameraRequested(true);
    setShowUploadModal(false);
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      setError('Capture failed: camera not ready.');
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      const file = new File([blob], 'captured.jpg', { type: 'image/jpeg' });
      setImage(file);
      setPreview(URL.createObjectURL(blob));
      stopCamera();
    }, 'image/jpeg');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setShowUploadModal(false);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', image);

    try {
      const res = await axios.post('https://seefood-66db0271b856.herokuapp.com/upload', formData);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectionSubmit = async () => {
    if (!correctLabel || !image) return;

    const formData = new FormData();
    formData.append('file', image);
    formData.append('correct_label', correctLabel);

    try {
      await axios.post('https://seefood-66db0271b856.herokuapp.com/update-label', formData);
      alert('Correction submitted!');
      setShowCorrectionModal(false);
      setCorrectLabel('');
    } catch (err) {
      alert('Correction failed: ' + (err.response?.data?.error || 'Unknown error'));
    }
  };

  const resetAll = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCorrectLabel('');
    setShowCorrectionModal(false);
    setShowUploadModal(false);
    stopCamera();
  };

  return (
    <div className="app-container">
      <div className="circular-background"></div>
      <div className="container">
        <div className="card">
          <img src={Logo} alt="Logo" className="logo" />
          <h1>SeeFood Image Recognition</h1>
          <p>Upload an image or take a photo to recognize the food.</p>

          {error && <div className="error">{error}</div>}

          <div className="camera-container" style={{ display: isCameraActive ? 'block' : 'none' }}>
            <video ref={videoRef} autoPlay muted playsInline className="video-preview" />
            <button onClick={capturePhoto} disabled={loading}>📸 Capture</button>
            <button onClick={stopCamera} disabled={loading}>❌ Close Camera</button>
          </div>

          {!isCameraActive && (
            <div className="file-input-container">
              <button onClick={() => setShowUploadModal(true)} disabled={loading}>
                📷 Upload Image
              </button>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={loading}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {preview && <img src={preview} alt="Preview" className="image-preview" />}
          <button onClick={handleSubmit} disabled={loading || !image}>
            {loading ? '⏳ Processing...' : '✅ Submit Image'}
          </button>
          <button onClick={resetAll} disabled={loading}>🔄 Reset</button>

          {result && (
            <div className="result-container">
              <h2>Prediction Result:</h2>
              <p><strong>Class:</strong> {result.predicted_class}</p>
              <p><strong>Confidence:</strong> {result.confidence}</p>
              <button className="correction-button" onClick={() => setShowCorrectionModal(true)}>
                🛠 Wrong Prediction?
              </button>
            </div>
          )}
        </div>

        {showUploadModal && (
          <div className="modal">
            <div className="modal-content">
              <h3>Choose Image Source</h3>
              <p>Select how you'd like to upload your image:</p>
              <div className="modal-buttons">
                <button onClick={startCamera}>📸 Take Photo</button>
                <button onClick={openFilePicker}>🖼 Choose from Gallery</button>
                <button onClick={() => setShowUploadModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showCorrectionModal && (
          <div className="modal">
            <div className="modal-content">
              <h3>Submit Correction</h3>
              <input
                type="text"
                value={correctLabel}
                onChange={(e) => setCorrectLabel(e.target.value)}
                placeholder="Correct food label"
                className="correction-input"
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
