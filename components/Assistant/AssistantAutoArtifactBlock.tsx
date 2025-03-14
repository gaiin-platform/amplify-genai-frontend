import React, { useEffect, useState, useRef } from 'react';
import { IconHammer } from "@tabler/icons-react";
import { Artifact, ArtifactBlockDetail, ArtifactMessageStatus } from "@/types/artifacts";
import { assistantArtifactsService } from '@/services/assistantArtifactsService';
import { v4 as uuidv4 } from 'uuid';

interface AssistantAutoArtifactBlockProps {
  content: string;
  ready: boolean;
  onArtifactCreated?: (artifact: ArtifactBlockDetail) => void;
  setIsProcessing: (isProcessing: boolean) => void;
}

const AssistantAutoArtifactBlock: React.FC<AssistantAutoArtifactBlockProps> = ({
  content,
  ready,
  onArtifactCreated,
  setIsProcessing
}) => {
  const [status, setStatus] = useState<ArtifactMessageStatus>(ArtifactMessageStatus.RUNNING);
  const processedRef = useRef<boolean>(false);
  
  useEffect(() => {
    // Only run this once when ready changes to true
    if (ready && !processedRef.current) {
      processedRef.current = true;
      processArtifact(content);
    }
  }, [ready, content]);

  const processArtifact = async (jsonContent: string) => {
    setStatus(ArtifactMessageStatus.RUNNING);
    setIsProcessing(true);

    try {
      const data = JSON.parse(jsonContent);
      
      // Create a basic artifact detail
      const artifactDetail: ArtifactBlockDetail = {
        artifactId: data.id || `ast-artifact-${uuidv4()}`,
        name: data.name || 'Untitled Artifact',
        createdAt: new Date().toLocaleString(),
        description: data.description || '',
        version: 1
      };

      // Create a full artifact with compressed content
      const artifact = assistantArtifactsService.createArtifact(
        artifactDetail.artifactId,
        artifactDetail.name,
        data.content || '',
        artifactDetail.description,
        data.type || ''
      );

      // Trigger the artifact created callback
      if (onArtifactCreated) {
        onArtifactCreated(artifactDetail);
      }

      // Dispatch event to open the artifact viewer
      window.dispatchEvent(new CustomEvent('openAssistantArtifactTrigger', { 
        detail: { 
          artifact,
          isOpen: true 
        }
      }));

      setStatus(ArtifactMessageStatus.COMPLETE);
    } catch (error) {
      console.error("Error processing auto artifact block:", error);
      setStatus(ArtifactMessageStatus.CANCELLED);
    } finally {
      setIsProcessing(false);
    }
  };

  if (status === ArtifactMessageStatus.COMPLETE || status === ArtifactMessageStatus.CANCELLED) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row gap-3 rounded-xl text-neutral-600 border-2 dark:border-none dark:text-white bg-neutral-100 dark:bg-[#343541] rounded-md shadow-lg p-1 pl-2">
        <IconHammer size={20} />
        Creating Your Artifact...
      </div>
    </div>
  );
};

export default AssistantAutoArtifactBlock; 