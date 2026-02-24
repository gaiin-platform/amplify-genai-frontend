/**
 * Utility functions for parsing and handling structured questions
 */

import { QuestionSet, QuestionAnswer, Question } from '@/types/questions';

/**
 * Detects if a message contains a structured questions block
 * @param content The message content to check
 * @returns true if questions block is found
 */
export function hasQuestionsBlock(content: string): boolean {
  const regex = /<questions>([\s\S]*?)<\/questions>/i;
  return regex.test(content);
}

/**
 * Extracts and parses the questions block from message content
 * @param content The message content containing questions block
 * @returns Parsed QuestionSet object, or null if parsing fails
 */
export function parseQuestionsBlock(content: string): QuestionSet | null {
  try {
    const regex = /<questions>([\s\S]*?)<\/questions>/i;
    const match = content.match(regex);

    if (!match || !match[1]) {
      return null;
    }

    const jsonContent = match[1].trim();
    const parsed = JSON.parse(jsonContent);

    // Validate the parsed content has required structure
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error('Invalid questions structure: missing or invalid questions array');
      return null;
    }

    return parsed as QuestionSet;
  } catch (error) {
    console.error('Failed to parse questions block:', error);
    return null;
  }
}

/**
 * Strips the questions block from message content for display
 * @param content The message content containing questions block
 * @returns Content with questions block removed
 */
export function stripQuestionsBlock(content: string): string {
  const regex = /<questions>[\s\S]*?<\/questions>/i;
  return content.replace(regex, '').trim();
}

/**
 * Serializes user answers into a human-readable format for submission
 * @param questions The original questions
 * @param answers Map of question IDs to answers
 * @returns Formatted string ready to send as user message
 */
export function serializeAnswers(
  questions: Question[],
  answers: Map<string, QuestionAnswer>
): string {
  const lines: string[] = [];

  questions.forEach((question) => {
    const answer = answers.get(question.id);
    if (!answer) {
      return; // Skip unanswered optional questions
    }

    let answerText = '';

    if (Array.isArray(answer.answer)) {
      // Multi-select or rank priorities
      answerText = answer.answer.join(', ');
    } else {
      // Single select or free text
      answerText = answer.answer;
    }

    // Include custom value if provided
    if (answer.customValue) {
      answerText += ` (${answer.customValue})`;
    }

    lines.push(`${question.prompt} → ${answerText}`);
  });

  return lines.join('\n');
}

/**
 * Validates that all required questions have been answered
 * @param questions The questions to validate
 * @param answers Map of question IDs to answers
 * @returns Object with isValid flag and array of missing question IDs
 */
export function validateAnswers(
  questions: Question[],
  answers: Map<string, QuestionAnswer>
): { isValid: boolean; missingQuestions: string[] } {
  const missingQuestions: string[] = [];

  questions.forEach((question) => {
    if (question.required) {
      const answer = answers.get(question.id);
      if (!answer ||
          (Array.isArray(answer.answer) && answer.answer.length === 0) ||
          (!Array.isArray(answer.answer) && !answer.answer)) {
        missingQuestions.push(question.id);
      }
    }
  });

  return {
    isValid: missingQuestions.length === 0,
    missingQuestions,
  };
}
