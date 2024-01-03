// function stripComments(code) {
//     // This regular expression matches both '//' and '/* */' comments.
//     const commentPattern = /\/\/.*|\/\*[^]*?\*\//g; // [^]*? matches any character including newline.
//
//     // Replace matches with an empty string
//     let strippedCode = code.replace(commentPattern, '');
//
//     return strippedCode;
// }
//

function convertToMarkdown(obj, prefix = "") {
    let output = "";

    if (obj.topic) {
        output += `${prefix}${obj.topic}`;

        if (obj.content) {
            output += `\n\n${obj.content}\n`;
        }

        if (obj.subtopics && obj.subtopics.length > 0) {
            obj.subtopics.forEach((subtopic, index) => {
                const subtopicPrefix = `${prefix}${index + 1}.`;
                output += `\n${convertToMarkdown(subtopic, subtopicPrefix)}`;
            });
        }
    } else if (typeof obj === "string") {
        output += `${prefix}${obj}`;
    }

    return output;
}

const balanceBrackets = (inputString) => {

    let bracketsStack = 0;
    let inString = false;
    let stringChar = '';
    let prevChar = '';
    let currChar = '';
    let stringStart = 0;

    for (let i = 0; i < inputString.length; i++) {
        prevChar = currChar;
        currChar = inputString[i];

        if (inString) {
            // Check for a closing quote, ensuring it's not escaped
            if (currChar === stringChar && prevChar !== '\\') {
                // Found the closing quote
                inString = false;
            }
        } else {
            // Check for an opening quote
            if (currChar === '"' || currChar === "'" || currChar === "`") {
                stringStart = i;
                inString = true;
                stringChar = currChar;
            } else if (currChar === '{') {
                bracketsStack += 1;
            } else if (currChar === '}') {
                bracketsStack -= 1;
            }
        }

    }

    if(bracketsStack > 0) {
        for(let i = 0; i < bracketsStack; i++) {
            inputString = inputString + "}";
        }
    }
    if(bracketsStack < 0) {
        for(let i = bracketsStack; i < 0; i++) {
            inputString = "{" + inputString;
        }
    }

    return inputString;
};








console.log(convertToMarkdown({
    "topic": "Nashville TN",
    "subtopics": [
        {
            "topic": "Overview",
            "subtopics": [
                {
                    "topic": "Geography",
                    "subtopics": [
                        "Climate",
                        "Topography"
                    ]
                },
                {
                    "topic": "Demographics",
                    "subtopics": [
                        "Population",
                        "Ethnicity",
                        "Education"
                    ]
                }
            ]
        },
        {
            "topic": "Historical Significance",
            "subtopics": [
                {
                    "topic": "Nashville's Role in the Civil War",
                    "subtopics": [
                        "Union Occupancy",
                        "Battle of Nashville"
                    ]
                },
                {
                    "topic": "Music History in Nashville",
                    "subtopics": [
                        "Birth of Country Music",
                        "Recording Industry",
                        "Famous Music Venues"
                    ]
                },
                {
                    "topic": "Notable Landmarks and Historic Sites",
                    "subtopics": [
                        "Child Topic 1",
                        "Child Topic 2"
                    ]
                }
            ]
        },
        {
            "topic": "Culture and Entertainment",
            "subtopics": [
                {
                    "topic": "Music",
                    "subtopics": [
                        "Genres",
                        "Venues"
                    ]
                },
                {
                    "topic": "Art",
                    "subtopics": [
                        "Types of Art",
                        "Art Galleries"
                    ]
                },
                {
                    "topic": "Food",
                    "subtopics": [
                        "Restaurants",
                        "Local Cuisine"
                    ]
                },
                {
                    "topic": "Festivals",
                    "subtopics": [
                        "Music Festivals",
                        "Art Festivals"
                    ]
                }
            ]
        },
        {
            "topic": "Attractions",
            "subtopics": [
                {
                    "topic": "Broadway",
                    "subtopics": [
                        "History of Broadway",
                        "Shows and Performances on Broadway"
                    ]
                },
                {
                    "topic": "Country Music Hall of Fame",
                    "subtopics": [
                        "Exhibits",
                        "Inductees"
                    ]
                }
            ]
        },
        {
            "topic": "Motivating Example",
            "subtopics": [
                {
                    "topic": "Child Topic 1",
                    "subtopics": [
                        "Subtopic 1",
                        "Subtopic 2"
                    ]
                },
                {
                    "topic": "Child Topic 2",
                    "subtopics": [
                        "Child Topic 2.1",
                        "Child Topic 2.2"
                    ]
                }
            ]
        }
    ]
}));


