import { doRequestOp } from "./doRequestOp";

/**
 * User Data Service - A comprehensive TypeScript client for the User Data API
 * ============================================================================
 *
 * Overview
 * --------
 * This service provides a type-safe interface for storing, retrieving, and querying user-specific
 * data in DynamoDB through a serverless API. It supports a hierarchical data model with applications,
 * entity types, and items, providing flexible storage options with support for range-based querying.
 *
 * Core Concepts
 * -------------
 * - appId: Unique identifier for your application (e.g., "todo-app", "note-taking", "inventory-system")
 * - entityType: Category of data you're storing (e.g., "tasks", "notes", "products", "users")
 * - itemId: Unique identifier for a specific data item within an entity type
 * - rangeKey: Optional secondary key for range-based queries and sorting (e.g., dates, priorities, categories)
 * - data: The actual JSON data to store for each item
 * - uuid: System-generated unique identifier automatically assigned to each item
 *
 * Data Structure
 * --------------
 * Under the hood, the service uses a DynamoDB table with a composite primary key:
 * - PK (Partition Key): "{appId}#{entityType}"
 * - SK (Sort Key): "{itemId}" or "{itemId}#{rangeKey}" if a range key is provided
 *
 * Authentication
 * --------------
 * All API requests are automatically authenticated using the access token managed by the doRequestOp
 * utility function. Your user credentials determine which data you can access.
 *
 * Usage Examples
 * --------------
 *
 * Example 1: Task Management System
 * ---------------------------------
 *
 * // Create a client for a task management application
 * const taskApp = createAppDataClient("task-manager");
 *
 * // Store tasks with priority as the range key
 * await taskApp.put("tasks", "task-123", {
 *   title: "Complete project proposal",
 *   description: "Draft the Q3 project proposal for client review",
 *   status: "in-progress",
 *   due: "2025-05-15",
 *   assignee: "jane@example.com"
 * }, "high");  // Using priority as range key
 *
 * // Create a collection client for tasks
 * const tasks = taskApp.collection("tasks");
 *
 * // Store another task
 * await tasks.put("task-456", {
 *   title: "Weekly team meeting",
 *   description: "Regular sync-up with the development team",
 *   status: "not-started",
 *   due: "2025-05-06",
 *   assignee: "john@example.com"
 * }, "medium");  // Using priority as range key
 *
 * // Query all tasks
 * const allTasks = await tasks.queryAll();
 *
 * // Query tasks with high priority by using the SK prefix
 * // This will find all tasks where SK begins with "high"
 * const highPriorityTasks = await tasks.queryPrefix("task-", 50);
 *
 * // Query tasks within a specific item ID range (e.g., alphabetical range)
 * const specificTasks = await tasks.queryRange("task-1", "task-2");
 *
 *
 * Example 2: E-commerce Inventory System
 * -------------------------------------
 *
 * const inventoryApp = createAppDataClient("inventory-system");
 *
 * // Store product information with category as prefix in itemId
 * await inventoryApp.put("products", "furniture:chair-101", {
 *   name: "Ergonomic Office Chair",
 *   price: 299.99,
 *   stockCount: 24,
 *   suppliers: ["supplier-a", "supplier-b"],
 *   lastStocked: "2025-04-28"
 * });
 *
 * // Store inventory transactions with date as range key
 * await inventoryApp.put("transactions", "prod-1001", {
 *   productId: "furniture:chair-101",
 *   type: "incoming",
 *   quantity: 10,
 *   receivedBy: "warehouse-staff-1"
 * }, "2025-04-28");  // Using date as range key
 *
 * // Query all furniture products using prefix
 * const furnitureProducts = await inventoryApp.queryPrefix("products", "furniture:", 100);
 *
 * // Query transactions within a date range
 * const aprilTransactions = await inventoryApp.queryRange("transactions", "2025-04-01", "2025-04-30");
 *
 *
 * Example 3: Healthcare Patient Records
 * ------------------------------------
 *
 * const healthApp = createAppDataClient("patient-records");
 *
 * // Store patient profile
 * await healthApp.put("patients", "patient-789", {
 *   name: "Alex Johnson",
 *   dob: "1985-03-15",
 *   contactInfo: {
 *     phone: "555-123-4567",
 *     email: "alex@example.com"
 *   },
 *   insuranceId: "INS-12345"
 * });
 *
 * // Store a medical visit record with visit type as range key
 * await healthApp.put("visits", "patient-789:2025-05-01", {
 *   doctor: "Dr. Smith",
 *   symptoms: ["fever", "cough"],
 *   diagnosis: "Common cold",
 *   prescriptions: ["medication-a", "medication-b"],
 *   followUpNeeded: true
 * }, "regular-checkup");
 *
 * // Query all visits for a specific patient using prefix (first part of the itemId)
 * const patientVisits = await healthApp.queryPrefix("visits", "patient-789:");
 *
 * // Get all visits within a date range based on part of the itemId
 * // Note: This works if the date is part of the itemId itself
 * const recentVisits = await healthApp.queryRange("visits", "patient-789:2025-04-01", "patient-789:2025-05-03");
 *
 * // Alternatively, use range key to filter by visit type
 * // This gets all checkups in the system regardless of patient
 * const allCheckups = await healthApp.queryPrefix("visits", "regular-checkup");
 *
 *
 * Data Modeling Patterns
 * -----------------------
 *
 * 1. Using Range Keys for Sorting and Filtering:
 *    - Range keys are optional but powerful for creating sorted collections
 *    - Example: Tasks with priority levels as range keys allow filtering by priority
 *    - In DynamoDB, these become part of the SK in format: "{itemId}#{rangeKey}"
 *
 * 2. Using Prefixes in Item IDs:
 *    - Embed category or parent information in the itemId using a prefix
 *    - Use queryPrefix to retrieve items with a specific prefix
 *    - Example: "product:electronics:phone-123" creates a hierarchy
 *
 * 3. Time-Based Data:
 *    - For time-series data, use ISO dates in the itemId or as rangeKey
 *    - Example: Daily metrics with itemId "metric-2025-05-03" or rangeKey "2025-05-03"
 *    - Use queryRange for date ranges, queryPrefix for all items in a month/year
 *
 * 4. Parent-Child Relationships:
 *    - Use prefixes to model ownership: "user-123:document-456"
 *    - Retrieve all children with queryPrefix("collection", "user-123:")
 *
 * 5. Composite Keys:
 *    - Combine multiple attributes in itemId or rangeKey using delimiters
 *    - Example: "region:east:customer:5001" allows various query patterns
 *
 * Common Query Patterns
 * --------------------
 *
 * 1. Get a single item by its exact ID:
 *    ```
 *    const task = await taskApp.get("tasks", "task-123");
 *    ```
 *
 * 2. Get all items of a specific type:
 *    ```
 *    const allProducts = await productApp.queryAll("products");
 *    ```
 *
 * 3. Get items with a common prefix:
 *    ```
 *    // Get all tasks for project X
 *    const projectTasks = await taskApp.queryPrefix("tasks", "project-x:", 100);
 *    ```
 *
 * 4. Get items within a range (useful for dates, alphabetical ranges):
 *    ```
 *    // Get transactions from April
 *    const aprilTransactions = await appClient.queryRange(
 *      "transactions",
 *      "2025-04-01",
 *      "2025-04-30",
 *      100
 *    );
 *    ```
 *
 * 5. Using range keys for secondary access patterns:
 *    ```
 *    // Get high priority tasks using range key filtering
 *    const highPriorityTasks = await taskApp.queryRange(
 *      "tasks",
 *      "high",
 *      "high"
 *    );
 *    ```
 *
 * Security and Performance Considerations
 * --------------------------------------
 *
 * - All data is isolated per user using the hash key pattern
 * - Queries are most efficient when using exact item IDs
 * - Prefix and range queries are also efficient but may return larger result sets
 * - Default query limit is 100 items, with a maximum of 1000
 * - Use batch operations for better performance when operating on multiple items
 * - The API handles float/Decimal conversions for proper storage in DynamoDB
 */


