import { FC, memo } from 'react';
import ReactMarkdown, { Options } from 'react-markdown';

export const MemoizedReactMarkdown: FC<Options> = memo(
    ReactMarkdown,
    (prevProps, nextProps) => {
        // Only skip re-render if children are the same AND not empty
        // Empty or null content should always trigger re-render to ensure proper updates
        const prevChildren = prevProps.children || '';
        const nextChildren = nextProps.children || '';
        
        // Always re-render if content is changing from empty to non-empty or vice versa
        if ((prevChildren === '' && nextChildren !== '') || 
            (prevChildren !== '' && nextChildren === '')) {
            return false;
        }
        
        return prevChildren === nextChildren;
    }
);
