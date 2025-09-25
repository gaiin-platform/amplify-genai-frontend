import {FC, KeyboardEvent, useContext, useEffect, useRef, useState} from 'react';

import { useTranslation } from 'next-i18next';
import JSON5 from 'json5'
import { Prompt } from '@/types/prompt';
import {MessageType} from "@/types/chat";
import HomeContext from "@/pages/api/home/home.context";
import {variableTypeOptions, parsePromptVariableValues, parsePromptVariables, getType, getName} from "@/utils/app/prompts";
import ExpansionComponent from "@/components/Chat/ExpansionComponent";
import EditableField from "@/components/Promptbar/components/EditableField";
import { DEFAULT_SYSTEM_PROMPT } from "@/utils/app/const";
import PromptOptimizerButton from "@/components/Optimizer/PromptOptimizerButton";
import React from 'react';
import { Modal } from '@/components/ReusableComponents/Modal';


interface Props {
  prompt: Prompt;
  onSave: () => void;
  onCancel: () => void;
  onUpdatePrompt: (prompt: Prompt) => void;
}

const getVariableOptions = (promptTemplate:string) => {
  const variables = parsePromptVariables(promptTemplate);

  return variables.map((variable) => {
    const type = getType(variable);
    const values = parsePromptVariableValues(variable);
    // @ts-ignore
    const typeData = variableTypeOptions[type];

    return {
      label: getName(variable),
      variable: variable,
      type: type,
      optionValues: values,
      typeData: typeData
    };
  });
}

