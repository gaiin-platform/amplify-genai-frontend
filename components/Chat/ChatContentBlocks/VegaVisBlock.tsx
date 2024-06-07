import {useContext, useEffect, useState} from "react";
import HomeContext from "@/home/home.context";
import {IconZoomIn} from "@tabler/icons-react";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";
import {VegaLite} from "react-vega";

const animate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(720deg);
  }
`;

const LoadingIcon = styled(FiCommand)`
  color: lightgray;
  font-size: 1rem;
  animation: ${animate} 2s infinite;
`;

interface VegaProps {
    chart: string;
    currentMessage: boolean;
}


const VegaVis: React.FC<VegaProps> = ({ chart, currentMessage }) => {

    const [error, setError] = useState<string | null>(null);
    const { state: { messageIsStreaming } } = useContext(HomeContext);

    useEffect(() => {
        // Effect for initializing or updating the visualization when 'chart' changes
        if (typeof window !== 'undefined' && !messageIsStreaming) {
            try {
                // Test if 'chart' can be parsed as JSON and catch any errors
                JSON.parse(chart);
            } catch (err) {
                console.error(err);
                setError('Failed to parse Vega specification. Please check the JSON format.');
            }
        }
    }, [chart, messageIsStreaming]); // Rerun effect if 'chart' or 'messageIsStreaming' changes

    const renderVisualization = () => {
        try {
            // Parse the JSON string only once and handle errors
            const parsedChart = JSON.parse(chart);

            //parsedChart.autosize = { type: 'fit', contains: 'padding' };

            return <VegaLite width={550} height={450} spec={parsedChart} actions={false} />;
        } catch (parseError) {
            //console.error(parseError);
            //setError('Failed to parse the Vega specification. Check the JSON format.');
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