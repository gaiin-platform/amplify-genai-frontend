import { IconArrowBarLeft, IconArrowBarRight } from '@tabler/icons-react';

interface Props {
  onClick: any;
  side: 'left' | 'right';
  isSidebarOpen?: boolean;
}

export const CloseSidebarButton = ({ onClick, side, isSidebarOpen }: Props) => {
  const position = side === 'right' ? 'right' : 'left';
  const offset = isSidebarOpen ? '280px' : '2';
  
  return (
    <>
      <button
        className={`h-7 w-7 hover:text-gray-400 dark:text-white dark:hover:text-gray-300`}
        onClick={onClick}
      >
        {side === 'right' ? <IconArrowBarRight /> : <IconArrowBarLeft />}
      </button>
      <div onClick={onClick} className="relative"></div>
    </>
  );
};

export const OpenSidebarButton = ({ onClick, side, isSidebarOpen }: Props) => {
  const position = side === 'right' ? 'right' : 'left';
  const offset = isSidebarOpen ? '280px' : '2';
  
  return (
    <>
      <button
        className={`h-7 w-7 text-white hover:text-gray-400 dark:text-white dark:hover:text-gray-300`}
        onClick={onClick}
      >
        {side === 'right' ? <IconArrowBarLeft /> : <IconArrowBarRight />}
      </button>
        <div onClick={onClick} className="relative"></div>
    </>
  );
};
