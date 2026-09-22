import React, { useContext } from "react";
import { IconAlertTriangle, IconChartBar } from "@tabler/icons-react";
import { Message } from "@/types/chat";
import HomeContext from "@/pages/api/home/home.context";

interface ModelRateLimitNotice {
    modelId?: string;
    utilizationPercent?: number;
    reachedLimit?: boolean;
    message?: string;
}

interface AdminRateLimitNotice {
    utilizationPercent?: number;
    period?: string;
}

interface Props {
    message: Message;
}

const ModelRateLimitBlock: React.FC<Props> = ({ message }) => {
    const { state: { availableModels } } = useContext(HomeContext);
    const notice = message?.data?.state?.modelRateLimit as ModelRateLimitNotice | undefined;
    const adminNotice = message?.data?.state?.adminRateLimit as AdminRateLimitNotice | undefined;
    const adminPercent = Math.max(0, Math.min(100, Number(adminNotice?.utilizationPercent) || 0));
    const showAdmin = adminNotice && adminPercent >= 60;
    if (!notice || typeof notice !== "object") {
        if (!showAdmin) return null;
        return (
            <div className="mt-2 w-fit max-w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
                <div className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-200">
                    <IconChartBar size={13} className="flex-shrink-0 text-neutral-400" />
                    <span className="text-neutral-500 dark:text-neutral-400">{adminNotice?.period} admin limit: {adminPercent}% used</span>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-600">
                        <span className={`block h-full rounded-full ${adminPercent >= 90 ? "bg-orange-500" : "bg-blue-500"}`} style={{ width: `${adminPercent}%` }} />
                    </span>
                </div>
            </div>
        );
    }

    const percent = Math.max(0, Math.min(100, Number(notice.utilizationPercent) || 0));
    const reached = notice.reachedLimit === true;
    if (!reached && percent < 60) return null;
    const modelLabel = (notice.modelId && (availableModels as any)?.[notice.modelId]?.name) || notice.modelId || "this model";
    const text = reached
        ? `You have used ${Math.round(percent)}% of your allowed usage for ${modelLabel}. Please try a different model. This limit resets at the beginning of next month.`
        : `You have used ${Math.round(percent)}% of your allowed usage for ${modelLabel}.`;

    if (reached) {
        return (
            <div className="mt-3 w-fit max-w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800 dark:bg-neutral-800">
                <div className="flex items-center gap-2 text-xs">
                    <IconAlertTriangle size={14} className="flex-shrink-0 text-red-500 dark:text-red-400" />
                    <span className="font-semibold text-neutral-800 dark:text-neutral-100">{modelLabel}</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">100% of monthly limit used</span>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-red-100 dark:bg-neutral-600">
                        <span className="block h-full w-full rounded-full bg-red-500" />
                    </span>
                </div>
                <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                    You have exceeded your monthly usage for this model. Please switch to a different model to continue. This limit resets at the beginning of next month.
                </p>
            </div>
        );
    }

    const barColor = percent >= 90 ? "bg-orange-500" : "bg-blue-500";
    return (
        <div className="mt-2 w-fit max-w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
            <div className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-200">
                <IconChartBar size={13} className="flex-shrink-0 text-neutral-400 dark:text-neutral-400" />
                <span className="font-semibold">{modelLabel}</span>
                <span className="text-neutral-500 dark:text-neutral-400">{Math.round(percent)}% of monthly limit used</span>
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-600">
                    <span className={`block h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
                </span>
            </div>
            {percent >= 90 && (
                <p className="mt-1 text-xs text-orange-600 dark:text-orange-300">
                    You are approaching your monthly limit. Once exceeded, you will need to switch to a different model.
                </p>
            )}
        </div>
    );
};

export default ModelRateLimitBlock;
