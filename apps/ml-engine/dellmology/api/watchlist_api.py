from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import logging

from dellmology.analysis.unified_power import compute_unified_power

router = APIRouter(prefix="/api/ai/watchlist", tags=["ai", "watchlist"])
logger = logging.getLogger(__name__)


class WatchlistEntry(BaseModel):
    symbol: str
    score: Optional[float] = 0.0
    metrics: Optional[Dict[str, float]] = None


class WatchlistRequest(BaseModel):
    entries: List[WatchlistEntry]


@router.post('/unified_power')
async def compute_watchlist_unified_power(req: WatchlistRequest, request: Request):
    """Compute Unified Power Score for a watchlist of symbols.

    Body: { entries: [{ symbol, score?, metrics? }, ...] }
    Returns enriched entries with `unified_power` and summary stats.
    """
    try:
        entries = [e.dict() for e in req.entries]
        enriched = compute_unified_power(entries, score_key='score')

        ups_values = [e.get('unified_power', 0) for e in enriched]
        stats = {
            'avg_unified_power': sum(ups_values) / len(ups_values) if ups_values else 0,
            'max_unified_power': max(ups_values) if ups_values else 0,
            'min_unified_power': min(ups_values) if ups_values else 0,
        }

        # Return mapping and enriched entries for frontend convenience
        mapping = {e['symbol']: e.get('unified_power', 0) for e in enriched}

        return {'ok': True, 'stats': stats, 'mapping': mapping, 'entries': enriched}
    except Exception as exc:
        logger.exception('Failed to compute watchlist unified power')
        raise HTTPException(status_code=500, detail=str(exc))
