import { extractCodeBlocksAndText } from '@/utils/app/artifacts';
import React, { useEffect, useMemo, useState } from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackPreview,
  } from "@codesandbox/sandpack-react";
import { getFileExtensionFromLanguage } from '@/utils/app/codeblock';
import { getSettings } from '@/utils/app/settings';
import DOMPurify from 'dompurify';

interface Props {
    content: string;
    type: string;
    height: number;
}

const theme = 'dark';//getSettings().theme;

export const ArtifactPreview: React.FC<Props> = ({ content, type, height}) => {
    const { textBlocks, codeBlocks } = extractCodeBlocksAndText(content);
    console.log(type);
    const renderedContent = () => {
        switch (type) {
            case "vanilla":
            case "static":
                return <VanillaPreview codeBlocks={codeBlocks} height={height} framework={type}/>;
            case "react":
            case "vue":
            case "angular":
                return <FrameworkPreview codeBlocks={codeBlocks} height={height} framework={type} />;
            case "text":
            case "json":
            case "csv":
                return <TextPreview content={content} height={height} />;
            case "svg":
                const svgs = codeBlocks.filter(block => block.language === "svg").map(block => block.code)
                return <SVGPreview svgs={svgs} height={height} />;
            default:
                return <UnsupportedPreview content={content} />;
        }
    }

   return <div className="mt-8 group md:px-4 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100 h-[calc(100vh-140px)] flex flex-col">
    <div className="p-2 text-base md:max-w-2xl md:gap-6 md:py-2 lg:max-w-2xl lg:px-0 xl:max-w-3xl flex-grow overflow-auto">
      <div className="prose mt-[-2px] w-full dark:prose-invert">
        <div className="flex w-full flex-col h-full">
          <div>
                {renderedContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
}

// --- HTML, CSS, JS Preview Component (Vanilla) ---
const VanillaPreview: React.FC<{ codeBlocks: any; height: number; framework: any; }> = ({ codeBlocks, height, framework }) => {
    const [files, setFiles] = useState<{ [key: string]: { code: string } }>({});
  
    const isStaticTemplate = framework === 'static';
    useEffect(() => {
      if (codeBlocks.length > 0 && Object.keys(files).length === 0) {
        const newFiles: { [key: string]: { code: string } } = {};
  
        let hasHTML = false;
  
        codeBlocks.forEach((block: any, index: number) => {
          const extension = getFileExtensionFromLanguage(block.language);
          let fileName = '';
          if (block.language === 'html') {
            fileName = isStaticTemplate ? 'index.html' : '/index.html';
            hasHTML = true;
          } else {
            fileName = isStaticTemplate
              ? `file${index + 1}${extension}`
              : `/file${index + 1}${extension}`;
          }
          newFiles[fileName] = { code: block.code };
        });
  
        // If no HTML file is provided, create a default index.html
        if (!hasHTML) {
          const defaultHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Vanilla Preview</title>
            </head>
            <body>
                <h1>No preview</h1>
            </body>
            </html>
          `.trim();
          const indexHtmlPath = isStaticTemplate ? 'index.html' : '/index.html';
          newFiles[indexHtmlPath] = { code: defaultHtml };
        }
  
        // For 'vanilla' template, override default files
        if (framework === 'vanilla') {
          newFiles['/index.js'] = { code: '' };
          newFiles['/styles.css'] = { code: '' };
        }
  
        setFiles(newFiles);
      }
    }, [codeBlocks, framework]);
  
    // Helper function to inject CSS and JS files into the HTML
    const addAssetsToHTML = (
      htmlCode: string,
      cssFiles: string[],
      jsFiles: string[],
      isStaticTemplate: boolean
    ): string => {
      // Inject CSS links into the <head>
      cssFiles.forEach((cssFile) => {
        const assetPath = isStaticTemplate ? cssFile : `.${cssFile}`;
        const linkTag = `<link rel="stylesheet" href="${assetPath}">`;
        if (!htmlCode.includes(linkTag)) {
          const headCloseTag = '</head>';
          htmlCode = htmlCode.includes(headCloseTag)
            ? htmlCode.replace(headCloseTag, `${linkTag}\n${headCloseTag}`)
            : htmlCode;
        }
      });
  
      // Inject JS scripts before the closing </body> tag
      jsFiles.forEach((jsFile) => {
        const assetPath = isStaticTemplate ? jsFile : `.${jsFile}`;
        const scriptTag = `<script src="${assetPath}"></script>`;
        if (!htmlCode.includes(scriptTag)) {
          const bodyCloseTag = '</body>';
          htmlCode = htmlCode.includes(bodyCloseTag)
            ? htmlCode.replace(bodyCloseTag, `${scriptTag}\n${bodyCloseTag}`)
            : htmlCode;
        }
      });
  
      return htmlCode;
    };
  
    const memoizedFiles = useMemo(() => {
      if (!files.hasOwnProperty(isStaticTemplate ? 'index.html' : '/index.html')) {
        return files;
      }
  
      const cssFiles = Object.keys(files).filter((fileName) =>
        fileName.endsWith('.css')
      );
      const jsFiles = Object.keys(files).filter((fileName) =>
        fileName.endsWith('.js')
      );
  
      const indexHtmlPath = isStaticTemplate ? 'index.html' : '/index.html';
      let updatedHTML = files[indexHtmlPath].code;
  
      updatedHTML = addAssetsToHTML(updatedHTML, cssFiles, jsFiles, isStaticTemplate);
  
      return {
        ...files,
        [indexHtmlPath]: { code: updatedHTML },
      };
    }, [files, framework]);
  
    // console.log(memoizedFiles);
  // currently only static is working 
    return Object.keys(files).length > 0 ? (
      <SandpackProvider files={memoizedFiles} template={'static'} theme={theme}> 
        <SandpackLayout>
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={true}
            style={{ height: `${height}px`, overflow: 'auto', width: '100%' }}
          />
        </SandpackLayout>
      </SandpackProvider>
    ) : (
      <>Loading...</>
    );
  };
  
  
  

  // --- Framework (React, Vue, Angular) Preview Component ---
  const FrameworkPreview: React.FC<{ codeBlocks: any; height: number; framework: any }> = ({ codeBlocks, height, framework }) => {
    const [files, setFiles] = useState<{ [key: string]: { code: string } }>({});
  
    const setupReactFiles = (codeBlocks: any) => {
        const newFiles: { [key: string]: { code: string } } = {};
    
        let hasTSX = false;
        let hasCSS = false;
        let componentIndex = 0;
        let hasIndexHtml = false;
    
        const dependencies = new Set(['react', 'react-dom']); // Start with React dependencies
        const fileNameMapping: { [key: number]: string } = {}; // Map from code block index to file name
        const relativeImports: { [key: string]: string } = {}; // Map from relative import path to file name
    
        // First pass: Assign file names to code blocks
        codeBlocks.forEach((block: { code: string; language: string }, index: number) => {
          const language = block.language.toLowerCase();
          const code = block.code;
    
          let fileName = '';
          if (language === 'jsx' || language === 'javascript') {
            // Attempt to infer file name from code comments
            const inferredFileName = inferFileNameFromCode(code);
            if (inferredFileName) {
              fileName = `/src/${inferredFileName}`;
            } else {
              // Use 'App.js' for the first component, 'ComponentX.js' for subsequent ones
              fileName =
                componentIndex === 0 ? '/src/App.js' : `/src/Component${componentIndex}.js`;
            }
            componentIndex++;
          } else if (language === 'typescript' || language === 'tsx') {
            hasTSX = true;
            const inferredFileName = inferFileNameFromCode(code);
            if (inferredFileName) {
              fileName = `/src/${inferredFileName}`;
            } else {
              fileName =
                componentIndex === 0 ? '/src/App.tsx' : `/src/Component${componentIndex}.tsx`;
            }
            componentIndex++;
          } else if (language === 'css') {
            const inferredFileName = inferFileNameFromCode(code);
            if (inferredFileName) {
              fileName = `/src/${inferredFileName}`;
            } else {
              // Use 'App.css' for the first CSS file, 'stylesX.css' for subsequent ones
              fileName = hasCSS ? `/src/styles${componentIndex}.css` : '/src/App.css';
            }
            hasCSS = true;
          } else if (language === 'html') {
            fileName = '/public/index.html';
            hasIndexHtml = true;
          } else {
            // Handle other file types if necessary
            return;
          }
    
          newFiles[fileName] = { code };
          fileNameMapping[index] = fileName;
    
          // Extract dependencies and relative imports from the code
          extractDependenciesFromCode(code, dependencies, relativeImports, fileName);
        });
    
        // Second pass: Ensure all relative imports are included in files
        Object.keys(relativeImports).forEach((importPath) => {
          const fileName = relativeImports[importPath];
    
          // If the file is already included, skip
          if (newFiles[fileName]) {
            return;
          }
    
          // Try to find a code block that matches this file
          const matchingCodeBlock = codeBlocks.find((block: any) => {
            // Infer file name from code
            const inferredFileName = inferFileNameFromCode(block.code);
            if (inferredFileName && `/src/${inferredFileName}` === fileName) {
              return true;
            }
            return false;
          });
    
          if (matchingCodeBlock) {
            newFiles[fileName] = { code: matchingCodeBlock.code };
          } else {
            // If we cannot find the code, create an empty file
            newFiles[fileName] = { code: '' };
          }
        });
    
        // Create 'index.js' or 'index.tsx' in the root directory
        const indexFilename = hasTSX ? '/src/index.tsx' : '/src/index.js';
    
        // Generate the index file code
        const indexCode = `
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import App from './App';
    
          const rootElement = document.getElementById('root');
          const root = createRoot(rootElement);
          root.render(<App />);
        `;
        newFiles[indexFilename] = { code: indexCode.trim() };
    
        // If no 'public/index.html' provided, create a default one
        if (!hasIndexHtml) {
          const indexHtmlCode = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <title>React App</title>
            </head>
            <body>
              <div id="root"></div>
            </body>
            </html>
          `;
          newFiles['/public/index.html'] = { code: indexHtmlCode.trim() };
        }
    
        // Convert dependencies set to an object with 'latest' as version
        const dependenciesObj: any = {};
        dependencies.forEach((dep) => {
          dependenciesObj[dep] = 'latest';
        });
    
        // Add package.json with dependencies
        newFiles['/package.json'] = {
          code: JSON.stringify(
            {
              dependencies: dependenciesObj,
            },
            null,
            2
          ),
        };
    
        return newFiles;
      };
    
      // Helper function to extract dependencies and relative imports from code
      const extractDependenciesFromCode = (
        code: string,
        dependencies: any,
        relativeImports: any,
        currentFile: string
      ) => {
        // Regular expression to match import statements
        const importRegex = /import\s+[^'"]*\s+from\s+['"]([^'"]+)['"]/g;
        let match;
    
        while ((match = importRegex.exec(code)) !== null) {
          const moduleName = match[1];
          if (moduleName.startsWith('.')) {
            // Relative import
            const resolvedPath = resolveRelativePath(currentFile, moduleName);
            relativeImports[moduleName] = resolvedPath;
          } else {
            // External dependency
            dependencies.add(moduleName);
          }
        }
    
        // Handle CommonJS require statements
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        while ((match = requireRegex.exec(code)) !== null) {
          const moduleName = match[1];
          if (moduleName.startsWith('.')) {
            // Relative import
            const resolvedPath = resolveRelativePath(currentFile, moduleName);
            relativeImports[moduleName] = resolvedPath;
          } else {
            // External dependency
            dependencies.add(moduleName);
          }
        }
      };
    
      // Helper function to infer file name from code comments
      const inferFileNameFromCode = (code: string) => {
        const firstLine = code.split('\n')[0];
        const fileNameMatch = firstLine.match(/\/\/\s*File:\s*(.+)/);
        if (fileNameMatch) {
          return fileNameMatch[1].trim();
        }
        return null;
      };
    
      // Helper function to resolve relative paths
      const resolveRelativePath = (currentFile: string, relativePath: string) => {
        const path = require('path');
        const currentDir = path.dirname(currentFile);
        const fullPath = path.join(currentDir, relativePath);
        // Ensure the path has an extension
        if (!path.extname(fullPath)) {
          return `${fullPath}.js`;
        }
        return fullPath;
      };
    
      // Prepare the files based on the selected framework
      useEffect(() => {
        if (codeBlocks.length > 0 && Object.keys(files).length === 0) {
          let newFiles = {};
          switch (framework) {
            case 'react':
              newFiles = setupReactFiles(codeBlocks);
              break;
            // Add similar functions for Vue and Angular if needed
            case 'vue':
              // newFiles = setupVueFiles(codeBlocks);
              break;
            case 'angular':
              // newFiles = setupAngularFiles(codeBlocks);
              break;
            default:
              break;
          }
          setFiles(newFiles);
        }
      }, [codeBlocks, framework]);
    
    

    return (
        Object.keys(files).length > 0 ? (
            <SandpackProvider files={files} template={framework} theme={theme}>
              <SandpackLayout>
                <SandpackPreview
                  showOpenInCodeSandbox={false}
                  showRefreshButton={true}
                  style={{ height: `${height}px`, overflow: 'auto', width: '100%' }}
                />
              </SandpackLayout>
            </SandpackProvider>
          ) : (
            <>Loading...</>
          )
    );
  };
  
  
  // --- Text, JSON, CSV Preview Component ---
  const TextPreview: React.FC<{ content: string; height: number }> = ({ content, height }) => {
    const renderTextInIframe = () => {
      const iframeSrcDoc = `
        <html>
          <head>
            <style>
              body {
                font-family: 'Arial', sans-serif;
                background-color: #f8f8f8;
                padding: 20px;
                color: #333; 
                line-height: 1.6;
                font-size: 16px;
              }
              p {
                margin-bottom: 1em;
              }
            </style>
          </head>
          <body>
            ${content.replace(/\n/g, '<br/>')}
          </body>
        </html>
      `;
      return (
        <iframe
          srcDoc={iframeSrcDoc}
          style={{
            border: "1px solid #ddd", /* Light border for visual separation */
            borderRadius: "2px", /* Slightly rounded corners */
            width: "100%",
            height: `${height}px`,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)", /* Soft shadow for depth */
        
          }}
          title="Text Preview"
        />
      );
    };
  
    return <div>{renderTextInIframe()}</div>;
  };
  
  
  // --- SVG Preview Component ---
  
  const SVGPreview: React.FC<{ svgs: string[]; height: number }> = ({ svgs, height }) => {
    const sanitizeOptions = {   // Create a DOMPurify instance with custom configuration to allow animations
        ADD_TAGS: ['animate'], // Allow the animate tag
        ADD_ATTR: ['attributeName', 'from', 'to', 'dur', 'begin', 'repeatCount'] // Allow attributes used in animations
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: `${height}px`, width: '100%' }}>
        {svgs.map((svg, index) => {
          const sanitizedSVG = DOMPurify.sanitize(svg, sanitizeOptions); // Sanitize with custom options
          return (
            <div
              key={index}
              dangerouslySetInnerHTML={{ __html: sanitizedSVG }}
              style={{ marginBottom: '10px', width: '100%' }}
            />
          );
        })}
      </div>
    );
  };
  
  
  // --- Unsupported Type Preview Component ---
  const UnsupportedPreview: React.FC<{ content: string }> = ({ content }) => (
    <div>
      <p>Unsupported artifact type.</p>
      <pre>{content}</pre>
    </div>
  );
  












      // Helper function to structure Vue files properly
      const setupVueFiles = (codeBlocks: any) => {
        const newFiles: { [key: string]: { code: string } } = {};
        codeBlocks.forEach((block: any) => {
          const extension = getFileExtensionFromLanguage(block.language);
    
          // Map Vue code to App.vue
          if (block.language === 'html' || block.language === 'vue') {
            newFiles['/src/App.vue'] = { code: block.code };
          } else if (block.language === 'css') {
            newFiles['/src/App.css'] = { code: block.code };
          }
        });
    
        // Set main.js to render the Vue App component
        newFiles['/src/main.js'] = {
          code: `
          import { createApp } from 'vue';
          import App from './App.vue';
          import './App.css';
          createApp(App).mount('#app');
          `,
        };
        return newFiles;
      };
    
      // Helper function to structure Angular files properly
      const setupAngularFiles = (codeBlocks: any) => {
        const newFiles: { [key: string]: { code: string } } = {};
        codeBlocks.forEach((block: any) => {
          const extension = getFileExtensionFromLanguage(block.language);
    
          // Map Angular code to app.component.ts and app.module.ts
          if (block.language === 'typescript') {
            newFiles['/src/app/app.component.ts'] = { code: block.code };
          } else if (block.language === 'html') {
            newFiles['/src/app/app.component.html'] = { code: block.code };
          } else if (block.language === 'css') {
            newFiles['/src/app/app.component.css'] = { code: block.code };
          }
        });
    
        // Provide Angular main.ts and app.module.ts files
        newFiles['/src/main.ts'] = {
          code: `
          import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
          import { AppModule } from './app/app.module';
          platformBrowserDynamic().bootstrapModule(AppModule);
          `,
        };
        newFiles['/src/app/app.module.ts'] = {
          code: `
          import { NgModule } from '@angular/core';
          import { BrowserModule } from '@angular/platform-browser';
          import { AppComponent } from './app.component';
          @NgModule({
            declarations: [AppComponent],
            imports: [BrowserModule],
            providers: [],
            bootstrap: [AppComponent]
          })
          export class AppModule {}
          `,
        };
        return newFiles;
      };