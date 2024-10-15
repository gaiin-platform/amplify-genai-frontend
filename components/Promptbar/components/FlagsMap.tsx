import Checkbox from "@/components/ReusableComponents/CheckBox";

interface Flag {
    label: string;
    key: string;
    defaultValue: boolean;
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
          <Checkbox
            key={flag.key}
            id={`${id}-${flag.key}`}
            label={flag.label}
            checked={state[flag.key]}
            onChange={(checked) => flagChanged(flag.key, checked)}
          />
        ))}
      </div>
    );
  };
  

export default FlagsMap;