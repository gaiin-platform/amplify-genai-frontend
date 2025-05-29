import React, { useContext } from 'react';
import HomeContext from '@/pages/api/home/home.context';

interface UserAvatarProps {
  email: string | null | undefined;
  name?: string | null;
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
  name
}) => {
  const { dispatch } = useContext(HomeContext);

  const initials = getInitials(email);
  const backgroundColor = getAvatarColor(email);
  const displayName = name || email?.split('@')[0] || 'User';

  return (
    <button
      className="flex items-center justify-center rounded-full focus:outline-none transition-all duration-300 hover:scale-110 hover:shadow-lg"
      onClick={() => dispatch({ field: 'showUserMenu', value: true })}
      title={displayName}
      style={{
        backgroundColor,
        width: '32px',
        height: '32px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '2px solid rgba(255, 255, 255, 0.8)',
      }}
    >
      <span className="text-white font-semibold text-sm sidebar-text" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
        {initials}
      </span>
    </button>
  );
};

export default UserAvatar;
