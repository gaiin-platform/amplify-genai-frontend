
import JSZip from "jszip";
import { CodeBlockDetails } from "./codeblock";
import { AttachedDocument } from "@/types/attacheddocument";
import { addFile } from "@/services/fileService";
import toast from "react-hot-toast";
import { getFileMimeTypeFromLanguage } from "./fileTypeTranslations";

const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

// download Artifact if extract the code blocks and make separate files for them, then put in a folder and save them all 
export const downloadArtifacts = (artifactName: string, textContent: string, codeBlocks: CodeBlockDetails[]) => {
    const files: { name: string; content: string; type: string }[] = [];
    const codeOnlyBlocks = codeBlocks.filter((block: CodeBlockDetails) => block.extension !== '.txt');
    let hasCodeBlocks = codeOnlyBlocks.length > 0;


    if (!hasCodeBlocks) {
        // If only text and no code blocks, make it a .docx file
        files.push({
            name: `${artifactName}.docx`,
            content: textContent,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
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
    }


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