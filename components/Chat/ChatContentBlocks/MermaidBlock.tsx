import mermaid from "mermaid";
import { useContext, useEffect, useState, useCallback, useMemo } from "react";
import HomeContext from "@/pages/api/home/home.context";
import { IconZoomIn, IconDownload, IconRefresh, IconCode, IconFlipVertical } from "@tabler/icons-react";
import { LoadingIcon } from "@/components/Loader/LoadingIcon";
import { CodeBlock } from "@/components/Markdown/CodeBlock";


const mermaidConfig = {
    startOnLoad: true,
    theme: "base",
    securityLevel: "loose",
    logLevel: 'error',
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\"",
    themeVariables: {
        fontSize: "18px",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\"",
        darkMode: true,
        background: "#282a36",
        mainBkg: "#282a36",
        lineColor: "#fff",
    },
    pie: {
        textPosition: 0.5
    },
    mindmap: {
        padding: 16,
        useMaxWidth: true
    },
    timeline: {
        useMaxWidth: true,
        diagramMarginX: 50,
        diagramMarginY: 10
    },
    themeCSS: `
        /* Global diagram styles */
        .label {
            font-family: var(--fontFamily);
            color: white;
        }
        .edgeLabel {
            background-color: rgba(40, 42, 54, 0.7);
            color: white;
        }
        text {
            font-family: var(--fontFamily);
        }
        
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
        }
        /* END QUADRANT CSS */

        /* START MINDMAP CSS */
        .mindmap-node rect, .mindmap-node circle, .mindmap-node ellipse, .mindmap-node polygon {
            fill: #4A89DC;
            stroke: #2E5AAC;
            stroke-width: 1px;
        }
        .mindmap-node-main rect, .mindmap-node-main circle, .mindmap-node-main ellipse, .mindmap-node-main polygon {
            fill: #8E44AD;
            stroke: #693380;
        }
        .mindmap-node text {
            fill: white;
            font-weight: bold;
        }
        .mindmap-edge {
            stroke: #2E5AAC;
            stroke-width: 2px;
        }
        /* END MINDMAP CSS */

        /* START TIMELINE CSS */
        .timeline-event-text {
            fill: white;
            font-weight: bold;
        }
        .timeline-label {
            fill: #f8f8f8;
        }
        .timeline-event {
            fill: #5D8AA8;
            stroke: #355E7E;
        }
        /* END TIMELINE CSS */

        /* START SEQUENCE DIAGRAM CSS */
        .actor {
            fill: #3498db;
            stroke: #2980b9;
        }
        .actor-text {
            fill: white;
            font-weight: bold;
        }
        .messageLine0, .messageLine1 {
            stroke: #f8f8f8;
            stroke-width: 2;
        }
        .messageText {
            fill: #f8f8f8;
        }
        .loopLine {
            stroke: #8A2BE2;
        }
        .loopText {
            fill: #8A2BE2;
        }
        .note {
            fill: #ffcc5c;
            stroke: #f4a62a;
        }
        .noteText {
            fill: #333;
            font-weight: bold;
        }
        /* END SEQUENCE DIAGRAM CSS */

        /* START PIE CHART CSS */
        .pieCircle {
            stroke: #282a36;
            stroke-width: 2px;
        }
        .pieTitleText {
            fill: white;
            font-size: 20px;
            font-weight: bold;
        }
        .pieOuterText {
            fill: white;
            font-weight: bold;
        }
        .pieInnerText {
            fill: white;
            font-weight: bold;
        }
        /* END PIE CHART CSS */

        /* START USER JOURNEY CSS */
        .journey-section {
            fill: none;
            stroke: #a6b1e1;
            stroke-width: 1px;
        }
        .task-font {
            fill: white;
            font-weight: bold;
        }
        /* END USER JOURNEY CSS */
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
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [diagramType, setDiagramType] = useState<string>('');
    const [retryCount, setRetryCount] = useState<number>(0);
    const [showCode, setShowCode] = useState<boolean>(false);
    const [isFlipped, setIsFlipped] = useState<boolean>(true);
    const maxRetries = 3;


    const {
        state: { messageIsStreaming, artifactIsStreaming},
    } = useContext(HomeContext);

    // Function to flip diagram orientation
    const flipOrientation = useCallback(() => {
        console.log("Flipping orientation from", isFlipped, "to", !isFlipped);
        setIsFlipped(!isFlipped);
    }, [isFlipped]);

    // Function to get the modified chart with flipped orientation
    const getModifiedChart = useCallback(() => {
        console.log("getModifiedChart called, isFlipped:", isFlipped);
        
        let modifiedChart = chart;

        // Handle flowchart/graph diagrams
        if (chart.includes('flowchart') || chart.includes('graph')) {
            console.log("Processing flowchart/graph");
            
            if (isFlipped) {
                // When flipped, change vertical orientations to horizontal
                modifiedChart = modifiedChart
                    .replace(/flowchart\s+(TD|TB|BT)/gi, 'flowchart LR')
                    .replace(/graph\s+(TD|TB|BT)/gi, 'graph LR');
            } else {
                // When not flipped, change horizontal orientations back to vertical
                modifiedChart = modifiedChart
                    .replace(/flowchart\s+(LR|RL)/gi, 'flowchart TD')
                    .replace(/graph\s+(LR|RL)/gi, 'graph TD');
            }
        }
        
        // Handle sequence diagrams
        else if (chart.includes('sequenceDiagram')) {
            console.log("Processing sequence diagram");
            // Add or modify participant order for horizontal layout
            if (isFlipped) {
                modifiedChart = modifiedChart.replace(
                    'sequenceDiagram',
                    'sequenceDiagram\n    %%{wrap}%%'
                );
            }
        }
        
        // Handle state diagrams
        else if (chart.includes('stateDiagram')) {
            console.log("Processing state diagram");
            
            if (isFlipped) {
                // Add direction LR when flipped
                if (!modifiedChart.includes('direction')) {
                    modifiedChart = modifiedChart.replace(
                        'stateDiagram-v2',
                        'stateDiagram-v2\n    direction LR'
                    ).replace(
                        'stateDiagram',
                        'stateDiagram\n    direction LR'
                    );
                } else {
                    modifiedChart = modifiedChart.replace(/direction\s+TB/gi, 'direction LR');
                }
            } else {
                // Remove direction or change back to TB when not flipped
                if (modifiedChart.includes('direction LR')) {
                    modifiedChart = modifiedChart.replace(/direction\s+LR/gi, 'direction TB');
                }
            }
        }
        
        // Handle class diagrams
        else if (chart.includes('classDiagram')) {
            console.log("Processing class diagram");
            
            if (isFlipped) {
                // Add direction LR when flipped
                if (!modifiedChart.includes('direction')) {
                    modifiedChart = modifiedChart.replace(
                        'classDiagram',
                        'classDiagram\n    direction LR'
                    );
                } else {
                    modifiedChart = modifiedChart.replace(/direction\s+TB/gi, 'direction LR');
                }
            } else {
                // Remove direction or change back to TB when not flipped
                if (modifiedChart.includes('direction LR')) {
                    modifiedChart = modifiedChart.replace(/direction\s+LR/gi, 'direction TB');
                }
            }
        }

        console.log("Modified chart:", modifiedChart);
        return modifiedChart;
    }, [chart, isFlipped]);

    // Only include messageIsStreaming in dependencies for current message
    const effectDependencies = useMemo(() => {
        return currentMessage ? [chart, messageIsStreaming, retryCount, isFlipped] : [chart, retryCount, isFlipped];
    }, [chart, currentMessage, messageIsStreaming, retryCount, isFlipped]);
    
    // Function to download the current diagram as SVG with proper background
    const downloadDiagram = useCallback(() => {
        if (!svgDataUrl) return;
        
        // Create a temporary element to parse the SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(decodeURIComponent(svgDataUrl.split(',')[1]), 'image/svg+xml');
        const svgElement = svgDoc.documentElement;
        
        // Add a background rect as the first element if it doesn't exist
        const existingBackground = svgElement.querySelector('rect[width="100%"][height="100%"]');
        if (!existingBackground) {
            // Get SVG dimensions
            const width = svgElement.getAttribute('width') || '100%';
            const height = svgElement.getAttribute('height') || '100%';
            
            // Create background rectangle
            const backgroundRect = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'rect');
            backgroundRect.setAttribute('width', width);
            backgroundRect.setAttribute('height', height);
            backgroundRect.setAttribute('fill', '#282a36'); // Dark background color matching the theme
            backgroundRect.setAttribute('x', '0');
            backgroundRect.setAttribute('y', '0');
            
            // Insert as the first child
            if (svgElement.firstChild) {
                svgElement.insertBefore(backgroundRect, svgElement.firstChild);
            } else {
                svgElement.appendChild(backgroundRect);
            }
        }
        
        // Convert back to string and create data URL
        const svgString = new XMLSerializer().serializeToString(svgDoc);
        const modifiedSvgDataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)}`;
        
        // Create download link
        const link = document.createElement('a');
        link.href = modifiedSvgDataUrl;
        link.download = `${diagramType || 'mermaid'}-diagram.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [svgDataUrl, diagramType]);


    useEffect(() => {
        mermaid.initialize(mermaidConfig);
    }, []);


    // Detect diagram type from the chart content
    useEffect(() => {
        if (!chart) return;
        
        const detectDiagramType = () => {
            if (chart.includes('erDiagram')) return 'Entity Relationship';
            if (chart.includes('stateDiagram')) return 'State Diagram';
            if (chart.includes('classDiagram')) return 'Class Diagram';
            if (chart.includes('sequenceDiagram')) return 'Sequence Diagram';
            if (chart.includes('flowchart') || chart.includes('graph')) return 'Flow Chart';
            if (chart.includes('quadrantChart')) return 'Quadrant Chart';
            if (chart.includes('gantt')) return 'Gantt Chart';
            if (chart.includes('pie')) return 'Pie Chart';
            if (chart.includes('mindmap')) return 'Mind Map';
            if (chart.includes('timeline')) return 'Timeline';
            if (chart.includes('journey')) return 'User Journey';
            if (chart.includes('gitGraph')) return 'Git Graph';
            if (chart.includes('sankey')) return 'Sankey Diagram';
            if (chart.includes('requirement')) return 'Requirement Diagram';
            return 'Unknown Diagram';
        };
        
        setDiagramType(detectDiagramType());
    }, [chart]);

    useEffect(() => {
        if (typeof window !== 'undefined' && chart) {
            // If this is not the current message, render immediately regardless of streaming state
            // If this is the current message and streaming, don't render yet
            // console.log("useEffect triggered - currentMessage:", currentMessage, "isFlipped:", isFlipped);
            if (currentMessage && messageIsStreaming) {
                return;
            }

            setIsLoading(true);
            setError(null);

            const renderChart = async () => {
                try {
                    // Reset mermaid config to ensure clean state
                    mermaid.initialize(mermaidConfig);
                    
                    // Add small delay to ensure DOM is ready
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Use the modified chart with orientation changes
                    const chartToRender = getModifiedChart();
                    console.log("About to render chart:", chartToRender);
                    
                    // Validate chart syntax
                    await mermaid.parse(chartToRender);
                    
                    // Render the chart with a unique ID to avoid conflicts
                    const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                    const { svg } = await mermaid.render(uniqueId, chartToRender);
                    
                    if (svg) {
                        const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
                        setSvgDataUrl(svgDataUrl);
                        setIsLoading(false);
                        setRetryCount(0); // Reset retry count on success
                    } else {
                        throw new Error('Failed to generate SVG content');
                    }
                } catch (err) {
                    console.error('Mermaid diagram error:', err);
                    
                    // Implement retry logic
                    if (retryCount < maxRetries) {
                        console.log(`Retrying diagram render (${retryCount + 1}/${maxRetries})`);
                        setRetryCount(prevCount => prevCount + 1);
                        // Wait a bit longer between retries
                        setTimeout(() => renderChart(), 500 * (retryCount + 1));
                    } else {
                        setError(
                            `Failed to render diagram after ${maxRetries} attempts: ${err instanceof Error ? err.message : 'Unknown error'}. ` + 
                            'Please check your diagram syntax.'
                        );
                        setIsLoading(false);
                        setRetryCount(0); // Reset for next attempt
                    }
                }
            };

            renderChart();
        }
    }, effectDependencies);

    return (
        <div className="mermaid-diagram-container" style={{ maxHeight: "450px",  paddingTop: showCode ? "12px" : undefined, paddingLeft: showCode ? "16px" : undefined}}>
            {diagramType && (
                <div className="text-xs text-gray-400 mb-1">Diagram type: {diagramType}</div>
            )}
            
            {error ? (
                <div className="p-4 border border-red-300 bg-red-50 text-red-700 rounded">
                    <p className="font-medium">Error rendering diagram</p>
                    <p className="text-sm">{error}</p>
                    <button 
                        onClick={() => {
                            setError(null);
                            setIsLoading(true);
                            setRetryCount(0);
                        }}
                        className="mt-3 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex flex-col space-y-2 mb-3">
                        <div className="text-sm text-gray-300 font-medium">Diagram Controls</div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setHeight(Math.max(250, height - 100))}
                                className="p-1 rounded hover:bg-gray-700 text-gray-400 transition-colors"
                                title="Zoom out"
                                aria-label="Zoom out"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    <line x1="8" y1="11" x2="14" y2="11"></line>
                                </svg>
                            </button>
                            <div 
                                className="text-gray-400 cursor-pointer" 
                                onClick={() => setHeight(Math.min(4000, height + 100))}
                                title="Zoom in"
                            >
                                <IconZoomIn size={18} />
                            </div>
                            <button
                                onClick={flipOrientation}
                                className="p-1 rounded hover:bg-gray-700 text-gray-400 transition-colors"
                                title="Flip orientation"
                                aria-label="Flip diagram orientation"
                            >
                                <IconFlipVertical size={18} />
                            </button>
                            <div className="flex space-x-2">
                                <button 
                                    onClick={() => setHeight(500)} 
                                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                >
                                    Reset
                                </button>
                               
                                {!isLoading && svgDataUrl && (
                                    <button
                                        onClick={downloadDiagram}
                                        className="px-2 py-1 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded flex items-center transition-colors"
                                        title="Download diagram as SVG"
                                    >
                                        <IconDownload size={14} className="mr-1" /> Save
                                    </button>
                                )}
                                <button 
                                    onClick={() => setShowCode(!showCode)} 
                                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors flex items-center"
                                    title={showCode ? "View diagram" : "View as code"}
                                >
                                    <IconCode size={14} className="mr-1" /> 
                                    {showCode ? "Diagram" : "Code"}
                                </button>
                                <span className="text-xs text-gray-400 flex items-center">{height}px</span>

                            </div>
                        </div>
                    </div>
                    
                    {showCode ? (
                        <div className="mt-3 pb-4 pr-4">
                            <CodeBlock language="mermaid" value={getModifiedChart()} />
                        </div>
                    ) : (
                    <div 
                        className="mermaid-container relative border border-gray-700 rounded-md overflow-hidden"
                        style={{ 
                            maxHeight: `${height + 20}px`,
                            maxWidth: '100%'
                        }}
                    >
                        <div
                            className="overflow-auto p-2"
                            style={{ 
                                height: `${height + 20}px`, 
                                minWidth: '100%',
                                maxWidth: `${2 * height}px`
                            }}
                        >
                        {/* Only show loading for current message when streaming, or when actually loading */}
                        {(messageIsStreaming && currentMessage) || (isLoading && (!messageIsStreaming || currentMessage)) ? (
                            <div className="flex items-center justify-center h-full">
                                <LoadingIcon />
                                <span className="ml-2">Rendering diagram...</span>
                            </div>
                        ) : (
                            svgDataUrl ? (
                                <img 
                                    style={{ height: `${height}px` }}
                                    src={svgDataUrl}
                                    alt={`${diagramType || 'Mermaid'} diagram`} 
                                    className="mx-auto"
                                    onError={() => {
                                        setError('Failed to display diagram. The SVG might be malformed.');
                                    }}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                        <line x1="12" y1="9" x2="12" y2="13"/>
                                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                                    </svg>
                                    <span>No diagram content available</span>
                                </div>
                            )
                        )}
                        </div>
                    </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Mermaid;