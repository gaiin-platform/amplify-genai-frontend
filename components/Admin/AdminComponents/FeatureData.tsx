import { FC, useContext, useEffect, useState } from "react";
import {  Amplify_Groups, AmplifyGroupSelect, loading, loadingIcon, titleLabel, UserAction } from "../AdminUI";
import { AdminConfigTypes} from "@/types/admin";
import { IconCheck, IconChevronLeft, IconChevronRight, IconCircleX, IconFileTypeCsv, IconFileTypePdf, IconKey, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { InfoBox } from "@/components/ReusableComponents/InfoBox";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { buildStyles, CircularProgressbar } from "react-circular-progressbar";
import { GroupUpdateType } from "@/types/groups";
import { AssistantDefinition } from "@/types/assistant";
import { createAmplifyAssistants, replaceAstAdminGroupKey, updateGroupAssistants } from "@/services/groupsService";
import { fetchApiDocTemplates, uploadApiDoc } from "@/services/apiKeysService";
import { IconFileCode } from "@tabler/icons-react";
import { uploadDataDisclosure } from "@/services/dataDisclosureService";
import { calculateMd5, uploadFileAsAdmin } from "@/utils/app/admin";
import { deletePptx, uploadPptx } from "@/services/adminService";
import toast from "react-hot-toast";
import { generateTimestamp } from "@/utils/app/date";
import HomeContext from "@/pages/api/home/home.context";
import Checkbox from "@/components/ReusableComponents/CheckBox";
import Search from "@/components/Search";
import { useSession } from "next-auth/react";
import { amplifyAssistants } from "@/utils/app/amplifyAssistants";


interface Props {
    stillLoadingData: boolean;

    admins: string[];
    ampGroups: Amplify_Groups;

    astGroups: Ast_Group_Data[];
    setAstGroups: (g: Ast_Group_Data[]) => void;

    amplifyAstGroupId: string;
    setAmplifyAstGroupId: (id: string) => void;
    changedAstGroups: string[];
    setChangedAstGroups: (c: string[]) => void;

    templates: Pptx_TEMPLATES[];
    setTemplates: (t: Pptx_TEMPLATES[]) => void;
    changedTemplates: string[];
    setChangedTemplates: (c: string[]) => void;

    isAvailableCheck: (isAvailable: boolean, handleClick: () => void, styling?: string) => JSX.Element

    admin_text: string;
    updateUnsavedConfigs: (t: AdminConfigTypes) => void;
}

export const FeatureDataTab: FC<Props> = ({admins, ampGroups, amplifyAstGroupId, setAmplifyAstGroupId,
                                           astGroups, setAstGroups, changedAstGroups, setChangedAstGroups, 
                                           templates, setTemplates, changedTemplates, setChangedTemplates,
                                           stillLoadingData, isAvailableCheck, admin_text, updateUnsavedConfigs}) => {
    const { state: { statsService }, setLoadingMessage } = useContext(HomeContext);
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    const [hoveredAstGroup, setHoveredAstGroup] = useState<string>('');  
    const [keyReplacementLoading, setKeyReplacementLoading] = useState<string>(''); 
    const [astGroupSearchTerm, setAstGroupSearchTerm] = useState<string>(''); 

    const [showAstGroupSearch, setShowAstGroupsSearch] = useState<boolean>(true);  
    const [creatingAmpAsts, setCreatingAmpAsts] = useState<string[] | null>(null);
    const [isCreatingAmpAstGroup, setIsCreatingAmpAstGroup] = useState<boolean>(false);
    const [isAddingAst, setIsAddingAst] = useState<string>('');      

    const [hoveredTemplate, setHoveredTemplate] = useState<string>('');  
    const [deletingTemplate, setDeletingTemplate] = useState<string>(''); 
    const [isAddingTemplate, setIsAddingTemplate] = useState<Pptx_TEMPLATES | null>(null);
    const [uploadedTemplate, setUploadedTemplate] = useState<File | null>(null);
    const [isUploadingTemplate, setIsUploadingTemplate] = useState<boolean>(false);

    const [dataDisclosureUploaded, setDataDisclosureUploaded] = useState<boolean>(false);
    
    const [showUploadApiDocs, setShowUploadApiDocs] = useState<boolean>(true);
    const [apiDocsUploaded, setApiDocsUploaded] = useState<{csv: boolean, pdf: boolean, json: boolean}>(
                                                               {csv: false, pdf: false, json: false});
    


    const handleAstGroupChange = (groupId: string, astGroupData: Ast_Group_Data[]) => {
        setAstGroups(astGroupData);
        if (!changedAstGroups.includes(groupId)) setChangedAstGroups([...changedAstGroups, groupId]);
        updateUnsavedConfigs(AdminConfigTypes.AST_ADMIN_GROUPS);
    }

    const handleTemplateUpload = async (fileName: string) => {
        if (isAddingTemplate && uploadedTemplate ) {
            setIsUploadingTemplate(true);
            try {
                const md5 = await calculateMd5(uploadedTemplate);
                const result = await uploadPptx({fileName: fileName,
                                                isAvailable: isAddingTemplate.isAvailable, 
                                                amplifyGroups : isAddingTemplate.amplifyGroups,
                                                contentType: uploadedTemplate.type,
                                                md5: md5
                                            });
                if (result.success && result.presigned_url) {
                    const presigned = result.presigned_url;
                    const uploadResult = await uploadFileAsAdmin(presigned, uploadedTemplate, md5,
                        {'x-amz-meta-isavailable': String(isAddingTemplate.isAvailable),  
                        'x-amz-meta-amplifygroups': isAddingTemplate.amplifyGroups.join(",") }
                    );

                    if (uploadResult) {
                        setTemplates([...templates, isAddingTemplate]);
                        setIsAddingTemplate(null);
                        setUploadedTemplate(null);
                        setIsUploadingTemplate(false);
                        toast("PowerPoint template was successfully added."); 
                        return;
                    }
                } 
            } catch (error) {
                console.log("Error getting presigned url and uploading.", error);
            }
        }
        alert("Unable to add the PowerPoint template at this time. Please try again later.");
        setIsUploadingTemplate(false);
        
    }

    const handleDataDisclosureUpload = async (file:File) => {
        const type =  file.type;
        const latestName = `data_disclosure_${generateTimestamp()}.pdf`;
        const pdfFile = new File([file], latestName, { type: type });
        try {
            const md5 = await calculateMd5(pdfFile);
            console.log(md5);  
            const result = await uploadDataDisclosure({ fileName: latestName,
                                                        contentType : type,
                                                        md5: md5,
                                                     });
            if (result.success && result.presigned_url) {
                const uploadResult = await uploadFileAsAdmin(result.presigned_url, pdfFile, md5);
                if (uploadResult) {
                    setDataDisclosureUploaded(true);
                    return;  
            }  
        }
        } catch (error) {
            console.log("Error getting presigned url and uploading.", error);
        } 
        alert("Unable to upload the Data Disclosure file at this time. Please try again later."); 
    }

    const handleApiDocUpload = async (file: File) => {
        try {
            const md5 = await calculateMd5(file);
            const result = await uploadApiDoc(file.name, md5);
            if (result.success && result.presigned_url) {
                const uploadResult = await uploadFileAsAdmin(result.presigned_url, file, md5);
                if (uploadResult) {
                    const fileType = file.name.split('.').pop()?.toLowerCase();
                    setApiDocsUploaded({...apiDocsUploaded, [fileType as 'csv' | 'docx' | 'json']: true});
                    return;
                }
            }
        } catch (error) {
            console.log(`Failed to get presigned url api doc. ${error}`);
        }
        alert("Unable to upload the API Documentation at this time. Please remove the document and try uploading again.");
    }


    const handleDownloadApiDocTemplates = async () => {
        setLoadingMessage("Preparing to Download...");
        const result = await fetchApiDocTemplates();
        if (result && result.presigned_url) {
            try {
                const link = document.createElement('a');
                link.href = result.presigned_url;
                link.download = 'Amplify_API_Templates.zip';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setLoadingMessage("");
                return
            } catch (error) {
                console.error("Download error:", error);
            } 
        } 
        alert("Failed to download API Documentation Templates. Please try again later...");
        setLoadingMessage("");
    }

    const handleTemplateChange = (name: string, updatedTemplates: Pptx_TEMPLATES[]) => {
        setTemplates(updatedTemplates);
        if (!changedTemplates.includes(name)) setChangedTemplates([...changedTemplates, name]);
        updateUnsavedConfigs(AdminConfigTypes.PPTX_TEMPLATES);
    }


    const handleReplaceGroupKey = async (groupId: string) => {
        setKeyReplacementLoading(groupId);
        const result = await replaceAstAdminGroupKey(groupId);
        if (result) {
            
            toast("Group API key successfully replaced.");
        } else {
            alert("Unable to replace the groups API key. Please try again...");
        }
        setKeyReplacementLoading('');

    }


        const handleCreateAmpAsts = async ( ) => {
            if (creatingAmpAsts) {
                if (creatingAmpAsts.length === 0) {
                    alert("You must select at least one Amplify assistant to continue.");
                    return;
                }
                setIsCreatingAmpAstGroup(true);
                const astDefs = creatingAmpAsts.map((ast: string) => (amplifyAssistants as any)[ast]);
                const result = await createAmplifyAssistants(astDefs, admins);
                if (result.success) {
                    const groupId = result.data.id;
                    setAmplifyAstGroupId(groupId);
                    const ampAstGroup = {
                        group_id : groupId, 
                        groupName : "Amplify Assistants", 
                        amplifyGroups : [],
                        createdBy : userEmail,
                        isPublic : false,
                        numOfAssistants: astDefs.length,
                        supportConvAnalysis: false,
                        trackCoversations: true
                    } as Ast_Group_Data;
                    setAstGroups([...astGroups, ampAstGroup]);
                    toast("Successfully created Amplify Assistants group");
                    setIsCreatingAmpAstGroup(false);
                    return;
                }
            }
            alert("Failed to create Amplify Assistant group. Please try again later...");
            setIsCreatingAmpAstGroup(false);
        }
    
        const handleAddAssistant = async (astDefs: AssistantDefinition[] ) => {
            const asts = astDefs.map((ast: any) => {
                const updatedData = {...ast.data, groupId: amplifyAstGroupId};
                return {...ast, groupId: amplifyAstGroupId, data: updatedData};
            });
            const updateAstData = { "group_id": amplifyAstGroupId, 
                                    "update_type": GroupUpdateType.ADD, 
                                    "assistants": asts };
            statsService.updateGroupAssistantsEvent(updateAstData);
            const result = await updateGroupAssistants(updateAstData);
            setIsAddingAst('');
            if (result.success) {
                toast("Successfully added assistant");
            } else {
                alert("Unable to add a copy of the assistant at this time. Please try again later...");
            }
        }
    
        const handleDeleteTemplate = async (name: string) => {
            if (confirm("Are you sure you want to delete this PowerPoint Template? You will not be able to undo this change.")) {
                setDeletingTemplate(name);
                const result = await deletePptx(name);
    
                if (result) {
                    toast(`Successfully deleted PowerPoint template ${name}`);
                    setTemplates(templates.filter((t:Pptx_TEMPLATES) => t.name !== name));
                } else {
                    alert("Unable to delete the PowerPoint template at this time. Please try again later...");
                }
                setDeletingTemplate('');
            }  
        }

    return <>
        <div className="admin-style-settings-card">
            <div className="admin-style-settings-card-header">
                <h3 className="admin-style-settings-card-title">Upload Documents</h3>
                <p className="admin-style-settings-card-description">Upload and manage documents for data disclosure and API documentation</p>
            </div>

            <div className="mx-6 flex flex-row gap-20">
                    <div className="flex flex-row gap-2">
                        <IconFileTypePdf className="ml-1 mt-1" size={18}/>
                        <label className="mt-0.5 text-[1rem]" title="Upload pdf file"> Data Disclosure</label>
                        <div className="max-h-20"> 
                            <FileUpload
                            id={"data_disclosure"}
                            allowedFileExtensions={['pdf']}
                            onAttach={(file:File, fileName: string) => {
                                handleDataDisclosureUpload(file);
                            }}
                            completeCheck={() => dataDisclosureUploaded}
                            onRemove={() => {
                                setDataDisclosureUploaded(false);
                            }}
                        /> </div>
                        
                    </div>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-1">
                        <label className="ml-1  mt-0.5 text-[1rem] mb-1.5"> API Documentation</label>
                        <button className="mt-[-2px] rounded-sm p-1 text-black dark:text-white hover:opacity-80"
                            onClick={() => {
                                // if (!showUploadApiDocs && !apiPresignedUrls) handleApiDocPresigned();
                                setShowUploadApiDocs(!showUploadApiDocs);
                            }}
                            id="expandUploadApiDocs"
                            title="Upload API Documents"
                            > 
                            {showUploadApiDocs ? <IconChevronLeft size={20} /> : <IconChevronRight size={20} />}
                        </button>
                        {showUploadApiDocs && 
                        <>
                        <> <IconFileTypePdf className="flex-shrink-0 mt-1 ml-3" size={18}/>
                        <FileUpload
                            id={"api_documentation_pdf"}
                            allowedFileExtensions={['pdf']}
                            onAttach={(file:File, fileName: string) => {
                                const overriddenFile = new File([file], "Amplify_API_Documentation.pdf", { type: file.type });
                                handleApiDocUpload(overriddenFile);
                            }}
                            completeCheck={() => apiDocsUploaded.pdf}

                            onRemove={() => {
                                setApiDocsUploaded({...apiDocsUploaded, pdf: false});
                            }}
                            label="API PDF"
                        /></>
                        <> <IconFileTypeCsv className="flex-shrink-0 mt-1 ml-5" size={18}/>
                        <FileUpload
                            id={"api_documentation_csv"}
                            allowedFileExtensions={['csv']}
                            onAttach={(file:File, fileName: string) => {
                                const overriddenFile = new File([file], "Amplify_API_Documentation.csv", { type: file.type });
                                handleApiDocUpload(overriddenFile);
                            }}
                            completeCheck={() => apiDocsUploaded.csv}
                            onRemove={() => {
                                setApiDocsUploaded({...apiDocsUploaded, csv: false});
                            }}
                            label="API CSV"
                        /></>

                        <> <label className="mt-1 ml-5" title="Postman Collection JSON File">
                            <IconFileCode className="flex-shrink-0" size={19}/></label> 
                        <FileUpload
                            id={"api_documentation_json"}
                            allowedFileExtensions={['json']}
                            onAttach={(file:File, fileName: string) => {
                                const overriddenFile = new File([file], "Postman_Amplify_API_Collection.json", { type: file.type });
                                handleApiDocUpload(overriddenFile);
                            }}
                            completeCheck={() => apiDocsUploaded.json}
                            onRemove={() => {
                                setApiDocsUploaded({...apiDocsUploaded, json: false});
                            }}
                            label="Postman Collection"
                        /></>
                        
                        </>}
                        
                        
                    </div>
                    <button className="max-w-[216px] mt-[-10px] text-start cursor-pointer ml-1 text-xs text-blue-500 hover:opacity-70"
                        onClick={handleDownloadApiDocTemplates}> 
                        {'(Need the API docs? Download here)'}
                    </button>
                    

                </div>
            </div>
        </div>
        
        <div className="admin-style-settings-card">
            <div className="admin-style-settings-card-header">
                <h3 className="admin-style-settings-card-title">Assistant Admin Groups</h3>
                <p className="admin-style-settings-card-description">Manage Amplify assistants and assistant admin groups for organized access control</p>
            </div>

            <div className="ml-6">
                <div className="flex flex-row gap-2">
                    <label className="text-[1rem] font-bold"> Amplify Group Assistants</label>
                    {amplifyAstGroupId || isCreatingAmpAstGroup || stillLoadingData ?
                            <div className={`mt-1.5 ml-0.5 ${isCreatingAmpAstGroup || stillLoadingData? "bg-gray-400 dark:bg-gray-500 animate-pulse" : "bg-green-400 dark:bg-green-300"}`} 
                            style={{width: '8px', height: '8px', borderRadius: '50%'}}
                            title="The Amplify Assistants Group exists."> </div>
                    :
                    (!creatingAmpAsts ?
                    <button 
                        className="ml-2 mt-[-2px] py-1 px-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 hover:dark:bg-gray-700 mr-[-16px] rounded transition-colors duration-100 cursor-pointer" 
                        onClick={() => {
                            setCreatingAmpAsts([]);
                            }}
                        // title="It appears you currently do not have an Amplify Assistants group. If this is a mistake you will not be able to successfully create another one."
                        >
                        {"Create Amplify Assistants Group"}
                            
                    </button> :
                        <UserAction
                        top={"mt-[1px]"}
                        label={"Create Amplify Assistants Group With Selected Assistants"}
                        onConfirm={() => {
                            handleCreateAmpAsts();
                            setAstGroupSearchTerm('');
                        }}
                        onCancel={() => {
                            setCreatingAmpAsts(null);
                        }}
                    />
                    )
                    }
                </div>
                <div className="ml-8 pr-10 mb-6 mt-4">
                    <InfoBox color="#60A5FA"
                    content={
                        <span className="ml-1 text-xs w-full px-4 text-center"> 
                        {!creatingAmpAsts 
                            ? "Amplify Assistants are accessible to all users. You can modify these assistants through the Assistant Admin Interface. To access this interface, make sure the required feature flag is enabled under the Configurations tab. Navigate to the Assistant Admin Interface by clicking on the gear icon located in the left sidebar menu on the main Home screen. If you do not see the Assistant Admin Interface option, try to refresh the page and/or double-check the Assistant Admin Interface feature flag."
                            : "Please select the assistants you want to include in the Amplify Assistants group. Once you've made your selections, click the green checkmark to create the group."}
                        </span>
                    }/>
                    <div className="mt-4"></div>
                    {Object.keys(amplifyAssistants).map((ast: any) =>
                        <div key={ast} className="mt-2 flex flex-row">
                            <div className="flex flex-row gap-2"> 
                                {creatingAmpAsts && 
                                    <Checkbox
                                    id={`amplifyAsts_${ast}`}
                                    label=""
                                    checked={creatingAmpAsts.includes(ast)}
                                    onChange={(isChecked: boolean) => {
                                        if (isChecked) {
                                            setCreatingAmpAsts([...creatingAmpAsts, ast]);
                                        } else {
                                            setCreatingAmpAsts(creatingAmpAsts
                                                                    .filter((a: string) => a !== ast));
                                        }
                                    }}
                                />
                                }
                                <label className="mt-0.5 text-[0.9rem]"> {ast} :</label> 
                            </div>
                            <label className="mt-0.5 ml-3"> 
                                {(amplifyAssistants as any)[ast].description}
                            </label>

                            {!creatingAmpAsts && !stillLoadingData && amplifyAstGroupId && 
                            <button 
                                className={`group ml-4 mb-1 mt-[-2px] py-1 px-2 bg-gray-300 dark:bg-gray-600 ${isAddingAst === '' ? "hover:bg-gray-400 hover:dark:bg-gray-700" : ""} mr-[-16px] rounded transition-colors duration-100 cursor-pointer flex flex-row gap-2`}
                                onClick={() => {
                                    setIsAddingAst(ast);
                                    handleAddAssistant([(amplifyAssistants as any)[ast]]);
                                }}
                                id="addAssistantCopy"
                                title="Adds a copy of this assistant to the existing Amplify Assistants Group"
                                disabled={isAddingAst !== ''}
                                >
                                {isAddingAst === ast ? <>{loadingIcon()}</>
                                : <IconPlus className="icon-pop-group text-blue-400" size={18}/> }
                                {"Assistant Copy"}
                                    
                            </button>}
                        </div>
                    )
                        
                    }
                </div>

                <label className="text-[1rem] font-bold"> Groups</label>
                <div className="ml-6 mt-4">
                    
                {astGroups.length > 0 ?
                    <>
                        {showAstGroupSearch && 
                        <div className="h-[0px] ml-auto mr-20 w-[280px]" style={{transform: 'translateY(-30px)'}}>
                            <Search
                            placeholder={'Search Assistant Admin Groups...'}
                            searchTerm={astGroupSearchTerm}
                            onSearch={(searchTerm: string) => setAstGroupSearchTerm(searchTerm.toLocaleLowerCase())}
                            />
                        </div>}
                        <ExpansionComponent 
                        onOpen={() => setShowAstGroupsSearch(true)}
                        onClose={() => {
                            setShowAstGroupsSearch(false);
                            setAstGroupSearchTerm('');
                        }}
                        title={'Manage Assistant Admin Groups'} 
                        content={ 
                            stillLoadingData ? loading :
                            <>
                                <table id="assistantAdminGroupsTable" className="modern-table hide-last-column mt-4 w-full mr-10" style={{boxShadow: 'none'}}>
                                    <thead>
                                    <tr className="gradient-header hide-last-column">
                                        {['Group Name', 'Created By', 'Support Conversation Analysis', 'Public', 'Membership by Amplify Groups', 'Number of Assistants',
                                        ].map((title, i) => (
                                        <th id="assistantAdminGroupsTitle" key={i}
                                            className="px-4 py-2 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                        > {title}
                                        </th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {astGroups.filter((group: Ast_Group_Data) => astGroupSearchTerm ? 
                                            group.groupName.toLowerCase().includes(astGroupSearchTerm) : true)
                                            .map((group: Ast_Group_Data) => 
                                        <tr key={group.group_id}
                                            onMouseEnter={() => setHoveredAstGroup(group.group_id)}
                                            onMouseLeave={() => setHoveredAstGroup('')}>
                                            <td id="groupName" className="text-center border border-neutral-500 p-2">
                                                {group.groupName}
                                            </td>
                                            <td className="text-center border border-neutral-500 p-2 break-words max-w-[200px]">
                                                {group.createdBy}
                                            </td>

                                            <td className="w-[164px] border border-neutral-500 px-4 py-2"
                                                title="All Amplify Users Can Chat and Interact With the Assistants In the Group">
                                                <div className="flex justify-center">
                                                    <button title={ `Click to ${group.supportConvAnalysis ?"disable" : "enable"} analysis of assistant conversations`} 
                                                    className="cursor-pointer flex flex-row gap-7 dark:text-neutral-200 text-neutral-900"
                                                    onClick={() => {
                                                        const updatedGroups = astGroups.map((g: Ast_Group_Data) => 
                                                            g.group_id === group.group_id ? 
                                                                    {...group, supportConvAnalysis: !group.supportConvAnalysis} : g)
                                                        handleAstGroupChange(group.group_id, updatedGroups);
                                                    }}>
                                                {group.supportConvAnalysis ? <IconCheck className='text-green-600 hover:opacity-60' size={18} /> 
                                                        : <IconX  className='text-red-600 hover:opacity-60' size={18} />}       
                                                </button>

                                                </div>                           
                                            </td>


                                            <td className="border border-neutral-500 px-4 py-2"
                                                title="All Amplify Users Can Chat and Interact With the Assistants In the Group">
                                                <div className="flex justify-center">
                                                    <button title={group.isPublic ? "Click to set group as private"        
                                                                                : "Click to set group as public" } 
                                                    className="cursor-pointer flex flex-row gap-7 dark:text-neutral-200 text-neutral-900"
                                                    onClick={() => {
                                                        const updatedGroups = astGroups.map((g: Ast_Group_Data) => 
                                                            g.group_id === group.group_id ? 
                                                                    {...group, isPublic: !group.isPublic} : g)
                                                        handleAstGroupChange(group.group_id, updatedGroups);
                                                    }}>
                                                {group.isPublic ? <IconCheck className='text-green-600 hover:opacity-60' size={18} /> 
                                                        : <IconX  className='text-red-600 hover:opacity-60' size={18} />}       
                                                </button>

                                                </div>                           
                                            </td>


                                            <td className="border border-neutral-500">
                                            <AmplifyGroupSelect 
                                                groups={Object.keys(ampGroups)}
                                                selected={group.amplifyGroups}
                                                setSelected={(selectedGroups: string[]) => {
                                                    const updatedGroups = astGroups.map((g: Ast_Group_Data) => 
                                                                            g.group_id === group.group_id ? 
                                                                    {...group, amplifyGroups: selectedGroups} : g)
                                                    handleAstGroupChange(group.group_id, updatedGroups);
                                                }}
                                            />
                                            </td>

                                        
                                            <td className="border border-neutral-500 px-4 py-2 text-center w-[100px]">
                                                {group.numOfAssistants ?? 0}
                                            </td>

                                            <td>
                                                <div className="w-[30px] flex-shrink-0">
                                                {hoveredAstGroup === group.group_id || 
                                                keyReplacementLoading === group.group_id ?
                                                <button
                                                    title={"Replace Group API Key"}
                                                    type="button"
                                                    disabled={keyReplacementLoading !== ''}
                                                    className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                                                    onClick={() => {handleReplaceGroupKey(group.group_id)}}>
                                                    {keyReplacementLoading === group.group_id ? <>{loadingIcon(20)}</> : <IconKey size={20}/>} 
                                                </button>  
                                                
                                                : null}
                                                </div>
                                            </td>
                                        </tr>     
                                    )}
                                    </tbody>
                                </table>

                            </>
                        }
                        isOpened={true}
                    />  </>
                        :
                        <>No Assistant Admin Groups listed. </>
                    }
                </div>
            
            </div>
        </div>


        <div className="admin-style-settings-card">
            <div className="admin-style-settings-card-header">
                <div className="flex flex-row items-center gap-3 mb-2">
                    <h3 className="admin-style-settings-card-title">PowerPoint Templates</h3>
                    <div className="flex-shrink-0 flex flex-row gap-3">
                        <button
                            title={isAddingTemplate ? "" : 'Add PowerPoint Templates'}
                            id="addPowerpointTemplate"
                            disabled={isAddingTemplate !== null}
                            className={`flex-shrink-0 items-center py-2 gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200  ${ isAddingTemplate ? "" : " cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10" }`}
                            onClick={() => setIsAddingTemplate(emptyPptx())}
                        >
                            {isUploadingTemplate ? <>{loadingIcon()}</> : <IconPlus size={16}/>}
                        </button>

                        {isAddingTemplate && !isUploadingTemplate &&
                            <UserAction
                            top={"mt-1"}
                            label={"Add Template"}
                            onConfirm={() => {
                                if (uploadedTemplate) {
                                    if (templates.find((t: Pptx_TEMPLATES) => t.name === isAddingTemplate.name)) {
                                        alert("PowerPoint template names must be unique. Please rename your file and try again.");
                                        return;
                                    }
                                    handleTemplateUpload(isAddingTemplate.name);
                                } else {
                                    alert("Please upload a powerpoint template.");
                                }
                            }}
                            clearOnConfirm={false}
                            onCancel={() => {
                                setIsAddingTemplate(null);
                                setUploadedTemplate(null);
                            }}
                        />
                        }
                    </div>
                </div>
                <p className="admin-style-settings-card-description">Upload and manage PowerPoint templates for users</p>
            </div>

            {isAddingTemplate && 
                <div className="ml-6 flex flex-row flex-shrink-0">
                    <div className="mt-1">
                    <FileUpload
                        id={"pptx_upload"}
                        allowedFileExtensions={['pptx']}
                        onAttach={(file:File, fileName: string) => {
                            setUploadedTemplate(file);
                            setIsAddingTemplate({...isAddingTemplate, name: fileName});
                        }}
                        completeCheck={() => isAddingTemplate.name != ''}
                        onRemove={() => {
                            setUploadedTemplate(null);
                            setIsAddingTemplate({...isAddingTemplate, name: ''});
                        }}
                    /></div>
                    <label className="h-[40px] border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                    >Template Name </label>
                    <input
                    title={!uploadedTemplate ? "Template name will auto-populate once a template has been uploaded"
                                            : "" }
                    className={`h-[40px] w-[250px] ${admin_text}`}
                    id="templateNameInput"
                    placeholder={"Template Name"}
                    value={isAddingTemplate.name}
                    disabled={true}
                    />
                    <label id="statusAvailability" className="ml-4 h-[40px] border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                    >Available </label>

                    
                    {isAvailableCheck(isAddingTemplate.isAvailable, () => {
                        setIsAddingTemplate({...isAddingTemplate, isAvailable: !isAddingTemplate.isAvailable});
                    }, "h-[40px] px-1 items-center bg-gray-200 dark:bg-[#40414F]")} 

                    <div className="ml-4 flex flex-col mt-[-45px]">
                        <InfoBox 
                        color="#60A5FA"
                        padding="py-1"
                        content={
                                <span className="ml-1 text-xs w-full text-center"> 
                                If the template is not available for all users, it will be exclusively available for the following Amplify Groups
                                </span>
                            }/>
                    
                        <AmplifyGroupSelect 
                            groups={Object.keys(ampGroups)}
                            selected={isAddingTemplate.amplifyGroups}
                            setSelected={(selectedGroups: string[]) => {
                                setIsAddingTemplate({...isAddingTemplate, amplifyGroups: selectedGroups});
                            }}
                        /> 
                    </div>

            </div>
            }


            <div className="ml-6 mt-6 mb-10 ">
                {templates.length > 0 ?
                        <ExpansionComponent 
                        title={'Manage PowerPoint Templates'} 
                        content={ 
                            <>
                                <table id="powerpointTemplateTable" className="modern-table hide-last-column mt-4 w-full mr-10" style={{boxShadow: 'none'}}>
                                    <thead>
                                    <tr className="gradient-header hide-last-column">
                                        {['Template Name', 'Public', 'Available to User via Amplify Group Membership'
                                        ].map((title, i) => (
                                        <th key={i}
                                            id={title}
                                            className="px-4 py-2 text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                            style={{width: i === 0 ? "25%" 
                                                        : i === 1 ? "20" :"55%", 
                                            }}>
                                                {title}
                                            </th>
                                        ))}
                                        
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {templates.map((pptx: Pptx_TEMPLATES) => 
                                        <tr key={pptx.name}
                                            onMouseEnter={() => setHoveredTemplate(pptx.name)}
                                            onMouseLeave={() => setHoveredTemplate('')}>
                                            <td className="text-center border border-neutral-500 px-4 py-2 break-words max-w-[200px]">
                                                {pptx.name}
                                            </td>

                                            <td className="border border-neutral-500 px-4 py-2"
                                                title="Available to All Amplify Users">
                                                <div className="flex justify-center">
                                                {isAvailableCheck(pptx.isAvailable, () => {
                                                    const updatedTemplate = {...pptx, isAvailable: !pptx.isAvailable};
                                                        handleTemplateChange(pptx.name, 
                                                                            templates.map((t:Pptx_TEMPLATES) =>
                                                                            t.name === pptx.name ?      
                                                                                updatedTemplate : t ));
                                                })} 
                                                </div>                           
                                            </td>

                                            <td className="border border-neutral-500">
                                                <AmplifyGroupSelect 
                                                groups={Object.keys(ampGroups)}
                                                selected={pptx.amplifyGroups}
                                                setSelected={(selectedGroups: string[]) => {
                                                    const updatedTemplate = {...pptx, amplifyGroups: selectedGroups};
                                                    handleTemplateChange(pptx.name, 
                                                                        templates.map((t:Pptx_TEMPLATES) =>
                                                                        t.name === pptx.name ?      
                                                                            updatedTemplate : t ))
                                                }}
                                                />
                                            </td>

                                            <td>
                                                <div className="w-[30px] flex-shrink-0">
                                                {hoveredTemplate === pptx.name || deletingTemplate == pptx.name ?
                                                <button
                                                    title={"Delete Template"}
                                                    type="button"
                                                    className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                                    onClick={() => {handleDeleteTemplate(pptx.name)}}
                                                    >
                                                    {deletingTemplate == pptx.name ? <>{loadingIcon(20)}</> : <IconTrash size={20} />} 
                                                </button>
                                                
                                                : null}
                                                </div>
                                            </td>
                                        </tr>     
                                    )}
                                    </tbody>
                                </table>

                            </>
                        }
                        isOpened={true}
                    />  
                        :
                        <>No PowerPoint Templates listed. </>
                    }
            </div>
        </div>
        
    </>

}

export interface Pptx_TEMPLATES {
    name : string;
    isAvailable : boolean;
    amplifyGroups : string[];
}

const emptyPptx = () => {
    return {
        name : '',
        isAvailable : false,
        amplifyGroups : []
    } as Pptx_TEMPLATES;
}

export interface Ast_Group_Data {
    group_id : string;
    groupName : string;
    amplifyGroups : string[];
    createdBy : string;
    isPublic : boolean;
    numOfAssistants: number;
    supportConvAnalysis: boolean;
    trackCoversations: boolean;
}



interface FileUploadProps {
    id: string
    label?: string;
    allowedFileExtensions: string[];
    onAttach: (file:File, fileName: string) => void;
    completeCheck: () => boolean;
    onRemove: () => void;
}


const FileUpload: FC<FileUploadProps> = ({id, label, allowedFileExtensions, onAttach, 
                                          completeCheck, onRemove}) => {
    const [uploadedDocument, setUploadedDocument] = useState<{name: string, extension: string} | null>(null);
    const [documentState, setDocumentState] = useState<number>(0);

    const getProgress = () => {
        if (uploadedDocument) {
            const percentage = documentState;
            return (
                <div className="mr-1 flex items-center justify-center w-6 dark:text-black" style={{minWidth:"20px"}}>
                <CircularProgressbar
                    styles={buildStyles({
                        textSize: '32px',
                        pathTransitionDuration: 0.5,
                        pathColor: `rgba(62, 152, 199})`,
                        textColor: '#000000',
                        trailColor: '#d6d6d6',
                        backgroundColor: '#3e98c7',
                    })}
                    value={percentage} text={`${percentage}`} />
                </div>
            );
        }
        return <LoadingIcon/>;
    }


    const isComplete = () => {
        return uploadedDocument && documentState == 100 && completeCheck();
    }

useEffect(() => {
    if (uploadedDocument && documentState >= 5 && documentState < 100) {
        if (completeCheck()) {
            setDocumentState(100);
        } else {
            setTimeout( () => {
              setDocumentState(documentState +5);
            }, 200
            );            
        }
    }

}, [documentState]);
    


const handleFile = async (file:File, name: string) => {
    try {
        setDocumentState(5); // starts simulation 
        onAttach(file, name);
    } catch (error) {
        console.error("Failed to handle file:", error);
    }
}

    return ( uploadedDocument ?
        <div className="flex pb-2 mr-1" key={id}>
            <div
                className={`${isComplete() ? 'bg-white' : 'bg-yellow-400'} text-black flex flex-row items-center justify-between border bg-white rounded-md px-1 py-1 ml-1 mr-1 shadow-md dark:shadow-lg`}
                style={{ maxWidth: '220px' }}
            >

                {!isComplete() ?
                    getProgress() : 
                    <IconCheck className="text-green-500" />
                }

                <div className="ml-1" title={uploadedDocument.name}>
                    <p className={`truncate font-medium text-sm ${isComplete() ? 'text-gray-800' : 'text-gray-800'}`}
                        style={{ maxWidth: '160px' }}>
                            {uploadedDocument.name}
                    </p>
                </div>

                 <button
                        className=" text-gray-400 hover:text-gray-600 transition-all"
                        onClick={(e) =>{
                            e.preventDefault();
                            e.stopPropagation();
                            setUploadedDocument(null);
                            setDocumentState(0);
                            onRemove();
                        }}>
                        <IconCircleX/>
                </button>
            </div>
            
        </div> :
        <>
            <input
            id={id}
            className="sr-only"
            tabIndex={-1}
            type="file"
            accept={allowedFileExtensions.map(ext => `.${ext}`).join(',')}
            onChange={(e) => {
                if (!e.target.files || e.target.files.length === 0) return;
                const file = e.target.files[0];
                const fileName = file.name;
                const extension = fileName.split('.').pop() || '';
                setUploadedDocument({name: fileName.replace(/[_\s]+/g, '_'),
                                     extension: extension});

                if (!allowedFileExtensions.includes(extension)) {
                    alert(`This file type is not supported. Please upload a file of type: ${allowedFileExtensions.join(', ')}`);
                    return;
                }
                handleFile(file, fileName);
                e.target.value = ''; // Clear the input after files are handled
            }}
            />
    
            <button
            className="flex flex-row gap-1 left-2 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
            id={`uploadFile${label}`}
            onClick={() => {
                const importFile = document.querySelector('#' + id) as HTMLInputElement;
                if (importFile) {
                importFile.click();
                }
            }}
            title="Upload File"
            >
            {<IconPlus size={20}/>}
            {label}
            </button>
        </>
    );
};
