
import JSZip from "jszip";
import { getFileExtensionFromLanguage, programmingLanguages } from "./codeblock";
import { AttachedDocument } from "@/types/attacheddocument";
import { addFile } from "@/services/fileService";
import toast from "react-hot-toast";



// download Artifact if extract the code blocks and make separate files for them, then put in a folder and save them all 
export const downloadArtifacts = (filename: string, content: string) => {

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Use the newly created extractCodeBlocksAndText function
    const { textBlocks, codeBlocks } = extractCodeBlocksAndText(content);
    const files: { name: string; content: string; type: string }[] = [];
    let hasCodeBlocks = codeBlocks.length > 0;

    // Handle text blocks
    if (textBlocks.length > 0) {
        const textContent = textBlocks.join('\n\n');

        if (!hasCodeBlocks) {
            // If only text and no code blocks, make it a .docx file
            files.push({
                name: `${filename}.docx`,
                content: textContent,
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
        } else {
            // Otherwise, add the text as a .txt file
            files.push({
                name: `${filename}_text.txt`,
                content: textContent,
                type: 'text/plain'
            });
        }
    }

    // Handle code blocks
    codeBlocks.forEach(block => {
        const extension = getFileExtensionFromLanguage(block.language); // Get the correct file extension from the map
        let mimeType = `text/${extension === 'js' ? 'javascript' : extension}`;

        // If the extension is unrecognized for MIME type, default to plain text
        if (!mimeType.startsWith('text/') && !mimeType.startsWith('application/')) {
            mimeType = 'text/plain';
        }

        files.push({
            name: `${filename}_${block.language}.${extension}`,
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
            downloadBlob(zipBlob, `${filename}.zip`);
        });
    }
};

// Function to separate code blocks and text content from a markdown string
export const extractCodeBlocksAndText = (content: string) => {
    const parts = content.split(/```(\w+)?/);
    const textBlocks: string[] = [];
    const codeBlocks: { language: string, code: string }[] = [];

    let textContent = '';

    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            // This is normal text content
            if (parts[i]) { // Check if parts[i] is not undefined
                textContent += parts[i].trim() + '\n\n';
            }
        } else {
            // This is a code block
            if (parts[i] && parts[i + 1]) { // Ensure both parts[i] and parts[i + 1] exist
                const language = parts[i].trim().toLowerCase();
                const codeContent = parts[i + 1].trim();
                i++; // Skip the next part as we've already processed it

                codeBlocks.push({
                    language,
                    code: codeContent
                });
            }
        }
    }

    if (textContent.trim()) {
        textBlocks.push(textContent.trim());
    }

    return { textBlocks, codeBlocks };
};







// Upload Artifact Function
export const uploadArtifact = async (filename: string, content: string, tags:string[]) => {
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
            },
            null, tags
        );

        console.log('File uploaded successfully:', response);

        return { response, contentUrl, metadataUrl, statusUrl };
    } catch (error) {
        console.error('Error uploading artifact:', error);
    }
};