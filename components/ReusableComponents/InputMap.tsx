import React from "react";

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
}

export const InputsMap: React.FC<Props> = ({ id, inputs, state, inputChanged, splitView = false }) => {
    // Optionally split the inputs into two halves if twoColumns is true
    const half = Math.ceil(inputs.length / 2);
    const leftInputs = splitView ? inputs.slice(0, half) : inputs;
    const rightInputs = splitView ? inputs.slice(half) : [];
  
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
                <input
                 disabled={input.disabled}
                  id={`${id}-${input.key}`}
                  className="w-full rounded-r border border-neutral-500 px-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                  placeholder={input.placeholder}
                  value={state[input.key]}
                  onChange={(e) => inputChanged(input.key, e.target.value)}
                />
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    );
  };
  

export default InputsMap;