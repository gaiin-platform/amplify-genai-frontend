
export function extractSection(code: string, startMarker: string, endMarker: string) {
    // Escape any special regex characters in the markers
    startMarker = startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    endMarker = endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create a RegExp to match code between startMarker and endMarker
    var sectionRegExp = new RegExp(startMarker + "([\\s\\S]*?)" + endMarker);

    // Find the match in the provided code string
    var match = sectionRegExp.exec(code);

    // Return the code block between startMarker and endMarker if found, else null
    return match ? match[1].trim() : null;
}

export function extractFirstCodeBlock(markdown: string) {
    // Create a RegExp to match JavaScript codeblocks in Markdown
    var codeBlockRegExp = /```javascript([\s\S]*?)```/;

    // Find the match in the provided code string
    var match = codeBlockRegExp.exec(markdown);

    // Return the first code block if found, else null
    return match ? match[1].trim() : null;
}

export const extractJsonObjects = (text: string) => {

    let jsonObjects = [];
    let buffer = "";
    let stack = [];
    let insideString = false;
    let insideObject = false;

    for (let char of text) {
        if (char === '"' && (stack.length === 0 || stack[stack.length - 1] !== '\\')) {
            insideString = !insideString;
            buffer += char;
        } else if (insideString) {
            buffer += char;
        } else if (char === '{' || char === '[') {
            stack.push(char);
            buffer += char;
        } else if (char === '}' || char === ']') {
            if (stack.length === 0) continue;
            let openingChar = stack.pop();
            buffer += char;
            if ((openingChar === '{' && char === '}') || (openingChar === '[' && char === ']') && stack.length === 0) {
                try {
                    console.log("Attempting to parse:", buffer);
                    let jsonObj = JSON.parse(buffer);
                    jsonObjects.push(jsonObj);
                } catch (error) {
                    // failed to parse json
                    console.log(error);
                }
                buffer = "";
            } else {
                continue;
            }
        } else if (stack.length > 0) {
            buffer += char;
        }
    }

    while (jsonObjects.length === 1) {
        jsonObjects = jsonObjects.pop();
    }

    return jsonObjects;
}

function addLineNumbers(str: string) {
    var lines = str.split('\n');

    for (var i = 0; i < lines.length; i++) {
        lines[i] = (i + 1) + '. ' + lines[i];
    }

    return lines.join('\n');
}


export const promptForJsonPrefix = (obj: any, id: string) => {
    const jsonSchema = describeAsJsonSchema(obj, id);
    const jsonSchemaString = JSON.stringify(jsonSchema, null, 2);
    return `json!(${jsonSchemaString})\n`;
}

export const parsePartialJson = (str:string) => {
    const {value} = parseValue(str);
    return value;
}

const parseObject = (str:string) => {
    str = str.trim();

    if(!str.startsWith("{")){
        throw "Objects must start with {.";
    }

    str = str.substring(1).trim();

    let obj:any = {};
    let newTail = str;

    while(newTail && !newTail.startsWith("}")){
        let {value:key, tail:keyTail} = parseValue(newTail);
        if(!keyTail){
            return {value: obj, tail: null};
        }
        if(keyTail && keyTail.trim().length > 0){
            keyTail = keyTail.trim();
            if(keyTail.startsWith("}")){
                return {value: obj, tail: keyTail.substring(1)};
            }
            else if(keyTail.startsWith(":")){
                keyTail = keyTail.substring(1);
            }
            else if(keyTail.trim().length === 0) {
                return {value: obj, tail: keyTail};
            }

            keyTail = keyTail.trim();

            let {value, tail} = parseValue(keyTail);

            obj[key] = value;

            if(tail && tail.trim().startsWith(",")){
                tail = tail.trim().substring(1);
            }
            if(!tail || tail.trim().length === 0){
                return {value: obj, tail: tail};
            }

            newTail = tail.trim();
        }
    }

    if(newTail && newTail.trim().startsWith("}")){
        newTail = newTail.trim().substring(1);
    }

    return {value: obj, tail: newTail};
}

const parseValue = (str:string):any => {
    str = str.trim();
    if(str.startsWith("[")){
        return parseArray(str);
    }
    else if(str.startsWith("{")){
        return parseObject(str);
    }
    else if(str.startsWith("\"")){
        return parseString(str);
    }
    else if(str.startsWith("f") || str.startsWith("t")){
        return parseBoolean(str);
    }
    else {
        return parseNumber(str);
    }
}

