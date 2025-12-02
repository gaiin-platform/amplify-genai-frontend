import React, { useState, useRef, useEffect, useContext } from 'react';
import { signOut } from 'next-auth/react';
import { IconLogout, IconCreditCard, IconRocket, IconShare, IconTools, IconUsers, IconShield, IconSun, IconMoon, IconX, IconCurrencyDollar, IconUser, IconSettings, IconHelp, IconLoader2 } from '@tabler/icons-react';
import { doMtdCostOp } from '@/services/mtdCostService';
import ColorPaletteSelector, { COLOR_PALETTES } from './ColorPaletteSelector';
import HomeContext from '@/pages/api/home/home.context';
import { AssistantAdminUI } from '../Admin/AssistantAdminUI';
import { AdminUI } from '../Admin/AdminUI';
import { UserCostsModal } from '../Admin/UserCostModal';
import { SettingDialog } from '../Settings/SettingDialog';
import { getSettings } from '@/utils/app/settings';
import { Settings } from '@/types/settings';
import SharingDialog from '../Share/SharingDialog';
import { ThemeService } from '@/utils/whiteLabel/themeService';
import { Theme } from '@/types/settings';


interface UserMenuProps {
  email: string | null | undefined;
  name?: string | null;
  cognitoDomain?: string;
  cognitoClientId?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({ 
  email, 
  name,
  cognitoDomain,
  cognitoClientId,
}) => {
  const { dispatch, state: { lightMode, showUserMenu, featureFlags, supportEmail }, dispatch: homeDispatch } = useContext(HomeContext);
  const [mtdCost, setMtdCost] = useState<string>('0');
  const [currentPalette, setCurrentPalette] = useState<string>('warm-browns');
  const [currentTone, setCurrentTone] = useState<'userPrimary' | 'userSecondary' | 'assistantPrimary' | 'assistantSecondary'>('userPrimary');
  const menuRef = useRef<HTMLDivElement>(null);
  const settingsActiveTab = useRef<string | undefined>(undefined);

  const displayName = name || email?.split('@')[0] || 'User';

  const featureFlagsRef = useRef(featureFlags);

  useEffect(() => {
      featureFlagsRef.current = featureFlags;
      window.dispatchEvent(new Event('updateFeatureSettings'));
  }, [featureFlags]);

   const showMtdCost = featureFlagsRef.current.mtdCost
   
   let settingRef = useRef<Settings | null>(null);
    // prevent recalling the getSettings function
    if (settingRef.current === null) settingRef.current = getSettings(featureFlags);


   const [showAssistantAdmin, setShowAssistantAdmin] = useState<boolean>(false);
   const [astGroupModalData, setAstGroupModalData] = useState<any>(undefined);
   const [showAdminInterface, setShowAdminInterface] = useState<boolean>(false);
   const [showUserCosts, setShowUserCosts] = useState<boolean>(false);
   const [showSettings, setShowSettings] = useState<boolean>(false);
   const [showSharingDialog, setShowSharingDialog] = useState<boolean>(false);


    useEffect(() => {
        const handleAstAdminEvent = (event:any) => {
            if (!featureFlagsRef.current.assistantAdminInterface) return;
            const isAstAdminOpen = event.detail.isOpen;
            setAstGroupModalData(event.detail.data);
            setShowAssistantAdmin(isAstAdminOpen);  
        };

        window.addEventListener('openAstAdminInterfaceTrigger', handleAstAdminEvent);

        return () => {
            window.removeEventListener('openAstAdminInterfaceTrigger', handleAstAdminEvent);

        };
    }, []);


  // Initialize current palette and tone from localStorage
  useEffect(() => {
    const savedPalette = localStorage.getItem('chatColorPalette') || 'warm-browns';
    const savedTone = localStorage.getItem('avatarColorTone') || 'userPrimary';
    setCurrentPalette(savedPalette);
    setCurrentTone(savedTone as 'userPrimary' | 'userSecondary' | 'assistantPrimary' | 'assistantSecondary');
  }, []);

  const handleToggleMenu = () => {
    dispatch({ field: 'showUserMenu', value: !showUserMenu });
  };

  const handleClose = () => {
    dispatch({ field: 'showUserMenu', value: false });
  };

  const handleThemeToggle = () => {
    const newTheme: Theme = lightMode === 'dark' ? 'light' : 'dark';
    dispatch({ field: 'lightMode', value: newTheme });
    ThemeService.setTheme(newTheme); // Persist theme preference
  };

  // Handle palette change immediately
  const handlePaletteChange = (paletteId: string) => {
    setCurrentPalette(paletteId);
  };

  // Handle tone cycling - this will be called from ColorPaletteSelector
  const handleToneCycle = (paletteId: string) => {
    if (paletteId === currentPalette) {
      // Cycle through tones for the same palette
      const tones: ('userPrimary' | 'userSecondary' | 'assistantPrimary' | 'assistantSecondary')[] = 
        ['userPrimary', 'userSecondary', 'assistantPrimary', 'assistantSecondary'];
      const currentIndex = tones.indexOf(currentTone);
      const nextIndex = (currentIndex + 1) % tones.length;
      const nextTone = tones[nextIndex];
      
      setCurrentTone(nextTone);
      localStorage.setItem('avatarColorTone', nextTone);
    } else {
      // Different palette selected, reset to userPrimary
      setCurrentPalette(paletteId);
      setCurrentTone('userPrimary');
      localStorage.setItem('avatarColorTone', 'userPrimary');
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      handleClose();
    }
  };

  useEffect(() => {
    const handleFeatureFlagsEvent = (event:any) => settingRef.current = getSettings(featureFlags);
    const handleSettingsEvent = (event:any) => {
        settingsActiveTab.current = event.detail?.openToTab;
        setShowSettings(true);
    }
    window.addEventListener('updateFeatureSettings', handleFeatureFlagsEvent);
    window.addEventListener('openSettingsTrigger', handleSettingsEvent);
    return () => {
        window.removeEventListener('updateFeatureSettings', handleFeatureFlagsEvent)
        window.removeEventListener('openSettingsTrigger', handleSettingsEvent)
    }
  }, []);

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

  // Get user initials for avatar
  const getUserInitials = () => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() || 'U';
  };

