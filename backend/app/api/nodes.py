"""Network nodes API endpoints"""
from fastapi import APIRouter, HTTPException
from ..network.node import node_network
from ..network.ledger import ledger

router = APIRouter(prefix="/api/nodes", tags=["nodes"])


@router.get("/")
async def list_nodes():
    return node_network.get_all()


@router.get("/health")
async def network_health():
    health = node_network.network_health()
    health["chain_valid"] = ledger.verify_chain()
    return health


@router.get("/ledger")
async def get_ledger(limit: int = 20):
    return {
        "entries": ledger.get_recent(limit),
        "chain_valid": ledger.verify_chain(),
        "total_entries": len(ledger.entries),
    }


@router.post("/{node_id}/observe")
async def submit_observation(node_id: str):
    """Submit a traffic observation from a node to the ledger."""
    node = node_network.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.status == "offline":
        raise HTTPException(status_code=400, detail="Node is offline")

    observation = node.generate_observation()
    entry = ledger.add_entry(
        node_id=node_id,
        location=node.location_name,
        observation=observation,
    )
    confirmations = node_network.broadcast_observation(node_id, observation)
    ledger.confirm_entry(entry.tx_id, len(confirmations))

    return {
        "tx_id": entry.tx_id,
        "hash": entry.hash,
        "prev_hash": entry.prev_hash,
        "verified": entry.verified,
        "confirmations": len(confirmations),
        "observation": observation,
    }
