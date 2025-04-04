import { transformPayload } from "@/utils/app/data";

interface opData {
    // env base api url is used if not provided
    url?: string; // used for running localhost or sending request to another url
    method: string,
    path: string;
    op: string;
    data?: any;
    queryParams?: queryParams;
    service?: string // pass in .env.local file as "LOCAL_SERVICES" to run entire service locally
}

interface queryParams {
    [key: string]: string;
}

// Interface to map services to their ports
interface ServicePortMap {
    [key: string]: string;
}

function parseServiceConfig(serviceConfigStr: string): {
    services: string[];
    servicePorts: ServicePortMap;
    serviceStages: { [key: string]: string };
} {
    const services: string[] = [];
    const servicePorts: ServicePortMap = {};
    const serviceStages: { [key: string]: string } = {};

    if (!serviceConfigStr) return { services, servicePorts, serviceStages };

    const serviceConfigs = serviceConfigStr.split(',').map(s => s.trim());

    for (const config of serviceConfigs) {
        if (!config) continue;

        const [service, port, stage] = config.split(':');
        if (service) {
            services.push(service);
            if (port) servicePorts[service] = port;
            if (stage) serviceStages[service] = stage;
        }
    }

    return { services, servicePorts, serviceStages };
}

export const doRequestOp = async (opData: opData, abortSignal = null) => {
    const { service } = opData;

    if (typeof service === 'string') {
        const serviceConfigStr = process.env.NEXT_PUBLIC_LOCAL_SERVICES || '';
        const { services, servicePorts, serviceStages } = parseServiceConfig(serviceConfigStr);

        if (services.includes(service)) {
            const port = servicePorts[service] || '3015';
            const stage = serviceStages[service] || 'dev';

            opData.url = `http://localhost:${port}/${stage}${opData.path}${opData.op}`;
            console.log("Function running locally at:", opData.url);
            opData.path = "";
            opData.op = "";
        }
    }

    const request = `${opData.method} - ${opData.path + opData.op}`;
    // const obfuscatedPayload = transformPayload.encode(opData);
    if (opData.data) opData.data = transformPayload.encode(opData.data); // obfuscate data in payload
    if (opData.queryParams) Object.entries(opData.queryParams).map(([k, v]) => {
        if (opData.queryParams) opData.queryParams[k] = transformPayload.encode(v)
    }); // obfuscate query params in payload


    try {
        const response = await fetch('/api/requestOp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: abortSignal,
            body: JSON.stringify({ data: opData }),
        });

        if (response.ok) {
            try {
                const encodedResult = await response.json();
                // Decode response
                return transformPayload.decode(encodedResult.data);
            } catch (e) {
                return { success: false, message: `Error parsing response from ${request}.` };
            }
        } else {
            console.log(`Error calling.\n ${request}: ${response.statusText}.`);
            return { success: false, message: `Error calling ${request}: ${response.statusText}.` }
        }
    } catch (error) {
        console.log(`Network Error calling ${request}: ${error}.`);
        return { success: false, message: `Network Error calling ${request}: ${error}.` }
    }
}

/**
 * Parse the service:port mapping from environment variable
 * Format: "service1:3001,service2:3002,service3:3003"
 */
function parseServicePorts(portMapStr: string): ServicePortMap {
    if (!portMapStr) return {};

    const portMap: ServicePortMap = {};
    const pairs = portMapStr.split(',');

    pairs.forEach(pair => {
        const [service, port] = pair.trim().split(':');
        if (service && port) {
            portMap[service.trim()] = port.trim();
        }
    });

    return portMap;
}