import React, { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { IconLogout, IconUser, IconCreditCard, IconSettings } from '@tabler/icons-react';
import { doMtdCostOp } from '@/services/mtdCostService';
import ColorPaletteSelector from './ColorPaletteSelector';

interface UserAvatarProps {
  email: string | null | undefined;
  name?: string | null;
  cognitoDomain?: string;
  cognitoClientId?: string;
  showMtdCost?: boolean;
  onSettingsClick?: () => void;
}

const getInitials = (email: string | null | undefined): string => {
  if (!email) return '?';
  
  // Try to extract a name from the email
  const name = email.split('@')[0];
  
  // Split by common separators (., _, -, +)
  const parts = name.split(/[._\-+]/);
  
  if (parts.length >= 2) {
    // If we have at least two parts, take first letter of first and last part
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else {
    // Otherwise, take the first two letters of the name
    return name.substring(0, 2).toUpperCase();
  }
};

// Function to generate a consistent color from a string
const getAvatarColor = (email: string | null | undefined): string => {
  if (!email) return '#6366f1'; // Default indigo color
  
  // Simple hash function to generate a number from the email
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  // Color palette - attractive, accessible colors
  const colors = [
    '#f43f5e', // rose
    '#8b5cf6', // violet
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#6366f1', // indigo
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#8b5cf6', // purple
  ];
  
  // Use hash to pick a color from the palette
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  email, 
  name,
  cognitoDomain,
  cognitoClientId,
  showMtdCost = true,
  onSettingsClick
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mtdCost, setMtdCost] = useState<string>('$0.00');
  
  const initials = getInitials(email);
  const backgroundColor = getAvatarColor(email);
  const displayName = name || email?.split('@')[0] || 'User';
  
  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current && 
      buttonRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      !buttonRef.current.contains(event.target as Node)
    ) {
      setShowDropdown(false);
    }
  };
  
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  useEffect(() => {
    if (showMtdCost && email) {
      let isFetching = false;

      const fetchMtdCost = async () => {
        if (isFetching) return;

        isFetching = true;

        try {
          const result = await doMtdCostOp(email || '');
          if (result && "MTD Cost" in result && result["MTD Cost"] !== undefined) {
            setMtdCost(`$${result["MTD Cost"].toFixed(2)}`);
          } else {
            setMtdCost('$0.00');
          }
        } catch (error) {
          console.error("Error fetching MTD cost:", error);
          setMtdCost('$0.00');
        } finally {
          isFetching = false;
        }
      };

      fetchMtdCost();

      return () => {
        isFetching = false;
      };
    }
  }, [email, showMtdCost]);
  
  const federatedSignOut = async () => {
    await signOut();
    // Handle Cognito logout if needed
    if (cognitoDomain && cognitoClientId) {
      const signoutRedirectUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;
      window.location.replace(
        `${cognitoDomain}/logout?client_id=${cognitoClientId}&logout_uri=${encodeURIComponent(signoutRedirectUrl)}`
      );
    }
  };
  
  return (
    <div className="relative flex items-center">
      <button
        ref={buttonRef}
        className="flex items-center justify-center rounded-full focus:outline-none transition-all duration-300 hover:scale-110 hover:shadow-lg"
        onClick={() => setShowDropdown(!showDropdown)}
        title={displayName}
        style={{
          backgroundColor,
          width: '32px',
          height: '32px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '2px solid rgba(255, 255, 255, 0.8)',
          transform: showDropdown ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <span className="text-white font-semibold text-sm sidebar-text" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
          {initials}
        </span>
      </button>
      
      {showDropdown && (
        <div 
          ref={dropdownRef}
          className="absolute right-0 top-full mt-3 py-2 w-52 bg-white dark:bg-[#202123] rounded-lg z-50 border border-neutral-200 dark:border-neutral-600 fade-in"
          style={{
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            transformOrigin: 'top right',
          }}
        >
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-600/50">
            <div className="sidebar-title truncate text-neutral-800 dark:text-neutral-100 mb-0.5">{displayName}</div>
            <div className="truncate text-neutral-500 dark:text-neutral-400 text-xs font-medium">{email}</div>
          </div>
          
          {showMtdCost && (
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-600/50">
              <div className="flex items-center gap-2 mb-1.5">
                <IconCreditCard size={16} className="enhanced-icon text-blue-500" />
                <div className="sidebar-text font-medium text-neutral-700 dark:text-neutral-300">Month-To-Date Cost</div>
              </div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400 text-center transition-all duration-300 hover:scale-105" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                {mtdCost}
              </div>
            </div>
          )}
          
          <ColorPaletteSelector />
          
          <div className="py-1">
            <button
              onClick={() => {
                if (onSettingsClick) {
                  onSettingsClick();
                  setShowDropdown(false);
                } else {
                  console.log('Settings clicked - no handler provided');
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#343541]/90 transition-all duration-200"
            >
              <IconSettings size={16} className="enhanced-icon text-neutral-700 dark:text-neutral-200" />
              <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Settings</span>
            </button>
            <button
              onClick={federatedSignOut}
              className="flex w-full items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#343541]/90 transition-all duration-200"
            >
              <IconLogout size={16} className="enhanced-icon text-neutral-700 dark:text-neutral-200" />
              <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;