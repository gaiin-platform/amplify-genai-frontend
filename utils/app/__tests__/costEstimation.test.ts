/**
 * Cost Estimation Tests
 *
 * Examples and test cases to verify cost calculation logic
 */

import {
    estimateMessageTokens,
    getDataSourceTokens,
    willBeRagged,
    estimateDocumentTokens,
    getAllDataSources,
    calculatePromptCost,
    calculatePromptCostDetailed,
    formatCost
} from '../costEstimation';
import { Message, DataSource, Conversation } from '@/types/chat';
import { Model } from '@/types/model';

// Mock data for testing
const mockModel: Model = {
    id: 'gpt-4',
    name: 'GPT-4',
    inputTokenCost: 30, // $30 per 1M tokens
    outputTokenCost: 60,
    inputContextWindow: 128000,
    outputTokenLimit: 4096,
    provider: 'OpenAI',
    description: 'GPT-4 model',
    supportsImages: true,
    supportsReasoning: false,
    supportsSystemPrompts: true,
    systemPrompt: '',
    isAvailable: true,
    isBuiltIn: true
} as Model;

const mockMessages: Message[] = [
    {
        role: 'user',
        content: 'Hello, can you help me analyze this document?', // ~10 tokens
        id: '1',
        type: 'prompt',
        data: {}
    },
    {
        role: 'assistant',
        content: 'Of course! I can help you analyze the document. What would you like to know?', // ~16 tokens
        id: '2',
        type: undefined,
        data: {}
    },
    {
        role: 'user',
        content: 'What are the main points?', // ~5 tokens
        id: '3',
        type: 'prompt',
        data: {}
    }
];

const mockDocument: DataSource = {
    id: 'doc-123',
    type: 'document',
    name: 'Research Paper.pdf',
    metadata: {
        totalTokens: 50000
    }
};

const mockImage: DataSource = {
    id: 'img-456',
    type: 'image',
    name: 'chart.png',
    metadata: {
        totalTokens: {
            gpt: 1500,
            claude: 1200
        }
    }
};

const mockRagOnlyDoc: DataSource = {
    id: 'doc-789',
    type: 'document',
    name: 'Reference.pdf',
    metadata: {
        totalTokens: 30000,
        ragOnly: true
    }
};

