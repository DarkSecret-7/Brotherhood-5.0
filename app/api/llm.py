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
from typing import List

router = APIRouter(prefix="/llm")

@router.post("/suggest", response_model=schemas.LLMResponse)
def get_suggestions(query: schemas.LLMQuery):
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        # Mock response if no API key
        return {
            "suggestions": [
                {"title": "Example Node 1", "description": "This is a generated suggestion (Mock). Add your Gemini API key to get real results."},
                {"title": "Example Node 2", "description": "Another example suggestion for the knowledge graph."}
            ]
        }

    try:
        import google.generativeai as genai
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Use custom system prompt if provided, otherwise use default
        system_prompt = query.system_prompt if query.system_prompt else prompts.SUGGEST_NODES_SYSTEM_PROMPT
        
        user_content = f"Prompt: {query.prompt}"
        if query.graph_name:
            user_content += f"\nGraph Name: {query.graph_name}"
            
        if query.context:
            user_content += f"\n\n--- Existing Graph Context ---\nThe following nodes already exist in the graph (Title: Description):\n{query.context}\n\nBased on this context, suggest modular additions that fit well with these existing nodes."

        full_prompt = f"{system_prompt}\n\n{user_content}"
        
        response = model.generate_content(
            full_prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        content = response.text
        
        # Parse JSON
        data = json.loads(content)
        return data

    except Exception as e:
        print(f"LLM Error: {e}")
        # Return a friendly error as a suggestion so the UI doesn't break
        return {
            "suggestions": [
                {"title": "Error", "description": f"Failed to generate suggestions: {str(e)}"}
            ]
        }
