import React from "react";

interface Input {
    label: string;
    key: string;
    defaultValue: string;
    description?: string;
    placeholder?:string;
}

interface InputStates {
    [key: string]: string;
}

interface Props {
    id: string
    inputs: Input[];
    state: InputStates;
    inputChanged: (key: string, value: string) => void;
}

export const InputsMap: React.FC<Props> = ({ id, inputs, state, inputChanged }) => {
    return (
      <div className="mt-2 grid grid-cols-[auto_1fr]">
          {inputs.map((input: Input) => (
              <React.Fragment key={input.key}>
                  <label
                      htmlFor={`${id}-${input.key}`}
                      className="border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                      title={input.description}>
                      {input.label}
                  </label>
                  <input
                      id={`${id}-${input.key}`}
                      className="w-full rounded-r border border-neutral-500 px-4 py-1 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100"
                      placeholder={input.placeholder}
                      value={state[input.key]}
                      onChange={(e) => inputChanged(input.key, e.target.value)}
                  />
              </React.Fragment>
          ))}
      </div>
    );
  };
  

export default InputsMap;