function findWorkflowPattern(inputString, noFix) {
    const workflowPattern = /workflow\s*=\s*async\s*\([^)]*\)\s*=>\s*{/g;

    let workflowFunction = workflowPattern.exec(inputString);
    if (workflowFunction === null) {
        console.log("Error: No 'workflow' function found.");
        return null;
    }

    let bracketsStack = 0;
    let inString = false;
    let stringChar = '';
    let prevChar = '';
    let currChar = '';
    let stringStart = 0;
    let inSingleLineComment = false;
    let inMultiLineComment = false;

    for (let i = workflowPattern.lastIndex - 1; i < inputString.length; i++) {
        prevChar = currChar;
        currChar = inputString[i];

        if (inString) {
            if (currChar === stringChar && prevChar !== '\\') {
                // Found the closing quote
                inString = false;
            }
        } else if (inSingleLineComment) {
            if (currChar === '\n') {
                // End of Single Line Comment
                inSingleLineComment = false;
            }
        } else if (inMultiLineComment) {
            if (currChar === '/' && prevChar === '*') {
                // End of multi line Comment
                inMultiLineComment = false;
            }
        } else {
            if (currChar === '/' && prevChar === '/') {
                inSingleLineComment = true;
            } else if (currChar === '*' && prevChar === '/') {
                inMultiLineComment = true;
            } else if (currChar === '"' || currChar === "'" || currChar === "`") {
                stringStart = i;
                inString = true;
                stringChar = currChar;
            } else if (currChar === '{') {
                bracketsStack += 1;
            } else if (currChar === '}') {
                bracketsStack -= 1;
                if (bracketsStack === 0) {
                    const workflowFunctionCode = "async (fnlibs) => " + inputString.slice(workflowPattern.lastIndex - 1, i + 1);
                    return workflowFunctionCode.trim();
                }
            }
        }
    }

    if (bracketsStack > 0 && !noFix) {
        for (let i = 0; i < bracketsStack; i++) {
            inputString = inputString + "}";
            let result = findWorkflowPattern(inputString, true);
            if (result != null) {
                return result;
            }
        }
    }

    console.log(`Error: No proper ending for the 'workflow' function found. [inString:${inString}, bracketsStack:${bracketsStack}, prevChar:${prevChar}]`);
    return null;
}

console.log(findWorkflowPattern("const workflow = async (fnlibs) => {\n" +
    " \n" +
    "    try {\n" +
    "        await fnlibs.tellUser(\"Starting the workflow. Extracting techniques described in the document...\");\n" +
    "\n" +
    "        // Define a JSON schema for the output generated by LLM.\n" +
    "        const desiredSchema = {\n" +
    "            \"$schema\": \"http://json-schema.org/draft-07/schema#\",\n" +
    "            \"type\": \"object\",\n" +
    "            \"properties\": {\n" +
    "                \"plans\": {\n" +
    "                    \"type\": \"string\",\n" +
    "                    \"description\": \"Step by step plan to find the results\"\n" +
    "                },\n" +
    "                \"results\": {\n" +
    "                    \"type\": \"array\",\n" +
    "                    \"items\": {\n" +
    "                        \"type\": \"object\",\n" +
    "                        \"properties\": {\n" +
    "                            \"thought\": {\n" +
    "                                \"type\": \"string\",\n" +
    "                                \"description\": \"Enter your thoughts here\"\n" +
    "                            },\n" +
    "                            \"content\": {\n" +
    "                                \"type\": \"string\",\n" +
    "                                \"description\": \"The relevant content\"\n" +
    "                            }\n" +
    "                        },\n" +
    "                        \"required\": [\"thought\", \"content\"]\n" +
    "                    }\n" +
    "                }\n" +
    "            },\n" +
    "            \"required\": [\"plans\", \"results\"]\n" +
    "        };\n" +
    "\n" +
    "        // Retrieve document content.\n" +
    "        const docContent = fnlibs.getDocument(\"ChatGPT_vs__Stack_Overflow_Performance_5pgs (4).pdf\").raw;\n" +
    "\n" +
    "        // Split the document content into chunks of 5000 characters each.\n" +
    "        const chunks = fnlibs.splitStringIntoChunks(docContent, 5000);\n" +
    "\n" +
    "        // Prepare prompts for LLM parallel processing by replacing \"FILL IN CHUNK\" with actual chunk in the prompt string.\n" +
    "        const prompts = chunks.map(chunk => `What techniques are described in this text? Be comprehensive and explain your thoughts for including each piece of content.----------------${chunk}----------------`);\n" +
    "\n" +
    "        // Generate the JSON data using promptLLMForJson in parallel.\n" +
    "        const results = await fnlibs.promptLLMInParallel(prompts.map(prompt => fnlibs.promptLLMForJson(\"\", prompt, desiredSchema)));\n" +
    "\n" +
    "        await fnlibs.tellUser(\"Processing completed. Extracted information about the techniques described in the document.\");\n" +
    "\n" +
    "        // Compile the data into an object mapped with \"type\" as table and \"data\" as the array of results.\n" +
    "        const value = { type: \"table\", data: results };\n" +
    "\n" +
    "        return value;\n" +
    "    }\n" +
    "    catch(e){\n" +
    "        throw e;\n" +
    "    }\n" +
    "};") != null);


