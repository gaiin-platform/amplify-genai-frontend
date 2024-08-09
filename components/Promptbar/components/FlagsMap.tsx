import {SortType} from "@/types/folder";


interface Flag {
    label: string;
    key: string;
    defaultValue: boolean;
}

interface FlagStates {
    [key: string]: boolean;
}

interface Props {
    flags: Flag[];
    state: FlagStates;
    flagChanged: (key: string, value: boolean) => void;
}


export const FlagsMap = ({flags, state, flagChanged}: Props) => {
    return (<div>
            {flags.map((flag, index) => {
              return (
                <div key={index} className="flex flex-row p-2">
                  <input
                        type="checkbox"
                        key=""
                        value=""
                        className="mr-2"
                        checked={state[flag.key]}
                        onChange={(e) => {
                            e.stopPropagation();
                            flagChanged(flag.key, e.target.checked);
                        }}
                  />
                  <span>{flag.label}</span>
                </div>);
            })}
        </div>)
}

export default FlagsMap;