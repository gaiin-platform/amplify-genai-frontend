import HomeContext from "@/pages/api/home/home.context";
import { Conversation, Message, MessageType, newMessage } from "@/types/chat";
import { IconArrowBackUp, IconMessage, IconPencilBolt, IconSend, IconTextPlus } from "@tabler/icons-react";
import {setAssistant as setAssistantInMessage} from "@/utils/app/assistants";
import React, { useContext, useEffect, useRef } from "react";
import { useState } from "react";
import { HighlightPromptTypes, highlightSource } from "@/types/highlightTextPrompts";
import { getSession } from "next-auth/react";
import { OpenAIModelID, OpenAIModels } from "@/types/openai";
import { MetaHandler, sendChatRequestWithDocuments } from "@/services/chatService";
import { DEFAULT_ASSISTANT } from "@/types/assistant";
import { deepMerge } from "@/utils/app/state";
import cloneDeep from 'lodash/cloneDeep';
import { Artifact } from "@/types/artifacts";
import { lzwCompress, lzwUncompress } from "@/utils/app/lzwCompression";


interface CompositeButton {
  button: HTMLButtonElement;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  handleClick: () => void;
}


interface HighlightSource {
  container: HTMLElement,
  source: highlightSource;
  highlightedText: string,
  originalContent: string;
  leadingText: string;
  trailingText: string;
  messageIndex?: number;
  artifactId?: string;
}


interface Props {
    onSend: (message: Message) => void;
}

enum RangeType {
  PARAGRAPH = 'paragraph',
  CODE = 'code',
  INVALID = 'invalid'
}


const CHAR_LIMIT = 300; // used for sending certain context ranges for fast edit 

const FAST_EDIT_PROMPT = `
Your task is as follows:

1. You are ONLY required to provide a **replacement for the highlighted text** using the surrounding context provided.
2. You are FORBIDDEN from making any additional comments, explanations, introductions, or conclusions. 
   - This means you MUST NOT include any preamble, side remarks, or ending comments.
   - DO not put the response in quotes. 
3. Your response should consist of the **exact replacement** that will seamlessly fit IN PLACE of the highlighted text. 
   - DO NOT modify or touch the surrounding ***before text context*** or ***after text context*** the highlighted section.
   - You MUST use the guiding user query as your prompt for what your generated text should be.
4. You are NOT permitted to offer any thoughts, reasoning, or explanation about your response. 
   - If there is any ambiguity, your only concern is to replace the highlighted text while fitting the surrounding context as naturally as possible.
5. Any violation of these instructions (such as extra commentary or suggestions) will render the response unusable. 
   - Therefore, you must focus ONLY on the task of creating a seamless replacement and NOTHING ELSE.

Failure to follow these rules precisely will result in an invalid response.

Proceed with the task now by RESPONDING ONLY WITH your suggested replacement text that I will insert in place of the highlighted text.
Watch out for spaces! if the highlight text has leading or trailing spaces then ensure you include those!
`;

const COMPOSITE_PROMPT = `
Your task is as follows:

1. You are required to create a **new paragraph** based on the highlighted paragraphs and the provided user query.
2. The new paragraph must:
   - Seamlessly blend into the surrounding context, fitting naturally between the before and after text.
   - Reflect the intent of the highlighted paragraphs while addressing the user query.
3. You are FORBIDDEN from making any additional comments, explanations, introductions, or conclusions.
   - This means you MUST NOT include any preamble, side remarks, or ending comments.
   - DO NOT put the response in quotes or offer any commentary.
4. Your response should consist solely of the **new paragraph** that will replace the highlighted paragraphs.
   - You MUST NOT modify or touch the surrounding ***before text context*** or ***after text context***.
5. Any violation of these instructions (such as extra commentary or suggestions) will render the response unusable. 
   - Therefore, you must focus ONLY on the task of creating a seamless new paragraph based on the highlighted text and user query, and NOTHING ELSE.
   
Failure to follow these rules precisely will result in an invalid response.

Proceed with the task now by RESPONDING ONLY WITH the new paragraph to replace the highlighted text. Ensure the paragraph flows naturally with the surrounding context!

`;

const HIGHLIGHT_BACKGROUND = 'rgba(129, 192, 255, 0.4)';

