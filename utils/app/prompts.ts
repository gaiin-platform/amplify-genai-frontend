import { Prompt } from '@/types/prompt';
import JSON5 from "json5";
import { v4 as uuidv4 } from 'uuid';
import {AttachedDocument} from "@/types/attacheddocument";
import {parseVariableName} from "@/components/Chat/VariableModal";
import {MessageType} from "@/types/chat";
import { isAssistant, isSystemAssistant } from './assistants';
import { storageSet } from './storage';

export interface VariableFillOption {
    isEditable?: boolean,
    filler?: (variable:string) => any;
}

export interface VariableFillOptions {
    [key: string]: VariableFillOption;
}

export const createEmptyPrompt = (name: string, folderId: string | null):Prompt => {
  return {
    id: uuidv4(),
    name: name,
    description: '',
    content: '',
    folderId: folderId,
    type: MessageType.PROMPT
  };
}

const dateTimeString = () => {
  let date = new Date();

  let month = ('0' + (date.getMonth() + 1)).slice(-2); // getMonth() starts from 0, so add 1
  let day = ('0' + date.getDate()).slice(-2);
  let year = date.getFullYear().toString().substr(-2); // take the last 2 digit of the year

  let hours = ('0' + date.getHours()).slice(-2);
  let minutes = ('0' + date.getMinutes()).slice(-2);

  let formattedDate = `${month}/${day}/${year} ${hours}:${minutes}`;
  return formattedDate;
}

export const handleStartConversationWithPrompt = (handleNewConversation:any, prompts:Prompt[], startPrompt: Prompt) => {

  let prompt = startPrompt;

  let rootPromptObj = (prompt.data?.rootPromptId) ?
      prompts.find((p) => p.id == prompt.data?.rootPromptId) : null;

  if(rootPromptObj == null && prompt.type === MessageType.ROOT){
    rootPromptObj = prompt;
    prompt = {
      description: rootPromptObj.description,
      folderId: null,
      id: uuidv4(),
      name: "Chat with "+rootPromptObj.name,
      type: MessageType.PROMPT,
      content: "Tell me about what you can help me with.",
      data: {
        rootPromptId: rootPromptObj.id,
        ...(prompt.data || {}),
      }
    }
  }

  let rootPrompt = null;
  if (rootPromptObj != null && rootPromptObj?.content) {
    let variables = parsePromptVariables(rootPromptObj?.content);
    let variableValues = variables.map((v) => "");
    rootPrompt = fillInTemplate(rootPromptObj?.content, variables, variableValues, [], true);
  }

  const getPromptTags = (prompt: Prompt | null | undefined) => {
    return (prompt && prompt.data && prompt.data.conversationTags) ? prompt.data.conversationTags : [];
  }

  let tags: string[] = [...getPromptTags(rootPromptObj), ...getPromptTags(prompt)]
  if (prompt.type == "automation") {
    tags.push("automation");
  }
  if (prompt.type === MessageType.PREFIX_PROMPT) {
    tags = [...tags, ...(prompt.data?.requiredTags || [])];
  }
  // remove duplicates 
  tags = Array.from(new Set(tags));

  handleNewConversation(
      {
        name: prompt.name + " " + dateTimeString(),
        messages: [],
        promptTemplate: prompt,
        processors: [],
        tools: [],
        tags: tags,
        ...(rootPrompt != null && {prompt: rootPrompt}),
      })
}

export const updatePrompt = (updatedPrompt: Prompt, allPrompts: Prompt[]) => {
  const updatedPrompts = allPrompts.map((c) => {
    if (c.id === updatedPrompt.id) {
      return updatedPrompt;
    }

    return c;
  });

  savePrompts(updatedPrompts);

  return {
    single: updatedPrompt,
    all: updatedPrompts,
  };
};

export const savePrompts = (prompts: Prompt[]) => {
  const importedAssistants = prompts.filter(prompt => isAssistant(prompt) && prompt.data?.noShare && 
                                                       !prompt.groupId && !isSystemAssistant(prompt));   
  const localPrompts = prompts.filter((p:Prompt) => !isAssistant(p)); // imported ones 
  storageSet('prompts', JSON.stringify([...localPrompts, ...importedAssistants]));
};


