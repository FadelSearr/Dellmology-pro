"""
AI Narrative Module
Generates human-readable analysis using LLMs
"""

import logging
import os
from typing import Dict
import google.generativeai as genai

logger = logging.getLogger(__name__)


def generate_narrative(analysis_data: Dict, symbol: str = None) -> str:
    """
    Generate AI narrative for trading analysis using Gemini.

    Args:
        analysis_data: Dictionary with analysis results
        symbol: Stock symbol (optional)

    Returns:
        Human-readable narrative
    """
    logger.info(f"Generating AI narrative for {symbol}...")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set, cannot generate narrative")
        return ""  # silent failure

    # configure generative ai client
    genai.configure(api_key=api_key)

    stats = analysis_data.get("stats", {})
    top = analysis_data.get("top_pick")
    results = analysis_data.get("results", [])

    prompt_lines = [
        "You are a veteran Indonesian stock market analyst with expertise in bandarmology.",
        f"Provide a concise, human-readable narrative for symbol {symbol or 'N/A'} based on the following summary:",
        "Also perform a sentiment stress test based on recent news headlines and search for historical red flags (fraud, legal, management issues) for this company. If any red flags are found, highlight the risk and recommend lowering the Unified Power Score.",
    ]

    if stats:
        prompt_lines.append("\nStatistics:")
        for k, v in stats.items():
            prompt_lines.append(f"- {k.replace('_',' ').title()}: {v}")

    if top:
        prompt_lines.append("\nTop Pick:")
        prompt_lines.append(f"- Symbol {top.get('symbol')} score {top.get('score')}, reason: {top.get('reason')}")

    prompt = "\n".join(prompt_lines)

    try:
        # call Gemini
        response = genai.responses.create(
            model="gemini-1.5-flash",
            input=prompt,
            max_output_tokens=300
        )
        # response may provide output_text or structured
        text = getattr(response, 'output_text', None) or ''
        return text
    except Exception as exc:
        logger.error(f"Gemini API call failed: {exc}")
        return ""
