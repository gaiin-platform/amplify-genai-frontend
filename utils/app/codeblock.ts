import { getFileExtensionFromLanguage } from "./fileTypeTranslations";

export interface CodeBlockDetails {
   language: string,
   filename: string,
   extension: string,
   code: string
}


// True when the whole text is a plain HTML document (no markdown, no code fences).
const isPlainHtmlDocument = (content: string) =>
  !content.includes('```') && /^\s*(<!doctype\s+html|<html[\s>])/i.test(content);

// The page a vanilla/static preview should open: a block already named index.html,
// otherwise the first html block (the same convention the artifact editor uses).
export const findEntryHtml = (blocks: CodeBlockDetails[]): CodeBlockDetails | undefined =>
  blocks.find((block) => block.language === 'html' && block.filename === 'index.html') ??
  blocks.find((block) => block.language === 'html');

// Function to separate code blocks and text content from a markdown string
export const extractCodeBlocksAndText = (content: string) => {
  // A web page written as plain HTML, with no code fences, is one html file rather than text.
  if (isPlainHtmlDocument(content)) {
    return [{
      language: 'html',
      filename: 'index.html',
      extension: getFileExtensionFromLanguage('html'),
      code: content.trim()
    }] as CodeBlockDetails[];
  }
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



export const generateRandomString = (length: number, lowercase = false) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXY3456789'; // excluding similar looking characters like Z, 2, I, 1, O, 0
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return lowercase ? result.toLowerCase() : result;
};

