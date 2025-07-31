interface languageMap {
    [key: string]: string | undefined;
  }
  
type MimeTypeMapping = {
    [mimeType: string]: string;
};


export const getFileTypeFromExtension = (extension: string): string => {
    // Remove leading dot if present
    const ext = extension.startsWith('.') ? extension.substring(1) : extension;
    return fileExtensionToType[ext.toLowerCase()] || 'Unknown File Type';
  };
  

export const getExtensionFromFilename = (filename: string): string => {
const parts = filename.split('.');
return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
};

export const getFileMimeTypeFromLanguage = (language: string): string => {
    return programmingLanguages[language.toLowerCase()] || 'text/plain'; 
  };


export const getFileExtensionFromLanguage = (language: string): string => {
return programmingLanguages[language.toLowerCase()] || '.txt'; // Default to .txt if language is not found
};


export const fileExtensionToType: { [key: string]: string } = {
    // Text and documents
    'txt': 'Text File',
    'md': 'Markdown',
    'doc': 'Word Document',
    'docx': 'Word Document',
    'rtf': 'Rich Text Format',
    'odt': 'OpenDocument Text',
    'pdf': 'PDF Document',
    
    // Spreadsheets
    'xls': 'Excel Spreadsheet',
    'xlsx': 'Excel Spreadsheet',
    'csv': 'CSV File',
    'ods': 'OpenDocument Spreadsheet',
    
    // Presentations
    'ppt': 'PowerPoint Presentation',
    'pptx': 'PowerPoint Presentation',
    'odp': 'OpenDocument Presentation',
    
    // Images
    'jpg': 'JPEG Image',
    'jpeg': 'JPEG Image',
    'png': 'PNG Image',
    'gif': 'GIF Image',
    'svg': 'SVG Image',
    'webp': 'WebP Image',
    'bmp': 'Bitmap Image',
    'tiff': 'TIFF Image',
    
    // Archives
    'zip': 'ZIP Archive',
    'rar': 'RAR Archive',
    'tar': 'TAR Archive',
    'gz': 'GZIP Archive',
    '7z': '7Z Archive',
    
    // Code files (using existing programming languages)
    'js': 'JavaScript',
    'py': 'Python',
    'java': 'Java',
    'c': 'C',
    'cpp': 'C++',
    'cs': 'C#',
    'ts': 'TypeScript',
    'html': 'HTML',
    'css': 'CSS',
    'json': 'JSON',
    'xml': 'XML',
    
    // Other common formats
    'mp3': 'MP3 Audio',
    'mp4': 'MP4 Video',
    'wav': 'WAV Audio',
    'mov': 'MOV Video',
    'avi': 'AVI Video',
    'epub': 'EPUB Book',
    'sql': 'SQL File'
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
  

export const mimeTypeToCommonName: MimeTypeMapping = {
    "text/vtt": "Voice Transcript",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
    "application/vnd.ms-excel": "Excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
    "application/vnd.ms-powerpoint": "PowerPoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "application/msword": "Word",
    "text/plain": "Text",
    "application/pdf": "PDF",
    "application/rtf": "Rich Text Format",
    "application/vnd.oasis.opendocument.text": "OpenDocument Text",
    "application/vnd.oasis.opendocument.spreadsheet": "OpenDocument Spreadsheet",
    "application/vnd.oasis.opendocument.presentation": "OpenDocument Presentation",
    "text/csv": "CSV",
    "application/vnd.google-apps.document": "Google Docs",
    "application/vnd.google-apps.spreadsheet": "Google Sheets",
    "application/vnd.google-apps.presentation": "Google Slides",
    "text/html": "HTML",
    "application/xhtml+xml": "XHTML",
    "application/xml": "XML",
    "application/json": "JSON",
    "application/x-latex": "LaTeX",
    "application/vnd.ms-project": "Microsoft Project",
    "text/markdown": "Markdown",
    "application/vnd.ms-outlook": "Outlook Email",
    "application/x-tex": "TeX",
    "text/x-vcard": "vCard",
    "application/x-vnd.ls-xpix": "Lotus Spreadsheet",
    "application/vnd.visio": "Visio",
    "application/x-mspublisher": "Publisher",
    "text/tab-separated-values": "Tab Separated Values",
    "application/x-mswrite": "Write",
    "application/vnd.ms-works": "Microsoft Works",
    "application/vnd.google-apps.folder": "Google Drive Folder",
    "application/vnd.google.colaboratory": "Google Colab",
    "application/vnd.google.colab": "Google Colab",
    'application/vnd.google-apps.drawing' : "Google Drawings",
    'application/vnd.google-apps.jam' : "Google Jamboard",
    'application/vnd.google-apps.form' : "Google Forms",
    'application/vnd.google-apps.script' : "Google Apps Script",
    'application/vnd.google-apps.site' : "Google Sites",
    'application/vnd.google-apps.fusiontable' : "Google Fusion Tables",
    'application/vnd.google-apps.map' : "Google My Maps",
    'application/vnd.google-apps.drive-sdk' : "Google Drive SDK",
};

// Programmatically create the inverse mapping
export const commonNameToMimeTypes: { [commonName: string]: string[] } = (() => {
    const inverse: { [commonName: string]: string[] } = {};
    
    Object.entries(mimeTypeToCommonName).forEach(([mimeType, commonName]) => {
        if (!inverse[commonName]) {
            inverse[commonName] = [];
        }
        inverse[commonName].push(mimeType);
    });
    
    return inverse;
})();

// Helper function to get the first (primary) mime type for a common name
export const getFirstMimeTypeFromCommonName = (commonName: string): string | null => {
    const mimeTypes = commonNameToMimeTypes[commonName];
    return mimeTypes && mimeTypes.length > 0 ? mimeTypes[0] : null;
};

// Helper function to get all mime types for a common name
export const getAllMimeTypesFromCommonName = (commonName: string): string[] => {
    return commonNameToMimeTypes[commonName] || [];
};
