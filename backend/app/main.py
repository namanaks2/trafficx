"""
TrafficX FastAPI Backend
Run: uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from .core.config import settings
from .api import traffic, incidents, nodes

app = FastAPI(
    title="TrafficX API",
    description="Decentralized Real-Time Traffic Intelligence Network — Backend API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(traffic.router)
app.include_router(incidents.router)
app.include_router(nodes.router)


@app.get("/")
async def root():
    return {
        "name": "TrafficX API",
        "version": "1.0.0",
        "status": "online",
        "demo_mode": settings.demo_mode,
        "docs": "/api/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "demo_mode": settings.demo_mode}


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