// Type definitions
interface UserDataItem {
    appId: string;
    entityType: string;
    itemId: string;
    data: any;
    rangeKey?: string;
    uuid?: string;
}

interface ItemIdentifier {
    itemId: string;
    rangeKey?: string;
}

interface PutItemParams {
    appId: string;
    entityType: string;
    itemId: string;
    data: any;
    rangeKey?: string;
}

interface GetItemParams {
    appId: string;
    entityType: string;
    itemId: string;
    rangeKey?: string;
}

interface DeleteItemParams {
    appId: string;
    entityType: string;
    itemId: string;
    rangeKey?: string;
}

interface BatchPutItemsParams {
    appId: string;
    entityType: string;
    items: Array<{
        itemId: string;
        data: any;
        rangeKey?: string;
    }>;
}

interface BatchGetItemsParams {
    appId: string;
    entityType: string;
    itemIds: Array<ItemIdentifier>;
}

interface BatchDeleteItemsParams {
    appId: string;
    entityType: string;
    itemIds: Array<ItemIdentifier>;
}

interface QueryByTypeParams {
    appId: string;
    entityType: string;
    limit?: number;
}

interface QueryByRangeParams {
    appId: string;
    entityType: string;
    rangeStart?: string;
    rangeEnd?: string;
    limit?: number;
}

interface QueryByPrefixParams {
    appId: string;
    entityType: string;
    prefix: string;
    limit?: number;
}

