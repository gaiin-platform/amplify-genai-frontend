import {useContext, useEffect, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {IconKey, IconUser} from "@tabler/icons-react";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { useSession } from "next-auth/react"
import { formatRateLimit, RateLimit } from "@/types/rateLimit";
import { formatAccessTypes } from "@/components/Settings/AccountComponents/ApiKeys";
import ExpansionComponent from "../ExpansionComponent";
import { Account } from "@/types/accounts";
import { createApiKey, deactivateApiKey, updateApiKeys } from "@/services/apiKeysService";
import toast from "react-hot-toast";
import React from "react";
import { fixJsonString } from "@/utils/app/errorHandling";
import { ApiKeyOps } from "@/types/apikeys";
import { DefaultModels } from "@/types/model";
import { createPortal } from "react-dom";


interface KeyData {
    id: string;
    name: string;
}

interface KeyUpdate {
    id: string;
    name: string;
    rateLimit?: RateLimit;
    expirationDate?: string;
    accessTypes?: string[];
    account?: Account;
}

interface Props {
    content: string;
}


const ApiKeyBlock: React.FC<Props> = ({content}) => {
    const [error, setError] = useState<string | null>(null);
    const [op, setOP] = useState<string>("");
    const [data, setData] = useState<any>(null);
    const [requiredCreateKeys, setRequiredCreateKeys] = useState<any>(null);
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const {state:{statsService, messageIsStreaming, chatEndpoint, defaultAccount}, 
           dispatch:homeDispatch, getDefaultModel} = useContext(HomeContext);
    const { data: session } = useSession();

    const [isCreated, setIsCreated] = useState<boolean>(false);
    const [deactivatedKeys, setDeactivatedKeys] = useState<string[]>([]);
    const [updatedKeys, setUpdatedKeys] =useState<string[]>([]);
    const [isUpdating, setIsUpdating] =useState<string | null>(null);

    const user = session?.user;

    const repairJson = async () => {
        console.log("Attempting to fix json...");
        const model = getDefaultModel(DefaultModels.ADVANCED);
        const fixedJson: string | null = await fixJsonString(model, chatEndpoint || "", statsService, content, defaultAccount, "Failed to render request, attempting to fix...");
         // try to repair json
         const parsed:any  = fixedJson ? JSON.parse(fixedJson) : null;
        if (parsed && parsed.DATA) {
            console.log(parsed);

            setOP(parsed.OP);
            setData(parsed.DATA);
            setLoadingMessage(null);
        }  else {
            setError('Failed to extract data. Please check the JSON format.');
        }
    }

    useEffect(() => {
        const extractData = () => {
            try {
                const opData = JSON.parse(content);  
                //possibly try to fix 
                let attr = opData.DATA;
                if (attr) {
                    setOP(opData.OP);
                    setData(attr);
                    setLoadingMessage(null);
                }
            } catch {
                // setLoadingMessage("We are making progress on your request.");
                console.log("Extract data error");
                repairJson();
            }  
        }
        if ((op === "" || !data) && !messageIsStreaming) extractData();
    }, [content, messageIsStreaming]);


    const handleDeactivateAPIKey = async (id: string, name: string) => {
        if (confirm(`Are you sure you want to deactivate API key: ${name}?\nOnce deactivate, it cannot be undone.`)) {
            const result = await deactivateApiKey(id);
            statsService.deactivateApiKeyEvent(id);
            
           
            if (result) {
                toast("Successfuly deactivated the API key");
                setDeactivatedKeys([...deactivatedKeys,id]);
            } else {
                alert("Unable to deactivate the API key at this time. Please try again later...");
            }
        }
    }

    const handleCreateAPIKey = async () => {
        if (!requiredCreateKeys.isComplete) {
            alert("Incomplete key data...\n Missing data: " + requiredCreateKeys.missingKeys.join(''));
        } else if (data.systemUse && data.delegate) {
            //check no delegate if system use
            alert("You cannot have a delegate defined when creating a system key. Specified one or the either as none.");
        } else {
            const keyData = {...data, owner: user?.email};
            setLoadingMessage("Creating API key...");
            const result = await createApiKey(keyData);
            if (result) {
                toast("Successfuly created the API key");
                setIsCreated(true);
            } else {
                alert("Unable to create the API key at this time. Please try again later...");    
            }
            statsService.createApiKeyEvent(keyData);
            setLoadingMessage(null);
            
           
        }
    }

    const handleUpdateAPIKey = async (keyData: KeyUpdate) => {
        setIsUpdating(keyData.id);
        const result = await updateApiKeys([{ "apiKeyId" : keyData.id, "updates" : keyData}]);
        if (!result.success) {
            alert('failedKeys' in result ? `API keys: ${result.failedKeys.join(", ")} failed to update. Please try again.` : "We are unable to update your key(s) at this time...")
        } else {
            statsService.updateApiKeyEvent(keyData);
            setUpdatedKeys([...updatedKeys, keyData.id]);
        }
        setIsUpdating(null);
    }
    
    const formatLabel = (label: string, data: any) => {
        const title = label.replace(/([A-Z])/g, ' $1')
                    .replace(/^./, function(match) {
                        return match.toUpperCase(); 
                    });
        let dataLabel = data || "N/A";
        switch (label) {
            case ('account'):
                dataLabel = `${data.name}\n\t${data.id}`
                break;
            case ('rateLimit'):
                dataLabel = formatRateLimit(data);
                break;
            case ('accessTypes'):
                dataLabel = formatAccessTypes(data);
                break;
        }
        return `${title}: ${dataLabel}`;
    }

    useEffect(() => {
        const verifyRequiredKeys = () => {
            const requiredKeys = ['account', 'appName', 'accessTypes', 'rateLimit'];
            if (!data) return {isComplete: false, missingKeys: requiredKeys};
            
            // Check if all required keys are present in the data object
            const missingKeys = requiredKeys.filter((key:string) => {
                const present = Object.keys(data).includes(key);

                const val = data[key];
                if ((present && val && typeof val === 'string') && (val.includes("N/A") || val.includes("null"))) {
                    setData((prevData: any) => ({
                        ...prevData,
                        [key]: null
                    }));
                }
                return !present;
            });
            // If there are no missing keys, the data is considered complete
            return {isComplete: missingKeys.length === 0, missingKeys: missingKeys};
        }
        if (op === ApiKeyOps.CREATE) setRequiredCreateKeys(verifyRequiredKeys());
    }, [data]);

    // @ts-ignore
    return error ?
        <div>{error}</div> :
        <div style={{maxHeight: "450px"}}>
            {loadingMessage ? (
                createPortal(
                    <div className="fixed top-14 left-1/2 transform -translate-x-1/2 z-[9999] pointer-events-none animate-float">
                        <div className="p-3 flex flex-row items-center border border-gray-500 bg-[#202123] rounded-lg shadow-xl pointer-events-auto">
                            <LoadingIcon style={{ width: "24px", height: "24px" }}/>
                            <span className="text-lg font-bold ml-2 text-white">{loadingMessage}</span>
                        </div>
                    </div>,
                    document.body
                )
            ) : ( !data ? ("We are making progress on your request...") : (
                <>
                    <div className="flex flex-col w-full mb-4 overflow-x-hidden gap-0.5">
                        <div className="flex flex-row items-center justify-center">
                            { op === ApiKeyOps.CREATE && 
                            <div title={`${data.systemUse ? 'System' : data.delegate ? 'Delegate' : 'Personal'} Use`} >
                             <IconUser style={{ strokeWidth: 2.5 }} className={`mr-2 flex-shrink-0 ${data.systemUse
                                ? 'text-green-600' : data.delegate 
                                ? 'text-yellow-500' : 'text-gray-600 dark:text-gray-400'}`} size={28}
                            />
                            </div> 
                            }
                            <div className="text-2xl font-bold">{`${op}${isCreated?'D':''}`}</div>
                            <IconKey className="ml-2" size={26}/>
                        </div>

                         
                        <div className="flex flex-col gap-4">
                            {op === ApiKeyOps.DEACTIVATE && 
                            data.map((k: KeyData, index:number) => (
                                <div className="flex items-center w-full max-w-lg" key={index}>
                                    <div className="flex-grow text-right mr-3">{k.name}</div>
                                    {deactivatedKeys.includes(k.id) ? 
                                        <div className="text-md mr-20 ml-9 px-2 py-1 text-green-500">Deactivated</div> :
                                        <OpButton 
                                            op={op}
                                            handleClick={() => handleDeactivateAPIKey(k.id, k.name)}
                                            color={'red'}
                                        />
                                    }
                                </div>
                            ))
                            }
                        </div>

                        {op === ApiKeyOps.UPDATE && 
                            data.map((k: KeyUpdate) => (
                                <div className="ml-12 mb-4 w-full max-w-lg" key={k.id}>
                                    <ExpansionComponent title={`${k.name} Updates`} 
                                            content={[
                                                (k.account && <div > {formatLabel('account', k.account)} </div> ),
                                                (k.expirationDate && <div> {formatLabel("expiration", k.expirationDate)}</div>), 
                                                (k.accessTypes && <div>{" " + formatLabel("accessTypes", k.accessTypes)}</div>),
                                                (k.rateLimit && <div>{" " + formatLabel("rateLimit", k.rateLimit)}</div>),
                                            <div className="absolute right-20 top-50" style={{transform: 'translateY(-100%)'}} key={k.id}>
                                                {updatedKeys.includes(k.id) ? 
                                                    <div className="text-md mr-20 px-6 py-1 text-green-500">Updated</div> :
                                                    ( isUpdating == k.id ?  
                                                        <div className="flex flex-row justify-center items-center mr-16"><LoadingIcon/> 
                                                        <div className="ml-2">{"Updating..."}</div></div>  :
                                                        <OpButton 
                                                            op={op}
                                                            handleClick={async() => {
                                                                handleUpdateAPIKey(k)
                                                            }}  
                                                        /> )
                                                }
                                            </div>,
                                    ]}
                                    />
                                </div>
                            ))
                        }

                        {op === ApiKeyOps.CREATE && (
                            <>
                                <div className="my-4 ml-20 flex justify-center">
                                    <div className="ml-10 w-full max-w-lg">
                                        {Object.keys(data).map((k, index) => (
                                        <div className='flex-grow text-left' key={index}>
                                            {formatLabel(k, data[k])}
                                        </div>
                                        ))}
                                    </div>
                                </div>
                                { isCreated ? <></> :
                                    (<OpButton
                                    op={op}
                                    handleClick={handleCreateAPIKey} // Assuming data contains id, adjust if needed
                                    color={requiredCreateKeys && requiredCreateKeys.isComplete ? 'green' : `red`}
                                    width="w-full"
                                    />)
                                }
                            </>
                            )}
                        
                    </div>
                </>
            ))
        }
        </div>;
};

export default ApiKeyBlock;


interface buttonProps {
    op: string;
    handleClick: (k:any) => void;
    color?: string;
    width?: string;
}

const OpButton: React.FC<buttonProps> = ({op,handleClick, color="green", width=''}) => {

    function formatString(str: String) {
        if (!str) return str; // Handle null, undefined, or empty string
        return str.charAt(0) + str.slice(1).toLowerCase();
    }

    return <button className={`mr-14 px-2 py-1 text-white bg-blue-500 rounded hover:bg-${color}-600 ${width}`}
                    onClick={handleClick}
            >
                {`${formatString(op)} API Key`}
        </button>

}