const test = "const workflow = async ({promptLLM, tellUser, getDocuments}) => {\n" +
    "    let result = new Promise(async (resolve, reject) => {\n" +
    "        try {\n" +
    "            tellUser(\"Starting the document outlining task...\");\n" +
    "\n" +
    "            let value = {type: \"text\", data: null};\n" +
    "\n" +
    "            // Plan:\n" +
    "            // 1. Fetch the document from getDocuments function\n" +
    "            // 2. Split the document into 10000 character chunks\n" +
    "            // 3. For each chunk:\n" +
    "            //      a. Generate a persona for the task of creating an outline\n" +
    "            //      b. Instruct the LLM to create an outline of the chunk \n" +
    "            //      c. Append the resulting outlines together\n" +
    "            // 4. Once all chunks are processed, set the concatenated outlines as the result\n" +
    "\n" +
    "            let documents = await getDocuments();\n" +
    "\n" +
    "            let outlinedTexts = [];\n" +
    "            for(let doc of documents) {\n" +
    "                let chunks = chunkString(doc, 10000);\n" +
    "                for(let chunk of chunks) {\n" +
    "                    let persona = \"You are an expert annotator tasked with creating an outline of a document chunk.\";\n" +
    "                    let prompt = `Please create an outline for the following document chunk:\\n------------------\\n${chunk}\\n------------------\\nRemember to include the main points and sub-points and arrange them in a structured manner resembling an outline.`;\n" +
    "                    let outline = await promptLLM(persona, prompt);\n" +
    "                    outlinedTexts.push(outline);\n" +
    "                }\n" +
    "            }\n" +
    "\n" +
    "            value.data = outlinedTexts.join(\"\\n\");  \n" +
    "\n" +
    "            resolve(value);\n" +
    "        } catch(e) {\n" +
    "            tellUser(\"There was an error while processing the document. Trying again...\");\n" +
    "            reject(e);\n" +
    "        }\n" +
    "    });\n" +
    "    return result;\n" +
    "}\n" +
    "\n" +
    "// Helper function to break a string into specified character length chunks\n" +
    "const chunkString = (string, length) => {\n" +
    "    let chunks = [];\n" +
    "    let index = 0;\n" +
    "    while(index < string.length) {\n" +
    "        chunks.push(string.slice(index, index + length));\n" +
    "        index += length;\n" +
    "    }\n" +
    "    return chunks;\n" +
    "};";

console.log(findWorkflowPattern(test) != null);


