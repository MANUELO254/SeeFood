from flask import Flask, request, jsonify
from flask_cors import CORS
import tflite_runtime.interpreter as tflite
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
import requests
from functools import lru_cache
import logging

# === Setup Logging ===
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === Load environment variables ===
dotenv_path = Path(".env")
if dotenv_path.exists():
    load_dotenv(dotenv_path)
    logger.info("✅ Loaded .env file")
else:
    logger.warning("⚠️ .env file not found. Assuming Heroku environment variables.")

# === Flask App Setup ===
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://see-food-umber.vercel.app", "https://*.vercel.app"]}}, supports_credentials=True)
logger.info("✅ Flask app initialized with CORS")

# === Constants ===
MODEL_DIR = Path("/app/backend/models")
MODEL_PATH = MODEL_DIR / "best_model.tflite"
LABELS_PATH = Path("restructured_labels.csv")
HUGGINGFACE_MODEL_URL = "https://huggingface.co/Manuelo254/SeeFoodKeras/resolve/main/best_model.tflite?download=true"

# === Download Model from Hugging Face URL ===
def download_model():
    logger.info(f"Model path: {MODEL_PATH.resolve()}")
    if not MODEL_PATH.exists():
        logger.info("📦 Downloading model from Hugging Face URL...")
        os.makedirs(MODEL_DIR, exist_ok=True)
        try:
            response = requests.get(HUGGINGFACE_MODEL_URL, stream=True)
            if response.status_code == 200:
                with open(MODEL_PATH, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                logger.info("✅ Model download complete.")
                file_size = MODEL_PATH.stat().st_size
                logger.info(f"Downloaded file size: {file_size} bytes")
                if file_size < 1000:
                    raise ValueError("Downloaded model file is too small, likely corrupted.")
            else:
                raise Exception(f"Failed to download model. Status code: {response.status_code}")
        except Exception as e:
            logger.error(f"❌ Failed to download model: {str(e)}")
            raise
    else:
        logger.info("✅ Model already exists locally.")

# === Lazy Model Loading (TFLite) ===
@lru_cache(maxsize=1)
def get_interpreter():
    download_model()
    logger.info("🚀 Loading TFLite model from disk...")
    interpreter = tflite.Interpreter(model_path=str(MODEL_PATH))
    interpreter.allocate_tensors()
    logger.info("✅ TFLite model loaded.")
    return interpreter

# === MongoDB Atlas Setup ===
mongo_uri = os.getenv("MONGO_URI")
if not mongo_uri:
    logger.error("❌ MONGO_URI not set in environment variables.")
    raise ValueError("❌ MONGO_URI not set in environment variables.")
else:
    logger.info("✅ Mongo URI loaded.")

client = MongoClient(mongo_uri)
try:
    client.admin.command('ping')
    logger.info("✅ MongoDB connection successful.")
except Exception as e:
    logger.error(f"❌ MongoDB connection failed: {str(e)}")
    raise

db = client['SeeFoodDB']
corrections_collection = db['corrections']

# === Load Class Labels ===
def load_class_labels():
    if not LABELS_PATH.exists():
        logger.error(f"❌ Label CSV not found at {LABELS_PATH}")
        raise FileNotFoundError(f"❌ Label CSV not found at {LABELS_PATH}")
    df = pd.read_csv(str(LABELS_PATH))
    df['label'] = df['label'].str.strip("[]").str.strip("'").str.strip()
    unique_labels = df['label'].unique()
    label_to_index = {label: str(i) for i, label in enumerate(unique_labels)}
    df['index'] = df['label'].map(label_to_index)
    return dict(zip(df['index'], df['label']))

try:
    class_names = load_class_labels()
    logger.info("✅ Class labels loaded.")
except Exception as e:
    logger.error(f"❌ Failed to load class labels: {str(e)}")
    raise

# === Utilities ===
def hash_image(image_bytes):
    return hashlib.sha256(image_bytes).hexdigest()

def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((224, 224))
    image_array = np.array(image, dtype=np.float32) / 255.0
    return np.expand_dims(image_array, axis=0)

# === Routes ===
@app.route('/')
def home():
    try:
        get_interpreter()
        model_status = {"status": "success", "message": "TFLite model loaded successfully"}
    except Exception as e:
        model_status = {"status": "error", "message": str(e)}
        logger.error(f"❌ Home route error: {str(e)}")
    return jsonify({
        'message': '✅ SeeFood backend is up and running!',
        'model_status': model_status
    })

@app.route('/upload', methods=['POST'])
def upload_image():
    logger.info("📤 Received upload request")
    if 'file' not in request.files:
        logger.warning("No file provided in request")
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        logger.warning("Empty filename in request")
        return jsonify({'error': 'No selected file'}), 400

    try:
        img_bytes = file.read()
        image_hash = hash_image(img_bytes)
        logger.info(f"Image hash: {image_hash}")

        correction = corrections_collection.find_one({'image_hash': image_hash})
        if correction:
            logger.info(f"Found correction for hash: {image_hash}")
            return jsonify({
                'predicted_class': correction['correct_label'],
                'confidence': '100%'
            })

        interpreter = get_interpreter()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        processed = preprocess_image(img_bytes)

        interpreter.set_tensor(input_details[0]['index'], processed)
        interpreter.invoke()
        output_data = interpreter.get_tensor(output_details[0]['index'])
        
        predicted_index = np.argmax(output_data[0])
        predicted_class = class_names.get(str(predicted_index), 'Unknown')
        confidence = float(output_data[0][predicted_index])

        logger.info(f"Prediction: {predicted_class}, Confidence: {confidence:.2%}")
        return jsonify({
            'predicted_class': predicted_class,
            'confidence': f"{confidence:.2%}"
        })

    except Exception as e:
        logger.error(f"❌ Error processing image: {str(e)}")
        return jsonify({'error': f'Error processing image: {str(e)}'}), 500

@app.route('/update-label', methods=['POST'])
def update_label():
    logger.info("📝 Received update-label request")
    if 'correct_label' not in request.form or 'file' not in request.files:
        logger.warning("Missing correct_label or file in request")
        return jsonify({'error': 'Missing correct_label or image file'}), 400

    correct_label = request.form['correct_label'].strip()
    file = request.files['file']

    if not correct_label or not file:
        logger.warning("Invalid label or file")
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

        filename = f"{uuid.uuid4().hex}.jpg"
        with open(corrections_dir / filename, 'wb') as f:
            f.write(img_bytes)

        logger.info(f"Correction saved: {correct_label}, Hash: {image_hash}")
        return jsonify({'message': 'Correction saved successfully.'})

    except Exception as e:
        logger.error(f"❌ Error saving correction: {str(e)}")
        return jsonify({'error': f'Error saving correction: {str(e)}'}), 500

# === Run App (for local development only) ===
if __name__ == '__main__':
    app.run(debug=True)
