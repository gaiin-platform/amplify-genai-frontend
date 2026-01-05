import { FC, useContext, useState } from "react";
import { loadingIcon, titleLabel } from "../AdminUI";
import { AdminConfigTypes, Embedding, EmbeddingsConfig } from "@/types/admin";
import { userFriendlyDate } from "@/utils/app/date";
import { getInFlightEmbeddings, terminateEmbedding } from "@/services/adminService";
import HomeContext from "@/pages/api/home/home.context";

interface Props {
    refresh:  (type: AdminConfigTypes, click: () => void, loading: boolean, title?: string, top?: string) => JSX.Element
    refreshingTypes: AdminConfigTypes[];
    setRefreshingTypes: (t:AdminConfigTypes[]) => void;

}

export const EmbeddingsTab: FC<Props> = ({refresh, refreshingTypes, setRefreshingTypes}) => {
    const { state: { amplifyUsers} } = useContext(HomeContext);

    const [embeddings, setEmbeddings] = useState<EmbeddingsConfig>({embeddings: []});  
    const [hasRetrievedEmbeddings, setHasRetrievedEmbeddings] = useState<boolean>(false);
    const [loadingEmbeddings, setLoadingEmbeddings] = useState<boolean>(false);
    const [terminatingEmbeddings, setTerminatingEmbeddings] = useState<string[]>([]);
    const [hoveredRow, setHoveredRow] = useState<number>(-1);
        
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
                <table className="modern-table hide-last-column" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr className="gradient-header hide-last-column text-center">
                            {["Message ID", "Event Time", "User", "Key", "Chunk", "Size"].map((i) => (
                                <th
                                    key={i}
                                    className="px-4 py-2 border border-gray-500 text-neutral-600 dark:text-neutral-300"
                                    style={{width:
                                            i === "Message ID" ? "16%"
                                                : i === "Event Time" ? "10%"
                                                : i === "User" ? "20%"
                                                : i === "Key" ? "30%"
                                                : i === "Chunk" ? "6%"
                                                : "8%", // Size
                                    }}>
                                    {i}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {embeddings.embeddings.map((embedding: Embedding, i: number) => (
                            <tr key={i} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(-1)}>
                                <td className="border border-neutral-500 px-4 py-2 break-words">
                                    {embedding.messageId}
                                </td>
                                <td className="border border-neutral-500 px-4 py-2 text-center break-words">
                                    {userFriendlyDate(embedding.eventTime)}
                                </td>
                                <td className="border border-neutral-500 px-4 py-2 text-center">
                                    {amplifyUsers[embedding.object.user] || embedding.object.user}
                                </td>
                                <td className="border border-neutral-500 px-2 py-2">
                                    <div className="break-all text-xs leading-tight max-h-16 overflow-y-auto" title={embedding.object.key}>
                                        {embedding.object.key}
                                    </div>
                                </td>
                                <td className="border border-neutral-500 px-2 py-2 text-center">
                                    {embedding.object.chunkNumber ?? '-'}
                                </td>
                                <td className="border border-neutral-500 px-2 py-2 text-center">
                                    {embedding.object.size}
                                </td>
                                <td>
                                    <div className="w-[30px] flex-shrink-0">
                                        {hoveredRow === i && !embedding.terminated && !terminatingEmbeddings.includes(embedding.object.key) ? (
                                            <button
                                                title="Terminate Embedding"
                                                type="button"
                                                className="ml-2 p-1 text-sm bg-neutral-400 dark:bg-neutral-500 rounded hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none"
                                                onClick={() => {
                                                    handleTerminateEmbedding(embedding.object.key);
                                                }}
                                            >
                                                Terminate
                                            </button>
                                        ) : embedding.terminated ? (
                                            <span className="text-xs ml-1 force-red-text">Terminated</span>
                                        ) : terminatingEmbeddings.includes(embedding.object.key) ? (
                                            <span className="text-xs ml-1 force-yellow-text">...</span>
                                        ) : null}
                                    </div>
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