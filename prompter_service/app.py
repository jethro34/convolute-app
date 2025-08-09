# File: prompter_service/app.py

from flask import Flask, jsonify, request
from prompts import PROMPTS
import random

app = Flask(__name__)

@app.route('/api/prompt', methods=['GET'])
def get_prompt():
    category = request.args.get("category")
    if category:
        filtered = [p for p in PROMPTS if p["category"] == category]
    else:
        filtered = PROMPTS

    if not filtered:
        return jsonify({"error": "No prompts available"}), 404

    prompt = random.choice(filtered)
    return jsonify(prompt)

if __name__ == "__main__":
    app.run(port=5001)
