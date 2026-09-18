/**
 * LibraryView — full-pane view of the user's previously uploaded documents.
 * Reuses the existing DataSourcesTable component (same as "Your Files" in the old UI).
 * Opened by clicking "Library" in the new sidebar.
 */
import React, { useContext } from 'react';
import { IconX } from '@tabler/icons-react';
import HomeContext from '@/pages/api/home/home.context';
import DataSourcesTable from '@/components/DataSources/DataSourcesTable';

export const LibraryView: React.FC = () => {
  const { dispatch } = useContext(HomeContext);

  return (
    <div
      className="flex-1 flex flex-col bg-[--bg-app] overflow-hidden"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* Page header */}
      <div className="flex items-center justify-between px-8 pt-10 pb-6 flex-shrink-0">
        <h1
          className="text-[28px] text-[--text-primary] font-normal leading-none tracking-[-0.01em]"
          style={{ fontFamily: '"Newsreader", "Georgia", serif' }}
        >
          Library
        </h1>
        <button
          onClick={() => dispatch({ field: 'page', value: 'chat' })}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors"
          title="Close"
        >
          <IconX size={16} />
        </button>
      </div>

      {/* Files table — reusing the existing component */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        <DataSourcesTable />
      </div>
    </div>
  );
};

export default LibraryView;
