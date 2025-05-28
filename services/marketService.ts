import { doRequestOp } from "./doRequestOp";
import { ExportFormatV4 } from "@/types/export";

const URL_PATH = "/market";
const SERVICE_NAME = "market";

const failureResponse = (reason: string) => {
    return {
        success: false,
        message: reason,
        data: {}
    }
}

const doMarketOp = async (opName: string, data: any, errorHandler = (e: any) => { }) => {
    const op = {
        data: data,
        op: opName
    };

    const response = await fetch('/api/market/op', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: null,
        body: JSON.stringify(op),
    });

    if (response.ok) {
        try {
            const result = await response.json();

            return result;
        } catch (e) {
            return { success: false, message: "Error parsing response." };
        }
    }
    else {
        return { success: false, message: `Error calling assistant: ${response.statusText} .` }
    }
}

const serviceHook = (opName: string) => {

    return async (requestData: any) => {
        console.log(`${opName} request:`, requestData);

        const { success, message, data } = await doMarketOp(
            opName,
            requestData);

        console.log(`${opName} response:`, success, message, data);

        if (!success) {
            return failureResponse(message);
        }

        return { success: true, message: `${opName} success.`, data: data };
    }
}

export const getCategory = async (category: string) => {

    const { success, message, data } = await doMarketOp(
        '/category/get',
        { category: category });

    if (!success) {
        return failureResponse(message);
    }

    return { success: true, message: "Category fetched successfully.", data: data };
}

export const getCategories = async () => {

    const { success, message, data } = await doMarketOp(
        '/category/list',
        {});

    if (!success) {
        return failureResponse(message);
    }

    return { success: true, message: "Category fetched successfully.", data: data };
}

export const getItem = async (id: string) => {
    try {
        const service = serviceHook('/item/get');
        return await service({ id: id });
    } catch (e) {
        return failureResponse("Error fetching item.");
    }
}

export const deleteItem = async (id: string) => {
    try {
        const service = serviceHook('/item/delete');
        return await service({ id: id });
    } catch (e) {
        return failureResponse("Error deleting item.");
    }
}

export const getItemExamples = async (category: string, id: string) => {
    try {
        const service = serviceHook('/item/examples/get');
        return await service({ id: id, category: category });
    } catch (e) {
        return failureResponse("Error fetching item examples.");
    }
}

export const publish = async (
    name: string,
    description: string,
    category: string,
    tags: string[],
    content: ExportFormatV4) => {

    const { success, message, data } = await doMarketOp(
        '/item/publish',
        {
            name: name,
            description: description,
            category: category,
            tags: tags,
            content: content
        });


    if (!success) {
        return failureResponse(message);
    }

    return { success: true, message: "Published item successfully.", data: data };
}
