// components/DataSources/WebsiteURLInput.tsx
import React, { useState } from 'react';
import { IconSitemap, IconClock, IconWorld, IconAlertTriangle} from '@tabler/icons-react';
import Checkbox from '../ReusableComponents/CheckBox';
import { AttachedDocument } from '@/types/attacheddocument';
import { SchedulerPanel, SchedulerAlarmButton } from '@/components/ReusableComponents/SchedulerPanel';
import { AssistantDefinition } from '@/types/assistant';


export const isWebsiteDs = (document: AttachedDocument) => {
    return ['website/url', 'website/sitemap'].includes(document.type);
}

interface WebsiteURLInputProps {
    onAddURL: (url: string, isSitemap: boolean) => void;
}

export const WebsiteURLInput: React.FC<WebsiteURLInputProps> = ({ onAddURL }) => {
    const [url, setUrl] = useState('');
    const [isSitemap, setIsSitemap] = useState(false);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [urlWarning, setUrlWarning] = useState<string | null>(null);

    // URL validation and sanitization
    const sanitizeUrl = (inputUrl: string): string => {
        let cleanUrl = inputUrl.trim();
        
        // Remove common prefixes people might accidentally include
        cleanUrl = cleanUrl.replace(/^(url:|link:|website:)/i, '');
        cleanUrl = cleanUrl.trim();
        
        // If no protocol is specified, assume https://
        if (!/^https?:\/\//i.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
        }
        
        return cleanUrl;
    };

    const validateUrl = (inputUrl: string): { isValid: boolean; error?: string; sanitizedUrl?: string; warning?: string } => {
        if (!inputUrl.trim()) {
            return { isValid: false, error: 'URL is required' };
        }

        const sanitizedUrl = sanitizeUrl(inputUrl);
        
        try {
            const urlObj = new URL(sanitizedUrl);
            
            // Check for valid protocols
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return { isValid: false, error: 'URL must use http:// or https://' };
            }
            
            // Check for valid hostname
            if (!urlObj.hostname || urlObj.hostname.length === 0) {
                return { isValid: false, error: 'URL must have a valid domain name' };
            }
            
            // Check for spaces in hostname (invalid)
            if (urlObj.hostname.includes(' ')) {
                return { isValid: false, error: 'Domain name cannot contain spaces' };
            }
            
            const hostname = urlObj.hostname.toLowerCase();
            
            // Allow localhost
            if (hostname === 'localhost') {
                return { isValid: true, sanitizedUrl };
            }
            
            // Allow IP addresses (IPv4)
            const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (ipv4Regex.test(hostname)) {
                // Validate IP address ranges (0-255)
                const parts = hostname.split('.');
                for (const part of parts) {
                    const num = parseInt(part);
                    if (num < 0 || num > 255) {
                        return { isValid: false, error: 'Invalid IP address' };
                    }
                }
                return { isValid: true, sanitizedUrl };
            }
            
            // For regular domains, require proper structure
            if (!hostname.includes('.')) {
                return { isValid: false, error: 'Domain must have a top-level domain (e.g., .com, .org)' };
            }
            
            const domainParts = hostname.split('.');
            
            // Check that no part is empty (handles cases like example..com)
            if (domainParts.some(part => part.length === 0)) {
                return { isValid: false, error: 'Invalid domain format' };
            }
            
            // Check TLD (last part) is valid
            const tld = domainParts[domainParts.length - 1];
            if (tld.length < 2 || !/^[a-z]+$/i.test(tld)) {
                return { isValid: false, error: 'Invalid top-level domain (must be at least 2 letters)' };
            }
            
            // Check domain name parts contain only valid characters
            const domainRegex = /^[a-z0-9-]+$/i;
            for (let i = 0; i < domainParts.length - 1; i++) {
                const part = domainParts[i];
                if (!domainRegex.test(part) || part.startsWith('-') || part.endsWith('-')) {
                    return { isValid: false, error: 'Domain contains invalid characters' };
                }
            }
            
            // Sitemap-specific validation
            if (isSitemap) {
                const path = urlObj.pathname.toLowerCase();
                const urlLower = sanitizedUrl.toLowerCase();
                
                // Common sitemap patterns
                const sitemapPatterns = [
                    /\/sitemap\.xml$/,
                    /\/sitemap_index\.xml$/,
                    /\/sitemap-index\.xml$/,
                    /\/sitemaps\/.*\.xml$/,
                    /\/sitemap\/.*\.xml$/,
                    /\/sitemap.*\.xml$/,
                    /\/.*sitemap.*\.xml$/,
                    /robots\.txt$/
                ];
                
                const hasValidPattern = sitemapPatterns.some(pattern => pattern.test(path));
                const isXmlFile = path.endsWith('.xml');
                const containsSitemap = urlLower.includes('sitemap');
                const isRobotsTxt = path.includes('robots.txt');
                
                // If none of the common patterns match, show warning
                if (!hasValidPattern && !isXmlFile && !containsSitemap && !isRobotsTxt) {
                    return { 
                        isValid: true, 
                        sanitizedUrl,
                        warning: 'This URL doesn\'t look like a typical sitemap. Sitemaps usually end with .xml or contain "sitemap" in the path.'
                    };
                }
            }
            
            return { isValid: true, sanitizedUrl };
            
        } catch (error) {
            return { isValid: false, error: 'Please enter a valid URL (e.g., https://example.com)' };
        }
    };

    const handleUrlChange = (value: string) => {
        setUrl(value);
        // Clear error and warning when user starts typing
        if (urlError) setUrlError(null);
        if (urlWarning) setUrlWarning(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const validation = validateUrl(url);
        
        if (!validation.isValid) {
            setUrlError(validation.error || 'Invalid URL');
            setUrlWarning(null);
            return;
        }
        
        if (validation.sanitizedUrl) {
            // Handle warning if present
            setUrlWarning(validation.warning || null);
            setUrlError(null);
            
            onAddURL(validation.sanitizedUrl, isSitemap);
            setUrl('');
            setIsSitemap(false);
        }
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
                    className="rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 dark:hover:bg-[#343541]"
                >
                    Add URL
                </button>
            </div>
            <div className="flex items-center gap-3">
                <Checkbox
                    id="sitemap-checkbox"
                    label="This is a sitemap URL"
                    checked={isSitemap}
                    onChange={setIsSitemap}
                />
               <IconSitemap className="-mt-1 -ml-1" size={16} />
               {isSitemap && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        💡 Common formats: webitsite.com/sitemap.xml, domain.org/sitemap_index.txt
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

                        {urlItem.isSitemap && (
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
                        )}
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