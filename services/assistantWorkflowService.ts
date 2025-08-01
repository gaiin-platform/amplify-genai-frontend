import { AstWorkflowTemplate } from "@/types/assistantWorkflows";
import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/vu-agent";
const SERVICE_NAME = "workflows";

/**
 * Register a new workflow template
 */
export const registerAstWorkflowTemplate = async (
  template: AstWorkflowTemplate,
  name: string,
  description: string,
  inputSchema: object = {},
  outputSchema: object = {},
  isBaseTemplate: boolean = false,
  isPublic: boolean = false
) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/register-workflow-template",
    data: {
      template,
      name,
      description,
      inputSchema,
      outputSchema,
      isBaseTemplate,
      isPublic
    },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * Get a workflow template by ID
 */
export const getAstWorkflowTemplate = async (templateId: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/get-workflow-template",
    data: { templateId },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};

/**
 * List all workflow templates for the current user
 */
export const listAstWorkflowTemplates = async (filterBaseTemplates: boolean = false, includePublicTemplates: boolean = false) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/list-workflow-templates",
    data: { filterBaseTemplates, includePublicTemplates },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};



export const deleteAstWorkflowTemplate = async (templateId: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/delete-workflow-template",
    data: { templateId },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};



export const updateAstWorkflowTemplate = async (
  templateId: string,
  template: AstWorkflowTemplate,
  name: string,
  description: string,
  inputSchema: object = {},
  outputSchema: object = {},
  isBaseTemplate: boolean = false,
  isPublic: boolean = false
) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/update-workflow-template",
    data: {
      templateId,
      template,
      name,
      description,
      inputSchema,
      outputSchema,
      isBaseTemplate,
      isPublic
    },
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
};