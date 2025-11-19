import { FC } from 'react';

interface Props {
  text: string;
  icon: JSX.Element;
  onClick: () => void;
  disabled?: boolean;
}

export const SidebarButton: FC<Props> = ({ text, icon, onClick, disabled }) => {
  return (
    <button
      disabled={disabled}
      id="sideBarButton"
      className="group flex w-full cursor-pointer select-none items-center gap-3 rounded-md py-3 px-3 text-[14px] leading-3 dark:text-white transition-colors duration-200 hover:bg-neutral-200 dark:hover:bg-brand-dark-bg/90" 
      onClick={onClick}
    >
      <div className="icon-pop-group">{icon}</div>
      <span>{text}</span>
    </button>
  );
};
