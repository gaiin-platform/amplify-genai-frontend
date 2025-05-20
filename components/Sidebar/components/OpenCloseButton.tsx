import { IconArrowBarLeft, IconArrowBarRight } from '@tabler/icons-react';
import React from 'react';

interface Props {
  onClick: any;
  side: 'left' | 'right';
  isDisabled?:boolean;
}

export const CloseSidebarButton = ({ onClick, side, isDisabled}: Props) => {
  return (
    <>
      <button
        className={`fixed top-5 ${
          side === 'right' ? 'right-[280px]' : 'left-[280px]'
        } z-50 h-8 w-8 rounded-full bg-white dark:bg-[#343541] shadow-md dark:shadow-gray-900/50 text-blue-500
        hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:text-blue-400
        transition-all duration-300 ease-in-out sm:top-1 sm:${
          side === 'right' ? 'right-[280px]' : 'left-[280px]'
        } transform hover:scale-110 hover:rotate-[360deg] hover:animate-glow`}
        onClick={onClick}
        title="Collapse Sidebar"
        id="collapseSidebar"
      >
        {side === 'right' ? <IconArrowBarRight className="m-auto" /> : <IconArrowBarLeft className="m-auto" />}
      </button>
      <div
        onClick={onClick}
        className="absolute top-0 left-0 z-10 h-full w-full bg-black opacity-70 sm:hidden"
      ></div>
    </>
  );
};

export const OpenSidebarButton = ({ onClick, side, isDisabled }: Props) => {
  return (
    <button
      className={`fixed top-2.5 ${
        side === 'right' ? 'right-3' : 'left-3'
      } z-50 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 
      text-white shadow-lg hover:shadow-blue-500/30 dark:hover:shadow-blue-500/50 
      transition-all duration-300 sm:top-2 sm:${
        side === 'right' ? 'right-3' : 'left-3'
      } ${isDisabled ? 'opacity-0' : 'opacity-100 hover:scale-110 hover:rotate-[360deg]'}`}
      onClick={onClick}
      title="Expand Sidebar"
      disabled={isDisabled}
    > 
      <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-pulse"></div>
      { !isDisabled && (
        <div className="flex items-center justify-center h-full w-full">
          {side === 'right' ? 
            <IconArrowBarLeft className="filter drop-shadow-md transform transition-transform duration-300" /> : 
            <IconArrowBarRight className="filter drop-shadow-md transform transition-transform duration-300" />
          }
        </div>
      )}
    </button>
  );
};