export const parsePromptVariables = (content: string) => {
  const regex = /{{(.*?)}}/g;
  const foundVariables = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    foundVariables.push(match[1].trim());
  }

  return foundVariables;
};

export const parsePromptVariableValues = (variable: string) => {
  let type = variable.split(":");
  if(type.length > 1) {
    let optionsPart = type[1].trim();

    let delims = (optionsPart.split("(")[0].length < optionsPart.split("[")[0].length)
        ? ["(",")"] : ["[","]"];

    let start = variable.indexOf(delims[0]);
    let end = variable.indexOf(delims[1]);

    let dataStr = "{" + variable.substring(start + 1, end) + "}";

    if (delims[0] === "(") {
      try {
        return JSON5.parse(dataStr);
      } catch (e) {
        return {}
      }
    } else {
      try {
        return JSON5.parse(dataStr);
      } catch (e) {
        return {values: variable.substring(start + 1, end).split(",")};
      }
    }
  }
  else {
    return {};
  }
}

export interface VariableOptions {
  [key: string]: any;
}

export const getName = (variable:string) => {
  if(variable.indexOf(":") > -1) {
    return variable.split(":")[0];
  }
  else {
    return variable;
  }
}

export const getType = (variable:string) => {

  if(variable.indexOf(":") > -1) {
    let startParen = (variable.indexOf("(") > -1) ? variable.indexOf("(") : variable.length;
    let startBracket = (variable.indexOf("[") > -1) ? variable.indexOf("[") : variable.length;
    let end = Math.min(startParen, startBracket);
    return variable.slice(variable.indexOf(":")+1, end);
  }
  else {
    return "text";
  }
}


export const defaultVariableFillOptions:VariableFillOptions = {
    "uniqueId":{
      isEditable: false,
      filler: (variable:string) => {
        return uuidv4();
      }
    },
    "options":{
      isEditable: true,
    },
    "file":{
      isEditable: true,
    },
    "files":{
      isEditable: true,
    },
    "conversation": {
      isEditable: true,
    },
    "template": {
      isEditable: true,
    },
    "text": {
      isEditable: true,
    },
}


export const getFillHelp = (fillOptions: VariableFillOptions, variable:string) => {
  let type = getType(variable);
  let options = fillOptions[type];
  if(options && options.filler) {
      return options.filler;
  }
  else {
      return null;
  }
}

export const parseEditableVariables = (content: string) => {
  const all = parsePromptVariables(content);
  const editable = all.filter((variable) => {
        let type = getType(variable);
        let options = defaultVariableFillOptions[type];
        return options && !(!(options.isEditable));
    })

  return editable;
}

export const fillInTemplate = (template:string, variables:string[], variableValues: string[], documents: AttachedDocument[] | null, insertDocuments:boolean, fillOptions?:VariableFillOptions) => {

  const names = variables.map(v => parseVariableName(v));

  const newContent = template.replace(/{{\s*(.*?)\s*}}/g, (match, variable) => {
    const name = parseVariableName(variable);
    const index = names.indexOf(name);
    const type = getType(variable);
    const options = parsePromptVariableValues(variable);


    const filler = getFillHelp(fillOptions || defaultVariableFillOptions, variable);

    if(filler) {
      let filled = filler(variable);
      return filled;
    }

    if (insertDocuments && documents && documents.length > 0) {

      let document = documents.filter((doc) => {
        return (doc.name == name);
      })[0];

      if (document) {
        let text = document.raw;
        if(text && text.length > 0){

          if(options.includeMetadata) {
            text = "Document Name: "+document.name+"\nDocument Type: "+document.type+"\n"+text;
          }
          if(options.lineNumbers) {
            text = text.split("\n").map((line:string, index:number) => "Line "+index+": "+line).join("\n");
          }
          if(options.escape) {
            text = text.replaceAll("\"", "\\\"")
                .replaceAll("\'", "\\\'")
                .replaceAll("\`", "\\\`")
                .replaceAll("\n","\\n");
          }
          if(options.truncate && options.truncate > 0) {
            text = text.slice(0, options.truncate);
          }
          if(options.truncateFromEnd && options.truncateFromEnd > 0) {
            text = text.slice(-1 * options.truncateFromEnd);
          }
        }

        return "" + ((text)? text : "");
      }
    }

    return (variableValues[index])? variableValues[index] : "";
  });

  return newContent;
}