describe('Cost Estimation Tests', () => {
    describe('estimateMessageTokens', () => {
        it('should estimate tokens for messages', () => {
            const tokens = estimateMessageTokens(mockMessages);
            // "Hello, can you help me analyze this document?" = ~50 chars / 4 = ~13 tokens
            // "Of course! I can help you analyze the document. What would you like to know?" = ~80 chars / 4 = ~20 tokens
            // "What are the main points?" = ~28 chars / 4 = ~7 tokens
            // Total: ~40 tokens
            expect(tokens).toBeGreaterThan(30);
            expect(tokens).toBeLessThan(50);
            console.log('✅ Message tokens:', tokens);
        });
    });

    describe('getDataSourceTokens', () => {
        it('should get tokens from regular document', () => {
            const tokens = getDataSourceTokens(mockDocument);
            expect(tokens).toBe(50000);
            console.log('✅ Document tokens:', tokens);
        });

        it('should get tokens from image (GPT model)', () => {
            const tokens = getDataSourceTokens(mockImage, 'gpt-4');
            expect(tokens).toBe(1500);
            console.log('✅ Image tokens (GPT):', tokens);
        });

        it('should get tokens from image (Claude model)', () => {
            const tokens = getDataSourceTokens(mockImage, 'claude-3-sonnet');
            expect(tokens).toBe(1200);
            console.log('✅ Image tokens (Claude):', tokens);
        });

        it('should return 0 for missing metadata', () => {
            const emptyDoc: DataSource = { id: 'test', type: 'document' };
            const tokens = getDataSourceTokens(emptyDoc);
            expect(tokens).toBe(0);
            console.log('✅ Missing metadata returns 0');
        });
    });

    describe('willBeRagged', () => {
        it('should RAG conversation documents', () => {
            const result = willBeRagged(mockDocument, true);
            expect(result).toBe(true);
            console.log('✅ Conversation docs are RAG\'d');
        });

        it('should not RAG attached documents by default', () => {
            const result = willBeRagged(mockDocument, false);
            expect(result).toBe(false);
            console.log('✅ Attached docs are not RAG\'d by default');
        });

        it('should RAG documents with ragOnly flag', () => {
            const result = willBeRagged(mockRagOnlyDoc, false);
            expect(result).toBe(true);
            console.log('✅ Documents with ragOnly flag are RAG\'d');
        });

        it('should not RAG when skipRag is true', () => {
            const result = willBeRagged(mockDocument, true, { skipRag: true });
            expect(result).toBe(false);
            console.log('✅ skipRag disables all RAG');
        });

        it('should RAG everything when ragOnly option is true', () => {
            const result = willBeRagged(mockDocument, false, { ragOnly: true });
            expect(result).toBe(true);
            console.log('✅ ragOnly option forces all to RAG');
        });
    });

    describe('estimateDocumentTokens', () => {
        it('should count full tokens for attached documents', () => {
            const tokens = estimateDocumentTokens([mockDocument], false, 'gpt-4');
            expect(tokens).toBe(50000);
            console.log('✅ Attached doc full tokens:', tokens);
        });

        it('should apply RAG reduction to conversation documents', () => {
            const tokens = estimateDocumentTokens([mockDocument], true, 'gpt-4');
            // 50000 * 0.15 = 7500
            expect(tokens).toBe(7500);
            console.log('✅ Conversation doc RAG\'d tokens:', tokens);
        });

        it('should handle multiple documents', () => {
            const tokens = estimateDocumentTokens(
                [mockDocument, mockRagOnlyDoc],
                false,
                'gpt-4'
            );
            // mockDocument: 50000 (full)
            // mockRagOnlyDoc: 30000 * 0.15 = 4500 (RAG'd)
            // Total: 54500
            expect(tokens).toBe(54500);
            console.log('✅ Multiple docs tokens:', tokens);
        });
    });

    describe('getAllDataSources', () => {
        it('should extract attached and conversation data sources', () => {
            const conversation: Conversation = {
                id: 'conv-1',
                name: 'Test Conversation',
                messages: [
                    {
                        ...mockMessages[0],
                        data: { dataSources: [mockDocument] }
                    },
                    {
                        ...mockMessages[1],
                        data: {}
                    },
                    {
                        ...mockMessages[2],
                        data: { dataSources: [mockImage] }
                    }
                ],
                model: mockModel,
                folderId: null
            };

            const { attached, conversation: conversationDocs } = getAllDataSources(conversation);

            expect(attached).toHaveLength(1);
            expect(attached[0].id).toBe('img-456');
            expect(conversationDocs).toHaveLength(1);
            expect(conversationDocs[0].id).toBe('doc-123');

            console.log('✅ Extracted attached docs:', attached.length);
            console.log('✅ Extracted conversation docs:', conversationDocs.length);
        });
    });

    describe('calculatePromptCost', () => {
        it('should calculate cost for simple conversation', () => {
            const conversation: Conversation = {
                id: 'conv-1',
                name: 'Simple Chat',
                messages: mockMessages,
                model: mockModel,
                folderId: null
            };

            const cost = calculatePromptCost(conversation, mockModel);

            // ~40 message tokens
            // Cost: (40 / 1,000,000) * $30 = $0.0012
            expect(cost).toBeGreaterThan(0);
            expect(cost).toBeLessThan(0.01);

            console.log('✅ Simple conversation cost:', `$${cost.toFixed(4)}`);
        });

        it('should calculate cost with attached document', () => {
            const conversation: Conversation = {
                id: 'conv-1',
                name: 'Chat with Doc',
                messages: [
                    ...mockMessages,
                    {
                        role: 'user',
                        content: 'Analyze this',
                        id: '4',
                        type: 'prompt',
                        data: { dataSources: [mockDocument] }
                    }
                ],
                model: mockModel,
                folderId: null
            };

            const cost = calculatePromptCost(conversation, mockModel);

            // ~45 message tokens + 50,000 doc tokens (full insert)
            // Total: ~50,045 tokens
            // Cost: (50,045 / 1,000,000) * $30 = ~$1.50
            expect(cost).toBeGreaterThan(1.0);
            expect(cost).toBeLessThan(2.0);

            console.log('✅ Cost with attached doc:', `$${cost.toFixed(2)}`);
        });

        it('should calculate cost with conversation document (RAG\'d)', () => {
            const conversation: Conversation = {
                id: 'conv-1',
                name: 'Chat with History',
                messages: [
                    {
                        role: 'user',
                        content: 'Here is a document',
                        id: '1',
                        type: 'prompt',
                        data: { dataSources: [mockDocument] }
                    },
                    {
                        role: 'assistant',
                        content: 'I have reviewed it',
                        id: '2',
                        type: undefined,
                        data: {}
                    },
                    {
                        role: 'user',
                        content: 'What does it say?',
                        id: '3',
                        type: 'prompt',
                        data: {}
                    }
                ],
                model: mockModel,
                folderId: null
            };

            const cost = calculatePromptCost(conversation, mockModel);

            // ~30 message tokens + (50,000 * 0.15 = 7,500) RAG'd doc tokens
            // Total: ~7,530 tokens
            // Cost: (7,530 / 1,000,000) * $30 = ~$0.23
            expect(cost).toBeGreaterThan(0.15);
            expect(cost).toBeLessThan(0.35);

            console.log('✅ Cost with conversation doc (RAG\'d):', `$${cost.toFixed(2)}`);
        });
    });

    describe('calculatePromptCostDetailed', () => {
        it('should provide detailed breakdown', () => {
            const conversation: Conversation = {
                id: 'conv-1',
                name: 'Test',
                messages: [
                    {
                        role: 'user',
                        content: 'Test message with document',
                        id: '1',
                        type: 'prompt',
                        data: { dataSources: [mockDocument] }
                    },
                    {
                        role: 'user',
                        content: 'Follow up question',
                        id: '2',
                        type: 'prompt',
                        data: {}
                    }
                ],
                model: mockModel,
                folderId: null
            };

            const result = calculatePromptCostDetailed(conversation, mockModel);

            console.log('✅ Detailed breakdown:');
            console.log('  - Message tokens:', result.breakdown.messageTokens);
            console.log('  - Attached doc tokens:', result.breakdown.attachedDocTokens);
            console.log('  - Conversation doc tokens:', result.breakdown.conversationDocTokens);
            console.log('  - Total tokens:', result.breakdown.totalTokens);
            console.log('  - Cost:', `$${result.cost.toFixed(4)}`);

            expect(result.breakdown.totalTokens).toBeGreaterThan(0);
            expect(result.cost).toBeGreaterThan(0);
        });
    });

    describe('formatCost', () => {
        it('should format costs correctly', () => {
            expect(formatCost(0.001)).toBe('<$0.01');
            expect(formatCost(0.05)).toBe('$0.05');
            expect(formatCost(1.234)).toBe('$1.23');
            expect(formatCost(10.999)).toBe('$11.00');

            console.log('✅ Cost formatting works');
        });
    });
});

