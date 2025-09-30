# lambda_function.py - LLM Router Service
import json
import os
import boto3
import logging
from typing import Dict, Any, List
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger()
logger.setLevel(logging.INFO)

class LLMRouter:
    def __init__(self):
        self.bedrock_client = boto3.client('bedrock-runtime', region_name='us-east-1')
        self.providers = {
            'bedrock': self.call_bedrock,
            'openai': self.call_openai,
            'gemini': self.call_gemini
        }
    
    def route_request(self, provider: str, model: str, messages: List[Dict], **kwargs):
        """Route request to appropriate provider"""
        if provider not in self.providers:
            raise ValueError(f"Unknown provider: {provider}")
        
        return self.providers[provider](model, messages, **kwargs)
    
    def call_bedrock(self, model: str, messages: List[Dict], **kwargs):
        """Call AWS Bedrock"""
        try:
            # Convert messages to Bedrock format
            prompt = self._messages_to_bedrock_prompt(messages)
            
            response = self.bedrock_client.invoke_model(
                modelId=model,
                body=json.dumps({
                    "prompt": prompt,
                    "max_tokens": kwargs.get('max_tokens', 1000),
                    "temperature": kwargs.get('temperature', 0.7),
                    "stream": kwargs.get('stream', False)
                })
            )
            
            return json.loads(response['body'].read())
        except Exception as e:
            logger.error(f"Bedrock error: {str(e)}")
            raise
    
    def call_openai(self, model: str, messages: List[Dict], **kwargs):
        """Call OpenAI API"""
        # Implementation would go here
        return {"error": "OpenAI integration pending"}
    
    def call_gemini(self, model: str, messages: List[Dict], **kwargs):
        """Call Google Gemini API"""
        # Implementation would go here
        return {"error": "Gemini integration pending"}
    
    def _messages_to_bedrock_prompt(self, messages: List[Dict]) -> str:
        """Convert chat messages to Bedrock prompt format"""
        prompt = ""
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role == 'system':
                prompt += f"\n\nSystem: {content}"
            elif role == 'user':
                prompt += f"\n\nHuman: {content}"
            elif role == 'assistant':
                prompt += f"\n\nAssistant: {content}"
        
        prompt += "\n\nAssistant:"
        return prompt

def lambda_handler(event, context):
    """Main Lambda handler"""
    try:
        # Parse request body
        body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        
        # Extract parameters
        provider = body.get('provider', 'bedrock').lower()
        model = body.get('model', 'anthropic.claude-v2')
        messages = body.get('messages', [])
        stream = body.get('stream', False)
        
        # Initialize router
        router = LLMRouter()
        
        # Route the request
        response = router.route_request(
            provider=provider,
            model=model,
            messages=messages,
            temperature=body.get('temperature', 0.7),
            max_tokens=body.get('max_tokens', 1000),
            stream=stream
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            'body': json.dumps(response)
        }
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'message': 'Internal server error'
            })
        }
