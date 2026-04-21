import React from 'react';
import { LoadingIcon } from '../Loader/LoadingIcon';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  loadingText = 'Loading...',
  icon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      disabled={loading || disabled}
      className={`flex items-center justify-center gap-2 transition-all duration-200 ${
        loading ? 'opacity-70 cursor-not-allowed' : ''
      } ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <LoadingIcon />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};