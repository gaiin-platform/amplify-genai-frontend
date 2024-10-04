import React, { useEffect, useMemo, useState } from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackPreview,
  } from "@codesandbox/sandpack-react";
import { CodeBlockDetails, getFileExtensionFromLanguage } from '@/utils/app/codeblock';
import { getSettings } from '@/utils/app/settings';
import DOMPurify from 'dompurify';

interface Props {
    codeBlocks: CodeBlockDetails[];
    artifactContent: string;
    type: string;
    height: number;
}

const theme = 'dark';//getSettings().theme;

export const ArtifactPreview: React.FC<Props> = ({ codeBlocks, artifactContent, type, height}) => {

    const renderedContent = () => {
      console.log("code blocks", codeBlocks);
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
                return <TextPreview content={artifactContent} height={height} />;
            case "svg":
                const svgs = codeBlocks.filter(block => block.language === "svg").map(block => block.code)
                return <SVGPreview svgs={svgs} height={height} />;
            default:
                return <UnsupportedPreview content={artifactContent} />;
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
    // console.log(framework);
    useEffect(() => {
      if (codeBlocks.length > 0 && Object.keys(files).length === 0) {
        const newFiles: { [key: string]: { code: string } } = {};

        codeBlocks.forEach((block: CodeBlockDetails, index: number) => {
          if (block.language === 'txt') {
              // Skip text blocks as they are not needed in Sandpack
              return;
          }
          // CHANGES: Use the provided filename directly
          let filename = block.filename ? block.filename : `file${index + 1}${block.extension}`
          if (!isStaticTemplate) filename = `/${filename}`;
          newFiles[filename] = { code: block.code };
        });
  
        // console.log("new" , newFiles);
        const indexHtmlPath = (isStaticTemplate ? '' : '/') + 'index.html';
            if (!newFiles.hasOwnProperty(indexHtmlPath)) {
                const defaultHtml = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <title>Vanilla Preview</title>
                    </head>
                    <body>
                        <h1>No preview available</h1>
                    </body>
                    </html>
                `.trim();
                newFiles[indexHtmlPath] = { code: defaultHtml };
            }

            setFiles(newFiles);
  
        // For 'vanilla' template, override default files
        if (!isStaticTemplate) {
          const clear = ['/styles.css', '/index.js'];
          clear.forEach((filename:string) => {
              if (!newFiles.hasOwnProperty(filename)) newFiles[filename] = { code: '' };
          });
        }

  
        setFiles(newFiles);
        // console.log("new", newFiles);
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
      const indexHtmlPath = (isStaticTemplate ? '' : '/') + 'index.html';
      if (!files.hasOwnProperty(indexHtmlPath)) {
        return files;
      }
  
      const cssFiles = Object.keys(files).filter((fileName) =>
        fileName.endsWith('.css')
      );
      const jsFiles = Object.keys(files).filter((fileName) =>
        fileName.endsWith('.js')
      );
  
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
            showOpenInCodeSandbox={true}
            showRefreshButton={true}
            style={{ height: `${height}px`, overflow: 'auto', width: '100%' }}
          />
        </SandpackLayout>
      </SandpackProvider>
    ) : (
      <>Loading...</>
    );
  };
  
  
  

const FrameworkPreview: React.FC<{ codeBlocks: any; height: number; framework: any }> = ({ codeBlocks, height, framework }) => {
  const [files, setFiles] = useState<{ [key: string]: { code: string } }>({});

  const setupReactFiles = (codeBlocks: any) => {
    const newFiles: { [key: string]: { code: string } } = {};
    const dependencies = new Set(['react', 'react-dom']); // Only include necessary dependencies

    codeBlocks.forEach((block: CodeBlockDetails) => {
      if (block.language === 'txt' ||  block.filename === 'package.json') return; // Skip text blocks as they are unnecessary
      const language = block.language.toLowerCase();
      const code = block.code;
      let filename = block.filename;

      if (language === 'html') {
        filename = `/public/${filename}`;
      } else {
        filename = `/src/${filename}`;
      }

      newFiles[filename] = { code };

      // Extract dependencies from the code
      extractDependenciesFromCode(code, dependencies);
    });

    // Ensure '/src/index.js' exists
    if (!newFiles.hasOwnProperty('/src/index.js')) {
      const indexCode = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);
root.render(<App />);
      `;
      newFiles['/src/index.js'] = { code: indexCode.trim() };
    }

    // Ensure '/public/index.html' exists
    if (!newFiles.hasOwnProperty('/public/index.html')) {
      const indexHtmlCode = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>React App</title>
  <link rel="stylesheet" type="text/css" href="/src/App.css" /> 
</head>
<body>
  <div id="root"></div>
  <script src="/src/index.js"></script>
</body>
</html>
      `;
      newFiles['/public/index.html'] = { code: indexHtmlCode.trim() };
    }

    // Convert dependencies set to an object with 'latest' as version
    const dependenciesObj: any = {};
    dependencies.forEach((dep) => {
      if (dep !== 'react-dom/client') dependenciesObj[dep] = 'latest';
    });

    // console.log(dependenciesObj);
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

    // console.log("new", newFiles);

    return newFiles;
  };

  const setupAngularFiles = (codeBlocks: any) => {
    const newFiles: { [key: string]: { code: string } } = {};
    const dependencies = new Set([
      '@angular/core',
      '@angular/common',
      '@angular/compiler',
      '@angular/platform-browser',
      '@angular/platform-browser-dynamic',
      'rxjs',
      'zone.js',
    ]);
  
    // Loop over the code blocks to set up files and extract dependencies
    codeBlocks.forEach((block: CodeBlockDetails) => {
      if (block.language === 'txt') return; // Skip unnecessary text blocks
      const code = block.code;
      let filename = block.filename;
  
      // Adjust the file path based on the file type
      if (!filename.startsWith('/')) {
        if (filename === 'app.module.ts' || filename === 'app.component.ts') {
          filename = '/src/app/' + filename;
        } else if (filename === 'index.html') {
          filename = '/src/' + filename;
        } else {
          filename = '/src/' + filename;
        }
      }
  
      newFiles[filename] = { code };
  
      // Extract dependencies from the code
      extractDependenciesFromCode(code, dependencies);
    });
  
    // Ensure '/src/main.ts' exists
    if (!newFiles.hasOwnProperty('/src/main.ts')) {
      const mainTsCode = `// main.ts
  import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
  import { AppModule } from './app/app.module';
  
  platformBrowserDynamic().bootstrapModule(AppModule)
    .catch(err => console.error(err));
      `;
      newFiles['/src/main.ts'] = { code: mainTsCode.trim() };
    }
  
    // Ensure '/src/index.html' exists
    if (!newFiles.hasOwnProperty('/src/index.html')) {
      const indexHtmlCode = `<!-- index.html -->
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Angular App</title>
    <base href="/" />
  </head>
  <body>
    <app-root></app-root>
  </body>
  </html>`;
      newFiles['/src/index.html'] = { code: indexHtmlCode.trim() };
    }
  
   
  
    // if (!newFiles.hasOwnProperty('/package.json')) {
      // Convert dependencies set to an object with 'latest' as version
          const dependenciesObj: any = {};
          dependencies.forEach((dep) => {
            dependenciesObj[dep] = 'latest';
          });

          console.log(dependenciesObj);
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
    // }
  
    // Ensure 'tsconfig.json' exists
    if (!newFiles.hasOwnProperty('/tsconfig.json')) {
      const tsconfigCode = `{
    "compilerOptions": {
      "outDir": "./out-tsc/app",
      "sourceMap": true,
      "declaration": false,
      "module": "esnext",
      "moduleResolution": "node",
      "emitDecoratorMetadata": true,
      "experimentalDecorators": true,
      "lib": [
        "es2020",
        "dom"
      ],
      "target": "es2015",
      "typeRoots": [
        "node_modules/@types"
      ]
    },
    "angularCompilerOptions": {
      "enableIvy": true
    }
  }`;
      newFiles['/tsconfig.json'] = { code: tsconfigCode };
    }
  
    return newFiles;
  };

  // Helper function to extract dependencies
  const extractDependenciesFromCode = (
    code: string,
    dependencies: Set<string>
  ) => {
    const importRegex = /import\s+[^'"]*\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      const moduleName = match[1];
      if (!moduleName.startsWith('.')) {
        // External dependency
        dependencies.add(moduleName);
      }
    }
  };

  // Prepare the files based on the selected framework
  useEffect(() => {
    if (codeBlocks.length > 0 && Object.keys(files).length === 0) {
      let newFiles = {};
      switch (framework) {
        case 'react':
          newFiles = setupReactFiles(codeBlocks);
          break;
        case 'vue':
          newFiles = setupVueFiles(codeBlocks);
          break;
        case 'angular':
          newFiles = setupAngularFiles(codeBlocks);
          break;
        default:
          break;
      }
      setFiles(newFiles);
    }
  }, [codeBlocks, framework]);

  return Object.keys(files).length > 0 ? (
    <SandpackProvider files={files} template={framework} theme={theme}>
      <SandpackLayout>
        <SandpackPreview
          showOpenInCodeSandbox={true}
          showRefreshButton={true}
          style={{ height: `${height}px`, overflow: 'auto', width: '100%' }}
        />
      </SandpackLayout>
    </SandpackProvider>
  ) : (
    <>Loading...</>
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
    
