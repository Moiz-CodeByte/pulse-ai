from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import numpy as np
import cv2
import tensorflow as tf
from tensorflow.keras.applications.vgg16 import preprocess_input

app = Flask(__name__)
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR.parent / "models" / "pulse_ai_model_5class.h5"
model = tf.keras.models.load_model(MODEL_PATH)
ACDC_CLASSES = ['NOR', 'RV', 'HCM', 'MINF', 'DCM']
INT_TO_ACDC = {idx: label for idx, label in enumerate(ACDC_CLASSES)}
ACDC_TO_NAME = {
    'NOR': 'Normal',
    'RV': 'Abnormal Right Ventricle',
    'HCM': 'Hypertrophic Cardiomyopathy',
    'MINF': 'Myocardial Infarction',
    'DCM': 'Dilated Cardiomyopathy',
}
ACDC_TO_THREAT = {
    'NOR': 'Low',
    'RV': 'Medium',
    'HCM': 'Medium',
    'MINF': 'High',
    'DCM': 'High',
}
THREAT_CLASSES = ['Low', 'Medium', 'High']
IMAGE_SIZE = (224, 224)
CENTER_CROP_RATIO = 0.70

print(f"✅ Pulse AI VGG16 5-class model loaded from {MODEL_PATH}")


def center_crop_rgb(image, crop_ratio=0.70):
    height, width = image.shape[:2]
    crop_h = max(32, int(height * crop_ratio))
    crop_w = max(32, int(width * crop_ratio))
    y0 = max(0, (height - crop_h) // 2)
    x0 = max(0, (width - crop_w) // 2)
    y1 = min(height, y0 + crop_h)
    x1 = min(width, x0 + crop_w)
    return image[y0:y1, x0:x1]


def preprocess_image(file_bytes):
    img_array = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = center_crop_rgb(img, crop_ratio=CENTER_CROP_RATIO)
    img = cv2.resize(img, IMAGE_SIZE)
    img = img.astype(np.float32)
    img = np.expand_dims(img, axis=0)
    img = preprocess_input(img)
    return img


def map_probs_to_threat(acdc_probs):
    threat_probs = {label: 0.0 for label in THREAT_CLASSES}
    for class_idx, prob in enumerate(acdc_probs):
        acdc_class = INT_TO_ACDC[class_idx]
        threat_probs[ACDC_TO_THREAT[acdc_class]] += float(prob)
    return threat_probs


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "Pulse AI VGG16 5-class Flask API is running"})


@app.route("/analyze", methods=["POST"])
def analyze_mri():
    if "mri_image" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["mri_image"]
    file_bytes = file.read()

    try:
        img = preprocess_image(file_bytes)
        acdc_probs = model.predict(img, verbose=0)[0]
        acdc_class = INT_TO_ACDC[int(np.argmax(acdc_probs))]
        threat_probs = map_probs_to_threat(acdc_probs)
        threat_level = max(threat_probs, key=threat_probs.get)
        confidence = round(float(np.max(acdc_probs)) * 100, 2)

        return jsonify({
            "acdcClass": acdc_class,
            "acdcName": ACDC_TO_NAME[acdc_class],
            "threatLevel": threat_level,
            "confidence": confidence,
            "acdcProbabilities": {
                INT_TO_ACDC[idx]: round(float(prob) * 100, 2)
                for idx, prob in enumerate(acdc_probs)
            },
            "threatProbabilities": {
                label: round(prob * 100, 2)
                for label, prob in threat_probs.items()
            },
            "recommendation": get_recommendation(threat_level)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_recommendation(threat_level):
    recommendations = {
        "Low": "No immediate concern. Routine annual checkup recommended.",
        "Medium": "Consult a cardiologist within 2-4 weeks for further evaluation.",
        "High": "Urgent cardiologist consultation required. Schedule within 48-72 hours."
    }
    return recommendations.get(threat_level, "Please consult a doctor.")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)