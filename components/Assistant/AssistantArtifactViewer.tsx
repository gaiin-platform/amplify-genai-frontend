import React, { useEffect, useState } from 'react';
import { Artifact } from '@/types/artifacts';
import { MemoizedReactMarkdown } from '@/components/Markdown/MemoizedReactMarkdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { CodeBlock } from '@/components/Markdown/CodeBlock';
import { assistantArtifactsService } from '@/services/assistantArtifactsService';
import { IconDownload, IconX } from '@tabler/icons-react';
import { CodeBlockDetails, extractCodeBlocksAndText } from '@/utils/app/codeblock';
import { ArtifactPreview } from '../Artifacts/ArtifactPreview';
import { ArtifactEditor } from '../Artifacts/ArtifactEditor';

interface AssistantArtifactViewerProps {
  artifact?: Artifact;
  isOpen: boolean;
  onClose: () => void;
}

const AssistantArtifactViewer: React.FC<AssistantArtifactViewerProps> = ({
  artifact,
  isOpen,
  onClose
}) => {
  const [content, setContent] = useState<string>('');
  const [codeBlocks, setCodeBlocks] = useState<CodeBlockDetails[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [viewHeight, setViewHeight] = useState<number>(500);

  useEffect(() => {
    if (artifact) {
      const artifactContent = assistantArtifactsService.getArtifactContents(artifact);
      setContent(artifactContent);
      setCodeBlocks(extractCodeBlocksAndText(artifactContent));
    }
  }, [artifact]);

  useEffect(() => {
    // Adjust height based on window size
    const updateHeight = () => {
      setViewHeight(window.innerHeight * 0.7);
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleDownload = () => {
    if (!artifact) return;
    
    // Determine file extension based on artifact type
    let fileExtension = '.txt';
    if (artifact.type) {
      switch(artifact.type.toLowerCase()) {
        case 'javascript':
        case 'js':
          fileExtension = '.js';
          break;
        case 'html':
          fileExtension = '.html';
          break;
        case 'css':
          fileExtension = '.css';
          break;
        case 'python':
        case 'py':
          fileExtension = '.py';
          break;
        case 'json':
          fileExtension = '.json';
          break;
        // Add more types as needed
      }
    }
    
    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.name}${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEditArtifact = (newContent: string) => {
    if (artifact) {
      setContent(newContent);
      setCodeBlocks(extractCodeBlocksAndText(newContent));
      // Note: This doesn't persist changes back to the artifact yet
      // That would require additional implementation to save versions
    }
  };

  if (!isOpen || !artifact) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {artifact.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Version {artifact.version} • Created {artifact.createdAt}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleDownload}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Download artifact"
            >
              <IconDownload size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Close"
            >
              <IconX size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isEditing ? (
            <ArtifactEditor
              handleEditArtifact={handleEditArtifact}
              setIsEditing={setIsEditing}
              isEditing={isEditing}
              artifactContent={content}
              blocks={codeBlocks}
              height={viewHeight}
            />
          ) : (
            <div>
              {codeBlocks.length > 0 ? (
                <ArtifactPreview
                  codeBlocks={codeBlocks}
                  artifactContent={content}
                  type={artifact.type || ''}
                  height={viewHeight}
                />
              ) : (
                <div className="prose dark:prose-invert max-w-none">
                  <MemoizedReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    components={{
                      code({node, inline, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline ? (
                          <CodeBlock
                            key={Math.random()}
                            language={(match && match[1]) || ''}
                            value={String(children).replace(/\n$/, '')}
                            {...props}
                          />
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {content}
                  </MemoizedReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with action buttons */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {isEditing ? 'Cancel Editing' : 'Edit Artifact'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantArtifactViewer; 