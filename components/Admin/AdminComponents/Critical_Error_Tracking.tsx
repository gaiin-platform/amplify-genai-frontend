import { FC, useState, useEffect } from "react";
import { IconAlertTriangle, IconCheck, IconChevronDown, IconChevronRight, IconClock, IconCode, IconCopy, IconExternalLink, IconFilter, IconRefresh, IconSearch, IconUser, IconX, IconDatabase, IconServer, IconBug, IconMailExclamation } from "@tabler/icons-react";
import { loading, loadingIcon, CriticalErrorsConfig } from "../AdminUI";
import { AdminConfigTypes } from "@/types/admin";
import toast from "react-hot-toast";
import { getCriticalErrors, resolveCriticalError } from "@/services/adminService";
import Checkbox from "@/components/ReusableComponents/CheckBox";
import InputsMap from "@/components/ReusableComponents/InputMap";

interface CriticalError {
    error_id: string;
    timestamp: number;
    last_occurrence?: number;
    occurrence_count?: number;
    unique_user_count?: number;
    created_at: string;
    status: string;
    severity: string;
    service_name: string;
    function_name: string;
    error_type: string;
    error_message: string;
    current_user: string;
    affected_users?: { [user: string]: number } | string[];  // Dict {user: count} or legacy list
    stack_trace?: string;
    context?: { [key: string]: any };
    resolved_by?: string;
    resolved_at?: number;
    resolution_notes?: string;
    resolution_history?: Array<{
        resolved_at: number;
        resolved_by: string;
        resolution_notes: string;
        occurrences_before_return: number;
    }>;
}

interface Props {
    stillLoadingData: boolean;
    criticalErrorsConfig: CriticalErrorsConfig;
    setCriticalErrorsConfig: (config: CriticalErrorsConfig) => void;
    updateUnsavedConfigs: (t: AdminConfigTypes) => void;
}