interface GetByUuidParams {
    uuid: string;
}

interface DeleteByUuidParams {
    uuid: string;
}

interface ListUserAppsParams {
    prefix?: string;
}

const URL_PATH = "/user-data";
const SERVICE_NAME = "userDataService";

// Single item operations
export const putItem = async (params: PutItemParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/put",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

export const getItem = async (params: GetItemParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/get",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

export const deleteItem = async (params: DeleteItemParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/delete",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

// Batch operations
export const batchPutItems = async (params: BatchPutItemsParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/batch-put",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

export const batchGetItems = async (params: BatchGetItemsParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/batch-get",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

export const batchDeleteItems = async (params: BatchDeleteItemsParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/batch-delete",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

// Query operations
export const queryByType = async (params: QueryByTypeParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/query-type",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

export const queryByRange = async (params: QueryByRangeParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/query-range",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

export const queryByPrefix = async (params: QueryByPrefixParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/query-prefix",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

// UUID-based operations
export const getByUuid = async (params: GetByUuidParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/get-by-uuid",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

export const deleteByUuid = async (params: DeleteByUuidParams) => {
    const op = {
        method: 'POST',
        data: params,
        path: URL_PATH,
        op: "/delete-by-uuid",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

// Application management
export const listUserApps = async (params?: ListUserAppsParams) => {
    const op = {
        method: 'POST',
        data: params || {},
        path: URL_PATH,
        op: "/list-apps",
        service: SERVICE_NAME
    };
    return await doRequestOp(op);
};

// Convenience function to create a standard app data storage API
export const createAppDataClient = (appId: string) => {
    return {
        // Store an item in a collection
        put: async (entityType: string, itemId: string, data: any, rangeKey?: string) => {
            return await putItem({ appId, entityType, itemId, data, rangeKey });
        },

        // Get an item from a collection
        get: async (entityType: string, itemId: string, rangeKey?: string) => {
            return await getItem({ appId, entityType, itemId, rangeKey });
        },

        // Delete an item from a collection
        delete: async (entityType: string, itemId: string, rangeKey?: string) => {
            return await deleteItem({ appId, entityType, itemId, rangeKey });
        },

        // Store multiple items in a collection
        batchPut: async (entityType: string, items: Array<{ itemId: string; data: any; rangeKey?: string }>) => {
            return await batchPutItems({ appId, entityType, items });
        },

        // Get multiple items from a collection
        batchGet: async (entityType: string, itemIds: Array<ItemIdentifier>) => {
            return await batchGetItems({ appId, entityType, itemIds });
        },

        // Delete multiple items from a collection
        batchDelete: async (entityType: string, itemIds: Array<ItemIdentifier>) => {
            return await batchDeleteItems({ appId, entityType, itemIds });
        },

        // Query all items of a type
        queryAll: async (entityType: string, limit?: number) => {
            return await queryByType({ appId, entityType, limit });
        },

        // Query items by range
        queryRange: async (entityType: string, rangeStart?: string, rangeEnd?: string, limit?: number) => {
            return await queryByRange({ appId, entityType, rangeStart, rangeEnd, limit });
        },

        // Query items by prefix
        queryPrefix: async (entityType: string, prefix: string, limit?: number) => {
            return await queryByPrefix({ appId, entityType, prefix, limit });
        },

        // Create a collection client for a specific entity type
        collection: (entityType: string) => {
            return {
                put: async (itemId: string, data: any, rangeKey?: string) => {
                    return await putItem({ appId, entityType, itemId, data, rangeKey });
                },

                get: async (itemId: string, rangeKey?: string) => {
                    return await getItem({ appId, entityType, itemId, rangeKey });
                },

                delete: async (itemId: string, rangeKey?: string) => {
                    return await deleteItem({ appId, entityType, itemId, rangeKey });
                },

                batchPut: async (items: Array<{ itemId: string; data: any; rangeKey?: string }>) => {
                    return await batchPutItems({ appId, entityType, items });
                },

                batchGet: async (itemIds: Array<ItemIdentifier>) => {
                    return await batchGetItems({ appId, entityType, itemIds });
                },

                batchDelete: async (itemIds: Array<ItemIdentifier>) => {
                    return await batchDeleteItems({ appId, entityType, itemIds });
                },

                queryAll: async (limit?: number) => {
                    return await queryByType({ appId, entityType, limit });
                },

                queryRange: async (rangeStart?: string, rangeEnd?: string, limit?: number) => {
                    return await queryByRange({ appId, entityType, rangeStart, rangeEnd, limit });
                },

                queryPrefix: async (prefix: string, limit?: number) => {
                    return await queryByPrefix({ appId, entityType, prefix, limit });
                }
            };
        }
    };
};