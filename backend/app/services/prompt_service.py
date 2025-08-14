# convolute_app/app/services/prompt_service.py

import random
from ..models import Prompt, Tag, PromptTag, PromptPointer, Session
from ..extensions import db


class PromptService:
    
    @staticmethod
    def get_prompt_by_tags(tag_names):
        """
        Get a random prompt that has ALL the specified tags.
        If no prompt matches all tags, fallback to any prompt with any of the tags.
        """
        if not tag_names:
            # No tags specified, return any random prompt
            return PromptService._get_random_prompt()
        
        # Find prompts that have ALL the specified tags
        tag_ids = db.session.query(Tag.id).filter(Tag.tag.in_(tag_names)).all()
        tag_ids = [tag_id[0] for tag_id in tag_ids]
        
        if not tag_ids:
            # None of the requested tags exist, return any random prompt
            return PromptService._get_random_prompt()
        
        # Query for prompts that have all the specified tags
        prompt_ids = db.session.query(PromptTag.prompt_id)\
            .filter(PromptTag.tag_id.in_(tag_ids))\
            .group_by(PromptTag.prompt_id)\
            .having(db.func.count(PromptTag.tag_id) == len(tag_ids))\
            .all()
        
        if prompt_ids:
            # Found prompts with all tags
            prompt_ids = [p[0] for p in prompt_ids]
            random_id = random.choice(prompt_ids)
            return Prompt.query.get(random_id)
        
        # Fallback: get prompt with ANY of the tags
        prompt_ids = db.session.query(PromptTag.prompt_id)\
            .filter(PromptTag.tag_id.in_(tag_ids))\
            .distinct()\
            .all()
        
        if prompt_ids:
            prompt_ids = [p[0] for p in prompt_ids]
            random_id = random.choice(prompt_ids)
            return Prompt.query.get(random_id)
        
        # Final fallback: any random prompt
        return PromptService._get_random_prompt()
    
    @staticmethod
    def _get_random_prompt():
        """Get a completely random prompt from the database."""
        count = Prompt.query.count()
        if count == 0:
            return None
        
        random_offset = random.randint(0, count - 1)
        return Prompt.query.offset(random_offset).first()
    
    @staticmethod
    def get_prompt_for_filter_with_session(filter_name, session_keyword):
        """
        Get a prompt using circular buffer approach for the given session and filter.
        Ensures no repeats until all prompts for that filter are exhausted.
        """
        # Get session
        session = Session.query.filter_by(keyword=session_keyword).first()
        if not session:
            return "Share something interesting you learned recently."
        
        # Get or create prompt pointer for this session-tag combination
        pointer = PromptPointer.query.filter_by(
            session_id=session.id, 
            tag_filter=filter_name
        ).first()
        
        # Get all prompts for this filter (ordered consistently)
        prompts = PromptService._get_prompts_for_filter_ordered(filter_name)
        
        if not prompts:
            return "Share something interesting you learned recently."
        
        # Create pointer if it doesn't exist
        if not pointer:
            pointer = PromptPointer(
                session_id=session.id,
                tag_filter=filter_name,
                current_index=0
            )
            db.session.add(pointer)
        
        # Get the current prompt
        current_prompt = prompts[pointer.current_index % len(prompts)]
        
        # Advance the pointer for next time
        pointer.current_index = (pointer.current_index + 1) % len(prompts)
        
        db.session.commit()
        
        return current_prompt.prompt
    
    @staticmethod
    def _get_prompts_for_filter_ordered(filter_name):
        """
        Get all prompts for a filter in a consistent order.
        Returns a list of Prompt objects.
        """
        # Try to find prompts with the exact tag first
        tag_ids = db.session.query(Tag.id).filter(Tag.tag == filter_name).all()
        
        if tag_ids:
            tag_id = tag_ids[0][0]
            prompt_ids = db.session.query(PromptTag.prompt_id)\
                .filter(PromptTag.tag_id == tag_id)\
                .all()
            
            if prompt_ids:
                prompt_ids = [p[0] for p in prompt_ids]
                prompts = Prompt.query.filter(Prompt.id.in_(prompt_ids))\
                    .order_by(Prompt.id).all()  # Consistent ordering by ID
                return prompts
        
        # Fallback: try common related tags
        fallback_mappings = {
            'general': ['general', 'conversation', 'icebreaker'],
            'technical': ['technical', 'programming', 'problem-solving'],
            'personal': ['personal', 'reflection', 'goals'],
            'academic': ['academic', 'learning', 'study'],
            'creative': ['creative', 'innovation', 'brainstorming'],
            'teamwork': ['teamwork', 'collaboration', 'group']
        }
        
        if filter_name in fallback_mappings:
            tag_names = fallback_mappings[filter_name]
            tag_ids = db.session.query(Tag.id).filter(Tag.tag.in_(tag_names)).all()
            tag_ids = [tag_id[0] for tag_id in tag_ids]
            
            if tag_ids:
                prompt_ids = db.session.query(PromptTag.prompt_id)\
                    .filter(PromptTag.tag_id.in_(tag_ids))\
                    .distinct().all()
                
                if prompt_ids:
                    prompt_ids = [p[0] for p in prompt_ids]
                    prompts = Prompt.query.filter(Prompt.id.in_(prompt_ids))\
                        .order_by(Prompt.id).all()  # Consistent ordering by ID
                    return prompts
        
        return []
    
    @staticmethod
    def get_prompt_for_filter(filter_name):
        """
        Legacy method - falls back to random selection.
        Use get_prompt_for_filter_with_session for circular buffer behavior.
        """
        # Try to find prompts with the exact tag first
        prompt = PromptService.get_prompt_by_tags([filter_name])
        
        if prompt:
            return prompt.prompt
        
        # Fallback: if no prompt found with exact tag, try common related tags
        fallback_mappings = {
            'general': ['general', 'conversation', 'icebreaker'],
            'technical': ['technical', 'programming', 'problem-solving'],
            'personal': ['personal', 'reflection', 'goals'],
            'academic': ['academic', 'learning', 'study'],
            'creative': ['creative', 'innovation', 'brainstorming'],
            'teamwork': ['teamwork', 'collaboration', 'group']
        }
        
        # If we have a fallback mapping, try those tags
        if filter_name in fallback_mappings:
            prompt = PromptService.get_prompt_by_tags(fallback_mappings[filter_name])
            if prompt:
                return prompt.prompt
        
        # Final fallback
        return "Share something interesting you learned recently."
    
    @staticmethod
    def populate_sample_data():
        """Populate the database with sample prompts and tags."""
        
        # Sample tags
        sample_tags = [
            'general', 'technical', 'personal', 'academic',
            'conversation', 'programming', 'reflection', 'goals',
            'problem-solving', 'learning', 'study', 'icebreaker',
            'creative', 'teamwork'
        ]
        
        # Create tags if they don't exist
        for tag_name in sample_tags:
            existing_tag = Tag.query.filter_by(tag=tag_name).first()
            if not existing_tag:
                tag = Tag(tag=tag_name)
                db.session.add(tag)
        
        db.session.commit()
        
        # Sample prompts with their associated tags
        sample_prompts = [
            {
                'prompt': "What's the most interesting thing you learned this week?",
                'tags': ['general', 'conversation', 'learning']
            },
            {
                'prompt': "If you could solve any technical problem, what would it be and why?",
                'tags': ['technical', 'programming', 'problem-solving']
            },
            {
                'prompt': "Describe a personal goal you're working towards and what motivates you.",
                'tags': ['personal', 'reflection', 'goals']
            },
            {
                'prompt': "What study technique has been most effective for you recently?",
                'tags': ['academic', 'learning', 'study']
            },
            {
                'prompt': "Share a creative solution you came up with to solve a recent challenge.",
                'tags': ['creative', 'problem-solving', 'general']
            },
            {
                'prompt': "What's one programming concept you wish you understood better?",
                'tags': ['technical', 'programming', 'learning']
            },
            {
                'prompt': "If you could teach someone one thing, what would it be?",
                'tags': ['general', 'conversation', 'reflection']
            },
            {
                'prompt': "Describe a time when collaborating with others led to a better outcome.",
                'tags': ['teamwork', 'reflection', 'general']
            },
            {
                'prompt': "What's something you're curious about that you'd like to explore?",
                'tags': ['general', 'learning', 'goals']
            },
            {
                'prompt': "Share an icebreaker question you think everyone should know.",
                'tags': ['icebreaker', 'conversation', 'creative']
            }
        ]
        
        # Add prompts and their tags
        for prompt_data in sample_prompts:
            # Check if prompt already exists
            existing_prompt = Prompt.query.filter_by(prompt=prompt_data['prompt']).first()
            if existing_prompt:
                continue
            
            # Create the prompt
            new_prompt = Prompt(prompt=prompt_data['prompt'])
            db.session.add(new_prompt)
            db.session.flush()  # Get the ID without committing
            
            # Associate tags
            for tag_name in prompt_data['tags']:
                tag = Tag.query.filter_by(tag=tag_name).first()
                if tag:
                    prompt_tag = PromptTag(prompt_id=new_prompt.id, tag_id=tag.id)
                    db.session.add(prompt_tag)
        
        db.session.commit()
        return {"message": "Sample prompts and tags populated successfully"}
    
    @staticmethod
    def bulk_import_prompts(prompts_data):
        """
        Bulk import prompts from a list of dictionaries.
        Each dictionary should have 'prompt' and 'tags' keys.
        Returns import statistics.
        """
        if not isinstance(prompts_data, list):
            raise ValueError("prompts_data must be a list")
        
        stats = {
            'total': len(prompts_data),
            'imported': 0,
            'skipped': 0,
            'errors': []
        }
        
        # First, collect all unique tags
        all_tags = set()
        for item in prompts_data:
            if 'tags' in item and isinstance(item['tags'], list):
                all_tags.update(item['tags'])
        
        # Create missing tags
        for tag_name in all_tags:
            if tag_name:  # Skip empty tags
                existing_tag = Tag.query.filter_by(tag=tag_name).first()
                if not existing_tag:
                    tag = Tag(tag=tag_name)
                    db.session.add(tag)
        
        db.session.commit()
        
        # Import prompts
        for idx, prompt_data in enumerate(prompts_data):
            try:
                # Validate required fields
                if 'prompt' not in prompt_data or not prompt_data['prompt'].strip():
                    stats['errors'].append(f"Row {idx + 1}: Missing or empty prompt")
                    continue
                
                prompt_text = prompt_data['prompt'].strip()
                
                # Check if prompt already exists
                existing_prompt = Prompt.query.filter_by(prompt=prompt_text).first()
                if existing_prompt:
                    stats['skipped'] += 1
                    continue
                
                # Create the prompt
                new_prompt = Prompt(prompt=prompt_text)
                db.session.add(new_prompt)
                db.session.flush()  # Get the ID without committing
                
                # Associate tags
                tags = prompt_data.get('tags', [])
                if isinstance(tags, list):
                    for tag_name in tags:
                        if tag_name and tag_name.strip():  # Skip empty tags
                            tag = Tag.query.filter_by(tag=tag_name.strip()).first()
                            if tag:
                                prompt_tag = PromptTag(prompt_id=new_prompt.id, tag_id=tag.id)
                                db.session.add(prompt_tag)
                
                stats['imported'] += 1
                
            except Exception as e:
                stats['errors'].append(f"Row {idx + 1}: {str(e)}")
                db.session.rollback()
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            stats['errors'].append(f"Database commit error: {str(e)}")
        
        return stats
