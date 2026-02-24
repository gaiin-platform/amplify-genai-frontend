/**
 * Types for structured question widget system
 * These types define the schema for AI-generated questions and user answers
 */

export enum QuestionType {
  SINGLE_SELECT = 'single_select',
  MULTI_SELECT = 'multi_select',
  RANK_PRIORITIES = 'rank_priorities',
  FREE_TEXT = 'free_text',
}

export interface Question {
  id: string;
  prompt: string;
  type: QuestionType;
  options?: string[];
  allow_custom?: boolean;
  required?: boolean;
  placeholder?: string; // For free_text type
}

export interface QuestionSet {
  questions: Question[];
}

export interface QuestionAnswer {
  questionId: string;
  answer: string | string[]; // Single value for single_select/free_text, array for multi_select/rank_priorities
  customValue?: string; // If allow_custom is true and user provided custom input
}

export interface QuestionWidgetState {
  currentQuestionIndex: number;
  answers: Map<string, QuestionAnswer>;
  isSubmitted: boolean;
}
