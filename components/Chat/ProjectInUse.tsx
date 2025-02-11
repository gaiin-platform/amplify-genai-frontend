import { FC } from 'react';
import { IconDeviceSdCard, IconX } from '@tabler/icons-react';

interface Project {
    ProjectID: string;
    ProjectName: string;
}

interface Props {
    project: Project | null;
    projectChanged: (project: Project | null) => void;
}

export const ProjectInUse: FC<Props> = ({ project, projectChanged }) => {
    if (!project) return null;

    return (
        <div className="flex flex-row items-center">
            <div className="flex items-center gap-2 rounded-lg bg-neutral-200 p-2 text-sm dark:bg-neutral-600 text-black dark:text-white">
                <IconDeviceSdCard size={18} />
                <div className="max-w-[120px] truncate" title={project.ProjectName}>
                    {project.ProjectName}
                </div>
                <button
                    className="opacity-50 hover:opacity-100"
                    onClick={() => projectChanged(null)}
                >
                    <IconX size={18} />
                </button>
            </div>
        </div>
    );
};