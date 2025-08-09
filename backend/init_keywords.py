#!/usr/bin/env python3

# convolute/backend/app/init_keywords
"""
Initialize keywords in the database
Run this once after setting up the database to populate keywords.
"""

import sys
import os

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.services.keyword_service import KeywordService


def main():
    """Initialize keywords in the database"""
    app = create_app()
    
    with app.app_context():
        print("Populating keywords...")
        result = KeywordService.populate_keywords()
        print(f"Result: {result}")
        
        print("\nKeyword stats:")
        stats = KeywordService.get_keyword_stats()
        print(f"Total keywords: {stats['total_keywords']}")
        print(f"Current index: {stats['current_index']}")
        print(f"Next keyword: {stats['next_keyword_preview']}")


if __name__ == '__main__':
    main()