export const optional = {
  stage: "display",
  type: "boolean",
  title: "Optional",
  default: false,
};

export const variableTypeOptions = {
  "uniqueId":{},
  "tools":{},
  "options":{
    optional
  },
  "file":{
    optional,
    // insert:{
    //     stage: "submit",
    //     type: "boolean",
    //     title: "Insert Content into Prompt (workflows only)",
    //     description: "For workflows, this will skip attaching the document and directly include it in the prompt.",
    //     default: true,
    // },
    includeMetadata: {
      stage: "submit",
      type: "boolean",
      title: "Include Document Metadata",
      default: false,
      description: "Add the document name and type at the top of the content",
    },
    lineNumbers: {
      stage: "submit",
      type: "boolean",
      title: "Line Numbers",
      default: false,
      description: "Add line numbers to the start of each line of text",
      function: (options:VariableOptions, text:string) => text.split("\n")
          .map((line, index) => "Line "+index+": "+line).join("\n")
    },
    escape: {
      stage: "submit",
      type: "boolean",
      title: "Escape",
      default: false,
      description: "Remove all double quotes and newlines from the text",
      function: (options:VariableOptions, text:string) => text.split("\n")
          .map((line, index) => text.replaceAll("\"", "\\\"")
              .replaceAll("\n","\\n"))
    },
    truncate: {
      stage: "submit",
      type: "integer",
      title: "Truncate",
      default: 0,
      description: "If the text is longer than the max characters, truncate it.",
      function: (options:VariableOptions, text:string) => text.slice(0, options.truncate)
    },
    truncateFromEnd: {
      stage: "submit",
      type: "integer",
      title: "Truncate from End",
      default: -1,
      description: "If the text is longer than the max characters, truncate it start from the end.",
      function: (options:VariableOptions, text:string) => text.slice(-1 * options.truncate)
    },
  },
  "conversation": {
    optional,
    options: {
      stage: "display",
      type: "list",
      title: "Options",
      default: [],
      description: "Comma separated list of allowed conversation names to include",
    },
    startsWith: {
      stage: "display",
      type: "text",
      title: "Starts With",
      default: "",
      description: "What the name of the conversation should start with",
    },
  },
  "template": {
    optional,
    options: {
      stage: "display",
      type: "list",
      title: "Options",
      default: [],
      description: "Comma separated list of allowed template names to include",
    },
    type: {
      stage: "display",
      type: "options",
      title: "Type",
      options: [{label:"prompt",value:"prompt"},{label:"automation",value:"automation"}],
      default: "prompt",
      description: "What type of template (automation or prompt)",
    },
    startsWith: {
        stage: "display",
        type: "text",
        title: "Starts With",
        default: "",
        description: "What the name of the template should start with",
      },
  },
  "text": {
    optional,
    lineNumbers: {
      stage: "submit",
      type: "boolean",
      title: "Line Numbers",
      default: false,
      description: "Add line numbers to the start of each line of text",
      function: (options:VariableOptions, text:string) => text.split("\n")
          .map((line, index) => "Line "+index+": "+line).join("\n")
    },
    escape: {
      stage: "submit",
      type: "boolean",
      title: "Escape",
      default: false,
      description: "Remove all double quotes and newlines from the text",
      function: (options:VariableOptions, text:string) => text.split("\n")
          .map((line, index) => text.replaceAll("\"", "\\\"")
              .replaceAll("\n","\\n"))
    },
    truncate: {
      stage: "submit",
      type: "integer",
      title: "Truncate",
      default: 0,
      description: "If the text is longer than the max characters, truncate it.",
      function: (options:VariableOptions, text:string) => text.slice(0, options.truncate)
    },
    truncateFromEnd: {
      stage: "submit",
      type: "integer",
      title: "Truncate from End",
      default: -1,
      description: "If the text is longer than the max characters, truncate it start from the end.",
      function: (options:VariableOptions, text:string) => text.slice(-1 * options.truncate)
    },
    regex: {
      stage: "validate",
      type: "regex",
      title: "Validate with regular expression",
      default: ".*",
      description: "If the text does not match the regular expression, the user will not be able to submit the prompt.",
      function: (options:VariableOptions, text:string) => text.match(options.regex)
    },
  }
}