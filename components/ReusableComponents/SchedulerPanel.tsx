import React, { useContext, useEffect } from 'react';
import { IconClock, IconRefresh, IconX, IconLoader2, IconAlarm } from '@tabler/icons-react';
import ActionButton from '@/components/ReusableComponents/ActionButton';
import { createPortal } from 'react-dom';
import HomeContext from '@/pages/api/home/home.context';
import { getScheduledTask } from '@/services/scheduledTasksService';
import toast from 'react-hot-toast';
import { ScheduledTask } from '@/types/scheduledTasks';

// Lazy import to avoid circular dependencies
const ScheduledTasks = React.lazy(() => import('@/components/Agent/ScheduledTasks').then(module => ({ default: module.ScheduledTasks })));

interface SchedulerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  scheduleDescription?: string;
  className?: string;
  isLoading?: boolean;
  scheduledTaskId?: string;
}

export const SchedulerPanel: React.FC<SchedulerPanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  scheduleDescription,
  className = "w-80",
  isLoading = false,
  scheduledTaskId
}) => {
  const { state: { lightMode } } = useContext(HomeContext);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [showScheduledTasks, setShowScheduledTasks] = React.useState(false);
  const [scheduledTask, setScheduledTask] = React.useState<ScheduledTask | undefined>(undefined);

  useEffect(() => {
    const getScheduledTaskData = async () => {
      if (!scheduledTaskId) return;
      const taskResult = await getScheduledTask(scheduledTaskId);
      if (taskResult.success && taskResult.data?.task) {
        // console.log("taskResult", taskResult.data.task);
        const task = taskResult.data.task;
        setScheduledTask(task);
        return;
      } 
      toast.error("Failed to get scheduled task");
    }
    if (scheduledTaskId && scheduledTask === undefined) getScheduledTaskData();
  }, [scheduledTaskId]);

  // Click-away close functionality
  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (isOpen && panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      // Add event listener when panel is open
      document.addEventListener('mousedown', handleClickAway);
    }

    // Cleanup event listener
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, [isOpen, onClose]);

  const handleScheduledTaskClick = () => {
    setShowScheduledTasks(true);
  };



  return (
    <>
      <div 
        ref={panelRef}
        className={`absolute top-12 right-0 ${className} bg-white dark:bg-gray-700 border-[1.5px] border-gray-200 dark:border-black rounded-lg shadow-xl z-50 transform transition-all duration-300 ease-out ${
          isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-[-10px] opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <IconRefresh size={18} className="text-blue-500" />
              <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
            </div>

            <div className="-mt-3 -mr-2">
              <ActionButton
                title="Close"
                handleClick={onClose}
              >
                <IconX size={20}/>
              </ActionButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <IconLoader2 className="animate-spin text-blue-500" size={34} />
            </div>
          ) : (
            <>
              {children}

                <div className="border-t border-gray-200 dark:border-gray-600">
                 {scheduleDescription &&<div className="pt-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <IconClock size={18} />
                    <span>{scheduleDescription}</span>
                  </div>}
                {scheduledTask && (
                  <ActionButton
                    title="Manage Scheduled Task"
                    handleClick={handleScheduledTaskClick}
                    className="w-full flex flex-row text-center justify-center text-[13px] p-0 mt-2 flex items-center gap-1 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                  >
                    <> 
                       View Scheduled Task 
                      <IconAlarm size={18} />
                    </>
                    
                  </ActionButton>
                )}
                </div>
            </>
          )}
        </div>
      </div>

      {/* Portal for ScheduledTasks modal */}
      {showScheduledTasks && createPortal(
        <React.Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
          <div className={`${lightMode} text-black dark:text-white`}>
            <ScheduledTasks
              isOpen={showScheduledTasks}
              onClose={() => setShowScheduledTasks(false)}
              initTask={scheduledTask}
            />
          </div>
        </React.Suspense>, 
        document.body
      )}
    </>
  );
};


interface SchedulerAlarmButtonProps {
  onClick: () => void;
  isActive: boolean;
  title?: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

export const SchedulerAlarmButton: React.FC<SchedulerAlarmButtonProps> = ({
  onClick,
  isActive,
  title = "Configure scheduler",
  className = "absolute -top-8 right-0 p-2 hover:bg-gray-100 dark:hover:bg-[#40414F] rounded-md transition-colors group",
  size = 26,
  style = {zIndex: "20"}
}) => {
  return (
    <button
      onClick={onClick}
      className={className}
      style={style}
      title={title}
    >
      <IconAlarm 
        size={size} 
        className={`transition-colors ${
          isActive
            ? 'text-blue-500' 
            : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
        }`} 
      />
    </button>
  );
};

