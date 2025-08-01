import React, { FC, useState } from 'react';
import { executeAssistantApiCall } from '@/services/assistantAPIService';
import ExpansionComponent from '../Chat/ExpansionComponent';
import { IconPlus } from '@tabler/icons-react';

interface SelectProps {
  requestType: string,
  handleChange: (val: string) => void;
  disabled?: boolean;
}

export interface Auth {
  type: string;
  token?: string;
  username?: string;
  password?: string;
}

export interface Parameter {
  name: string;
  description: string;
}

export interface ExternalAPI {
  id: string;
  name: string;
  requestType: string;
  url: string;
  params: Parameter[];
  body: string | Record<string, any>;
  headers: Record<string, string>;
  auth: Auth;
  description: string;
  schema?:  {
    type: string;
    properties: {
      [key: string]: {
        type: string;
        [key: string]: any;
      };
    };
    required?: string[];
  };
}

export interface APIState {
  apiInfo: ExternalAPI[];
  setApiInfo: React.Dispatch<React.SetStateAction<ExternalAPI[]>>;
  disabled?: boolean;
}

export const HTTPRequestSelect: FC<SelectProps> = ({requestType, handleChange, disabled}) => {

  return (
    <div className='text-black dark:text-neutral-200'>
      Select Request Type
      <select
        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
        value={requestType}
        id="selectRequestType"
        onChange={(e) => handleChange(e.target.value)}
        required
        disabled={disabled}
      >
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="DELETE">DELETE</option>
        <option value="PATCH">PATCH</option>
      </select>
    </div>
  )

}