const parseArray = (str:string):any => {
    str = str.trim();

    if(!str.startsWith("[")){
        throw "Arrays must start with [.";
    }

    let newTail = str.slice(1).trim();
    const arr = [];
    while(!newTail.startsWith("]")){
        if(newTail.startsWith(",")){
            newTail = newTail.substring(1);
        }
        if(!newTail.startsWith("]")) {
            const {value, tail} = parseValue(newTail);
            arr.push(value);

            if (!tail || tail.trim().length === 0) {
                return {value: arr, tail: null};
            }

            newTail = tail.trim();
        } else{
            return {value: arr, tail: newTail.substring(1).trim()};
        }
    }

    return {value: arr, tail: newTail.substring(1)};
}

const parseNumber = (str:string) => {
    const {value, tail} = parseToken(str,c => "-0123456789.".indexOf(c) < 0);
    let ival = 0;
    try {
        ival = Number.parseFloat(str);
    }catch(e){}
    return {value: ival, tail}
}

const parseBoolean = (str:string) => {
    const {value, tail} = parseToken(str,(c) => " }],:".indexOf(c) > -1);
    return {value: value === 'true', tail}
}

const parseToken = (str:string, breaks:(s:string)=>boolean) => {
    let value = '';
    let index = 0;
    for(let i = 0; i < str.length; i++){
        index = i;
        const c = str.charAt(i);
        if(breaks(c)){
            return {value: value, tail: str.substr(index)};
        }
        value += c;
    }
    return {value: value, tail: null};
}


const parseString = (str:string) => {
    let value = "";

    str = str.trim();

    if(!str.startsWith("\"")){
        throw "Strings must start with quotes.";
    }

    str = str.slice(1);

    let lastChar = null;
    let index = 0;

    for(let i = 0; i < str.length; i++){
        index = i;
        const c = str.charAt(i);
        if(c === '"' && lastChar !== '\\'){
            break;
        }
        else {
            value += c;
            lastChar = c;
        }
    }

    return {value: value, tail: str.slice(index + 1)};
}

// @ts-ignore
export const describeAsJsonSchema = (obj:any, id = 'root') => {

    try {
        // Case: null
        if (obj === null) {
            return {type: 'null'};
        }

        // Case: undefined
        if (typeof obj === 'undefined') {
            return {type: 'undefined'};
        }

        // Case: Date
        if (obj instanceof Date) {
            return {type: 'string', format: 'date-time'};
        }

        // Case: Blob
        // Please note, Blob is mainly used in browsers and might not available in all environments
        if (typeof Blob !== 'undefined' && obj instanceof Blob) {
            return {type: 'string', format: 'data-url'};
        }

        switch (typeof obj) {
            // Case: string, number, boolean
            case 'string':
            case 'number':
            case 'boolean':
                return {
                    type: typeof obj,
                };
            // Case: object
            case 'object':
                // Array handling
                if (Array.isArray(obj)) {
                    // @ts-ignore
                    const items = obj.length > 0 ? describeAsJsonSchema(obj[0]) : {};
                    return {type: 'array', items};
                }
                // Object Handling
                else {
                    // @ts-ignore
                    const properties:any = Object.fromEntries(
                        Object.entries(obj).map(([propertyName, value]) => [
                            propertyName,
                            describeAsJsonSchema(value),
                        ])
                    );
                    return {type: 'object', properties};
                }
            // Case: other data types
            default:
                return {};
        }
    }catch(e){
        return {};
    }
}


export const transformPayload = {
    encode: (data: any): string => {
        const str = JSON.stringify(data);
        return Buffer.from(str).toString('base64');
    },
    
    decode: (encoded: string): any => {
        const str = Buffer.from(encoded, 'base64').toString();
        return JSON.parse(str);
    }
};


export const capitalize = (label: string) => {
    return label.charAt(0).toUpperCase() + label.slice(1);
  }


export function camelCaseToTitle(camelCaseString: string) {
    return camelCaseString.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

// Format snake_case tool name to Title Case With Spaces
export const snakeCaseToTitleCase = (toolName: string): string => {
    if (!toolName) return '';
    return toolName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };


export function stringToColor(str:string) {
    // Array of the color options provided
    const colors = [
        "#fbfbfb", // snowman
        "#979197", // gandalf
        "#f69833", // orange
        "#419bf9", // cornflower-blue
        "#f7f7f7", // whitey
        // "#554d56", // teflon
        "#ee6723", // peach
        "#fecf33", // yellow
        "#c8cf2d", // green
        "#0dcfda", // turquoise
        "#edeced", // karl
        "#c1bec1", // clooney
        "#fdbd39", // light-orange
    ];

    // Hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash); // Ensure hash is positive

    // Use the hashed value to select a color
    const index = hash % colors.length; // Modulus operation to get a valid array index
    return colors[index];
}



// URL validation and sanitization
const sanitizeUrl = (inputUrl: string): string => {
    let cleanUrl = inputUrl.trim();
    
    // Remove common prefixes people might accidentally include
    cleanUrl = cleanUrl.replace(/^(url:|link:|website:)/i, '');
    cleanUrl = cleanUrl.trim();
    
    // If no protocol is specified, assume https://
    if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = 'https://' + cleanUrl;
    }
    
    return cleanUrl;
};


