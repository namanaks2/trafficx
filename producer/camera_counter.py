"""Publish vehicle counts from YOLOv8 video or an explicitly simulated source."""
import asyncio
import logging
import os
import random
import uuid
from datetime import datetime, timezone

try:
    from .kafka_utils import connect_producer, publish_json
except ImportError:
    from kafka_utils import connect_producer, publish_json

logger = logging.getLogger(__name__)
VEHICLE_CLASSES = {"car", "truck", "bus", "motorcycle", "motorbike"}


def count_vehicles(video_path: str | None = None, model_path: str | None = None) -> dict:
    video_path = video_path or os.getenv("CAMERA_VIDEO")
    model_path = model_path or os.getenv("YOLO_MODEL")
    if video_path and model_path and os.path.exists(video_path) and os.path.exists(model_path):
        try:
            from ultralytics import YOLO
            model = YOLO(model_path)
            vehicle_ids = {
                class_id for class_id, label in model.names.items()
                if label.lower() in VEHICLE_CLASSES
            }
            frame_counts = []
            for result in model.predict(source=video_path, stream=True, verbose=False):
                frame_counts.append(
                    sum(int((result.boxes.cls == class_id).sum()) for class_id in vehicle_ids)
                )
            if frame_counts:
                return {
                    "vehicle_count": int(round(sum(frame_counts) / len(frame_counts))),
                    "frames_sampled": len(frame_counts),
                    "source": "camera-real",
                }
            logger.warning("Camera video produced no frames; using labelled simulation")
        except Exception as exc:
            logger.warning("Camera inference unavailable (%s); using labelled simulation", type(exc).__name__)
    return {"vehicle_count": random.randint(80, 800), "source": "camera-simulated"}


async def main():
    producer = await connect_producer()
    try:
        while True:
            event = {
                **count_vehicles(),
                "event_id": str(uuid.uuid4()),
                "road_id": os.getenv("CAMERA_ROAD_ID", "camera-road-1"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await publish_json(producer, "traffic.camera", event["road_id"], event)
            await asyncio.sleep(float(os.getenv("CAMERA_INTERVAL_SEC", "5")))
    finally:
        await producer.stop()


if __name__ == "__main__":
    asyncio.run(main())
