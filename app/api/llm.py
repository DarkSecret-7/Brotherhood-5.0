# This file is part of The Brotherhood Project
#
# Copyright (C) 2026  The Brotherhood Project
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

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas, database
from . import prompts
import os
import json
import requests
from typing import List

router = APIRouter(prefix="/llm")


def _extract_suggestions_from_truncated(content: str) -> dict:
    """
    Attempt to extract valid suggestions from a truncated JSON response.
    Uses regex to find complete suggestion objects.
    """
    import re

    # Pattern to match individual suggestion objects
    pattern = r'\{\s*"title"\s*:\s*"([^"]+)"\s*,\s*"description"\s*:\s*"([^"]+)"\s*\}'
    matches = re.findall(pattern, content)

    suggestions = []
    for title, desc in matches:
        suggestions.append({
            "title": title,
            "description": desc
        })

    if suggestions:
        print(f"[LLM DEBUG] Recovered {len(suggestions)} suggestions from truncated response")
        return {"suggestions": suggestions}

    # If regex didn't work, try to find any JSON array
    try:
        # Find the start of suggestions array
        start_idx = content.find('"suggestions"')
        if start_idx != -1:
            # Find opening bracket
            bracket_idx = content.find('[', start_idx)
            if bracket_idx != -1:
                # Try to parse just the array portion
                array_content = content[bracket_idx:]
                # Close any unclosed braces/brackets
                open_braces = array_content.count('{') - array_content.count('}')
                open_brackets = array_content.count('[') - array_content.count(']')

                for _ in range(open_braces):
                    array_content += '}'
                for _ in range(open_brackets):
                    array_content += ']'

                # Try to add closing for the main object
                if not array_content.rstrip().endswith('}'):
                    array_content += '}'

                result = json.loads('{"suggestions": ' + array_content)
                print(f"[LLM DEBUG] Recovered suggestions by closing JSON structure")
                return result
    except Exception as e:
        print(f"[LLM DEBUG] Recovery attempt failed: {e}")

    raise ValueError("Could not extract valid suggestions from truncated response")


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

DEFAULT_MODEL = "qwen/qwen3-next-80b-a3b-instruct:free"

@router.get("/models")
def get_available_models():
    """Get list of available LLM models."""
    return {
        "models": [
            {"id": model_id, "name": model_name}
            for model_id, model_name in AVAILABLE_MODELS.items()
        ],
        "default": DEFAULT_MODEL
    }

@router.post("/suggest", response_model=schemas.LLMResponse)
def get_suggestions(query: schemas.LLMQuery):
    api_key = os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        # Mock response if no API key
        return {
            "suggestions": [
                {"title": "Example Node 1", "description": "This is a generated suggestion (Mock). Add your OpenRouter API key to get real results."},
                {"title": "Example Node 2", "description": "Another example suggestion for the knowledge graph."}
            ]
        }

    try:
        # Use provided model or default to Qwen
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
            result = _extract_suggestions_from_truncated(content)

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

    except requests.exceptions.RequestException as e:
        print(f"OpenRouter API Error: {e}")
        return {
            "suggestions": [
                {"title": "Error", "description": f"Failed to connect to OpenRouter API: {str(e)}"}
            ]
        }
    except (KeyError, json.JSONDecodeError) as e:
        print(f"LLM Response Parsing Error: {e}")
        return {
            "suggestions": [
                {"title": "Error", "description": f"Failed to parse LLM response: {str(e)}"}
            ]
        }
    except Exception as e:
        print(f"LLM Error: {e}")
        # Return a friendly error as a suggestion so the UI doesn't break
        return {
            "suggestions": [
                {"title": "Error", "description": f"Failed to generate suggestions: {str(e)}"}
            ]
        }
