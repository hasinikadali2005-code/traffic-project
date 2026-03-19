"""
Flask API Server - EfficientNet Traffic Density Backend

A lightweight REST API for classifying traffic density in lane images
using EfficientNet.

Endpoints:
  GET  /health         - Health check with backend info
    POST /detect         - Classify lane image from base64-encoded image
    POST /detect-file    - Classify lane image from multipart file upload
    POST /batch-detect   - Classify multiple lane images
  GET  /config         - Get classifier configuration
  POST /config         - Update classifier thresholds
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

CLASSIFIER_MODEL_NAME = os.getenv("CLASSIFIER_MODEL", "efficientnet_b0")
CLASSIFIER_LOW_THRESHOLD = float(os.getenv("CLASSIFIER_LOW_THRESHOLD", "0.30"))
CLASSIFIER_HIGH_THRESHOLD = float(os.getenv("CLASSIFIER_HIGH_THRESHOLD", "0.60"))

classifier = get_default_classifier(
    model_name=CLASSIFIER_MODEL_NAME,
    low_threshold=CLASSIFIER_LOW_THRESHOLD,
    high_threshold=CLASSIFIER_HIGH_THRESHOLD,
)


def _normalize_classification_result(result: dict) -> dict:
    """Normalize response schema for frontend density-based lane analysis."""
    normalized = dict(result or {})

    density = normalized.get("traffic_density")
    if density not in {"Low", "Medium", "High"}:
        density = "Low"

    try:
        density_score = float(normalized.get("density_score", 0.0))
    except (TypeError, ValueError):
        density_score = 0.0

    density_score = max(0.0, min(1.0, density_score))

    try:
        traffic_score = int(normalized.get("traffic_score", 0))
    except (TypeError, ValueError):
        traffic_score = 0

    traffic_score = max(0, min(100, traffic_score))

    top_predictions = normalized.get("top_predictions")
    if not isinstance(top_predictions, list):
        top_predictions = []

    score_breakdown = normalized.get("score_breakdown")
    if not isinstance(score_breakdown, list):
        score_breakdown = []

    normalized.update({
        "traffic_density": density,
        "density_score": round(density_score, 4),
        "traffic_score": traffic_score,
        "top_predictions": top_predictions,
        "score_breakdown": score_breakdown,
    })

    return normalized


def _simple_density_response(result: dict, lane: str | None = None) -> dict:
    """Return a clean, minimal API response focused on traffic density only."""
    normalized = _normalize_classification_result(result)
    payload = {
        "success": bool(normalized.get("success")),
        "traffic_density": normalized.get("traffic_density", "Low"),
    }
    if lane is not None and str(lane).strip() != "":
        payload["lane"] = str(lane).strip()
    if not payload["success"]:
        payload["error"] = str(normalized.get("error", "Classification failed"))
    return payload


def _is_client_image_error(message: str) -> bool:
    """Identify invalid image payload errors that should return HTTP 400."""
    text = (message or "").lower()
    markers = [
        "base64",
        "payload",
        "empty",
        "corrupted",
        "unsupported",
        "invalid shape",
        "no file provided",
    ]
    return any(marker in text for marker in markers)


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint with backend information."""
    return jsonify({
        "status": "healthy",
        "backend": "efficientnet",
        "model": classifier.model_name,
    }), 200


@app.route("/detect", methods=["POST"])
def classify_base64():
    """Classify traffic density from base64-encoded image."""
    data = request.get_json(silent=True) or {}

    if "image" not in data:
        return jsonify({
            "success": False,
            "error": "Missing 'image' field",
            "traffic_density": "Low",
        }), 400

    lane = data.get("lane") or data.get("lane_name") or data.get("lane_id")

    try:
        result = _simple_density_response(
            classify_from_base64(data["image"], classifier)
            ,
            lane=lane,
        )

        if result.get("success"):
            return jsonify(result), 200

        status_code = 400 if _is_client_image_error(result.get("error", "")) else 500
        return jsonify(result), status_code
    except Exception as exc:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(exc),
            "traffic_density": "Low",
        }), 500


