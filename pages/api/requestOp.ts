import { NextApiRequest, NextApiResponse } from "next";
import {getServerSession} from "next-auth/next";
import {authOptions} from "@/pages/api/auth/[...nextauth]";
import { transformPayload } from "@/utils/app/data";
import { getAuthToken } from "@/utils/auth/getAuthToken";

interface reqPayload {
    method: any, 
    headers: any,
    body?: any,
}

const requestOp =
    async (req: NextApiRequest, res: NextApiResponse) => {

        const session = await getServerSession(req, res, authOptions as any);

        if (!session) {
            // Unauthorized access, no session found
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Accessing itemData parameters from the request
        const reqData = req.body.data || {};

        const method = reqData.method || null;
        const payload = reqData.data ? transformPayload.decode(reqData.data) : null;

        const apiUrl = constructUrl(reqData);
        
        // Mock responses for different endpoints
        const getMockResponse = (url: string) => {
            if (url.includes('/available_models')) {
                return {
                    success: true,
                    data: {
                        models: [
                            {
                                id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
                                name: 'Claude 3.5 Sonnet',
                                provider: 'bedrock',
                                description: 'Most capable Claude model via AWS Bedrock',
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
                                description: 'Balanced Claude model via AWS Bedrock',
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
                                description: 'Fast Claude model via AWS Bedrock',
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
                            {
                                id: 'gpt-3.5-turbo',
                                name: 'GPT-3.5 Turbo',
                                provider: 'openai',
                                description: 'OpenAI\'s fast and efficient GPT-3.5 Turbo model',
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
                                description: 'OpenAI\'s most capable GPT-4 model',
                                inputCostPer1K: 0.03,
                                outputCostPer1K: 0.06,
                                inputContextWindow: 8192,
                                supportsImages: false,
                                supportsReasoning: true
                            },
                            {
                                id: 'gemini-1.5-flash',
                                name: 'Gemini 1.5 Flash',
                                provider: 'gemini',
                                description: 'Google\'s fast Gemini model',
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
                                description: 'Google\'s advanced Gemini model',
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
                            description: 'Most capable Claude model via AWS Bedrock',
                            inputCostPer1K: 0.003,
                            outputCostPer1K: 0.015,
                            inputContextWindow: 200000,
                            supportsImages: true,
                            supportsReasoning: false
                        },
                        cheapest: {
                            id: 'anthropic.claude-3-haiku-20240307-v1:0',
                            name: 'Claude 3 Haiku',
                            provider: 'bedrock',
                            description: 'Fast Claude model via AWS Bedrock',
                            inputCostPer1K: 0.00025,
                            outputCostPer1K: 0.00125,
                            inputContextWindow: 200000,
                            supportsImages: true,
                            supportsReasoning: false
                        },
                        advanced: {
                            id: 'gpt-4',
                            name: 'GPT-4',
                            provider: 'openai',
                            description: 'OpenAI\'s most capable GPT-4 model',
                            inputCostPer1K: 0.03,
                            outputCostPer1K: 0.06,
                            inputContextWindow: 8192,
                            supportsImages: false,
                            supportsReasoning: true
                        }
                    }
                };
            } else if (url.includes('/amplifymin/feature_flags')) {
                return {
                    success: true,
                    data: {
                        memory: true,
                        dataProviders: true,
                        advancedAssistants: true,
                        assistantSettings: true,
                        searchSettings: true,
                        promptWorkflows: true,
                        artifactsV2: true,
                        integrations: true,
                        agentTools: true,
                        artifacts: true,
                        agentic: true
                    }
                };
            } else {
                // Default empty success response for other endpoints
                return {
                    success: true,
                    data: {}
                };
            }
        };
        
        // Check if this is a call to the Lambda backend
        // Temporarily use mock responses until backend auth is fixed
        if (apiUrl.includes('qfgrhljoh0.execute-api.us-east-1.amazonaws.com') || 
            apiUrl.includes('1y2q5khrvc.execute-api.us-east-1.amazonaws.com') ||
            apiUrl.includes('hdviynn2m4.execute-api.us-east-1.amazonaws.com')) {
            console.log(`Using mock response for: ${apiUrl}`);
            const mockResponse = getMockResponse(apiUrl);
            const encodedResponse = transformPayload.encode(mockResponse);
            return res.status(200).json({ data: encodedResponse });
        }
        
        const accessToken = await getAuthToken(req, res);
        
        if (!accessToken) {
            console.error('No valid JWT access token found for request');
            return res.status(401).json({ error: 'No valid authentication token' });
        }

        let reqPayload: reqPayload = {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}` 
            },
        }

        if (payload) reqPayload.body = JSON.stringify( { data: payload });

        try {

            const response = await fetch(apiUrl, reqPayload);

            if (!response.ok) throw new Error(`Request to ${apiUrl} failed with status: ${response.status}`);

            const responseData = await response.json();
            const encodedResponse = transformPayload.encode(responseData);

            res.status(200).json({ data: encodedResponse });
        } catch (error) {
            console.error("Error in requestOp: ", error);
            res.status(500).json({ error: `Could not perform requestOp` });
        }
    };

export default requestOp;


const constructUrl = (data: any) => {  
    let apiUrl = data.url ?? (process.env.API_BASE_URL || "");

    const path: string = data.path || "";
    const op: string = data.op || "";

    apiUrl += path + op;

    const queryParams: { [key: string]: string } | undefined = data.queryParams;
  
    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryString = Object.keys(queryParams)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent( transformPayload.decode(queryParams[key]) )}`)
        .join('&');
      apiUrl += `?${queryString}`;
    }
    console.log(`--- API url Request to: ${apiUrl} ---`);
    return apiUrl;
  };