const test2 = "const workflow = async (fnlibs) => {\n" +
    "    \n" +
    "    // Plan:\n" +
    "    // 1. Fetch documents using the provided function `getDocuments`.\n" +
    "    // 2. Check the size of the document. If it is more than 10000 characters, break it down into chunks of 10000 characters each.\n" +
    "    // 3. Iterate through each chunk and send it to the LLM with a prompt to outline the document. \n" +
    "    // 4. Ensure persona specified as 'an assistant specialized in summarizing and outlining documents'\n" +
    "    // 5. Get the shown result from the LLM and append it to the final result.\n" +
    "    // 6. After processing all chunks, format the final result as markdown and return it in required format.\n" +
    " \n" +
    "    try {\n" +
    "        // Temporarily save the outlines of the document chunks\n" +
    "        let documentOutlines = [];\n" +
    "\n" +
    "        // Inform the user what we are doing\n" +
    "        await fnlibs.tellUser(\"Starting to outline the document...\");\n" +
    "\n" +
    "        // Get the document\n" +
    "        const document = await fnlibs.getDocuments()[0];\n" +
    "\n" +
    "        // Check if we need to break down the document into chunks\n" +
    "        if(document.length > 10000) {\n" +
    "            // Split the document into chunks\n" +
    "            for(let i = 0; i < document.length; i+=10000) {\n" +
    "                // Extract the chunk\n" +
    "                let chunk = document.substring(i, i + 10000);\n" +
    " \n" +
    "                // Prompt the LLM to outline this chunk. Tell it to act as a \n" +
    "                // 'an expert assistant specialized in summarizing and outlining complex documents'.\n" +
    "                let chunkOutlined = await fnlibs.promptLLM(\n" +
    "                    'As an expert assistant specialized in summarizing and outlining complex texts, your task is to create a brief, coherent outline of the following text segment: \\n\\n ' + chunk\n" +
    "                );\n" +
    "\n" +
    "                // Save the result\n" +
    "                documentOutlines.push(chunkOutlined);\n" +
    "            }\n" +
    "        } else {\n" +
    "             // If the document is less than 10000 characters, just send the whole document to the LLM \n" +
    "            let outlinedDocument = await fnlibs.promptLLM(\n" +
    "                'As an expert assistant specialized in summarizing and outlining complex texts, your task is to create a brief, coherent outline of the following text: \\n\\n ' + document\n" +
    "            );\n" +
    "            // Save the result\n" +
    "            documentOutlines.push(outlinedDocument);\n" +
    "        }\n" +
    "\n" +
    "        // Join all outlined chunks with markdown linebreak\n" +
    "        let finalOutline = documentOutlines.join('\\n---\\n');\n" +
    "\n" +
    "        // Store the output of the task in value so it can be returned\n" +
    "        let value = {type:\"text\", data:finalOutline};\n" +
    "        \n" +
    "        return value;\n" +
    "    }\n" +
    "    catch(e){\n" +
    "        await fnlibs.tellUser(\"An error occurred: \"+ e);\n" +
    "        // Rethrow the error up the stack \n" +
    "        throw e;\n" +
    "    }\n";

console.log(findWorkflowPattern(test2) != null);

const test3 = "const workflow = async (fnlibs) => {\n" +
    "    // Initialize a promise to handle asynchronous tasks\n" +
    "    let value = new Promise((resolve) => {\n" +
    "        try {\n" +
    "            // Inform user that the workflow has started execution\n" +
    "            fnlibs.tellUser(\"Executing the generated workflow...\");\n" +
    "\n" +
    "            // Define a variable to hold the final output result\n" +
    "            let result = { type: \"text\", data: null };\n" +
    "\n" +
    "            // 1. Get the array of documents using the provided function\n" +
    "            const documents = fnlibs.getDocuments();\n" +
    "\n" +
    "            // 2. Create a empty string to store outlines of the documents\n" +
    "            let text = '';\n" +
    "\n" +
    "            // The function to split the document into 10000 character chunks and outline each chunk\n" +
    "            const processDoc = async (doc) => {\n" +
    "                // Break the document text into chunks of 10000 characters\n" +
    "                let chunks = doc.match(/.{1,10000}/g);\n" +
    "\n" +
    "                // Process each chunk in sequence\n" +
    "                for(let i=0; i<chunks.length; i++) {\n" +
    "                    // Create a persona for the Language model as a document summarizer \n" +
    "                    let persona = 'As a professional document summarizer,';\n" +
    "\n" +
    "                    // Create a prompt for the Language model to outline the chunk\n" +
    "                    let prompt = `Outline the following chunk of the document:\\n------------------\\n${chunks[i]}\\n------------------`;\n" +
    "\n" +
    "                    // Use the language model to create an outline of the chunk\n" +
    "                    let outlineChunk = await fnlibs.promptLLM(persona, prompt);\n" +
    "\n" +
    "                    // Append the outline chunk to the text\n" +
    "                    text += outlineChunk;\n" +
    "                }\n" +
    "            };\n" +
    "\n" +
    "            // Process each document in sequence\n" +
    "            for(let i=0; i<documents.length; i++) {\n" +
    "                processDoc(documents[i]);\n" +
    "            }\n" +
    "\n" +
    "            // Set the type and data of the result\n" +
    "            result.type = 'text';\n" +
    "            result.data = text;\n" +
    "\n" +
    "            // Resolve the promise with the result\n" +
    "            resolve(result);\n" +
    "        } catch (error) {\n" +
    "            // Inform user about the error and let them know the workflow is trying again\n" +
    "            fnlibs.tellUser(\"I made a mistake, trying again...\");\n" +
    "            // Reject the promise with the error\n" +
    "            reject(error);\n" +
    "        }\n" +
    "   ";

