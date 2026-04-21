import toast from 'react-hot-toast';

export enum ChatErrorType {
    NETWORK_ERROR = 'NETWORK_ERROR',
    AUTH_ERROR = 'AUTH_ERROR',
    MODEL_ERROR = 'MODEL_ERROR',
    RATE_LIMIT = 'RATE_LIMIT',
    SERVICE_DOWN = 'SERVICE_DOWN',
    UNKNOWN = 'UNKNOWN'
}

interface ChatError {
    type: ChatErrorType;
    message: string;
    retryable: boolean;
    details?: string;
}

export const handleChatError = (error: any): ChatError => {
    console.error('Chat error:', error);

    // Network errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
            type: ChatErrorType.NETWORK_ERROR,
            message: 'Request timed out. Please check your connection and try again.',
            retryable: true
        };
    }

    if (!navigator.onLine) {
        return {
            type: ChatErrorType.NETWORK_ERROR,
            message: 'No internet connection. Please check your network.',
            retryable: true
        };
    }

    // Auth errors
    if (error.status === 401 || error.message?.includes('Unauthorized')) {
        return {
            type: ChatErrorType.AUTH_ERROR,
            message: 'Authentication failed. Please sign in again.',
            retryable: false
        };
    }

    if (error.status === 403 || error.message?.includes('Forbidden')) {
        return {
            type: ChatErrorType.AUTH_ERROR,
            message: 'Access denied. You may not have permission for this action.',
            retryable: false
        };
    }

    // Rate limiting
    if (error.status === 429) {
        return {
            type: ChatErrorType.RATE_LIMIT,
            message: 'Too many requests. Please wait a moment before trying again.',
            retryable: true,
            details: error.response?.data?.retryAfter
        };
    }

    // Model errors
    if (error.message?.includes('model') || error.message?.includes('Model')) {
        return {
            type: ChatErrorType.MODEL_ERROR,
            message: 'The selected model is unavailable. Please try a different model.',
            retryable: true
        };
    }

    // Service down
    if (error.status === 503 || error.status === 502) {
        return {
            type: ChatErrorType.SERVICE_DOWN,
            message: 'Service temporarily unavailable. We\'re working to restore functionality.',
            retryable: true
        };
    }

    // Default error
    return {
        type: ChatErrorType.UNKNOWN,
        message: 'An unexpected error occurred. Please try again.',
        retryable: true,
        details: error.message
    };
};

export const showErrorToast = (error: ChatError, onRetry?: () => void) => {
    const toastOptions: any = {
        duration: error.retryable ? 6000 : 4000,
        position: 'top-center',
        style: {
            background: '#dc2626',
            color: 'white',
            padding: '16px',
            borderRadius: '8px',
            maxWidth: '500px'
        }
    };

    if (error.retryable && onRetry) {
        toast.error(
            (t) => (
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="font-semibold">{error.message}</p>
                        {error.details && <p className="text-sm mt-1 opacity-90">{error.details}</p>}
                    </div>
                    <button
                        onClick={() => {
                            toast.dismiss(t.id);
                            onRetry();
                        }}
                        className="px-3 py-1.5 bg-white text-red-600 rounded hover:bg-gray-100 transition-colors text-sm font-medium whitespace-nowrap"
                    >
                        Retry
                    </button>
                </div>
            ),
            toastOptions
        );
    } else {
        toast.error(error.message, toastOptions);
    }
};

export const showSuccessToast = (message: string) => {
    toast.success(message, {
        duration: 3000,
        position: 'top-center',
        style: {
            background: '#10b981',
            color: 'white',
            padding: '16px',
            borderRadius: '8px'
        }
    });
};

export const showWarningToast = (message: string) => {
    toast(message, {
        duration: 4000,
        position: 'top-center',
        icon: '⚠️',
        style: {
            background: '#f59e0b',
            color: 'white',
            padding: '16px',
            borderRadius: '8px'
        }
    });
};