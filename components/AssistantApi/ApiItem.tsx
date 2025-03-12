// ApiItem.tsx
import React from 'react';
import { Checkbox } from '@/components/ReusableComponents/CheckBox';
import { TagsList } from '../Chat/TagsList';
import { camelCaseToTitle } from '@/utils/app/data';

interface ApiParam {
  name: string;
  description: string;
}

interface ApiItemProps {
  api: {
    id: string;
    name: string;
    description?: string;
    params?: ApiParam[];
    [key: string]: any;
  };
  index: number;
  onChange: (id: string, checked: boolean) => void;
  selected: boolean;
}

const ApiItem: React.FC<ApiItemProps> = ({ api, index, selected, onChange }) => {
  return (
    <div
      key={api.id}
      className="api-item"
      style={{
        border: '1px solid #ccc',
        padding: '10px',
        margin: '10px 0',
        borderRadius: '5px',
      }}
    >
      <div className='flex flex-row'>
        <Checkbox
          id={`api-${index}`}
          label={camelCaseToTitle(api.name)}
          checked={selected || false}
          onChange={(e) => onChange(api.id, e)}
          bold={true}
        />
        <div className='ml-auto'>
          <TagsList
            tags={api.tags.filter((t:string) => !['default', 'all'].includes(t))}
            setTags={() => {}}
            isDisabled={true}
          />
        </div>
      </div>
      
      {api.description && <p>{api.description}</p>}
      {api.params && api.params.length > 0 && (
        <div className="mt-2">
          <p>Parameters:</p>
          <ul>
            {api.params.map((param: ApiParam, idx: number) => (
              <li key={idx}>{param.name} - {param.description}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="mt-2">
        <summary>Specification</summary>
        <pre>{JSON.stringify(api, null, 2)}</pre>
      </details>
    </div>
  );
};

export default ApiItem;