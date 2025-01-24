import { FC } from 'react';
import { IconX } from '@tabler/icons-react';

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
            <div className="flex items-center gap-2 rounded-lg bg-neutral-200 py-1 px-2 text-sm dark:bg-neutral-600">
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