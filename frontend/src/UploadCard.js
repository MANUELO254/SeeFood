import React, { useState } from 'react';
import axios from 'axios';

function UploadCard() {
  const [image, setImage] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [correction, setCorrection] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
    setPrediction(null);
    setCorrection('');
  };

  const handleUpload = async () => {
    if (!image) return alert('Please select an image first.');

    setLoading(true);
    const formData = new FormData();
    formData.append('file', image);

    try {
      const res = await axios.post('http://localhost:5000/upload', formData);
      setPrediction(res.data);
    } catch (err) {
      console.error(err);
      alert('Error uploading image.');
    } finally {
      setLoading(false);
    }
  };

  const handleCorrection = async () => {
    if (!image || !correction) return alert('Image and correction required.');

    const formData = new FormData();
    formData.append('file', image);
    formData.append('correct_label', correction);

    try {
      await axios.post('http://localhost:5000/update-label', formData);
      alert('Correction submitted. Thanks!');
    } catch (err) {
      console.error(err);
      alert('Failed to submit correction.');
    }
  };

  return (
    <div className="upload-card">
      <h2>Upload an Image</h2>
      <input type="file" onChange={handleImageChange} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? 'Processing...' : 'Upload and Predict'}
      </button>

      {prediction && (
        <div className="result">
          <h3>Prediction:</h3>
          <p><strong>Class:</strong> {prediction.predicted_class}</p>
          <p><strong>Confidence:</strong> {prediction.confidence}</p>

          <input
            type="text"
            placeholder="Correct label"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
          />
          <button onClick={handleCorrection}>Submit Correction</button>
        </div>
      )}
    </div>
  );
}

export default UploadCard;
