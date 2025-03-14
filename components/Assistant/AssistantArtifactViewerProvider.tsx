import React, { useEffect, useState } from 'react';
import AssistantArtifactViewer from './AssistantArtifactViewer';
import { Artifact } from '@/types/artifacts';

/**
 * Provider component that listens for artifact open events and renders the viewer
 * This allows the artifact viewer to be opened from any component via events
 */
const AssistantArtifactViewerProvider: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | undefined>(undefined);

  useEffect(() => {
    // Listen for the custom event to open the artifact viewer
    const handleOpenArtifactEvent = (event: CustomEvent<{ artifact: Artifact; isOpen: boolean }>) => {
      const { artifact, isOpen: shouldOpen } = event.detail;
      
      if (shouldOpen && artifact) {
        setCurrentArtifact(artifact);
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    // Add event listener
    window.addEventListener('openAssistantArtifactTrigger', handleOpenArtifactEvent as EventListener);

    // Clean up
    return () => {
      window.removeEventListener('openAssistantArtifactTrigger', handleOpenArtifactEvent as EventListener);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <AssistantArtifactViewer 
      artifact={currentArtifact} 
      isOpen={isOpen} 
      onClose={handleClose} 
    />
  );
};

export default AssistantArtifactViewerProvider; 