import React, { useState } from 'react';
import { IconTerminal2 } from '@tabler/icons-react';
import { createPythonFunction } from '@/services/softwareEngineerService';
import { lzwUncompress, lzwCompress } from "@/utils/app/lzwCompression";
import { Artifact } from "@/types/artifacts";

interface PythonLambdaButtonProps {
  artifact: Artifact;
  onComplete?: (updatedArtifact: Artifact) => void;
  onError?: (error: any) => void;
  disabled?: boolean;
}

const PythonLambdaButton: React.FC<PythonLambdaButtonProps> = ({
                                                                 artifact,
                                                                 onComplete,
                                                                 onError,
                                                                 disabled = false
                                                               }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCreateLambda = async () => {
    setIsProcessing(true);
    try {
      // Get the decompressed code from the artifact
      const code = lzwUncompress(artifact.contents);

      // Create function name from artifact name, ensuring it's camelCase
      const functionName = artifact.name
        .replace(/[^a-zA-Z0-9]/g, ' ')
        .split(' ')
        .map((word, index) =>
          index === 0
            ? word.toLowerCase()
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');

      // Call the Python function creation service
      const result = await createPythonFunction({
        functionName,
        functionDescription: artifact.description || 'Generated from artifact',
        notes: `Generated from artifact ${artifact.artifactId} version ${artifact.version}`
      });

      console.log('Lambda function created:', result.data.input_schema);

      // Update the artifact with the lambda function details
      const updatedArtifact: Artifact = {
        ...artifact,
        contents: lzwCompress("```python\n"+result.data.script+"\n\n```"),
        metadata: {
          ...artifact.metadata,
          lambdaFunction: result.data
        }
      };

      onComplete?.(updatedArtifact);
      console.log('Lambda function created:', result);
    } catch (error) {
      onError?.(error);
      console.error('Lambda function creation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button
      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      onClick={handleCreateLambda}
      title="Create Lambda Function"
      disabled={disabled || isProcessing}
    >
      <div className={isProcessing ? "animate-spin" : ""}>
        <IconTerminal2 size={24} />
      </div>
    </button>
  );
};

export default PythonLambdaButton;