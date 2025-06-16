import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/vu-agent";
const SERVICE_NAME = "agent";

export interface FileDownloadOptions {
  sessionId: string;
  files: string[];
  version_timestamp?: string | null;
}

export const getFileDownloadUrls = async (files: FileDownloadOptions) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/get-file-download-urls",
    data: files,
    service: SERVICE_NAME
  };

  console.log("getFileDownloadUrls", files);

  return await doRequestOp(op);
}

export const getAgentTools = async () => {
  const op = {
    method: 'GET',
    path: URL_PATH,
    op: "/tools",
    service: SERVICE_NAME
  };

  return await doRequestOp(op);
}

export const getLatestAgentState = async (sessionId: string) => {
  const op = {
    method: 'POST',
    path: URL_PATH,
    op: "/get-latest-agent-state",
    service: SERVICE_NAME,
    data: { sessionId }
  };
  return await doRequestOp(op);
}


