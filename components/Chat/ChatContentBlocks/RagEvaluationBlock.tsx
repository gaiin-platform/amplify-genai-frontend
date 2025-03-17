import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import {Message} from "@/types/chat";
import React from "react";

interface Props {
    messageIsStreaming: boolean;
    message: Message;
}

const RagEvaluationBlock: React.FC<Props> = (
    {message, messageIsStreaming
    }) => {

    const conatinsError = message.data?.state?.ragEvaluation?.error;
    if (conatinsError && !messageIsStreaming) console.log("Rag Evaluation Error: ", conatinsError);

    let metrics = (message.data?.state?.ragEvaluation) ? message.data.state.ragEvaluation : {};
    

    if (Object.keys(metrics).length === 0 || messageIsStreaming) return <></>;

    const factualConsistency = () =>  <>
            <MetricCard 
                title="Factual Consistency" 
                value={metrics.metrics?.factualConsistency} 
                description="Factual accuracy" 
            />
            <MetricCard 
                title="Relevance" 
                    value={metrics.metrics?.relevance} 
                    description="Answer relevance to question" 
            />
        </>
    
    return <div className="my-3" key={message.id}>
        <ExpansionComponent title="Rag Evaluation"
            content={
                <div className="px-4 space-y-6">
                    {/* Overall Quality Score */}
                    <div className="flex flex-col items-center space-y-2 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <label className="text-lg font-semibold">Overall Quality</label>
                        <div className="flex items-center">
                            <div 
                                className="text-3xl font-bold" 
                                style={{ 
                                    color: getScoreColor(metrics.summary?.overallQuality || 0) 
                                }}
                            >
                                {Math.round((metrics.summary?.overallQuality || 0) * 100)}%
                            </div>
                            <div className="ml-4 w-32 h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full" 
                                    style={{ 
                                        width: `${Math.round((metrics.summary?.overallQuality || 0) * 100)}%`,
                                        backgroundColor: getScoreColor(metrics.summary?.overallQuality || 0)
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Strengths and Weaknesses */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            {title: "Strengths", data: metrics.summary?.strengths || [], identifier: "strengths", color: "green"},
                            {title: "Areas for Improvement", data: metrics.summary?.weaknesses || [], identifier: "weaknesses", color: "red"}
                        ].map((item, index) => (
                            <div 
                                key={item.identifier} 
                                className={`p-4 rounded-lg border bg-${item.color}-50 dark:bg-${item.color}-900/20 border-${item.color}-200 dark:border-${item.color}-800 `}
                            >
                                <div className={`text-lg font-semibold text-${item.color}-700 dark:text-${item.color}-400 text-center`}>
                                    {item.title}
                                </div>
                                <div className="flex justify-center mt-[-14px]">
                                    <ul className="list-disc pl-5 space-y-1 inline-block">
                                        {item.data && item.data.length > 0 ?
                                            item.data.map((dataItem: string, idx: number) => (
                                                <li key={idx} className="text-sm">{dataItem}</li>
                                            )) : 
                                            <li className="text-sm">No {item.identifier} identified</li>
                                        }
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3"> {factualConsistency()}</div>

                    {/* Metrics Breakdown */}
                    <ExpansionComponent title="Detailed Metrics" content={
                        <div className="space-y-6">
                            {/* <h3 className="text-lg font-semibold border-b pb-2">Detailed Metrics</h3> */}

                            {/* Text Similarity Metrics */}
                            <div className="space-y-3">
                                <h4 className="font-medium">Text Similarity</h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <MetricCard 
                                        title="BLEU Score" 
                                        value={metrics.metrics?.bleu} 
                                        description="Measures exact phrase matches" 
                                    />
                                    <MetricCard 
                                        title="ROUGE-1" 
                                        value={metrics.metrics?.rouge1} 
                                        description="Unigram overlap" 
                                    />
                                    <MetricCard 
                                        title="ROUGE-2" 
                                        value={metrics.metrics?.rouge2} 
                                        description="Bigram overlap" 
                                    />
                                    <MetricCard 
                                        title="ROUGE-L" 
                                        value={metrics.metrics?.rougeL} 
                                        description="Longest common subsequence" 
                                    />
                                    <MetricCard 
                                        title="Semantic Similarity" 
                                        value={metrics.metrics?.semanticSimilarity} 
                                        description="Meaning-based similarity" 
                                    />
                                </div>
                            </div>

                            {/* Content Quality Metrics */}
                            <div className="space-y-3">
                                <h4 className="font-medium">Content Quality</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <MetricCard 
                                        title="Diversity" 
                                        value={metrics.metrics?.diversity} 
                                        description="Lexical variety" 
                                    />
                                    <MetricCard 
                                        title="Perplexity" 
                                        value={metrics.metrics?.perplexity} 
                                        description="Text predictability" 
                                        lowerIsBetter={true}
                                        displayValue={metrics.metrics?.perplexity ? metrics.metrics.perplexity.toFixed(2) : undefined}
                                    />
                                    {factualConsistency()}
                                </div>
                            </div>

                            {/* Readability Metrics */}
                            <div className="space-y-3">
                                <h4 className="font-medium">Readability</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <MetricCard 
                                        title="Readability Score" 
                                        value={metrics.metrics?.readability} 
                                        description="Text comprehension ease" 
                                        displayValue={metrics.metrics?.readability ? `${Math.round(metrics.metrics.readability)}%` : undefined}
                                        normalizedValue={metrics.metrics?.readability ? metrics.metrics.readability / 100 : undefined}
                                    />
                                    <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm">
                                        <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Reading Grade Level</div>
                                        <div className="text-xl font-semibold mt-1">
                                            {metrics.metrics?.readabilityGrade || "N/A"}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Education level needed to understand
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Metadata */}
                            <div className="text-xs text-gray-500 dark:text-gray-400 border-t">
                                <div>Evaluation ID: {metrics.evaluationId || "N/A"}</div>
                                {/* <div>Timestamp: {metrics.timestamp ? new Date(metrics.timestamp).toLocaleString() : "N/A"}</div> */}
                            </div>
                        </div>
                    }/>

                    {/* Input Details */}
                    {/* <ExpansionComponent title="View Input Details" content={
                        <div className="space-y-4 p-2">
                            <div>
                                <h4 className="font-medium mb-2">Question</h4>
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
                                    {metrics.inputs?.question || "No question available"}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-medium mb-2">Response</h4>
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
                                    {metrics.inputs?.response || "No response available"}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-medium mb-2">Reference</h4>
                                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
                                    {metrics.inputs?.reference || "No reference available"}
                                </div>
                            </div>
                        </div>
                    } /> */}

                    
                </div>
            }/>
    </div>;
};

// Helper component for metric cards
const MetricCard = ({ 
    title, 
    value, 
    description, 
    lowerIsBetter = false,
    displayValue,
    normalizedValue
}: { 
    title: string; 
    value: number | undefined; 
    description: string; 
    lowerIsBetter?: boolean;
    displayValue?: string;
    normalizedValue?: number;
}) => {
    // Use provided displayValue if available, otherwise calculate it
    const formattedValue = displayValue || (value !== undefined ? `${(value * 100).toFixed(0)}%` : "N/A");
    
    // Use normalized value for color if provided, otherwise use raw value
    const valueForColor = normalizedValue !== undefined ? normalizedValue : value;
    
    const scoreColor = valueForColor !== undefined ? 
        (lowerIsBetter ? getInverseScoreColor(valueForColor) : getScoreColor(valueForColor)) : 
        "text-gray-500";
    
    return (
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">{title}</div>
            <div className="text-xl font-semibold mt-1" style={{ color: scoreColor }}>
                {formattedValue}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</div>
        </div>
    );
};

// Helper functions for color coding
const getScoreColor = (score: number): string => {
    if (score >= 0.8) return "#10B981"; // green-500
    if (score >= 0.6) return "#059669"; // green-600
    if (score >= 0.4) return "#F59E0B"; // amber-500
    if (score >= 0.2) return "#EF4444"; // red-500
    return "#DC2626"; // red-600
};

const getInverseScoreColor = (score: number): string => {
    if (score <= 0.2) return "#10B981"; // green-500
    if (score <= 0.4) return "#059669"; // green-600
    if (score <= 0.6) return "#F59E0B"; // amber-500
    if (score <= 0.8) return "#EF4444"; // red-500
    return "#DC2626"; // red-600
};


export default RagEvaluationBlock;
