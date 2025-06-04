import {useContext, useEffect, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {VegaLite} from "react-vega";
import { fixJsonString } from "@/utils/app/errorHandling";
import { DefaultModels } from "@/types/model";


interface VegaProps {
    chart: string;
    currentMessage: boolean;
}


const VegaVis: React.FC<VegaProps> = ({ chart, currentMessage }) => {

    const [content, setContent] = useState<string>(chart);
    const [error, setError] = useState<string | null>(null);
    const { state: { messageIsStreaming, chatEndpoint, statsService, defaultAccount}, getDefaultModel} = useContext(HomeContext);

    const repairJson = async () => {
        console.log("Attempting to fix json...");
        const model = getDefaultModel(DefaultModels.ADVANCED);
        const fixedJson: string | null = await fixJsonString(model, chatEndpoint || "", statsService, chart, defaultAccount, "Failed to create visualization, attempting to fix...");
         // try to repair json
        if (fixedJson) {
            setContent(fixedJson);
        }  else {
            setError('Failed to parse Vega specification. Please check the JSON format.');
        }
    }

    useEffect(() => {
        // Effect for initializing or updating the visualization when 'chart' changes
        if (typeof window !== 'undefined' && !messageIsStreaming) {
            try {
                // Test if 'chart' can be parsed as JSON and catch any errors
                JSON.parse(chart);
            } catch (err) {
                // console.error(err);
                repairJson();
            }
        } else if (messageIsStreaming) {
            setContent(chart);
        }
    }, [chart, messageIsStreaming]); // Rerun effect if 'chart' or 'messageIsStreaming' changes

    const renderVisualization = () => {
        try {
            // Parse the JSON string only once and handle errors
            const parsedChart = JSON.parse(content);

            return <VegaLite width={550} height={450} spec={parsedChart} actions={false} />;
        } catch (parseError) {
            return <div>Loading...</div>;
        }
    };

    return (
        <div>
            {error ? (
                <div>{error}</div>
            ) : (
                // flex container with no specified width, allowing it to grow with the content
                // <div style={{ display: 'flex', justifyContent: 'center', background: 'black', padding: '10px' }}>
                <div className="p-0 m-0 w-full">
                    {(
                        renderVisualization()
                    )}
                 {/*</div>*/}
                </div>
            )}
        </div>
    );
};

export default VegaVis;