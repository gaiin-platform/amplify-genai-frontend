import { FC, useState } from "react";
import { Amplify_Groups, AmplifyGroupSelect, camelToTitleCase, titleLabel, UserAction } from "../AdminUI";
import { AdminConfigTypes, FeatureFlag, FeatureFlagConfig} from "@/types/admin";
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import ActionButton from "@/components/ReusableComponents/ActionButton";
import { InfoBox } from "@/components/ReusableComponents/InfoBox";
import Search from "@/components/Search";
import { AddEmailWithAutoComplete } from "@/components/Emails/AddEmailsAutoComplete";

interface Props {
    features: FeatureFlagConfig;
    setFeatures: (f: FeatureFlagConfig) => void;

    ampGroups: Amplify_Groups;

    allEmails: Array<string> | null;

    admin_text: string;
    updateUnsavedConfigs: (t: AdminConfigTypes) => void;
     
}

export const FeatureFlagsTab: FC<Props> = ({features, setFeatures, ampGroups, allEmails, admin_text, updateUnsavedConfigs}) => {

    const [hoveredException, setHoveredException] = useState<{ feature: string; username: string } | null>(null);
    const [addingExceptionTo, setAddingExceptionTo] = useState<string | null>(null);
    const [isAddingFeature, setIsAddingFeature] = useState<{name: string, featureData: FeatureFlag} | null>(null); 
    const [featureSearchTerm, setFeatureSearchTerm] = useState<string>(''); 
    const [showFeatureSearch, setShowFeatureSearch] = useState<boolean>(true); 
    const [hoveredfeature, setHoveredfeature] = useState<number>(-1); 


    const handleUpdateFeatureFlags = (featureName:string, updatedData: {enabled: boolean,
                                                                        userExceptions?: string[],
                                                                        amplifyGroupExceptions?: string[]}) => {
        setFeatures({
            ...features,
            [featureName]: updatedData,
        });
        updateUnsavedConfigs(AdminConfigTypes.FEATURE_FLAGS);
    }

    const handleDeleteFeatureFlag = (featureName:string) => {
        const updatedFeatures = {...features};
        delete updatedFeatures[featureName];
        setFeatures(updatedFeatures);
        updateUnsavedConfigs(AdminConfigTypes.FEATURE_FLAGS);
    }

    return <>
            <div className="flex flex-row gap-3 mb-2 ">
                    {titleLabel('Feature Flags')}   
                    <button
                        title={isAddingFeature ? '' : 'Add Feature'}
                        id="addFeatureButton"
                        disabled={isAddingFeature !== null}
                        className={`ml-1 mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200  ${ isAddingFeature ? "" : " cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" }`}
                        onClick={() => setIsAddingFeature({name: '', featureData: emptyFeature()})
                        } >
                        <IconPlus size={16}/>
                    </button>

                    {isAddingFeature && 
                        <UserAction
                        top={"mt-4"}
                        label={"Add Feature"}
                        clearOnConfirm={false}
                        onConfirm={() => {
                            setFeatureSearchTerm('');
                            if (isAddingFeature.name) {
                                const updatedName = isAddingFeature.name.replace(/\s(.)/g, (_, c) => c.toUpperCase()).replace(/^\w/, c => c.toLowerCase());
                                if (Object.keys(features).includes(updatedName)) {
                                    alert("Feature flag names must be unique. Please try another name.");
                                    return;
                                }
                                handleUpdateFeatureFlags(updatedName, isAddingFeature.featureData);
                                setIsAddingFeature(null);
                            } else {
                                alert("Feature name is required. Please enter a name and try again. ");
                            }
                        }}
                        onCancel={() => {
                            setIsAddingFeature(null);
                        }}
                    />
                    
                    }
                    { showFeatureSearch && !isAddingFeature && 
                    <div className="ml-auto mr-9" style={{transform: 'translateY(6px)'}}>
                        <Search
                        placeholder={'Search Feature Flags...'}
                        searchTerm={featureSearchTerm}
                        onSearch={(searchTerm: string) => setFeatureSearchTerm(searchTerm.toLocaleLowerCase())}
                        />
                    </div>}
            </div>

                {isAddingFeature && 
                <div className="ml-6 flex flex-row flex-shrink-0 mr-4 ">
                <div title={"Feature names must be unique. Words separated by spaces will be converted to camelCase format. "}>
                    <label className="mt-1.5 flex-shrink-0 border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center items-center h-[38px]"
                        >Feature Name 
                    </label>
                    <input
                    className={`mt-1.5 w-[160px] h-[38px] ${admin_text}`}
                    id="featureNameInput"
                    placeholder={"Feature Name"}
                    onChange={(e) =>  setIsAddingFeature({...isAddingFeature, name: e.target.value})}
                    value={isAddingFeature.name}
                    />
                </div>
                <label className="ml-4 mt-1.5 h-[40px] border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                >Status </label>

                <button title={isAddingFeature.featureData.enabled ? "Click to disabled"        
                                                                    : "Click to enabled" }
                    id="statusToggle" 
                    className={`mt-1.5 h-[40px] w-[80px] px-1 items-center cursor-pointer
                                bg-gray-200 dark:bg-[#40414F] ${isAddingFeature.featureData.enabled
                                ? 'text-green-500 hover:text-green-600' : 'text-red-600 hover:text-red-700' }`}
                    onClick={() => {
                        const enabled = isAddingFeature.featureData.enabled;
                        const updatedData = {...isAddingFeature.featureData, enabled: !enabled};
                        setIsAddingFeature({...isAddingFeature, featureData: updatedData});
                    }}>
                {isAddingFeature.featureData.enabled ? 'Enabled' : 'Disabled'}       
                </button>

                <div className="ml-4 flex-grow flex flex-col mt-[-32px] max-w-[40%]">
                    <AddEmailWithAutoComplete
                        id={`${String(AdminConfigTypes.FEATURE_FLAGS)}_ADD`}
                        emails={isAddingFeature.featureData.userExceptions ?? []}
                        allEmails={allEmails ?? []}
                        handleUpdateEmails={(updatedEmails: Array<string>) => {
                            const updatedData = {...isAddingFeature.featureData, userExceptions: updatedEmails};
                            setIsAddingFeature({...isAddingFeature, featureData: updatedData});
                        }}
                    />
                        <div className="h-[40px] rounded-r border border-neutral-500 pl-4 py-1 dark:bg-[#40414F] bg-gray-200 dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 overflow-x-auto">
                    {isAddingFeature.featureData.userExceptions?.map((user, idx) => (
                        <div key={idx} className="flex items-center gap-1 mr-1">
                            <span className="flex flex-row gap-4 py-2 mr-4"> 
                                {user} 
                                <button
                                className={`text-red-500 hover:text-red-800 `}
                                onClick={() => {
                                    if (isAddingFeature.featureData.userExceptions) {
                                        const updatedUsers = isAddingFeature.featureData.userExceptions
                                                            .filter((u: string) => u !== user);
                                        const updatedData = {...isAddingFeature.featureData, userExceptions: updatedUsers};
                                        setIsAddingFeature({...isAddingFeature, featureData: updatedData});
                                    }
                                }} >
                                <IconTrash size={16} />
                                </button>
                            </span>
                        </div>
                        ))}
                    </div>
                </div>
                <div className="flex-grow ml-4 flex flex-col mt-[-40px] max-w-[40%]">
                    <InfoBox
                     padding="py-1"
                     color={"#60A5FA"}
                     content={
                            <span className="ml-1 text-xs w-full text-center"> 
                            Members of the following Amplify Groups will be considered exceptions.
                            </span>
                        }/>
                        
                    <AmplifyGroupSelect 
                        groups={Object.keys(ampGroups)}
                        selected={isAddingFeature.featureData.amplifyGroupExceptions ?? []}
                        setSelected={(selectedGroups: string[]) => {
                            const updatedData = {...isAddingFeature.featureData,
                                                        amplifyGroupExceptions: selectedGroups};
                            setIsAddingFeature({...isAddingFeature, featureData: updatedData});
                        }}
                    /> 
                </div>

                    </div>}
            
            <div className="ml-4 mt-6 mb-10">
                <div className="mr-5 pr-4">
                    <InfoBox 
                    color="#60A5FA"
                    content={
                        <span className="text-xs w-full text-center"> 
                            When the feature is Enabled, it is active for everyone except the users listed under User Exceptions; when Disabled, the feature is inactive for everyone except those users, who will still have access.
                        </span>
                    }
                    />
                    <table id="featureFlagsTable" className="modern-table hide-last-column mt-4 w-full mr-10" style={{boxShadow: 'none', tableLayout: 'fixed'}}>
                        <thead>
                        <tr className="gradient-header hide-last-column">
                            {['Feature', 'Status', 'User Exceptions', 'User Exceptions by Amplify Group Membership']
                                .map((title, index) => (
                            <th key={index}
                                id={title}
                                className="px-4 py-2 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                style={{
                                width: index === 0  ? '22%' // Feature column takes as much space as needed
                                        : index === 1 ? '150px' // Fixed width for the Status button column
                                        : '32%', // User Exceptions column takes remaining space
                                }}
                            >
                                {title}
                            </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {Object.entries(features)
                                .filter(([featureName, featureData]) => featureSearchTerm ? featureName.toLowerCase().includes(featureSearchTerm) : true)
                                .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
                                .map(([featureName, featureData], i: number) => (
                            <tr key={featureName} onMouseEnter={() => setHoveredfeature(i)} onMouseLeave={() => setHoveredfeature(-1)}>
                                {/* Feature Name Column */}
                                <td className="border border-neutral-500 px-4 py-2" id="featureTitle" title={featureName}>
                                    <span id="featureTitleName" className="text-[0.95rem]">{camelToTitleCase(featureName)}</span>
                                </td>

                                {/* Status Button Column */}
                                <td className="border border-neutral-500 px-8 py-2 text-center">
                                    <button
                                    className={`px-2 py-1 rounded ${
                                        featureData.enabled
                                        ? 'text-green-500 hover:text-green-600'
                                        : 'text-red-600 hover:text-red-700'
                                    }`}
                                    title={featureData.enabled ? 'Click to Disable' : 'Click to Enable'}
                                    onClick={() => {
                                        // Toggle feature enabled state
                                        handleUpdateFeatureFlags(featureName, {
                                        ...featureData,
                                        enabled: !featureData.enabled,
                                        });
                                    }}
                                    >
                                    {featureData.enabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                </td>

                                {/* User Exceptions Column */}
                                <td className="border border-neutral-500 pl-1 pr-2">
                                    <div className={`flex items-center ${addingExceptionTo === featureName ? "flex-col":'flex-row'}`}>
                                    {/* User Exceptions List */}
                                    <div
                                        className={`flex items-center ${addingExceptionTo === featureName ? "flex-wrap w-full": "overflow-x-auto"}`}
                                        style={{ maxWidth: '100%' }}
                                    >
                                        {featureData.userExceptions?.map((user, idx) => (
                                        <div key={idx} className="flex items-center gap-1 mr-1"
                                            onMouseEnter={() => setHoveredException({ feature: featureName, username: user })}
                                            onMouseLeave={() => setHoveredException(null)}>
                                            
                                            <span className="flex flex-row gap-1 py-2 mr-4"> {idx > 0 && <label className="opacity-60">|</label>}
                                                {hoveredException?.feature === featureName && 
                                                    hoveredException?.username === user ?
                                                <button
                                                className={`text-red-500 hover:text-red-800`}
                                                onClick={() => {
                                                    // Remove user from exceptions
                                                    const updatedExceptions = featureData.userExceptions?.filter(
                                                    (u) => u !== user
                                                    );
                                                    handleUpdateFeatureFlags(featureName, {
                                                    ...featureData,
                                                    userExceptions: updatedExceptions,
                                                    });
                                                }}
                                                >
                                                <IconTrash size={16} />
                                                </button> : <div className="w-[16px]"></div>}

                                                {user} 
                                            </span>
                                        </div>
                                        ))}
                                    </div>

                                    {/* Add Exception Input or Button */}
                                    {addingExceptionTo === featureName ? (
                                        <div className="flex flex-row pr-3 ml-2 mt-2" style={{ width: '100%' }}>
                                        <ActionButton
                                            title="Close"
                                            handleClick={() => setAddingExceptionTo(null)}
                                        >
                                            <IconX size={20}/>   
                                        </ActionButton>
                                        
                                        <div className="flex-grow"> <AddEmailWithAutoComplete
                                            id={String(AdminConfigTypes.FEATURE_FLAGS)}
                                            emails={featureData.userExceptions ?? []}
                                            allEmails={allEmails ?? []}
                                            handleUpdateEmails={(updatedExceptions: Array<string>) => {
                                            handleUpdateFeatureFlags(featureName, {
                                                ...featureData,
                                                userExceptions: updatedExceptions,
                                            });
                                            }}
                                        /> </div>
                                        </div>
                                    ) : (
                                        <button
                                        className="ml-auto flex items-center px-2 text-blue-500 hover:text-blue-600 flex-shrink-0"
                                        onClick={() => {
                                            setAddingExceptionTo(featureName);
                                        }}
                                        >
                                        <IconPlus size={18} />
                                        {!(featureData.userExceptions && featureData.userExceptions.length > 0) && (
                                            <span>Add Exceptions</span>
                                        )}
                                        </button>
                                    )}
                                    </div>
                                </td>

                                <td className="border border-neutral-500">
                                        <AmplifyGroupSelect 
                                        groups={Object.keys(ampGroups)}
                                        selected={featureData.amplifyGroupExceptions ?? []}
                                        setSelected={(selectedGroups: string[]) => {
                                            handleUpdateFeatureFlags(featureName, {
                                                ...featureData,
                                                amplifyGroupExceptions: selectedGroups,
                                            });
                                        }}
                                        />
                                </td>
                                <td>
                                    <div className="w-[30px] flex-shrink-0">
                                    {hoveredfeature === i ?
                                    <button
                                        title={"Remove Feature Flag"}
                                        type="button"
                                        className="ml-1 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                        onClick={() => {handleDeleteFeatureFlag(featureName)}}
                                        >
                                        <IconTrash size={20} />
                                    </button>
                                    : null}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                
            </div>
        </>

}


const emptyFeature = () => {
    return {
        enabled: false,
        userExceptions: [],
        amplifyGroupExceptions: []
    } as FeatureFlag;
}
