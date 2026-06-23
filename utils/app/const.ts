export const DEFAULT_SYSTEM_PROMPT =
    "You are a helpful, knowledgeable assistant. Follow the user's instructions carefully and precisely. " +
    "Always respond in well-structured markdown unless the user requests plain text. " +
    "Be concise and direct by default — avoid unnecessary preamble, repetition, or filler phrases" +
    "When the user asks you to draw a diagram, use Mermaid syntax inside a ```mermaid code block. " +
    "When the user asks you to visualize data, use Vega-Lite syntax inside a ```vega code block. " +
    "Never produce diagrams or visualizations unless explicitly asked. " +
    "If a task is ambiguous, ask a single clarifying question rather than making assumptions. " +
    "If you are unsure about something, say so clearly rather than guessing.";
// "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown. You can use mermaid code blocks using mermaid.js syntax to draw diagrams. You can draw visualizations in ```vega code blocks with VegaLite and include mark: { ...tooltip: true } in the spec. Whenever I ask you to create an email, also add a mailto link under it with:\n\n[Send Email](mailto:[email-address]?[subject]=[subject-text]&[body]=[body-text])",
export const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || '';

export const COMMON_DISALLOWED_FILE_EXTENSIONS = [
    "mp3", "wav",
    "rar", "7z", "tar", "gz", "tgz", "bz2", "xz",
    "mkv", "tif", "tiff", "bmp", "eps", "ps", "ai", ".stl",
    "psd", "heic", "heif", "ico", "ps", "rdata", "rds", "stan", ".mpo"
];
export const IMAGE_FILE_EXTENSIONS = ["jpg", "png", "gif", "jpeg", "webp"];
export const VIDEO_FILE_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "webm"];

export const IMAGE_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const VIDEO_FILE_TYPES = ["video/mp4", "video/mov", "video/avi", "video/mkv", "video/webm"];
export const DEFAULT_TEMPERATURE = 1;

