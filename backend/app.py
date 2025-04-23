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
from pathlib import Path
from huggingface_hub import hf_hub_download
from functools import lru_cache

# === Load environment variables ===
dotenv_path = Path(".env")
if dotenv_path.exists():
    load_dotenv(dotenv_path)
else:
    print(f"⚠️ .env file not found. Assuming Heroku environment variables.")

# === Flask App Setup ===
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://see-food-umber.vercel.app"}})  # Allow CORS for Vercel

# === Constants ===
MODEL_PATH = Path("/app/backend/models/best_model.keras")
LABELS_PATH = Path("restructured_labels.csv")

# === Download Model from Hugging Face ===
def download_model():
    print(f"Model path: {MODEL_PATH.resolve()}")
    if not MODEL_PATH.exists():
        print("📦 Downloading model from Hugging Face...")
        os.makedirs(MODEL_PATH.parent, exist_ok=True)
        try:
            hf_hub_download(
                repo_id="Manuelo254/seefood",
                filename="best_model.keras",
                local_dir="/app/backend/models"
            )
            print("✅ Model download complete.")
            file_size = MODEL_PATH.stat().st_size
            print(f"Downloaded file size: {file_size} bytes")
            if file_size < 1000:
                raise ValueError("Downloaded model file is too small, likely corrupted.")
        except Exception as e:
            print(f"❌ Failed to download model: {str(e)}")
            raise
    else:
        print("✅ Model already exists locally.")

# === Lazy Model Loading ===
@lru_cache(maxsize=1)
def get_model():
    download_model()
    print("🚀 Loading model from disk...")
    model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
    print("✅ Model loaded.")
    return model

# === MongoDB Atlas Setup ===
mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    raise ValueError("❌ MONGO_URI not set in environment variables.")
else:
    print("✅ Mongo URI loaded.")

client = MongoClient(mongo_uri)
try:
    client.admin.command('ping')
    print("✅ MongoDB connection successful.")
except Exception as e:
    print(f"❌ MongoDB connection failed: {str(e)}")
    raise

db = client['SeeFoodDB']
corrections_collection = db['corrections']

# === Load Class Labels ===
def load_class_labels():
    if not LABELS_PATH.exists():
        raise FileNotFoundError(f"❌ Label CSV not found at {LABELS_PATH}")
    df = pd.read_csv(str(LABELS_PATH))
    df['label'] = df['label'].str.strip("[]").str.strip("'").str.strip()
    unique_labels = df['label'].unique()
    label_to_index = {label: str(i) for i, label in enumerate(unique_labels)}
    df['index'] = df['label'].map(label_to_index)
    return dict(zip(df['index'], df['label']))

try:
    class_names = load_class_labels()
    print("✅ Class labels loaded.")
except Exception as e:
    print(f"❌ Failed to load class labels: {str(e)}")
    raise

# === Utilities ===
def hash_image(image_bytes):
    return hashlib.sha256(image_bytes).hexdigest()

def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((224, 224))
    image_array = np.array(image) / 255.0
    return np.expand_dims(image_array, axis=0)

# === Routes ===
@app.route('/')
def home():
    try:
        get_model()
        model_status = {"status": "success", "message": "Model loaded successfully"}
    except Exception as e:
        model_status = {"status": "error", "message": str(e)}
    return jsonify({
        'message': '✅ SeeFood backend is up and running!',
        'model_status': model_status
    })

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

        correction = corrections_collection.find_one({'image_hash': image_hash})
        if correction:
            return jsonify({
                'predicted_class': correction['correct_label'],
                'confidence': '100%'
            })

        model = get_model()
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

        corrections_collection.update_one(
            {'image_hash': image_hash},
            {'$set': {'correct_label': correct_label}},
            upsert=True
        )

        corrections_dir = Path('corrections') / correct_label
        corrections_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.png"
        file_path = corrections_dir / filename
        with open(file_path, 'wb') as f:
            f.write(img_bytes)

        with open('corrections.txt', 'a') as log_file:
            log_file.write(f"{correct_label},{file_path}\n")

        return jsonify({'message': 'Correction received, thank you!'})

    except Exception as e:
        return jsonify({'error': f'Error saving correction: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