  // Get current color palette's userPrimary color
  const getAvatarBackgroundColor = () => {
    const palette = COLOR_PALETTES.find(p => p.id === currentPalette);
    return palette?.[currentTone] || '#B45309'; // fallback to warm-browns userPrimary
  };

  // Simple function to determine if text should be black or white based on background brightness
  const getContrastTextColor = (hexColor: string) => {
    // Remove the # if present
    const hex = hexColor.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate perceived luminance using weighted formula
    // Human eyes are more sensitive to green, less to blue
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    
    // Return black text for bright backgrounds, white for dark
    return luminance > 140 ? '#000000' : '#FFFFFF';
  };

  // Get gradient background
  const getAvatarGradient = () => {
    const baseColor = getAvatarBackgroundColor();
    
    // Convert hex to RGB for gradient calculations
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Create much more distinct diagonal gradient
    // Much lighter version (add 80 for strong brightness)
    const lightR = Math.min(255, r + 80);
    const lightG = Math.min(255, g + 80);
    const lightB = Math.min(255, b + 80);
    
    // Much darker version (subtract 60 for strong contrast)
    const darkR = Math.max(0, r - 60);
    const darkG = Math.max(0, g - 60);
    const darkB = Math.max(0, b - 60);
    
    const lightColor = `rgb(${lightR}, ${lightG}, ${lightB})`;
    const darkColor = `rgb(${darkR}, ${darkG}, ${darkB})`;
    
    return `linear-gradient(135deg, ${lightColor} 0%, ${baseColor} 50%, ${darkColor} 100%)`;
  };

  // Get hover gradient (even more dramatic)
  const getHoverGradient = () => {
    const baseColor = getAvatarBackgroundColor();
    
    // Convert hex to RGB
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Create very dramatic variations for hover
    const brightR = Math.min(255, r + 100);
    const brightG = Math.min(255, g + 100);
    const brightB = Math.min(255, b + 100);
    
    const shadowR = Math.max(10, r - 80);
    const shadowG = Math.max(10, g - 80);
    const shadowB = Math.max(10, b - 80);
    
    const brightColor = `rgb(${brightR}, ${brightG}, ${brightB})`;
    const shadowColor = `rgb(${shadowR}, ${shadowG}, ${shadowB})`;
    
    return `radial-gradient(ellipse at top left, ${brightColor} 0%, ${baseColor} 40%, ${shadowColor} 100%)`;
  };

  const sendEventToHideItemsAroundCodeBase = (shouldHide: boolean) => {
    window.dispatchEvent(new CustomEvent('openFullScreenPanel', { detail: { isOpen: shouldHide }} ));
  }

  useEffect(() => {
    sendEventToHideItemsAroundCodeBase(showAssistantAdmin || showAdminInterface || showUserCosts);
  }, [showAssistantAdmin, showAdminInterface, showUserCosts]);


