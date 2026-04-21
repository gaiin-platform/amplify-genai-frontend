import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, Step, STATUS, EVENTS } from 'react-joyride';
import { IconX } from '@tabler/icons-react';

interface OnboardingTourProps {
  run?: boolean;
  onComplete?: () => void;
}

const tourSteps: Step[] = [
  {
    target: '#messageChatInputText',
    content: (
      <div>
        <h3 className="font-semibold mb-2">Welcome to Amplify! 👋</h3>
        <p>Start by typing your message here. You can ask questions, request help with tasks, or just have a conversation.</p>
      </div>
    ),
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '#modelSelect',
    content: (
      <div>
        <h3 className="font-semibold mb-2">Choose Your AI Model</h3>
        <p>Select from various AI models including Claude, GPT, and Gemini. Each has different capabilities and strengths.</p>
      </div>
    ),
    placement: 'bottom',
  },
  {
    target: '#promptButton',
    content: (
      <div>
        <h3 className="font-semibold mb-2">Save Prompts</h3>
        <p>Create and save reusable prompts for common tasks. This helps you work more efficiently.</p>
      </div>
    ),
    placement: 'right',
  },
  {
    target: '#addAssistantButton',
    content: (
      <div>
        <h3 className="font-semibold mb-2">AI Assistants</h3>
        <p>Create specialized assistants with custom instructions and capabilities for specific tasks.</p>
      </div>
    ),
    placement: 'left',
  },
  {
    target: '#advancedConversationSettings',
    content: (
      <div>
        <h3 className="font-semibold mb-2">Customize Your Experience</h3>
        <p>Access settings to personalize your experience, manage API keys, and configure integrations.</p>
      </div>
    ),
    placement: 'bottom',
  }
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ 
  run = false, 
  onComplete 
}) => {
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Check if user has seen the tour before
    const hasSeenTour = localStorage.getItem('amplify-onboarding-complete');
    if (!hasSeenTour && run) {
      // Small delay to ensure all elements are rendered
      setTimeout(() => setRunTour(true), 1000);
    }
  }, [run]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index } = data;
    
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      localStorage.setItem('amplify-onboarding-complete', 'true');
      setRunTour(false);
      onComplete?.();
    } else if (type === EVENTS.STEP_AFTER) {
      setStepIndex(index + 1);
    }
  };

  const customStyles = {
    options: {
      primaryColor: '#2563eb',
      textColor: '#1f2937',
      backgroundColor: '#ffffff',
      arrowColor: '#ffffff',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 10000,
    },
    buttonNext: {
      backgroundColor: '#2563eb',
      color: '#ffffff',
      borderRadius: '6px',
      padding: '8px 16px',
      fontSize: '14px',
    },
    buttonBack: {
      color: '#6b7280',
      marginRight: '8px',
    },
    buttonSkip: {
      color: '#6b7280',
    },
    tooltip: {
      borderRadius: '8px',
      padding: '16px',
    },
    tooltipContent: {
      textAlign: 'left' as const,
    },
    spotlight: {
      borderRadius: '8px',
    }
  };

  const locale = {
    back: 'Back',
    close: 'Close',
    last: 'Finish',
    next: 'Next',
    skip: 'Skip tour',
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      run={runTour}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={tourSteps}
      stepIndex={stepIndex}
      styles={customStyles}
      locale={locale}
      floaterProps={{
        styles: {
          floater: {
            filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
          }
        }
      }}
    />
  );
};

// Separate component for manual tour trigger
export const TourTrigger: React.FC = () => {
  const [showTour, setShowTour] = useState(false);

  const startTour = () => {
    localStorage.removeItem('amplify-onboarding-complete');
    setShowTour(true);
    // Force re-render to trigger tour
    setTimeout(() => window.location.reload(), 100);
  };

  return (
    <button
      onClick={startTour}
      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
    >
      Take a tour
    </button>
  );
};