/**
 * Document Manager
 *
 * Handles document upload, viewing, and management for knowledge bases.
 * Supports drag-and-drop, progress tracking, and RAG status display.
 */

import { useState, useCallback, useRef } from 'react';
import {
  IconUpload,
  IconFile,
  IconFileTypePdf,
  IconFileTypeDoc,
  IconFileTypeXls,
  IconFileTypePpt,
  IconTrash,
  IconEye,
  IconX,
  IconCheck,
  IconLoader,
  IconSearch,
  IconFilter,
  IconTag,
} from '@tabler/icons-react';
import { KBDocument, DocumentStatus } from '@/types/knowledgeBase';
import { uploadDocument, deleteDocument } from '@/services/knowledgeBaseService';

interface DocumentManagerProps {
  knowledgeBaseId: string;
  documents: KBDocument[];
  onDocumentsChange: (documents: KBDocument[]) => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export default function DocumentManager({
  knowledgeBaseId,
  documents,
  onDocumentsChange,
}: DocumentManagerProps) {
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showTagInput, setShowTagInput] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supported file types
  const ACCEPTED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
  ];

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return IconFileTypePdf;
    if (mimeType.includes('word') || mimeType.includes('document')) return IconFileTypeDoc;
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return IconFileTypeXls;
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation'))
      return IconFileTypePpt;
    return IconFile;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `File type not supported: ${file.type}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${formatFileSize(file.size)} (max 50MB)`;
    }
    return null;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.set(file.name, { file, progress: 0, status: 'error', error });
          return next;
        });
        continue;
      }

      // Start upload
      setUploadingFiles((prev) => {
        const next = new Map(prev);
        next.set(file.name, { file, progress: 0, status: 'uploading' });
        return next;
      });

      try {
        // Simulate progress (real progress would come from XHR)
        const progressInterval = setInterval(() => {
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            const current = next.get(file.name);
            if (current && current.progress < 90) {
              next.set(file.name, { ...current, progress: current.progress + 10 });
            }
            return next;
          });
        }, 200);

        const newDoc = await uploadDocument(knowledgeBaseId, file);

        clearInterval(progressInterval);

        if (newDoc) {
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            next.set(file.name, { file, progress: 100, status: 'complete' });
            return next;
          });

          // Add to documents list
          onDocumentsChange([...documents, newDoc]);

          // Remove from uploading after delay
          setTimeout(() => {
            setUploadingFiles((prev) => {
              const next = new Map(prev);
              next.delete(file.name);
              return next;
            });
          }, 2000);
        } else {
          throw new Error('Upload failed');
        }
      } catch (err) {
        setUploadingFiles((prev) => {
          const next = new Map(prev);
          next.set(file.name, {
            file,
            progress: 0,
            status: 'error',
            error: 'Upload failed. Please try again.',
          });
          return next;
        });
      }
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  const handleDeleteDocument = async (doc: KBDocument) => {
    const confirmed = window.confirm(`Delete "${doc.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const success = await deleteDocument(knowledgeBaseId, doc.id);
      if (success) {
        onDocumentsChange(documents.filter((d) => d.id !== doc.id));
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'ready':
        return (
          <span className="flex items-center text-green-600 dark:text-green-400 text-xs">
            <IconCheck className="w-3 h-3 mr-1" />
            Ready
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center text-yellow-600 dark:text-yellow-400 text-xs">
            <IconLoader className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </span>
        );
      case 'uploading':
        return (
          <span className="flex items-center text-blue-600 dark:text-blue-400 text-xs">
            <IconLoader className="w-3 h-3 mr-1 animate-spin" />
            Uploading
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center text-red-600 dark:text-red-400 text-xs">
            <IconX className="w-3 h-3 mr-1" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  // Get all unique tags
  const allTags = Array.from(new Set(documents.flatMap((d) => d.tags)));

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !filterTag || doc.tags.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
        <IconUpload
          className={`w-12 h-12 mx-auto ${
            isDragging ? 'text-blue-600' : 'text-gray-400'
          }`}
        />
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-blue-600">Click to upload</span> or drag
          and drop
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          PDF, DOCX, PPTX, XLSX, CSV up to 50MB
        </p>
      </div>

      {/* Upload Progress */}
      {uploadingFiles.size > 0 && (
        <div className="space-y-2">
          {Array.from(uploadingFiles.entries()).map(([name, upload]) => (
            <div
              key={name}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <IconFile className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-white truncate max-w-[200px]">
                    {name}
                  </span>
                </div>
                {upload.status === 'error' ? (
                  <span className="text-xs text-red-600">{upload.error}</span>
                ) : upload.status === 'complete' ? (
                  <span className="text-xs text-green-600 flex items-center">
                    <IconCheck className="w-4 h-4 mr-1" />
                    Complete
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">{upload.progress}%</span>
                )}
              </div>
              {upload.status !== 'error' && (
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      upload.status === 'complete' ? 'bg-green-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="relative">
          <select
            value={filterTag || ''}
            onChange={(e) => setFilterTag(e.target.value || null)}
            className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none cursor-pointer"
          >
            <option value="">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <IconFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Knowledge Base Documents
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            {documents.length === 0
              ? 'No documents yet. Upload files to get started.'
              : 'No documents match your search.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredDocuments.map((doc) => {
              const FileIcon = getFileIcon(doc.type);
              return (
                <div
                  key={doc.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {doc.name}
                      </p>
                      <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatFileSize(doc.size)}</span>
                        {doc.chunkCount && <span>• {doc.chunkCount} chunks</span>}
                        {getStatusBadge(doc.status)}
                      </div>
                      {/* Tags */}
                      {doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                    <button
                      onClick={() =>
                        setShowTagInput(showTagInput === doc.id ? null : doc.id)
                      }
                      className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50"
                      title="Add tag"
                    >
                      <IconTag className="w-5 h-5" />
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/50"
                      title="Preview"
                    >
                      <IconEye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50"
                      title="Delete"
                    >
                      <IconTrash className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
