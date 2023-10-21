import { Prompt } from '@/types/prompt';
import JSON5 from "json5";

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
  localStorage.setItem('prompts', JSON.stringify(prompts));
};

export const parsePromptVariables = (content: string) => {
  const regex = /{{(.*?)}}/g;
  const foundVariables = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    foundVariables.push(match[1]);
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
        return {options: dataStr.split(",")};
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

export const variableTypeOptions = {
  "conversation": {
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