  return (
    <>
      {/* Persistent User Button - Always visible in top right */}
      <button
        onClick={handleToggleMenu}
        className="fixed top-4 right-4 z-50 "
        title="User Menu"
        id="userMenu"
      >
        <div 
          className="cursor-pointer animate-pop"
          style={{
            background: getAvatarGradient(),
            borderRadius: '2rem',
            width: '45px',
            height: '45px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            animation: 'pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transformOrigin: 'center',
            padding: '2px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.background = getHoverGradient();
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1.0)';
            e.currentTarget.style.background = getAvatarGradient();
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
          }}
        >
          {/* White ring */}
          <div
            style={{
              background: 'white',
              borderRadius: '50%',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1px'
            }}
          >
            {/* Inner colored circle with initials */}
            <div
              style={{
                background: getAvatarGradient(),
                borderRadius: '50%',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* User Avatar with initials */}
              <div 
                className="font-semibold font-sans text-white" 
                style={{ color: getContrastTextColor(getAvatarBackgroundColor()) }}
              >
                {getUserInitials()}
              </div>
            </div>
          </div>
          <style jsx>{`
            @keyframes pop {
              0% {
                transform: scale(0.8);
                opacity: 0.8;
              }
              50% {
                transform: scale(1.05);
              }
              100% {
                transform: scale(1.0);
                opacity: 1;
              }
            }
            .animate-pop {
              animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
          `}</style>
        </div>
      </button>

      {/* Dropdown Menu - Only visible when showUserMenu is true */}
      {showUserMenu && (
        <div className="fixed inset-0 z-[9998] flex items-start justify-end p-4 mt-[-1px]">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-25"
            onClick={handleClose}
          />

          {/* Menu */}
          <div 
            ref={menuRef}
            className="relative mt-12 py-2 w-52 bg-white dark:bg-[#202123] rounded-lg border border-neutral-200 dark:border-neutral-600 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto"
            id="userScroll"
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
                 {mtdCost === '0' ? <div className="flex justify-center"> <IconLoader2 size={24} className="animate-spin" /> </div> : <>{mtdCost}</>}  
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
                    id={`switchTo${lightMode === 'dark' ? 'light' : 'dark'}Mode`}
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

            <ColorPaletteSelector onPaletteChange={handlePaletteChange} onToneCycle={handleToneCycle} />

            <div className="py-1">
              { (
                <button
                  onClick={() => {
                    setShowSharingDialog(true);
                    handleClose();
                  }}
                  id="sharingCenter"
                  className={commonClassname}
                >
                  <IconShare size={16} className="icon-pop-group enhanced-icon text-green-500" />
                  <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Sharing</span>
                </button>
              )}
              { (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    homeDispatch({field: 'page', value: 'home'});
                    handleClose();
                  }}
                  id="myDataFiles"
                  className={commonClassname}
                >
                  <IconRocket size={16} className="icon-pop-group enhanced-icon text-blue-500" />
                  <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">My Data</span>
                </button>

                
              )}
              { featureFlagsRef.current.adminInterface && <>
                <button
                  onClick={() => {
                    setShowAdminInterface(true);
                    handleClose();
                  }}
                  id="adminInterface"
                  className={commonClassname}
                >
                  <IconShield size={16} className="icon-pop-group enhanced-icon text-red-500" />
                  <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Admin</span>
                </button>
              
                <button
                  onClick={() => {
                    setShowUserCosts(true);
                    handleClose();
                  }}
                  id="userCostInterface"
                  className={commonClassname}
                >
                  <IconCurrencyDollar size={16} className="icon-pop-group enhanced-icon text-green-500" />
                  <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">User Costs</span>
                </button>
              </>
              }
              <button
                onClick={() => {
                  setShowSettings(true);
                  handleClose();
                }}
                id="settingsInterface"
                className={commonClassname}
              >
         <IconSettings size={16} className="icon-pop-group enhanced-icon text-purple-500" />
                <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Settings</span>
              </button>

              <button
                onClick={() => { window.location.href = `mailto:${supportEmail}`}}
                className={commonClassname}
                id="sendFeedbackInterface"
              >
                <IconHelp size={16} className="icon-pop-group enhanced-icon text-red-500" />
                <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Send Feedback</span>
              </button>

              <button
                onClick={federatedSignOut}
                className={commonClassname}
                id="logout"
              >  
                <IconLogout size={16} className="icon-pop-group enhanced-icon text-neutral-700 dark:text-neutral-200" />
                <span className="sidebar-text font-medium text-neutral-700 dark:text-neutral-200">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-black dark:text-white">
        {showSettings && <SettingDialog open={showSettings} onClose={() => setShowSettings(false)} />}
        {/* Allow this to render upon every open  */}
        {showAssistantAdmin && featureFlagsRef.current.assistantAdminInterface && 
         <AssistantAdminUI
            open={showAssistantAdmin}
            openToGroup={astGroupModalData?.group}
            openToAssistant={astGroupModalData?.assistant}
        /> }

        { featureFlagsRef.current.adminInterface && 
        <>
        {showAdminInterface && 
        <AdminUI
            open={showAdminInterface}
            onClose={() => setShowAdminInterface(false) }
        />}
        <UserCostsModal
            open={showUserCosts}
            onClose={() => setShowUserCosts(false) }
        />
        </>}

        <SharingDialog
            open={showSharingDialog}
            onClose={() => setShowSharingDialog(false)}
        />

      </div>
    </>
  );
};

const commonClassname = "group flex w-full items-center gap-3 px-4 py-2 cursor-pointer hover:bg-neutral-100 dark:hover:bg-[#343541]/90 transition-all duration-200";


export default UserMenu;