import React, { useState, useRef, useEffect, useContext } from 'react';
import { signOut } from 'next-auth/react';
import { IconLogout, IconCreditCard, IconRocket, IconShare, IconTools, IconUsers, IconShield, IconSun, IconMoon, IconX, IconCurrencyDollar } from '@tabler/icons-react';
import { doMtdCostOp } from '@/services/mtdCostService';
import ColorPaletteSelector from './ColorPaletteSelector';
import HomeContext from '@/pages/api/home/home.context';

interface UserMenuProps {
  email: string | null | undefined;
  name?: string | null;
  cognitoDomain?: string;
  cognitoClientId?: string;
  showMtdCost?: boolean;
  onSettingsClick?: () => void;
  onDataSourcesClick?: () => void;
  onSharingClick?: () => void;
  onAssistantsAdminClick?: () => void;
  onAdminClick?: () => void;
  onUserCostsClick?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ 
  email, 
  name,
  cognitoDomain,
  cognitoClientId,
  showMtdCost = true,
  onSettingsClick,
  onDataSourcesClick,
  onSharingClick,
  onAssistantsAdminClick,
  onAdminClick,
  onUserCostsClick
}) => {
  const { dispatch, state: { lightMode, showUserMenu } } = useContext(HomeContext);
  const [mtdCost, setMtdCost] = useState<string>('$0.00');
  const menuRef = useRef<HTMLDivElement>(null);
  
  const displayName = name || email?.split('@')[0] || 'User';
  
  const handleClose = () => {
    dispatch({ field: 'showUserMenu', value: false });
  };
  
  const handleConfigurationClick = () => {
    dispatch({ field: 'showUnifiedSettings', value: true });
    handleClose();
  };

  const handleThemeToggle = () => {
    const newTheme = lightMode === 'dark' ? 'light' : 'dark';
    dispatch({ field: 'lightMode', value: newTheme });
  };
  
  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      handleClose();
    }
  };
  
  useEffect(() => {
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUserMenu]);
  
  useEffect(() => {
    if (showMtdCost && email && showUserMenu) {
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
  }, [email, showMtdCost, showUserMenu]);
  
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

  if (!showUserMenu) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-end p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-25"
        onClick={handleClose}
      />
      
      {/* Menu */}
      <div 
        ref={menuRef}
        className="relative mt-8 mr-4 py-2 w-52 bg-white dark:bg-[#202123] rounded-lg border border-neutral-200 dark:border-neutral-600 shadow-xl"
        style={{
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          title="Close menu"
        >
          <IconX size={16} className="text-neutral-500 dark:text-neutral-400" />
        </button>

        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-600/50 pr-10">
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
        
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-600/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-300">
                Theme
              </span>
            </div>
            <div className="relative">
              <button
                onClick={handleThemeToggle}
                className="relative flex items-center w-16 h-8 bg-neutral-200 dark:bg-neutral-600 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                title={`Switch to ${lightMode === 'dark' ? 'light' : 'dark'} mode`}
              >
                {/* Toggle slider */}
                <div
                  className={`absolute w-7 h-7 bg-white dark:bg-neutral-300 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${
                    lightMode === 'dark' ? 'translate-x-8' : 'translate-x-0.5'
                  }`}
                >
                  {lightMode === 'dark' ? (
                    <IconMoon size={14} className="text-blue-600" />
                  ) : (
                    <IconSun size={14} className="text-amber-600" />
                  )}
                </div>
                
                {/* Background icons */}
                <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
                  <IconSun size={12} className={`transition-opacity duration-300 ${lightMode === 'light' ? 'opacity-0' : 'opacity-40 text-amber-300'}`} />
                  <IconMoon size={12} className={`transition-opacity duration-300 ${lightMode === 'dark' ? 'opacity-0' : 'opacity-40 text-blue-300'}`} />
                </div>
              </button>
            </div>
          </div>
        </div>
        
        <ColorPaletteSelector />
        
        <div className="py-1">
          {onSharingClick && (
            <button
              onClick={() => {
                onSharingClick();
                handleClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#343541]/90 transition-all duration-200"
            >
              <IconShare size={16} className="enhanced-icon text-green-500" />
              <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Sharing</span>
            </button>
          )}
          {onDataSourcesClick && (
            <button
              onClick={() => {
                onDataSourcesClick();
                handleClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#343541]/90 transition-all duration-200"
            >
              <IconRocket size={16} className="enhanced-icon text-blue-500" />
              <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">My Data</span>
            </button>
          )}
          {onAdminClick && (
            <button
              onClick={() => {
                onAdminClick();
                handleClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#343541]/90 transition-all duration-200"
            >
              <IconShield size={16} className="enhanced-icon text-red-500" />
              <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Admin</span>
            </button>
          )}
          {onUserCostsClick && (
            <button
              onClick={() => {
                onUserCostsClick();
                handleClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#343541]/90 transition-all duration-200"
            >
              <IconCurrencyDollar size={16} className="enhanced-icon text-green-500" />
              <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">User Costs</span>
            </button>
          )}
          {onAssistantsAdminClick && (
            <button
              onClick={() => {
                onAssistantsAdminClick();
                handleClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#343541]/90 transition-all duration-200"
            >
              <IconUsers size={16} className="enhanced-icon text-orange-500" />
              <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Assistants Admin</span>
            </button>
          )}
          <button
            onClick={handleConfigurationClick}
            className="flex w-full items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#343541]/90 transition-all duration-200"
          >
            <IconTools size={16} className="enhanced-icon text-purple-500" />
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
    </div>
  );
};

export default UserMenu;