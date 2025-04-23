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
    if (startCameraRequested && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
          setError(null);
        })
        .catch((err) => {
          console.error('Error accessing camera:', err);
          setError('Unable to access your camera. Please check permissions.');
        })
        .finally(() => {
          setStartCameraRequested(false);
        });
    }
  }, [startCameraRequested]);

  useEffect(() => {
    return () => {
      stopCamera(); // Cleanup camera on unmount
    };
  }, []);

  const startCamera = () => {
    setStartCameraRequested(true);
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!video?.videoWidth || !video?.videoHeight) {
      setError('Invalid video dimensions');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Failed to convert image to blob');
        return;
      }
      setImage(blob);
      setPreview(canvas.toDataURL('image/png'));
    }, 'image/png', 0.95);

    stopCamera();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setError('No file selected');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!image) {
      setError('Please upload or capture an image first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', image);

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/upload`, formData);

      setResult(response.data);
      setShowCorrectionModal(false);
    } catch (err) {
      console.error('Error uploading image:', err);
      const errorMessage = err.response?.data?.error || `Failed to process the image: ${err.message}`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openCorrectionModal = () => {
    setShowCorrectionModal(true);
    setCorrectLabel('');
  };

  const handleCorrectionSubmit = async () => {
    if (!correctLabel.trim() || !image) {
      setError('Please enter a valid label.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('correct_label', correctLabel);
      formData.append('file', image);

      await axios.post(`${process.env.REACT_APP_API_URL}/update-label`, formData);

      alert('Thank you! Your correction has been submitted.');
      setCorrectLabel('');
      setShowCorrectionModal(false);
    } catch (err) {
      console.error('Error sending correction:', err);
      const errorMessage = err.response?.data?.error || `Failed to send the corrected label: ${err.message}`;
      setError(errorMessage);
    }
  };

  const resetState = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCorrectLabel('');
    setShowCorrectionModal(false);
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
              <video ref={videoRef} autoPlay className="video-preview"></video>
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
