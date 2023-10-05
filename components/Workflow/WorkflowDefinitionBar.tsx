import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { saveWorkflowDefinitions} from "@/utils/app/workflows";

import { OpenAIModels } from '@/types/openai';
import { WorkflowDefinition } from '@/types/workflow';

import HomeContext from '@/pages/api/home/home.context';

import { WorkflowDefinitionFolders } from './components/WorkflowDefinitionFolders';
import {WorkflowDefinitionBarSettings} from "@/components/Workflow/components/WorfklowDefinitionBarSettings";
import { WorkflowDefinitions } from './components/WorkflowDefinitions';

import Sidebar from '../Sidebar';
import WorkflowDefinitionBarContext from "@/components/Workflow/WorkflowDefinitionBarContext";
import { WorkflowDefinitionBarInitialState, initialState } from "@/components/Workflow/WorkflowDefinitionBar.state";

import { v4 as uuidv4 } from 'uuid';

const WorkflowDefinitionBar = () => {
    const { t } = useTranslation('WorkflowDefinitionBar');

    const WorkflowDefinitionBarContextValue = useCreateReducer<WorkflowDefinitionBarInitialState>({
        initialState,
    });

    const {
        state: { workflows, defaultModelId },
        dispatch: homeDispatch,
        handleCreateFolder,
    } = useContext(HomeContext);

    const {
        state: { searchTerm, filteredWorkflows },
        dispatch: workflowDefinitionDispatch,
    } = WorkflowDefinitionBarContextValue;

    const handleCreateWorkflowDefinition = () => {

    };

    const handleDeleteWorkflowDefinition = (workflowDefinition: WorkflowDefinition) => {
        const updatedWorkflowDefinitions = workflows.filter((p) => p.id !== workflowDefinition.id);

        homeDispatch({ field: 'workflows', value: updatedWorkflowDefinitions });
        saveWorkflowDefinitions(updatedWorkflowDefinitions);
    };

    const handleUpdateWorkflowDefinition = (workflowDefinition: WorkflowDefinition) => {
        console.log("WorkflowDefinition updated:", workflowDefinition);

        const updatedWorkflowDefinitions = workflows.map((p) => {
            if (p.id === workflowDefinition.id) {
                return workflowDefinition;
            }

            return p;
        });
        homeDispatch({ field: 'workflows', value: updatedWorkflowDefinitions });

        saveWorkflowDefinitions(updatedWorkflowDefinitions);
    };

    const handleDrop = (e: any) => {
        if (e.dataTransfer) {
            const workflowDefinition = JSON.parse(e.dataTransfer.getData('workflowDefinition'));

            const updatedWorkflowDefinition = {
                ...workflowDefinition,
                folderId: e.target.dataset.folderId,
            };

            handleUpdateWorkflowDefinition(updatedWorkflowDefinition);

            e.target.style.background = 'none';
        }
    };

    useEffect(() => {
        if (searchTerm) {
            workflowDefinitionDispatch({
                field: 'filteredWorkflows',
                value: workflows.filter((workflowDefinition) => {
                    const searchable =
                        workflowDefinition.name.toLowerCase() +
                        ' ' +
                        workflowDefinition.description?.toLowerCase() +
                        ' ' +
                        workflowDefinition.tags.join(",").toLowerCase();
                    return searchable.includes(searchTerm.toLowerCase());
                }),
            });
        } else {
            workflowDefinitionDispatch({ field: 'filteredWorkflows', value: workflows });
        }
    }, [searchTerm, workflows]);

    return (
        <WorkflowDefinitionBarContext.Provider
            value={{
                ...WorkflowDefinitionBarContextValue,
                handleCreateWorkflowDefinition,
                handleDeleteWorkflowDefinition,
                handleUpdateWorkflowDefinition,
            }}
        >
            <Sidebar<WorkflowDefinition>
                side={'right'}
                isOpen={true}
                addItemButtonTitle={t('Workflow')}
                itemComponent={
                    <WorkflowDefinitions
                        workflows={filteredWorkflows.filter((workflowDefinition: WorkflowDefinition) => !workflowDefinition.folderId)}
                    />
                }
                folderComponent={<WorkflowDefinitionFolders />}
                items={filteredWorkflows}
                searchTerm={searchTerm}
                handleSearchTerm={(searchTerm: string) =>
                    workflowDefinitionDispatch({ field: 'searchTerm', value: searchTerm })
                }
                toggleOpen={()=>{}}
                handleCreateItem={handleCreateWorkflowDefinition}
                handleCreateFolder={() =>
                {
                    handleCreateFolder(t('New folder'), 'workflow')
                }}
                handleDrop={handleDrop}
            />
        </WorkflowDefinitionBarContext.Provider>
    );
};

export default WorkflowDefinitionBar;
