import {JsonSchema} from "@/types/chat";


export type DataType = 'string' | 'number' | 'integer' | 'boolean';

export interface ColumnsSpec {
    [key: string]: DataType;
}

export const generateCSVSchema = (columns:ColumnsSpec):JsonSchema => {
    const properties = Object.keys(columns).reduce<Record<string, { type: DataType }>>(
        (props, columnName) => {
            // Get the type of the column or default to 'string' if not specified
            const type: DataType = columns[columnName] || 'string';
            props[columnName] = { type };
            return props;
        },
        {}
    );

    const schema: JsonSchema = {
        type:'object',
        properties: {
            rows: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: properties,
                    required: Object.keys(columns)
                }
            }
        },
        required: ['rows']
    };

    return schema;
}

