import { doRequestOp } from "./doRequestOp";

interface FunctionParams {
  name?: string;
  description?: string;
  version?: string;
}

interface CreatePythonFunctionParams {
  functionName: string;
  functionDescription: string;
  libraries?: Array<{ name: string; version?: string }>;
  notes?: string;
}

const URL_PATH = "/se";
const AMP_PATH = "/amp";
const SERVICE_NAME = "softwareEngineer";

export const createPythonFunction = async (params: CreatePythonFunctionParams) => {
  const op = {
    method: 'POST',
    data: params,
    path: URL_PATH,
    op: "/create-python-function",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}

export const registerPythonFunction = async (functionName: string, code: string) => {
  const op = {
    method: 'POST',
    data: { function_name: functionName, code },
    path: URL_PATH,
    op: "/functions/register-python-function",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}

export const listUserFunctions = async () => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: "/functions/list",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}

export const publishFunction = async (functionUuid: string, path: string,
  version: string = 'v1', assistantAccessible: boolean = true, access: 'public' | 'private' = 'public') => {
  const op = {
    method: 'POST',
    data: {
      function_uuid: functionUuid,
      path,
      version,
      assistantAccessible,
      access
    },
    path: AMP_PATH,
    op: "/publish",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}

export const unpublishFunction = async (path: string, version: string) => {
  const op = {
    method: 'POST',
    data: { path, version },
    path: AMP_PATH,
    op: "/unpublish",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}

export const listPublishedFunctions = async () => {
  const op = {
    method: 'GET',
    path: AMP_PATH,
    op: "/list",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}

export const updateFunctionSchema = async (functionUuid: string, inputSchema: object) => {
  const op = {
    method: 'POST',
    data: {
      function_uuid: functionUuid,
      input_schema: inputSchema
    },
    path: URL_PATH,
    op: "/update_function_schema",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}

export const updateFunctionCode = async (functionUuid: string, code: string) => {
  const op = {
    method: 'POST',
    data: {
      function_uuid: functionUuid,
      code
    },
    path: URL_PATH,
    op: "/update_function_code",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}

export const getFunctionCode = async (functionUuid: string) => {
  const op = {
    method: 'POST',
    data: { function_uuid: functionUuid },
    path: URL_PATH,
    op: "/get_function_code",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}

export const getFunctionMetadata = async (functionUuid: string) => {
  const op = {
    method: 'POST',
    data: { function_uuid: functionUuid },
    path: URL_PATH,
    op: "/get_function_metadata",
    service: SERVICE_NAME
  };
  return await doRequestOp(op);
}
