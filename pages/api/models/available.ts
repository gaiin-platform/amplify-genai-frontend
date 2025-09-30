import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions as any);

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Call the chat billing service to get models
    const apiGatewayUrl = process.env.API_GATEWAY_URL || 'https://api.hfu-amplify.org';
    
    // Get JWT token for API authentication
    const token = (session as any).accessToken || (session as any).access_token;
    
    if (!token) {
      console.error('[/api/models/available] No access token in session');
      // Return hardcoded models as fallback
      return res.status(200).json(getMockModels());
    }

    // Fetch models from the backend
    const response = await fetch(`${apiGatewayUrl}/chat-billing/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[/api/models/available] Backend error:', response.status, response.statusText);
      // Return hardcoded models as fallback
      return res.status(200).json(getMockModels());
    }

    const data = await response.json();
    
    // Transform the backend response to match frontend format
    const transformedData = {
      success: true,
      data: {
        models: data.models || data,
        default: data.default || data.models?.[0],
        cheapest: data.cheapest || data.models?.find((m: any) => m.id.includes('haiku')),
        advanced: data.advanced || data.models?.find((m: any) => m.id.includes('gpt-4'))
      }
    };

    return res.status(200).json(transformedData);
    
  } catch (error) {
    console.error('[/api/models/available] Error fetching models:', error);
    // Return hardcoded models as fallback
    return res.status(200).json(getMockModels());
  }
};

function getMockModels() {
  return {
    success: true,
    data: {
      models: [
        {
          id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          name: 'Claude 3.5 Sonnet',
          provider: 'bedrock',
          description: 'Most capable Claude model, best for complex tasks',
          inputCostPer1K: 0.003,
          outputCostPer1K: 0.015,
          inputContextWindow: 200000,
          supportsImages: true,
          supportsReasoning: false
        },
        {
          id: 'anthropic.claude-3-sonnet-20240229-v1:0',
          name: 'Claude 3 Sonnet',
          provider: 'bedrock',
          description: 'Balanced performance and cost',
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
          description: 'Fast and cost-effective',
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
          description: 'Mistral flagship model via Bedrock',
          inputCostPer1K: 0.004,
          outputCostPer1K: 0.012,
          inputContextWindow: 32000,
          supportsImages: false,
          supportsReasoning: false
        },
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          description: 'OpenAI\'s GPT-4 model',
          inputCostPer1K: 0.03,
          outputCostPer1K: 0.06,
          inputContextWindow: 8192,
          supportsImages: false,
          supportsReasoning: false
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          description: 'OpenAI\'s GPT-3.5 Turbo model',
          inputCostPer1K: 0.0005,
          outputCostPer1K: 0.0015,
          inputContextWindow: 16385,
          supportsImages: false,
          supportsReasoning: false
        },
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          provider: 'gemini',
          description: 'Google\'s Gemini 1.5 Pro model',
          inputCostPer1K: 0.00025,
          outputCostPer1K: 0.0005,
          inputContextWindow: 1048576,
          supportsImages: true,
          supportsReasoning: false
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          provider: 'gemini',
          description: 'Fast Gemini model for quick responses',
          inputCostPer1K: 0.000075,
          outputCostPer1K: 0.00015,
          inputContextWindow: 1048576,
          supportsImages: true,
          supportsReasoning: false
        }
      ],
      default: {
        id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        name: 'Claude 3.5 Sonnet',
        provider: 'bedrock'
      },
      cheapest: {
        id: 'anthropic.claude-3-haiku-20240307-v1:0',
        name: 'Claude 3 Haiku',
        provider: 'bedrock'
      },
      advanced: {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai'
      }
    }
  };
}

export default handler;