console.log(findWorkflowPattern(test3) != null);

console.log(findWorkflowPattern("const fnlibs = {\n" +
    "    promptLLM:(personaString,promptString):Promise<String>, \n" +
    "    tellUser:async (msg:string)=>Promise<void>,\n" +
    "    getDocuments:():[{name:string,raw:string},...]\n" +
    "};\n" +
    "\n" +
    "//@START_WORKFLOW\n" +
    "const workflow = async (fnlibs) => {\n" +
    "    return new Promise(async (resolve, reject) => {\n" +
    "        try {\n" +
    "            fnlibs.tellUser(\"Starting the task...\");\n" +
    "\n" +
    "            // Step-by-step plan:\n" +
    "            // 1. Fetch documents using the `getDocuments` method.\n" +
    "            // 2. For each document, instruct the LLM to read the document and divide it into chunks. \n" +
    "            //    Each chunk contains a logical part or section of the document.\n" +
    "            // 3. Once sections are identified, instruct the LLM to provide a concise outline of each section's content.\n" +
    "            // 4. Finally, all outlines are combined into a structured format for an easy-to-read representation.\n" +
    "\n" +
    "            // Fetch the documents\n" +
    "            const documents = await fnlibs.getDocuments();\n" +
    "  \n" +
    "            // Create an empty array to hold the outline for each document\n" +
    "            let outlines = [];\n" +
    "\n" +
    "            // Walk through each document\n" +
    "            for (let document of documents) {\n" +
    "                // Step 1 and 2: Divide the document into its logical parts\n" +
    "                fnlibs.tellUser(`Analyzing document: ${document.name}...`);\n" +
    "                let sectionsPrompt = `Read the following document and divide it into logical parts or sections:\\n\\n${document.raw}`;\n" +
    "                let sections = await fnlibs.promptLLM('As a document analyst', sectionsPrompt);\n" +
    "\n" +
    "                // Step 3: Provide an outline of each section's content\n" +
    "                let outlinesPrompt = `Based on the sections identified, provide a concise outline of each section's content:\\n\\n${sections}`;\n" +
    "                let outline = await fnlibs.promptLLM('As a document analyst', outlinesPrompt);\n" +
    "\n" +
    "                // Step 4: Combine all outlines into a final result\n" +
    "                outlines.push({\n" +
    "                    document: document.name,\n" +
    "                    outline: outline\n" +
    "                });\n" +
    "            }\n" +
    "\n" +
    "            // Store the output in the required format\n" +
    "            let value = {\n" +
    "                type: 'table', \n" +
    "                data: outlines\n" +
    "            };\n" +
    "\n" +
    "            resolve(value);\n" +
    "        }\n" +
    "        catch (e) {\n" +
    "            fnlibs.tellUser(\"Apologies, there was an error processing the task. Let's try again...\");\n" +
    "            reject(e);\n" +
    "        }\n" +
    "    });") != null);


