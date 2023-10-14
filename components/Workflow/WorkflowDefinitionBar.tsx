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
        handleNewConversation
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

    const handleRunWorkflowDefinition = (workflowDefinition: WorkflowDefinition) => {

    }

    const dateTimeString = () => {
        let date = new Date();

        let month = ('0' + (date.getMonth() + 1)).slice(-2); // getMonth() starts from 0, so add 1
        let day = ('0' + date.getDate()).slice(-2);
        let year = date.getFullYear().toString().substr(-2); // take the last 2 digit of the year

        let hours = ('0' + date.getHours()).slice(-2);
        let minutes = ('0' + date.getMinutes()).slice(-2);

        let formattedDate = `${month}/${day}/${year} ${hours}:${minutes}`;
        return formattedDate;
    }

    const handleRunWorkflow = (workflowDefinition: WorkflowDefinition) => {
        handleNewConversation(
            {
                name: workflowDefinition.name + " @" +dateTimeString(),
                messages: [],
                workflowDefinition: workflowDefinition,
                processors: [],
                tools:[],
            })
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
                handleRunWorkflow,
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
