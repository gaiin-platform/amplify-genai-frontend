interface languageMap {
  [key: string]: string | undefined;
}

export interface CodeBlockDetails {
   language: string,
   filename: string,
   extension: string,
   code: string
}


// Function to separate code blocks and text content from a markdown string
export const extractCodeBlocksAndText = (content: string) => {
  const parts = content.split(/```(\w+)?/);
  const codeBlocks: CodeBlockDetails[] = [];

  let numTextBlock = 1;
  for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
          // This is normal text content
          if (parts[i].trim()) { // Check if parts[i] is not undefined
              const txt = '.txt';
              codeBlocks.push({
                language : txt.slice(1),
                filename : `text_${numTextBlock}${txt}`,
                extension : txt,
                code: parts[i] //.trim()
            });
            numTextBlock++;
          }
      } else {
          // This is a code block
          if (parts[i] && parts[i + 1]) { // Ensure both parts[i] and parts[i + 1] exist
              const language = parts[i].trim().toLowerCase();
              const extension = getFileExtensionFromLanguage(language);
              const codeContent = parts[i + 1].trim();
              let filename = '';

              const lines = codeContent.split('\n');
              const firstLine = lines[0].trim();
              const pattern = new RegExp(`[^\\s]+${extension.replace('.', '\\.')}(?=[\\s]*[\\*/]*|$)`);
  
              const matchResult = firstLine.match(pattern);
              if (matchResult)  filename = matchResult[0];

              i++; // Skip the next part as we've already processed it

              codeBlocks.push({
                  language,
                  filename,
                  extension,
                  code: codeContent
              });
          }
      }
  }

  return codeBlocks ;
};




export const getFileExtensionFromLanguage = (language: string): string => {
  return programmingLanguages[language.toLowerCase()] || '.txt'; // Default to .txt if language is not found
};


 export const programmingLanguages: languageMap = {
  javascript: '.js',
  python: '.py',
  java: '.java',
  c: '.c',
  cpp: '.cpp',
  'c++': '.cpp',
  'c#': '.cs',
  ruby: '.rb',
  php: '.php',
  swift: '.swift',
  'objective-c': '.m',
  kotlin: '.kt',
  typescript: '.ts',
  go: '.go',
  perl: '.pl',
  rust: '.rs',
  scala: '.scala',
  haskell: '.hs',
  lua: '.lua',
  shell: '.sh',
  sql: '.sql',
  html: '.html',
  css: '.css',
  json: '.json', 
  yaml: '.yaml', 
  markdown: '.md', 
  plaintext: '.txt', // Added
  xml: '.xml', // add more file extensions here, make sure the key is same as language prop in CodeBlock.tsx component
};


export const getFileMimeTypeFromLanguage = (language: string): string => {
  return programmingLanguages[language.toLowerCase()] || 'text/plain'; 
};

export const programmingLanguagesMimeTypes: { [key: string]: string } = {
  javascript: 'text/javascript',
  python: 'text/x-python',
  java: 'text/x-java-source',
  c: 'text/x-csrc',
  cpp: 'text/x-c++src',
  'c++': 'text/x-c++src',
  'c#': 'text/x-csharp',
  ruby: 'text/x-ruby',
  php: 'application/x-httpd-php',
  swift: 'text/x-swift',
  'objective-c': 'text/x-objectivec',
  kotlin: 'text/x-kotlin',
  typescript: 'text/typescript',
  go: 'text/x-go',
  perl: 'text/x-perl',
  rust: 'text/x-rustsrc',
  scala: 'text/x-scala',
  haskell: 'text/x-haskell',
  lua: 'text/x-lua',
  shell: 'application/x-sh',
  sql: 'application/x-sql',
  html: 'text/html',
  css: 'text/css',
  json: 'application/json', 
  yaml: 'text/yaml', 
  markdown: 'text/markdown', 
  plaintext: 'text/plain',
  xml: 'application/xml', // or 'text/xml' for textual XML data
  // Add more MIME types here as needed
};

export const generateRandomString = (length: number, lowercase = false) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXY3456789'; // excluding similar looking characters like Z, 2, I, 1, O, 0
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return lowercase ? result.toLowerCase() : result;
};

