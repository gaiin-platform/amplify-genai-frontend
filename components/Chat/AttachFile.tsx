import { IconPlus } from '@tabler/icons-react';
import {FC, useContext} from 'react';
import { getDocument, PDFDocumentProxy, Util } from './JsPDF'
import * as pdfjs from './JsPDF'
import readXlsxFile from 'read-excel-file'
import mammoth from "mammoth";
import { useTranslation } from 'next-i18next';
import JSZip from "jszip";
import { v4 as uuidv4 } from 'uuid';
import { AttachedDocument } from '@/types/attacheddocument';
import { addFile } from "@/services/fileService";
import HomeContext from "@/pages/api/home/home.context";
import useStatsService from "@/services/eventService";

interface Props {
    onAttach: (data: AttachedDocument) => void;
    onUploadProgress?: (data: AttachedDocument, progress: number) => void;
    onSetKey?: (data:AttachedDocument, key:string) => void;
    onSetAbortController?: (data:AttachedDocument, abortController:AbortController) => void;
    id:string;
}

const handleAsZip = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            if (e.target?.result) {
                try {
                    const zip = new JSZip();
                    // @ts-ignore
                    const contents = await zip.loadAsync(e.target.result);
                    const extractedFilesPromises: any[] = [];

                    contents.forEach(async (relativePath, zipEntry) => {

                        console.log("zipEntry", zipEntry);

                        if (!zipEntry.dir) {
                            extractedFilesPromises.push(
                                zipEntry.async('blob').then((blobContent) => {
                                    if (blobContent) {
                                        const file = new File([blobContent], relativePath);
                                        // @ts-ignore
                                        const handler = handlersByType[file.type] || handlersByType['*'];

                                        // @ts-ignore
                                        console.log(`${file.name}:${file.type}:${handler != null}`)

                                        return handler ? handler(file) : undefined;
                                    }
                                })
                            );
                        }
                    });

                    const extractedFiles = await Promise.all(extractedFilesPromises);

                    console.log("extractedFiles", extractedFiles);

                    resolve(extractedFiles);

                } catch (e) {
                    reject(new Error("Failed to extract zip file."));
                }
            } else {
                reject(new Error("Failed to read the file."));
            }
        };

        reader.onerror = (e) => {
            reject(new Error("Failed to read the file."));
        };

        reader.readAsArrayBuffer(file);
    });
};



const handlePdf = (file:any):Promise<AttachedDocument> => {
    return new Promise((resolve, reject) => {
    if (file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = async (e) => {
            if (typeof e.target?.result === "string") {
                pdfjs.GlobalWorkerOptions.workerSrc =
                    '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js';

                let loadingTask = getDocument(e.target.result);
                loadingTask.promise.then(async function(pdf: { numPages: number; getPage: (arg0: number) => any; }) {
                    // fetches data from each page
                    let allText = "";
                    let pages = [];
                    for (let i = 1; i <= pdf.numPages; i++) {
                        let text = '';
                        let page = await pdf.getPage(i);
                        let data = await page.getTextContent();
                        // @ts-ignore
                        let strings = data.items.map(item => item.str);
                        text += strings.join(' ');
                        pages.push(text);
                        allText += text;
                    }

                    resolve({id:uuidv4(), name:file.name, type:file.type, raw:allText, data:pages});
                }).catch((error: any) => {
                    reject(error);
                });
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    } else {
        reject(new Error("Unsupported file type. Please upload a PDF file."));
    }});
}


const handleAsDocx = (file:any) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const arrayBuffer = event.target?.result;
            if(arrayBuffer) {
                // @ts-ignore
                mammoth.extractRawText({arrayBuffer: arrayBuffer})
                    .then(function (result) {
                        const data = {id:uuidv4(), name:file.name, type:file.type, raw:result.value, data:result.value}
                        resolve(data); // The raw text
                    });
            }
        };

        reader.readAsArrayBuffer(file);
    });
}


