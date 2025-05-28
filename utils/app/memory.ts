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

    return `Given the following taxonomy structure and current state of knowledge, analyze the new text and extract only SIGNIFICANT facts that don't duplicate existing information. Each fact must be:
- Written exactly as presented (keep "I", "my", "we" if present)
- Focus on STABLE, PERSISTENT information about the person or their work context
- Be specific but comprehensive (consolidate related points into single facts when possible)

IMPORTANT RULES:
1. DO NOT extract facts from code snippets, syntax, or technical implementation details
2. DO NOT extract temporary states, actions, or short-term plans
3. DO NOT extract facts about specific dates or deadlines unless they represent major milestones
4. DO NOT extract facts that are overly specific to the current conversation context
5. DO NOT extract any statements about AI model training data, capabilities, or limitations
6. DO NOT extract any self-referential statements about being an AI or language model
7. PRIORITIZE information about:
   - Professional background, experience, and skills
   - Organizational role and relationships
   - Ongoing projects and responsibilities
   - Personal preferences and working styles
8. LIMIT to a MAXIMUM of 3 high-quality, significant facts per input
9. CONSOLIDATE related information into meaningful units

Taxonomy Structure:
${JSON.stringify(TAXONOMY_STRUCTURE, null, 2)}

${existingKnowledgeBase}

If there are NO relevant facts to extract (e.g., the input contains only questions, commands, or non-factual content), respond with:
NO_FACTS: [Brief explanation of why no facts were extracted]

Otherwise, for each extracted fact, provide the fact and its classification in the following format:
FACT: [Extracted fact]
TAXONOMY: [Category]/[Subcategory]
REASONING: [Brief explanation of why this fact is significant and belongs in this category]

Only extract facts that add substantial new information not already present in the current knowledge base. If a similar fact already exists, do not extract it again.

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