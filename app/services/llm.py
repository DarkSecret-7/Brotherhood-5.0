# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project Developers
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""
LLM service layer - Business logic for LLM operations.
Sends API requests and processes responses.
"""
import json
import requests
from .. import schemas, utils
from . import prompts

# Available free models on OpenRouter (rate limited: 20 req/min, 50-1000 req/day)
# Rate limits: 50/day without credits, 1000/day with 10+ credits purchased
AVAILABLE_MODELS = {
    "openrouter/free": "Auto-select",
    "qwen/qwen3-next-80b-a3b-instruct:free": "Qwen3 Next 80B (fast)",
    "qwen/qwen3-coder:free": "Qwen3 Coder 480B (coding specialist)",
    "nvidia/nemotron-3-super-120b-a12b:free": "NVIDIA Nemotron 3 Super",
    "openrouter/owlalpha": "OpenRouter Owl Alpha",
    "google/gemma-4-31b-it:free": "Google Gemma 4",
    "openai/gpt-oss-120b:free": "OpenAI GPT-OSS 120B",
    "z-ai/glm-4.5-air:free": "GLM 4.5 Air",
    "deepseek/deepseek-chat-v3-0324:free": "DeepSeek Chat V3",
    "minimax/minimax-m2.5:free": "Minimax M2.5",
    "poolside/laguna-m.1:free": "Poolside Laguna M.1 (programming specialist)"
}

DEFAULT_MODEL = "openrouter/free"

def get_available_models():
    """Get list of available LLM models."""
    return {
        "models": [
            {"id": model_id, "name": model_name}
            for model_id, model_name in AVAILABLE_MODELS.items()
        ],
        "default": DEFAULT_MODEL
    }

def get_suggestions(query: schemas.LLMQuery, api_key: str):
    # Use provided model or default to Auto-select
    model = query.model if query.model and query.model in AVAILABLE_MODELS else DEFAULT_MODEL

    # Use custom system prompt if provided, otherwise use default
    system_prompt = query.system_prompt if query.system_prompt else prompts.SUGGEST_NODES_SYSTEM_PROMPT

    user_content = f"Prompt: {query.prompt}"
    if query.graph_name:
        user_content += f"\nGraph Name: {query.graph_name}"

    if query.context:
        user_content += f"\n\n--- Existing Graph Context ---\nThe following nodes already exist in the graph (Title: Description):\n{query.context}\n\nBased on this context, suggest modular additions that fit well with these existing nodes."

    # OpenRouter API call
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://the-brotherhood-project.onrender.com",
            "X-Title": "The Brotherhood Project"
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": 4000
        },
        timeout=60
    )

    response.raise_for_status()
    data = response.json()

    # Extract content from OpenRouter response
    content = data["choices"][0]["message"]["content"]

    # DEBUG: Print raw response
    print(f"[LLM DEBUG] Raw content length: {len(content)}")
    print(f"[LLM DEBUG] Raw content: {content[:500]}...")

    # Parse JSON with fallback for truncated responses
    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        # Try to extract valid JSON array from truncated response
        print(f"[LLM DEBUG] JSON parse failed, attempting recovery...")
        result = utils.extract_suggestions_from_truncated(content)

    # DEBUG: Print parsed result
    print(f"[LLM DEBUG] Parsed result: {result}")

    # Validate response structure
    if not isinstance(result, dict):
        raise ValueError(f"Expected dict, got {type(result).__name__}")

    suggestions = result.get("suggestions", [])
    if not isinstance(suggestions, list):
        raise ValueError(f"Expected suggestions list, got {type(suggestions).__name__}")

    # Normalize suggestions - ensure each has title and description
    valid_suggestions = []
    for i, item in enumerate(suggestions):
        if isinstance(item, dict):
            title = item.get("title", "")
            description = item.get("description", "")
            if title and description:
                valid_suggestions.append({
                    "title": str(title),
                    "description": str(description)
                })

    if not valid_suggestions:
        raise ValueError("No valid suggestions found in response")

    return {"suggestions": valid_suggestions}