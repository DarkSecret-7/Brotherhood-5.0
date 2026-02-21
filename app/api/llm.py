from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas, database
from . import prompts
import os
import json
from typing import List

router = APIRouter()

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
        
        system_prompt = prompts.SUGGEST_NODES_SYSTEM_PROMPT
        
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
