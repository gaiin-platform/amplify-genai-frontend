import HomeContext from "@/pages/api/home/home.context";
import { FC, ReactElement, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
    title?: string;
    message: string | ReactElement;
    confirmLabel?: string;
    denyLabel?: string;
    onConfirm: () => void;
    onDeny?: () => void;
    height?: number;
    width?: number;
}

export const ConfirmModal: FC<Props> = ({
    title = "", 
    message, 
    height = 260, 
    width = 450,
    confirmLabel = "Yes", 
    denyLabel = "No", 
    onConfirm, 
    onDeny
}) => {
    const { state: { lightMode } } = useContext(HomeContext);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
        
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    if (!mounted) return null;

    const modalContent = (
        <div className={`${lightMode} fixed inset-0 z-[9999] flex items-center justify-center`}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
            
            {/* Modal */}
            <div 
                className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 max-w-full max-h-full overflow-auto"
                style={{ width: `${width}px`, minHeight: `${height}px` }}
            >
                {/* Header */}
                {title && (
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h3>
                    </div>
                )}
                
                {/* Content */}
                <div className="px-6 py-4">
                    <div className="text-gray-700 dark:text-gray-300">
                        {message}
                    </div>
                </div>
                
                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                    {onDeny && (
                        <button
                            onClick={onDeny}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                        >
                            {denyLabel}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};