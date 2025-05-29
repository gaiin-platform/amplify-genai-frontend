import React, { useEffect, useState } from "react";
import ActionButton from "./ActionButton";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

interface Input {
    label: string;
    key: string;
    description?: string;
    placeholder?:string;
    disabled?: boolean;
}

interface InputStates {
    [key: string]: string;
}

interface Props {
    id: string
    inputs: Input[];
    state: InputStates;
    inputChanged: (key: string, value: string) => void;
    splitView?: boolean;
    obscure?:boolean
}

export const InputsMap: React.FC<Props> = ({ id, inputs, state, inputChanged, splitView = false, obscure = false }) => {
    // Optionally split the inputs into two halves if twoColumns is true
    const half = Math.ceil(inputs.length / 2);
    const leftInputs = splitView ? inputs.slice(0, half) : inputs;
    const rightInputs = splitView ? inputs.slice(half) : [];
    const [showKeys, setShowKeys] = useState<string[]>([]);
  
    return (
      <div className={`mt-2 grid ${splitView ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {[leftInputs, rightInputs].map((columnInputs, colIndex) => (
          <div key={colIndex} className="grid grid-cols-[auto_1fr] mr-2">
            {columnInputs.map((input: Input) => (
              <React.Fragment key={input.key}>
                <label
                  htmlFor={`${id}-${input.key}`}
                  className="border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                  title={input.description}
                >
                  {input.label}
                </label>
                
                  { (obscure && !showKeys.includes(input.key)) && state[input.key] ?
                  <div className="w-full rounded-r border border-neutral-500 flex flex-row gap-4 items-center dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50">
                  <ActionButton
                      handleClick={() => setShowKeys([...showKeys, input.key])}
                      id="showSecret"
                      title={"Show Secret"}>
                      <IconEye size={20}/>
                  </ActionButton>
                    {'*'.repeat(state[input.key].length)}
                  </div>
                  :
                  <div className="w-full rounded-r border border-neutral-500 flex items-center dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50">
                  {obscure && 
                    <ActionButton
                      handleClick={() => setShowKeys(showKeys.filter((k:string) => k !== input.key))}
                      id="hideSecret"
                      title={"Hide Secret"}>
                      <IconEyeOff size={20}/>
                    </ActionButton>
                  }
                  <input
                    disabled={input.disabled}
                    id={`${id}-${input.key}`}
                    className="w-full border-0 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 focus:outline-none"
                    placeholder={input.placeholder}
                    value={state[input.key]}
                    onChange={(e) => {
                      if (!state[input.key]) setShowKeys([...showKeys, input.key]);
                      inputChanged(input.key, e.target.value)
                    }}
                  />
                </div>
                 }

              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    );
  };
  

export default InputsMap;