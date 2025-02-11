import React, { useState } from 'react';
import { IconInfoCircle, IconBolt } from '@tabler/icons-react';

const TestButton = () => {
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      // Simulated async operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Add your actual test logic here
      console.log('Test completed');
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <button
      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      onClick={handleTest}
      title="Test Artifact"
      disabled={isTesting}
    >
      {isTesting ? (
        <div className="animate-spin">
          <IconBolt size={24} />
        </div>
      ) : (
        <IconBolt size={24} />
      )}
    </button>
  );
};

export default TestButton;