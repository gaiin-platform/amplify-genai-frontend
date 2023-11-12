import mermaid from "mermaid";
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

const mermaidConfig = {
    startOnLoad: true,
    theme: "base",
    securityLevel: "loose",
    themeVariables: {
        fontSize: "18px",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\"",
        darkMode: true,
        background: "#282a36",
        mainBkg: "#282a36",

        lineColor: "#ff79c6",
    },
    // themeCSS: `
    //   g.classGroup rect {
    //     fill: #282a36;
    //     stroke: #6272a4;
    //   }
    //   g.classGroup text {
    //     fill: #f8f8f2;
    //   }
    //   g.classGroup line {
    //     stroke: #f8f8f2;
    //     stroke-width: 0.5;
    //   }
    //   .classLabel .box {
    //     stroke: #21222c;
    //     stroke-width: 3;
    //     fill: #21222c;
    //     opacity: 1;
    //   }
    //   .classLabel .label {
    //     fill: #f1fa8c;
    //   }
    //   .relation {
    //     stroke: #ff79c6;
    //     stroke-width: 1;
    //   }
    //   #compositionStart, #compositionEnd {
    //     fill: #bd93f9;
    //     stroke: #bd93f9;
    //     stroke-width: 1;
    //   }
    //   #aggregationEnd, #aggregationStart {
    //     fill: #21222c;
    //     stroke: #50fa7b;
    //     stroke-width: 1;
    //   }
    //   #dependencyStart, #dependencyEnd {
    //     fill: #00bcd4;
    //     stroke: #00bcd4;
    //     stroke-width: 1;
    //   }
    //   #extensionStart, #extensionEnd {
    //     fill: #f8f8f2;
    //     stroke: #f8f8f2;
    //     stroke-width: 1;
    //   }`,

};

mermaid.initialize(mermaidConfig);

interface MermaidProps {
    chart: string;
    currentMessage: boolean;
}


const Mermaid: React.FC<MermaidProps> = ({chart, currentMessage}) => {
    const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [height, setHeight] = useState<number>(500);


    const {
        state: {messageIsStreaming},
    } = useContext(HomeContext);


    useEffect(() => {
        mermaid.initialize(mermaidConfig);
    }, []);


    useEffect(() => {
        if (typeof window !== 'undefined') {

            const showLoading = () => {
                if (!messageIsStreaming) {
                    setSvgDataUrl("data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"600\"><text x=\"0\" y=\"100\" font-size=\"12\" font-family='sans-serif'>Loading...</text></svg>")
                }
            };

            if (!messageIsStreaming) {
                try {
                    mermaid.parse(chart).then((result) => {
                        mermaid.render('graphDiv', chart).then(
                            (svgContent) => {
                                if (svgContent) {
                                    // @ts-ignore
                                    const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svgContent.svg)}`;
                                    setSvgDataUrl(svgDataUrl);
                                } else {
                                    //showLoading();
                                }
                            }
                        ).catch((e) => {
                            console.log(e);
                            //showLoading();
                        });
                    }).catch((e) => {
                        console.log(e);
                        //showLoading();
                    });

                } catch (err) {
                    console.log(err);
                    //showLoading();
                }
            }
        }
    }, [chart]);

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
                    <img style={{height: `${height}px`}}
                         src={svgDataUrl || "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"80\"><text x=\"0\" y=\"30\" font-size=\"18\" font-family='sans-serif' font-weight=\"bold\" fill=\"white\">Loading...</text></svg>"}
                         alt="Loading"/>
                }
            </div>
        </div>;
};

export default Mermaid;


