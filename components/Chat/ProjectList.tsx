import { FC, useEffect, useRef } from 'react';
import { useTranslation } from 'next-i18next';

interface Project {
    ProjectID: string;
    ProjectName: string;
}

interface Props {
    currentProject: Project | null;
    availableProjects: Project[];
    onProjectChange: (project: Project) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLSelectElement>) => void;
}

export const ProjectList: FC<Props> = ({
    currentProject,
    availableProjects,
    onProjectChange,
    onKeyDown,
}) => {
    const { t } = useTranslation('chat');
    const selectRef = useRef<HTMLSelectElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
        const selectElement = selectRef.current;
        const optionCount = selectElement?.options.length || 0;

        if (e.key === '/' && e.metaKey) {
            e.preventDefault();
            if (selectElement) {
                selectElement.selectedIndex =
                    (selectElement.selectedIndex + 1) % optionCount;
                selectElement.dispatchEvent(new Event('change'));
            }
        } else if (e.key === '/' && e.shiftKey && e.metaKey) {
            e.preventDefault();
            if (selectElement) {
                selectElement.selectedIndex =
                    (selectElement.selectedIndex - 1 + optionCount) % optionCount;
                selectElement.dispatchEvent(new Event('change'));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectElement) {
                selectElement.dispatchEvent(new Event('change'));
            }

            onProjectChange(
                availableProjects.find(
                    (p) =>
                        p.ProjectID === selectElement?.selectedOptions[0].value,
                ) as Project,
            );
        } else {
            onKeyDown(e);
        }
    };

    useEffect(() => {
        if (selectRef.current) {
            selectRef.current.focus();
        }
    }, []);

    return (
        <div className="flex flex-col">
            <div className="mb-1 w-full rounded border border-neutral-200 bg-transparent pr-2 text-neutral-900 dark:border-neutral-600 dark:text-white">
                <select
                    ref={selectRef}
                    className="w-full cursor-pointer bg-transparent p-2"
                    placeholder={t('Select Project') || ''}
                    value={currentProject?.ProjectID || ''}
                    onChange={(e) => {
                        onProjectChange(
                            availableProjects.find(
                                (p) => p.ProjectID === e.target.value,
                            ) as Project,
                        );
                    }}
                    onKeyDown={(e) => {
                        handleKeyDown(e);
                    }}
                >
                    <option
                        key="default"
                        value=""
                        className="dark:bg-[#343541] dark:text-white"
                    >
                        Select Project
                    </option>

                    {availableProjects.map((project) => (
                        <option
                            key={project.ProjectID}
                            value={project.ProjectID}
                            className="dark:bg-[#343541] dark:text-white"
                        >
                            {project.ProjectName}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};