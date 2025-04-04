import { Memory } from '@/types/memory';

// Taxonomy structure for memory categorization
export const TAXONOMY_STRUCTURE = {
    "Identity": ["Role", "Department", "Area_of_Study", "Preferences"],
    "Projects": [
        "Name",
        "Type",
        "Status",
        "Timeline",
        "Requirements",
        "Resources",
        "Collaborators",
    ],
    "Academic_Content": [
        "Research",
        "Teaching_Materials",
        "Publications",
        "Presentations",
        "Data_Analysis",
        "Code",
        "Visual_Assets",
    ],
    "Relationships": ["Collaborators", "Advisors_Advisees", "Teams", "Committees"],
    "Time_Sensitive": ["Deadlines", "Meetings", "Events", "Academic_Calendar"],
    "Resources": ["Tools", "Datasets", "References", "Documentation", "Templates"],
    "Knowledge": [
        "Subject_Matter",
        "Methods",
        "Procedures",
        "Best_Practices",
        "Institutional_Policies",
    ],
};

/**
 * Builds a prompt for extracting facts from user input based on existing knowledge
 * @param userInput - The user's input text to analyze
 * @param existingMemories - The current set of memories to avoid duplication
 * @returns A formatted prompt for fact extraction
 */
export const buildExtractFactsPrompt = (userInput: string, existingMemories: Memory[] = []): string => {
    // Construct the existing knowledge base section for the prompt
    const existingKnowledgeBase = existingMemories.length > 0
        ? `Current Knowledge Base:\n${existingMemories.map((memory: Memory, index: number) =>
            `${index + 1}. ${memory.content} [${memory.taxonomy_path || 'Uncategorized'}]`
        ).join('\n')}`
        : "Current Knowledge Base: Empty";

    return `Given the following taxonomy structure and current state of knowledge, analyze the new text and extract novel facts that don't duplicate existing information. For each fact, determine its appropriate place in the taxonomy. Preserve any personal perspectives exactly as stated. Each fact must be:
- Written exactly as presented (keep "I", "my", "we" if present)
- Include specific details when present
- Free of opinions or interpretations

DO NOT include meta-facts about this conversation or about AI systems in general. ONLY extract facts that are explicitly stated in the input text.

Taxonomy Structure:
${JSON.stringify(TAXONOMY_STRUCTURE, null, 2)}

${existingKnowledgeBase}

For each extracted fact, provide both the fact and its classification in the following format:
FACT: [Extracted fact]
TAXONOMY: [Category]/[Subcategory]
REASONING: [Brief explanation of why this fact belongs in this category]

Only extract facts that add new information not already present in the current knowledge base. If a similar fact already exists in the knowledge base, do not extract it again.

Only extract facts from the following text and nowhere else:
${userInput}`;
};

/**
 * Helper to filter and get relevant memories
 * @param allMemories - All memories retrieved from the memory store
 * @returns Array of memories that are relevant to the current context
 */
export const getRelevantMemories = (allMemories: Memory[] = []): Memory[] => {
    return allMemories.filter((memory: Memory) => {
        if (memory.memory_type === 'user') {
            return true;
        }
        return false;
    });
};

/**
 * Creates a memory context string to include in prompts
 * @param relevantMemories - Memories relevant to the current conversation
 * @returns A string to be appended to the prompt for context
 */
export const buildMemoryContextPrompt = (relevantMemories: Memory[]): string => {
    return relevantMemories.length > 0
        ? `Consider these relevant past memories when responding: ${JSON.stringify(
            relevantMemories.map((memory: Memory) => memory.content)
        )}. Use this context to provide more personalized and contextually appropriate responses.`
        : '';
};