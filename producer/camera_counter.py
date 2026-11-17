"""Camera counter: optional Ultralytics YOLOv8, otherwise labelled simulation."""
import os
import random


def count_vehicles(video_path: str | None = None, model_path: str | None = None) -> dict:
    video_path = video_path or os.getenv("CAMERA_VIDEO")
    model_path = model_path or os.getenv("YOLO_MODEL")
    if video_path and model_path and os.path.exists(video_path) and os.path.exists(model_path):
        try:
            from ultralytics import YOLO
            model = YOLO(model_path)
            frames = model(video_path, stream=True)
            count = sum(1 for _ in frames)
            return {"vehicle_count": count, "source": "camera-real"}
        except Exception:
            pass
    return {"vehicle_count": random.randint(80, 800), "source": "camera-simulated"}
