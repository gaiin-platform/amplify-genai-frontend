import { Dispatch, FC, SetStateAction, useState } from "react";
import { loadingIcon, titleLabel } from "../AdminUI";
import { IconMessage, IconPlus, IconTags, IconTrash } from "@tabler/icons-react";
import { OpDef } from "@/types/op";
import InputsMap from "@/components/ReusableComponents/InputMap";
import { HTTPRequestSelect } from "@/components/CustomAPI/CustomAPIEditor";
import { deleteOp, registerOps } from "@/services/opsService";
import toast from "react-hot-toast";
import Search from "@/components/Search";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import { InfoBox } from "@/components/ReusableComponents/InfoBox";


export const opsSearchToggleButtons = (opSearchBy: string, setOpSearchBy: Dispatch<SetStateAction<"name" | "tag">>, 
                                       opSearchTerm: string, setOpSearchTerm: (s: string) => void, 
                                       shift:string, translate: string) => {
    return <div className={`h-[0px] items-center ${shift} flex flex-row gap-4`}
                style={{transform: translate}}>
            <div className="ml-auto"> Search by</div>
            <div className="w-[140px] flex items-center rounded-md border border-neutral-600 bg-neutral-200 dark:bg-[#39394a] p-1">
            {["name", "tag"].map((search: string) => 
            <button onMouseDown={(e) =>  e.preventDefault()}
                key={search}
                className={`flex flex-row gap-2 py-1 px-2 text-[12px] rounded-md focus:outline-none 
                            ${ opSearchBy === search ? 'bg-white dark:bg-[#1f1f29] text-neutral-900 dark:text-neutral-100 font-bold transform scale-105' 
                                                     : 'bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#31313f]'
                }`}
                disabled={opSearchBy === search}
                onClick={(e) => {  
                e.preventDefault();
                e.stopPropagation();
                setOpSearchBy(search as "name" | "tag");
                }}
            > <div className="mt-0.5">{ search === "tag" ?
                <IconTags size={14}/> : <IconMessage size={14} />}</div>
                <label className={`${opSearchBy === search ? "" : "cursor-pointer"} mt-[-1px] mr-0.5`}>{search}</label>
            </button>
            ) }
        </div>
        <div className="w-[200px]" >
            <Search
            placeholder={'Search Ops...'}
            searchTerm={opSearchTerm}
            onSearch={(searchTerm: string) => setOpSearchTerm(searchTerm.toLocaleLowerCase())}
            />
        </div>
    </div>
}

interface Props {
    ops: OpDef[];
    setOps: (ops: OpDef[]) => void;
    admin_text: string;
}

