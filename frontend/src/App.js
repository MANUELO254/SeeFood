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

  // Check secure context and browser support
  useEffect(() => {
    console.log('Secure context:', window.isSecureContext);
    console.log('getUserMedia support:', !!navigator.mediaDevices?.getUserMedia);
    if (!window.isSecureContext) {
      setError('This app requires a secure context (HTTPS).');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser.');
    }
  }, []);

  // Enumerate devices on mount
  useEffect(() => {
    const checkDevices = async () => {
      try {
        console.log('Enumerating devices...');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('Video devices found:', videoDevices);
        if (videoDevices.length === 0) {
          setError('No camera devices detected. Please ensure a camera is available and permissions are granted.');
        }
      } catch (err) {
        console.error('Device enumeration error:', err);
        setError(`Failed to enumerate devices: ${err.message}`);
      }
    };
    checkDevices();
  }, []);

  // Handle camera initialization
  useEffect(() => {
    if (startCameraRequested && videoRef.current) {
      console.log('Starting camera, videoRef:', videoRef.current);
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } }) // Explicit constraint for mobile
        .then((stream) => {
          console.log('Stream acquired:', stream);
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            console.log('Video dimensions:', videoRef.current.videoWidth, videoRef.current.videoHeight);
            setIsCameraActive(true);
            setError(null);
          };
        })
        .catch((err) => {
          console.error('getUserMedia error:', err);
          let errorMessage = 'Unable to access camera.';
          switch (err.name) {
            case 'NotFoundError':
              errorMessage = 'No camera found. Please connect a camera and try again.';
              break;
            case 'NotAllowedError':
              errorMessage = 'Camera access denied. Please grant camera permissions in browser settings.';
              break;
            case 'NotReadableError':
              errorMessage = 'Camera is in use by another application.';
              break;
            default:
              errorMessage = `Camera error: ${err.message}`;
          }
          setError(errorMessage);
        })
        .finally(() => {
          console.log('Camera request completed');
          setStartCameraRequested(false);
        });
    } else if (startCameraRequested && !videoRef.current) {
      console.error('Video ref not ready');
      setError('Video element not initialized. Please try again.');
      setStartCameraRequested(false);
    }
  }, [startCameraRequested]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      console.log('Cleaning up camera');
      stopCamera();
    };
  }, []);

  const startCamera = () => {
    console.log('Start camera button clicked');
    if (!videoRef.current) {
      console.error('Video ref not initialized');
      setError('Video element not ready. Please try again.');
      return;
    }
    setStartCameraRequested(true);
  };

  const stopCamera = () => {
    console.log('Stopping camera');
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => {
        console.log('Stopping track:', track);
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Rest of the code (capturePhoto, handleFileUpload, etc.) remains unchanged
  // ...

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
              <video ref={videoRef} autoPlay className="video-preview" muted></video>
              <button onClick={capturePhoto} disabled={loading}>Capture Photo</button>
              <button onClick={stopCamera} disabled={loading}>Close Camera</button>
            </div>
          ) : (
            <div className="file-input-container">
              <button onClick={startCamera} disabled={loading}>Take a Photo</button>
              <input type="file" accept="image/*" onChange={handleFileUpload} disabled={loading} />
            </div>
          )}

          {preview && <img src={preview} alt="Preview" className="image-preview" />}
          <button onClick={handleSubmit} disabled={loading || !image}>
            {loading ? 'Processing...' : 'Upload Image'}
          </button>
          <button onClick={resetState} disabled={loading}>Reset</button>

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
              <p>Please enter the correct food label:</p>
              <input
                type="text"
                value={correctLabel}
                onChange={(e) => setCorrectLabel(e.target.value)}
                placeholder="Correct food label"
                className="correction-input"
              />
              <div className="modal-buttons">
                <button onClick={handleCorrectionSubmit} disabled={!correctLabel.trim()}>
                  Submit Correction
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
