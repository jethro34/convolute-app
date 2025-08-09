# File: monolith_app/app/prompts/client.py

import requests
from flask import current_app

def get_random_prompt(category=None):
    try:
        params = {"category": category} if category else {}
        resp = requests.get(current_app.config["PROMPT_SERVICE_URL"], params=params)
        if resp.status_code == 200:
            return resp.json()["text"]
        return "No prompt available."
    except Exception as e:
        return "Prompt service error."
