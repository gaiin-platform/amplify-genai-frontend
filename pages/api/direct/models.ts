import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Return working models directly
  const models = {
    success: true,
    data: {
      models: [
        // Bedrock models
        {
          id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          name: 'Claude 3.5 Sonnet',
          provider: 'bedrock',
          description: 'Anthropic Claude 3.5 Sonnet - Most capable',
          inputCostPer1K: 0.003,
          outputCostPer1K: 0.015,
          inputContextWindow: 200000,
          supportsImages: true,
          supportsReasoning: true
        },
        {
          id: 'anthropic.claude-3-sonnet-20240229-v1:0',
          name: 'Claude 3 Sonnet',
          provider: 'bedrock',
          description: 'Anthropic Claude 3 Sonnet - Balanced performance',
          inputCostPer1K: 0.003,
          outputCostPer1K: 0.015,
          inputContextWindow: 200000,
          supportsImages: true,
          supportsReasoning: false
        },
        {
          id: 'anthropic.claude-3-haiku-20240307-v1:0',
          name: 'Claude 3 Haiku',
          provider: 'bedrock',
          description: 'Anthropic Claude 3 Haiku - Fast and efficient',
          inputCostPer1K: 0.00025,
          outputCostPer1K: 0.00125,
          inputContextWindow: 200000,
          supportsImages: true,
          supportsReasoning: false
        },
        {
          id: 'mistral.mistral-large-2402-v1:0',
          name: 'Mistral Large',
          provider: 'bedrock',
          description: 'Mistral Large via AWS Bedrock',
          inputCostPer1K: 0.004,
          outputCostPer1K: 0.012,
          inputContextWindow: 32000,
          supportsImages: false,
          supportsReasoning: false
        },
        // GPT models that work with the deployed llm-router
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          description: 'OpenAI GPT-3.5 Turbo - Fast and efficient',
          inputCostPer1K: 0.0005,
          outputCostPer1K: 0.0015,
          inputContextWindow: 16385,
          supportsImages: false,
          supportsReasoning: false
        },
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          description: 'OpenAI GPT-4 - Advanced reasoning',
          inputCostPer1K: 0.03,
          outputCostPer1K: 0.06,
          inputContextWindow: 8192,
          supportsImages: false,
          supportsReasoning: true
        },
        // Gemini models that work with the deployed llm-router
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          provider: 'gemini',
          description: 'Google Gemini 1.5 Flash - Fast multimodal',
          inputCostPer1K: 0.00035,
          outputCostPer1K: 0.0007,
          inputContextWindow: 1048576,
          supportsImages: true,
          supportsReasoning: false
        },
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          provider: 'gemini',
          description: 'Google Gemini 1.5 Pro - Advanced multimodal',
          inputCostPer1K: 0.00125,
          outputCostPer1K: 0.005,
          inputContextWindow: 2097152,
          supportsImages: true,
          supportsReasoning: true
        }
      ],
      default: {
        id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        name: 'Claude 3.5 Sonnet',
        provider: 'bedrock',
        description: 'Anthropic Claude 3.5 Sonnet - Most capable',
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
        inputContextWindow: 200000,
        supportsImages: true,
        supportsReasoning: true
      },
      cheapest: {
        id: 'anthropic.claude-3-haiku-20240307-v1:0',
        name: 'Claude 3 Haiku',
        provider: 'bedrock',
        description: 'Anthropic Claude 3 Haiku - Fast and efficient',
        inputCostPer1K: 0.00025,
        outputCostPer1K: 0.00125,
        inputContextWindow: 200000,
        supportsImages: true,
        supportsReasoning: false
      },
      advanced: {
        id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        name: 'Claude 3.5 Sonnet',
        provider: 'bedrock',
        description: 'Anthropic Claude 3.5 Sonnet - Most capable',
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
        inputContextWindow: 200000,
        supportsImages: true,
        supportsReasoning: true
      }
    }
  };
  
  res.status(200).json(models);
}