import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import React from "react";


interface FormProps {
    form: Record<string,any>
    onChange: (key:string, value:any) => void
}


const JsonForm: React.FC<FormProps> = ({form,onChange}) => {

    const hiddenKeys = ["_id", "_title", "_dataSources", "_button", "args", "id"];

    const isSubForm = (index:any, key:string, value:any) => {
        try {
            if (typeof value === "string" && JSON.parse(value)) {
                value = JSON.parse(value);
            }
        } catch (e) {
            // Do nothing
        }

        return (typeof value === "object" && value !== null);
    }

    const getComponent = (index:any, key:string, value:any) => {

        try {
            if (typeof value === "string" && JSON.parse(value)) {
                value = JSON.parse(value);
            }
        } catch (e) {
            // Do nothing
        }

        if (key.startsWith("s_")){
            // Create a password field

            const isString = typeof value === "string";
            const strValue = isString ? value : JSON.stringify(value);

            return (
                <div className="text-sm text-gray-500 flex items-center space-x-2">
                    <label className="w-24">{key.substring(2)}:</label>
                    <input
                        type="password"
                        className="mt-2 w-96 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                        value={strValue}
                        onChange={(e) => {
                            onChange(key, e.target.value);
                        }}
                    />
                </div>
            );
        }
        // Check if the value is a map
        else if (typeof value === "object" && value !== null) {
            return (
                <ExpansionComponent title={key} content={<JsonForm
                    onChange={(ckey:string, cvalue:any) => {
                          value[ckey] = cvalue;
                          onChange(key, value);
                    }}
                    form={value}/>}/>
            );
        }
        else {
            return (
                <div className="text-sm text-gray-500 flex items-center space-x-2">
                    <label className="w-24">{key}:</label>
                    <input
                        className="mt-2 w-96 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                        value={value}
                        onChange={(e) => {
                            let newValue = e.target.value;
                            try {
                                newValue = JSON.parse(e.target.value);
                            } catch (e) {
                                // Do nothing
                            }
                            // @ts-ignore
                            onChange(key, newValue);
                        }}
                    />
                </div>
            );
        }

    }

    // @ts-ignore
    return (<div>
                    <>
                        <div className="flex flex-col w-full mb-5">
                            {Object.entries(form)
                                .filter(([key, value]) => !hiddenKeys.includes(key))
                                .sort(([key1, value1], [key2, value2]) => {
                                  // Put non-forms first
                                    if (isSubForm(0, key1, value1) && !isSubForm(0, key2, value2)) {
                                        return 1;
                                    } else if (!isSubForm(0, key1, value1) && isSubForm(0, key2, value2)) {
                                        return -1;
                                    }
                                    return 0;
                                })
                                .map(([key, value], index) => {
                                    return getComponent(index, key, value);
                                })}
                        </div>
                    </>
            </div>);
};

export default JsonForm;
