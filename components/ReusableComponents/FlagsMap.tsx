import Checkbox from "./CheckBox";


export interface Flag {
    label: string;
    key: string;
    defaultValue: boolean;
    description?: string;
}

interface FlagStates {
    [key: string]: boolean;
}

interface Props {
    id: string
    flags: Flag[];
    state: FlagStates;
    flagChanged: (key: string, value: boolean) => void;
}




export const FlagsMap: React.FC<Props> = ({ id, flags, state, flagChanged }) => {
    return (
      <div>
        {flags.map((flag, index) => (
          <div key={flag.key}>
          <Checkbox
            key={flag.key}
            id={`${id}-${flag.key}`}
            label={flag.label}
            checked={state[flag.key]}
            onChange={(checked) => flagChanged(flag.key, checked)}
          />
          {flag.description && <div className="mb-2 pl-6 pr-2" >{flag.description}</div>}
          </div>
        ))}
      </div>
    );
  };
  

export default FlagsMap;