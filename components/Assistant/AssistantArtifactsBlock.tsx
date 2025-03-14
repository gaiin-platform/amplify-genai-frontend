import React, { useState } from 'react';
import { IconLibrary, IconX } from "@tabler/icons-react";
import { Artifact, ArtifactBlockDetail } from "@/types/artifacts";
import DOMPurify from "dompurify";

interface AssistantArtifactsBlockProps {
  artifacts: ArtifactBlockDetail[];
  onOpenArtifact: (artifact: ArtifactBlockDetail) => void;
  onRemoveArtifact?: (artifact: ArtifactBlockDetail) => void;
  isProcessing: boolean;
}

const AssistantArtifactsBlock: React.FC<AssistantArtifactsBlockProps> = ({
  artifacts,
  onOpenArtifact,
  onRemoveArtifact,
  isProcessing
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

  if (!artifacts || artifacts.length === 0 || isProcessing) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {artifacts.map((artifact, i) => (
        <button
          key={`${artifact.artifactId}-${i}`}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(-1)}
          onClick={() => onOpenArtifact(artifact)}
          title={DOMPurify.sanitize(artifact.description || '')}
          disabled={isProcessing}
          className="bg-yellow-400 dark:bg-[#B0BEC5] rounded-xl shadow-lg h-12 my-1.5"
        >
          <div className="flex flex-row text-black">
            <div
              className="w-14 h-12 flex-none bg-cover rounded-l-xl text-center overflow-hidden"
              style={{ backgroundImage: 'url("/sparc_apple.png")' }}
              title={artifact.name}
            >
            </div>
            <div className="ml-5 mt-3">
              <IconLibrary />
            </div>
            <div className="mt-3 ml-3 text-[15px] text-start truncate max-w-[300px]">
              {artifact.name}
            </div>
            {artifact.version && (
              <div className="mt-3 ml-2 text-[15px] text-gray-500 truncate">
                - Version {artifact.version}
              </div>
            )}
            {hoveredIndex === i && (
              <>
                <div className="mt-3 mr-2 ml-auto text-[14px] whitespace-nowrap">
                  {artifact.createdAt}
                </div>
                {onRemoveArtifact && (
                  <div
                    className="mr-4 mt-3.5 text-gray-500 hover:text-neutral-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveArtifact(artifact);
                    }}
                    title="Remove Artifact from Conversation"
                  >
                    <IconX size={18} />
                  </div>
                )}
              </>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

export default AssistantArtifactsBlock; 