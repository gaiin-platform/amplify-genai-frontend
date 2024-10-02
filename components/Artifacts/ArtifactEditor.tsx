import { extractCodeBlocksAndText } from "@/utils/app/artifacts";
import { getFileExtensionFromLanguage } from "@/utils/app/codeblock";
import { getSettings } from "@/utils/app/settings";
import {
  SandpackCodeEditor,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { IconCode, IconFileText } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  handleEditArtifact: (s: string) => void;
  setIsEditing: (isEditing: boolean) => void;
  isEditing: boolean;
  artifactContent: string;
  height: number;
}

export const ArtifactEditor: React.FC<Props> = ({
  handleEditArtifact,
  setIsEditing,
  isEditing,
  artifactContent,
  height,
}) => {

  const sandpackRef = useRef<any>(null);
  const theme = 'dark';//getSettings().theme;
  const [isCodeView, setIsCodeView] = useState(true);
  const [editContent, setEditContent] = useState<string>(artifactContent); // for text only 
  const [codeBlocks, setCodeBlocks] = useState< { language: string; code: string, fileName:string}[] >([]);
  const [files, setFiles] = useState<{ [key: string]: { code: string } }>({});


  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditContent(event.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
            e.preventDefault();
            handleEditArtifact(editContent);
        }
    };


    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing]);


    useEffect(() => {
      const { textBlocks, codeBlocks: extractedCodeBlocks } =
        extractCodeBlocksAndText(artifactContent);
  
      if (
        extractedCodeBlocks.length > 0 &&
        Object.keys(files).length === 0 &&
        codeBlocks.length === 0
      ) {
        const newFiles: { [key: string]: { code: string } } = {};
  
        const updatedCodeBlocks = extractedCodeBlocks.map((block, index) => {
          const extension = getFileExtensionFromLanguage(block.language);
          const fileName =
            block.language === 'html'
              ? '/index.html'
              : `/file${index + 1}.${extension}`;
          newFiles[fileName] = { code: block.code };
  
          return {
            ...block,
            fileName: fileName,
          };
        });
  
        if (textBlocks.length > 0) {
          const textContent = textBlocks.join('\n\n');
          newFiles['/text.txt'] = { code: textContent };
        }
  
        setFiles(newFiles);
        setCodeBlocks(updatedCodeBlocks);
      }
    }, [artifactContent]);

  
  const handleSave = () => {

    if (Object.keys(files).length > 0 && isCodeView) {
      // Access the latest code from the Sandpack instance

      const sandpackFiles = sandpackRef.current.files;

      // Update codeBlocks with the code from sandpackFiles
      const updatedCodeBlocks = codeBlocks.map((block) => {
        const file = sandpackFiles[block.fileName];
        return {
          ...block,
          code: file?.code || block.code,
        };
      });

      // Reconstruct the artifact content
      let newContent = '';
      let codeBlockIndex = 0;

      const parts = artifactContent.split(/(```\w*\n[\s\S]*?\n```)/g); // Split on code block markers

      for (let part of parts) {
        if (/^```/.test(part)) {
          // Replace code block with the updated code from codeBlocks
          const language = updatedCodeBlocks[codeBlockIndex].language;
          const code = updatedCodeBlocks[codeBlockIndex].code;
          newContent += `\`\`\`${language}\n${code}\n\`\`\``; // Rebuild the code block
          codeBlockIndex++;
        } else {
          newContent += part; // Leave non-code content unchanged
        }
      }

      handleEditArtifact(newContent);
    } else {
      handleEditArtifact(editContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const memoizedFiles = useMemo(() => files, [files]);


  return (
    <div className="mt-8 group md:px-4 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100 h-[calc(100vh-140px)] flex flex-col">
      <div className="p-2 text-base md:max-w-2xl md:gap-6 md:py-2 lg:max-w-2xl lg:px-0 xl:max-w-3xl overflow-hidden">
        <div className="prose mt-[-2px] dark:prose-invert max-w-full">
          <div className="flex flex-col h-full max-w-full" style={{ maxHeight: `${height}px` }}>
            { Object.keys(files).length > 0  && 
              <div className="ml-auto">
                 <button
                    onClick={() => setIsCodeView(!isCodeView)}
                    className={`text-[14px] flex items-center px-2 py-1 mb-2 rounded-md transition-colors duration-200 bg-gray-800 text-white hover:bg-gray-700`}
                  >
                 {isCodeView ? (
                   <>
                     <IconFileText size={18} className="mr-2" />
                     Show Raw Text
                   </>
                 ) : (
                   <>
                     <IconCode size={18} className="mr-2" />
                     Show Code
                   </>
                 )}
               </button>
         
                
              </div>}
            {/* Sandpack Editor */}
            {Object.keys(files).length > 0 && isCodeView ? (
                <SandpackProvider
                  template="static"
                  files={memoizedFiles}
                  customSetup={{ dependencies: {} }}
                  theme={theme} 
                >

                  <SandPackEditor
                     sandpackRef={sandpackRef}
                    height={`${height - 50}px`}
                  />
                </SandpackProvider>
            ) : 
            <textarea
                  ref={textareaRef}
                  className="w-full resize-none whitespace-pre-wrap border-none dark:bg-[#343541] flex-grow overflow-auto"
                  value={editContent}
                  onChange={handleInputChange}
                  onKeyDown={handlePressEnter}
                  onCompositionStart={() => setIsTyping(true)}
                  onCompositionEnd={() => setIsTyping(false)}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                    padding: '0',
                    margin: '0',
                    height: `${height}px`,
                    width: '600px'
                  }}
                /> 
          }
            
          </div>
        </div>
      </div>
      <div className="mt-4 mb-4 flex justify-center space-x-4">
        <button
          className="h-[40px] rounded-md bg-blue-500 px-4 py-1 text-sm font-medium text-white enabled:hover:bg-blue-600 disabled:opacity-50"
          onClick={ () => handleSave()}
        >
          Save
        </button>
        <button
          className="h-[40px] rounded-md border border-neutral-300 px-4 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};


interface SandPackProps {
  height: string;
  sandpackRef: React.MutableRefObject<any>;
}

export const SandPackEditor: React.FC<SandPackProps> = ({
  height,
  sandpackRef,
}) => {
  const { sandpack } = useSandpack();

  // Assign sandpack instance to ref
  useEffect(() => {
    sandpackRef.current = sandpack;
  }, [sandpack]);

  return (
    <SandpackCodeEditor
      showLineNumbers={true}
      showTabs={true}
      showInlineErrors={true}
      style={{ height: height, width: '600px' }}
    />
  );
};