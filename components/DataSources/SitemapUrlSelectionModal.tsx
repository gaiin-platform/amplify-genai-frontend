import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconCheck, IconMinus, IconSearch, IconFilter, IconGlobe, IconArrowRight, IconArrowLeft, IconSettings, IconAlertTriangle } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import { useContext } from 'react';
import ActionButton from '../ReusableComponents/ActionButton';

export interface SitemapExclusions {
  excludedUrls?: string[];           // Exact URLs to exclude  
  excludeKeywords?: string[];        // Keywords: ["archive", "deprecated", "test"]
}

interface SitemapUrlSelectionModalProps {
  sitemapUrl: string;
  urls: string[];
  totalUrls: number;
  maxPages: number;
  onConfirm: (selectedUrls: string[], exclusions: SitemapExclusions, adjustedMaxPages: number) => void;
  onCancel: () => void;
}

export const SitemapUrlSelectionModal: React.FC<SitemapUrlSelectionModalProps> = ({
  sitemapUrl,
  urls,
  totalUrls,
  maxPages,
  onConfirm,
  onCancel
}) => {
  const { state: { lightMode } } = useContext(HomeContext);
  const [mounted, setMounted] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set(urls));
  const [searchTerm, setSearchTerm] = useState('');
  const [excludeKeywords, setExcludeKeywords] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Filter URLs based on search term
  const filteredUrls = useMemo(() => {
    if (!searchTerm) return urls;
    return urls.filter(url => 
      url.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [urls, searchTerm]);

  // Apply keyword exclusions - runs whenever we have complete keywords
  const applyKeywordExclusion = (keywords: string) => {
    const newSelectedUrls = new Set(urls); // Start with all URLs
    const items = keywords.split(',').map(s => s.trim()).filter(Boolean);
    
    // Remove URLs that contain any of the keywords
    urls.forEach(url => {
      const lowerUrl = url.toLowerCase();
      const shouldExclude = items.some(keyword => 
        lowerUrl.includes(keyword.toLowerCase())
      );
      if (shouldExclude) {
        newSelectedUrls.delete(url);
      }
    });
    
    setSelectedUrls(newSelectedUrls);
  };

  // Handle keyword input changes
  const handleKeywordsChange = (value: string) => {
    setExcludeKeywords(value);
    
    // If the value ends with a comma, process the keywords immediately
    if (value.endsWith(',')) {
      applyKeywordExclusion(value);
    }
  };

  const toggleUrl = (url: string) => {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedUrls(newSelected);
  };

  const toggleAll = () => {
    if (selectedUrls.size === urls.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(urls));
    }
  };

  const handleConfirm = () => {
    const finalSelectedUrls = Array.from(selectedUrls);
    const exclusions: SitemapExclusions = {};
    
    if (excludeKeywords.trim()) {
      exclusions.excludeKeywords = excludeKeywords.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    // Add explicitly excluded URLs
    const excludedUrls = urls.filter(url => !selectedUrls.has(url));
    if (excludedUrls.length > 0) {
      exclusions.excludedUrls = excludedUrls;
    }
    
    // CRITICAL FIX: Set maxPages to selected count to prevent backend from grabbing extra URLs
    const adjustedMaxPages = selectedUrls.size;
    
    onConfirm(finalSelectedUrls, exclusions, adjustedMaxPages);
  };

  if (!mounted) return null;

  const modalContent = (
    <div
      className={`${lightMode} fixed inset-0 z-[9999] flex items-center justify-center p-4`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconGlobe size={24} className="text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Select Sitemap URLs
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {sitemapUrl}
              </p>
            </div>
          </div>
          <ActionButton
                handleClick={onCancel}
                title={"Close"}
            >
                <IconX size={24}/>
          </ActionButton>
        </div>

        {/* Stats & Controls */}
        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/30 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              <span className="font-medium">{selectedUrls.size}</span> of <span className="font-medium">{urls.length}</span> URLs selected
              {totalUrls > maxPages && (
                <span className="ml-2 text-amber-600 dark:text-amber-300">
                  ({totalUrls - maxPages} more URLs available - increase Max Pages to see them)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleAll}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors flex items-center gap-1 text-gray-700 dark:text-gray-200"
              >
                {selectedUrls.size === urls.length ? <IconMinus size={16} /> : <IconCheck size={16} />}
                {selectedUrls.size === urls.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <IconSearch size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search URLs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Exclude by Keywords */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <IconFilter size={16} />
              Exclude URLs by Keywords
            </div>
            
            <div>
              <input
                type="text"
                placeholder="Type keywords separated by commas: archive, old, test, admin"
                value={excludeKeywords}
                onChange={(e) => handleKeywordsChange(e.target.value)}
                onBlur={() => excludeKeywords.trim() && applyKeywordExclusion(excludeKeywords)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-300"
              />
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                URLs containing these keywords will be automatically deselected. Press comma or blur to apply.
              </p>
            </div>
          </div>
        </div>

        {/* URL List */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="space-y-2">
            {filteredUrls.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {searchTerm ? 'No URLs match your search' : 'No URLs found'}
              </div>
            ) : (
              filteredUrls.map((url, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedUrls.has(url)
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-600'
                      : 'bg-gray-50 dark:bg-gray-600 border-gray-200 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-500'
                  }`}
                  onClick={() => toggleUrl(url)}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedUrls.has(url)
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300 dark:border-gray-400'
                  }`}>
                    {selectedUrls.has(url) && (
                      <IconCheck size={12} className="text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {url}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {selectedUrls.size} URLs will be scraped and added to your assistant
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedUrls.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              Add {selectedUrls.size} URLs
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};


// ==================== SITEMAP EXCLUSION MANAGER ====================

interface SitemapExclusionManagerProps {
  sitemapUrl: string;
  allUrls: string[];  // All URLs from fresh sitemap fetch
  currentlyIncludedUrls: string[];  // URLs currently in assistant's data sources
  currentExclusions: SitemapExclusions;
  onSave: (data: {
    exclusions: SitemapExclusions;
    urlsToAdd: string[];  // New URLs to add to assistant (will be scraped)
    urlsToRemove: string[];  // URLs to remove from assistant
  }) => void;
  onCancel: () => void;
}

export const SitemapExclusionManager: React.FC<SitemapExclusionManagerProps> = ({
  sitemapUrl,
  allUrls,
  currentlyIncludedUrls,
  currentExclusions,
  onSave,
  onCancel
}) => {
  const { state: { lightMode } } = useContext(HomeContext);
  const [mounted, setMounted] = useState(false);

  // State for URL management
  const excludedUrlsSet = useMemo(() =>
    new Set(currentExclusions.excludedUrls || []),
    [currentExclusions.excludedUrls]
  );

  const [includedUrls, setIncludedUrls] = useState<string[]>([]);
  const [excludedUrls, setExcludedUrls] = useState<string[]>([]);

  // Selection state
  const [selectedIncluded, setSelectedIncluded] = useState<Set<string>>(new Set());
  const [selectedExcluded, setSelectedExcluded] = useState<Set<string>>(new Set());

  // Search state
  const [includedSearch, setIncludedSearch] = useState('');
  const [excludedSearch, setExcludedSearch] = useState('');

  // Hover state for arrows
  const [hoveredUrl, setHoveredUrl] = useState<string | null>(null);
  const [hoveredPane, setHoveredPane] = useState<'included' | 'excluded' | null>(null);

  // Track new and orphaned URLs
  const [newUrls, setNewUrls] = useState<Set<string>>(new Set());
  const [orphanedUrls, setOrphanedUrls] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';

    // Categorize URLs into: included, excluded, new, orphaned
    const currentlyIncludedSet = new Set(currentlyIncludedUrls);
    const freshSitemapSet = new Set(allUrls);
    const excludedSet = new Set(currentExclusions.excludedUrls || []);

    const included: string[] = [];
    const excluded: string[] = [];
    const newUrlsDetected: string[] = [];
    const orphaned: string[] = [];

    // Process fresh sitemap URLs
    allUrls.forEach(url => {
      if (currentlyIncludedSet.has(url)) {
        // URL is currently in assistant's data sources
        included.push(url);
      } else if (excludedSet.has(url)) {
        // URL is explicitly excluded
        excluded.push(url);
      } else {
        // URL is NEW (not in data sources, not excluded)
        newUrlsDetected.push(url);
        included.push(url); // Add new URLs to included by default
      }
    });

    // Find orphaned URLs (in assistant but not in fresh sitemap)
    currentlyIncludedUrls.forEach(url => {
      if (!freshSitemapSet.has(url)) {
        orphaned.push(url);
      }
    });

    setIncludedUrls(included);
    setExcludedUrls(excluded);
    setNewUrls(new Set(newUrlsDetected));
    setOrphanedUrls(orphaned);

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [allUrls, currentlyIncludedUrls, currentExclusions]);

  // Filter URLs based on search
  const filteredIncluded = useMemo(() => {
    if (!includedSearch) return includedUrls;
    return includedUrls.filter(url =>
      url.toLowerCase().includes(includedSearch.toLowerCase())
    );
  }, [includedUrls, includedSearch]);

  const filteredExcluded = useMemo(() => {
    if (!excludedSearch) return excludedUrls;
    return excludedUrls.filter(url =>
      url.toLowerCase().includes(excludedSearch.toLowerCase())
    );
  }, [excludedUrls, excludedSearch]);

  // Move URLs between panes
  const moveToExcluded = (urls: string[]) => {
    setIncludedUrls(prev => prev.filter(url => !urls.includes(url)));
    setExcludedUrls(prev => [...prev, ...urls].sort());
    setSelectedIncluded(new Set());
  };

  const moveToIncluded = (urls: string[]) => {
    setExcludedUrls(prev => prev.filter(url => !urls.includes(url)));
    setIncludedUrls(prev => [...prev, ...urls].sort());
    setSelectedExcluded(new Set());
  };

  // Toggle selection
  const toggleIncluded = (url: string) => {
    const newSelected = new Set(selectedIncluded);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedIncluded(newSelected);
  };

  const toggleExcluded = (url: string) => {
    const newSelected = new Set(selectedExcluded);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedExcluded(newSelected);
  };

  // Select all
  const selectAllIncluded = () => {
    setSelectedIncluded(new Set(filteredIncluded));
  };

  const selectAllExcluded = () => {
    setSelectedExcluded(new Set(filteredExcluded));
  };

  // Drag selection
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartUrl, setDragStartUrl] = useState<string | null>(null);
  const [dragPane, setDragPane] = useState<'included' | 'excluded' | null>(null);

  const handleMouseDown = (url: string, pane: 'included' | 'excluded') => {
    setIsDragging(true);
    setDragStartUrl(url);
    setDragPane(pane);

    if (pane === 'included') {
      toggleIncluded(url);
    } else {
      toggleExcluded(url);
    }
  };

  const handleMouseEnter = (url: string, pane: 'included' | 'excluded') => {
    if (isDragging && dragPane === pane) {
      if (pane === 'included') {
        setSelectedIncluded(prev => new Set([...Array.from(prev), url]));
      } else {
        setSelectedExcluded(prev => new Set([...Array.from(prev), url]));
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartUrl(null);
    setDragPane(null);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);

  const handleSave = () => {
    // Calculate changes
    const originalIncludedSet = new Set(currentlyIncludedUrls);
    const currentIncludedSet = new Set(includedUrls);

    // URLs to add: in current included but NOT in original (these are new or moved from excluded)
    const urlsToAdd = includedUrls.filter(url => !originalIncludedSet.has(url));

    // URLs to remove: in original but NOT in current included (moved to excluded)
    const urlsToRemove = currentlyIncludedUrls.filter(url => !currentIncludedSet.has(url));

    const exclusions: SitemapExclusions = {
      ...currentExclusions,
      excludedUrls: excludedUrls.length > 0 ? excludedUrls : undefined
    };

    onSave({
      exclusions,
      urlsToAdd,
      urlsToRemove
    });
  };

  if (!mounted) return null;

  const modalContent = (
    <div
      className={`${lightMode} fixed inset-0 z-[9999] flex items-center justify-center p-4`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onMouseLeave={handleMouseUp}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconSettings size={24} className="text-blue-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Manage Sitemap URLs
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {sitemapUrl}
              </p>
            </div>
          </div>
          <ActionButton handleClick={onCancel} title="Close">
            <IconX size={24}/>
          </ActionButton>
        </div>

        {/* Instructions */}
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Move URLs between included and excluded lists.</strong> Click to select, drag to select multiple, or use the arrow buttons to move selected URLs.
          </p>
        </div>

        {/* Dual Pane Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* URL Selection Pane Component */}
          {(() => {
            const UrlPane: React.FC<{
              side: 'left' | 'right';
              title: string;
              urls: string[];
              filteredUrls: string[];
              selectedUrls: Set<string>;
              searchValue: string;
              onSearchChange: (value: string) => void;
              onSelectAll: () => void;
              onDeselectAll: () => void;
              onMoveUrls: (urls: string[]) => void;
              onMouseDown: (url: string) => void;
              onMouseEnter: (url: string) => void;
              bgColor: string;
              moveButtonColor: string;
              moveButtonIcon: React.ReactNode;
              moveButtonText: string;
              searchPlaceholder: string;
              paneType: 'included' | 'excluded';
              newUrls?: Set<string>;
            }> = ({
              side,
              title,
              urls,
              filteredUrls,
              selectedUrls,
              searchValue,
              onSearchChange,
              onSelectAll,
              onDeselectAll,
              onMoveUrls,
              onMouseDown,
              onMouseEnter,
              bgColor,
              moveButtonColor,
              moveButtonIcon,
              moveButtonText,
              searchPlaceholder,
              paneType,
              newUrls
            }) => {
              const isLeft = side === 'left';
              const paddingClass = isLeft ? 'pr-8' : 'pl-8';
              const arrowPositionClass = isLeft ? 'right-2' : 'left-2 mr-2';

              return (
                <div className={`flex-1 flex flex-col ${isLeft ? 'border-r border-gray-200 dark:border-gray-600' : ''}`}>
                  <div className={`px-4 py-3 ${bgColor} border-b border-gray-200 dark:border-gray-600`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {title} ({urls.length})
                      </h4>
                      {selectedUrls.size > 0 && (
                        <button
                          onClick={() => onMoveUrls(Array.from(selectedUrls))}
                          className={`px-2 py-1 text-xs ${moveButtonColor} text-white rounded flex items-center gap-1`}
                        >
                          {moveButtonIcon} {moveButtonText} {selectedUrls.size}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <IconSearch size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    {filteredUrls.length > 0 && (
                      <div className="mt-2 flex gap-3">
                        <button
                          onClick={onSelectAll}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Select all {filteredUrls.length}
                        </button>
                        {selectedUrls.size > 0 && (
                          <button
                            onClick={onDeselectAll}
                            className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
                          >
                            Deselect all
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto px-4 py-2">
                    {filteredUrls.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                        {searchValue ? 'No matching URLs' : `No ${paneType} URLs`}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredUrls.map((url) => {
                          const isSelected = selectedUrls.has(url);
                          const isHovered = hoveredUrl === url && hoveredPane === paneType;

                          return (
                            <div
                              key={url}
                              className={`group relative flex items-center gap-2 p-2 ${paddingClass} rounded border cursor-pointer transition-colors select-none ${
                                isSelected
                                  ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600'
                                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                              }`}
                              onMouseDown={() => onMouseDown(url)}
                              onMouseEnter={() => onMouseEnter(url)}
                              onMouseOver={() => {
                                setHoveredUrl(url);
                                setHoveredPane(paneType);
                              }}
                              onMouseLeave={() => {
                                setHoveredUrl(null);
                                setHoveredPane(null);
                              }}
                            >
                              <button
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMoveUrls([url]);
                                }}
                                className={`absolute ${arrowPositionClass} ${isHovered ? 'opacity-100' : 'opacity-0'} p-1 ${moveButtonColor} text-white rounded transition-opacity z-10`}
                                title={`${moveButtonText} this URL`}
                              >
                                {moveButtonIcon}
                              </button>
                              {isLeft && (
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-500'
                                }`}>
                                  {isSelected && <IconCheck size={10} className="text-white" />}
                                </div>
                              )}
                              <div className="flex-1 min-w-0 text-xs text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                                <span className="truncate">{url}</span>
                                {newUrls && newUrls.has(url) && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500 text-white rounded">
                                    NEW
                                  </span>
                                )}
                              </div>
                              {!isLeft && (
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-500'
                                }`}>
                                  {isSelected && <IconCheck size={10} className="text-white" />}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <>
                <UrlPane
                  side="left"
                  title="Included URLs"
                  urls={includedUrls}
                  filteredUrls={filteredIncluded}
                  selectedUrls={selectedIncluded}
                  searchValue={includedSearch}
                  onSearchChange={setIncludedSearch}
                  onSelectAll={selectAllIncluded}
                  onDeselectAll={() => setSelectedIncluded(new Set())}
                  onMoveUrls={moveToExcluded}
                  onMouseDown={(url) => handleMouseDown(url, 'included')}
                  onMouseEnter={(url) => handleMouseEnter(url, 'included')}
                  bgColor="bg-green-50 dark:bg-green-900/20"
                  moveButtonColor="bg-red-500 hover:bg-red-600"
                  moveButtonIcon={<IconArrowRight size={14} />}
                  moveButtonText="Exclude"
                  searchPlaceholder="Search included URLs..."
                  paneType="included"
                  newUrls={newUrls}
                />
                <UrlPane
                  side="right"
                  title="Excluded URLs"
                  urls={excludedUrls}
                  filteredUrls={filteredExcluded}
                  selectedUrls={selectedExcluded}
                  searchValue={excludedSearch}
                  onSearchChange={setExcludedSearch}
                  onSelectAll={selectAllExcluded}
                  onDeselectAll={() => setSelectedExcluded(new Set())}
                  onMoveUrls={moveToIncluded}
                  onMouseDown={(url) => handleMouseDown(url, 'excluded')}
                  onMouseEnter={(url) => handleMouseEnter(url, 'excluded')}
                  bgColor="bg-red-50 dark:bg-red-900/20"
                  moveButtonColor="bg-green-500 hover:bg-green-600"
                  moveButtonIcon={<IconArrowLeft size={14} />}
                  moveButtonText="Include"
                  searchPlaceholder="Search excluded URLs..."
                  paneType="excluded"
                />
              </>
            );
          })()}
        </div>

        {/* Orphaned URLs Section */}
        {orphanedUrls.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-600 bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-start gap-3">
              <IconAlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Orphaned URLs ({orphanedUrls.length})
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
                  These URLs are in your assistant but no longer appear in the sitemap. They will be automatically removed on the next sitemap rescan.
                </p>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {orphanedUrls.map((url) => (
                    <div
                      key={url}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-700 rounded border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-200 truncate">
                        {url}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium text-green-600 dark:text-green-400">{includedUrls.length} included</span>
            {newUrls.size > 0 && (
              <span className="font-medium text-blue-600 dark:text-blue-400"> ({newUrls.size} new)</span>
            )}
            {' • '}
            <span className="font-medium text-red-600 dark:text-red-400">{excludedUrls.length} excluded</span>
            {orphanedUrls.length > 0 && (
              <span className="font-medium text-yellow-600 dark:text-yellow-400"> • {orphanedUrls.length} orphaned</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};