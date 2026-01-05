import React, { useState, useEffect } from 'react';
import { IconCaretDown, IconCaretRight } from '@tabler/icons-react';
import {
    IconAperture,
    IconApiApp,
    IconBolt,
    IconCheck,
    IconClearAll,
    IconDownload,
    IconInfoHexagon,
    IconRepeat,
    IconSend,
    IconSettings,
    IconShare
} from '@tabler/icons-react';
import { PromptStatusDetails } from '@/components/Status/PromptStatusDetails';
import Loader from '@/components/Loader/Loader';
import { Status } from '@/types/workflow';
import { getWhiteLabelConfig } from '@/utils/whiteLabel/config';

interface PromptStatusProps {
    status: Status;
}

export const PromptStatus: React.FC<PromptStatusProps> = ({ status }) => {
    const [detailsOpen, setDetailsOpen] = useState(true);
    const [animationFrame, setAnimationFrame] = useState(0);
    
    // Get logo source for assistant icon background
    const config = getWhiteLabelConfig();
    const assistantLogoSrc = config.customLogoPath 
        ? `/logos/${config.customLogoPath}`
        : '/sparc_folds.png';

    //status.animated = true;

    useEffect(() => {
        if (status.animated) {
            const interval = setInterval(() => {
                setAnimationFrame(prev => (prev + 1) % 60);
            }, 50);
            return () => clearInterval(interval);
        }
    }, [status.animated]);

    const getLeadingComponent = (status: Status) => {
        if (status.inProgress) {
            return <Loader size="32" />;
        }

        const iconProps = {
            className: status.animated ? 'animate-spin' : '',
            size: 24
        };

        switch (status.icon) {
            case 'bolt':
                return <IconBolt {...iconProps} />;
            case 'info':
                return <IconInfoHexagon {...iconProps} />;
            case 'assistant':
                return <></>;
            case 'check':
                return <IconCheck {...iconProps} />;
            case 'aperture':
                return <IconAperture {...iconProps} />;
            case 'repeat':
                return <IconRepeat {...iconProps} />;
            case 'api':
                return <IconApiApp {...iconProps} />;
            case 'send':
                return <IconSend {...iconProps} />;
            case 'clear':
                return <IconClearAll {...iconProps} />;
            case 'settings':
                return <IconSettings {...iconProps} />;
            case 'share':
                return <IconShare {...iconProps} />;
            case 'download':
                return <IconDownload {...iconProps} />;
            default:
                return <IconCheck {...iconProps} />;
        }
    };

    const getCoverBackgroundImage = (status: Status) => {
        if (status.icon === 'assistant') {
            return `url("${assistantLogoSrc}")`;
        } else if (status.inProgress) {
            return 'url("/bg-18.png")';
        }
        return 'url("/bg-20.png")';
    };

    // Animated background patterns
    const renderAnimatedBackground = () => {
        if (!status.animated) return null;

        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">

              {/* Animated wave */}
              {Array(8).fill(null).map((_, i) => (
                <div
                  key={`wave-${i}`}
                  className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500 opacity-30"
                  style={{
                      transform: `translateY(${Math.sin((animationFrame + i * 10) * 0.1) * 5}px)`,
                      transition: 'transform 0.2s ease-in-out'
                  }}
                />
              ))}

              {/* Animated circles for inProgress */}
              {status.inProgress && Array(3).fill(null).map((_, i) => (
                <div
                  key={`circle-${i}`}
                  className="absolute inset-0 border-2 border-blue-400 rounded-full opacity-20"
                  style={{
                      animation: `promptStatusRipple 2s ease-out ${i * 0.5}s infinite`
                  }}
                />
              ))}
          </div>
        );
    };

    return (
      <>
          <div
            className="rounded-xl text-neutral-800 hover:opacity-50 dark:text-white bg-neutral-200 dark:bg-[#343541] shadow-lg h-12 mb-2 mr-2 overflow-hidden"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDetailsOpen(!detailsOpen);
            }}
          >
              <div className="flex flex-row relative overflow-hidden">
                  {renderAnimatedBackground()}
                  <div
                    className="w-14 h-12 flex-none bg-cover rounded-l-xl text-center overflow-hidden"
                    style={{ backgroundImage: getCoverBackgroundImage(status) }}
                  >
                      <div className="text-white flex h-full w-full justify-center items-center">
                          {getLeadingComponent(status)}
                      </div>
                  </div>
                  <div className="mt-0 ml-3 flex flex-row p-0 truncate justify-center items-center">
                      <div className="mt-0 pt-0">
                          {status.summary || status.message}
                      </div>
                      {status.message && status.summary && (status.summary !== status.message) && (
                        <div className="ml-3">
                            {detailsOpen ? <IconCaretDown size={18} /> : <IconCaretRight size={18} />}
                        </div>
                      )}
                  </div>
              </div>
          </div>

          {status.message && status.summary && (status.summary !== status.message && detailsOpen) && (
            <div className="mx-2 mt-0 py-2 px-5 bg-neutral-200 dark:bg-[#343541] rounded-lg">
                <PromptStatusDetails status={status} />
            </div>
          )}

          <style jsx global>{`
              @keyframes promptStatusPulse {
                  0%, 100% { transform: scale(1); opacity: 0.3; }
                  50% { transform: scale(1.5); opacity: 0.7; }
              }

              @keyframes promptStatusRipple {
                  0% { transform: scale(0.8); opacity: 0.5; }
                  100% { transform: scale(2); opacity: 0; }
              }
          `}</style>
      </>
    );
};