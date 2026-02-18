/**
 * Cost Estimation Utilities
 *
 * Estimates the cost of a prompt before sending it to the LLM.
 * Based on research findings from Part 3.
 */

import { Message, DataSource, Conversation } from '@/types/chat';
import { Model } from '@/types/model';

/**
 * RAG reduction factor - based on backend code analysis
 * When documents go through RAG, only ~15% of tokens are used
 */
const RAG_REDUCTION_FACTOR = 0.15;

/**
 * Rough token estimation: ~4 characters per token
 * This is an approximation. For more accuracy, use tiktoken library.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Estimates token count for message text content
 * Uses rough approximation of 4 characters per token
 *
 * @param messages - Array of conversation messages
 * @returns Estimated token count
 */
export function estimateMessageTokens(messages: Message[]): number {
    let totalTokens = 0;

    for (const message of messages) {
        if (message.content) {
            // Rough estimate: divide character count by 4
            totalTokens += Math.ceil(message.content.length / CHARS_PER_TOKEN);
        }
    }

    return totalTokens;
}

/**
 * Gets token count from a data source's metadata
 * Handles both regular documents and images (which have model-specific counts)
 *
 * @param dataSource - The data source to get tokens from
 * @param modelId - The model ID (for image token selection)
 * @returns Token count, or 0 if not available
 */
export function getDataSourceTokens(dataSource: DataSource, modelId?: string): number {
    if (!dataSource.metadata?.totalTokens) {
        return 0;
    }

    const tokens = dataSource.metadata.totalTokens;

    // Handle images - they have model-specific token counts
    if (dataSource.type === 'image' && typeof tokens === 'object') {
        // Check model type for appropriate token count
        if (modelId) {
            if (modelId.includes('gpt') || modelId.includes('openai')) {
                return tokens.gpt || 1000;
            } else if (modelId.includes('claude') || modelId.includes('anthropic')) {
                return tokens.claude || 1000;
            }
        }
        // Default to GPT count if model unknown
        return tokens.gpt || tokens.claude || 1000;
    }

    // Regular documents - single token count
    return typeof tokens === 'number' ? tokens : 0;
}

/**
 * Determines if a data source will go through RAG processing
 * Based on backend routing logic from Part 3 research
 *
 * @param dataSource - The data source to check
 * @param isConversationDoc - Is this from a past message?
 * @param options - Request options that affect routing
 * @returns true if document will be RAG'd
 */
export function willBeRagged(
    dataSource: DataSource,
    isConversationDoc: boolean,
    options?: {
        skipRag?: boolean;
        ragOnly?: boolean;
    }
): boolean {
    // If skipRag is true, nothing gets RAG'd
    if (options?.skipRag) {
        return false;
    }

    // If ragOnly is true, everything gets RAG'd
    if (options?.ragOnly) {
        return true;
    }

    // Conversation documents (past messages) always get RAG'd
    if (isConversationDoc) {
        return true;
    }

    // Check document-specific ragOnly flag
    return dataSource.metadata?.ragOnly || false;
}

/**
 * Estimates total tokens for a set of data sources
 * Applies RAG reduction factor where appropriate
 *
 * @param dataSources - Array of data sources
 * @param isConversationDocs - Are these from past messages?
 * @param modelId - The model ID (for image token selection)
 * @param options - Request options affecting routing
 * @returns Estimated total tokens
 */
export function estimateDocumentTokens(
    dataSources: DataSource[],
    isConversationDocs: boolean,
    modelId?: string,
    options?: {
        skipRag?: boolean;
        ragOnly?: boolean;
    }
): number {
    let totalTokens = 0;

    for (const dataSource of dataSources) {
        // Get base token count
        const baseTokens = getDataSourceTokens(dataSource, modelId);

        // Determine if RAG will be applied
        const isRagged = willBeRagged(dataSource, isConversationDocs, options);

        // Apply RAG reduction if applicable
        if (isRagged) {
            totalTokens += Math.ceil(baseTokens * RAG_REDUCTION_FACTOR);
        } else {
            totalTokens += baseTokens;
        }
    }

    return totalTokens;
}

/**
 * Extracts all data sources from conversation messages
 * Separates attached (current message) from conversation (past messages)
 *
 * @param conversation - The conversation object
 * @param includeLastMessage - Include last message's data sources as "attached"
 * @returns Object with attached and conversation data sources
 */
