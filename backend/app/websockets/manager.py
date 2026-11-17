"""
WebSocket connection manager.
Maintains per-channel subscriber sets and broadcasts messages.
"""
import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        # channel → set of websockets
        self._channels: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, ws: WebSocket, channel: str = "all"):
        await ws.accept()
        self._channels[channel].add(ws)
        self._channels["all"].add(ws)
        logger.debug("WS connect: channel=%s total=%d", channel, len(self._channels["all"]))

    def disconnect(self, ws: WebSocket, channel: str = "all"):
        self._channels[channel].discard(ws)
        self._channels["all"].discard(ws)

    async def broadcast(self, message: dict, channel: str = "all"):
        dead = set()
        payload = json.dumps(message, default=str)
        for ws in list(self._channels.get(channel, [])):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws, channel)

    async def broadcast_traffic(self, event: dict):
        await self.broadcast({"type": "traffic", "data": event}, "traffic")

    async def broadcast_prediction(self, pred: dict):
        await self.broadcast({"type": "prediction", "data": pred}, "predictions")

    async def broadcast_incident(self, incident: dict):
        await self.broadcast({"type": "incident", "data": incident}, "incidents")
        await self.broadcast({"type": "incident", "data": incident}, "all")

    async def broadcast_node_status(self, status: dict):
        await self.broadcast({"type": "node_status", "data": status}, "nodes")

    def stats(self) -> dict:
        return {ch: len(ws_set) for ch, ws_set in self._channels.items() if ws_set}


ws_manager = WebSocketManager()
