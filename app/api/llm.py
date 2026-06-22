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

from fastapi import APIRouter
from .. import schemas
import os
import json
import requests
from ..services import llm

router = APIRouter(prefix="/llm")

@router.get("/models")
def get_available_models():
    return llm.get_available_models()

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
        return llm.get_suggestions(query, api_key)
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