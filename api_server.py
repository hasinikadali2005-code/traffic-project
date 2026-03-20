"""
Flask API Server - EfficientNet Traffic Density Backend
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
import os

from efficientnet_classifier import (
    classify_from_base64,
    decode_image_bytes_to_bgr,
    get_default_classifier,
)

app = Flask(__name__)
CORS(app)

# -------------------------------
# ✅ ROOT ROUTE (UPDATED UI)
# -------------------------------
@app.route("/")
def home():
    return """
    <h1>🚦 Traffic Density Prediction API</h1>
    <p>✅ Backend is running successfully</p>
    <p>📌 Available endpoints:</p>
    <ul>
        <li>/health</li>
        <li>/detect</li>
        <li>/detect-file</li>
        <li>/batch-detect</li>
        <li>/config</li>
    </ul>
    """

# -------------------------------
# ✅ TEST ROUTE (NEW)
# -------------------------------
@app.route("/predict", methods=["GET"])
def test_predict():
    return jsonify({
        "success": True,
        "message": "Model API working perfectly 🚀"
    })

# -------------------------------
# CONFIG
# -------------------------------
CLASSIFIER_MODEL_NAME = os.getenv("CLASSIFIER_MODEL", "efficientnet_b0")
CLASSIFIER_LOW_THRESHOLD = float(os.getenv("CLASSIFIER_LOW_THRESHOLD", "0.30"))
CLASSIFIER_HIGH_THRESHOLD = float(os.getenv("CLASSIFIER_HIGH_THRESHOLD", "0.60"))

classifier = get_default_classifier(
    model_name=CLASSIFIER_MODEL_NAME,
    low_threshold=CLASSIFIER_LOW_THRESHOLD,
    high_threshold=CLASSIFIER_HIGH_THRESHOLD,
)

# -------------------------------
# HELPERS
# -------------------------------
def _normalize_classification_result(result: dict) -> dict:
    normalized = dict(result or {})

    density = normalized.get("traffic_density")
    if density not in {"Low", "Medium", "High"}:
        density = "Low"

    try:
        density_score = float(normalized.get("density_score", 0.0))
    except:
        density_score = 0.0

    density_score = max(0.0, min(1.0, density_score))

    try:
        traffic_score = int(normalized.get("traffic_score", 0))
    except:
        traffic_score = 0

    traffic_score = max(0, min(100, traffic_score))

    normalized.update({
        "traffic_density": density,
        "density_score": round(density_score, 4),
        "traffic_score": traffic_score,
    })

    return normalized


def _simple_density_response(result: dict, lane=None) -> dict:
    normalized = _normalize_classification_result(result)
    payload = {
        "success": bool(normalized.get("success")),
        "traffic_density": normalized.get("traffic_density", "Low"),
    }
    if lane:
        payload["lane"] = lane
    if not payload["success"]:
        payload["error"] = str(normalized.get("error", "Classification failed"))
    return payload

# -------------------------------
# ROUTES
# -------------------------------

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "backend": "efficientnet",
        "model": classifier.model_name,
    }), 200


@app.route("/detect", methods=["POST"])
def classify_base64():
    data = request.get_json(silent=True) or {}

    if "image" not in data:
        return jsonify({
            "success": False,
            "error": "Missing image",
            "traffic_density": "Low",
        }), 400

    try:
        result = _simple_density_response(
            classify_from_base64(data["image"], classifier)
        )
        return jsonify(result), 200 if result.get("success") else 500

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e),
            "traffic_density": "Low",
        }), 500


@app.route("/detect-file", methods=["POST"])
def classify_file():
    if "file" not in request.files:
        return jsonify({
            "success": False,
            "error": "No file provided",
            "traffic_density": "Low",
        }), 400

    try:
        file_bytes = request.files["file"].read()
        image = decode_image_bytes_to_bgr(file_bytes)

        result = _simple_density_response(
            classifier.classify_density(image)
        )

        return jsonify(result), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e),
            "traffic_density": "Low",
        }), 500


@app.route("/batch-detect", methods=["POST"])
def classify_batch():
    data = request.get_json(silent=True) or {}
    images = data.get("images", [])

    if not isinstance(images, list):
        return jsonify({
            "success": False,
            "error": "images must be list",
            "results": [],
        }), 400

    try:
        results = [
            _simple_density_response(classify_from_base64(img, classifier))
            for img in images
        ]

        return jsonify({
            "success": True,
            "results": results,
        }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e),
            "results": [],
        }), 500


@app.route("/config", methods=["GET"])
def get_config():
    return jsonify({
        "model": classifier.model_name,
        "low_threshold": classifier.low_threshold,
        "high_threshold": classifier.high_threshold,
    })

# -------------------------------
# ❗ IMPORTANT FOR RENDER
# -------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)