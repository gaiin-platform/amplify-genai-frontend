import { IconCheck, IconX, IconLibrary } from '@tabler/icons-react';
import { FC } from 'react';
import { PendingArtifact } from '@/types/artifacts';
import { LoadingIcon } from './ArtifactsSaved';

interface Props {
    artifacts: PendingArtifact[];
    onRemove: (key: string) => void;
}

export const ArtifactsList: FC<Props> = ({ artifacts, onRemove }) => {
    if (artifacts.length === 0) return null;

    return (
        <div className="pt-1 pb-1">
            <div className="flex items-center mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1 px-2">
                    Artifacts ({artifacts.length})
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            </div>
            <div className="flex flex-wrap gap-2 px-2">
                {artifacts.map(artifact => (
                    <div
                        key={artifact.key}
                        className="group flex items-center bg-blue-50 dark:bg-[#3e3f4b] rounded-md px-2 py-1.5 border border-blue-100 dark:border-[#565869] hover:bg-blue-100 dark:hover:bg-[#4a4b59] transition-colors"
                    >
                        <div className="flex items-center gap-1.5">
                            <span className="text-blue-600 dark:text-blue-400">
                                <IconLibrary size={16} stroke={1.5} />
                            </span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]" title={artifact.description}>
                                {artifact.name}
                            </span>
                        </div>

                        <div className="flex items-center ml-2">
                            {artifact.loadingState === 'loading' && (
                                <LoadingIcon className="flex-shrink-0" />
                            )}
                            {artifact.loadingState === 'ready' && (
                                <IconCheck size={14} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                            )}
                            {artifact.loadingState === 'error' && (
                                <IconX size={14} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                            )}

                            <button
                                onClick={() => onRemove(artifact.key)}
                                className="ml-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove artifact"
                                aria-label="Remove artifact"
                            >
                                <IconX size={14} stroke={1.8} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