const test6 = "const workflow = async (fnlibs) => {\n" +
    "    try {\n" +
    "        fnlibs.tellUser(\"Executing the generated workflow...\");\n" +
    "\n" +
    "        // Step 1: Define the JSON schema that we want the LLM to generate an instance of. \n" +
    "        // For this task, let's define a simple JSON schema for a user profile with fields - name, email, address and age.\n" +
    "\n" +
    "        let userSchema = {\n" +
    "            type: \"object\",\n" +
    "            properties: {\n" +
    "                name: { type: \"string\" },\n" +
    "                email: { type: \"string\", format: \"email\" },\n" +
    "                address: { type: \"string\" },\n" +
    "                age: { type: \"integer\", minimum: 0 }\n" +
    "            },\n" +
    "            required: [ \"name\", \"email\", \"address\", \"age\" ]\n" +
    "        };\n" +
    "\n" +
    "        // Converting the JSON schema to a string to pass it on to the promptLLMForJson function.\n" +
    "        let schemaString = JSON.stringify(userSchema);\n" +
    "\n" +
    "        // Preparing the prompt for the LLM\n" +
    "        let prompt = `Given the JSON schema '${schemaString}', generate a valid JSON object that conforms to this schema.`;\n" +
    "\n" +
    "        // Step 2: Prompt the LLM to generate an instance of the JSON schema.\n" +
    "        fnlibs.tellUser(\"Asking the LLM to generate an instance of the given JSON schema...\");\n" +
    "        let generatedJson = await fnlibs.promptLLMForJson(\"\", prompt, userSchema);\n" +
    "        \n" +
    "        // Storing the generatedJson to the value object.\n" +
    "        let value = {\n" +
    "            type: \"code\",\n" +
    "            data: JSON.stringify(generatedJson, null, 2) // using JSON.stringify with indentation for better readability\n" +
    "        };\n" +
    "\n" +
    "        // Returning the 'value' object.\n" +
    "        return value;\n" +
    "    } catch(e) {\n" +
    "        throw e;\n" +
    "    }\n" +
    "};";

console.log(findWorkflowPattern(test6) != null);



const parsePartialJson = (str) => {
    let stack = [];
    let lastChar = '';
    let inString = false;
    let inValue = false;
    let firstValChar = false;

    const checkMatchAny = () => {
        if(stack.length > 0 &&
            (stack.slice(-1)[0].missing === ':' ||
            stack.slice(-1)[0].missing === ',')){
            stack.pop();
        }
    }

    const inArray = () => {
        return stack.findLastIndex((item) => item.missing === '[')
            > stack.findLastIndex((item) => item.missing === '{');
    }

    const incrementKeys = () => {
        const obj = stack.find((item) => item.missing === '{');
        obj['keys'] = (obj['keys'] || 0) + 1;
    }

    const incrementValues = () => {
        const obj = stack.find((item) => item.missing === '{');
        obj['values'] = (obj['values'] || 0) + 1;
    }

    for(let i = 0; i < str.length; i++){
        const c = str.charAt(i);

        if(!inString && c.trim().length > 0) {
            checkMatchAny();
        }

        if(!inString && c === '{'){
            inValue = false;
            stack.push({missing:"{", index: i, keys: 0, values: 0});
        }
        else if(!inString && c === '['){
            if(inValue){
                incrementValues();
            }
            inValue = true;
            stack.push({missing:"[", index: i});
        }
        else if(!inString && c === '"'){
            if(inValue){
                incrementValues();
            }
            inString = true;
            stack.push({missing:"\"", index: i, inValue: inValue});
        }
        else if(!inString && c === ':'){
            inValue = true;
            incrementKeys();
            stack.push({missing:":", index: i});
        }
        else if(!inString && c === ','){
            inValue = inArray();
            stack.push({missing:",", index: i});
        }
        else if(!inString && c === '}'){
            inValue = false;
            stack.pop();
        }
        else if(!inString && c === ']'){
            inValue = false;
            stack.pop();
        }
        else if(inString && c === '"' && lastChar !== '\\'){
            inString = false;
            stack.pop();
        }

        lastChar = c;
    }

    return {stack,str};
}

const fixJson = ({stack, str}) => {

    while(stack.length > 0){
        const match = stack.pop();

        if(match.missing === '{'){
            if(match.keys !== match.values){
                str += ":\"\"";
            }
            str += "}";
        }
        else if(match.missing === '['){
            str += "]";
        }
        else if(match.missing === '"'){
            str += "\"";

            // if (!match.inValue) {
            //     str += ":\"\""
            // }
        }
        else if(match.missing === ':'){
            str += "\"\"";
        }
        else if(match.missing === ','){
            str = str.trim().slice(0,-1);
        }
    }

    return JSON.parse(str);
}

