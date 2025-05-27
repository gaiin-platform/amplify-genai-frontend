import { FC, useState } from "react";
import { loadingIcon, titleLabel } from "../AdminUI";
import { AdminConfigTypes, Embedding, EmbeddingsConfig } from "@/types/admin";
import { userFriendlyDate } from "@/utils/app/date";
import { getInFlightEmbeddings, terminateEmbedding } from "@/services/adminService";

interface Props {
    refresh:  (type: AdminConfigTypes, click: () => void, loading: boolean, title?: string, top?: string) => JSX.Element
    refreshingTypes: AdminConfigTypes[];
    setRefreshingTypes: (t:AdminConfigTypes[]) => void;

}

export const EmbeddingsTab: FC<Props> = ({refresh, refreshingTypes, setRefreshingTypes}) => {

        const [embeddings, setEmbeddings] = useState<EmbeddingsConfig>({embeddings: []});  
        const [hasRetrievedEmbeddings, setHasRetrievedEmbeddings] = useState<boolean>(false);
        const [loadingEmbeddings, setLoadingEmbeddings] = useState<boolean>(false);
        const [terminatingEmbeddings, setTerminatingEmbeddings] = useState<string[]>([]);
        
    const handleGetEmbeddings = async () => {
        setLoadingEmbeddings(true);
        const resultData = await getInFlightEmbeddings();
        if (resultData) {
            setHasRetrievedEmbeddings(true);
            setEmbeddings({ embeddings:
                resultData as Embedding[]});
        } else {
            alert("Unable to retrieve message currently in the sqs. Please try again later...");
        }

        setLoadingEmbeddings(false);
        setRefreshingTypes(refreshingTypes.filter(t => t !== AdminConfigTypes.EMBEDDINGS));
    }

    const handleTerminateEmbedding = async (key: string) => {
        if (!terminatingEmbeddings.includes(key)) setTerminatingEmbeddings([...terminatingEmbeddings, key]);

        const result = await terminateEmbedding(key);
        if (result) {
            setEmbeddings((prevState) => ({
                embeddings: prevState.embeddings.map((embedding) =>
                    embedding.object.key === key
                        ? { ...embedding, terminated: true } // Set terminate flag to true
                        : embedding
                ),
            }));
        } else {
            alert("Unable to terminate embedding at this time.");
        }
        setTerminatingEmbeddings(terminatingEmbeddings.filter((k:string) => k !== key));
    }
    

    return <div className="admin-style-settings-card">
        <div className="admin-style-settings-card-header">
            <div className="flex flex-row items-center gap-3 mb-2">
                <h3 className="admin-style-settings-card-title">Embeddings Circuit Breaker</h3>
                <div className="flex-shrink-0">
                    {hasRetrievedEmbeddings && refresh(AdminConfigTypes.EMBEDDINGS, () => {
                        setHasRetrievedEmbeddings(false);
                        handleGetEmbeddings()}, false, "Retrieve Embeddings", "mt-0")} 
                </div>
            </div>
            <p className="admin-style-settings-card-description">Monitor and manage in-flight embeddings in the SQS queue</p>
        </div>

        {hasRetrievedEmbeddings ? 
            <div className="mt-4">
                {embeddings.embeddings.length > 0 ? 
                <table className="border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr className="bg-gray-200 dark:bg-[#373844] text-center">
                            {["Message ID", "Event Time", "User", "Key", "Size", "Terminate"].map((i) => (
                                <th
                                    key={i}
                                    className="p-0.5 border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                    style={{width:
                                            i === "Message ID" ? "18%"
                                                : i === "Event Time" ? "12%"
                                                : i === "User" ? "25%"
                                                : i === "Key" ? "28%"
                                                : i === "Size" ? "8%"
                                                : "10%", // terminated
                                    }}>
                                    {i}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {embeddings.embeddings.map((embedding: Embedding, i: number) => (
                            <tr key={i}>
                                <td className="border border-neutral-500 px-4 py-2 break-words">
                                    {embedding.messageId}
                                </td>
                                <td className="border border-neutral-500 px-4 py-2 text-center break-words">
                                    {userFriendlyDate(embedding.eventTime)}
                                </td>
                                <td className="border border-neutral-500 px-4 py-2 text-center">
                                    {embedding.object.user}
                                </td>
                                <td className="border border-neutral-500 px-4 py-2">
                                    <div className="truncate" title={embedding.object.key}>
                                        {embedding.object.key}
                                    </div>
                                </td>
                                <td className="border border-neutral-500 px-2 py-2 text-center">
                                    {embedding.object.size}
                                </td>
                                <td className="border border-neutral-500 py-2 text-center">
                                    <button
                                        className={` ${
                                            embedding.terminated || terminatingEmbeddings.includes(embedding.object.key) ? 'text-red-600' : 'hover:text-red-800'
                                        }`}
                                        disabled={embedding.terminated || terminatingEmbeddings.includes(embedding.object.key)}
                                        title={embedding.terminated ? '' : 'Terminate'}
                                        onClick={() => {
                                            handleTerminateEmbedding(embedding.object.key);
                                        }}
                                    >
                                        {embedding.terminated ? 'Terminated' 
                                                            : terminatingEmbeddings.includes(embedding.object.key) 
                                                            ? 'Terminating...' :'Terminate'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table> : <>It looks like Embbeddings is operating correctly. There are no embeddings currently backed up in SQS.</>}
            </div>
            : 
            ( loadingEmbeddings ?
                <label className="flex flex-row items-center mt-2 py-1 px-2"> 
                    <>{loadingIcon()}</> <span className="ml-2">{'Loading Embeddings...'}</span>
                </label>
            :
            <button 
                className="mt-2 py-1 px-2 w-[200px] bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 hover:dark:bg-gray-700 rounded transition-colors duration-100 cursor-pointer" 
                onClick={() => {
                    handleGetEmbeddings();
                    }}
                title="Retrieve in-flight embeddings"
                id="retrieveEmbeddingsButton"
                >
                {"Retrieve SQS Embeddings"}
                    
            </button>)
        }
    </div>

}