export const PromptHighlightedText: React.FC<Props> = ({onSend}) => {
    const {state:{statsService, selectedConversation, selectedAssistant, selectedArtifacts, messageIsStreaming, artifactIsStreaming, 
                  chatEndpoint, currentRequestId, conversations, folders, groups, defaultModelId},  
           dispatch:homeDispatch, handleUpdateSelectedConversation} = useContext(HomeContext);
    
    const [showComponent, setShowComponent] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const [position, setPosition] = useState<any>(null);
    const positionRef = useRef(position);
    const [selected, setSelected] = useState<HighlightPromptTypes | string>('');
    const selectedRef = useRef<HighlightPromptTypes | string>(selected);
    
    const sourceRef = useRef<HighlightSource | null>(null);
    const showRevertRef = useRef<boolean>(false);

    const originalHighlightInfo = useRef<{source: HighlightSource, range: Range, rangeType: RangeType} | null>(null);

    // State to track clicked buttons' indices
    const clickedButtonIndicesRef = useRef<number[]>([]);
    // Ref to store buttons and their event handlers
    const compositeButtonsRef = useRef<CompositeButton[]>([]);
    const compositeHighlightsRef = useRef<Set<string>>(new Set());


  const clear = () => {
    console.log("clear");
    setSelected('');
    selectedRef.current = '';
    setInputValue('');
    triggerRerender();

    showRevertRef.current = false;
    compositeHighlightsRef.current = new Set();
    compositeButtonsRef.current = [];
    clickedButtonIndicesRef.current = [];

    originalHighlightInfo.current = null;
    sourceRef.current = null;
    setShowComponent(false);
  }

  const triggerRerender = () => {
    const source = sourceRef.current?.source || '';
    // trigger rerender 
    const event = new CustomEvent(source === 'artifact' ? 'triggerArtifactReRender' : 'triggerChatReRender' );
    window.dispatchEvent(event);
  }




  const movePulse = () => {
    console.log("Move pulse");
    if (sourceRef.current && sourceRef.current.container) {
      // Find all highlighted spans within the container
      const highlightedSpans = sourceRef.current.container.querySelectorAll('span.highlighted-text');
  
      // If no highlighted spans are found, there's nothing to do
      if (highlightedSpans.length === 0) {
        console.log("No highlighted spans found.");
        return;
      }
  
      // Identify the first highlighted span
      const firstHighlightedSpan = highlightedSpans[0];
  
      // Remove existing pulse indicator if it exists
      // let pulseSpan = sourceRef.current.container.querySelector('span.animate-pulse.cursor-default.mt-1');
      // if (!pulseSpan) {
        console.log("Create new pulse");
        // Create a new pulse indicator
          const pulseSpan = document.createElement('span');
          pulseSpan.classList.add('animate-pulse', 'cursor-default', 'mt-1', 'highlight-pulse');
          pulseSpan.textContent = '▍';
      // }
      try {
        if (selectedRef.current === HighlightPromptTypes.FAST_EDIT) {
          console.log("FAST_EDIT mode: Remove all highlighted spans and their content.");

          // Insert the pulse indicator at the position of the first highlighted span
          const parent = firstHighlightedSpan.parentNode;
          if (parent) {
            parent.insertBefore(pulseSpan, firstHighlightedSpan);
          }
          
          // Completely remove all highlighted spans along with their content
          highlightedSpans.forEach((span) => {
            span.remove(); // This removes the span and its contents
          });
        } else if (selectedRef.current === HighlightPromptTypes.COMPOSITE) {
          console.log("COMPOSITE mode: Move pulse to 'insert text here' button.");
    
          // Find the active "insert text here" button
          const activeButton = sourceRef.current.container.querySelector('button.text-green-400');
          if (activeButton) {
            // Insert the pulse span next to the active button
            const parent = activeButton.parentNode;
            if (parent) {
              parent.insertBefore(pulseSpan, activeButton.nextSibling);
            }
          }
        }
      } catch {
        console.log("Move pulse exception occured")
      }

    }
  };





  
  useEffect(() => {
    const handleSelectTransition = () => {
        if (selected === HighlightPromptTypes.COMPOSITE) {
          addCompositeButtons();
        } else {
          removeCompositeButtons();
          console.log("----",compositeHighlightsRef.current)
          if (compositeHighlightsRef.current.size > 1) {
              triggerRerender(); // will remove butttons

              const highlightData = originalHighlightInfo.current;
              console.log("reapplying original highlight: ", originalHighlightInfo.current);
              if (highlightData) {
                // call to rehighlight 
                compositeHighlightsRef.current = new Set();
                const selection = window.getSelection();
                if (selection) {
                  console.log("Range added");
                  selection.removeAllRanges(); // Clear existing selections
                  selection.addRange(highlightData.range); // Reapply the saved range
                }
                handleHighlightSelection(highlightData.rangeType, highlightData.range, highlightData.source);
                
              }
            
          } 
      }
    }
    if (selected) handleSelectTransition();
  }, [selected]);

  useEffect(() => {
    if (!messageIsStreaming && !artifactIsStreaming && sourceRef.current?.source !== 'artifact' &&showComponent) clear();
  }, [selectedConversation, selectedArtifacts]);


  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const handleScroll = () => {
      console.log(position)
      if (position) {
        console.log(window.scrollY)
        // Calculate the new top position based on the scroll position
        const newTop = position.top - window.scrollY;
  
        // Update the position state with the new top value
        setPosition({
          ...positionRef.current,
          top: newTop,
        });
      }
    };
  
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  

  useEffect(() => {
    const handleSelection = (e:MouseEvent) => {
      if (containerRef.current && containerRef.current.contains(e.target as Node)) return;
      
      const contentBlocksExist = document.querySelector('.chatContentBlock') || document.querySelector('.artifactContentBlock');

      const selection = window.getSelection();
      // console.log(selection);
      if ( contentBlocksExist &&  selection && selection.rangeCount > 0  && selection.toString().trim()) {
        console.log("handle selection");

        // Determine the source
        let containerElement = selection.anchorNode
          ? selection.anchorNode.parentElement
          : null;
        let foundContainer: HighlightSource | null = null;
        let inHighlightDisplayMode = false;
        while (containerElement) {
          if (containerElement.classList.contains('chatContentBlock')) {
            inHighlightDisplayMode = !!(containerElement.getAttribute('data-is-highlight-display'));
            const messageIndex =  parseInt(containerElement.getAttribute('data-message-index') || '', 10);
   
            foundContainer = {source: 'chat', originalContent: containerElement.getAttribute('data-original-content') || '',
                              messageIndex: messageIndex, container: containerElement, leadingText: '', trailingText: '',
                              highlightedText: ''};
            break;
          } else if (containerElement.classList.contains('artifactContentBlock')) {
            inHighlightDisplayMode = !!(containerElement.getAttribute('data-is-highlight-display'));
            const artifactIndex = parseInt(containerElement.getAttribute('data-version-index') || '', 10);
            foundContainer = {source: 'artifact', originalContent: containerElement.getAttribute('data-original-content') || '',
                              messageIndex: artifactIndex, container: containerElement, leadingText: '', trailingText: '',
                              artifactId: containerElement.getAttribute('data-artifact-id') || '', highlightedText: ''};
            break;
          }
          containerElement = containerElement.parentElement;
        }
        
        if (foundContainer) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const top = rect.bottom + window.scrollY;
            let left = rect.left + window.scrollX;
            const elementWidth = containerRef.current?.offsetWidth ?? 700;
            if (left + elementWidth > window.innerWidth) left = window.innerWidth - elementWidth - 15;
    
            setPosition({
              top: top,
              left: left,
            });


            // isContainerValid(foundContainer.container)
            // console.log(foundContainer);
            if (originalHighlightInfo.current && selectedRef.current !== HighlightPromptTypes.COMPOSITE) {
                console.log("********in here");
                const highlightData = originalHighlightInfo.current;
                handleHighlightSelection(highlightData.rangeType, highlightData.range, highlightData.source);
            } else {
                const rangeIsValid = inHighlightDisplayMode ? RangeType.PARAGRAPH : validateSelectionRange(foundContainer.container, range);
                if (rangeIsValid !== RangeType.INVALID) {
                    setShowComponent(true);
                    handleHighlightSelection(rangeIsValid, range, foundContainer);
                }  else {
                    console.log("invalid selection");
                }
            }
          } 
      } 
    };

    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);


  const handleHighlightSelection = (rangeType: RangeType, range: Range, foundSource: HighlightSource) => {
      const textNodes = getTextNodes(foundSource.container);
      const { beforeText, afterText } = getSurroundingSelectionText(range, textNodes);
      console.log("--- before add highlight list :", compositeHighlightsRef.current);
      if (!(compositeHighlightsRef.current instanceof Set)) compositeHighlightsRef.current = new Set();

      let highlight = range.toString();
      if (!highlight && originalHighlightInfo.current) highlight = originalHighlightInfo.current.source.highlightedText;
      console.log("---setting highlight:", highlight);

      compositeHighlightsRef.current.add(highlight);
      console.log("--- after add highlight list :", compositeHighlightsRef.current);
      const sourceData = {
            ...foundSource,
            leadingText: cloneDeep(beforeText),
            trailingText: cloneDeep(afterText),
            highlightedText: highlight
          };
      sourceRef.current = sourceData;

      if (rangeType === RangeType.PARAGRAPH) {
        console.log("paragraphs only");
        handleParagraphSelection(range);
      } else if (rangeType === RangeType.CODE) {
        console.log("code only");
        handleCodeBlockSelection(range);
      } 

      console.log("need to add to original info: ", originalHighlightInfo.current)
      if (!originalHighlightInfo.current) originalHighlightInfo.current = cloneDeep({source: sourceData, range: range, rangeType: rangeType});
  }


const isContainerValid = (container: HTMLElement) => {
  let children:Element[] = [];
  try {
    const div = Array.from(container.children);
    children = Array.from(div[0].children);
  } catch {
    console.log("Unable to extract html elements as expected");
    return false;
  }
  for (const child of children) {
    console.log("CONTAINER TAG: ", child.tagName);

    if (child.tagName === 'PRE') {
      // Ensure <code> exists within <pre>
      const codeChild = child.querySelector('code');
      if (!codeChild) {
        console.log("CONTAINER NOT VALID - <pre> without <code>");
        return false;
      }
    } else if (child.tagName !== 'P') {
      console.log("CONTAINER NOT VALID - invalid tag");
      return false;
    }
  }
  console.log("CONTAINER VALID");
  // If all elements are valid, return true
  return true;
};
  
const getElementsInRange = (range: Range): Element[] => {
  const elements: Set<Element> = new Set();
  const nodeIterator = document.createNodeIterator(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    }
  );
  let currentNode = nodeIterator.nextNode();
  while (currentNode) {
    if (currentNode !== nodeIterator.root && currentNode.nodeType === Node.ELEMENT_NODE &&
      !(currentNode as Element).classList.contains('composite-button') ) {
      elements.add(currentNode as Element);
    } 
    currentNode = nodeIterator.nextNode();
  }
  return Array.from(elements);
};

