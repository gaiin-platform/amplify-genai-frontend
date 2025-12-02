import React, { useEffect } from 'react';
import Head from 'next/head';
import { Theme } from '@/types/settings';
import { ThemeService } from '@/utils/whiteLabel/themeService';

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  theme?: Theme;
  showLeftSidebar?: boolean;
  showRightSidebar?: boolean;
  leftSidebar?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  header?: React.ReactNode;
}

/**
 * MainLayout provides a consistent layout structure for the application
 * that matches the structure of the home page. This ensures consistency
 * across different pages.
 */
const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  title,
  description = 'Amplify GenAI',
  theme = 'dark',
  showLeftSidebar = true,
  showRightSidebar = true,
  leftSidebar,
  rightSidebar,
  header
}) => {
  
  // Apply theme class to document when theme changes
  // Only apply if not already initialized by _app.tsx to avoid duplicate application
  useEffect(() => {
    if (!document.documentElement.classList.contains('light') && 
        !document.documentElement.classList.contains('dark')) {
      ThemeService.applyTheme(theme);
    }
  }, [theme]);
  
  
  return (
    <div className={`flex flex-col h-screen w-screen ${theme}`}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta 
          name="viewport" 
          content="height=device-height, width=device-width, initial-scale=1, user-scalable=no" 
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      

      <div className="flex flex-1 h-full overflow-hidden">
        {/* Left Sidebar */}
        {showLeftSidebar && (
          <div className="hidden sm:block sm:w-64 bg-gray-50 dark:bg-[#202123] border-r border-neutral-300 dark:border-neutral-800">
            {leftSidebar}
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {header && (
            <header className="border-b border-neutral-200 dark:border-neutral-600 bg-white dark:bg-[#343541] py-4 px-6 flex justify-between items-center">
              <div className="flex items-center justify-between w-full">
                <div>{header}</div>
              </div>
            </header>
          )}
          {children}
        </div>

        {/* Right Sidebar */}
        {showRightSidebar && (
          <div className="hidden sm:block sm:w-64 bg-gray-50 dark:bg-[#202123] border-l border-neutral-300 dark:border-neutral-800">
            {rightSidebar}
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout; 