export const OpsTab: FC<Props> = ({ops, setOps, admin_text}) => {

    const [newOps, setNewOps] = useState<OpDef[]>([]);
    const [hoveredOp, setHoveredOp] = useState<number>(-1);  
    const [isRegisteringOps, setIsRegisteringOps] = useState<boolean>(false);
    const [hoveredNewOp, setHoveredNewOp] = useState<number>(-1);  
    const [hoveredParam, setHoveredParam] = useState<{opIdx:number, paramIdx:number} | null>(null); 
    const [isDeletingOp, setIsDeletingOp] = useState<number>(-1);
    const [opSearchTerm, setOpSearchTerm] = useState<string>(''); 
    const [showOpSearch, setShowOpSearch] = useState<boolean>(true);  
    const [opSearchBy, setOpSearchBy] = useState<"name" | 'tag'>('name'); 


    const handleRegisterOps = async () => {
        setIsRegisteringOps(true);
        const updatedNewOps = [...newOps];
        for (let i = 0; i < updatedNewOps.length; i++) {
            const op:OpDef = updatedNewOps[i];
            if (!op.id || !op.url || (op.tags && op.tags.length === 0)) {
                alert('One or more operations have missing function name, endpoint path, or empty tags.');
                setIsRegisteringOps(false);
                return;
            } else if (op.method && ["GET", "DELETE"].includes(op.method)) {
                // ensure get and delete do not have params 
                updatedNewOps[i] = {...op, params: []}
            }
        }
        const result = await registerOps(updatedNewOps);
        if (result.success) {
            setOpSearchTerm('');
            setOps([...ops, ...updatedNewOps]);
            setNewOps([]);
            toast("Successfully registered ops");
        } else {
            alert("Failed to register ops. Please try again later...");
        }
        setIsRegisteringOps(false);
    }

    const handleDeleteOp = async (op: OpDef, index: number) => {
        setIsDeletingOp(index);
        if (confirm("Are you sure you want to delete this Op? You will not be able to undo this change.")) {
            // call delete and if successfull toast and setTemplates to filter our 
            const result = await deleteOp({
                                    id: op.id,
                                    name: op.name,
                                    tags: op.tags, 
                                    url: op.url
                                 });
            if (result.success) {
                toast("Successfully deleted OP");
                setOps(ops.filter((i:OpDef) => i.id !== op.id));
            } else {
                alert("Unable to delete the Op. Please try again...");
            }
        }  
        setIsDeletingOp(-1);
    }
    


return <>
        <div className="flex flex-row gap-3 mb-2 ">
                {titleLabel('OPs')}
                <button
                    title={'Add Op'} disabled={isRegisteringOps}
                    className={`ml-1 mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 ${isRegisteringOps ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
                    onClick={() => setNewOps([...newOps, emptyOps()])}>
                    <IconPlus size={16}/>
                </button>

                {newOps.length > 0 && 
                    <button
                        title={'Register Ops'} disabled={isRegisteringOps}
                        className={`mt-3 flex-shrink-0 items-center gap-3 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 ${isRegisteringOps ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
                        onClick={handleRegisterOps}
                    >
                        {isRegisteringOps ? "Registering..." : "Register Ops" }
                    </button>
                }

        </div>

        <div className="mx-6 mr-4">
            
            { newOps.length > 0 && 
            <div className="mb-4 flex flex-col gap-4">
                    {newOps.map((op: OpDef, i:number) => 
                        <div key={i} onMouseEnter={() => setHoveredNewOp(i)}
                                        onMouseLeave={() => setHoveredNewOp(-1)}
                        >
                            <div className="flex flex-col gap-2">
                                {i > 0 && <hr></hr>}
                                <div className="flex flex-row items-center"> 
                                <div className="flex-grow"> <InputsMap
                                    splitView={true}
                                    id = {`OPS${i}`}
                                    inputs={ [ {label: 'Tags', key: 'tags', 
                                                placeholder:"Op identifiers separated by commas"},
                                            {label: 'Function Name', key: 'name', 
                                                placeholder:"Arbitrary function name"},
                                            {label: 'Request Path', key: 'url', 
                                                placeholder:"Amplify Enpoint Path"},
                                            {label: 'Description', key: 'description', 
                                                placeholder:"Ops overview or purpose"},  
                                            ]}
                                    state = {{tags : newOps[i].tags?.join(',') ?? '', 
                                            name: newOps[i].name, 
                                            description : newOps[i].description, 
                                            url: newOps[i].url}}
                                    inputChanged = {(key:string, value:string) => {
                                        const updateOps = [...newOps];
                                        let updatedOp = {...newOps[i], [key]: value};
                                        if (key === 'name') updatedOp['id'] = value;
                                        if (key === 'tags') updatedOp['tags'] = value.split(',')
                                                                                .map((t: string) => t.trim());
                                        updateOps[i] = updatedOp;
                                        setNewOps(updateOps);
                                    }}
                                /> </div>
                                
                                <button
                                    title={"Remove OP"}
                                    type="button"
                                    className={`w-[28px] h-[28px] ml-auto p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none ${hoveredNewOp === i ? "" : "opacity-0"}`}
                                    onClick={() => setNewOps((prevItems) => 
                                                    prevItems.filter((_, idx) => i !== idx))}
                                    >
                                    <IconTrash size={20} />
                                </button>
                                
                                </div>
                                <div className="flex flex-row gap-10 justify-between">
                                    <div className="w-[140px] flex-shrink-0">
                                    <HTTPRequestSelect
                                        requestType={op.method ?? "POST"}
                                        handleChange={(val) => {
                                            const updateOps = [...newOps];
                                            updateOps[i].method = val;
                                            setNewOps(updateOps);
                                        }}
                                    />
                                    </div>

                                    {["POST", "PUT", "PATCH"].includes(op.method ?? '') && 
                                    <>
                                    <div className="flex flex-row gap-2">
                                        <label className="text-md text-black dark:text-neutral-200">Parameters</label>
                                        <button 
                                            title={'Add OP Parameter'} disabled={isRegisteringOps}
                                            className={`h-[28px] mt-[-1] ml-1 flex-shrink-0 rounded-md border border-neutral-300 dark:border-white/20 px-2 transition-colors duration-200 ${isRegisteringOps ? "" : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-gray-500/10"}`}
                                            onClick={() => {
                                                const updateOps = [...newOps];
                                                updateOps[i].params.push({ name: "", description: "" });
                                                setNewOps(updateOps);
                                            }
                                            }
                                        >
                                            <IconPlus size={14}/>
                                        </button>

                                    </div>
                                    <div className="flex flex-row gap-2 flex-grow flex-wrap">
                                        {newOps[i].params.map((p: Record<string, string>, pIndex:number) => 
                                            
                                            <div className="flex flex-col" key={pIndex}
                                            onMouseEnter={() => setHoveredParam({opIdx: i, paramIdx: pIndex})}
                                            onMouseLeave={() => setHoveredParam(null)}>
                                                <div className="relative flex flex-row flex-shrink-0">
                                                    <label className="border border-neutral-400 dark:border-[#40414F] p-2 rounded-l text-[0.9rem] whitespace-nowrap text-center"
                                                    >{"Name"} </label>
                                                    <input
                                                    className={`w-full ${admin_text}`}
                                                    placeholder={"Parameter Name"}
                                                    value={p.name}
                                                    onChange={(e) => {
                                                        const newParams = [...newOps[i].params];
                                                        newParams[pIndex].name = e.target.value;
                                                        setNewOps((prevOps) =>
                                                            prevOps.map((op, opIndex) =>
                                                                opIndex === i ? {...op, params: newParams }
                                                                            : op
                                                            )
                                                            )
                                                    }}
                                                    />
                                                    { hoveredParam?.opIdx === i && 
                                                        hoveredParam?.paramIdx === pIndex &&
                                                    <button
                                                        title={"Remove Parameter"}
                                                        type="button"
                                                        className={`absolute right-2 top-1/2 transform -translate-y-1/2 z-20 p-1 text-sm bg:transparent rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none`}
                                                        onClick={() => {
                                                            const newParams = newOps[i].params.filter((_, index) => index !== pIndex);
                                                            setNewOps((prevOps) =>
                                                                prevOps.map((op, opIndex) =>
                                                                    opIndex === i ? { ...op, params: newParams } : op
                                                                )
                                                            );
                                                        }}
                                                        >
                                                        <IconTrash size={16} />
                                                    </button>}
                                                
                                                </div>
                                                <textarea title="Parameter Description"
                                                    className={`w-full ${admin_text}`}
                                                    placeholder={"Parameter Description"}
                                                    value={p.description}
                                                    onChange={(e) => {
                                                        const newParams = [...newOps[i].params];
                                                        newParams[pIndex].description = e.target.value;
                                                        setNewOps((prevOps) =>
                                                            prevOps.map((op, opIndex) =>
                                                                opIndex === i ? {...op, params: newParams }
                                                                            : op
                                                            )
                                                            )
                                                    }}
                                                    rows={2} disabled={isRegisteringOps}
                                                />
        
                                            </div>

                                        )}
                                    </div>
                                    </>
                                    }
                                </div>
                            </div>

                        </div>
                    )
                        }

            </div>}
            <ExpansionComponent
                    title={"Understanding Ops"}
                    content={
                    <InfoBox content={
                        
                        <span className="text-xs w-full mr-12"> 
                            <div className='mt-1 flex flex-row gap-2'>  
                                <span className='mb-2 ml-5 text-[0.8rem] font-bold'> {"What are Ops?"}  </span>        
                                Ops allow assistants to send requests to Amplify internal API functions.
                            </div>

                            <div className='flex flex-col gap-1'> 
                                <div className='mt-1 flex flex-row gap-2'>  
                                    <span className='ml-5 text-[0.8rem] font-bold'> 
                                        {"How do Ops work"} 
                                    </span>        
                                    The Op will need to be registered in the Ops dynamo table with the information needed to make the API requets. To do this, you will need the following information: 
                                </div> 
                                {[{tag:'Tags', description: 'Identifers used to retrieve the cooresponding ops. Multiple ops can be grouped together by setting them with the same tag name.'},
                                    {tag:'Function Name', description: 'An arbitrary function name (no parentheses) an assistant can use in an auto block to execute the associated op request.'}, 
                                    {tag:'Path', description: 'The endpoint path for the Amplify API request.'}, 
                                    {tag:'Method', description: 'Specifies the HTTP request method required to interact with the endpoint.'},
                                    {tag:'Description', description: 'Overview of the ops purpose and functionality, designed to guide an assististant in determining when to create an auto block for executing an op.'}, 
                                    {tag:'Parameters', description: 'Details the required request parameters, including their names and descriptions. It is recommended to include the expected data type or a sample value to ensure the parameters adhere to validation rules.'},
                                ].map((el: any, index: number) =>  <span key={index} className='ml-[138px]'> * {el.tag} - {el.description}</span> )}
                                
                            </div>
                            
                            <div className='flex flex-col gap-1'> 
                                <div className='mt-1 flex flex-row gap-2'>  
                                    <span className='mb-2 ml-5 text-[0.8rem] font-bold'> {"How to use Ops in Assistants"}  </span>        
                                    
                                </div>
                                <span className='mb-1 ml-5'> * It is required to add the ops tag in your assistant instructions in the format: {"{{ops <op_tag>}}" }</span> 
                                <span className='mb-2 ml-5'> &nbsp;&nbsp; {'The assistant will automatically be instructed to produce an auto block with the function name in order to execute the op request. The auto block will be in the format):'}  </span> 
                                <span className='mb-2 flex justify-center'> ```auto
                                                                                <br></br>
                                                                                {"<function_name()>"}
                                                                                <br></br>
                                                                            ``` 
                                </span> 
                            </div>  
                        </span>
                    }

                    />
                }
                isOpened={true}
            />

            { ops.length > 0 && 
            <div className="mt-8">
            { showOpSearch && opsSearchToggleButtons(opSearchBy, setOpSearchBy, opSearchTerm, setOpSearchTerm, " ml-[200px] mr-14", 'translateY(5px)') }
            <ExpansionComponent
                onOpen={() => setShowOpSearch(true)}
                onClose={() => {
                    setShowOpSearch(false);
                    setOpSearchTerm('');
                }}
                title={"Manage Ops"}
                content={
                <div style={{ maxHeight: '500px', overflowY: 'auto', overflowX: 'hidden'}}>
                <table className="mt-4 border-collapse w-full" >
                    <thead className="sticky top-0">
                    <tr className="bg-gray-200 dark:bg-[#373844]">
                        {['Function Name', 'Tags', 'Path', 'Method', 'Parameters', 'Description']
                            .map((title, i) => (
                        <th key={i}
                            className=" text-center border border-gray-500 text-neutral-600 dark:text-neutral-300"
                        > {title}
                        </th>
                        ))}
                            
                    </tr>
                    </thead>
                    <tbody>
                    {ops.filter((op: OpDef) => opSearchTerm ? 
                        (opSearchBy === 'name' ? op.name : (op.tags?.join("") ?? '')).toLowerCase().includes(opSearchTerm) : true)
                        .map((op: OpDef, opIdx: number) => 
                        <tr key={op.id} 
                            onMouseEnter={() => setHoveredOp(opIdx)}
                            onMouseLeave={() => setHoveredOp(-1)}>
                            <td className="text-center border border-neutral-500 p-2 break-words">
                                {op.name}
                            </td>
                            
                            <td className="text-center border border-neutral-500 px-0.5 py-1 break-words ">
                                <div className="flex flex-row gap-1 items-center justify-center max-w-[300px] flex-wrap" >
                                    {op.tags?.filter((t: string) => t !== 'all')
                                                .map((t : string) => 
                                                <div key={t}
                                                className="my-0.5 p-0.5 text-center bg-white dark:bg-neutral-300 rounded-md h-[24px] min-w-[55px] shadow-lg text-gray-800 font-medium text-sm"> {t} </div>)
                                    }
                                </div>
                            </td>

                            <td className="border border-neutral-500 px-2 py-2 text-start max-w-[220px] break-words">
                                {op.url}
                            </td>

                            <td className="text-center border border-neutral-500 px-4 py-2">
                                {op.method}
                            </td>
                        
                            <td className="flex-grow text-center border border-neutral-500 p-2 max-w-[300px]">
                                {op.params.length > 0 ? 
                                <div className="flex flex-col gap-1 items-start w-full"> 
                                    {op.params.map((p: Record<string, string>, i: number) => 
                                    <div className="flex flex-row gap-1 items-start w-full" key={i}> 
                                        <div
                                        key={p.name + p.url}
                                        className="my-0.5 px-1 py-0.5 bg-white dark:bg-neutral-300 rounded-md h-[24px] shadow-lg text-gray-800 font-medium text-sm flex-shrink-0"> 
                                        {p.name} 
                                        </div>
                                        <textarea
                                        className="flex-grow w-full rounded-r border border-neutral-500 px-1 bg-transparent dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                                        value={p.description ?? 'N/A'}
                                        disabled={true}
                                        rows={1} 
                                        />
                                    </div>
                                    )}
                                </div> : 'No Parameters'}
                            </td>

                            <td className="text-center border border-neutral-500 max-w-[250px]">
                                <textarea className="w-full rounded-r border border-neutral-500 px-1 bg-transparent dark:text-neutral-100 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50"
                                    value={op.description ?? 'N/A'}
                                    disabled={true}
                                    rows={3} 
                                />
                            </td>


                            <td>
                                <div className="w-[30px] flex-shrink-0 mr-6">
                                {hoveredOp === opIdx  || isDeletingOp === opIdx ?
                                <button
                                    title={"Delete Op"}
                                    type="button"
                                    disabled={isDeletingOp !== -1}
                                    className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                    onClick={() => {
                                        handleDeleteOp(op, opIdx);
                                    }}>
                                    {isDeletingOp === opIdx ? <>{loadingIcon(20)}</>: <IconTrash size={20}/>}
                                </button>  
                                    
                                : null}
                                </div>
                            </td>
                        </tr>     
                    )}
                    </tbody>
                </table>
                </div>
                }
                isOpened={true}
            /> </div>}
        </div>
        </>

}

const emptyOps = () => {
    return {
        id: '', // same as name
        name: '',
        url: '',
        method: 'POST',
        description: '',
        type: 'custom',
        params: [],
        tag: '',
    } as OpDef;
}
