import React, { useState, useRef, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { IconLogout, IconUser } from '@tabler/icons-react';

interface UserAvatarProps {
  email: string | null | undefined;
  name?: string | null;
  cognitoDomain?: string;
  cognitoClientId?: string;
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
  cognitoClientId
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
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
    <div className="relative">
      <button
        ref={buttonRef}
        className="flex items-center justify-center rounded-full focus:outline-none transition-transform duration-300 hover:scale-110"
        onClick={() => setShowDropdown(!showDropdown)}
        title={displayName}
        style={{
          backgroundColor,
          width: '36px',
          height: '36px',
          boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
          border: '2px solid rgba(255, 255, 255, 0.7)',
        }}
      >
        <span className="text-white font-semibold text-sm">
          {initials}
        </span>
      </button>
      
      {showDropdown && (
        <div 
          ref={dropdownRef}
          className="absolute right-0 mt-2 py-2 w-48 bg-white dark:bg-[#343541] rounded-md shadow-xl z-50 border border-gray-200 dark:border-gray-600 animate-fade-in"
          style={{
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)',
            transformOrigin: 'top right',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div className="px-4 py-3 text-sm text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600">
            <div className="font-semibold truncate">{displayName}</div>
            <div className="truncate text-gray-500 dark:text-gray-400 text-xs">{email}</div>
          </div>
          
          <div className="py-1">
            <button
              onClick={federatedSignOut}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <IconLogout size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;