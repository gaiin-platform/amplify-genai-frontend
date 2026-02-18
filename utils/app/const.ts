export const DEFAULT_SYSTEM_PROMPT =
  // "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown. You can use mermaid code blocks using mermaid.js syntax to draw diagrams. " +
    "Follow the user's instructions carefully. Respond using markdown. If you are asked to draw a diagram, you can use Mermaid diagrams using mermaid.js syntax in a ```mermaid code block. If you are asked to visualize something, you can use a ```vega code block with Vega-lite. Don't draw a diagram or visualize anything unless explicitly asked to do so. Be concise in your responses unless told otherwise.";
    // "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown. You can use mermaid code blocks using mermaid.js syntax to draw diagrams. You can draw visualizations in ```vega code blocks with VegaLite and include mark: { ...tooltip: true } in the spec. Whenever I ask you to create an email, also add a mailto link under it with:\n\n[Send Email](mailto:[email-address]?[subject]=[subject-text]&[body]=[body-text])",
export const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || '';

export const COMMON_DISALLOWED_FILE_EXTENSIONS = [
    "mp3","wav","mp4","mov","avi","mkv",
    "rar","7z","tar","gz","tgz","bz2","xz",
    "mkv","tif","tiff","bmp","eps","ps","ai",
    "psd","heic","heif","ico","ps",
];
export const IMAGE_FILE_EXTENSIONS = ["jpg","png", "gif", "jpeg", "webp"];

export const IMAGE_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export const DEFAULT_TEMPERATURE = 1;