const parseObject = (str) => {
    str = str.trim();

    if(!str.startsWith("{")){
        throw new Exception("Objects must start with {.");
    }

    str = str.substring(1).trim();

    let obj = {};
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

const parseValue = (str) => {
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

const parseArray = (str) => {
    str = str.trim();

    if(!str.startsWith("[")){
        throw new Exception("Arrays must start with [.");
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

const parseNumber = (str) => {
    const {value, tail} = parseToken(str,c => "-0123456789.".indexOf(c) < 0);
    let ival = 0;
    try {
        ival = Number.parseFloat(str);
    }catch(e){}
    return {value: ival, tail}
}

const parseBoolean = (str) => {
    const {value, tail} = parseToken(str,(c) => " }],:".indexOf(c) > -1);
    return {value: value === 'true', tail}
}

const parseToken = (str, breaks) => {
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


const parseString = (str) => {
    let value = "";

    str = str.trim();

    if(!str.startsWith("\"")){
        throw new Exception("Strings must start with quotes.");
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

console.log(parseString("\"a b c\""))
console.log(parseString("\"a b \\\" \\\" c\""))
console.log(parseString("\"a b \\\" \\\" c\" aa"))
console.log(parseString("\"a b c"))
console.log(parseBoolean("true ,"));
console.log(parseBoolean("true ,"))
console.log(parseBoolean("true}"))
console.log(parseBoolean("tru}"))
console.log(parseBoolean("tru"))
console.log(parseBoolean("true }"))
console.log(parseBoolean("true]"))
console.log(parseBoolean("true,false }"))
console.log(parseNumber("1,"))
console.log(parseNumber("1}"))
console.log(parseNumber("12.3]"))
console.log(parseNumber("-190112.3]"))
console.log(parseValue("-12323.3,"))
console.log(parseValue("[-12323.3,3,true]"))
console.log(parseValue("[-12323.3,3,true, [\"a\",1,true, [\"a"))
console.log(parseValue("{\"args\":[-12323.3,3,{\"strip\":true, \"off\":{{\"name\":false}:1}, [\"a\",1,true, [\"a"))
// console.log(fixJson(parsePartialJson('{"name":"xyz", "age":2, "children')));
// console.log(fixJson(parsePartialJson('{"name":"xyz", "age":2, "children":[')));
// console.log(fixJson(parsePartialJson('{"name":"xyz", "age":2, "children":[{"id":1')));
// console.log(fixJson(parsePartialJson('{"name":"xyz", "age":2, "children":[{"id":1},{"name":"asdf","size":4}, ')));
// console.log(fixJson(parsePartialJson('{"name":"xyz", "age":2, "children":[{"id":1},{"name":"asdf","size": ')));
// console.log(fixJson(parsePartialJson('{"name":"xyz", "age":2, "children":[{"id":1},{"name":"asdf","')));
// console.log(fixJson(parsePartialJson('{"name":"xyz", "age":2, "children":[{"id":1},{"name":"asdf","size')));
// console.log(fixJson(parsePartialJson('{"name":"answer", "arguments":{ "problemSolvingSteps": [ { "reasoning": "Understand the task", "description": "To bake a cake, we need to understand the recipe, the ingredients we need, and the equipment necessary for baking." }, { "reasoning": "Gather materials", "description": "We will collect the required ingredients, such as flour, sugar, eggs'
// )));
// console.log(fixJson(parsePartialJson('{"name":"answer", "arguments":{ "problemSolvingSteps": [ { "reasoning": "Understand the task", "description": "To bake a cake, we need to understand the recipe, the ingredients we need, and the equipment necessary for baking." }, { "reasoning": "Gather materials", "description": "'
// )));
// console.log(fixJson(parsePartialJson('{"name":"answer", "arguments":{ "problemSolvingSteps": [ { "reasoning": "Understand the task", "description": "To bake a cake, we need to understand the recipe, the ingredients we need, and the equipment necessary for baking." }, { "reasoning": "Gather materials", "description":'
// )));
// console.log(parsePartialJson('{"name":"answer", "arguments":{ "problemSolvingSteps": [ { "reasoning": "Understand the task", "description": "To bake a cake, we need to understand the recipe, the ingredients we need, and the equipment necessary for baking." }, { "reasoning": "Gather materials", "description"'
// ));