const validateSelectionRange = (container: HTMLElement, range: Range): RangeType => {
    
    // ensure only p or code elements are in the selection
    // if we are in composite then we already validated before and there are now buttons added so it would fail 
    if (selectedRef.current !== HighlightPromptTypes.COMPOSITE && 
        !isContainerValid(container)) return  RangeType.INVALID;

    // check if only Ps are in the selection
    if (getElementsInRange(range).every(el => el.tagName === 'P')) return RangeType.PARAGRAPH;

    // check if we are only within the same code block 
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
  
    const startElement = startContainer.nodeType === Node.TEXT_NODE
      ? startContainer.parentElement
      : startContainer as Element;
  
    const endElement = endContainer.nodeType === Node.TEXT_NODE
      ? endContainer.parentElement
      : endContainer as Element;
  
    const startClosestBlock = startElement?.closest('p, pre, code');
    const endClosestBlock = endElement?.closest('p, pre, code');
  
    // Check if both start and end are within the same element
    if (startClosestBlock && startClosestBlock === endClosestBlock) {
      if (startClosestBlock.matches('p')) {
        return RangeType.PARAGRAPH;
      } if (startClosestBlock.matches('pre code')) {
        return RangeType.CODE;
      } else if (startClosestBlock.matches('pre')) {
        // Ignore selections within pre but not in code
        return RangeType.INVALID;;
      }
    }

    if (selectedRef.current === HighlightPromptTypes.COMPOSITE && 
        originalHighlightInfo.current?.rangeType) return  originalHighlightInfo.current.rangeType;
    // orrr back to back p 

    console.log("end: ", range);
    console.log("start: ", range.startContainer);
    console.log("end: ", range.endContainer);
    console.log("ELEMS IN RANGE", getElementsInRange(range))

    return RangeType.INVALID;
}


  function getTextNodesInRange(range:Range) {
    const textNodes = [];
    const treeWalker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      (node) => {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    );
    let currentNode = treeWalker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = treeWalker.nextNode();
    }
    return textNodes;
  }
  
 // Helper function to wrap and insert highlight
