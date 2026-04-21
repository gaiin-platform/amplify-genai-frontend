import React from 'react';
import styled, { keyframes } from 'styled-components';

const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: 200px 0;
  }
`;

const SkeletonBase = styled.div`
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200px 100%;
  animation: ${shimmer} 1.2s ease-in-out infinite;
  border-radius: 4px;
`;

const MessageSkeleton = styled(SkeletonBase)`
  height: 60px;
  margin-bottom: 16px;
  width: 100%;
`;

const TextSkeleton = styled(SkeletonBase)`
  height: 16px;
  margin-bottom: 8px;
  width: ${(props: { width?: string }) => props.width || '100%'};
`;

interface SkeletonLoaderProps {
  count?: number;
  type?: 'message' | 'text';
  width?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  count = 1, 
  type = 'message',
  width
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => (
    type === 'message' ? 
      <MessageSkeleton key={i} /> : 
      <TextSkeleton key={i} width={width} />
  ));

  return (
    <div role="status" aria-label="Loading content">
      <span className="sr-only">Loading...</span>
      {skeletons}
    </div>
  );
};