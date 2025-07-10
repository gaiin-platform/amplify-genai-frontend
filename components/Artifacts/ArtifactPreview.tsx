import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackPreview,
    useSandpack,
  } from "@codesandbox/sandpack-react";

import { CodeBlockDetails } from '@/utils/app/codeblock';
import DOMPurify from 'dompurify';
import HomeContext from '@/pages/api/home/home.context';
import { IconAlertCircle, IconPresentation } from '@tabler/icons-react';
import { SandpackErrorMessage, SandpackMessage, SandpackMessageConsoleMethods } from '@codesandbox/sandpack-client';

interface Props {
    codeBlocks: CodeBlockDetails[];
    artifactContent: string;
    type: string;
    height: number;
}



export const ArtifactPreview: React.FC<Props> = ({ codeBlocks, artifactContent, type, height}) => {

    const renderedContent = () => {
      // console.log("code blocks", codeBlocks);
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
          <div className='max-w-[600px]' id="renderedContent">
                {renderedContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
}


 
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
  





// --- HTML, CSS, JS Preview Component (Vanilla) ---
const VanillaPreview: React.FC<{ codeBlocks: CodeBlockDetails[]; height: number; framework: any; }> = ({ codeBlocks, height, framework }) => {
    const [files, setFiles] = useState<{ [key: string]: { code: string } }>({});
  
    const isStaticTemplate = framework === 'static';
    // console.log(framework);
    useEffect(() => {
      if (codeBlocks && codeBlocks.length > 0 && Object.keys(files).length === 0) {
        const newFiles: { [key: string]: { code: string } } = {};

        codeBlocks.forEach((block: CodeBlockDetails, index: number) => {
          if (block.language === 'txt') {
              // Skip text blocks as they are not needed in Sandpack
              return;
          }
          let code = block.code;
          // CHANGES: Use the provided filename directly
          let filename = block.filename ? block.filename : `file${index + 1}${block.extension}`
          if (!isStaticTemplate) filename = `/${filename}`;

          if (block.extension === '.js') {
              code = `${code}
                      
                      ${errorHandlingCode}`.trim();
          }
          newFiles[filename] = { code: code };
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

        // newFiles['/index.js'].code = `${newFiles['/index.js'].code}
        //                             ${errorHandlingCode}`
  
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
        <PreviewSandpack
          files={memoizedFiles}
          template={'static'}
          height={height}
        />

    ) : (
      <>Loading...</>
    );
  };
  
  
  

const FrameworkPreview: React.FC<{ codeBlocks: CodeBlockDetails[]; height: number; framework: any }> = ({ codeBlocks, height, framework }) => {
  const { dispatch: homeDispatch, state:{statsService, featureFlags, lightMode} } = useContext(HomeContext);
  const [files, setFiles] = useState<{ [key: string]: { code: string } }>({});

  const setupReactFiles = (codeBlocks: CodeBlockDetails[]) => {
    const newFiles: { [key: string]: { code: string } } = {};
    const dependencies = new Set(['react', 'react-dom']); // Only include necessary dependencies

    codeBlocks.forEach((block: CodeBlockDetails) => {
      if (block.language === 'txt' ||  block.filename === 'package.json') return; // Skip text blocks as they are unnecessary
      const language = block.language.toLowerCase();
      let code = block.code;
      let filename = block.filename;

      if (language === 'html') {
        filename = `/public/${filename}`;
      } else {
        filename = `/src/${filename}`;
      } 
      
      if (filename === '/src/index.js' || filename === '/src/index.tsx') {
        code = `
        ${code}

        ${errorHandlingCode}
        `.trim();
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

${errorHandlingCode}
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

  const setupAngularFiles = (codeBlocks: CodeBlockDetails[]) => {
    const newFiles: { [key: string]: { code: string } } = {};
    const dependencies = new Set<string>();
  
    // Iterate over codeBlocks
    codeBlocks.forEach((block) => {
      const { code, filename } = block;
      let adjustedFilename = filename;
  
      // Adjust the filename to include the correct path
      if (['package.json', 'tsconfig.json', 'angular.json'].includes(filename)) {
        adjustedFilename = `/${filename}`;
  
        // Parse dependencies from package.json
        if (filename === 'package.json') {
          try {
            const codeWithoutComments = code.replace(/^\s*\/\/.*\n/gm, '').trim();
            const packageJsonObj = JSON.parse(codeWithoutComments);
            if (packageJsonObj.dependencies) {
              Object.keys(packageJsonObj.dependencies).forEach((dep) => {
                dependencies.add(dep);
              });
            }
            if (packageJsonObj.devDependencies) {
              Object.keys(packageJsonObj.devDependencies).forEach((dep) => {
                dependencies.add(dep);
              });
            }
          } catch (e) {
            console.error('Failed to parse package.json:', e);
          }
        }
      } else if (['index.html', 'main.ts', 'polyfills.ts'].includes(filename)) {
        adjustedFilename = `/src/${filename}`;
      } else if (filename.startsWith('app.')) {
        adjustedFilename = `/src/app/${filename}`;
      }  else {
        // For other files, place them under /src/
        adjustedFilename = `/src/${filename}`;
      }
  
      // Add the code to newFiles
      newFiles[adjustedFilename] = { code };
  
      // Extract dependencies from the code
      extractDependenciesFromCode(code, dependencies);
    });
  
    // Ensure essential files exist
    const ensureFile = (path: string, defaultCode: string) => {
      if (!newFiles.hasOwnProperty(path)) {
        newFiles[path] = { code: defaultCode.trim() };
      } else if (path === "/src/main.ts") {
        newFiles[path].code = newFiles[path].code.replace("import { AppModule } from './app.module';","import { AppModule } from './app/app.module';");
      }
    };
  
    ensureFile('/src/main.ts', `// main.ts
  import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
  import { AppModule } from './app/app.module';
  
  platformBrowserDynamic().bootstrapModule(AppModule)
    .catch(err => console.error(err));
  `);
  
    ensureFile('/src/index.html', `<!-- index.html -->
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Angular App</title>
    <base href="/">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <app-root></app-root>
  </body>
  </html>`);
  
    ensureFile('/src/app/app.module.ts', `// app.module.ts
  import { NgModule } from '@angular/core';
  import { BrowserModule } from '@angular/platform-browser';
  
  import { AppComponent } from './app.component';
  
  @NgModule({
    declarations: [
      AppComponent
    ],
    imports: [
      BrowserModule
    ],
    providers: [],
    bootstrap: [AppComponent]
  })
  export class AppModule { }`);
  
    ensureFile('/src/app/app.component.ts', `// app.component.ts
  import { Component } from '@angular/core';
  
  @Component({
    selector: 'app-root',
    template: '<h1>Hello Angular</h1>',
    styles: []
  })
  export class AppComponent { }`);
  
    ensureFile('/tsconfig.json', `{
  "compilerOptions": {
    "target": "es2015",
    "module": "esnext",
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "lib": [
      "es2018",
      "dom"
    ],
    "skipLibCheck": true
  },
  "angularCompilerOptions": {
    "enableIvy": true
  }
}`);
  
    ensureFile('/angular.json', `{
  "projects": {
    "app": {
      "root": "",
      "sourceRoot": "src",
      "projectType": "application",
      "architect": {
        "build": {
          "options": {
            "outputPath": "dist/app",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": "src/polyfills.ts",
            "tsConfig": "tsconfig.json",
            "assets": [],
            "styles": [],
            "scripts": []
          }
        }
      }
    }
  }
}
`);
  
    ensureFile('/src/polyfills.ts', `import 'zone.js';  // Included with Angular CLI.`);
    ensureFile('/src/environments/environment.ts', `// environment.ts
export const environment = {
  production: false
};`);

  
    // Add essential dependencies
    const essentialDependencies = [
      '@angular/core',
      '@angular/common',
      '@angular/compiler',
      '@angular/platform-browser',
      '@angular/platform-browser-dynamic',
      'rxjs',
      'zone.js',
      "core-js",
    ];
    essentialDependencies.forEach(dep => dependencies.add(dep));
  
    // Convert dependencies set to an object with versions
    const dependenciesObj: { [key: string]: string } = {};
    dependencies.forEach((dep) => {
      dependenciesObj[dep] = 'latest';
    });

    const defaultScripts = {
      "ng": "ng",
      "start": "ng serve",
      "build": "ng build",
      "test": "ng test",
      "lint": "ng lint",
      "e2e": "ng e2e"
    };
  
    // Ensure package.json exists and include dependencies
    if (!newFiles.hasOwnProperty('/package.json')) {
      newFiles['/package.json'] = {
        code: JSON.stringify(
          {
            dependencies: dependenciesObj,
            private: true,
            scripts: defaultScripts,
          },
          null,
          2
        ),
      };
    } else {
     // If package.json exists, merge dependencies and scripts
    const packageJsonCode = newFiles['/package.json'].code;
    let packageJsonObj: any;
    try {
      const codeWithoutComments = packageJsonCode.replace(/^\s*\/\/.*\n/gm, '').trim();
      packageJsonObj = JSON.parse(codeWithoutComments);
    } catch (e) {
      packageJsonObj = {};
    }
    // Merge dependencies
    packageJsonObj.dependencies = {
      ...packageJsonObj.dependencies,
      ...dependenciesObj,
    };
    // Merge scripts
    packageJsonObj.scripts = {
      ...defaultScripts,
      ...packageJsonObj.scripts,
    };
      newFiles['/package.json'].code = JSON.stringify(packageJsonObj, null, 2);
    }

    console.log("files", newFiles);
  
    return newFiles;
  };
  // console.log(framework);


  
  const setupVueFiles = (codeBlocks: CodeBlockDetails[]) => {
    const newFiles : { [key: string]: { code: string } } = {};
    const dependencies = new Set(['vue']); // Ensure Vue is included
  
    codeBlocks.forEach((block) => {
      if (block.language === 'txt' || block.filename === 'package.json') return; // Skip unnecessary blocks
      const language = block.language.toLowerCase();
      let code = block.code;
      let filename = block.filename;
  
      if (language === 'html') {
        // Place HTML files in /public
        filename = `/public/${filename}`;
        // Remove CDN scripts if present, as dependencies are handled via package.json
        code = code.replace(
          /<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/vue@[\d.]+\/dist\/vue\.js"><\/script>/g,
          ''
        );
        code = code.replace(
          /<script\s+src="main\.js"><\/script>/g,
          '<script src="/src/main.js"></script>'
        );
      } else if (language === 'javascript' || language === 'js') {
        // Place JavaScript files in /src
        filename = `/src/${filename}`;
        // Replace global Vue usage with module imports
        if (code.includes('Vue.component') || code.includes('new Vue')) {
          code = `
  import Vue from 'vue';
  import App from './App.vue';
  
  Vue.config.productionTip = false;
  
  new Vue({
    render: h => h(App),
  }).$mount('#app');`;
          // Ensure App.vue exists
          if (!newFiles.hasOwnProperty('/src/App.vue')) {
            newFiles['/src/App.vue'] = {
              code: `
  <template>
    <div id="app">
      <my-component></my-component>
    </div>
  </template>
  
  <script>
  import MyComponent from './MyComponent.vue';
  
  export default {
    name: 'App',
    components: {
      MyComponent
    }
  };
  </script>`,
            };
          }
          // Extract component code and place it in MyComponent.vue
          newFiles['/src/MyComponent.vue'] = {
            code: `
  <template>
    <p>{{ message }}</p>
  </template>
  
  <script>
  export default {
    data() {
      return {
        message: 'Hello Vue!'
      };
    }
  };
  </script>`,
          };
        }
      } else if (language === 'vue') {
        // Place Vue components in /src
        filename = `/src/${filename}`;
      } else {
        // Default to /src for other file types
        filename = `/src/${filename}`;
      }
      code = code.trim();
      newFiles[filename] = { code };
  
      // Extract dependencies from the code
      extractDependenciesFromCode(code, dependencies);
    });
  
    // Ensure '/src/main.js' exists
    if (!newFiles.hasOwnProperty('/src/main.js')) {
      newFiles['/src/main.js'] = {
        code: `
  import Vue from 'vue';
  import App from './App.vue';
  
  Vue.config.productionTip = false;
  
  new Vue({
    render: h => h(App),
  }).$mount('#app');`,
      };
    }
  
    // Ensure '/src/App.vue' exists
    if (!newFiles.hasOwnProperty('/src/App.vue')) {
      newFiles['/src/App.vue'] = {
        code: `
  <template>
    <div id="app">
      <h1>Hello Vue!</h1>
    </div>
  </template>
  
  <script>
  export default {
    name: 'App',
  };
  </script>
  
  <style>
  #app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
  }
  </style>
        `.trim(),
      };
    }
  
    // Ensure '/public/index.html' exists
    if (!newFiles.hasOwnProperty('/public/index.html')) {
      newFiles['/public/index.html'] = {
        code: `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="/src/main.js"></script>
  </body>
  </html>`,
      };
    }
  
    // Convert dependencies set to an object with 'latest' as version
    const dependenciesObj:any = {};
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
  
    console.log(newFiles);
    return newFiles;
  };
  
  
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
    if (codeBlocks && codeBlocks.length > 0 && Object.keys(files).length === 0) {
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
    <PreviewSandpack
          files={files}
          template={framework}
          height={height}
        />
  ) : (
    <>Loading...</>
  );
};







const errorHandlingCode = `
window.onerror = function (message, source, lineno, colno, error) {
  window.parent.postMessage(
    {
      type: 'iframe_error',
      message,
      source,
      lineno,
      colno,
      error: error ? error.toString() : null,
    },
    '*'
  );
};

window.addEventListener('unhandledrejection', function (event) {
  window.parent.postMessage(
    {
      type: 'iframe_error',
      message: event.reason ? event.reason.toString() : 'Unhandled promise rejection',
    },
    '*'
  );
});
`.trim();





interface PreviewSandpackProps {
  files: { [key: string]: { code: string } };
  template: any;
  height: number;
}

const PreviewSandpack: React.FC<PreviewSandpackProps> = ({ files, template, height }) => {
  const [isErrorView, setIsErrorView] = useState(false);
  const [errorPresent, setErrorPresent] = useState(false);
  const [errorMessages, setErrorMessages] = useState<Set<string>>(new Set());

  // Keep this code as per your request
  const { state: { featureFlags, lightMode } } = useContext(HomeContext);

  // ErrorListener definition inside PreviewSandpack
  const ErrorListener: React.FC = () => {
    const { listen } = useSandpack();


    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'iframe_error') {
          const errorMessage = message.error || message.message;
          setErrorPresent(true);
          setErrorMessages((prevMessages) => new Set(prevMessages).add(errorMessage));

        }
      };
  
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, []);


    useEffect(() => {
      const unsubscribe = listen((message: SandpackMessage) => {
        // console.log('-----Received message:', message);

        // Handle error messages from 'action' type
        if (isErrorMessage(message)) {
          const errorMessage = message.title || message.message;
          if (errorMessage) {
            setErrorPresent(true);
            setErrorMessages((prevMessages) => new Set(prevMessages).add(errorMessage));

          }
        }

        // Handle console messages
        if (isConsoleMessage(message)) {
          const errorLogs = message.log
            .filter((logEntry) => logEntry.method === 'error')
            .map((logEntry) => logEntry.data.join(' '));

          if (errorLogs.length > 0) {
            setErrorPresent(true);
            errorLogs.forEach((errorMessage: any)=> setErrorMessages((prevMessages) => new Set(prevMessages).add(errorMessage)))

          }
        }
      });

      return () => {
        unsubscribe();
      };
    }, [listen]);

    return null;
  };
  // Type guard for error messages from 'action' messages
  function isErrorMessage(
    message: SandpackMessage
  ): message is SandpackMessage & { type: 'action'; action: 'show-error' } & SandpackErrorMessage {
    return message.type === 'action' && message.action === 'show-error';
  }

  // Type guard for console messages
  function isConsoleMessage(
    message: SandpackMessage
  ): message is SandpackMessage & {
    type: 'console';
    log: Array<{
      method: SandpackMessageConsoleMethods;
      id: string;
      data: string[];
    }>;
  } {
    return message.type === 'console' && Array.isArray(message.log);
  }



  return (
    <div className='overflow-y-hidden'>
      {/* Conditional Button */}
      {errorPresent && (
        <button
          onClick={() => setIsErrorView(!isErrorView)}
          className={`ml-auto mr-2 text-[14px] flex items-center px-2 py-1 mb-2 rounded-md transition-colors duration-200 bg-gray-800 text-white hover:bg-gray-700 sticky top-0 z-10`}
        >
          {isErrorView ? (
            <>
              <IconPresentation size={18} className="mr-2" />
              Show Preview
            </>
          ) : (
            <>
              <IconAlertCircle size={18} className="mr-2" />
              Errors Present
            </>
          )}
        </button>
      )}

      <div className='overflow-y-auto'>
      {/* Toggle Between Sandpack and Error View */}
        {isErrorView ? (
          <div style={{ color: 'red'}} >
            <div className=' text-xs  text-black dark:text-white'  style={{ lineHeight: '1.2' }}>{`
            Notice: If the error is related to file paths, it may be due to how the code blocks were split into individual files based on the first commented line (e.g., // index.js). 
            Verify that the filenames and paths are correct and properly linked within the project. Use the raw text editor to add or change commented out file names.
            
            You can also click "Open in CodeSandbox" to inspect the file structure directly in a development environment.
            `}</div>
            <div className='text-xl mt-2 '>Errors:</div>
            <ul>
            {[...Array(errorMessages)].map((errorMessage, index) => (
              <span key={index}>{errorMessage}</span>
            ))}
          </ul>
          </div>
        ) : (
          <SandpackProvider files={files} template={template} theme={lightMode}>
            <SandpackLayout>
          
              <SandpackPreview
                showOpenInCodeSandbox={true}
                showRefreshButton={true}
                style={{
                  height: `${height - (errorPresent ? 50: 0)}px`,
                  overflow: 'auto',
                  width: '100%',
                }}
              />
            </SandpackLayout>
            {/* Place ErrorListener inside SandpackProvider */}
            <ErrorListener />
          </SandpackProvider>
        )}
      </div>
    </div>
  );
};