export const APIComponent: React.FC<APIState> = ({ apiInfo, setApiInfo, disabled }) => {

  const [apiResponse, setApiResponse] = useState<any>(null);

  const handleTestAPI = async (api: any) => {
    // Clean up the auth object to remove empty values
    const cleanAuth = {
      type: api.auth.type,
      ...(api.auth.token && { token: api.auth.token }),
      ...(api.auth.username && { username: api.auth.username }),
      ...(api.auth.password && { password: api.auth.password })
    };

    // Parse the body if it's a string
    let cleanBody = api.body;
    if (typeof api.body === 'string') {
      try {
        cleanBody = JSON.parse(api.body);
      } catch {
        cleanBody = {};  // If parsing fails, use empty object
      }
    }

    // Create the request object with the correct structure
    const requestData = {
      requestType: api.requestType,
      url: api.url,
      params: api.params || {},
      body: cleanBody,
      headers: api.headers || {},
      auth: cleanAuth
    };

    const result = await executeAssistantApiCall(requestData);
    setApiResponse(result);
  };


  return (
    <div>
       {!disabled && <button
        className=" mb-4 flex items-center gap-2 rounded border border-neutral-500 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        onClick={() => setApiInfo([...apiInfo, {
          id: '',
          name: '',
          requestType: '',
          url: '',
          params: [],
          body: {},
          headers: {},
          auth: { type: '', token: '', username: '', password: '' },
          description: ''
        }])}
      >
        <IconPlus size={18} />
        Add External API
      </button>}


      {apiInfo.map((api, index) => (
        <div key={index}>
        <ExpansionComponent
        title={`Manage API ${api.name}`}
        isOpened={true}
        content={
        <div className="mb-4 p-4 border border-gray-300 rounded ">
          <div className="flex items-center w-full">
            <label style={{transform: 'translateY(4px)'}} className="text-sm font-bold">Name:</label>
            <button
              className="ml-auto mt-[-2px] px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              onClick={() => {
                const newApiInfo = apiInfo.filter((_, i) => i !== index);
                setApiInfo(newApiInfo);
              }}
            >
              Remove API
            </button>
          </div>
          <input
            className="mt-2 mb-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
            placeholder="Name"
            value={api.name}
            onChange={(e) => {
              const newApiInfo = [...apiInfo];
              newApiInfo[index].name = e.target.value;
              newApiInfo[index].id = e.target.value;
              setApiInfo(newApiInfo);
            }}
            required
          />
          <HTTPRequestSelect
            requestType={api.requestType}
            handleChange={(val) => {
              const newApiInfo = [...apiInfo];
              newApiInfo[index].requestType = val;
              setApiInfo(newApiInfo);
            }}
          />
          <input
            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
            placeholder="URL"
            value={api.url}
            onChange={(e) => {
              const newApiInfo = [...apiInfo];
              newApiInfo[index].url = e.target.value;
              setApiInfo(newApiInfo);
            }}
            required
          />
          <div className="mt-2">
            <label className="text-sm font-bold">AI Chosen Parameters:</label>
            <button
              className="ml-2 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => {
                const newApiInfo = [...apiInfo];
                newApiInfo[index].params = [
                  ...newApiInfo[index].params,
                  {name:"Name", description:"Description"}
                ];
                setApiInfo(newApiInfo);
              }}
            >
              Add Parameter
            </button>
            {(api.params || []).map((param, paramIndex) => (
              <div key={paramIndex} className="flex mt-1">
                <input
                  className="w-1/2 mr-2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                  placeholder="Name"
                  value={param.name}
                  onChange={(e) => {
                    const newApiInfo = [...apiInfo];
                    const theInfo = newApiInfo[index];
                    const theParams = theInfo.params;
                    const theParam = theParams.map((p: any) => {
                      if(p.name === param.name){
                        p.name = e.target.value;
                        return p;
                      }
                      else {
                        return p;
                      }
                    });

                    setApiInfo(newApiInfo);
                  }}
                />
                <input
                  className="w-1/2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                  placeholder="Description for the Assistant"
                  value={param.description}
                  onChange={(e) => {
                    const newApiInfo = [...apiInfo];
                    const theInfo = newApiInfo[index];
                    const theParams = theInfo.params;
                    const theParam = theParams.map((p: any) => {
                      if(p.name === param.name){
                        p.description = e.target.value;
                        return p;
                      }
                      else {
                        return p;
                      }
                    });

                    setApiInfo(newApiInfo);
                  }}
                />
                <button
                  className="ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={() => {
                    const newApiInfo = [...apiInfo];
                    newApiInfo[index].params = newApiInfo[index].params.filter(p => p !== param);
                    setApiInfo(newApiInfo);
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <label className="text-sm font-bold">Headers:</label>
            <button
              className="ml-2 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => {
                const newApiInfo = [...apiInfo];
                newApiInfo[index].headers = {
                  ...newApiInfo[index].headers,
                  '': '',
                };
                setApiInfo(newApiInfo);
              }}
            >
              Add Header
            </button>
            {Object.entries(api.headers || {}).map(([key, value], headerIndex) => (
              <div key={headerIndex} className="flex mt-1">
                <input
                  className="w-1/2 mr-2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                  placeholder="Key"
                  value={key}
                  onChange={(e) => {
                    const newApiInfo = [...apiInfo];
                    const newHeaders = { ...newApiInfo[index].headers };
                    delete newHeaders[key];
                    newHeaders[e.target.value] = value;
                    newApiInfo[index].headers = newHeaders;
                    setApiInfo(newApiInfo);
                  }}
                />
                <input
                  className="w-1/2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                  placeholder="Value"
                  value={value}
                  onChange={(e) => {
                    const newApiInfo = [...apiInfo];
                    newApiInfo[index].headers[key] = e.target.value;
                    setApiInfo(newApiInfo);
                  }}
                />
                <button
                  className="ml-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={() => {
                    const newApiInfo = [...apiInfo];
                    const newHeaders = { ...newApiInfo[index].headers };
                    delete newHeaders[key];
                    newApiInfo[index].headers = newHeaders;
                    setApiInfo(newApiInfo);
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <label className="text-sm font-bold">Body:</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
              placeholder="Request Body (JSON)"
              value={typeof api.body === 'object' ? JSON.stringify(api.body, null, 2) : api.body}
              onChange={(e) => {
                const newApiInfo = [...apiInfo];
                try {
                  newApiInfo[index].body = JSON.parse(e.target.value);
                } catch {
                  newApiInfo[index].body = e.target.value;
                }
                setApiInfo(newApiInfo);
              }}
              rows={4}
            />
            <button
              className="mt-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => {
                const newApiInfo = [...apiInfo];
                try {
                  const bodyString = typeof newApiInfo[index].body === 'string'
                    ? newApiInfo[index].body
                    : JSON.stringify(newApiInfo[index].body);
                  const formattedBody = JSON.parse(bodyString as string);
                  newApiInfo[index].body = JSON.stringify(formattedBody, null, 2);
                } catch (error) {
                  // If parsing fails, leave the body as is
                  console.error('Failed to parse or format JSON:', error);
                }
                setApiInfo(newApiInfo);
              }}
            >
              Format JSON
            </button>
          </div>
          <div className="mt-2">
            <label className="text-sm font-bold">Authentication:</label>
            <select
              className="ml-2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
              value={api.auth.type || ""}
              onChange={(e) => {
                const newApiInfo = [...apiInfo];
                newApiInfo[index].auth.type = e.target.value;
                newApiInfo[index].auth.token = '';
                setApiInfo(newApiInfo);
              }}
            >
              <option value="">None</option>
              <option value="basic">Basic Auth</option>
              <option value="bearer">Bearer Token</option>
            </select>
          </div>
          {api.auth.type === 'basic' && (
            <div className="mt-2">
              <input
                className="mr-2 w-1/2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                placeholder="Username"
                value={api.auth.username || ''}
                onChange={(e) => {
                  const newApiInfo = [...apiInfo];
                  newApiInfo[index].auth.username = e.target.value;
                  setApiInfo(newApiInfo);
                }}
              />
              <input
                className="w-1/2 rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                type="password"
                placeholder="Password"
                value={api.auth.password || ''}
                onChange={(e) => {
                  const newApiInfo = [...apiInfo];
                  newApiInfo[index].auth.password = e.target.value;
                  setApiInfo(newApiInfo);
                }}
              />
            </div>
          )}
          {api.auth.type === 'bearer' && (
            <input
              className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
              placeholder="Bearer Token"
              value={api.auth.token}
              onChange={(e) => {
                const newApiInfo = [...apiInfo];
                newApiInfo[index].auth.token = e.target.value;
                setApiInfo(newApiInfo);
              }}
            />
          )}
          <textarea
            className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
            placeholder="API Description (what it does and why it's used)"
            value={api.description || ''}
            onChange={(e) => {
              const newApiInfo = [...apiInfo];
              newApiInfo[index].description = e.target.value;
              setApiInfo(newApiInfo);
            }}
            rows={3}
            required
          />

          <button
            className="mt-2 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => handleTestAPI(api)}
          >
            Test API
          </button>
          {apiResponse && (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-60">
              <pre className="text-sm text-gray-800 dark:text-gray-200">{JSON.stringify(apiResponse, null, 2)}</pre>
            </div>
          )}
          
        </div>}
        />
        </div>
      ))}
     
    </div>
  );
};

export default APIComponent;