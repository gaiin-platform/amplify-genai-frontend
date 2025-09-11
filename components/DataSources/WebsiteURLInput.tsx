// components/DataSources/WebsiteURLInput.tsx
import React, { useState } from 'react';
import { IconSitemap, IconClock, IconWorld, IconAlertTriangle, IconLoader} from '@tabler/icons-react';
import Checkbox from '../ReusableComponents/CheckBox';
import { AttachedDocument } from '@/types/attacheddocument';
import { SchedulerPanel, SchedulerAlarmButton } from '@/components/ReusableComponents/SchedulerPanel';
import { AssistantDefinition } from '@/types/assistant';
import { validateUrl } from '@/utils/app/data';
import { SitemapUrlSelectionModal, SitemapExclusions } from './SitemapUrlSelectionModal';
import { getSiteMapUrls } from '@/services/assistantService';
import toast from 'react-hot-toast';


export const isWebsiteDs = (document: AttachedDocument) => {
    return ['website/url', 'website/sitemap'].includes(document.type);
}

interface WebsiteURLInputProps {
    onAddURL: (url: string, isSitemap: boolean, maxPages?: number | undefined, exclusions?: SitemapExclusions) => void;
}

export const WebsiteURLInput: React.FC<WebsiteURLInputProps> = ({ onAddURL }) => {
    const [url, setUrl] = useState('');
    const [isSitemap, setIsSitemap] = useState(false);
    const [maxPages, setMaxPages] = useState(50);
    const [unlimitedPages, setUnlimitedPages] = useState(false);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [urlWarning, setUrlWarning] = useState<string | null>(null);
    
    // Modal state
    const [showSitemapModal, setShowSitemapModal] = useState(false);
    const [sitemapUrls, setSitemapUrls] = useState<string[]>([]);
    const [sitemapData, setSitemapData] = useState<{totalUrls: number, maxPages: number} | null>(null);
    const [loadingSitemap, setLoadingSitemap] = useState(false);
    const [pendingSitemapUrl, setPendingSitemapUrl] = useState<string>('');


    const handleUrlChange = (value: string) => {
        setUrl(value);
        // Clear error and warning when user starts typing
        if (urlError) setUrlError(null);
        if (urlWarning) setUrlWarning(null);
    };

    const handleSitemapChange = (checked: boolean) => {
        setIsSitemap(checked);
        // Reset maxPages to default when toggling sitemap
        if (!checked) {
            setMaxPages(50);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const validation = validateUrl(url, isSitemap);
        
        if (!validation.isValid) {
            setUrlError(validation.error || 'Invalid URL');
            setUrlWarning(null);
            return;
        }
        
        if (validation.sanitizedUrl) {
            // Handle warning if present
            setUrlWarning(validation.warning || null);
            setUrlError(null);
            
            if (isSitemap) {
                // For sitemaps, fetch URLs and show selection modal
                setLoadingSitemap(true);
                setPendingSitemapUrl(validation.sanitizedUrl);
                
                try {
                    const result = await getSiteMapUrls(validation.sanitizedUrl, unlimitedPages ? undefined : maxPages);
                    
                    if (result.success && result.data?.urls) {
                        setSitemapUrls(result.data.urls);
                        setSitemapData({
                            totalUrls: result.data.totalUrls || result.data.urls.length,
                            maxPages: result.data.maxPages || maxPages
                        });
                        setShowSitemapModal(true);
                    } else {
                        toast.error(result.message || 'Failed to fetch sitemap URLs');
                        setUrlError('Unable to fetch URLs from sitemap');
                    }
                } catch (error) {
                    console.error('Error fetching sitemap URLs:', error);
                    // toast.error('Error fetching sitemap URLs');
                    setUrlError('Error fetching sitemap URLs');
                } finally {
                    setLoadingSitemap(false);
                }
            } else {
                // For regular URLs, add immediately
                onAddURL(validation.sanitizedUrl, isSitemap, undefined);
                setUrl('');
                setIsSitemap(false);
                setMaxPages(50); // Reset maxPages to default
            }
        }
    };

    const handleSitemapConfirm = (selectedUrls: string[], exclusions: SitemapExclusions, adjustedMaxPages: number) => {
        // If unlimited pages was selected, pass undefined instead of adjustedMaxPages
        const finalMaxPages = unlimitedPages ? undefined : adjustedMaxPages;
        onAddURL(pendingSitemapUrl, true, finalMaxPages, exclusions);
        setShowSitemapModal(false);
        setSitemapUrls([]);
        setSitemapData(null);
        setPendingSitemapUrl('');
        setUrl('');
        setIsSitemap(false);
        setMaxPages(50);
        setUnlimitedPages(false);
        toast.success(`Added ${selectedUrls.length} URLs from sitemap`);
    };

    const handleSitemapCancel = () => {
        setShowSitemapModal(false);
        setSitemapUrls([]);
        setSitemapData(null);
        setPendingSitemapUrl('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="Enter website URL or sitemap URL"
                    className="flex-grow rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                />
                <button
                    type="submit"
                    disabled={loadingSitemap}
                    className="rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 dark:hover:bg-[#343541] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {loadingSitemap && <IconLoader size={16} className="animate-spin" />}
                    {loadingSitemap ? 'Loading Sitemap...' : 'Add URL'}
                </button>
            </div>
            <div className="flex flex-col">
                <div className="flex items-center gap-3">
                    <Checkbox
                        id="sitemap-checkbox"
                        label="This is a sitemap URL"
                        checked={isSitemap}
                        onChange={handleSitemapChange}
                    />
                    <IconSitemap className="-mt-1 -ml-1" size={16} />
                    {isSitemap && (
                        <div className="ml-3">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Max Pages:
                                </label>
                                <select
                                    value={unlimitedPages ? "unlimited" : "limited"}
                                    onChange={(e) => setUnlimitedPages(e.target.value === "unlimited")}
                                    className="rounded-lg border border-neutral-500 px-2 py-1 text-neutral-900 text-sm focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                >
                                    <option value="limited">Limit to specific number</option>
                                    <option value="unlimited">⚠️ Get ALL URLs</option>
                                </select>
                                {!unlimitedPages && (
                                    <>
                                        <input
                                            type="number"
                                            min="1"
                                            max="1000"
                                            value={maxPages}
                                            onChange={(e) => setMaxPages(parseInt(e.target.value) || 50)}
                                            className="w-20 rounded-lg border border-neutral-500 px-2 py-1 text-neutral-900 text-sm focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Maximum URLs to extract from sitemap
                                        </span>
                                    </>
                                )}
                                {unlimitedPages && (
                                    <span className="text-sm text-red-500">
                                       Not recommended for large sitemaps
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                {isSitemap && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 ml-5">
                        💡 Common formats: website.com/sitemap.xml, domain.org/sitemap_index.txt
                    </div>
                )}
            </div>
        
            {(urlError || urlWarning) && 
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md">
              {urlError &&
              <p className="text-xs text-red-600 dark:text-red-400 flex items-start">
                          <IconAlertTriangle className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                          <span className='mt-1'>{urlError}</span>
                </p>}
              {urlWarning &&
              <p className="text-xs text-yellow-500 flex items-start">
                          <IconAlertTriangle className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                          <span className='mt-1'>{urlWarning}</span>
                </p>}
            </div>}
        
            {/* Sitemap URL Selection Modal */}
            {showSitemapModal && sitemapData && (
                <SitemapUrlSelectionModal
                    sitemapUrl={pendingSitemapUrl}
                    urls={sitemapUrls}
                    totalUrls={sitemapData.totalUrls}
                    maxPages={sitemapData.maxPages}
                    onConfirm={handleSitemapConfirm}
                    onCancel={handleSitemapCancel}
                />
            )}
        </form>
    );
};


// Website scan scheduler interface and component
interface WebsiteScanSchedule {
  enabled: boolean;
  frequency: 'none' | 'daily' | 'weekly' | 'monthly';
  scanFrequency: number | null; // days between scans
  maxPages?: number; // for sitemaps only
}

interface WebsiteScanSchedulerProps {
  initAssistantDefintion: AssistantDefinition;
  websiteUrls: any[];
  onUpdateWebsiteUrl: (urlItem: any, updates: any) => void;
}

// Component for managing website scan schedules
export const WebsiteScanScheduler: React.FC<WebsiteScanSchedulerProps> = ({ initAssistantDefintion, websiteUrls, onUpdateWebsiteUrl }) => {
  const [showScheduler, setShowScheduler] = useState(false);
  
  const getScheduleFromWebsiteUrl = (urlItem: any): WebsiteScanSchedule => {
    const scanFrequency = urlItem.scanFrequency;
    return {
      enabled: scanFrequency !== null,
      frequency: scanFrequency === 1 ? 'daily' : 
                 scanFrequency === 7 ? 'weekly' : 
                 scanFrequency === 30 ? 'monthly' : 'none',
      scanFrequency: scanFrequency,
      maxPages: urlItem.maxPages
    };
  };

  const updateScheduleForWebsiteUrl = (urlItem: any, schedule: WebsiteScanSchedule) => {
    const updates: any = {
      scanFrequency: schedule.enabled ? schedule.scanFrequency : null,
      ...(urlItem.isSitemap && schedule.maxPages !== undefined && { maxPages: schedule.maxPages })
    };
    onUpdateWebsiteUrl(urlItem, updates);
  };

  const getScheduleDescription = (schedule: WebsiteScanSchedule): string => {
    if (!schedule.enabled || schedule.frequency === 'none') {
      return 'One-time scan only';
    }
    return `Rescan every${schedule.scanFrequency !== 1 ? ` ${schedule.scanFrequency} days` : ' day'}`;
  };

  const formatLastScanned = (lastScanned: string | null): string => {
    if (!lastScanned) return 'Never scanned';
    
    try {
      // Treat the timestamp as UTC by appending 'Z' if not present
      const utcTimestamp = lastScanned.endsWith('Z') ? lastScanned : lastScanned + 'Z';
      const date = new Date(utcTimestamp);
      
      // Check for invalid date
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      } else {
        return 'Today';
      }
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (websiteUrls.length === 0) return null;

  return (
    <>
      <div className="relative flex justify-end mb-2">
        <SchedulerAlarmButton
          onClick={() => setShowScheduler(!showScheduler)}
          isActive={websiteUrls.some(urlItem => urlItem.scanFrequency !== null)}
          title="Configure website scan schedules"
        />

        <SchedulerPanel
          isOpen={showScheduler}
          onClose={() => setShowScheduler(false)}
          title="Website Scan Schedule"
          className="w-96"
          isLoading={false}
          scheduleDescription={undefined}
          scheduledTaskId={initAssistantDefintion.data?.scheduledTaskIds?.websites}
        >
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {websiteUrls.map((urlItem) => {
              const schedule = getScheduleFromWebsiteUrl(urlItem);
              return (
                <div key={urlItem.sourceUrl} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-3">
                    {urlItem.isSitemap ? 
                      <IconSitemap size={16} className="text-blue-500 mt-1 flex-shrink-0" /> :
                      <IconWorld size={16} className="text-blue-500 mt-1 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {urlItem.sourceUrl ?? urlItem.url}
                      </div>
                      {urlItem.isSitemap && 
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Sitemap
                      </div>}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Checkbox
                      id={`enable-scan-${urlItem.sourceUrl}`}
                      checked={schedule.enabled}
                      onChange={(checked) => {
                        const newSchedule: WebsiteScanSchedule = {
                          ...schedule,
                          enabled: checked,
                          frequency: checked ? (schedule.frequency === 'none' ? 'weekly' : schedule.frequency) : 'none',
                          scanFrequency: checked ? (schedule.scanFrequency || 7) : null
                        };
                        updateScheduleForWebsiteUrl(urlItem, newSchedule);
                      }}
                      label="Enable Automatic Rescanning"
                    />

                    {schedule.enabled && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Frequency
                          </label>
                          <select
                            value={schedule.frequency}
                            onChange={(e) => {
                              const frequency = e.target.value as WebsiteScanSchedule['frequency'];
                              const scanFrequency = 
                                frequency === 'daily' ? 1 :
                                frequency === 'weekly' ? 7 :
                                frequency === 'monthly' ? 30 : null;
                              
                              const newSchedule: WebsiteScanSchedule = { ...schedule, frequency, scanFrequency };
                              updateScheduleForWebsiteUrl(urlItem, newSchedule);
                            }}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#40414F] text-gray-900 dark:text-white text-sm"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>

                        {/* {urlItem.isSitemap && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Max Pages
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="1000"
                              value={schedule.maxPages || 10}
                              onChange={(e) => {
                                const maxPages = parseInt(e.target.value) || 10;
                                const newSchedule = { ...schedule, maxPages };
                                updateScheduleForWebsiteUrl(urlItem, newSchedule);
                              }}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#40414F] text-gray-900 dark:text-white text-sm"
                              placeholder="10"
                            />
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Maximum URLs to extract from sitemap
                            </div>
                          </div>
                        )} */}
                      </>
                    )}

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <IconClock size={14} />
                        <span>{getScheduleDescription(schedule)}</span>
                      </div>
                      {urlItem.lastScanned && <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="ml-6">Last scanned: {formatLastScanned(urlItem.lastScanned)}</span>
                      </div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SchedulerPanel>
      </div>
    </>
  );
};