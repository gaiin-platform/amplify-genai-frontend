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
          {flag.description && (
            <div className="mb-2 pl-6 pr-2">
              {highlightKeywords(flag.description)}
            </div>
          )}

          </div>
        ))}
      </div>
    );
  };
  

export default FlagsMap;



const highlightKeywords = (text: string) => {
  // Define the keywords and their corresponding colors
  const keywords = [
    { word: 'Recommended', colorClass: 'text-green-600' },
    { word: 'NOT Recommended', colorClass: 'text-red-600' },
  ];

  // Escape special characters for regex
  const escapeRegex = (str: string) =>
    str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  // Create a regex pattern to match all keywords
  const pattern = new RegExp(keywords.map(k => escapeRegex(k.word)).join('|'), 'g');

  // Split the text based on the pattern and include the matches
  const parts = text.split(pattern);

  // Find all matches
  const matches = text.match(pattern);

  // Combine the parts and matches into an array of React elements
  const elements: React.ReactNode[] = [];
  parts.forEach((part, index) => {
    elements.push(part);
    if (matches && matches[index]) {
      const keyword = keywords.find(k => k.word === matches![index]);
      if (keyword) {
        elements.push(
          <span key={index} className={keyword.colorClass}>
            {matches[index]}
          </span>
        );
      } else {
        elements.push(matches[index]);
      }
    }
  });

  return elements;
};