@app.route("/detect-file", methods=["POST"])
def classify_from_file():
    """Classify traffic density from multipart/form-data file upload."""
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({
            "success": False,
            "error": "No file provided",
            "traffic_density": "Low",
        }), 400

    lane = request.form.get("lane") or request.form.get("lane_name") or request.form.get("lane_id")

    try:
        file_bytes = request.files["file"].read()
        image_array = decode_image_bytes_to_bgr(file_bytes)

        result = _simple_density_response(classifier.classify_density(image_array), lane=lane)
        return jsonify(result), 200 if result.get("success") else 500
    except ValueError as exc:
        return jsonify({
            "success": False,
            "error": str(exc),
            "traffic_density": "Low",
        }), 400
    except Exception as exc:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(exc),
            "traffic_density": "Low",
        }), 500


@app.route("/batch-detect", methods=["POST"])
def classify_batch():
    """Classify traffic density in multiple lane images at once."""
    data = request.get_json(silent=True) or {}

    lane_images = data.get("lane_images") if isinstance(data.get("lane_images"), list) else None
    images = data.get("images") if isinstance(data.get("images"), list) else None

    if lane_images is None and images is None:
        return jsonify({
            "success": False,
            "error": "Missing 'lane_images' or 'images' list",
            "results": [],
        }), 400

    try:
        results = []
        if lane_images is not None:
            for item in lane_images:
                if not isinstance(item, dict):
                    results.append({"success": False, "traffic_density": "Low", "error": "Each lane_images item must be an object"})
                    continue
                lane = item.get("lane") or item.get("lane_name") or item.get("lane_id")
                image_payload = item.get("image")
                if image_payload is None:
                    results.append(_simple_density_response({"success": False, "traffic_density": "Low", "error": "Missing image in lane_images item"}, lane=lane))
                    continue
                results.append(_simple_density_response(classify_from_base64(image_payload, classifier), lane=lane))
        else:
            for image_payload in images:
                results.append(_simple_density_response(classify_from_base64(image_payload, classifier)))

        return jsonify({
            "success": True,
            "results": results,
        }), 200
    except Exception as exc:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(exc),
            "results": [],
        }), 500


@app.route("/config", methods=["GET"])
def get_classifier_config():
    """Get current classifier configuration."""
    return jsonify({
        "model": classifier.model_name,
        "low_threshold": classifier.low_threshold,
        "high_threshold": classifier.high_threshold,
        "device": classifier.device,
        "density_levels": ["Low", "Medium", "High"],
    }), 200


@app.route("/config", methods=["POST"])
def update_classifier_config():
    """Update classifier thresholds at runtime."""
    data = request.get_json(silent=True) or {}

    try:
        if "low_threshold" in data:
            low_threshold = float(data["low_threshold"])
            if low_threshold < 0.0 or low_threshold > 1.0:
                raise ValueError("low_threshold must be between 0.0 and 1.0")
            classifier.low_threshold = low_threshold

        if "high_threshold" in data:
            high_threshold = float(data["high_threshold"])
            if high_threshold < 0.0 or high_threshold > 1.0:
                raise ValueError("high_threshold must be between 0.0 and 1.0")
            classifier.high_threshold = high_threshold

        if classifier.low_threshold >= classifier.high_threshold:
            raise ValueError("low_threshold must be lower than high_threshold")

        return jsonify({
            "success": True,
            "config": {
                "low_threshold": classifier.low_threshold,
                "high_threshold": classifier.high_threshold,
            },
        }), 200
    except (ValueError, KeyError) as exc:
        return jsonify({
            "success": False,
            "error": f"Invalid parameter: {str(exc)}",
        }), 400


@app.errorhandler(404)
def handle_not_found(_):
    return jsonify({"success": False, "error": "Endpoint not found"}), 404


@app.errorhandler(500)
def handle_internal_error(_):
    return jsonify({"success": False, "error": "Internal server error"}), 500


if __name__ == "__main__":
    print("=" * 70)
    print("Traffic Density API - EfficientNet Backend")
    print("=" * 70)
    print("\nAvailable Endpoints:")
    print("  GET  /health         Health check with backend info")
    print("  POST /detect         Classify density from base64 image")
    print("  POST /detect-file    Classify density from file upload")
    print("  POST /batch-detect   Classify density in multiple images")
    print("  GET  /config         Get classifier configuration")
    print("  POST /config         Update classifier thresholds")
    print("\nStarting Flask development server...")
    print("  URL: http://localhost:5000")
    print("  CORS: Enabled (localhost:5173/5174)")
    print("=" * 70)
    print()

    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
