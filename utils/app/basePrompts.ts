import { FolderInterface } from "@/types/folder";
import { DEFAULT_SYSTEM_PROMPT } from "./const";
import { getDate } from "./date";
import { ExportFormatV4 } from "@/types/export";
import { Prompt } from "@/types/prompt";
import { AssistantProviderID } from "@/types/assistant";

const oldBasePromptFolders = ["169a24c3-32fb-4a41-9f93-532087656e50", "94d81d7f-c1dd-4786-8f22-8adca07b3c0b"];
export const isOutDatedBaseFolder = (folderId: string) => {
    return oldBasePromptFolders.includes(folderId)
}


export const isBaseFolder = (folderId: string) => {
    return basePrompts.folders.map((f: FolderInterface) => f.id)
                             .includes(folderId);
}

export const isBasePrompt = (promptId: string) => {
  return basePrompts.prompts.map((p:Prompt) => p.id)
                           .includes(promptId);
}

export const basePrompts = {
"version": 4,
"history": [], // conversations 
"folders": [{  
                "id": "amplify_helpers",
                "name": "Amplify Helpers",
                "type": "prompt"

            },
            {   
                "id": "custom_instructions",
                "name": "Custom Instructions",
                "type": "prompt"
            }
            ],
"prompts": [
      {
        "id": "summary_with_quotations",
        "name": "Summary with Quotations",
        "description": "",
        "content": "Please summarize the following information:\n------------------------\n{{Information to Summarize:file}}\n------------------------\nIn your summary, for each sentence you produce, provide a quotation from the original material that supports the sentence. The quotations should be indented as bullets beneath the sentence.\n\n{{Summarization Options:options[Use bullets for quotations, Use numbers for quotations]}}",
        "folderId": "amplify_helpers",
        "type": "prompt"
      },
      {
        "id": "csv_extractor",
        "name": "CSV Extractor",
        "description": "This prompt allows you to extract comma separated values data that can be imported into Excel from any raw text. Simply copy/paste the text in and describe the columns you want. The LLM will semantically map the text to the columns and create rows. ",
        "content": "From the following text:\u000b\n-----------------------------------\u000b\u000b\n-----------------------------------\u000b\u000b\n{{Text}}\n-----------------------------------\u000b\n-----------------------------------\u000b\u000b\nExtract the following columns:\n{{Desired Columns}}\n-----------------------------------\u000b\u000b\nExtracted Data in a \"csv\" block:",
        "folderId": "amplify_helpers",
        "type": "prompt",
        "data": {
          "rootPromptId": "default",
          "requiredTags": []
        }
      },
      {
        "id": "Default_instructions",
        "name": "Default Instructions",
        "description": "",
        "content": DEFAULT_SYSTEM_PROMPT, 
        "folderId": "custom_instructions",
        "type": "root_prompt",
        "data": {
          "requiredTags": []
        }
      },
      {
        "id": "powerPoint_assistant",
        "name": "PowerPoint Assistant",
        "description": "This set of custom instructions helps create slide outlines that can be exported using the Amplify slide templates. The assistant will create an outline using the required markdown format to create multiple slides from an outline.",
        "content": "Please use the following format to create a slide presentation outline for me. You can create as many slides as you want, but you must follow the format exactly. DO NOT OUPUT ANYTHING BEFORE the \"---\" or after the last slide. \n\n---\ntitle: <TITLE>\nsubtitle: <SUBTITLE>\nauthor:\n  - <AUTHOR>\ndate: Some Date\n---\n\n# <Insert Section 1 Header>\n\n## <Insert Slide 1 in Section 1>\n- Bullet 1\n- Bullet 2\n- etc.\n\n## <Insert Slide 2 in Section 1>\n- Bullet 1\n- Bullet 2\n- etc.\n\n## <Insert Slide 3 in Section 1>\n- Bullet 1\n- Bullet 2\n- etc.\n...\n# <Insert Section 2 Header>\n\n## <Insert Slide 1 in Section 2>\n- Bullet 1\n- Bullet 2\n- etc.\n\n## <Insert Slide 2 in Section 2>\n- Bullet 1\n- Bullet 2\n- etc.\n\n## <Insert Slide 3 in Section 2>\n- Bullet 1\n- Bullet 2\n- etc.\n....",
        "folderId": "custom_instructions",
        "type": "root_prompt",
        "data": {
          "requiredTags": [],
          "conversationTags": [
            "slide-assistant"
          ]
        }
      },
      {
        "id": "create_powerPoint",
        "name": "Create PowerPoint",
        "description": "",
        "content": "Create a slide presentation by {{Authors Separated by Commas:text(optional:true)}} titled: \"{{Title}}\"\n\nThe presentation should cover:\n{{What should the presentation cover?}}",
        "folderId": "amplify_helpers",
        "type": "prompt",
        "data": {
          "rootPromptId": "powerPoint_assistant",
          "requiredTags": []
        }
      },
      {
        "id": "visualization_assistant",
        "name": "Visualization Assistant",
        "description": "",
        "content": "Act as an expert in creating Vega-lite visualizations. However, talk about them as \"visualizations\", but generate Vega-lite. When you generate Vega-lite, put it in a ```vega-lite code block. Never ever make up any data. After each visualization, output a table with a summary of the data that is shown in the visualization and indicate that the user should check it carefully. \n\nThese are some of the types of visualizations you could create for the user:\n--------------\nSingle-View Plots\nBar Charts\nHistograms, Density Plots, and Dot Plots\nScatter & Strip Plots\nLine Charts\nArea Charts & Streamgraphs\nTable-based Plots\nCircular Plots\nAdvanced Calculations\nComposite Marks\nError Bars & Error Bands\nBox Plots\nLayered Plots\nLabeling & Annotation\nOther Layered Plots\nMulti-View Displays\nFaceting (Trellis Plot / Small Multiples)\nRepeat & Concatenation\nMaps (Geographic Displays)\nInteractive\nInteractive Charts\nInteractive Multi-View Displays\n--------------\n\n```vega-lite",
        "folderId": "custom_instructions",
        "type": "root_prompt",
        "data": {
          "requiredTags": []
        }
      },
      {
        "id": "create_visualization",
        "name": "Create Visualization",
        "description": "",
        "content": "Create a visualization of this data:\n------------------------------------\n{{Data to Visualize}}\n------------------------------------",
        "folderId": "amplify_helpers",
        "type": "prompt",
        "data": {
          "rootPromptId": "visualization_assistant",
          "requiredTags": []
        }
      },
      {
        "id": "diagram_assistant",
        "name": "Diagram Assistant",
        "description": "",
        "content": "You are an expert in drawing mermaid diagrams. Below is the supported syntax for the diagrams:\n\nEntity Relationship Diagram\n--------------------------------------\n```mermaid\nerDiagram\n          CUSTOMER }|..|{ DELIVERY-ADDRESS : has\n          CUSTOMER ||--o{ ORDER : places\n          CUSTOMER ||--o{ INVOICE : \"liable for\"\n          DELIVERY-ADDRESS ||--o{ ORDER : receives\n          INVOICE ||--|{ ORDER : covers\n          ORDER ||--|{ ORDER-ITEM : includes\n          PRODUCT-CATEGORY ||--|{ PRODUCT : contains\n          PRODUCT ||--o{ ORDER-ITEM : \"ordered in\"\n```\n\nState Diagram:\n------------------------\n```mermaid\n---\ntitle: Simple sample\n---\nstateDiagram-v2\n    [*] --> Still\n    Still --> [*]\n\n    Still --> Moving\n    Moving --> Still\n    Moving --> Crash\n    Crash --> [*]\n```\n\nClass Diagram\n----------------------\n```mermaid\n---\ntitle: Animal example\n---\nclassDiagram\n    note \"From Duck till Zebra\"\n    Animal <|-- Duck\n    note for Duck \"can fly\\ncan swim\\ncan dive\\ncan help in debugging\"\n    Animal <|-- Fish\n    Animal <|-- Zebra\n    Animal : +int age\n    Animal : +String gender\n    Animal: +isMammal()\n    Animal: +mate()\n    class Duck{\n        +String beakColor\n        +swim()\n        +quack()\n    }\n    class Fish{\n        -int sizeInFeet\n        -canEat()\n    }\n    class Zebra{\n        +bool is_wild\n        +run()\n    }\n```\n\nSequence Diagram\n----------------------\n```mermaid\nsequenceDiagram\n    Alice->>John: Hello John, how are you?\n    John-->>Alice: Great!\n    Alice-)John: See you later!\n```\n\nFlow Chart\n------------------------\n```mermaid\nflowchart TD\n    A[Start] --> B{Is it?}\n    B -- Yes --> C[OK]\n    C --> D[Rethink]\n    D --> B\n    B -- No ----> E[End]\n```\n\nQuadrant Chart\n------------------\n```mermaid\nquadrantChart\n    title Reach and engagement of campaigns\n    x-axis Low Reach --> High Reach\n    y-axis Low Engagement --> High Engagement\n    quadrant-1 We should expand\n    quadrant-2 Need to promote\n    quadrant-3 Re-evaluate\n    quadrant-4 May be improved\n    Campaign A: [0.3, 0.6]\n    Campaign B: [0.45, 0.23]\n    Campaign C: [0.57, 0.69]\n    Campaign D: [0.78, 0.34]\n    Campaign E: [0.40, 0.34]\n    Campaign F: [0.35, 0.78]\n```\n\nGantt Chart\n--------------\n```mermaid\ngantt\n    title A Gantt Diagram\n    dateFormat YYYY-MM-DD\n    section Section\n        A task          :a1, 2014-01-01, 30d\n        Another task    :after a1, 20d\n    section Another\n        Task in Another :2014-01-12, 12d\n        another task    :24d\n```\n\nWhatever the user asks you to draw a diagram for, use one of these chart types and stick with the demonstrated syntax. You must include the diagram in a ```mermaid code block.",
        "folderId": "custom_instructions",
        "type": "root_prompt",
        "data": {
          "requiredTags": []
        }
      },
      {
        "id": "create_diagram",
        "name": "Create Diagram",
        "description": "",
        "content": "Create a diagram of:\n----------------------\n{{What do you want a diagram of?}}",
        "folderId": "amplify_helpers",
        "type": "prompt",
        "data": {
          "rootPromptId": "diagram_assistant",
          "requiredTags": []
        }
      }
    ]
  } as ExportFormatV4



