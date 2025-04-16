from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
from PIL import Image
import numpy as np
import os
import io
import uuid
import hashlib
import pandas as pd
from pymongo import MongoClient

app = Flask(__name__)
CORS(app)

# Load the model (update this path for deployment if needed)
model = tf.keras.models.load_model(r"C:\Users\Manuel\Desktop\SeeFood\backend\best_model.keras", compile=False)

# MongoDB Atlas Setup
client = MongoClient("mongodb+srv://nyamweyaog:TheFugitive12@cluster0.irllwkj.mongodb.net/?retryWrites=true&w=majority")
db = client['SeeFoodDB']
corrections_collection = db['corrections']

# Load class labels from CSV (index to label mapping)
def load_class_labels():
    df = pd.read_csv(r"C:\SeeFood\backend\label_index_mapping.csv")
    labels_dict = dict(zip(df['index'].astype(str), df['label']))
    return labels_dict

class_names = load_class_labels()

# Generate a hash of the image content
def hash_image(image_bytes):
    return hashlib.sha256(image_bytes).hexdigest()

# Preprocess the image
def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((224, 224))
    image_array = np.array(image) / 255.0
    return np.expand_dims(image_array, axis=0)

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        img_bytes = file.read()
        image_hash = hash_image(img_bytes)

        # Check if image was corrected
        correction = corrections_collection.find_one({'image_hash': image_hash})
        if correction:
            return jsonify({
                'predicted_class': correction['correct_label'],
                'confidence': '100%'  # Manually corrected
            })

        # Model prediction
        processed = preprocess_image(img_bytes)
        prediction = model.predict(processed)
        predicted_index = np.argmax(prediction[0])
        predicted_class = class_names.get(str(predicted_index), 'Unknown')
        confidence = float(prediction[0][predicted_index])

        return jsonify({
            'predicted_class': predicted_class,
            'confidence': f"{confidence:.2%}"
        })

    except Exception as e:
        return jsonify({'error': f'Error processing image: {str(e)}'}), 500

@app.route('/update-label', methods=['POST'])
def update_label():
    if 'correct_label' not in request.form or 'file' not in request.files:
        return jsonify({'error': 'Missing correct_label or image file'}), 400

    correct_label = request.form['correct_label'].strip()
    file = request.files['file']

    if not correct_label or not file:
        return jsonify({'error': 'Invalid label or image file'}), 400

    try:
        img_bytes = file.read()
        image_hash = hash_image(img_bytes)

        # Save correction in MongoDB Atlas
        corrections_collection.update_one(
            {'image_hash': image_hash},
            {'$set': {'correct_label': correct_label}},
            upsert=True
        )

        # Save image locally for retraining
        corrections_dir = os.path.join('corrections', correct_label)
        os.makedirs(corrections_dir, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.png"
        file_path = os.path.join(corrections_dir, filename)
        with open(file_path, 'wb') as f:
            f.write(img_bytes)

        # Log correction to a text file
        with open('corrections.txt', 'a') as log_file:
            log_file.write(f"{correct_label},{file_path}\n")

        return jsonify({'message': 'Correction received, thank you!'})

    except Exception as e:
        return jsonify({'error': f'Error saving correction: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
