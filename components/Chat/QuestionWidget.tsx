import React, { useState, useCallback } from 'react';
import { IconChevronLeft, IconChevronRight, IconCheck, IconGripVertical, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { Question, QuestionAnswer, QuestionType } from '@/types/questions';

interface QuestionWidgetProps {
  questions: Question[];
  onSubmit: (answers: Map<string, QuestionAnswer>) => void;
  onDismiss?: () => void;
}

const QuestionWidget: React.FC<QuestionWidgetProps> = ({ questions, onSubmit, onDismiss }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, QuestionAnswer>>(new Map());
  const [customValues, setCustomValues] = useState<Map<string, string>>(new Map());
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  const getAnswer = useCallback((questionId: string): QuestionAnswer | undefined => {
    return answers.get(questionId);
  }, [answers]);

  const updateAnswer = useCallback((questionId: string, answer: string | string[], customValue?: string) => {
    const newAnswers = new Map(answers);
    newAnswers.set(questionId, {
      questionId,
      answer,
      customValue,
    });
    setAnswers(newAnswers);

    // Clear validation error for this question
    const newErrors = new Set(validationErrors);
    newErrors.delete(questionId);
    setValidationErrors(newErrors);
  }, [answers, validationErrors]);

  const handleSingleSelect = (option: string) => {
    updateAnswer(currentQuestion.id, option);
  };

  const handleMultiSelect = (option: string) => {
    const currentAnswer = getAnswer(currentQuestion.id);
    const currentSelection = Array.isArray(currentAnswer?.answer) ? currentAnswer.answer : [];

    let newSelection: string[];
    if (currentSelection.includes(option)) {
      newSelection = currentSelection.filter(item => item !== option);
    } else {
      newSelection = [...currentSelection, option];
    }

    updateAnswer(currentQuestion.id, newSelection);
  };

  const handleFreeText = (text: string) => {
    updateAnswer(currentQuestion.id, text);
  };

  const handleCustomValue = (value: string) => {
    const newCustomValues = new Map(customValues);
    newCustomValues.set(currentQuestion.id, value);
    setCustomValues(newCustomValues);
    updateAnswer(currentQuestion.id, 'custom', value);
  };

  const handleRankMove = (index: number, direction: 'up' | 'down') => {
    const currentAnswer = getAnswer(currentQuestion.id);
    const items = Array.isArray(currentAnswer?.answer)
      ? [...currentAnswer.answer]
      : [...(currentQuestion.options || [])];

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    const [movedItem] = items.splice(index, 1);
    items.splice(newIndex, 0, movedItem);

    updateAnswer(currentQuestion.id, items);
  };

  const validateCurrentQuestion = (): boolean => {
    if (!currentQuestion.required) return true;

    const answer = getAnswer(currentQuestion.id);
    if (!answer) {
      const newErrors = new Set(validationErrors);
      newErrors.add(currentQuestion.id);
      setValidationErrors(newErrors);
      return false;
    }

    if (Array.isArray(answer.answer) && answer.answer.length === 0) {
      const newErrors = new Set(validationErrors);
      newErrors.add(currentQuestion.id);
      setValidationErrors(newErrors);
      return false;
    }

    if (!Array.isArray(answer.answer) && !answer.answer) {
      const newErrors = new Set(validationErrors);
      newErrors.add(currentQuestion.id);
      setValidationErrors(newErrors);
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateCurrentQuestion()) return;

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstQuestion) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (currentQuestion.required) return;

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleSubmit = () => {
    // Validate all required questions
    const errors = new Set<string>();
    questions.forEach(q => {
      if (q.required) {
        const answer = answers.get(q.id);
        if (!answer ||
            (Array.isArray(answer.answer) && answer.answer.length === 0) ||
            (!Array.isArray(answer.answer) && !answer.answer)) {
          errors.add(q.id);
        }
      }
    });

    if (errors.size > 0) {
      setValidationErrors(errors);
      // Jump to first question with error
      const firstErrorIndex = questions.findIndex(q => errors.has(q.id));
      if (firstErrorIndex !== -1) {
        setCurrentQuestionIndex(firstErrorIndex);
      }
      return;
    }

    onSubmit(answers);
  };

  const getQuestionTypeLabel = (type: QuestionType): string => {
    switch (type) {
      case QuestionType.SINGLE_SELECT:
        return 'Multiple Choice';
      case QuestionType.MULTI_SELECT:
        return 'Select All That Apply';
      case QuestionType.RANK_PRIORITIES:
        return 'Rank by Priority';
      case QuestionType.FREE_TEXT:
        return 'Short Answer';
      default:
        return '';
    }
  };

  const renderQuestion = () => {
    const currentAnswer = getAnswer(currentQuestion.id);
    const hasError = validationErrors.has(currentQuestion.id);

    switch (currentQuestion.type) {
      case QuestionType.SINGLE_SELECT:
        return (
          <div className="space-y-2">
            {currentQuestion.options?.map((option, index) => {
              const isSelected = currentAnswer?.answer === option;
              return (
                <button
                  key={index}
                  onClick={() => handleSingleSelect(option)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between
                    ${isSelected
                      ? 'bg-blue-500/20 border-blue-500 dark:bg-blue-500/30'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-500 dark:text-gray-400">
                      {index + 1}
                    </span>
                    <span>{option}</span>
                  </span>
                  {isSelected && <IconCheck size={20} className="text-blue-500" />}
                </button>
              );
            })}

            {currentQuestion.allow_custom && (
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Something else..."
                  value={customValues.get(currentQuestion.id) || ''}
                  onChange={(e) => handleCustomValue(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        );

      case QuestionType.MULTI_SELECT:
        const selectedOptions = Array.isArray(currentAnswer?.answer) ? currentAnswer.answer : [];
        return (
          <div className="space-y-2">
            {currentQuestion.options?.map((option, index) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <button
                  key={index}
                  onClick={() => handleMultiSelect(option)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between
                    ${isSelected
                      ? 'bg-blue-500/20 border-blue-500 dark:bg-blue-500/30'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span>{option}</span>
                  </span>
                </button>
              );
            })}

            {currentQuestion.allow_custom && (
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Something else..."
                  value={customValues.get(currentQuestion.id) || ''}
                  onChange={(e) => handleCustomValue(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        );

      case QuestionType.RANK_PRIORITIES:
        const rankedItems = Array.isArray(currentAnswer?.answer)
          ? currentAnswer.answer
          : currentQuestion.options || [];

        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Use the arrows to reorder items by priority
            </p>
            {rankedItems.map((item, index) => (
              <div
                key={item}
                className="px-4 py-3 rounded-lg border bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 flex items-center gap-3"
              >
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleRankMove(index, 'up')}
                    disabled={index === 0}
                    className={`p-1 rounded ${
                      index === 0
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <IconArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => handleRankMove(index, 'down')}
                    disabled={index === rankedItems.length - 1}
                    className={`p-1 rounded ${
                      index === rankedItems.length - 1
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <IconArrowDown size={16} />
                  </button>
                </div>
                <span className="font-semibold text-sm text-gray-500 dark:text-gray-400 w-6">
                  {index + 1}.
                </span>
                <span className="flex-1">{item}</span>
              </div>
            ))}
          </div>
        );

      case QuestionType.FREE_TEXT:
        return (
          <textarea
            value={(currentAnswer?.answer as string) || ''}
            onChange={(e) => handleFreeText(e.target.value)}
            placeholder={currentQuestion.placeholder || 'Enter your answer...'}
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-500 resize-none"
          />
        );

      default:
        return <div>Unsupported question type</div>;
    }
  };

  return (
    <div className="question-widget my-4 p-6 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
              {getQuestionTypeLabel(currentQuestion.type)}
            </span>
          </div>
          {currentQuestion.required && (
            <span className="text-xs text-red-500 dark:text-red-400">Required</span>
          )}
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question prompt */}
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        {currentQuestion.prompt}
      </h3>

      {/* Validation error */}
      {validationErrors.has(currentQuestion.id) && (
        <div className="mb-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">
            This question is required. Please provide an answer.
          </p>
        </div>
      )}

      {/* Question content */}
      <div className="mb-6">{renderQuestion()}</div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleBack}
          disabled={isFirstQuestion}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all
            ${isFirstQuestion
              ? 'opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-500'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
            }`}
        >
          <IconChevronLeft size={20} />
          Back
        </button>

        <div className="flex gap-3">
          {!currentQuestion.required && (
            <button
              onClick={handleSkip}
              className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all"
            >
              Skip
            </button>
          )}

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all"
          >
            {isLastQuestion ? 'Submit' : 'Next'}
            {!isLastQuestion && <IconChevronRight size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionWidget;
