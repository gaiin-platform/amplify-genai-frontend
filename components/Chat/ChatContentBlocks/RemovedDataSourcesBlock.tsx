import { IconAlertTriangle, IconUpload, IconKey, IconHelp } from '@tabler/icons-react';
import React from "react";
import { Message } from "@/types/chat";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";

interface RemovedDataSource {
    objectId: string;
    name?: string;
    accessType?: string;
    reason?: string;
    userLevel?: string;
}

interface RemovedDataSources {
    invalidIds: string[];
    deniedAccess: RemovedDataSource[];
    invalidImageIds: string[];
}

interface Props {
    message: Message;
    supportEmail?: string;
}

const RemovedDataSourcesBlock: React.FC<Props> = ({ message, supportEmail }) => {
    // Check if message has removed data sources in state
    if (
        !message ||
        !message.data ||
        !message.data.state ||
        !message.data.state.removedDataSources
    ) {
        return null;
    }

    const removed: RemovedDataSources = message.data.state.removedDataSources;
    const totalRemoved = removed.invalidIds.length + removed.deniedAccess.length + removed.invalidImageIds.length;
    if (totalRemoved === 0) {
        return null;
    }

    const renderDeniedSource = (source: RemovedDataSource, idx: number) => {
        const isNoPermission = source.reason === 'no_permission_record';
        const isInsufficientPrivilege = source.reason === 'insufficient_privilege';

        return (
            <div key={idx} className="flex flex-col gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 my-2">
                <div className="flex items-start gap-2">
                    <IconAlertTriangle className="min-w-[20px] text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="flex-1">
                        <div className="font-medium text-red-700 dark:text-red-300">
                            Access Denied
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                {source.name || source.objectId}
                            </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {isNoPermission && "You don't have permission to access this file. If this is a file you have uploaded, please try to re-upload it. If this is a file that has been shared within an assistant or conversation, please contact the owner to request access or contact support."}
                            {isInsufficientPrivilege && `Insufficient privilege level${source.userLevel ? ` (your level: ${source.userLevel})` : ''}.`}
                        </div>
                    </div>
                </div>

                {/* Helpful Actions */}
                <div className="flex flex-wrap gap-2 mt-2 ml-7">
                    {supportEmail && (
                        <button
                            onClick={() => {
                                const label = source.name || source.objectId;
                                window.location.href = `mailto:${supportEmail}?subject=Access Request for ${label}&body=I need access to the file: ${label}`;
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                            title="Contact support for help"
                        >
                            <IconHelp size={14} />
                            <span>Contact Support</span>
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderInvalidId = (id: string, idx: number, type: string) => (
        <div key={idx} className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 my-2">
            <IconAlertTriangle className="min-w-[20px] text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="flex-1">
                <div className="font-medium text-yellow-700 dark:text-yellow-300">
                    Invalid {type}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
                        {id}
                    </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    This file ID is not valid or the file no longer exists.
                </div>
            </div>
        </div>
    );

    const content = (
        <div className="flex flex-col gap-1">
            {/* Denied Access Sources */}
            {removed.deniedAccess.length > 0 && (
                <div className="mb-2">
                    <div className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        Access Denied ({removed.deniedAccess.length})
                    </div>
                    {removed.deniedAccess.map((source, idx) => renderDeniedSource(source, idx))}
                </div>
            )}

            {/* Invalid Data Source IDs */}
            {removed.invalidIds.length > 0 && (
                <div className="mb-2">
                    <div className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        Invalid Data Sources ({removed.invalidIds.length})
                    </div>
                    {removed.invalidIds.map((id, idx) => renderInvalidId(id, idx, "Data Source"))}
                </div>
            )}

            {/* Invalid Image IDs */}
            {removed.invalidImageIds.length > 0 && (
                <div className="mb-2">
                    <div className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        Invalid Images ({removed.invalidImageIds.length})
                    </div>
                    {removed.invalidImageIds.map((id, idx) => renderInvalidId(id, idx, "Image"))}
                </div>
            )}
        </div>
    );

    return (
        <div className="mt-3 max-w-full">
            <ExpansionComponent
                title={`⚠️ ${totalRemoved} Data Source${totalRemoved > 1 ? 's' : ''} Removed`}
                content={content}
            />
        </div>
    );
};

export default RemovedDataSourcesBlock;
