"""
MongoDB connection helper for CortexFlow.

Usage:
    from mongo.connection import get_model_outputs_collection
    collection = get_model_outputs_collection()
"""

import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

_client = None


def _get_client():
    """Return a singleton MongoClient instance."""
    global _client
    if _client is None:
        uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        _client = MongoClient(uri)
    return _client


def get_db():
    """Return the CortexFlow MongoDB database handle."""
    db_name = os.getenv("MONGO_DB_NAME", "cortexflow")
    return _get_client()[db_name]


def get_model_outputs_collection():
    """Return the ``model_outputs`` collection."""
    return get_db()["model_outputs"]