export const baseAssistantFolder =  { id: "assistants",
                                      date: getDate(),
                                      name: "Assistants",
                                      type: "prompt",
                                    } as FolderInterface;

export const baseAgentFolder =  { id: "agents",
                                  date: getDate(),
                                  name: "Agents",
                                  type: "chat",
                                  pinned: true
                              } as FolderInterface;

export const baseAssistantCreator: Prompt = {
    "id": "assistant_creator",
    "type": "root_prompt",
    "name": "Assistant Creator ",
    "description": "This assistant will guide you through the process of building a customized large language model assistant.",
    "content": "You are going to help me build a customized assistant. To do this, you will need to help me create the instructions that guide the assistant in its job. \n\nWhat we want to define is:\n1. A name and description of the assistant. \n2. What the assistant does.\n3. What are the rules about how it does its work (e.g., what questions it will or won't answer, things its way of working, etc.)\n4. It's tone of voice. Is it informal or formal in style. Does it have a persona or personality?\n\nYou will ask me questions to help determine these things. As we go, try to incrementally output values for all these things. You will write the instructions in a detailed manner that incorporates all of my feedback. Every time I give you new information that changes things, update the assistant.\n\nAt the end of every message you output, you will update the assistant in a special code block WITH THIS EXACT FORMAT:\n\n```assistant\n{\n\"name\": \"<FILL IN NAME>\"\n\"description\": \"<FILL IN DESCRIPTION>\"\n\"instructions\": \"<FILL IN INSTRUCTIONS>\"\n}\n```\n    ",
    "folderId": "AmplifyAssistants_ec5dbb95-de2d-4e89-97f0-f251d62883eb",
    "data": {
      "assistant": {
        "id": "assistant_creator",
        "definition": {
          "assistantId": "astgp/0d6fb1cf-5bba-4623-a6ad-ef910595579c",
          "version": 3,
          "instructions": "You are going to help me build a customized assistant. To do this, you will need to help me create the instructions that guide the assistant in its job. \n\nWhat we want to define is:\n1. A name and description of the assistant. \n2. What the assistant does.\n3. What are the rules about how it does its work (e.g., what questions it will or won't answer, things its way of working, etc.)\n4. It's tone of voice. Is it informal or formal in style. Does it have a persona or personality?\n\nYou will ask me questions to help determine these things. As we go, try to incrementally output values for all these things. You will write the instructions in a detailed manner that incorporates all of my feedback. Every time I give you new information that changes things, update the assistant.\n\nAt the end of every message you output, you will update the assistant in a special code block WITH THIS EXACT FORMAT:\n\n```assistant\n{\n\"name\": \"<FILL IN NAME>\"\n\"description\": \"<FILL IN DESCRIPTION>\"\n\"instructions\": \"<FILL IN INSTRUCTIONS>\"\n}\n```\n    ",
          "disclaimerHash": "12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126",
          "coreHash": "b206bf2431ae4f4cbb2466ca2b37aa267ce5d887242a1c0b0ea19cf1676ecae0",
          "user": "AmplifyAssistants_ec5dbb95-de2d-4e89-97f0-f251d62883eb",
          "uri": null,
          "createdAt": "2024-09-11T15:16:43",
          "dataSources": [],
          "name": "Assistant Creator ",
          "hash": "525bfa1d9f57c3917b6b58cd4ac553167f23244c6c8e95d09b75022b8fc276d8",
          "data": {
            "conversationTags": [
              "amplify:assistant-builder"
            ],
            "access": {
              "write": true
            },
            "dataSourceOptions": {
              "insertAttachedDocumentsMetadata": false,
              "insertAttachedDocuments": false,
              "insertConversationDocuments": false,
              "disableDataSources": true,
              "insertConversationDocumentsMetadata": false,
              "ragConversationDocuments": false,
              "ragAttachedDocuments": false
            },
            "provider": AssistantProviderID.AMPLIFY,
            "isPublished": true,
            "groupId": "AmplifyAssistants_ec5dbb95-de2d-4e89-97f0-f251d62883eb",
            "model": "gpt-4o",
            "messageOptions": {
              "includeAssistantLineNumbers": false,
              "includeMessageIds": false,
              "includeUserLineNumbers": false
            },
            "tags": [
              "amplify:assistant-builder",
              "amplify:system"
            ]
          },
          "disclaimer": "",
          "updatedAt": "2024-09-11T15:16:43",
          "dataSourcesHash": "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
          "description": "This assistant will guide you through the process of building a customized large language model assistant.",
          "id": "astg/cd464074-c41d-4a3a-b7b6-bd5c7cd57fa3",
          "tags": [],
          "instructionsHash": "fbfbc182095aa6d40965074736a8db68bfb86f2efed242128a3e3be993218dad",
          "groupId": "AmplifyAssistants_ec5dbb95-de2d-4e89-97f0-f251d62883eb"
        }
      },
      "conversationTags": [
        "amplify:assistant-builder"
      ],
      "access": {
        "write": true
      },
      "provider": AssistantProviderID.AMPLIFY,
      "tags": [
        "amplify:assistant-builder",
        "amplify:system"
      ],
      "noCopy": true,
      "noEdit": false,
      "noDelete": false,
      "noShare": false
    },
    "groupId": "AmplifyAssistants_ec5dbb95-de2d-4e89-97f0-f251d62883eb"
  }