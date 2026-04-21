import dynamic from 'next/dynamic';
import { LoadingIcon } from "@/components/Loader/LoadingIcon";

const BlockLoader = () => (
  <div className="flex items-center justify-center p-4">
    <LoadingIcon />
    <span className="ml-2 text-gray-400 text-sm">Loading...</span>
  </div>
);

// Mermaid: ~1.5MB — only loaded when a mermaid diagram is in the message
export const DynamicMermaid = dynamic(
  () => import('@/components/Chat/ChatContentBlocks/MermaidBlock'),
  { ssr: false, loading: BlockLoader }
);

// Vega/VegaLite: ~1MB+ — only loaded when a vega visualization is in the message
export const DynamicVegaVis = dynamic(
  () => import('@/components/Chat/ChatContentBlocks/VegaVisBlock'),
  { ssr: false, loading: BlockLoader }
);

// KaTeX: ~500KB — only loaded when LaTeX math is in the message
export const DynamicLatexBlock = dynamic(
  () => import('@/components/Chat/ChatContentBlocks/LatexBlock'),
  { ssr: false, loading: BlockLoader }
);

// ArtifactLatexBlock: shares katex dep with LatexBlock
export const DynamicArtifactLatexBlock = dynamic(
  () => import('@/components/Chat/ChatContentBlocks/ArtifactLatexBlock'),
  { ssr: false, loading: BlockLoader }
);
