import React, { useState, ChangeEvent } from 'react';

interface Option {
    value: string;
    label: string;
}

interface FieldData {
    type: string;
    description: string;
    options?: Option[];
    default?: string | number;
}

interface EditableFieldProps {
    data: FieldData;
    currentValue: any;
    handleUpdate: (value: string | number[] | undefined) => void;
}

const EditableField: React.FC<EditableFieldProps> = ({ data, currentValue, handleUpdate }) => {
    let startValue = (currentValue)?  currentValue : data.default;

    const [value, setValue] = useState<any>(startValue);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let newValue = event.target.value;
        let parsedValue: any = newValue;

        // Perform validation based on the type
        if (data.type === 'regex') {
            try {
                new RegExp(newValue); // Check if the regex is valid
                setErrorMessage('');
            } catch (error) {
                setErrorMessage('Invalid regex pattern');
            }
        } else if (data.type === 'integer') {
            // Restrict input to positive integers
            newValue = newValue.replace(/\D/g, ''); // Remove non-digit characters
            const integerValue = parseInt(newValue, 10);
            newValue = isNaN(integerValue) || integerValue <= 0 ? '' : integerValue.toString();
            parsedValue = isNaN(integerValue) || integerValue <= 0 ? 0 : integerValue;
        } else if (data.type === 'list') {
            // Convert comma-separated values into an array
            parsedValue = newValue.split(',').map((item) => item.trim());
        }

        setValue(newValue);
        handleUpdate(parsedValue); // Call handleUpdate prop with the new value
    };

    // Render different input elements based on the type
    let inputElement: JSX.Element | null = null;
    if (data.type === 'integer' || data.type === 'decimal' || data.type === 'text') {
        inputElement = (
            <input
                type="text"
                value={value}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
            />
        );
    } else if (data.type === 'options' && data.options) {
        inputElement = (
            <select
                value={value}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
            >
                {data.options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        );
    } else if (data.type === 'regex') {
        inputElement = (
            <div>
                <input
                    type="text"
                    value={value}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                />
                {errorMessage && <span style={{ color: 'red' }}>{errorMessage}</span>}
            </div>
        );
    } else if (data.type === 'list') {
        inputElement = (
            <input
                type="text"
                value={value}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
            />
        );
    }

    return (
        <div>
            {inputElement}
            <div>{data.description}</div>
        </div>
    );
};

export default EditableField;