import { Artifact, ArtifactBlockDetail } from '@/types/artifacts';
import { lzwCompress, lzwUncompress } from '@/utils/app/lzwCompression';
import { getDateName } from '@/utils/app/date';

/**
 * Service for handling artifacts in the assistant context
 */
export const assistantArtifactsService = {
  /**
   * Create a new artifact
   */
  createArtifact: (
    id: string,
    name: string,
    contents: string,
    description: string = '',
    type: string = '',
    tags: string[] = []
  ): Artifact => {
    return {
      artifactId: id,
      name,
      contents: lzwCompress(contents),
      description,
      createdAt: getDateName(),
      version: 1,
      type,
      tags
    };
  },

  /**
   * Create a new version of an existing artifact
   */
  createArtifactVersion: (
    artifact: Artifact,
    newContents: string,
    newDescription?: string
  ): Artifact => {
    return {
      ...artifact,
      contents: lzwCompress(newContents),
      description: newDescription || artifact.description,
      createdAt: getDateName(),
      version: artifact.version + 1
    };
  },

  /**
   * Get artifact detail suitable for display
   */
  getArtifactDetail: (artifact: Artifact): ArtifactBlockDetail => {
    return {
      artifactId: artifact.artifactId,
      name: artifact.name,
      description: artifact.description,
      createdAt: artifact.createdAt,
      version: artifact.version
    };
  },

  /**
   * Decompress and get the contents of an artifact
   */
  getArtifactContents: (artifact: Artifact): string => {
    return lzwUncompress(artifact.contents);
  },

  /**
   * Extract code blocks from artifact content to display them properly
   */
  extractCodeBlocks: (content: string): { language: string; code: string }[] => {
    const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)\n```/g;
    const codeBlocks: { language: string; code: string }[] = [];
    
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || '',
        code: match[2]
      });
    }
    
    return codeBlocks;
  }
}; 