const wrapAndInsertHighlight = (range: Range) => {
  const wrapper = document.createElement('span');
  wrapper.style.backgroundColor = HIGHLIGHT_BACKGROUND;
  wrapper.style.display = 'inline'; // Prevent line breaks
  wrapper.classList.add('highlighted-text');

  const frag = range.extractContents();
  wrapper.appendChild(frag);
  range.insertNode(wrapper);
};

// Main function for handling paragraph selection
const handleParagraphSelection = (range: Range) => {
  try {
    // Single-node selection
    if (range.startContainer === range.endContainer) {
      console.log("Single node selected");
      wrapAndInsertHighlight(range);
    } 
    // Multi-node selection
    else {
      // Get all text nodes within the selection range
      const textNodes = getTextNodesInRange(range);

      textNodes.forEach((textNode) => {
        const intersectionRange = document.createRange();

        // Calculate start and end offsets
        const startOffset = textNode === range.startContainer ? range.startOffset : 0;
        const endOffset = textNode === range.endContainer ? range.endOffset : (textNode as Text).length;

        intersectionRange.setStart(textNode, startOffset);
        intersectionRange.setEnd(textNode, endOffset);

        // Wrap and insert the highlight for this text node
        wrapAndInsertHighlight(intersectionRange);

        // Cleanup
        intersectionRange.detach();
      });

      // Clear the selection to avoid accidental changes
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    }
  } catch (e) {
    console.error('Highlighting failed:', e);
  }
};

  

  const handleCodeBlockSelection = (range: Range) => {
    // Call a custom highlight function for code blocks
    const selectedContents = range.cloneContents();
    const spanElements = selectedContents.querySelectorAll('span');

    spanElements.forEach((span) => {
      span.classList.add('highlighted-text');
      span.style.backgroundColor = HIGHLIGHT_BACKGROUND;
    });

    // Replace the selected content with the highlighted version
    range.deleteContents();
    range.insertNode(selectedContents);
  };
  

  

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        console.log("handle outside click : ");
        const inCompositeMode = compositeButtonsRef.current.length > 0;
        if (!inCompositeMode) clear();
      } 
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


    const toggleSwitch = (selection : HighlightPromptTypes ) => {
      setSelected(selection);
    };


    const getPlaceholder = () => {
      switch (selected) {
        case (HighlightPromptTypes.FAST_EDIT): 
          return "Fast edit highlighted section prompt...";
        case (HighlightPromptTypes.PROMPT):
          return "Send prompt against highlighted section...";
        case (HighlightPromptTypes.COMPOSITE):
          return "Prompt to generate composite text given highlighted sections prompt...";
        default:
          console.log("Invalid selected type");
      }
      return '';
    }


    function getTextNodes(node: Node) {
      let all: Node[] = [];
      let currentNode: Node | null = node.firstChild;
    
      while (currentNode) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
          all.push(currentNode);
        } else {
          all = all.concat(getTextNodes(currentNode));
        }
        currentNode = currentNode.nextSibling;
      }
    
      return all;
    }

  function getSurroundingSelectionText(range: Range, nodes: Node[]) {
    let startFound = false;
    let endFound = false;
  
    let beforeText = "";
    let afterText = "";

    // Keep track of whether we're inside a code block
    let isInCodeBlock = false;
    // Iterate over all text nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isCodeHeader = i+1 < nodes.length ? isNodeCodeHeader(nodes[i + 1]) : false;
      
      if (isCodeHeader) { // we dont allow highlighting of these codeHeaders so we can safely do it first
          const codeBlock = `\n\`\`\`${node.textContent}\n`;
          if (startFound) {
            afterText += codeBlock;
          } else {
            beforeText += codeBlock;
          }
          isInCodeBlock = true;
          //skip the copy Code node
          i += 1;
       } else {
          // check if we need to append the end of the previous code block 
          const nodeInCodeBlock = isNodeInCodeBlock(node);
          if (isInCodeBlock && !nodeInCodeBlock) {
            isInCodeBlock = false;
            // Add closing triple backticks
            const closeCodeBlock =  `\n\`\`\`\n`; 
            if (startFound) {
              afterText += closeCodeBlock;
            } else {
              beforeText += closeCodeBlock;
            }
          }
          if (node === range.startContainer) {
            beforeText += node.textContent?.slice(0, range.startOffset);
            startFound = true
          } else if (!startFound) {
            if (node.textContent === '\n' && !nodeInCodeBlock) node.textContent = '\n\n';
            
            beforeText += node.textContent;
          }

          if (node === range.endContainer) {
            endFound = true;
            afterText += node.textContent?.slice(range.endOffset);
          } else if (endFound) {
              if (node.textContent === '\n'&& !nodeInCodeBlock) node.textContent = '\n\n';
              afterText += node.textContent;
          }

      }
    };
    return { beforeText, afterText };
  }

  function isNodeInCodeBlock(node:Node) {
    
    let element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

    while (element && element !== document.body) { 
      if (element instanceof HTMLElement && element.tagName.toLowerCase() === 'code') {
        // Check if parent is <pre>, indicating a code block
        if (element.parentElement && element.parentElement.tagName.toLowerCase() === 'pre') {
          return true;
        }
      }
      element = element.parentElement;
    }
    return false;
  }


  function isNodeCodeHeader(node: Node): boolean {
    // Ensure the node is a text node
    if (node.nodeType !== Node.TEXT_NODE) {
      return false;
    }
  
    // Check if the text content is 'Copy code'
    const textContent = node.textContent?.trim();
    if (textContent !== 'Copy code') {
      return false;
    }
  
    // Check if the parent is a <button> element
    const parentElement = node.parentElement;
    if (!parentElement || parentElement.tagName.toLowerCase() !== 'button') {
      return false;
    }
  
    // Check if the parent button has specific classes
    if (!parentElement.classList.contains('text-xs') || !parentElement.classList.contains('text-white')) {
      return false;
    }
  
    // Check if the grandparent is a <div> with class 'flex items-center'
    const grandparentElement = parentElement.parentElement;
    if (
      !grandparentElement ||
      grandparentElement.tagName.toLowerCase() !== 'div' ||
      !grandparentElement.classList.contains('flex') ||
      !grandparentElement.classList.contains('items-center')
    ) {
      return false;
    }
  
    // Optionally, you can check if the previous sibling is an <svg> element
    const previousSibling = node.previousSibling;
    if (!previousSibling || previousSibling.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
  
    const svgElement = previousSibling as Element;
    if (svgElement.tagName.toLowerCase() !== 'svg') {
      return false;
    }
  
    // If all checks pass, it's a code header
    return true;
  }
  
  

  const shouldAbort = ()=>{
    // return stopConversationRef.current === true;
    return false;
  }

  const promptForData = async (prompt: string, message:Message, leadingText: string, trailingText: string) => {
    const source = sourceRef.current;
    const isArtifactSource = source?.source === 'artifact';
    const controller = new AbortController();

    let currentState = {};
        const metaHandler: MetaHandler = {
            status: (meta: any) => {
                //console.log("Chat-Status: ", meta);
                // homeDispatch({type: "append", field: "status", value: newStatus(meta)})
            },
            mode: (modeName: string) => {
                //console.log("Chat-Mode: "+modeName);
            },
            state: (state: any) => {
                currentState = deepMerge(currentState, state);
            },
            shouldAbort: () => {
                if (shouldAbort()) {
                    controller.abort();
                    return true;
                }
                return false;
            }
        };
    
    const accessToken = await getSession().then((session) => { 
                                // @ts-ignore
                                return session.accessToken
                            })
    homeDispatch({field: 'messageIsStreaming', value: true}); 
    if (isArtifactSource) homeDispatch({field: 'artifactIsStreaming', value: true});
    try {
        const chatBody = {
            model: selectedConversation ? selectedConversation.model : OpenAIModels[defaultModelId ?? OpenAIModelID.GPT_4o_MINI],
            messages: [message],
            key: accessToken,
            prompt: prompt,
            temperature: 0.5,
            maxTokens: 4000,
            skipRag: true,
            skipCodeInterpreter: true
        };

        statsService.sendChatEvent(chatBody);

        const response = await sendChatRequestWithDocuments(chatEndpoint || '', accessToken, chatBody, controller.signal);
        
        let updatedConversation = cloneDeep(selectedConversation);

        let updatedArtifacts: Artifact[] | undefined = cloneDeep(selectedArtifacts);
        console.log("+ ", updatedArtifacts)
        const responseData = response.body;
        const reader = responseData ? responseData.getReader() : null;
        const decoder = new TextDecoder();
        let done = false;
        let text = '';
        movePulse();
        try {
            while (!done) {
        
                // @ts-ignore
                const {value, done: doneReading} = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value);
        
                if (done) break;
        
                text += chunkValue;
                if (updatedConversation && source?.source === 'chat') {
                  let updatedMessages: Message[] = [];
                  updatedMessages = updatedConversation.messages.map((message, index) => {
                          if (index === source?.messageIndex) {
                              return { ...message,
                                      content: `${leadingText}${text}${trailingText}`,
                                      data: {...(message.data || {}), state: currentState}
                                  };
                          }
                          return message;
                      });

                  updatedConversation = {
                      ...updatedConversation,
                      messages: updatedMessages,
                  };
                  homeDispatch({
                      field: 'selectedConversation',
                      value: updatedConversation,
                  }); 
              
              } else if (isArtifactSource && updatedArtifacts) {
                console.log("++ ", source?.messageIndex)
                console.log("++ ", (source?.messageIndex) ?? 100  < updatedArtifacts.length )

                if (source?.messageIndex && source.messageIndex < updatedArtifacts.length) {
                  console.log("+++ ", updatedArtifacts);
                  updatedArtifacts[source.messageIndex].contents = lzwCompress(`${leadingText}${text}${trailingText}`);
                  homeDispatch({field: "selectedArtifacts", value: updatedArtifacts});
                }
              }
       
          }
          console.log("FINAL REPLACEMNET: ", text);

          if (updatedConversation) {
            if (isArtifactSource && source?.artifactId && updatedArtifacts) updatedConversation.artifacts = 
                                                                            { ...updatedConversation.artifacts, 
                                                                                [source.artifactId]: updatedArtifacts
                                                                            }
            handleUpdateSelectedConversation(updatedConversation);
          }
          triggerRerender();
          // setShowRevert(true);
          showRevertRef.current = true;
          

        } finally {
            if (reader) {
                await reader.cancel(); 
                reader.releaseLock();
            }
        }

    } catch (e) {
        console.error("Error prompting for qi summary: ", e);
        alert("We are unable to fulfill your request at this time, please try again later.");
    } 
    homeDispatch({field: 'messageIsStreaming', value: false}); 
    if (isArtifactSource) homeDispatch({field: 'artifactIsStreaming', value: false});
    
  }



  const revertChanges = () => {
    console.log("handle revert");
    const source = sourceRef.current;
    if (selectedConversation && source && source.messageIndex) {
      const updatedConversation = cloneDeep(selectedConversation);
      if ( source.source === 'chat' ) {
          updatedConversation.messages[source.messageIndex].content = source.originalContent;
        
      } else if ( source.source === 'artifact' && selectedArtifacts && source.artifactId) {
            const updatedArtifacts = cloneDeep(selectedArtifacts);
            updatedArtifacts[source.messageIndex].contents = lzwCompress(source.originalContent);
            homeDispatch({field: "selectedArtifacts", value: updatedArtifacts});
          
            updatedConversation.artifacts = { ...updatedConversation.artifacts, 
                                                [source.artifactId]: updatedArtifacts
                                            }
      }
      if (updatedConversation) handleUpdateSelectedConversation(updatedConversation);
      showRevertRef.current = false;
      setShowComponent(false);
    }
    
  }

  const addCompositeButtons = () => {
    if (!sourceRef.current || !sourceRef.current.container) {
      console.log('No sourceRef or container');
      return;
    }
  
    const container = sourceRef.current.container;
    const paragraphs = container.querySelectorAll('p');
  
    paragraphs.forEach((pElement, index) => {
      // Create the button
      const button = document.createElement('button');
      button.textContent = '>';
      button.classList.add('composite-button');
      
      // Apply the styles as per the provided design
      button.className = `relative bg-transparent text-[16px] flex items-center px-2 rounded text-gray-500 mr-2`;
      button.style.transition = 'background-color 0.3s';
  
      // Define event handlers for hover and click states
      const handleMouseEnter = () => {
        if (!clickedButtonIndicesRef.current.includes(index)) {
          button.classList.add('hover:text-green-700');
        }
      };
  
      const handleMouseLeave = () => {
        if (!clickedButtonIndicesRef.current.includes(index)) {
          button.classList.remove('hover:text-green-700');
        }
      };
  
      const handleClick = () => {
        if (clickedButtonIndicesRef.current.includes(index)) {
          // Unmark as clicked, reset to default state
          clickedButtonIndicesRef.current = clickedButtonIndicesRef.current.filter((i) => i !== index);
          button.classList.remove('text-green-400');
          button.classList.add('text-gray-500');
          button.textContent = '>';
          button.style.color = 'gray';  // Reset text color
        } else {
          // Mark as clicked, apply active styles
          clickedButtonIndicesRef.current = [...clickedButtonIndicesRef.current, index];
          button.classList.remove('text-gray-400');
          button.classList.add('text-green-400');
          button.textContent = '> insert text here';
          // button.style.color = 'black';  // Change text color to black when active
        }
      };
  
      // Attach event listeners
      button.addEventListener('mouseenter', handleMouseEnter);
      button.addEventListener('mouseleave', handleMouseLeave);
      button.addEventListener('click', handleClick);
  
      // Store for cleanup
      compositeButtonsRef.current.push({
        button,
        handleMouseEnter,
        handleMouseLeave,
        handleClick,
      });
  
      // Insert the button before the paragraph
      pElement.parentNode?.insertBefore(button, pElement);
    });
  };
  
  

  const removeCompositeButtons = () => {
    compositeButtonsRef.current.forEach(({ button, handleMouseEnter, handleMouseLeave, handleClick }) => {
      // Remove event listeners
      button.removeEventListener('mouseenter', handleMouseEnter);
      button.removeEventListener('mouseleave', handleMouseLeave);
      button.removeEventListener('click', handleClick);
  
      // Remove the button from the DOM
      button.parentNode?.removeChild(button);
    });
  
    // Clear references
    compositeButtonsRef.current = [];
    clickedButtonIndicesRef.current = [];
  };
  


  const handleSend = () => {
    if (!inputValue) return;
    console.log("handle send");

    console.log(selected);
    // in case we add more 
    switch (selected) {
      case (HighlightPromptTypes.FAST_EDIT): 
        handleFastEdit();
        break;
      case (HighlightPromptTypes.PROMPT):
        handlePrompt();
        break;
      case (HighlightPromptTypes.COMPOSITE):
        handleComposite();
        break;
      default:
        console.log("Invalid selected type");
    }
  }

  const handleFastEdit = () => {
    if (sourceRef.current) {
        const beforeText = sourceRef.current.leadingText;
        const afterText = sourceRef.current.trailingText;
        console.log("*******\n",  beforeText);
        console.log("*******\n",  afterText);
        console.log("*******\n");
        const content =  ` 
         User Query For Fast Edit Changes: ${inputValue}\n\n
         *** before text context TO BE LEFT UNCHANGED ***\n"${beforeText.length > CHAR_LIMIT ? beforeText.slice(beforeText.length - CHAR_LIMIT) : beforeText}"\n\n

         **[Highlighted Text you will provide a SEAMLESS replacement text for]**\n${sourceRef.current.highlightedText}\n\n

        *** after text context TO BE LEFT UNCHANGED ***\n"${afterText.slice(0, CHAR_LIMIT)}"
        `;

        let msg:Message = newMessage({role: 'user', content : content, type: MessageType.PROMPT});
        msg = setAssistantInMessage(msg, selectedAssistant || DEFAULT_ASSISTANT);
        promptForData(FAST_EDIT_PROMPT, msg, beforeText, afterText);
  }}


  const handlePrompt = () => {
    let content = `${inputValue}\n\nRelevant Context: "${sourceRef.current?.highlightedText}"`

    if (sourceRef.current?.source === 'artifact') content += `\n\nConsider Artifact Id: \n ${sourceRef.current.artifactId}`;
    
    let msg:Message = newMessage({role: 'user', content : content, type: MessageType.PROMPT});
    msg = setAssistantInMessage(msg, selectedAssistant || DEFAULT_ASSISTANT);
    // if artifact is selected then we may want to get the artifact prompt added so it can possibly do an autoartifact block

    onSend(msg);
    clear();
  }


  const handleComposite = () => {
    if (!sourceRef.current) {
      console.log('No sourceRef');
      return;
    }
  
    const originalContent = sourceRef.current.originalContent;
    const lines = originalContent.split('\n');
  
    const clickedIndices = clickedButtonIndicesRef.current;
  
    clickedIndices.forEach((index) => {
      const beforeText = lines.slice(0, index + 2).join('\n');
      const afterText = lines.slice(index + 2).join('\n');
  
      console.log(`Button at index ${index}`);
      console.log('Before text:', beforeText);
      console.log('After text:', afterText);

      console.log(compositeHighlightsRef.current)

      const content = `
      User Query For Composite Edit: ${inputValue}

      *** before text context TO BE LEFT UNCHANGED ***\n"${
        beforeText.length > CHAR_LIMIT ? beforeText.slice(beforeText.length - CHAR_LIMIT) : beforeText
      }"\n\n

      **[Highlighted Paragraphs you will use to create a new paragraph]**\n${
        compositeHighlightsRef.current // Assuming highlightedText is an array of highlighted paragraphs.
      }\n\n

      *** after text context TO BE LEFT UNCHANGED ***\n"${
        afterText.slice(0, CHAR_LIMIT)
      }"

      `;

      let msg:Message = newMessage({role: 'user', content : content, type: MessageType.PROMPT});
      msg = setAssistantInMessage(msg, selectedAssistant || DEFAULT_ASSISTANT);
      promptForData(COMPOSITE_PROMPT, msg, beforeText, afterText);
    });
  };
  
  


    if (!showComponent) return <></>;
    return (
       (!messageIsStreaming && !artifactIsStreaming ? 
        <div ref={containerRef} className="absolute z-50" style={{  top: position.top, left: position.left}}
          onClick={(e) => e.preventDefault()} >

             <div className="flex flex-row items-center rounded border border-neutral-800 dark:border-neutral-500 bg-neutral-100 dark:bg-[#282834] z-30"
                style={{ boxShadow: '0 8px 12px rgba(0, 0, 0, 0.3)',  borderRadius: `${selected && !showRevertRef.current ? '9999px' : "20px"} 20px 20px ${selected && !showRevertRef.current ? '9999px' : "20px"}` }} >

              
                 { showRevertRef.current ?  
                      <button
                      className={`flex flex-row gap-2 p-2 text-[14px] text-black dark:text-white rounded-full transition-all duration-300 focus:outline-none whitespace-nowrap 
                                  bg-neutral-200 dark:bg-transparent hover:bg-white dark:hover:opacity-60`}
                      onClick={(e) => {
                          e.stopPropagation();
                          revertChanges();
                      }}
                      title={"Revert Changes"}
                    >
                      <IconArrowBackUp size={16}/>
                      <div className="mr-1">Revert Changes</div>
                    </button>
                  : (
                   <> 
                   <div 
                    className="flex items-center rounded-full border border-neutral-600 bg-neutral-200 dark:bg-[#39394a] p-1"
                    style={{ boxShadow: '0 8px 10px rgba(0, 0, 0, 0.3)' }}
                  >
                    <ToggleButton 
                    selected={selected}
                    name={HighlightPromptTypes.PROMPT}
                    toggleSwitch={toggleSwitch}
                    title="Prompt will be added to the conversation thread"
                    icon={<IconMessage size={14} />}
                    />

                    <ToggleButton 
                    selected={selected}
                    name={HighlightPromptTypes.FAST_EDIT}
                    toggleSwitch={toggleSwitch}
                    title="Amplify response will automatically replace the highlighted text"
                    icon={<IconPencilBolt size={14} />}
                    />

                    {/* <ToggleButton 
                    selected={selected}
                    name={HighlightPromptTypes.COMPOSITE}
                    toggleSwitch={toggleSwitch}
                    title={`Allows for multiple text to be highlighted and requires a marker for text insertion.\nAll highlighted text will be used by Amplify to create and embed text at your selected marker`}
                    icon={<IconTextPlus size={14} />}
                    /> */}
                    
                  </div>

                  {selected &&
                   <>
                    <input
                      ref={inputRef}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      type="text"
                      value={inputValue}
                      title={`${selected} Mode`}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-[345px] flex-grow p-2 bg-transparent text-black dark:text-neutral-100 focus:outline-none"
                      placeholder={getPlaceholder()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSend(); }}
                      disabled={!inputValue || (selectedRef.current === HighlightPromptTypes.COMPOSITE && !sourceRef.current?.container.querySelector('button.text-green-400'))}
                      className={`p-2 text-neutral-400 dark:text-neutral-500 ${inputValue ? "hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer": "cursor-not-allowed"} focus:outline-none`}
                      title={inputValue ? "Send" : "Enter a message to send"}
                    >
                      <IconSend size={20} />
                    </button>
                  </>} </>
                  )
                }

            </div>
        </div> 
      : <></>)
    )
};
  

interface ToggleProps {
  selected: string;
  name: string;
  title: string;
  icon: JSX.Element;
  toggleSwitch: (selection:HighlightPromptTypes) => void;
}



const ToggleButton: React.FC<ToggleProps> = ({selected, name, title, icon, toggleSwitch }) => {
    return <button onMouseDown={(e) =>  e.preventDefault()}
        className={`flex flex-row gap-2 py-1 px-2 text-[12px] rounded-full transition-all duration-300 focus:outline-none whitespace-nowrap ${
          selected === name
            ? 'bg-white dark:bg-[#1f1f29] text-neutral-900 dark:text-neutral-100 font-bold transform scale-105'
            : 'bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#31313f]'
        }`}
        onClick={(e) => {  
          e.preventDefault();
          e.stopPropagation();
          if (selected !== name) toggleSwitch(name as HighlightPromptTypes)}}
        title={title}
      >
        <div className="mt-0.5">{icon}</div>
        <label className="mr-0.5">{name}</label>
    </button>

}


