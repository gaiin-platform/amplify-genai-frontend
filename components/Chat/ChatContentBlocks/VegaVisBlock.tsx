import {useContext, useEffect, useState} from "react";
import HomeContext from "@/pages/api/home/home.context";
import {IconZoomIn} from "@tabler/icons-react";
import styled, {keyframes} from "styled-components";
import {FiCommand} from "react-icons/fi";


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


const VegaVis: React.FC<VegaProps> = ({chart, currentMessage}) => {
    const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [height, setHeight] = useState<number>(500);

    const {
        state: {messageIsStreaming},
    } = useContext(HomeContext);

    useEffect(() => {
        if (typeof window !== 'undefined') {

            if (!messageIsStreaming) {
                try {


                } catch (err) {
                    console.log(err);
                    //showLoading();
                }
            }
        }
    }, [chart]);

    const spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v4.json",
        "data": {
            "values": [
                {"Category": "A", "Amount": 28},
                {"Category": "B", "Amount": 55},
                {"Category": "C", "Amount": 43},
                {"Category": "D", "Amount": 91},
                {"Category": "E", "Amount": 81},
                {"Category": "F", "Amount": 53},
                {"Category": "G", "Amount": 19},
                {"Category": "H", "Amount": 87}
            ]
        },
        "mark": "bar",
        "encoding": {
            "x": {"field": "Category", "type": "ordinal"},
            "y": {"field": "Amount", "type": "quantitative"}
        }
    };

    // @ts-ignore
    return error ?
        <div>{error}</div> :
        <div style={{maxHeight:"450px"}}>
            <div className="flex items-center space-x-4">
                <IconZoomIn/>
                <input
                    type="range"
                    min="250"
                    max="4000"
                    value={height}
                    onChange={(e)=>{ // @ts-ignore
                        setHeight(e.target.value)}}
                />
            </div>
            <div style={{height: `${height + 20}px`, width: `${2 * height}px`, overflow:"auto"}}>
                {messageIsStreaming && currentMessage ? <div><LoadingIcon/> Loading...</div> :
                    // @ts-ignore
                    // <Vega spec={spec}/>
                    <div>Loading...</div>
                }
            </div>
        </div>;
};

export default VegaVis;