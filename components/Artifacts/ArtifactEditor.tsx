import HomeContext from "@/pages/api/home/home.context";
import { CodeBlockDetails } from "@/utils/app/codeblock";
import {
  SandpackCodeEditor,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { IconCode, IconFileText } from "@tabler/icons-react";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";

interface Props {
  handleEditArtifact: (s: string) => void;
  setIsEditing: (isEditing: boolean) => void;
  isEditing: boolean;
  artifactContent: string;
  blocks: CodeBlockDetails[];
  height: number;
}

export const ArtifactEditor: React.FC<Props> = ({
  handleEditArtifact,
  setIsEditing,
  isEditing,
  artifactContent,
  blocks,
  height,
}) => {
  const { dispatch: homeDispatch, state:{lightMode} } = useContext(HomeContext);
  const sandpackRef = useRef<any>(null);
  const [isCodeView, setIsCodeView] = useState(true);
  const [editContent, setEditContent] = useState<string>(artifactContent); // for text only
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);


  const updateCodeBlocks = () => {
    let hasIndexHtml = false;

    const updatedBlocks: CodeBlockDetails[] = blocks.map((block, index) => {
      const extension = block.extension;
      if (block.language === "html") hasIndexHtml = true;
      let fileName = block.filename
        ? block.filename
        : block.language === "html" && !hasIndexHtml
        ? "index.html"
        : `file${index + 1}${extension}`;
      fileName = fileName.replace(/\.(?=.*\.)/g, "_");
      return { ...block, filename: fileName };
    });
    // console.log("editing ", updatedBlocks);
    return updatedBlocks;
  };

  const [codeBlocks] = useState<CodeBlockDetails[]>(updateCodeBlocks());

  const validateCodeBlocks = (codeBlocks: CodeBlockDetails[]) => {
    let isValid = true;
  
    for (const block of codeBlocks) {
      if (block.extension === '.json') {
        try {
          // Attempt to parse the JSON code
          JSON.parse(block.code);
        } catch (e) {
          // If parsing fails, mark as invalid and break the loop
          isValid = false;
          break;
        }
      }
    }
    if (!isValid) console.log("Sandpack will throw errors. code view omitted");
    return isValid;
  };

  const [isCodeViewAvailable, setIsCodeViewAvailable] = useState(validateCodeBlocks(codeBlocks));


  const establishFiles = (codeBlocks: CodeBlockDetails[]) => {
    const newFiles: { [key: string]: any } = {};
    let hasIndexHtml = false;
    codeBlocks.forEach((block) => {
      if (block.language === "html") hasIndexHtml = true;
      newFiles[block.filename] = { code: block.code };
    });
    if (!hasIndexHtml)
      newFiles["/index.html"] = {
        code: "<!--Intentionally left blank. Ignore this file.-->",
      };
    // console.log("editing files", newFiles);

    return newFiles;
  };

  const [files] = useState<{ [key: string]: { code: string } }>(isCodeViewAvailable ? establishFiles(codeBlocks): {});


  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !isTyping && !e.shiftKey) {
      e.preventDefault();
      handleEditArtifact(editContent);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleSave = () => {
    if (Object.keys(files).length > 0 && isCodeView) {
      // Access the latest code from the Sandpack instance
      const sandpackFiles = sandpackRef.current.files;

      // Update codeBlocks with the code from sandpackFiles
      const updatedCodeBlocks = codeBlocks.map((block) => {
        const file = sandpackFiles["/" + block.filename];
        return {
          ...block,
          code: file?.code || block.code,
        };
      });

      // Reconstruct the artifact content
      let newContent = "";
      updatedCodeBlocks.forEach((block: CodeBlockDetails) => {
        if (block.extension === ".txt") {
          newContent += block.code;
        } else {
          newContent += "\n" + `\`\`\`${block.language}\n${block.code}\n\`\`\``;
        }
      });

      handleEditArtifact(newContent);
    } else {
      handleEditArtifact(editContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  // Error handler for the ErrorBoundary
  const handleCodeViewError = () => {
    setIsCodeViewAvailable(false);
    setIsCodeView(false);
  };

  return (
    <div className="mt-8 group md:px-4 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100 h-[calc(100vh-140px)] flex flex-col">
      <div className="p-2 text-base md:max-w-2xl md:gap-6 md:py-2 lg:max-w-2xl lg:px-0 xl:max-w-3xl overflow-hidden">
        <div className="prose mt-[-2px] dark:prose-invert max-w-full">
          <div
            className="flex flex-col h-full max-w-full"
            id="editModal"
            style={{ maxHeight: `${height}px` }}
          >
            {isCodeViewAvailable && Object.keys(files).length > 0 && (
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
              </div>
            )}
            {/* Sandpack Editor */}
            {isCodeViewAvailable && 
            Object.keys(files).length > 0 &&
            isCodeView ? (
              <ErrorBoundary onError={handleCodeViewError}>
                <SandpackProvider
                  template="static"
                  files={files}
                  customSetup={{ dependencies: {} }}
                  theme={lightMode}
                >
                  <SandPackEditor
                    sandpackRef={sandpackRef}
                    height={`${height - 50}px`}
                  />
                </SandpackProvider>
              </ErrorBoundary>
            ) : (
              <textarea
                ref={textareaRef}
                className="w-full resize-none whitespace-pre-wrap border-none dark:bg-[#343541] flex-grow overflow-auto"
                value={editContent}
                onChange={handleInputChange}
                onKeyDown={handlePressEnter}
                onCompositionStart={() => setIsTyping(true)}
                onCompositionEnd={() => setIsTyping(false)}
                style={{
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  lineHeight: "inherit",
                  padding: "0",
                  margin: "0",
                  height: `${height}px`,
                  width: "600px",
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 mb-4 flex justify-center space-x-4">
        <button
          id="cancelEdit"
          className="h-[40px] rounded-md border border-neutral-300 px-10 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 shadow-lg"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          id="confirmEdit"
          className="h-[40px] rounded-md bg-blue-500 px-10 py-1 text-sm font-medium text-white enabled:hover:bg-blue-600 disabled:opacity-50 shadow-lg"
          onClick={() => handleSave()}
        >
          Save
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
      style={{ height: height, width: "600px" }}
    />
  );
};


interface ErrorBoundaryProps {
  onError: () => void;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    // Update state so the next render shows the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // You can log the error to an error reporting service here
    console.log('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI if provided
      return this.props.fallback || null;
    }

    return this.props.children;
  }
}