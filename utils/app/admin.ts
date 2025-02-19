import {AdminTab, AdminConfigTypes, adminDataTabMap} from "@/types/admin"
import SparkMD5 from 'spark-md5';


export function adminTabHasChanges(changes: AdminConfigTypes[], admin_tab: AdminTab) {
    // filter changes from othertabs 
    const filteredChanges = changes.filter((change: AdminConfigTypes) => adminDataTabMap[admin_tab].includes(change));
    return filteredChanges.length > 0;
  }


export async function uploadFileAsAdmin(presignedUrl: string, file: File, content_md5: string, headers?: {[k:string]:string} ) {
    try {

        const response = await fetch(presignedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
                'Content-MD5': content_md5,
                ...(headers ?? {})
                
            },
            body: file,
        });
        if (!response.ok) {
            console.error("Upload file for admin interface failed");
            return false;
        }
        return true;
    } catch (error) {
        console.log("error uploading file " + error)
        return false;
    }
}

export async function calculateMd5(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const arrayBuffer = event?.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
                return reject('Error reading file');
            }
            // Directly hash the ArrayBuffer
            const md5Hash = SparkMD5.ArrayBuffer.hash(arrayBuffer);

            // base64:
            const binaryString = hexToBinary(md5Hash);
            // If running in browser (React), it's safe to use btoa:
            const base64Hash = btoa(binaryString);
            resolve(base64Hash);
        };

        reader.onerror = (error) => {
            reject(`Error reading file: ${error}`);
        };

        reader.readAsArrayBuffer(file);
    });
}

function hexToBinary(hex: string): string {
    let binary = '';
    for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.slice(i, i + 2), 16);
        binary += String.fromCharCode(byte);
    }
    return binary;
}