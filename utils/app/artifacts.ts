
import JSZip from "jszip";
import { CodeBlockDetails } from "./codeblock";
import { AttachedDocument } from "@/types/attacheddocument";
import { addFile } from "@/services/fileService";
import toast from "react-hot-toast";
import { getFileMimeTypeFromLanguage } from "./fileTypeTranslations";
import { convert, ConversionOptions } from "@/services/downloadService";
import { LatestExportFormat } from "@/types/export";
import { Conversation } from "@/types/chat";

const sanitizeFilename = (filename: string): string => {
    // Remove or replace characters that are problematic in filenames
    // Keep: letters, numbers, dots, hyphens, underscores, spaces
    return filename
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Replace illegal characters with underscore
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^\.+/, '') // Remove leading dots
        .trim();
};

const downloadBlob = (blob: Blob, filename: string) => {
        const sanitized = sanitizeFilename(filename);
        console.log(`[DOWNLOAD] Original: "${filename}" -> Sanitized: "${sanitized}"`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = sanitized;
        a.click();
        URL.revokeObjectURL(url);
    };

// download Artifact if extract the code blocks and make separate files for them, then put in a folder and save them all
export const downloadArtifacts = async (artifactName: string, textContent: string, codeBlocks: CodeBlockDetails[]) => {
    const files: { name: string; content: string; type: string }[] = [];
    const codeOnlyBlocks = codeBlocks.filter((block: CodeBlockDetails) => block.extension !== '.txt');
    let hasCodeBlocks = codeOnlyBlocks.length > 0;


    if (!hasCodeBlocks) {
        // If only text and no code blocks, convert to proper .docx file using the conversion service. Otherwise, download the code blocks too (zip).
        try {
            console.log("Text content: ", textContent);
            // Match the already existing format for conversation downloads here.
            const exportedConversations: Conversation[] = [{
                id: artifactName,
                name: artifactName,
                messages: [{
                    role: 'assistant',
                    content: textContent
                }],
                model: { id: 'artifact', name: 'Artifact' },
                prompt: '',
                temperature: 0.5,
                folderId: '',
                promptTemplate: null
            } as Conversation];

            const downloadData = {
                version: 4,
                history: exportedConversations,
                folders: [],
                prompts: [],
            } as LatestExportFormat;

            const conversionOptions: ConversionOptions = {
                assistantHeader: "",
                conversationHeader: "",
                format: "docx",
                messageHeader: "",
                userHeader: "",
                includeConversationName: false
            };

            const result = await convert(conversionOptions, downloadData);
            console.log("[DOWNLOAD] Conversion result:", result);

            if (result.success) {
                const downloadUrl = result.data.url;
                console.log("[DOWNLOAD] Download URL:", downloadUrl);

                // Check if the file is ready and download it
                const checkReady = async (url: string, triesLeft: number = 60): Promise<void> => {
                    try {
                        const response = await fetch(url);
                        console.log("[DOWNLOAD] Fetch response status:", response.status, response.statusText);
                        if (response.ok) {
                            // Create a temporary anchor element to trigger download
                            const blob = await response.blob();
                            console.log("[DOWNLOAD] Downloaded blob size:", blob.size, "type:", blob.type);
                            downloadBlob(blob, `${artifactName}.docx`);
                        } else if (triesLeft > 0) {
                            setTimeout(() => checkReady(url, triesLeft - 1), 1000);
                        } else {
                            console.error("Unable to download. Please check your Internet connection and try again.");
                            // Fallback to plain text download
                            const blob = new Blob([textContent], { type: 'text/plain' });
                            downloadBlob(blob, `${artifactName}.txt`);
                        }
                    } catch (e) {
                        console.error("Failed to reach the download service:", e);
                        // Fallback to plain text download
                        const blob = new Blob([textContent], { type: 'text/plain' });
                        downloadBlob(blob, `${artifactName}.txt`);
                    }
                };

                await checkReady(downloadUrl);
            } else {
                console.error("Failed to reach the download service.");
                // Fallback to plain text download
                const blob = new Blob([textContent], { type: 'text/plain' });
                downloadBlob(blob, `${artifactName}.txt`);
            }
        } catch (error) {
            console.error("Error during artifact download:", error);
            // Fallback to plain text download
            const blob = new Blob([textContent], { type: 'text/plain' });
            downloadBlob(blob, `${artifactName}.txt`);
        }
    } else {
        // Handle code blocks
        codeBlocks.forEach(block => {
            const extension = block.extension;
            let mimeType = getFileMimeTypeFromLanguage(block.language);

            const fileName = block.filename ?? `${artifactName}_${block.language}${extension}`;

            files.push({
                name: fileName,
                content: block.code,
                type: mimeType
            });
        });

        if (files.length === 1) {
            // If there's only one file, download it directly
            const file = files[0];
            const blob = new Blob([file.content], { type: file.type });
            downloadBlob(blob, file.name);
        } else if (files.length > 1) {
            // Create a proper ZIP file using JSZip
            const zip = new JSZip();
            files.forEach(file => {
                zip.file(file.name, file.content);
            });

            zip.generateAsync({ type: "blob" }).then((zipBlob) => {
                downloadBlob(zipBlob, `${artifactName}.zip`);
            });
        }
    }
};





// Upload Artifact Function
export const uploadArtifact = async (filename: string, content: string, tags:string[], ragEnabled: boolean = true) => {
    try {
        // Create the file object from the content and type
        const fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const blob = new Blob([content], { type:  fileType});
        const file = new File([blob], `${filename}.docx`, { type: fileType });

        // Prepare metadata for the file
        const metadata: AttachedDocument = {
            id: '',
            name: filename,
            raw: null,
            type: fileType,
            data: null,
        };

        // Call the addFile function, passing metadata, the file, and onProgress
        const { response, contentUrl, metadataUrl, statusUrl } = await addFile(
            {...metadata},
            file,
            (progress: number) => {
                if (progress === 100) {
                    // Trigger a toast when upload reaches 100%
                    toast('File uploaded successfully'); 
                }
            }, ragEnabled, tags
        );

        console.log('File uploaded successfully:', response);

        return { response, contentUrl, metadataUrl, statusUrl };
    } catch (error) {
        console.error('Error uploading artifact:', error);
    }
};


export const inferArtifactType = (content: string) => {
    switch (true) {
        case (/import\s+React|useState|useEffect|<\w+\s|return\s*\(\s*<|React\./.test(content)):
            return 'react';
        case (/document\.|addEventListener|setTimeout|fetch|console\./.test(content)):
            return 'static';
        case (/^\s*{[\s\S]*}\s*$|^\s*\[[\s\S]*\]\s*$/.test(content)): // Matches JSON objects or arrays
            return 'json';
        case (/^.+(,|\t).+$/m.test(content)):
            return 'csv';
        case (/^<svg[\s\S]*<\/svg>$/.test(content)): 
            return 'svg';
        default:
            return 'text';
    }
}