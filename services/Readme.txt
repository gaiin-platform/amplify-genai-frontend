How to make Request to Amplify back end:


1. Define a Service with the variable URL_PATH at the top, this will be the common path used within the services in the files

    const URL_PATH = '/common_path'; 


2. Use the function doRequestOp(payload) The payload must look like the following:

        interface opData {
            // env base api url is used if not provided
            url?: string; // used for running localhost or sending request to another url
            method: string,
            path: string;
            op: string;
            data?: any;
            queryParams?: queryParams;
        }

        interface queryParams { 
            [key: string]: string;
        }


3. example uses:
    A. request to amplify api backend 
    export const getAccounts = async () => {
        const op = {
            method: 'GET',
            path: URL_PATH,
            op: "/get",
        };
        return await doRequestOp(op);
    }


    B. request to local host with query params
    export const deletePptx = async (templateName: string) => {
        const op = {
            url: "http://localhost:3016/dev",
            method: 'DELETE',
            path: URL_PATH,
            op: "/pptx_templates/delete",
            queryParams: {"template_name": templateName}
        };
        return await doRequestOp(op);
    }
