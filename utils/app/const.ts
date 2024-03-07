export const DEFAULT_SYSTEM_PROMPT =
  process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT ||
  // "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown. You can use mermaid code blocks using mermaid.js syntax to draw diagrams. " +
    "Follow the user's instructions carefully. Respond using markdown. If you are asked to draw a diagram, you can use Mermaid diagrams using mermaid.js syntax in a ```mermaid code block. If you are asked to visualize something, you can use a ```vega code block with Vega-lite. Don't draw a diagram or visualize anything unless explicitly asked to do so. Be concise in your responses unless told otherwise.";

export const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || '';

export const COMMON_DISALLOWED_FILE_EXTENSIONS = [
    "jpg","png","gif",
    "mp3","wav","mp4","mov","avi","mkv",
    "rar","7z","tar","gz","tgz","bz2","xz",
    "jpeg","mkv","tif","tiff","bmp","eps","ps","ai",
    "psd","heic","heif","webp","ico","ps",
];


export const OPENAI_API_HOST =
  process.env.OPENAI_API_HOST || 'https://api.openai.com';

export const AZURE_API_NAME =
    process.env.AZURE_API_NAME || 'openai';

export const DEFAULT_TEMPERATURE = 
  parseFloat(process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE || "1");

export const OPENAI_API_TYPE =
  process.env.OPENAI_API_TYPE || 'openai';

export const AVAILABLE_MODELS =
    process.env.AVAILABLE_MODELS || '';

export const OPENAI_API_VERSION =
  process.env.OPENAI_API_VERSION || '2023-03-15-preview';

export const OPENAI_ORGANIZATION =
  process.env.OPENAI_ORGANIZATION || '';

export const AZURE_DEPLOYMENT_ID =
  process.env.AZURE_DEPLOYMENT_ID || '';