const handleAsText = (processor:any, file: any):Promise<AttachedDocument> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            let result = (e.target?.result as string);
            let data = (processor) ? processor(result) : result;

            resolve({id:uuidv4(), name:file.name, type:file.type, raw:result, data:data});
        };
        reader.onerror = (e) => {
            reject(new Error("Failed to read the file."));
        };
        reader.readAsText(file);
    });
}


const handlersByType = {
    "application/zip": handleAsZip,
    "application/pdf":handlePdf,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":handleAsDocx,
    "application/json":(file:any)=>{return handleAsText(JSON.parse, file)},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":(file:any)=>{
        console.log("Read excel");
      return readXlsxFile(file).then((value)=>{
         console.log("Rows:"+value.length);
         return {name:file.name, type:file.type, raw:value, data:value};
      });
    },
    "*":(file:any)=>{return handleAsText(null, file)}
}

const handleFile = async (file:any,
                          onAttach:any,
                          onUploadProgress:any,
                          onSetKey:any,
                          onSetAbortController:any,
                          uploadDocuments:boolean,
                          extractDocumentsLocally:boolean) => {

    try {
        let type:string = file.type;

        let size = file.size;

        let document:AttachedDocument = {id:uuidv4(), name:file.name, type:file.type, raw:"", data:""};



        const enforceMaxFileSize = false;
        if(extractDocumentsLocally && (size < 524289 || !enforceMaxFileSize)){
            // @ts-ignore
            let handler = handlersByType[type] || handlersByType['*'];
            document = await handler(file);
        }
        else if(extractDocumentsLocally && !uploadDocuments) {
            alert("This file is too large to send in a prompt.");
            return;
        }

        if (Array.isArray(document)) {
            document.forEach(
                (doc)=>onAttach(doc)
            )
        } else {
            onAttach(document);
        }

        if(uploadDocuments) {
            try {

                const {key, response, abortController} = await addFile({id: uuidv4(), name: file.name, raw: "", type: file.type, data: ""}, file,
                    (progress: number) => {
                        if (onUploadProgress) {
                            onUploadProgress(document, progress);
                        }
                    });

                if(onSetAbortController) {
                    onSetAbortController(document, abortController);
                }

                if (onSetKey) {
                    document.key = key;
                    onSetKey(document, key);
                }

                await response;
            }
            catch (e) {
                // @ts-ignore
                if(e.message !== 'Abort') {
                    alert("upload failed");
                }
            }
        }
        else {
            onUploadProgress(document, 100);
        }

        // Process the document...
        //alert("Processed: "+ document.type +" : dataType? " + (typeof document.data) + " hasRaw? "+ (document.raw != null));

    } catch (error) {
        console.error("Failed to handle file:", error);
    }
}

export const AttachFile: FC<Props> = ({id, onAttach, onUploadProgress,onSetKey , onSetAbortController}) => {
    const { t } = useTranslation('sidebar');

    const {state: { featureFlags } } = useContext(HomeContext);

    const uploadDocuments = featureFlags.uploadDocuments
    const extractDocumentsLocally = featureFlags.extractDocumentsLocally;

    const statsService = useStatsService();

    return (
        <>
            <input
                id={id}
                className="sr-only"
                tabIndex={-1}
                type="file"
                accept="*"
                onChange={(e) => {
                    if (!e.target.files?.length) return;
                    const file = e.target.files[0];

                    statsService.attachFileEvent(file, uploadDocuments, extractDocumentsLocally);

                    handleFile(file, onAttach, onUploadProgress, onSetKey, onSetAbortController, uploadDocuments, extractDocumentsLocally);

                    e.target.value = "";
                }}
            />

            <button
                className="left-2 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                onClick={() => {
                    const importFile = document.querySelector(
                        '#'+id,
                    ) as HTMLInputElement;
                    if (importFile) {
                        importFile.click();
                    }
                }}
                onKeyDown={(e) => {}}
            >
                <IconPlus size={20} />
            </button>

        </>
    );
};