export const PromptModal: FC<Props> = ({ prompt, onCancel, onSave, onUpdatePrompt }) => {
  const { t } = useTranslation('promptbar');
  const {
    state: { featureFlags, prompts },
  } = useContext(HomeContext);

  const promptsRef = useRef(prompts);

  useEffect(() => {
      promptsRef.current = prompts;
    }, [prompts]);

  let workflowRoot:Prompt = {
    id: "default",
    name: "Default custom instructions",
    description: "Default custom instructions ",
    content: DEFAULT_SYSTEM_PROMPT,
    type: MessageType.ROOT,
    folderId: null,
  };

  let rootPrompts = [workflowRoot, ...promptsRef.current.filter((p: Prompt) => p.type === MessageType.ROOT && !p.groupId)];

  if(rootPrompts.length > 0) {
    workflowRoot =
        rootPrompts.filter((p:Prompt) => p.id === prompt.data?.rootPromptId)[0]
        || rootPrompts[0];
  }

  let initialCode = prompt.data?.code ? "const workflow = " + prompt.data.code :  '//@START_WORKFLOW\n' +
      'const workflow = async (fnlibs) => {\n' +
      '     \n' +
      '    try {\n' +
      '        fnlibs.tellUser("Executing the generated workflow...");\n' +
      '        let value = {type:"table", data:null}; // Initialize value\n' +
      '' +
      '        return value;\n' +
      '    }\n' +
      '    catch(e){\n' +
      '       throw e;\n' +
      '    }\n' +
      '};//@\n' +
      '\n';

  let cTags = (prompt.data && prompt.data.conversationTags)? prompt.data.conversationTags.join(",") : "";

  const [rootPrompt, setRootPrompt] = useState<Prompt>(workflowRoot);
  const [name, setName] = useState(prompt.name);
  const [description, setDescription] = useState(prompt.description);
  const [content, setContent] = useState(prompt.content);
  const [code, setCode] = useState(initialCode);
  const [conversationTags, setConversationTags] = useState(cTags);
  const [variableOptions, setVariableOptions] = useState(getVariableOptions(content));
  const [requiredTags, setRequiredTags] = useState(prompt.data?.requiredTags?.join(",") || "");

  const [selectedTemplate, setSelectedTemplate] = useState<string>(prompt.type || MessageType.PROMPT);

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateRootPrompt = (rootPromptId:string) => {
    try {
      let root = rootPrompts.filter((p:Prompt) => p.id === rootPromptId)[0];
      setRootPrompt(root);
    }catch (e) {
    }
  }

  const handleUpdateTemplate = (promptTemplate:string) =>{
    setVariableOptions(getVariableOptions(promptTemplate));
    setContent(promptTemplate);
  };

  const handleUpdateVariableOptionValues = (variable:string, type:string, optionName:string, optionValue:any) => {

    let newVariableOptions = [...variableOptions];
    newVariableOptions.forEach((variableOption) => {
      if(variableOption.label === variable){
        if(optionValue == null){
            delete variableOption.optionValues[optionName];
        }
        else {
          variableOption.optionValues[optionName] = optionValue;
        }
      }
    });

    const optionValuesToRender = newVariableOptions.filter((variableOption) => {
        return (variableOption.label === variable);
    })[0].optionValues;

    let renderedVariable = "{{"
        + variable + ":" + type
        + ((optionValuesToRender.length == 0)? "" : "(" + JSON5.stringify(optionValuesToRender).slice(1,-1) + ")")
        +"}}";

    const search = new RegExp("{{\\s*"+variable+"\\s*(\\s*:\\s*(.*?)\\s*(\\(.*?\\))?)?\\s*}}", "g");

    let newContent = content.replaceAll(search, renderedVariable);

    setVariableOptions(newVariableOptions);
    setContent(newContent);
  }


  const handleUpdatePrompt = () => {
    const newPrompt = { ...prompt, name, description, content: content.trim(), type: selectedTemplate};

    if(newPrompt.type === MessageType.PROMPT && rootPrompt && rootPrompt.id) {
      newPrompt.data = {...prompt.data, rootPromptId: rootPrompt.id};
    }
    else if (newPrompt.data && newPrompt.data.rootPromptId) {
      delete newPrompt.data.rootPromptId;
    }

    if(requiredTags){
      newPrompt.data = {...newPrompt.data, requiredTags: requiredTags.split(",").map((t: string) => t.trim())};
    }
    else {
      newPrompt.data = {...newPrompt.data, requiredTags: []};
    }

    if(conversationTags){
      newPrompt.data = {...newPrompt.data, conversationTags: conversationTags.split(",").map((t: string) => t.trim())};
    }

    if(selectedTemplate === MessageType.PREFIX_PROMPT) {
      if(parsePromptVariables(content).length === 0){
        newPrompt.content = content + "{{Please provide a chat message to start the conversation.}}";
      }
    }

    if(selectedTemplate === MessageType.OUTPUT_TRANSFORMER ||
       selectedTemplate === MessageType.PREFIX_PROMPT) {
      newPrompt.data = {...newPrompt.data, hidden:true};
    }

    onUpdatePrompt(newPrompt);
  }

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        window.addEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      window.removeEventListener('mouseup', handleMouseUp);
      onCancel();
    };

    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onCancel]);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);


  return (
    <Modal 
      height={() => window.innerHeight * 0.75}
      width={() => window.innerWidth * 0.55}
      title={"Prompt Template"}
      onCancel={() =>{
        onCancel();
      }} 
      onSubmit={() => {
        handleUpdatePrompt();
        onSave();
      }}
      submitLabel={"Save"}
      content={ <>
            <div className="text-sm font-bold text-black dark:text-neutral-200">
              {t('Name')}
            </div>
            <input
              ref={nameInputRef}
              id="promptModalName"
              className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
              placeholder={t('A name for your prompt.') || ''}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
              {t('Description')}
            </div>
            <textarea
              id="promptDescription"
              className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
              style={{ resize: 'none' }}
              placeholder={t('A description for your prompt.') || ''}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />

            {selectedTemplate !== MessageType.ROOT && selectedTemplate !== MessageType.AUTOMATION &&
                selectedTemplate !== MessageType.FOLLOW_UP && selectedTemplate !== MessageType.PREFIX_PROMPT && (
                <>
                <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                  {t('Custom Instructions')}
                </div>
              <select
              id="customInstructions"
              className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100 "
              value={rootPrompt.id}
              onChange={(e) => handleUpdateRootPrompt(e.target.value)}
              >
            {rootPrompts.map((rootPrompt, index) => (
                  <option key={index} value={rootPrompt.id}>
                     {rootPrompt.name}
                  </option>
                  ))}
                  </select>
                </>)}


            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
              {t('Prompt')}
            </div>
            <textarea
              id="promptContent"
              className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
              style={{ resize: 'none' }}
              placeholder={
                t(
                  'Prompt content. Use {{}} to denote a variable. Ex: {{name}} is a {{adjective}} {{noun}}',
                ) || ''
              }
              value={content}
              onChange={(e) => handleUpdateTemplate(e.target.value)}
              rows={10}
            />
            {featureFlags.promptOptimizer && (
                <>
                  <PromptOptimizerButton
                      prompt={content || ""}
                      largeTextBlocks={[]}
                      onOptimized={(optimizedPrompt:string) => {
                        setContent(optimizedPrompt);
                        handleUpdateTemplate(optimizedPrompt);
                      }}
                  />
                </>
            )}

            { variableOptions.length > 0 && (
                <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                    {t('Variables')}
                </div>
            )}
            { variableOptions.map((variableOption,index) => (
              <div key={index} id="variables" className="mt-2 mb-6 text-sm font-bold text-black dark:text-neutral-200">

                  <ExpansionComponent key={variableOption.variable} title={variableOption.label + ":" + variableOption.type}
                      // @ts-ignore
                                      content={
                        <div className="mt-2 mb-6 text-sm font-bold text-black dark:text-neutral-200">
                          {variableOption.typeData && Object.entries(variableOption.typeData).map(([key,data],index) => (
                              <div key={key} id={key} className="mt-4">
                                <input
                                    className={"mr-2"}
                                    type="checkbox"
                                    checked={
                                        variableOption.typeData[key].type === "boolean" ?
                                            (variableOption.optionValues[key]) :
                                            variableOption.optionValues[key] != null}
                                    onChange={(e) => {
                                      let newValue = null;

                                      if(!e.target.checked) {
                                        variableOption.optionValues[key] = null;
                                      }
                                      else {
                                        newValue = (variableOption.typeData[key].type === "boolean")? true :
                                            variableOption.typeData[key].default;
                                        variableOption.optionValues[key] = variableOption.typeData[key].default;
                                      }

                                      handleUpdateVariableOptionValues(variableOption.label, variableOption.type, key, newValue);
                                    }}
                                />

                                {// @ts-ignore
                                  data.title} <EditableField currentValue={variableOption.optionValues[key] || variableOption.typeData[key].default || ''} data={data} handleUpdate={(v)=>handleUpdateVariableOptionValues(variableOption.label, variableOption.type, key, v)}/>
                              </div>
                              ))}
                        </div>
                  }></ExpansionComponent>
              </div>
            ))}

            {selectedTemplate !== MessageType.PREFIX_PROMPT && (
            <div id="conversationTags" className="mt-6">
            <ExpansionComponent title={"Conversation Tags"} content={
                <div className="mt-2 mb-6 text-sm text-black dark:text-neutral-200 overflow-y">
                  <input
                      ref={nameInputRef}
                      className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                      placeholder={t('Tag names separated by commas.') || ''}
                      value={conversationTags}
                      title={"Tags for conversations created with this template."}
                      id="tagNamesInput"
                      onChange={(e) => {
                        setConversationTags(e.target.value);
                      }}
                  />
                </div>
            }/>
            </div>
            )}


            {((featureFlags.followUpCreate && selectedTemplate === MessageType.FOLLOW_UP) ||
                (featureFlags.promptPrefixCreate && selectedTemplate === MessageType.PREFIX_PROMPT) ||
                (featureFlags.outputTransformerCreate && selectedTemplate === MessageType.OUTPUT_TRANSFORMER))
                && (
                <>
                <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                  {t('Required Tags')}
                </div>
                <input
                    className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                    placeholder={'Required tag names separated by commas.'}
                    value={requiredTags}
                    title={'A list of any tags that must be present on the conversation for the buttons to appear.'}
                    onChange={(e) => setRequiredTags(e.target.value)}
                />
                </>
              )}


            <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
              {t('Template Type')}
            </div>
              <div className="mt-2 flex flex-col gap-3">
              <div className="ml-2 inline-flex items-center cursor-pointer text-neutral-900 dark:text-neutral-100 mr-8">
                <input
                    type="radio"
                    id="promptTemplateCheck"
                    name="template"
                    className="form-radio rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                    value={MessageType.PROMPT}
                    checked={selectedTemplate === MessageType.PROMPT}
                    onChange={() => setSelectedTemplate(MessageType.PROMPT)}
                />
                <label className="ml-2">
                  Prompt Template
                </label>
              </div>

                {featureFlags.rootPromptCreate && (
                    <div className="ml-2 inline-flex items-center cursor-pointer text-neutral-900 dark:text-neutral-100">
                      <input
                          type="radio"
                          id="customInstructionsCheck"
                          name="template"
                          className="form-radio rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                          value={MessageType.ROOT}
                          checked={selectedTemplate === MessageType.ROOT}
                          onChange={() => setSelectedTemplate(MessageType.ROOT)}
                      />
                      <label className="ml-2">
                        Custom Instructions
                      </label>
                    </div>
                )}

                {featureFlags.promptPrefixCreate && (
                    <div className="ml-2 inline-flex items-center cursor-pointer text-neutral-900 dark:text-neutral-100">
                      <input
                          type="radio"
                          name="template"
                          id="promptPrefixCheck"
                          className="form-radio rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                          value={MessageType.PREFIX_PROMPT}
                          checked={selectedTemplate === MessageType.PREFIX_PROMPT}
                          onChange={() => setSelectedTemplate(MessageType.PREFIX_PROMPT)}
                      />
                      <label className="ml-2">
                        Prompt Prefix
                      </label>
                    </div>
                )}

                {featureFlags.outputTransformerCreate && (
                    <div className="ml-2 inline-flex items-center cursor-pointer text-neutral-900 dark:text-neutral-100">
                      <input
                          type="radio"
                          name="template"
                          id="outputTransformerCheck"
                          className="form-radio rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                          value={MessageType.OUTPUT_TRANSFORMER}
                          checked={selectedTemplate === MessageType.OUTPUT_TRANSFORMER}
                          onChange={() => setSelectedTemplate(MessageType.OUTPUT_TRANSFORMER)}
                      />
                      <label className="ml-2">
                        Output Transformer
                      </label>
                    </div>
                )}

                {featureFlags.followUpCreate && (
                    <div className="ml-2 inline-flex items-center cursor-pointer text-neutral-900 dark:text-neutral-100">
                      <input
                          type="radio"
                          name="template"
                          id="followUpButtonCheck"
                          className="form-radio rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                          value={MessageType.FOLLOW_UP}
                          checked={selectedTemplate === MessageType.FOLLOW_UP}
                          onChange={() => setSelectedTemplate(MessageType.FOLLOW_UP)}
                      />
                      <label className="ml-2">
                        Follow-up Button
                      </label>
                    </div>
                )}

              {featureFlags.workflowCreate && (
              <div className="ml-2 inline-flex items-center cursor-pointer text-neutral-900 dark:text-neutral-100">
                <input
                    type="radio"
                    name="template"
                    id="automationTemplateCheck"
                    className="form-radio rounded-lg border border-neutral-500 shadow focus:outline-none dark:border-neutral-800 dark:bg-[#40414F] dark:ring-offset-neutral-300 dark:border-opacity-50"
                    value={MessageType.AUTOMATION}
                    checked={selectedTemplate === MessageType.AUTOMATION}
                    onChange={() => setSelectedTemplate(MessageType.AUTOMATION)}
                />
                <label className="ml-2">
                  Automation Template
                </label>
              </div>
              )}

            </div>



            </>
          }
        />
  );
};
