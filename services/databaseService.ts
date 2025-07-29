import { doRequestOp } from "./doRequestOp";

const URL_PATH = "/db";
const SERVICE_NAME = "database";

export interface TestDatabaseConnectionParams {
    type: string;
    host?: string;
    port?: string | number;
    database: string;
    username?: string;
    password?: string;
    account?: string;
    warehouse?: string;
    schema?: string;
}

export interface TestDatabaseConnectionByIdParams {
    connection_id: string;
}

export interface SaveDatabaseConnectionParams {
    connection_name: string;
    type: string;
    host?: string | null;
    port?: string | number | null;
    database?: string;
    username?: string | null;
    password?: string | null;
    credentials?: string | null;
    project_id?: string | null;
    service_name?: string | null;
    account?: string | null;
    warehouse?: string | null;
    schema?: string | null;
}

export interface GetDatabaseConnectionsParams {
    user: string;
}

export const testDatabaseConnection = async (params: TestDatabaseConnectionParams | TestDatabaseConnectionByIdParams) => {
    // Check if we're testing by connection_id
    if ('connection_id' in params) {
        const op = {
            data: {
                connection_id: params.connection_id,
            },
            method: 'POST',
            path: URL_PATH,
            op: '/test-connection',
            service: SERVICE_NAME
        };

        return await doRequestOp(op);
    }

    // Original logic for testing with connection details
    const { type, host, port, database, username, password, account, warehouse, schema } = params as TestDatabaseConnectionParams;

    const config: Record<string, any> = {
        host,
        port: port ? parseInt(port as string, 10) : undefined,
        username,
        password,
    };
    if (account) config.account = account;
    if (warehouse) config.warehouse = warehouse;
    if (schema) config.schema = schema;
    Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);

    const op = {
        data: {
            type,
            database,
            config,
        },
        method: 'POST',
        path: URL_PATH,
        op: '/test-connection',
        service: SERVICE_NAME
    };

    return await doRequestOp(op);
};

export const saveDatabaseConnection = async (params: SaveDatabaseConnectionParams) => {
    const config: Record<string, any> = { ...params };
    Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);

    const op = {
        data: config,
        method: 'POST',
        path: URL_PATH,
        op: '/save-connection',
        service: SERVICE_NAME
    };

    return await doRequestOp(op);
};

export const getDatabaseConnections = async (params: GetDatabaseConnectionsParams) => {
    const op = {
        data: {},
        method: 'POST',
        path: URL_PATH,
        op: '/get-connections',
        service: SERVICE_NAME
    };

    return await doRequestOp(op);
}; 