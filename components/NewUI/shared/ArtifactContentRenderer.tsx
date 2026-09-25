import React, { useRef } from 'react';

import type { Artifact } from '@/types/artifacts';

import { ArtifactContentBlock } from '@/components/Artifacts/ArtifactsContentBlock';

interface Props {
  artifact: Artifact;
  showCodeView?: boolean;
}

/**
 * New UI adapter for the established chat artifact renderer.
 * The renderer itself remains in the legacy component because it is also used
 * by the regular in-chat artifact panel; this wrapper only supplies the
 * context-independent props needed by the Library viewer.
 */
export const ArtifactContentRenderer: React.FC<Props> = ({
  artifact,
  showCodeView = false,
}) => {
  const artifactEndRef = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full min-h-full" data-new-ui-artifact-renderer="true">
      <ArtifactContentBlock
        artifactIsStreaming={false}
        selectedArtifact={artifact}
        artifactId={artifact.artifactId}
        versionIndex={Math.max(0, (artifact.version ?? 1) - 1)}
        artifactEndRef={artifactEndRef}
        showCodeView={showCodeView}
      />
    </div>
  );
};

export default ArtifactContentRenderer;
