import React, { useState } from 'react';
import {
  IconPencil,
  IconDeviceFloppy,
  IconX,
  IconCode,
  IconFileDescription,
  IconSchema,
  IconArrowsExchange,
  IconBrandPython
} from '@tabler/icons-react';
import { Artifact } from "@/types/artifacts";
import { CodeBlock } from '@/components/Markdown/CodeBlock';

interface PythonMetadataDisplayProps {
  artifact: Artifact;
  onSchemaUpdate?: (newSchema: any) => Promise<void>;
  onError?: (error: any) => void;
}

const PythonMetadataDisplay: React.FC<PythonMetadataDisplayProps> = ({
                                                                       artifact,
                                                                       onSchemaUpdate,
                                                                       onError
                                                                     }) => {
  // Check if this is a Python artifact and has the required metadata
  //const isPythonArtifact = artifact.type === 'code' && artifact.type.toLowerCase().includes('python');
  const metadata = artifact.metadata?.lambdaFunction;

  if (!metadata) {
    return null;
  }

  const {
    name = artifact.name,
    description = artifact.description,
    input_schema: inputSchema,
    output_schema: outputSchema,
    params = []
  } = metadata;

  console.log("PythonMetadata:", metadata);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isEditing, setIsEditing] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [editedSchema, setEditedSchema] = useState(JSON.stringify(inputSchema || {}, null, 2));
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isProcessing, setIsProcessing] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const parsedSchema = JSON.parse(editedSchema);
      await onSchemaUpdate?.(parsedSchema);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON schema');
      onError?.(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
      {/* Function Name */}
      <div className="flex items-center space-x-3">
        <IconBrandPython className="text-blue-500" size={24} />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{name}</h2>
      </div>

      {/* Description */}
      {description && (
        <div className="flex items-start space-x-3">
          <IconFileDescription className="text-green-500 mt-1 flex-shrink-0" size={24} />
          <p className="text-gray-600 dark:text-gray-300 whitespace-normal break-words">{description}</p>
        </div>
      )}

      {/* Parameters */}
      {params.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <IconCode className="text-purple-500" size={20} />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Parameters</h3>
          </div>
          <div className="ml-7 space-y-2">
            {params.map((param: any, index: number) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                <span className="font-semibold text-blue-600 dark:text-blue-400">{param.name}</span>
                <p className="text-sm text-gray-600 dark:text-gray-300">{param.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Schema */}
      {inputSchema && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <IconSchema className="text-orange-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Input Schema</h3>
            </div>
            {!isEditing && onSchemaUpdate && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400"
                title="Edit Schema"
              >
                <IconPencil size={20} />
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editedSchema}
                onChange={(e) => setEditedSchema(e.target.value)}
                className="w-full h-48 p-3 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md"
                spellCheck={false}
              />
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                  <span className="block sm:inline">{error}</span>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setError(null);
                    setEditedSchema(JSON.stringify(inputSchema, null, 2));
                  }}
                  className="px-3 py-1 text-gray-600 hover:text-gray-700 dark:text-gray-400"
                  disabled={isProcessing}
                >
                  <IconX size={20} />
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1 text-green-600 hover:text-green-700 dark:text-green-400"
                  disabled={isProcessing}
                >
                  <div className={isProcessing ? "animate-spin" : ""}>
                    <IconDeviceFloppy size={20} />
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-x-auto">
              <CodeBlock language={'json'} value={JSON.stringify(inputSchema, null, 2)}/>
            </pre>
          )}
        </div>
      )}

      {/* Output Schema */}
      {outputSchema && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <IconArrowsExchange className="text-yellow-500" size={20} />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Output Schema</h3>
          </div>
          <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-x-auto">
            <CodeBlock language={'json'} value={JSON.stringify(outputSchema, null, 2)}/>
          </pre>
        </div>
      )}
    </div>
  );
};

export default PythonMetadataDisplay;