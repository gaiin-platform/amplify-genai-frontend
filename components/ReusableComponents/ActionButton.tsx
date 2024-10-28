import { MouseEventHandler, ReactElement } from 'react';

interface Props {
  handleClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactElement;
  title?: string;
}

const ActionButton = ({ handleClick, children, title }: Props) => (
  <button
    className="min-w-[20px] p-1 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
    onClick={handleClick}
    title={title}
  >
    {children}
  </button>
);

export default ActionButton;
