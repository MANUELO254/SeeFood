// App.js

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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraRequested, setCameraRequested] = useState(false);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser.');
      console.warn('❌ navigator.mediaDevices.getUserMedia not available');
    } else if (!window.isSecureContext) {
      setError('Camera access requires a secure context (HTTPS).');
      console.warn('❌ Not in secure context');
    } else {
      console.log('✅ Camera and secure context supported');
    }
  }, []);

  useEffect(() => {
    if (cameraRequested && videoRef.current) {
      console.log('🎥 Initiating camera access...');
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          console.log('✅ Camera stream received:', stream);
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
              console.log('✅ Video metadata loaded, playing...');
              video.play().catch((err) => {
                console.error('❌ Video play failed:', err);
                setError('Failed to play camera stream: ' + err.message);
              });
              setIsCameraActive(true);
              setError(null);
            };
          } else {
            console.error('❌ videoRef.current is null');
            setError('Camera initialization failed: video element not found.');
          }
        })
        .catch((err) => {
          console.error('❌ Camera access failed:', err);
          setError('Camera access failed: ' + err.message);
          setIsCameraActive(false);
        })
        .finally(() => {
          console.log('🎥 Camera request completed');
          setCameraRequested(false);
        });

      const timeout = setTimeout(() => {
        if (!isCameraActive) {
          console.warn('❌ Camera failed to start within 5 seconds');
          setError('Camera failed to start. Please try again or use gallery.');
          setCameraRequested(false);
          setIsCameraActive(false);
        }
      }, 5000);

      return () => clearTimeout(timeout);
    } else if (cameraRequested) {
      console.warn('❌ videoRef.current not ready when camera requested');
      setError('Camera initialization failed: video element not ready.');
      setCameraRequested(false);
    }
  }, [cameraRequested, isCameraActive]);

  const startCamera = () => {
    console.log('📸 startCamera called');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser.');
      console.warn('❌ Camera not supported');
      return;
    }
    if (!window.isSecureContext) {
      setError('Camera access requires a secure context (HTTPS).');
      console.warn('❌ Not in secure context');
      return;
    }
    if (!videoRef.current) {
      setError('Camera initialization failed: video element not found.');
      console.error('❌ videoRef.current is null');
      return;
    }
    setCameraRequested(true);
    setShowUploadModal(false);
  };

  const stopCamera = () => {
    console.log('🛑 Stopping camera');
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    console.log('📷 Capturing photo');
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      console.error('❌ Canvas or video not available');
      setError('Capture failed: camera not ready.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      const file = new File([blob], 'captured.jpg', { type: 'image/jpeg' });
      setImage(file);
      setPreview(URL.createObjectURL(blob));
      stopCamera();
    }, 'image/jpeg');
  };

  const handleFileUpload = (e) => {
    console.log('🖼 Handling file upload');
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (e.g., JPEG, PNG).');
      console.warn('❌ Invalid file type:', file.type);
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setShowUploadModal(false);
  };

  const openFilePicker = () => {
    console.log('📂 Opening file picker');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('❌ fileInputRef.current is null');
      setError('File picker failed to open.');
    }
  };

  const handleSubmit = async () => {
    console.log('🚀 Submitting image');
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', image);

    try {
      const res = await axios.post('https://seefood-66db0271b856.herokuapp.com/upload', formData);
      setResult(res.data);
      console.log('✅ Upload successful:', res.data);
    } catch (err) {
      console.error('❌ Upload error:', err.response?.data, err.message);
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectionSubmit = async () => {
    console.log('📝 Submitting correction');
    if (!correctLabel || !image) return;

    const formData = new FormData();
    formData.append('file', image);
    formData.append('correct_label', correctLabel);

    try {
      await axios.post('https://seefood-66db0271b856.herokuapp.com/update-label', formData);
      alert('Correction submitted!');
      setShowCorrectionModal(false);
      setCorrectLabel('');
      console.log('✅ Correction submitted');
    } catch (err) {
      console.error('❌ Correction error:', err.response?.data, err.message);
      alert('Correction failed: ' + (err.response?.data?.error || 'Unknown error'));
    }
  };

  const resetAll = () => {
    console.log('🔄 Resetting all');
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
      <div className="container">
        <div className="circular-background">
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
                <p>
                  <strong>Class:</strong> {result.predicted_class}
                </p>
                <p>
                  <strong>Confidence:</strong> {result.confidence}
                </p>
                <button
                  className="correction-button"
                  onClick={() => setShowCorrectionModal(true)}
                >
                  🛠 Wrong Prediction?
                </button>
              </div>
            )}
          </div>
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
                <button onClick={handleCorrectionSubmit} disabled={!correctLabel}>
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
