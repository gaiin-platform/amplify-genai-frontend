import React, { useState } from 'react';
import { IconInfoCircle, IconBolt, IconSchema } from '@tabler/icons-react';
import { registerPythonFunction } from '@/services/softwareEngineerService';

interface InferSchemaButtonProps {
  code: string;
  functionName?: string;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

const InferSchemaButton: React.FC<InferSchemaButtonProps> = ({
                                                               code,
                                                               functionName = 'inferred_function',
                                                               onComplete,
                                                               onError
                                                             }) => {
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await registerPythonFunction(functionName, code);
      onComplete?.(result);
      console.log('Schema inference completed:', result);
    } catch (error) {
      onError?.(error);
      console.error('Schema inference failed:', error);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <button
      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      onClick={handleTest}
      title="Infer Schema"
      disabled={isTesting}
    >
      {isTesting ? (
        <div className="animate-spin">
          <IconSchema size={24} />
        </div>
      ) : (
        <IconSchema size={24} />
      )}
    </button>
  );
};

export default InferSchemaButton;