export const CriticalErrorTrackingTab: FC<Props> = ({ 
    stillLoadingData, 
    criticalErrorsConfig, 
    setCriticalErrorsConfig,
    updateUnsavedConfigs 
}) => {
    const [errors, setErrors] = useState<CriticalError[]>([]);
    const [loadingErrors, setLoadingErrors] = useState<boolean>(false);
    const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
    const [resolvingError, setResolvingError] = useState<string | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState<{ [key: string]: string }>({});
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [lastEvaluatedKey, setLastEvaluatedKey] = useState<any>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

    const fetchErrors = async (loadMore: boolean = false) => {
        if (loadMore) {
            setIsLoadingMore(true);
        } else {
            setLoadingErrors(true);
        }
        
        try {
            const result = await getCriticalErrors(50, loadMore ? lastEvaluatedKey : null);
            if (result.success) {
                setErrors(loadMore ? [...errors, ...result.errors] : result.errors);
                setHasMore(result.has_more || false);
                setLastEvaluatedKey(result.last_evaluated_key);
                if (!loadMore) {
                    setLastRefresh(new Date());
                }
            } else {
                toast.error("Failed to load critical errors");
            }
        } catch (error) {
            console.error("Error fetching critical errors:", error);
            toast.error("Error fetching critical errors");
        } finally {
            if (loadMore) {
                setIsLoadingMore(false);
            } else {
                setLoadingErrors(false);
            }
        }
    };

    useEffect(() => {
        if (!stillLoadingData) {
            fetchErrors();
        }
    }, [stillLoadingData]);

    // Infinite scroll: Auto-load more when scrolling near bottom
    useEffect(() => {
        const handleScroll = () => {
            // Check if user scrolled near bottom (within 300px)
            const scrollHeight = document.documentElement.scrollHeight;
            const scrollTop = document.documentElement.scrollTop;
            const clientHeight = document.documentElement.clientHeight;
            
            if (scrollHeight - scrollTop - clientHeight < 300) {
                // Near bottom, load more if available and not already loading
                if (hasMore && !isLoadingMore && !loadingErrors) {
                    fetchErrors(true);
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hasMore, isLoadingMore, loadingErrors, lastEvaluatedKey]);

    const toggleExpanded = (errorId: string) => {
        const newExpanded = new Set(expandedErrors);
        if (newExpanded.has(errorId)) {
            newExpanded.delete(errorId);
        } else {
            newExpanded.add(errorId);
        }
        setExpandedErrors(newExpanded);
    };

    const handleResolve = async (errorId: string) => {
        const notes = resolutionNotes[errorId] || "";
        if (!notes.trim()) {
            toast.error("Please add resolution notes");
            return;
        }

        const confirmed = confirm("Mark this error as resolved? This action cannot be undone.");
        if (!confirmed) return;

        setResolvingError(errorId);
        try {
            const result = await resolveCriticalError(errorId, notes);
                if (result.success) {
                    toast.success("Error resolved successfully");
                    setErrors(errors.filter(e => e.error_id !== errorId));
                    setResolutionNotes({ ...resolutionNotes, [errorId]: "" });
                    setExpandedErrors(prev => {
                        const next = new Set(prev);
                        next.delete(errorId);
                        return next;
                    });
                } else {
                    toast.error(result.error || "Failed to resolve error");
                }
        } catch (error) {
            console.error("Error resolving:", error);
            toast.error("Error resolving critical error");
        } finally {
            setResolvingError(null);
        }
    };

    const handleUpdateCriticalErrorsConfig = (updatedConfig: CriticalErrorsConfig) => {
        setCriticalErrorsConfig(updatedConfig);
        updateUnsavedConfigs(AdminConfigTypes.CRITICAL_ERRORS);
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "CRITICAL": return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700";
            case "HIGH": return "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700";
            case "MEDIUM": return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700";
            case "LOW": return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700";
            default: return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700";
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case "CRITICAL": return <IconAlertTriangle size={18} className="text-red-600 dark:text-red-400 animate-pulse" />;
            case "HIGH": return <IconAlertTriangle size={18} className="text-orange-600 dark:text-orange-400" />;
            case "MEDIUM": return <IconBug size={16} className="text-yellow-600 dark:text-yellow-400" />;
            case "LOW": return <IconBug size={14} className="text-blue-600 dark:text-blue-400" />;
            default: return <IconAlertTriangle size={16} className="text-gray-600 dark:text-gray-400" />;
        }
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };

    const filteredErrors = errors
        .filter(e => severityFilter === "all" || e.severity === severityFilter)
        .filter(e => {
            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            return (
                e.error_type.toLowerCase().includes(search) ||
                e.error_message.toLowerCase().includes(search) ||
                e.service_name.toLowerCase().includes(search) ||
                e.function_name.toLowerCase().includes(search) ||
                e.current_user.toLowerCase().includes(search)
            );
        });

    const criticalCount = errors.filter(e => e.severity === "CRITICAL").length;
    const highCount = errors.filter(e => e.severity === "HIGH").length;
    const mediumCount = errors.filter(e => e.severity === "MEDIUM").length;
    const lowCount = errors.filter(e => e.severity === "LOW").length;

    if (stillLoadingData) {
        return loading;
    }

    return (
        <div className="flex flex-col gap-4 p-6">
            {/* Email Notifications Configuration */}
            <div className="admin-style-settings-card">
                <div className="admin-style-settings-card-header">
                    <h3 className="admin-style-settings-card-title flex items-center gap-2"><IconMailExclamation size={24} /> Email Notifications</h3>
                    <p className="admin-style-settings-card-description">
                        Configure email notifications for critical errors. When enabled, you'll receive instant alerts whenever a new critical error is logged.
                    </p>
                </div>
                
                <div className="px-6 mr-4">
                    <Checkbox
                        id="criticalErrorNotifications"
                        label="Enable email notifications for critical errors. Admins will receive instant alerts when critical errors occur across all services."
                        checked={criticalErrorsConfig.isActive}
                        onChange={(isChecked: boolean) => {
                            handleUpdateCriticalErrorsConfig({...criticalErrorsConfig, isActive: isChecked});
                        }}
                    />
                </div>

                <div className={`mx-12 ${criticalErrorsConfig.isActive ? "" : 'opacity-30'}`}>
                    <InputsMap
                        id={`${AdminConfigTypes.CRITICAL_ERRORS}`}
                        inputs={[{
                            label: 'Notification Email', 
                            key: 'email', 
                            placeholder: 'admin@example.com', 
                            disabled: !criticalErrorsConfig.isActive,
                        }]}
                        state={{email: criticalErrorsConfig.email ?? ''}}
                        inputChanged={(key: string, value: string) => {
                            handleUpdateCriticalErrorsConfig({...criticalErrorsConfig, [key]: value});
                        }}
                    />
                    {criticalErrorsConfig.isActive && criticalErrorsConfig.subscription_status && (
                        <div className="mt-3">
                            {criticalErrorsConfig.subscription_status.status === 'confirmed' && (
                                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                                    <IconCheck size={18} className="flex-shrink-0" />
                                    <span className="font-medium">✅ Subscription Confirmed</span>
                                    <span className="text-green-600/80 dark:text-green-400/80">• Notifications are active and working</span>
                                </div>
                            )}
                            {criticalErrorsConfig.subscription_status.status === 'pending' && (
                                <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                                    <IconClock size={18} className="flex-shrink-0 animate-pulse" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">⏳ Pending Confirmation</span>
                                        <span className="text-orange-600/80 dark:text-orange-400/80">Check your inbox for an AWS SNS confirmation email and click the confirmation link.</span>
                                    </div>
                                </div>
                            )}
                            {criticalErrorsConfig.subscription_status.status === 'not_subscribed' && (
                                <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                    <IconAlertTriangle size={18} className="flex-shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">⚠️ Not Subscribed</span>
                                        <span className="text-yellow-600/80 dark:text-yellow-400/80">Click "Save Changes" to subscribe this email to notifications.</span>
                                    </div>
                                </div>
                            )}
                            {criticalErrorsConfig.subscription_status.status === 'error' && (
                                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                                    <IconX size={18} className="flex-shrink-0" />
                                    <div className="flex flex-col gap-1">
                                        <span className="font-medium">❌ Configuration Error</span>
                                        <span className="text-red-600/80 dark:text-red-400/80">{criticalErrorsConfig.subscription_status.message}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {criticalErrorsConfig.isActive && !criticalErrorsConfig.subscription_status && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            💡 After saving, you'll receive a confirmation email from AWS SNS. You must confirm the subscription to start receiving notifications.
                        </p>
                    )}
                </div>
            </div>

            {/* Header Card */}
            <div className="admin-style-settings-card">
                <div className="admin-style-settings-card-header">
                    <div className="flex flex-row items-center justify-between">
                        <div className="flex-1">
                            <h3 className="admin-style-settings-card-title flex items-center gap-3">
                                <IconAlertTriangle size={24} className="text-red-600 dark:text-red-400" />
                                Critical Error Tracking
                            </h3>
                            <p className="admin-style-settings-card-description mt-1">
                                Monitor and resolve critical errors across all services • Last updated: {lastRefresh.toLocaleTimeString()}
                            </p>
                        </div>
                        <button
                            onClick={() => fetchErrors(false)}
                            disabled={loadingErrors}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                        >
                            <IconRefresh size={18} className={loadingErrors ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Stats Dashboard */}
                <div className="mx-4 mb-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Total Count */}
                        <div className="bg-white dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                Total Active
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                                {filteredErrors.length}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {filteredErrors.length === 1 ? 'error' : 'errors'} requiring attention
                            </div>
                        </div>

                        {/* Critical */}
                        {criticalCount > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                                <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <IconAlertTriangle size={12} className="animate-pulse" />
                                    Critical
                                </div>
                                <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                                    {criticalCount}
                                </div>
                                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                    Immediate action required
                                </div>
                            </div>
                        )}

                        {/* High */}
                        {highCount > 0 && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                                <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
                                    High Priority
                                </div>
                                <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                                    {highCount}
                                </div>
                                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                    Address soon
                                </div>
                            </div>
                        )}

                        {/* Medium */}
                        {mediumCount > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                                <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-1">
                                    Medium
                                </div>
                                <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                                    {mediumCount}
                                </div>
                                <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                    Monitor closely
                                </div>
                            </div>
                        )}

                        {/* Low */}
                        {lowCount > 0 && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                                    Low Priority
                                </div>
                                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                                    {lowCount}
                                </div>
                                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Review when possible
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 px-4 mb-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <IconSearch size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by error type, message, service, or user..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Severity Filter */}
                    <div className="flex items-center gap-2">
                        <IconFilter size={18} className="text-gray-600 dark:text-gray-400" />
                        <select
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value)}
                            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">All Severities ({errors.length})</option>
                            {criticalCount > 0 && <option value="CRITICAL">Critical ({criticalCount})</option>}
                            {highCount > 0 && <option value="HIGH">High ({highCount})</option>}
                            {mediumCount > 0 && <option value="MEDIUM">Medium ({mediumCount})</option>}
                            {lowCount > 0 && <option value="LOW">Low ({lowCount})</option>}
                        </select>
                    </div>
                </div>

                {/* Errors List */}
                <div className="flex flex-col gap-3 px-4 pb-4">
                    {loadingErrors && errors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="mb-3">{loadingIcon(48)}</div>
                            <p className="text-gray-500 dark:text-gray-400">Loading critical errors...</p>
                        </div>
                    ) : filteredErrors.length === 0 ? (
                        <div className="text-center py-16 px-4">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                                <IconCheck size={48} className="text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                {searchTerm || severityFilter !== "all" ? "No matching errors" : "No critical errors!"}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {searchTerm || severityFilter !== "all" 
                                    ? "Try adjusting your filters to see more results" 
                                    : "All systems operational ✨"}
                            </p>
                        </div>
                    ) : (
                        filteredErrors.map((error, index) => {
                            const isExpanded = expandedErrors.has(error.error_id);
                            const isResolving = resolvingError === error.error_id;

                            return (
                                <div
                                    key={error.error_id}
                                    className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-200 animate-fadeIn"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    {/* Error Header */}
                                    <div
                                        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                        onClick={() => toggleExpanded(error.error_id)}
                                    >
                                        <div className="mt-1 text-gray-600 dark:text-gray-400">
                                            {isExpanded ? <IconChevronDown size={20} /> : <IconChevronRight size={20} />}
                                        </div>

                                        {getSeverityIcon(error.severity)}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 flex-1">
                                                    <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                                                        {error.error_type}
                                                    </h4>
                                                    {error.occurrence_count && error.occurrence_count > 1 && (
                                                        <span className="px-2 py-1 bg-red-600 dark:bg-red-700 text-white text-xs font-bold rounded-full animate-pulse">
                                                            {error.occurrence_count}x
                                                        </span>
                                                    )}
                                                    {error.status === 'RETURNED' && (
                                                        <span className="px-2 py-1 bg-orange-600 dark:bg-orange-700 text-white text-xs font-bold rounded-full">
                                                            RETURNED
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border ${getSeverityColor(error.severity)}`}>
                                                    {error.severity}
                                                </span>
                                            </div>
                                            
                                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                                                {error.error_message}
                                            </p>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="flex items-center gap-1.5 font-medium">
                                                    <IconServer size={14} />
                                                    {error.service_name}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <IconCode size={14} />
                                                    {error.function_name}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <IconUser size={14} />
                                                    {(() => {
                                                        const userCount = error.unique_user_count || 
                                                            (error.affected_users && typeof error.affected_users === 'object' && !Array.isArray(error.affected_users) 
                                                                ? Object.keys(error.affected_users).length 
                                                                : Array.isArray(error.affected_users) ? error.affected_users.length : 0);
                                                        
                                                        if (userCount > 15) {
                                                            return `${userCount}+ users affected`;
                                                        } else if (userCount > 1) {
                                                            return `${userCount} users affected`;
                                                        } else {
                                                            return error.current_user;
                                                        }
                                                    })()}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                                                    <IconClock size={14} />
                                                    First: {formatTimestamp(error.timestamp)}
                                                </span>
                                                {error.last_occurrence && error.last_occurrence !== error.timestamp && (
                                                    <span className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
                                                        <IconAlertTriangle size={14} />
                                                        Last: {formatTimestamp(error.last_occurrence)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800/30 dark:to-gray-900/30">
                                            <div className="p-6 space-y-6">
                                                {/* Error ID */}
                                                <div>
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 block">
                                                        Error ID
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <code className="flex-1 text-sm bg-white dark:bg-gray-900 px-3 py-2 rounded border border-gray-200 dark:border-gray-700 font-mono">
                                                            {error.error_id}
                                                        </code>
                                                        <button
                                                            onClick={() => copyToClipboard(error.error_id, "Error ID")}
                                                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                                            title="Copy Error ID"
                                                        >
                                                            <IconCopy size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Full Error Message */}
                                                <div>
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 block">
                                                        Error Message
                                                    </label>
                                                    <pre className="text-sm bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                                        {error.error_message}
                                                    </pre>
                                                </div>

                                                {/* Stack Trace */}
                                                {error.stack_trace && (
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                                            <IconDatabase size={14} />
                                                            Stack Trace
                                                        </label>
                                                        <div className="relative">
                                                            <pre className="text-xs bg-gray-900 dark:bg-black text-green-400 dark:text-green-500 p-4 rounded-lg border border-gray-700 overflow-x-auto max-h-80 overflow-y-auto font-mono leading-relaxed">
                                                                {error.stack_trace}
                                                            </pre>
                                                            <button
                                                                onClick={() => copyToClipboard(error.stack_trace!, "Stack trace")}
                                                                className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                                                                title="Copy Stack Trace"
                                                            >
                                                                <IconCopy size={14} className="text-gray-300" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Affected Users */}
                                                {error.affected_users && (() => {
                                                    const isDict = typeof error.affected_users === 'object' && !Array.isArray(error.affected_users);
                                                    const userCount = error.unique_user_count || (isDict ? Object.keys(error.affected_users).length : error.affected_users.length);
                                                    const trackedCount = isDict ? Object.keys(error.affected_users).length : error.affected_users.length;
                                                    
                                                    if (userCount === 0) return null;
                                                    
                                                    return (
                                                        <div>
                                                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                                                <IconUser size={14} />
                                                                Affected Users ({userCount > trackedCount ? `${userCount}+ total, ${trackedCount} tracked` : userCount})
                                                            </label>
                                                            <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                                                {userCount > 15 && (
                                                                    <div className="mb-2 p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs rounded flex items-center gap-2">
                                                                        <IconAlertTriangle size={14} />
                                                                        <span className="font-semibold">Widespread issue - Showing first {trackedCount} users (tracking cap reached)</span>
                                                                    </div>
                                                                )}
                                                                {isDict ? (
                                                                    <div className="space-y-1">
                                                                        {Object.entries(error.affected_users)
                                                                            .sort(([, countA]: [string, any], [, countB]: [string, any]) => (countB as number) - (countA as number))
                                                                            .map(([user, count]) => (
                                                                                <div key={user} className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-700 text-blue-900 dark:text-blue-200 text-xs rounded">
                                                                                    <span className="font-medium">{user}</span>
                                                                                    <span className="px-2 py-0.5 bg-blue-200 dark:bg-blue-800 rounded font-bold">{count}x</span>
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                ) : (
                                                                    Array.isArray(error.affected_users) && (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {error.affected_users.filter((u: string) => u !== '__MANY_USERS__').map((user: string, idx: number) => (
                                                                                <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded">
                                                                                    {user}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Resolution History */}
                                                {error.resolution_history && error.resolution_history.length > 0 && (
                                                    <div>
                                                        <label className="text-xs font-bold text-orange-700 dark:text-orange-300 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                                            <IconAlertTriangle size={14} className="animate-pulse" />
                                                            ⚠️ Previously Resolved {error.resolution_history.length} Time(s) - Error Has RETURNED!
                                                        </label>
                                                        <div className="space-y-2">
                                                            {error.resolution_history.map((resolution, idx) => (
                                                                <div key={idx} className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                                                                            Resolution #{idx + 1}
                                                                        </span>
                                                                        <span className="text-xs text-orange-600 dark:text-orange-400">
                                                                            {new Date(resolution.resolved_at * 1000).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                                                                        <strong>Resolved by:</strong> {resolution.resolved_by}
                                                                    </div>
                                                                    <div className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                                                                        <strong>Occurrences before return:</strong> {resolution.occurrences_before_return}
                                                                    </div>
                                                                    <div className="text-xs text-gray-700 dark:text-gray-300">
                                                                        <strong>Notes:</strong> {resolution.resolution_notes}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Context */}
                                                {error.context && Object.keys(error.context).length > 0 && (
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 block">
                                                            Context & Metadata
                                                        </label>
                                                        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {Object.entries(error.context).map(([key, value]) => (
                                                                    <div key={key} className="flex flex-col">
                                                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                                                            {key}
                                                                        </span>
                                                                        <span className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                                                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Resolution Form */}
                                                <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3 block flex items-center gap-2">
                                                        <IconCheck size={14} />
                                                        Resolve This Error
                                                    </label>
                                                    <textarea
                                                        value={resolutionNotes[error.error_id] || ""}
                                                        onChange={(e) => setResolutionNotes({ ...resolutionNotes, [error.error_id]: e.target.value })}
                                                        placeholder="Describe what you did to fix this error... (e.g., 'Increased database connection pool from 10 to 50', 'Restarted affected service', 'Fixed S3 bucket permissions')"
                                                        rows={4}
                                                        className={`w-full px-4 py-3 border-2 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm resize-none transition-all ${
                                                            !resolutionNotes[error.error_id]?.trim() 
                                                                ? 'border-red-400 dark:border-red-600 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                                                                : 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-green-500 focus:border-green-500'
                                                        }`}
                                                    />
                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className={`text-xs ${
                                                            !resolutionNotes[error.error_id]?.trim()
                                                                ? 'text-red-600 dark:text-red-400 font-semibold animate-pulse'
                                                                : 'text-gray-500 dark:text-gray-400'
                                                        }`}>
                                                            {!resolutionNotes[error.error_id]?.trim() 
                                                                ? '⚠️ Resolution notes required to resolve'
                                                                : `${resolutionNotes[error.error_id]?.length || 0} characters`
                                                            }
                                                        </span>
                                                        <button
                                                            onClick={() => handleResolve(error.error_id)}
                                                            title={isResolving || !resolutionNotes[error.error_id]?.trim() ? "Resolution notes are required to mark this error as resolved." : "Mark as resolved."}
                                                            disabled={isResolving || !resolutionNotes[error.error_id]?.trim()}
                                                            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
                                                        >
                                                            {isResolving ? (
                                                                <>{loadingIcon(18)} Resolving...</>
                                                            ) : (
                                                                <><IconCheck size={18} /> Mark as Resolved</>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {/* Infinite Scroll Loading Indicator */}
                    {isLoadingMore && (
                        <div className="flex flex-col items-center justify-center py-6">
                            <div className="mb-2">{loadingIcon(32)}</div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Loading more errors...</p>
                        </div>
                    )}

                    {/* Manual Load More (backup for infinite scroll) */}
                    {hasMore && !loadingErrors && !isLoadingMore && filteredErrors.length > 0 && (
                        <button
                            onClick={() => fetchErrors(true)}
                            className="w-full py-3 mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                        >
                            Load More Errors (or scroll down)
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};
