import HomeContext from "@/pages/api/home/home.context";
import { Conversation, Message, MessageType, newMessage } from "@/types/chat";
import { IconArrowBackUp, IconMessage, IconPencilBolt, IconSend, IconTextPlus } from "@tabler/icons-react";
import {setAssistant as setAssistantInMessage} from "@/utils/app/assistants";
import React, { useContext, useEffect, useRef } from "react";
import { useState } from "react";
import { HighlightPromptTypes, highlightSource } from "@/types/highlightTextPrompts";
import { getSession } from "next-auth/react";
import { MetaHandler, sendChatRequestWithDocuments } from "@/services/chatService";
import { DEFAULT_ASSISTANT } from "@/types/assistant";
import { deepMerge } from "@/utils/app/state";
import cloneDeep from 'lodash/cloneDeep';
import { Artifact } from "@/types/artifacts";
import { lzwCompress } from "@/utils/app/lzwCompression";
import toast from "react-hot-toast";
import { DefaultModels } from "@/types/model";


interface CompositeButton {
  button: HTMLButtonElement;
  pElement: HTMLParagraphElement | null,
  pIndex: number,
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  handleClick: () => void;
  handleMouseDown: (e: MouseEvent) => void;
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

const ALLOWED_TAGS = ['P', 'OL', 'LI', 'UL', "STRONG", "EM", "A"]; // add link

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
                  chatEndpoint, defaultAccount},  
           dispatch:homeDispatch, handleUpdateSelectedConversation, getDefaultModel} = useContext(HomeContext);
    
    const [showComponent, setShowComponent] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const [position, setPosition] = useState<any>(null);
    const positionRef = useRef(position);

    const [selected, setSelected] = useState<HighlightPromptTypes | string>('');
    const selectedRef = useRef<HighlightPromptTypes | string>(selected);
    const handleInitSelection = useRef<(() => void) | null>(null);

    
    const sourceRef = useRef<HighlightSource | null>(null);
    const showRevertRef = useRef<boolean>(false);

    const isDraggingRef = useRef(false);

    // const originalHighlightInfo = useRef<{source: HighlightSource, range: Range, rangeType: RangeType} | null>(null);

    // Ref to store buttons and their event handlers
    const compositeButtonsRef = useRef<CompositeButton[]>([]);
    const compositeInsertPs = useRef<{ p : HTMLParagraphElement, contentIndex: number }[]>([]);
    const compositeHighlightsRef = useRef<Set<string>>(new Set());
    const activeButtonRef = useRef<HTMLButtonElement | null>(null);
    
                                                                 // the order gets scrambled some how so had to add a isfirst flag
    const highlightSpansRef = useRef<{ wrapper: HTMLSpanElement, isFirst: boolean }[]>([]);


  const clear = (rerender: boolean = true) => {
    // console.log("clear");
    removeCompositeButtons();
    setSelected('');
    selectedRef.current = '';
    handleInitSelection.current = null;
    setInputValue('');
    if (rerender) triggerRerender();

    showRevertRef.current = false;
    compositeInsertPs.current = [];
    compositeHighlightsRef.current = new Set();
    compositeButtonsRef.current = [];
    highlightSpansRef.current = [];
    activeButtonRef.current = null;

    // originalHighlightInfo.current = null;
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
    // console.log("Move pulse");
    if (sourceRef.current && sourceRef.current.container) {

        if (highlightSpansRef.current && highlightSpansRef.current.length === 0) {
          console.log("No highlighted spans found.");
          removeCompositeButtons(); // clean up 
          return;
        }
  
      // console.log("Create new pulse");
      // Create a new pulse indicator
      const pulseSpan = document.createElement('span');
      pulseSpan.classList.add('animate-pulse', 'cursor-default', 'mt-1', 'highlight-pulse');
      pulseSpan.textContent = '▍';

      try {
        if (selectedRef.current === HighlightPromptTypes.FAST_EDIT) {
          console.log("FAST_EDIT mode: Remove all highlighted spans and their content.");
          
          // Now the earliest DOM node is at index 0
          const earliestSpan = highlightSpansRef.current[0];
          if (earliestSpan) {
            const parent = earliestSpan.wrapper.parentNode;
            if (parent) {
              parent.insertBefore(pulseSpan, earliestSpan.wrapper);
            }
          }
          highlightSpansRef.current.forEach((span:any) => span.wrapper.remove());


        } else if (selectedRef.current === HighlightPromptTypes.COMPOSITE) {
          console.log("COMPOSITE mode: Move pulse to 'insert text here' button.");
          // const activeButton = activeButtonRef.current;
          // const parent = activeButton?.parentNode;
          // if (parent) {
          //   // Find the paragraph associated with the active button
          //   const buttonData = compositeButtonsRef.current.find(
          //     (item) => item.button === activeButton
          //   );

          //   if (buttonData && buttonData.pElement) {
          //     // Insert the pulse before the paragraph element
          //     parent.insertBefore(pulseSpan, buttonData.pElement);
          //   } else {
          //     // If the button is the end button, append the pulse to the parent
          //     parent.appendChild(pulseSpan);
          //   }
          // }

          const activeButton = activeButtonRef.current;
        const container = sourceRef.current.container;

        if (container && activeButton) {
          // Find the button data
          const buttonData = compositeButtonsRef.current.find(
            (item: any) => item.button === activeButton
          );

          if (buttonData) {
            const { pElement, pIndex } = buttonData;

            if (pElement && pElement.parentNode === container) {
              // Insert the pulseSpan before the associated pElement
              container.insertBefore(pulseSpan, pElement);
            } else {
              // For start or end buttons where pElement is null
              if (pIndex === 0) {
                // Start button: insert at the beginning of the container
                container.insertBefore(pulseSpan, container.firstChild);
              } else {
                // End button: insert at the end of the container
                container.appendChild(pulseSpan);
              }
            }
          } else {
            console.log("Active button data not found.");
          }
        } else {
          console.log("Container or active button not found.");
        }


          // // After inserting the pulseSpan, remove the composite buttons
          removeCompositeButtons();
          // console.log("COMPOSITE mode COMPLETE.");
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
            if (highlightSpansRef.current && highlightSpansRef.current.find((span: { isFirst: boolean }) => !span.isFirst)) {
              console.log("Filter out composite highlights")
              // loop through spans and remove the highlight after the first index 
              highlightSpansRef.current.forEach((span:{wrapper: HTMLSpanElement, isFirst:boolean}) => {
                    if (!span.isFirst) {
                      const wrapper = span.wrapper;
                      const parent = wrapper.parentNode;
                  
                      while (wrapper.firstChild) { // Move all child nodes of the span before the span
                        parent?.insertBefore(wrapper.firstChild, wrapper);
                      }
                      parent?.removeChild(wrapper); // Remove the now-empty span
                  } 

              });
              highlightSpansRef.current = highlightSpansRef.current.filter((span: { isFirst: boolean }) => span.isFirst);
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
      // console.log(position)
      if (position) {
        // console.log(window.scrollY)
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
        // console.log("handle selection");

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

            if (sourceRef.current && selectedRef.current === HighlightPromptTypes.COMPOSITE) {
                // const highlightData = originalHighlightInfo.current;
                // handleHighlightSelection(highlightData.rangeType, highlightData.range, highlightData.source);
                const rangeIsValid = inHighlightDisplayMode ? RangeType.PARAGRAPH : validateSelectionRange(foundContainer.container, range);
                if (rangeIsValid !== RangeType.INVALID) {
                  handleHighlightSelection(rangeIsValid , range, sourceRef.current );
                } else {
                  toast("Invalid Selection");
                }
            } else { // first highlight will always go here 
                const rangeIsValid = inHighlightDisplayMode ? RangeType.PARAGRAPH : validateSelectionRange(foundContainer.container, range);
                if (rangeIsValid !== RangeType.INVALID) {
                    setShowComponent(true);
                  
                    handleInitSelection.current = () => handleHighlightSelection(rangeIsValid, range, cloneDeep(foundContainer!));
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

      if (! sourceRef.current) {
        const textNodes = getTextNodes(foundSource.container);

        // console.log("TEXTNODES:", textNodes);
        // getCompositeButtonIndices(textNodes, foundSource.originalContent, foundSource.container);
        const { beforeText, highlightedText, afterText} = getSurroundingSelectionText(range, textNodes, foundSource.originalContent);
        // console.log("BEFORE:\n", beforeText);
        // console.log("\nHIGHLIGHT:\n ", highlightedText);
        // console.log("\nAFTER:\n", afterText);

        // console.log(" p elems: ", compositeInsertPs.current)
  
        // console.log("--- before add highlight list :", compositeHighlightsRef.current);
        if (!(compositeHighlightsRef.current instanceof Set)) compositeHighlightsRef.current = new Set();
  
        let highlight = highlightedText;
        // if (!highlight && originalHighlightInfo.current) highlight = originalHighlightInfo.current.source.highlightedText;
        // console.log("---setting highlight:", highlight);
  
        // console.log("--- after add highlight list :", compositeHighlightsRef.current);
        const sourceData = {
              ...foundSource,
              leadingText: cloneDeep(beforeText),
              trailingText: cloneDeep(afterText),
              highlightedText: highlight
            };
        sourceRef.current = sourceData;

      }
      compositeHighlightsRef.current.add(range.toString());
      if (rangeType === RangeType.PARAGRAPH) {
        console.log("paragraphs only");
        handleParagraphSelection(range);
      } else if (rangeType === RangeType.CODE) {
        console.log("code only");
        handleCodeBlockSelection(range);
      } 

    
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
    // console.log("CONTAINER TAG: ", child.tagName);

    if (child.tagName === 'PRE') {
      // Ensure <code> exists within <pre>
      const codeChild = child.querySelector('code');
      if (!codeChild) {
        console.log("CONTAINER NOT VALID - <pre> without <code>");
        return false;
      }
    } else if (!ALLOWED_TAGS.includes(child.tagName) && !child.tagName.startsWith("H")) {
      console.log("CONTAINER NOT VALID - invalid tag:", child.tagName);
      return false;
    }
  }
  // console.log("CONTAINER VALID");
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

        // console.log("**** ", getElementsInRange(range));
    // check if only Ps are in the selection
    if (getElementsInRange(range).every(el => 
            ([...ALLOWED_TAGS, 'CODE'].includes(el.tagName) || 
            el.tagName.startsWith("H") ))) return RangeType.PARAGRAPH;

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
      // console.log(startClosestBlock);
      if (startClosestBlock.matches('p')) {
        return RangeType.PARAGRAPH;
      } if (startClosestBlock.matches('pre code')) {
        return RangeType.CODE;
      } else if (startClosestBlock.matches('pre')) {
        // Ignore selections within pre but not in code
        return RangeType.INVALID;;
      }
    }

    // console.log("end: ", range);
    // console.log("start: ", range.startContainer);
    // console.log("end: ", range.endContainer);
    // console.log("ELEMS IN RANGE", getElementsInRange(range))

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
const wrapAndInsertHighlight = (range: Range, isFirst: boolean) => {
  const wrapper = document.createElement('span');
  wrapper.style.backgroundColor = HIGHLIGHT_BACKGROUND; 
  wrapper.style.display = 'inline'; // Prevent line breaks
  wrapper.classList.add('highlighted-text');

  const frag = range.extractContents();
  wrapper.appendChild(frag);
  range.insertNode(wrapper);
  highlightSpansRef.current.push({wrapper: wrapper, isFirst: isFirst});
};

// Main function for handling paragraph selection
const handleParagraphSelection = (range: Range) => {
  try {
    // Single-node selection
    if (range.startContainer === range.endContainer) {
      console.log("Single node selected");
      wrapAndInsertHighlight(range, highlightSpansRef.current.length === 0);
    } 
    // Multi-node selection
    else {
      console.log("Multiple node selected");
      // Get all text nodes within the selection range
      const textNodes = getTextNodesInRange(range);
      // This is to track the composite highlights. isFirst is the first highlight
      const isFirst = highlightSpansRef.current.length === 0;
      textNodes.forEach((textNode) => {
        const intersectionRange = document.createRange();

        // Calculate start and end offsets
        const startOffset = textNode === range.startContainer ? range.startOffset : 0;
        const endOffset = textNode === range.endContainer ? range.endOffset : (textNode as Text).length;

        intersectionRange.setStart(textNode, startOffset);
        intersectionRange.setEnd(textNode, endOffset);

        // Wrap and insert the highlight for this text node
        wrapAndInsertHighlight(intersectionRange, isFirst);

        // Cleanup
        intersectionRange.detach();
      });
      console.log("SPANS: ", highlightSpansRef.current)
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
    const isFirst = highlightSpansRef.current.length === 0;
    spanElements.forEach((span) => {
      span.classList.add('highlighted-text');
      span.style.backgroundColor = HIGHLIGHT_BACKGROUND;
      highlightSpansRef.current.push({wrapper :span, isFirst: isFirst});
    });

    // Replace the selected content with the highlighted version
    range.deleteContents();
    range.insertNode(selectedContents);
  };
  

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!containerRef.current || !containerRef.current.contains(e.target as Node))  isDraggingRef.current = true;
    };
  
    const handleMouseUp = (e: MouseEvent) => isDraggingRef.current = false;
  
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
  
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 0 => left-click, 2 => right-click
    if (e.button === 2) {
      clear(false);
      return;
    }

      // if right click then clear right away
      if (containerRef.current && !containerRef.current.contains(target) ) {

        if (selectedRef.current === HighlightPromptTypes.COMPOSITE ) { 
            setTimeout(() => { // wait for isDragging to update to see if we need to clear or not
              if (!isDraggingRef.current) clear();
            }, 150);
        } else {
            clear();
        }
      } 
    };
  
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


    const toggleSwitch = (selection : HighlightPromptTypes ) => {
      if (selectedRef?.current === '' && handleInitSelection.current) {
        handleInitSelection.current();
        handleInitSelection.current = null;
      }
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

   
    // edge cases 
  const considerTag = (node: Node, originalChar: string) => {
    const text = cloneDeep(node.textContent) || '';
    if (text !== '\n') return text;
    
    const parentTag = node.parentElement?.tagName;
    // console.log(
    //   "PARENT TAG:", parentTag
    // )
    // console.log(
    //   "text:", text
    // )
    // console.log(
    //   "orig char:", originalChar
    // )
    if (originalChar === '\n') return '\n';
  
    switch (parentTag) {
      case ('OL'):
        return /^\d$/.test(originalChar) ? '.' : '';
      case ('LI'):
        return ' ';
      case ('UL'):
        return ' ';
      case ('DIV'):
          return '';
      default:
        return text;
    }

  }

  function getCompositeButtonIndices(nodes: Node[], originalContent: string, container: HTMLElement) {
    const sections =  cloneDeep(originalContent).split('\n\n');
    console.log("SECTIONS: ", sections);
    console.log("COUNT: ", sections.length);

    let contentAndIndices:{content: string, index: number}[] = [];
    let index = originalContent.indexOf('\n\n');  // Find the first occurrence of '\n\n'
    let prev = 0;
    while (index !== -1) {
       const keepOne = index + 1;
        contentAndIndices.push({content: originalContent.slice(prev, keepOne), index: keepOne}); // Store the index of the double newline
        prev = keepOne;
        index = originalContent.indexOf('\n\n', index + 2);  // Continue searching from the next character after '\n\n'
    }
    console.log("---", contentAndIndices);
    console.log("----", )
    container.querySelectorAll('p').forEach(p => console.log("#", p.textContent))


    // if (node.textContent === '\n' && ['DIV'].includes(node.parentElement?.tagName || '') && !isNodeInCodeBlock(node)) {
    //   // console.log("PARENT ", node.parentElement);
    // console.log("_____DIV_____" , originalContent.slice(originalCurrentIndex, originalCurrentIndex + 20));
    // let updatedIdx = originalCurrentIndex;
    // if (isInCodeBlock) {
    //   updatedIdx += 3; // for the back ticks
    //   isInCodeBlock = false;
    // }
    // compositeInsertPs.current.push({ p : node.parentElement as HTMLParagraphElement, contentIndex: updatedIdx});
    // console.log("+++", compositeInsertPs.current.length);
}


  function getSurroundingSelectionText(range: Range, nodes: Node[], originalContent: string) {
    let isInHighlight = false; 
    let startFound = false;
    let endFound = false;
  
    let beforeText = "";
    let afterText = "";
    let highlightedText = '';

    // going for a 2 pointer method 
    let originalCurrentIndex: number = 0;
    let isInCodeBlock = false;

    // Iterate over all text nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isCodeHeader = i+1 < nodes.length ? isNodeCodeHeader(nodes[i + 1]) : false;
      // console.log("is code header??? ", isCodeHeader)
      if (isCodeHeader) { // we dont allow highlighting of these codeHeaders so we can safely do it first
          const languageName = node.textContent || '';
          const codeBlockStart = `\`\`\`${languageName}`;

          const contentSlice = originalContent.slice(originalCurrentIndex);
                                    // to account for back to back code blocks
          const codeBlockEndIndex = contentSlice.indexOf(codeBlockStart) + codeBlockStart.length;
  
          // Append the exact code block start marker to the current text
          appendToCurrentText(contentSlice.slice(0, codeBlockEndIndex));
  
          originalCurrentIndex += codeBlockEndIndex;
          i += 1;
          isInCodeBlock = true;
       } else {
        // if (!node.textContent?.trim() && node.parentElement?.tagName === 'DIV' && !isNodeInCodeBlock(node))  console.log("_____DIV_____" , originalContent.slice(originalCurrentIndex, originalCurrentIndex + 20));
        // if (node.textContent === '\n' && node.parentElement?.tagName === 'DIV' && !isNodeInCodeBlock(node))   console.log("COUNT: ");
        // if (node.textContent === '\n' && ['DIV'].includes(node.parentElement?.tagName || '') && !isNodeInCodeBlock(node)) {
        //         // console.log("PARENT ", node.parentElement);
        //       console.log("_____DIV_____" , originalContent.slice(originalCurrentIndex, originalCurrentIndex + 20));
        //       let updatedIdx = originalCurrentIndex;
        //       if (isInCodeBlock) {
        //         updatedIdx += 3; // for the back ticks
        //         isInCodeBlock = false;
        //       }
        //       compositeInsertPs.current.push({ p : node.parentElement as HTMLParagraphElement, contentIndex: updatedIdx});
        //       console.log("+++", compositeInsertPs.current.length);
        //   }

          if (!endFound) {

          const textContent = considerTag(node, originalContent.charAt(originalCurrentIndex));
          let nodeTextIndex = 0;

          const rangeStartOffset =  node === range.startContainer ? range.startOffset : -1;
          const rangeEndOffset = node === range.endContainer ? range.endOffset: -1;


          // once we reach the end of the offset then we just appedn the .slice(originalCurrentIndex) to the after 
            while (nodeTextIndex < textContent.length) {
              const nodeChar = textContent.charAt(nodeTextIndex);
              const originalChar = originalContent.charAt(originalCurrentIndex);
        
              if (nodeChar === originalChar) {
                // Check for start of highlighted text
                if (!startFound &&  node === range.startContainer && nodeTextIndex === rangeStartOffset) {
                  isInHighlight = true;
                  startFound = true;
                }
        
                // Edge case
                const isEndOfParagraph = rangeEndOffset === textContent.length && nodeTextIndex + 1 === rangeEndOffset;
                if (isInHighlight && node === range.endContainer && 
                    (nodeTextIndex === rangeEndOffset ||isEndOfParagraph)
                ) {
                  if (isEndOfParagraph) {
                    appendToCurrentText(nodeChar); // we need to append the letter to the before text cause the offset is exclusive
                    afterText = originalContent.slice(originalCurrentIndex + 1);// so we dont double append 
                  } else {
                     afterText = originalContent.slice(originalCurrentIndex);
                  }
                  // console.log("IN HIGHLIGHT");
                  isInHighlight = false;
                  endFound = true;
                }
        
                // Append the character to the appropriate text
                if (!isEndOfParagraph) appendToCurrentText(nodeChar); // if not end of paragraph then the char wont be appended, itll go to the next loop snce we break in the netx line
                if (endFound) break;
                
                // Advance both pointers
                nodeTextIndex++;
                originalCurrentIndex++;
              } else {
                // Characters do not match
                // Advance originalCurrentIndex and append missing characters (markdown syntax)
                let missingChar = originalContent.charAt(originalCurrentIndex);
                while (originalCurrentIndex < originalContent.length && missingChar !== nodeChar) {
                  appendToCurrentText(missingChar);
                  originalCurrentIndex++;
                  missingChar = originalContent.charAt(originalCurrentIndex);
                }
        
                // Now, either characters match or we've reached the end of originalContent
                if (originalCurrentIndex >= originalContent.length && !endFound) {
                  if (sourceRef.current?.source === 'chat') toast("Something went wrong, please try again in highlight mode.");
                  break;
                } 
              }
            }
          }
      }
    };

    function appendToCurrentText(char:string) {
      if (!startFound) {
        beforeText += char;
      } else if (startFound && !endFound) {
        highlightedText += char;
      } 
      // else {
      //   afterText += char;
      // }
    }

    return { beforeText, highlightedText, afterText };
   
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
    if (node.nodeType !== Node.TEXT_NODE || node.textContent?.trim() !== 'Copy code') return false;
  
    // Check if the parent is a <button> element
    const parentElement = node.parentElement;
    if (!parentElement || parentElement.tagName.toLowerCase() !== 'button') return false;
  
    // Check if the parent button has specific classes
    if (!parentElement.classList.contains('text-xs') || !parentElement.classList.contains('text-white')) return false;
  
    // Check if the grandparent is a <div> with class 'flex items-center'
    const grandparentElement = parentElement.parentElement;
    if (!grandparentElement || grandparentElement.tagName.toLowerCase() !== 'div' ||
        !grandparentElement.classList.contains('flex') || !grandparentElement.classList.contains('items-center')) return false;
    
  
    // Optionally, you can check if the previous sibling is an <svg> element
    const previousSibling = node.previousSibling;
    if (!previousSibling || previousSibling.nodeType !== Node.ELEMENT_NODE ||
       ((previousSibling as Element).tagName.toLowerCase() !== 'svg')) return false;

   
    return true; // If all checks pass, it's a code header
  }

  
  

  const shouldAbort = ()=>{
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
    movePulse();
    homeDispatch({field: 'messageIsStreaming', value: true}); 
    if (isArtifactSource) homeDispatch({field: 'artifactIsStreaming', value: true});
    try {
        const chatBody = {
            model: selectedConversation?.model ?? getDefaultModel(DefaultModels.DEFAULT),
            messages: [message],
            key: accessToken,
            prompt: prompt,
            temperature: 0.5,
            maxTokens: 4000,
            skipRag: true,
            skipCodeInterpreter: true,
            accountId: defaultAccount?.id,
            rateLimit: defaultAccount?.rateLimit
        };

        statsService.sendChatEvent(chatBody);
        const response = await sendChatRequestWithDocuments(chatEndpoint || '', accessToken, chatBody, controller.signal);
        
        let updatedConversation = cloneDeep(selectedConversation);

        let updatedArtifacts: Artifact[] | undefined = cloneDeep(selectedArtifacts);
        const responseData = response.body;
        const reader = responseData ? responseData.getReader() : null;
        const decoder = new TextDecoder();
        let done = false;
        let text = '';
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

                if (source?.messageIndex !== undefined && source.messageIndex < updatedArtifacts.length) {
                  updatedArtifacts[source.messageIndex].contents = lzwCompress(`${leadingText}${text}${trailingText}`);
                  homeDispatch({field: "selectedArtifacts", value: updatedArtifacts});
                }
              }
       
          }
          // console.log("FINAL REPLACEMNET: ", text);

          if (updatedConversation) {
            if (isArtifactSource && source?.artifactId && updatedArtifacts) updatedConversation.artifacts = 
                                                                            { ...updatedConversation.artifacts, 
                                                                                [source.artifactId]: updatedArtifacts
                                                                            }
            handleUpdateSelectedConversation(updatedConversation);
          }
          setSelected('');
          setInputValue('');
          selectedRef.current = '';
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
        console.error("Error prompting for prompt highlighting: ", e);
        alert("We are unable to fulfill your request at this time, please try again later.");
    } 
    homeDispatch({field: 'messageIsStreaming', value: false}); 
    if (isArtifactSource) homeDispatch({field: 'artifactIsStreaming', value: false});
    
  }



  const revertChanges = () => {
    // console.log("handle revert");
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


  

  // const createCompositeButton = (wrapper: HTMLDivElement, pElement: HTMLParagraphElement | null, pIndex: number) => {
  //   const button = document.createElement('button');
  //   button.textContent = '▶'; // U+25B6 BLACK RIGHT-POINTING TRIANGLE
  //   button.classList.add('composite-button');
  
  //   button.className = `absolute bg-transparent text-[16px] flex items-center px-2 rounded text-gray-500 ml-2`;
  //   button.style.top = '-24px'; // Adjust positioning 
  //   button.style.left = '-34px'; // Position button on the left
  
  //   // Append the button to the wrapper
  //   wrapper.appendChild(button);
  
  //   // Define event handlers
  //   const handleMouseEnter = () => {
  //     if (activeButtonRef.current !== button) {
  //       button.classList.add('hover:text-green-600');
  //     }
  //   };
  
  //   const handleMouseLeave = () => {
  //     if (activeButtonRef.current !== button) {
  //       button.classList.remove('hover:text-green-600');
  //     }
  //   };

  //   const handleMouseDown = (e: MouseEvent) => {
  //     e.preventDefault(); 
  //     e.stopPropagation();
      
  //     console.log('Composite button clicked:', e.target);
  //   }
  
  //   const handleClick = () => {
  //     if (activeButtonRef.current === button) {
  //       // Deactivate the button
  //       button.classList.remove('text-green-500');
  //       button.classList.add('text-gray-500');
  //       button.textContent = '▶'; // Reset symbol
  //       activeButtonRef.current = null;
  //     } else {
  //       // Deactivate the currently active button, if any
  //       if (activeButtonRef.current) {
  //         const prevButton = activeButtonRef.current;
  //         prevButton.classList.remove('text-green-500');
  //         prevButton.classList.add('text-gray-500');
  //         prevButton.textContent = '▶'; // Reset symbol
  //       }
  //       // Activate the clicked button
  //       button.classList.remove('text-gray-500');
  //       button.classList.add('text-green-500');
  //       button.textContent = '▶  insert text here';
  //       activeButtonRef.current = button;
  //     }
  //   };
  
  //   // Attach event listeners
  //   button.addEventListener('mouseenter', handleMouseEnter);
  //   button.addEventListener('mouseleave', handleMouseLeave);
  //   button.addEventListener('click', handleClick);
  //   button.addEventListener('mousedown',handleMouseDown);
  
  //   // Store for cleanup
  //   compositeButtonsRef.current.push({
  //     button,
  //     pElement,
  //     pIndex,
  //     handleMouseEnter,
  //     handleMouseLeave,
  //     handleClick,
  //     handleMouseDown
  //   });
  // };


  // const addCompositeButtons = () => {
  //   if (!sourceRef.current || !sourceRef.current.container) {
  //     console.log('No sourceRef or container');
  //     return;
  //   }
  //   const container = sourceRef.current.container;
  
  //   // Add buttons at empty <p> elements
  //   compositeInsertPs.current.forEach(({ p, contentIndex }) => {
  //     // Create a wrapper div with relative positioning
  //     const wrapper = document.createElement('div');
  //     wrapper.style.position = 'relative';
  
  //     // Insert the wrapper before the empty <p> element
  //     p.parentNode?.insertBefore(wrapper, p);
  
  //     // Move the empty <p> element into the wrapper
  //     wrapper.appendChild(p);
  
  //     // Create and append the button using the helper function
  //     createCompositeButton(wrapper, p, contentIndex);
  //   });
  
  //   // Add the start and end buttons if needed
  //   const endCapButtons = () => {
  //     if (compositeInsertPs.current.length === 0) {
  //       console.log(
  //         "!!!START BUTTON ADDED"
  //       )
  //       // No empty <p> elements found, add a start button
  //       const wrapperStart = document.createElement('div');
  //       wrapperStart.style.position = 'relative';
  //       container.insertBefore(wrapperStart, container.firstChild);
  //       createCompositeButton(wrapperStart, null, 0);
  //     }
  
  //     // Add end button
  //     const wrapperEnd = document.createElement('div');
  //     wrapperEnd.style.position = 'relative';
  //     container.appendChild(wrapperEnd);
  //     createCompositeButton(wrapperEnd, null, sourceRef.current?.originalContent.length || 999999);
  //   };
  
  //   endCapButtons();
  // };
  

  // const removeCompositeButtons = () => {
  //   compositeButtonsRef.current.forEach(({ button, handleMouseEnter, handleMouseLeave, handleClick, handleMouseDown }) => {
  //     if (button) {
  //       // Remove event listeners
  //       button.removeEventListener('mouseenter', handleMouseEnter);
  //       button.removeEventListener('mouseleave', handleMouseLeave);
  //       button.removeEventListener('click', handleClick);
  //       button.removeEventListener('mousedown', handleMouseDown);
  
  //       // Remove the button from the DOM if it's still present
  //       if (button.parentNode && button.parentNode.contains(button)) {
  //         try {
  //           button.parentNode.removeChild(button);
  //         } catch (e) {
  //           console.log("unable to remove buttons, error caught: ", e)
  //         }
  //       }
  //     }
  //   });
  
  //   // Clear references
  //   compositeButtonsRef.current = [];
  //   activeButtonRef.current = null; // Reset the active button reference
  // };  


  const createCompositeButton = (
    container: HTMLElement,
    pElement: HTMLParagraphElement | null,
    pIndex: number,
    top: number,
    left: number
  ) => {
    const button = document.createElement('button');
    button.textContent = '▶'; // U+25B6 BLACK RIGHT-POINTING TRIANGLE
    button.classList.add('composite-button');
  
    button.className = `absolute bg-transparent text-[16px] flex items-center px-2 rounded text-gray-500 ml-2`;
    button.style.position = 'absolute';
    button.style.top = `${top - 24}px`; // Positioning based on the p element
    button.style.left = `${left - 34}px`; // Adjust positioning (left of the p element)
  
    // Append the button directly to the container
    container.appendChild(button);
  
    // Define event handlers
    const handleMouseEnter = () => {
      if (activeButtonRef.current !== button) {
        button.classList.add('hover:text-green-600');
      }
    };
  
    const handleMouseLeave = () => {
      if (activeButtonRef.current !== button) {
        button.classList.remove('hover:text-green-600');
      }
    };
  
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault(); 
      e.stopPropagation();
      // console.log('Composite button clicked:', e.target);
    };
  
    const handleClick = () => {
      if (activeButtonRef.current === button) {
        // Deactivate the button
        button.classList.remove('text-green-500');
        button.classList.add('text-gray-500');
        button.textContent = '▶'; // Reset symbol
        activeButtonRef.current = null;
      } else {
        // Deactivate the currently active button, if any
        if (activeButtonRef.current) {
          const prevButton = activeButtonRef.current;
          prevButton.classList.remove('text-green-500');
          prevButton.classList.add('text-gray-500');
          prevButton.textContent = '▶'; // Reset symbol
        }
        // Activate the clicked button
        button.classList.remove('text-gray-500');
        button.classList.add('text-green-500');
        button.textContent = '▶  insert text here';
        activeButtonRef.current = button;
      }
    };
  
    // Attach event listeners
    button.addEventListener('mouseenter', handleMouseEnter);
    button.addEventListener('mouseleave', handleMouseLeave);
    button.addEventListener('click', handleClick);
    button.addEventListener('mousedown', handleMouseDown);
  
    // Store for cleanup
    compositeButtonsRef.current.push({
      button,
      pElement,
      pIndex,
      handleMouseEnter,
      handleMouseLeave,
      handleClick,
      handleMouseDown
    });
  };

  
  const addCompositeButtons = () => {
    if (!sourceRef.current || !sourceRef.current.container) {
      console.log('No sourceRef or container');
      return;
    }
    const container = sourceRef.current.container;
  
    // Ensure the container has relative positioning
    if (window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
  
    // Add buttons at empty <p> elements
    compositeInsertPs.current.forEach(({ p, contentIndex }) => {
      // Get position of the <p> element relative to the container
      const pRect = p.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const top = pRect.top - containerRect.top + container.scrollTop;
      const left = pRect.left - containerRect.left + container.scrollLeft;
  
      // Create and append the button using the helper function
      createCompositeButton(container, p, contentIndex, top, left);
    });
  
    // Add the start and end buttons if needed
    const endCapButtons = () => {
      // if (compositeInsertPs.current.length === 0) {
      //   console.log("!!!START BUTTON ADDED");
        // Add a start button at the top of the container
      createCompositeButton(container, null, 0, 0, 0);
      // }
  
      // Add end button at the bottom of the container
      const containerHeight = container.scrollHeight;
      createCompositeButton(
        container,
        null,
        sourceRef.current?.originalContent.length || 999999,
        containerHeight + 16, // Adjust as needed
        0
      );
    };
  
    endCapButtons();
  };

  
  const removeCompositeButtons = () => {
    compositeButtonsRef.current.forEach(({ button, handleMouseEnter, handleMouseLeave, handleClick, handleMouseDown }) => {
      if (button) {
        // Remove event listeners
        button.removeEventListener('mouseenter', handleMouseEnter);
        button.removeEventListener('mouseleave', handleMouseLeave);
        button.removeEventListener('click', handleClick);
        button.removeEventListener('mousedown', handleMouseDown);
  
        // Remove the button from the DOM if it's still present
        if (button.parentNode && button.parentNode === sourceRef.current?.container) {
          try {
            button.parentNode.removeChild(button);
          } catch (e) {
            console.log("Unable to remove button, error caught: ", e);
          }
        }
      }
    });
  
    // Clear references
    compositeButtonsRef.current = [];
    activeButtonRef.current = null; // Reset the active button reference
  };
  


  const handleSend = () => {
    if (!inputValue) return;
    // console.log("handle send");

    // console.log(selected);
    // in case we add more 
    switch (selected) {
      case (HighlightPromptTypes.FAST_EDIT): 
      statsService.HighlightFastEditEvent();
        handleFastEdit();
        break;
      case (HighlightPromptTypes.PROMPT):
        statsService.promptAgaintsHighlightEvent();
        handlePrompt();
        break;
      case (HighlightPromptTypes.COMPOSITE):
        statsService.HighlightCompositeEvent(compositeHighlightsRef.current.size);
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
        // console.log("*******\n",  beforeText);
        // console.log("*******\n",  afterText);
        // console.log("*******\n");
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
    onSend(msg);
    clear();
  }


  const handleComposite = () => {
    if (!sourceRef.current || !activeButtonRef.current) {
      console.log('No sourceRef or no active button');
      return;
    }
  
    const originalContent = sourceRef.current.originalContent;
      // Find the index of the active button
    const activeButton = activeButtonRef.current;
    const buttonData = compositeButtonsRef.current.find( (item) => item.button === activeButton );

    if (!buttonData) {
      console.log('Active button not found in compositeButtonsRef');
      return;
    }

    const beforeText = originalContent.slice(0, buttonData.pIndex)
    const afterText = originalContent.slice(buttonData.pIndex)

    console.log(`______________________`);

    console.log(`Button at index ${buttonData.pIndex}`);
    console.log('----Before text:', beforeText);
    console.log('------After text:', afterText);

    console.log(compositeHighlightsRef.current)
    removeCompositeButtons();

    const content = `
    User Query For Composite Edit: ${inputValue}

    **[Highlighted Paragraphs you take under consideration when creating a new paragraph]**\n${
      Array.from(compositeHighlightsRef.current).map((text: string) => `\ntext\n`)
    }************************
    \n\n

    Surrounding text:

    *** before text context TO BE LEFT UNCHANGED and serve as context ***\n"${
      beforeText.length > CHAR_LIMIT ? beforeText.slice(beforeText.length - CHAR_LIMIT) : beforeText
    }"\n\n

    {Your response will be inserted her textHERE}

    *** after text context TO BE LEFT UNCHANGED and serve as context ***\n"${
      afterText.slice(0, CHAR_LIMIT)
    }"

    `;

    

    // console.log('Composite:', content);

    let msg:Message = newMessage({role: 'user', content : content, type: MessageType.PROMPT});
    msg = setAssistantInMessage(msg, selectedAssistant || DEFAULT_ASSISTANT);
    promptForData(COMPOSITE_PROMPT, msg, beforeText + '\n', '\n' + afterText);

  };
  
    const isDisabled = () =>{
      if (selectedRef.current === HighlightPromptTypes.COMPOSITE) return !inputValue || !activeButtonRef.current;
      return !inputValue;
    }
  

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
                      onKeyDown={(e) => {
                        // console.log("Keydown event triggered");
                        if (e.key === 'Enter' && !e.shiftKey && !isDisabled() ) {
                          e.preventDefault(); 
                          handleSend();
                        }
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
                      disabled={isDisabled()}
                      className={`p-2 text-neutral-400 dark:text-neutral-500 ${isDisabled() ? "cursor-not-allowed" : "hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"} focus:outline-none`}
                      title={!isDisabled() ? "Send" :  !inputValue ? "Enter a message to send" : (selectedRef.current === HighlightPromptTypes.COMPOSITE && !activeButtonRef.current)? "Activate an insert button": "Disabled"}
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


