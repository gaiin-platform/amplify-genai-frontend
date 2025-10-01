import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconCheck, IconMinus, IconSearch, IconFilter, IconGlobe } from '@tabler/icons-react';
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
    <div className={`${lightMode} fixed inset-0 z-[9999] flex items-center justify-center p-4`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onCancel} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        
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