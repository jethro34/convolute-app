# convolute_app/app/services/prompt_service.py

import random
from ..models import Prompt, Tag, PromptTag
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
    def get_prompt_for_filter(filter_name):
        """
        Get a prompt based on the frontend filter selection.
        Maps frontend filters to tag names.
        """
        filter_tag_mapping = {
            'general': ['general', 'conversation'],
            'technical': ['technical', 'programming', 'problem-solving'],
            'personal': ['personal', 'reflection', 'goals'],
            'academic': ['academic', 'learning', 'study']
        }
        
        tags = filter_tag_mapping.get(filter_name, ['general'])
        prompt = PromptService.get_prompt_by_tags(tags)
        
        return prompt.prompt if prompt else "Share something interesting you learned recently."
    
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
