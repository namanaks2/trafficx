from fastapi import APIRouter
from ..kafka.producer import producer
from ..kafka.consumer import consumer
from ..websockets.manager import ws_manager

router = APIRouter(prefix="/api/kafka", tags=["kafka"])

@router.get("/status")
async def kafka_status():
    stats = consumer.get_stats()
    return {
        "producer_connected": producer.connected,
        "consumer_connected": stats["connected"],
        "topics": stats["topics"],
        "websocket_subscribers": ws_manager.stats(),
        "note": "Single-broker KRaft setup — no replication.",
    }
