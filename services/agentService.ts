import { doRequestOp } from "./doRequestOp";

const URL_PATH =  "/vu-agent";

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
    data: files
  };

  console.log("getFileDownloadUrls", files);

  return await doRequestOp(op);
}


