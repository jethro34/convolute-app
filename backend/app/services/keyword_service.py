# convolute/backend/app/services/keyword_service.py

"""
Keyword service for managing circular buffer keyword generation
"""
from ..models import Keyword, KeywordPointer
from ..extensions import db


class KeywordService:
    @staticmethod
    def get_next_keyword():
        """Get the next keyword using circular buffer logic"""
        # Get or create the pointer
        pointer = KeywordPointer.query.first()
        if not pointer:
            pointer = KeywordPointer(current_index=0)
            db.session.add(pointer)
            db.session.commit()

        # Get total keyword count
        total_keywords = Keyword.query.count()
        if total_keywords == 0:
            # No keywords available, return a fallback
            return "FALLBACK"

        # Get the keyword at current index (using 1-based indexing for SQL)
        current_keyword = Keyword.query.offset(pointer.current_index).first()
        
        if not current_keyword:
            # Reset to beginning if we've gone past the end
            pointer.current_index = 0
            db.session.commit()
            current_keyword = Keyword.query.first()

        # Update pointer for next time (circular buffer)
        next_index = (pointer.current_index + 1) % total_keywords
        pointer.current_index = next_index
        db.session.commit()

        return current_keyword.word if current_keyword else "FALLBACK"

    @staticmethod
    def populate_keywords():
        """Populate the keywords table with initial words"""
        # Check if keywords already exist
        if Keyword.query.count() > 0:
            return {"message": "Keywords already populated", "count": Keyword.query.count()}

        # Sample keywords - mix of animals, colors, objects, adjectives
        sample_keywords = [
            "ELEPHANT", "TIGER", "DOLPHIN", "PENGUIN", "GIRAFFE", "KANGAROO", "BUTTERFLY", "OCTOPUS",
            "CRIMSON", "AZURE", "GOLDEN", "VIOLET", "EMERALD", "SCARLET", "TURQUOISE", "AMBER",
            "TELESCOPE", "PIANO", "COMPASS", "LIGHTHOUSE", "MOUNTAIN", "RAINBOW", "THUNDER", "CRYSTAL",
            "BRAVE", "CLEVER", "SWIFT", "BRIGHT", "GENTLE", "FIERCE", "CALM", "VIVID",
            "ADVENTURE", "DISCOVERY", "HARMONY", "MYSTERY", "JOURNEY", "WONDER", "COURAGE", "WISDOM",
            "PHOENIX", "DRAGON", "UNICORN", "GRIFFIN", "PEGASUS", "SPHINX", "KRAKEN", "CHIMERA",
            "GALAXY", "COMET", "NEBULA", "STELLAR", "COSMIC", "METEOR", "ORBIT", "QUASAR",
            "FOREST", "DESERT", "TUNDRA", "SAVANNA", "JUNGLE", "PRAIRIE", "MARSH", "CANYON",
            "ORCHESTRA", "SYMPHONY", "MELODY", "RHYTHM", "HARMONY", "TEMPO", "CHORD", "CRESCENDO",
            "PRISM", "VORTEX", "ZENITH", "APEX", "NEXUS", "VERTEX", "MATRIX", "HELIX"
        ]

        # Add keywords to database (skip if already exists)
        added_count = 0
        for word in sample_keywords:
            if not Keyword.query.filter_by(word=word).first():
                keyword = Keyword(word=word)
                db.session.add(keyword)
                added_count += 1

        db.session.commit()
        
        return {"message": "Keywords populated successfully", "count": added_count, "total": Keyword.query.count()}

    @staticmethod
    def get_keyword_stats():
        """Get statistics about keyword usage"""
        pointer = KeywordPointer.query.first()
        total_keywords = Keyword.query.count()
        
        return {
            "total_keywords": total_keywords,
            "current_index": pointer.current_index if pointer else 0,
            "next_keyword_preview": KeywordService._peek_next_keyword()
        }

    @staticmethod
    def _peek_next_keyword():
        """Peek at the next keyword without advancing the pointer"""
        pointer = KeywordPointer.query.first()
        if not pointer:
            return None
            
        total_keywords = Keyword.query.count()
        if total_keywords == 0:
            return None
            
        next_keyword = Keyword.query.offset(pointer.current_index).first()
        return next_keyword.word if next_keyword else None