export function getAllDataSources(
    conversation: Conversation,
    includeLastMessage: boolean = true
): {
    attached: DataSource[];
    conversation: DataSource[];
} {
    const messages = conversation.messages || [];

    if (messages.length === 0) {
        return { attached: [], conversation: [] };
    }

    // Get attached data sources (from last message)
    const attached: DataSource[] = includeLastMessage && messages.length > 0
        ? messages[messages.length - 1].data?.dataSources || []
        : [];

    // Get conversation data sources (from all previous messages)
    const conversationDataSources: DataSource[] = [];
    const endIndex = includeLastMessage ? messages.length - 1 : messages.length;

    for (let i = 0; i < endIndex; i++) {
        const msgDataSources = messages[i].data?.dataSources || [];
        conversationDataSources.push(...msgDataSources);
    }

    // Remove duplicates by ID
    const uniqueConversation = Array.from(
        new Map(conversationDataSources.map((ds: DataSource) => [ds.id, ds])).values()
    );

    return {
        attached,
        conversation: uniqueConversation
    };
}

/**
 * Calculates the estimated cost of a prompt
 * Main function that combines all estimation logic
 *
 * @param conversation - The conversation object
 * @param model - The model being used
 * @param options - Request options affecting routing
 * @returns Estimated cost in dollars
 */
export function calculatePromptCost(
    conversation: Conversation,
    model: Model,
    options?: {
        skipRag?: boolean;
        ragOnly?: boolean;
        noDataSources?: boolean;
    }
): number {
    let totalTokens = 0;

    // 1. Count message tokens
    const messages = conversation.messages || [];
    totalTokens += estimateMessageTokens(messages);

    // 2. Handle data sources (if not disabled)
    if (!options?.noDataSources) {
        const { attached, conversation: conversationDocs } = getAllDataSources(conversation);

        // 3. Count attached document tokens
        totalTokens += estimateDocumentTokens(
            attached,
            false, // Not conversation docs
            model.id,
            options
        );

        // 4. Count conversation document tokens (always RAG'd)
        totalTokens += estimateDocumentTokens(
            conversationDocs,
            true, // These are conversation docs
            model.id,
            options
        );
    }

    // 5. Calculate cost
    // model.inputTokenCost is cost per 1 million tokens
    const cost = (totalTokens / 1_000_000) * model.inputTokenCost;

    return cost;
}

/**
 * Calculates cost and returns detailed breakdown for debugging/display
 *
 * @param conversation - The conversation object
 * @param model - The model being used
 * @param options - Request options affecting routing
 * @returns Object with cost and breakdown details
 */
export function calculatePromptCostDetailed(
    conversation: Conversation,
    model: Model,
    options?: {
        skipRag?: boolean;
        ragOnly?: boolean;
        noDataSources?: boolean;
    }
): {
    cost: number;
    breakdown: {
        messageTokens: number;
        attachedDocTokens: number;
        conversationDocTokens: number;
        totalTokens: number;
        pricePerMillionTokens: number;
    };
} {
    const messages = conversation.messages || [];
    const messageTokens = estimateMessageTokens(messages);

    let attachedDocTokens = 0;
    let conversationDocTokens = 0;

    if (!options?.noDataSources) {
        const { attached, conversation: conversationDocs } = getAllDataSources(conversation);

        attachedDocTokens = estimateDocumentTokens(
            attached,
            false,
            model.id,
            options
        );

        conversationDocTokens = estimateDocumentTokens(
            conversationDocs,
            true,
            model.id,
            options
        );
    }

    const totalTokens = messageTokens + attachedDocTokens + conversationDocTokens;
    const cost = (totalTokens / 1_000_000) * model.inputTokenCost;

    return {
        cost,
        breakdown: {
            messageTokens,
            attachedDocTokens,
            conversationDocTokens,
            totalTokens,
            pricePerMillionTokens: model.inputTokenCost
        }
    };
}

/**
 * Formats cost for display
 *
 * @param cost - Cost in dollars
 * @returns Formatted string (e.g., "$0.05" or "$5.00")
 */
export function formatCost(cost: number): string {
    if (cost < 0.01) {
        return '<$0.01';
    }
    return `$${cost.toFixed(2)}`;
}
