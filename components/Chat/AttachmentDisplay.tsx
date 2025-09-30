import React, { useState } from 'react';
import { IconCircleX, IconFileText, IconEdit, IconCheck, IconWorld, IconSitemap } from '@tabler/icons-react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import styled, { keyframes } from "styled-components";
import { FiCommand } from "react-icons/fi";

import { LargeTextBlock, extractNumberFromParenthesizedChar } from '@/utils/app/largeText';
import { AttachedDocument } from '@/types/attacheddocument';

interface AttachmentDisplayProps {
  // File attachments
  documents?: AttachedDocument[];
  documentStates?: { [key: string]: number };
  onCancelUpload?: (document: AttachedDocument) => void;
  setDocuments?: (documents: AttachedDocument[]) => void;
  
  // Large text blocks
  largeTextBlocks?: LargeTextBlock[];
  onRemoveBlock?: (blockId: string) => void;
  onEditBlock?: (blockId: string) => void;
  currentlyEditingId?: string;
  showLargeTextPreview?: boolean;
}

const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: #777777;
  font-size: 1.1rem;
  font-weight: bold;
  animation: ${animate} 2s infinite;
`;

export const AttachmentDisplay: React.FC<AttachmentDisplayProps> = ({
  documents = [],
  documentStates,
  onCancelUpload,
  setDocuments,
  largeTextBlocks = [],
  onRemoveBlock,
  onEditBlock,
  currentlyEditingId,
  showLargeTextPreview = true
}) => {
  const [hoveredItem, setHoveredItem] = useState<string>('');

  // Helper functions for files
  const isFileComplete = (document: AttachedDocument) => {
    return !documentStates || (documentStates && documentStates[document.id] == 100);
  };

  const getFileProgress = (document: AttachedDocument) => {
    if (documentStates && documentStates[document.id]) {
      const percentage = documentStates[document.id];
      return (
        <div className="mr-1 flex items-center justify-center w-6 dark:text-black" style={{minWidth:"20px"}}>
          <CircularProgressbar
            styles={buildStyles({
              textSize: '32px',
              pathTransitionDuration: 0.5,
              pathColor: `rgba(62, 152, 199})`,
              textColor: '#000000',
              trailColor: '#d6d6d6',
              backgroundColor: '#3e98c7',
            })}
            value={percentage} 
            text={`${percentage}`} 
          />
        </div>
      );
    }
    return <LoadingIcon />;
  };

  const getFileLabel = (document: AttachedDocument) => {
    if (!document.name) { return 'Untitled Document'; }
    return document.name.length > 12 ? document.name.slice(0, 12) + '...' : document.name;
  };

  const getFileIcon = (document: AttachedDocument) => {
    switch (document.type) {
      case 'website/sitemap':
        return <IconSitemap className="text-blue-500" size={18} />;
      case 'website/url':
        return <IconWorld className="text-blue-500" size={18} />;
      default:
        return !isFileComplete(document) ? 
               getFileProgress(document) : 
               <IconCheck className="text-green-500" />;
    }
  };

  // Helper functions for large text blocks
  const getTextBlockLabel = (block: LargeTextBlock): string => {
    const numberText = extractNumberFromParenthesizedChar(block.placeholderChar);
    return `${numberText}. Input Text`;
  };

  const getTextBlockSubLabel = (block: LargeTextBlock): string => {
    return `${block.charCount.toLocaleString()} chars`;
  };

  // Check if we have any content to display
  const hasFiles = documents.length > 0;
  const hasTextBlocks = largeTextBlocks.length > 0 && showLargeTextPreview;
  
  if (!hasFiles && !hasTextBlocks) {
    return null;
  }

  // Create a unified list of all attachments
  const allAttachments: Array<{
    id: string;
    type: 'file' | 'text';
    index: number;
    data: AttachedDocument | LargeTextBlock;
  }> = [];

  // Add files
  documents.forEach((doc, index) => {
    allAttachments.push({
      id: `file-${doc.id}`,
      type: 'file',
      index: index + 1,
      data: doc
    });
  });

  // Add text blocks
  largeTextBlocks.forEach((block) => {
    const numberText = extractNumberFromParenthesizedChar(block.placeholderChar);
    allAttachments.push({
      id: `text-${block.id}`,
      type: 'text',
      index: parseInt(numberText),
      data: block
    });
  });

  return (
    <div className="flex overflow-x-auto pb-2 mt-2">
      {allAttachments.map((attachment) => {
        const isHovered = hoveredItem === attachment.id;
        
        if (attachment.type === 'file') {
          const document = attachment.data as AttachedDocument;
          const isComplete = isFileComplete(document);
          
          return (
            <div
              key={attachment.id}
              className={`${isComplete ? 'bg-white' : 'bg-yellow-400'} flex flex-row items-center justify-between border bg-white rounded-md px-1 py-1 ml-1 mr-1 shadow-md dark:shadow-lg`}
              style={{ maxWidth: '220px' }}
              onMouseEnter={() => setHoveredItem(attachment.id)}
              onMouseLeave={() => setHoveredItem('')}
            >
              {getFileIcon(document)}
              
              <div className="ml-1" title={document.name}>
                <p className={`truncate font-medium text-sm ${isComplete ? 'text-gray-800' : 'text-gray-800'}`}
                  style={{ maxWidth: '160px' }}>
                  {attachment.index}. {getFileLabel(document)}
                </p>
              </div>

              <button
                className="text-gray-400 hover:text-gray-600 transition-all"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onCancelUpload) {
                    onCancelUpload(document);
                  }
                  if (setDocuments) {
                    setDocuments(documents.filter(x => x !== document));
                  }
                }}
              >
                <IconCircleX />
              </button>
            </div>
          );
        } else {
          // Text block
          const block = attachment.data as LargeTextBlock;
          const isEditing = currentlyEditingId === block.id;
          
          return (
            <div
              key={attachment.id}
              className={`
                flex flex-row items-center justify-between border rounded-md px-2 py-1.5 ml-1 mr-1 shadow-md dark:shadow-lg
                ${isEditing 
                  ? 'bg-blue-100 border-blue-400 dark:bg-blue-900/40 dark:border-blue-500' 
                  : 'bg-white border-gray-200 dark:bg-[#40414F] dark:border-neutral-500'
                }
                ${!isEditing && isHovered ? 'hover:bg-gray-50 dark:hover:bg-gray-600' : ''}
                transition-colors cursor-pointer
              `}
              style={{ maxWidth: '220px', minWidth: '160px' }}
              onMouseEnter={() => setHoveredItem(attachment.id)}
              onMouseLeave={() => setHoveredItem('')}
              onClick={() => !isEditing && onEditBlock && onEditBlock(block.id)}
            >
              {/* Icon */}
              <div className="flex-shrink-0 mr-2">
                {isEditing ? (
                  <IconEdit className="text-blue-600 dark:text-blue-400" size={18} />
                ) : (
                  <IconFileText className="text-gray-600 dark:text-gray-400" size={18} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-sm text-gray-800 dark:text-white">
                  {getTextBlockLabel(block)}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {getTextBlockSubLabel(block)}
                </p>
              </div>

              {/* Status/Action Icons */}
              <div className="flex-shrink-0 ml-2 flex items-center gap-1">
                {isEditing && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Edit
                  </span>
                )}
                
                {/* Remove button */}
                <button
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveBlock && onRemoveBlock(block.id);
                  }}
                  title="Remove text block"
                >
                  <IconCircleX size={16} />
                </button>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default AttachmentDisplay;