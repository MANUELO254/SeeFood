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
from dotenv import load_dotenv
import requests
from pathlib import Path

# === Load environment variables from .env ===
dotenv_path = r"C:\Users\Manuel\Desktop\SeeFood\backend\.env"
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    print(f".env file not found at {dotenv_path}")

# === Flask App Setup ===
app = Flask(__name__)
CORS(app)

# === Constants ===
MODEL_URL = "https://huggingface.co/Manuelo254/seefood/resolve/main/best_model.keras?download=true"
MODEL_PATH = Path("best_model.keras")
LABELS_PATH = Path("label_index_mapping.csv")

# === Download model if it doesn't exist ===
def download_model():
    if not MODEL_PATH.exists():
        print("📦 Downloading model from Hugging Face...")
        response = requests.get(MODEL_URL, stream=True)
        response.raise_for_status()
        with open(MODEL_PATH, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        print("✅ Model download complete.")

download_model()

# === Load Model ===
print("🚀 Loading model...")
model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
print("✅ Model loaded.")

# === MongoDB Atlas Setup ===
mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    raise ValueError("❌ MONGO_URI not found in environment variables.")
else:
    print("✅ Mongo URI loaded from .env")

client = MongoClient(mongo_uri)
db = client['SeeFoodDB']
corrections_collection = db['corrections']

# === Load Class Labels from CSV ===
def load_class_labels():
    if not LABELS_PATH.exists():
        raise FileNotFoundError(f"❌ Label CSV not found at {LABELS_PATH}")
    df = pd.read_csv(str(LABELS_PATH))
    return dict(zip(df['index'].astype(str), df['label']))

class_names = load_class_labels()
print("✅ Class labels loaded.")

# === Utilities ===
def hash_image(image_bytes):
    return hashlib.sha256(image_bytes).hexdigest()

def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((224, 224))
    image_array = np.array(image) / 255.0
    return np.expand_dims(image_array, axis=0)

# === Routes ===
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

        # Check for manual corrections
        correction = corrections_collection.find_one({'image_hash': image_hash})
        if correction:
            return jsonify({
                'predicted_class': correction['correct_label'],
                'confidence': '100%'  # Manually corrected
            })

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

        # Save correction in MongoDB
        corrections_collection.update_one(
            {'image_hash': image_hash},
            {'$set': {'correct_label': correct_label}},
            upsert=True
        )

        # Save corrected image locally
        corrections_dir = Path('corrections') / correct_label
        corrections_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.png"
        file_path = corrections_dir / filename
        with open(file_path, 'wb') as f:
            f.write(img_bytes)

        # Log to file
        with open('corrections.txt', 'a') as log_file:
            log_file.write(f"{correct_label},{file_path}\n")

        return jsonify({'message': 'Correction received, thank you!'})

    except Exception as e:
        return jsonify({'error': f'Error saving correction: {str(e)}'}), 500

# === Start Server ===
if __name__ == '__main__':
    app.run(debug=True)
