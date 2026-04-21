import React, { useState, useEffect, FC } from 'react';
import { IconSchool, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { canvasService, CanvasStatus as CanvasStatusType } from '@/services/canvasService';
import { useRouter } from 'next/router';

interface CanvasStatusProps {
  className?: string;
}

export const CanvasStatus: FC<CanvasStatusProps> = ({ className = '' }) => {
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatusType>({ connected: false });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkCanvasStatus();
    
    // Check periodically if Canvas is connected
    const interval = setInterval(checkCanvasStatus, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  const checkCanvasStatus = async () => {
    try {
      const status = await canvasService.getStatus();
      setCanvasStatus(status);
    } catch (err) {
      console.error('Error checking Canvas status:', err);
      setCanvasStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    // Navigate to settings page, Canvas tab
    router.push({
      pathname: '/home',
      query: { settings: 'open', tab: 'Canvas LMS' }
    });
  };

  if (loading) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200 hover:scale-105 ${
        canvasStatus.connected 
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50' 
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      } ${className}`}
      title={canvasStatus.connected ? 'Canvas connected - Click to manage' : 'Click to connect Canvas'}
    >
      <IconSchool size={18} />
      <span className="text-sm font-medium">
        {canvasStatus.connected ? 'Canvas' : 'Connect Canvas'}
      </span>
      {canvasStatus.connected && <IconCheck size={16} />}
    </button>
  );
};