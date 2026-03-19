"""
EfficientNet-based traffic density classification backend.

This module classifies an input lane image into one of:
    - Low
    - Medium
    - High

The classifier uses EfficientNet ImageNet probabilities and aggregates
vehicle-related class likelihood to derive a traffic density score.
"""

from __future__ import annotations

import base64
import binascii
import threading
from io import BytesIO

import numpy as np
import torch
from PIL import Image, UnidentifiedImageError
from torchvision import models


LOW_DENSITY_THRESHOLD = 0.30
HIGH_DENSITY_THRESHOLD = 0.60

VEHICLE_KEYWORDS = {
    "car",
    "cab",
    "taxi",
    "truck",
    "bus",
    "motor",
    "scooter",
    "moped",
    "van",
    "jeep",
    "trailer",
    "pickup",
    "minibus",
    "ambulance",
    "fire engine",
    "police van",
}

ROAD_CONTEXT_KEYWORDS = {
    "street",
    "road",
    "highway",
    "traffic light",
    "crosswalk",
    "bridge",
    "lane",
    "intersection",
}

_DEFAULT_CLASSIFIER: "EfficientNetTrafficClassifier | None" = None
_DEFAULT_CLASSIFIER_LOCK = threading.Lock()


def decode_image_bytes_to_bgr(image_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes into a validated RGB uint8 numpy image."""
    if not isinstance(image_bytes, (bytes, bytearray)):
        raise ValueError("Image payload must be bytes")

    raw = bytes(image_bytes)
    if len(raw) == 0:
        raise ValueError("Image payload is empty")

    try:
        with Image.open(BytesIO(raw)) as probe:
            probe.verify()
        with Image.open(BytesIO(raw)) as pil_image:
            rgb_image = np.asarray(pil_image.convert("RGB"))
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError("Uploaded image is corrupted or unsupported") from exc

    if rgb_image.size == 0:
        raise ValueError("Decoded image is empty")

    if rgb_image.ndim != 3 or rgb_image.shape[2] != 3:
        raise ValueError(f"Decoded image has invalid shape: {rgb_image.shape}")

    return np.ascontiguousarray(rgb_image)


def decode_base64_image_to_bgr(image_base64: str) -> np.ndarray:
    """Decode base64 image payload (with or without data URL header) into RGB ndarray."""
    if not isinstance(image_base64, str):
        raise ValueError("Base64 image must be a string")

    payload = image_base64.strip()
    if payload.startswith("data:image") and "," in payload:
        payload = payload.split(",", 1)[1]

    if not payload:
        raise ValueError("Base64 image payload is empty")

    try:
        image_data = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid base64 image payload") from exc

    return decode_image_bytes_to_bgr(image_data)


class EfficientNetTrafficClassifier:
    """Classify lane traffic density with EfficientNet."""

    def __init__(
        self,
        model_name: str = "efficientnet_b0",
        low_threshold: float = LOW_DENSITY_THRESHOLD,
        high_threshold: float = HIGH_DENSITY_THRESHOLD,
        device: str | None = None,
    ):
        if low_threshold >= high_threshold:
            raise ValueError("low_threshold must be lower than high_threshold")

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"

        if model_name == "efficientnet_b0":
            weights = models.EfficientNet_B0_Weights.DEFAULT
            model = models.efficientnet_b0(weights=weights)
        elif model_name == "efficientnet_b1":
            weights = models.EfficientNet_B1_Weights.DEFAULT
            model = models.efficientnet_b1(weights=weights)
        else:
            raise ValueError("model_name must be one of: efficientnet_b0, efficientnet_b1")

        self.model_name = model_name
        self.low_threshold = low_threshold
        self.high_threshold = high_threshold
        self.device = device
        self.categories = weights.meta["categories"]
        self.preprocess = weights.transforms()
        self.model = model.eval().to(self.device)
        self._infer_lock = threading.Lock()

        print(
            f"[EfficientNet] Model ready: {self.model_name}, "
            f"device={self.device}, thresholds=({self.low_threshold}, {self.high_threshold})"
        )

    @staticmethod
    def _label_matches_keywords(label: str, keywords: set[str]) -> bool:
        lowered = label.lower()
        return any(keyword in lowered for keyword in keywords)

    def _score_density(self, probabilities: torch.Tensor) -> tuple[float, list[dict], list[dict]]:
        top_probs, top_indices = torch.topk(probabilities, k=10)

        top_predictions: list[dict] = []
        for rank, (prob, idx) in enumerate(zip(top_probs.tolist(), top_indices.tolist()), start=1):
            label = self.categories[idx]
            top_predictions.append({
                "rank": rank,
                "label": label,
                "confidence": round(float(prob), 4),
            })

        vehicle_score = 0.0
        context_score = 0.0

        for prob, idx in zip(probabilities.tolist(), range(len(probabilities))):
            label = self.categories[idx]
            if self._label_matches_keywords(label, VEHICLE_KEYWORDS):
                vehicle_score += prob
            if self._label_matches_keywords(label, ROAD_CONTEXT_KEYWORDS):
                context_score += prob

        density_score = min(1.0, (vehicle_score * 2.4) + (context_score * 0.8))

        return density_score, top_predictions, [
            {"name": "vehicle_score", "value": round(float(vehicle_score), 4)},
            {"name": "context_score", "value": round(float(context_score), 4)},
            {"name": "density_score", "value": round(float(density_score), 4)},
        ]

    def _density_level(self, density_score: float) -> str:
        if density_score < self.low_threshold:
            return "Low"
        if density_score < self.high_threshold:
            return "Medium"
        return "High"

    @staticmethod
    def _traffic_score_from_level(level: str) -> int:
        if level == "Low":
            return 20
        if level == "Medium":
            return 55
        return 90

    def _prepare_image(self, image_path_or_array) -> np.ndarray:
        if isinstance(image_path_or_array, str):
            try:
                with Image.open(image_path_or_array) as pil_image:
                    rgb_image = np.asarray(pil_image.convert("RGB"))
            except (UnidentifiedImageError, OSError, ValueError) as exc:
                raise ValueError(f"Could not read image: {image_path_or_array}") from exc
            if rgb_image.size == 0:
                raise ValueError("Input image is empty")
            return np.ascontiguousarray(rgb_image)

        image = image_path_or_array
        if image is None:
            raise ValueError("Input image is None")
        if not isinstance(image, np.ndarray):
            raise ValueError(f"Input must be numpy.ndarray, got {type(image).__name__}")
        if image.size == 0:
            raise ValueError("Input image is empty")

        if image.ndim == 2:
            image = np.stack([image, image, image], axis=-1)
        elif image.ndim == 3 and image.shape[2] == 4:
            image = image[:, :, :3]
        elif image.ndim != 3 or image.shape[2] != 3:
            raise ValueError(f"Unsupported image shape: {image.shape}")

        if image.dtype != np.uint8:
            image = np.clip(image, 0, 255).astype(np.uint8)

        return np.ascontiguousarray(image)

    def classify_density(self, image_path_or_array) -> dict:
        """Classify image into Low/Medium/High traffic density."""
        try:
            rgb_image = self._prepare_image(image_path_or_array)
            pil_image = Image.fromarray(rgb_image)
            input_tensor = self.preprocess(pil_image).unsqueeze(0).to(self.device)

            with self._infer_lock:
                with torch.no_grad():
                    logits = self.model(input_tensor)
                    probabilities = torch.softmax(logits[0], dim=0).cpu()

            density_score, top_predictions, score_breakdown = self._score_density(probabilities)
            density_level = self._density_level(density_score)
            traffic_score = self._traffic_score_from_level(density_level)

            return {
                "success": True,
                "traffic_density": density_level,
                "density_score": round(float(density_score), 4),
                "traffic_score": traffic_score,
                "top_predictions": top_predictions,
                "score_breakdown": score_breakdown,
                "image_shape": list(rgb_image.shape[:2]),
            }
        except Exception as exc:
            return {
                "success": False,
                "error": str(exc),
                "traffic_density": "Low",
                "density_score": 0.0,
                "traffic_score": 0,
                "top_predictions": [],
                "score_breakdown": [],
            }


def get_default_classifier(
    model_name: str = "efficientnet_b0",
    low_threshold: float = LOW_DENSITY_THRESHOLD,
    high_threshold: float = HIGH_DENSITY_THRESHOLD,
    device: str | None = None,
) -> EfficientNetTrafficClassifier:
    """Return process-wide singleton classifier so model loads once and is reused."""
    global _DEFAULT_CLASSIFIER
    with _DEFAULT_CLASSIFIER_LOCK:
        if _DEFAULT_CLASSIFIER is None:
            _DEFAULT_CLASSIFIER = EfficientNetTrafficClassifier(
                model_name=model_name,
                low_threshold=low_threshold,
                high_threshold=high_threshold,
                device=device,
            )
    return _DEFAULT_CLASSIFIER


def classify_from_base64(
    image_base64: str,
    classifier: EfficientNetTrafficClassifier | None = None,
) -> dict:
    """Classify traffic density from base64 encoded image."""
    if classifier is None:
        classifier = get_default_classifier()

    try:
        image_array = decode_base64_image_to_bgr(image_base64)
        return classifier.classify_density(image_array)
    except Exception as exc:
        return {
            "success": False,
            "error": str(exc),
            "traffic_density": "Low",
            "density_score": 0.0,
            "traffic_score": 0,
            "top_predictions": [],
            "score_breakdown": [],
        }


if __name__ == "__main__":
    classifier = get_default_classifier()
    print("EfficientNet traffic density classifier initialized.")
    print(f"  Model: {classifier.model_name}")