// Manual test runner (if not using Jest)
export function runManualTests() {
    console.log('🧪 Running Cost Estimation Tests\n');

    // Test 1: Simple message tokens
    console.log('Test 1: Message Token Estimation');
    const msgTokens = estimateMessageTokens(mockMessages);
    console.log(`  Result: ${msgTokens} tokens\n`);

    // Test 2: Document tokens
    console.log('Test 2: Document Token Extraction');
    console.log(`  Regular doc: ${getDataSourceTokens(mockDocument)} tokens`);
    console.log(`  Image (GPT): ${getDataSourceTokens(mockImage, 'gpt-4')} tokens\n`);

    // Test 3: RAG detection
    console.log('Test 3: RAG Detection');
    console.log(`  Conversation doc: ${willBeRagged(mockDocument, true)}`);
    console.log(`  Attached doc: ${willBeRagged(mockDocument, false)}`);
    console.log(`  RAG-only doc: ${willBeRagged(mockRagOnlyDoc, false)}\n`);

    // Test 4: Full cost calculation
    console.log('Test 4: Full Cost Calculation');
    const testConversation: Conversation = {
        id: 'test',
        name: 'Test',
        messages: [
            {
                role: 'user',
                content: 'Analyze this document please',
                id: '1',
                type: 'prompt',
                data: { dataSources: [mockDocument] }
            },
            {
                role: 'assistant',
                content: 'I will analyze it',
                id: '2',
                type: undefined,
                data: {}
            },
            {
                role: 'user',
                content: 'What are the key points?',
                id: '3',
                type: 'prompt',
                data: {}
            }
        ],
        model: mockModel,
        folderId: null
    };

    const detailed = calculatePromptCostDetailed(testConversation, mockModel);
    console.log('  Breakdown:');
    console.log(`    Messages: ${detailed.breakdown.messageTokens} tokens`);
    console.log(`    Conversation docs: ${detailed.breakdown.conversationDocTokens} tokens`);
    console.log(`    Total: ${detailed.breakdown.totalTokens} tokens`);
    console.log(`    Cost: ${formatCost(detailed.cost)}\n`);

    console.log('✅ All tests complete!');
}
