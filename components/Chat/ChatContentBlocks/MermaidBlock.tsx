import mermaid from "mermaid";
import { useContext, useEffect, useState } from "react";
import HomeContext from "@/pages/home/home.context";
import { IconZoomIn } from "@tabler/icons-react";
import styled, { keyframes } from "styled-components";
import { FiCommand } from "react-icons/fi";

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
        lineColor: "#fff",
    },
    themeCSS: `
        
        /* START GANTT CSS */

        /* Enhance task bar visuals */
        .task, .task0, .task1 {
            fill: #4e79a7; /* Change task bar color */
            stroke: #2c3e50; /* Add border to task bars */
            stroke-width: 1px; /* Border width */
        }
        /* Task text styles - now set to be hidden */
        .taskText, .taskText0, .taskText1 {
            fill: #ffffff; /* Change task text color for readability; THIS IS THE TEXT THAT SHOWS UP ON THE TASK BARS */
            font-weight: bold; /* Make text bold */
        }
        /* Section styles for better separation */
        .section, .section0, .section1 {
            fill: #f8f9fa; /* Light background for sections */
            stroke: #ced4da; /* Border color for sections */
            stroke-width: 1px; /* Border width for sections */
            white-space: nowrap; /* Prevent text from wrapping to new line */
            overflow: hidden; /* Hide overflow */
            text-overflow: ellipsis; /* Add an ellipsis if the text is too long */
            max-width: 50px; /* Set a max-width for section titles */
        }
        /* Section title styles */
        .sectionTitle, .sectionTitle0, .sectionTitle1 {
            fill: none; /* Change section title color; THIS IS THE TEXT THAT WOULD SHOW UP ON THE LEFT SIDE OF CHART */
            font-weight: bold; /* Make section titles bold */
        }
        /* Grid and tick lines */
        .grid .tick line {
            stroke: #adb5bd; /* Softer color for grid lines */
        }
        /* Current date line */
        .today {
            stroke: #e63946; /* A distinct color for 'today' line */
            stroke-dasharray: 4; /* Dashed style for 'today' line */
            stroke-width: 2px; /* Make the 'today' line thicker */
        }
        /* Title text for overall Gantt chart */
        .titleText {
            fill: #eeeeee; /* Title color */
            font-size: 20px; /* Increase title font size */
            font-weight: bold; /* Bold title text */
        }

        /* END GANTT CSS */

        /* START ERD CSS */

        /* Remove any fill opacity or haze from entity and attribute boxes */
        .entityBox, .attributeBoxOdd, .attributeBoxEven {
            fill: none; 
            fill-opacity: 1; /* Ensure fill is fully opaque */
            stroke-opacity: 1; /* Ensure stroke is fully opaque */
        }

        /* Add styles to remove highlight from relationship labels */
        .relationshipLabelBox {
            fill: none; /* Remove the fill style if it's causing the haze */
            background-color: none; /* Remove the background color */
            opacity: 1; /* Set the opacity to full to remove any transparency */
        }

        .relationshipLabelBox rect {
            opacity: 1; /* Ensure there's no transparency on the label boxes */
        }

        /* END ERD CSS */

        /* START QUADRANT CSS */

        /* Ensure solid background for quadrants with no opacity to avoid "haze" */
        .quadrant rect {
            opacity: 1; /* Ensure there's no transparency on the quadrant backgrounds */
            /* fill: none;  Remove background fill */
        }

        /* Quadrant background colors */
        .quadrant:nth-child(1) rect {
            fill: #8ecae6; /* Color for 'top left' quadrant */
        }

        .quadrant:nth-child(2) rect {
            fill: #219ebc; /* Color for 'top right' quadrant */
        }

        .quadrant:nth-child(3) rect {
            fill: #8e9091; /* Color for 'bottom left' quadrant */
        }

        .quadrant:nth-child(4) rect {
            fill: #f5f7f7; /* Color for 'bottom right' quadrant */
        }

        /* Quadrant text label color */
        .quadrant text {
            fill: #333333; /* Dark Grey */
        }

        /* Point color */
        .data-point circle {
            fill: #004aad; /* Deep Blue */
        }

        /* Point label color */
        .data-point text {
            fill: #111111; /* Almost Black */
            /* Optional: Add a subtle white text-shadow for readability on all backgrounds */
            /* text-shadow: 1px 1px 2px #ffffff; */
        }

        /* END QUADRANT CSS */
    `,
};

mermaid.initialize(mermaidConfig);

interface MermaidProps {
    chart: string;
    currentMessage: boolean;
}


const Mermaid: React.FC<MermaidProps> = ({ chart, currentMessage }) => {
    const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [height, setHeight] = useState<number>(500);


    const {
        state: { messageIsStreaming },
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
        <div style={{ maxHeight: "450px" }}>
            <div className="flex items-center space-x-4">
                <IconZoomIn />
                <input
                    type="range"
                    min="250"
                    max="4000"
                    value={height}
                    onChange={(e) => { // @ts-ignore
                        setHeight(e.target.value)
                    }}
                />
            </div>
            <div style={{ height: `${height + 20}px`, width: `${2 * height}px`, overflow: "auto" }}>
                {messageIsStreaming && currentMessage ? <div><LoadingIcon /> Loading...</div> :
                    <img style={{ height: `${height}px` }}
                        src={svgDataUrl || "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"80\"><text x=\"0\" y=\"30\" font-size=\"18\" font-family='sans-serif' font-weight=\"bold\" fill=\"white\">Loading...</text></svg>"}
                        alt="Loading" />
                }
            </div>
        </div>;
};

export default Mermaid;