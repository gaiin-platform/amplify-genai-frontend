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
        className={`fixed top-50 ${
          side === 'right' ? 'right-[280px]' : 'left-[280px]'
        } z-50 h-7 w-7 hover:text-gray-400 dark:text-neutral-200 dark:hover:text-gray-300 sm:top-25 sm:${
          side === 'right' ? 'right-[280px]' : 'left-[280px]'
        } sm:h-8 sm:w-8 sm:text-neutral-700`}
        onClick={onClick}
        title="Collapse Sidebar"
      >
        {side === 'right' ? <IconArrowBarRight /> : <IconArrowBarLeft />}
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
      className={`fixed top-50 ${
        side === 'right' ? 'right-2' : 'left-2'
      } z-50 h-7 w-7 text-white hover:text-gray-400 dark:text-neutral-200 dark:hover:text-gray-300 sm:top-25 sm:${
        side === 'right' ? 'right-2' : 'left-2'
      } sm:h-8 sm:w-8 sm:text-neutral-700`}
      onClick={onClick}
      title="Expand Sidebar"
      disabled={isDisabled}
    > 
      { !isDisabled && (side === 'right' ? <IconArrowBarLeft /> : <IconArrowBarRight />)}
    </button>
  );
};