export const validateUrl = (inputUrl: string, isSitemap: boolean): { isValid: boolean; error?: string; sanitizedUrl?: string; warning?: string } => {
    if (!inputUrl.trim()) {
        return { isValid: false, error: 'URL is required' };
    }

    const sanitizedUrl = sanitizeUrl(inputUrl);
    
    try {
        const urlObj = new URL(sanitizedUrl);
        
        // Check for valid protocols
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return { isValid: false, error: 'URL must use http:// or https://' };
        }
        
        // Check for valid hostname
        if (!urlObj.hostname || urlObj.hostname.length === 0) {
            return { isValid: false, error: 'URL must have a valid domain name' };
        }
        
        // Check for spaces in hostname (invalid)
        if (urlObj.hostname.includes(' ')) {
            return { isValid: false, error: 'Domain name cannot contain spaces' };
        }
        
        const hostname = urlObj.hostname.toLowerCase();
        
        // Allow localhost
        if (hostname === 'localhost') {
            return { isValid: true, sanitizedUrl };
        }
        
        // Allow IP addresses (IPv4)
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipv4Regex.test(hostname)) {
            // Validate IP address ranges (0-255)
            const parts = hostname.split('.');
            for (const part of parts) {
                const num = parseInt(part);
                if (num < 0 || num > 255) {
                    return { isValid: false, error: 'Invalid IP address' };
                }
            }
            return { isValid: true, sanitizedUrl };
        }
        
        // For regular domains, require proper structure
        if (!hostname.includes('.')) {
            return { isValid: false, error: 'Domain must have a top-level domain (e.g., .com, .org)' };
        }
        
        const domainParts = hostname.split('.');
        
        // Check that no part is empty (handles cases like example..com)
        if (domainParts.some(part => part.length === 0)) {
            return { isValid: false, error: 'Invalid domain format' };
        }
        
        // Check TLD (last part) is valid
        const tld = domainParts[domainParts.length - 1];
        if (tld.length < 2 || !/^[a-z]+$/i.test(tld)) {
            return { isValid: false, error: 'Invalid top-level domain (must be at least 2 letters)' };
        }
        
        // Check domain name parts contain only valid characters
        const domainRegex = /^[a-z0-9-]+$/i;
        for (let i = 0; i < domainParts.length - 1; i++) {
            const part = domainParts[i];
            if (!domainRegex.test(part) || part.startsWith('-') || part.endsWith('-')) {
                return { isValid: false, error: 'Domain contains invalid characters' };
            }
        }
        
        // Sitemap-specific validation
        if (isSitemap) {
            const path = urlObj.pathname.toLowerCase();
            const urlLower = sanitizedUrl.toLowerCase();
            
            // Common sitemap patterns
            const sitemapPatterns = [
                /\/sitemap\.xml$/,
                /\/sitemap_index\.xml$/,
                /\/sitemap-index\.xml$/,
                /\/sitemaps\/.*\.xml$/,
                /\/sitemap\/.*\.xml$/,
                /\/sitemap.*\.xml$/,
                /\/.*sitemap.*\.xml$/,
                /robots\.txt$/
            ];
            
            const hasValidPattern = sitemapPatterns.some(pattern => pattern.test(path));
            const isXmlFile = path.endsWith('.xml');
            const containsSitemap = urlLower.includes('sitemap');
            const isRobotsTxt = path.includes('robots.txt');
            
            // If none of the common patterns match, show warning
            if (!hasValidPattern && !isXmlFile && !containsSitemap && !isRobotsTxt) {
                return { 
                    isValid: true, 
                    sanitizedUrl,
                    warning: 'This URL doesn\'t look like a typical sitemap. Sitemaps usually end with .xml or contain "sitemap" in the path.'
                };
            }
        }
        
        return { isValid: true, sanitizedUrl };
        
    } catch (error) {
        return { isValid: false, error: 'Please enter a valid URL (e.g., https://example.com)' };
    }

};

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

