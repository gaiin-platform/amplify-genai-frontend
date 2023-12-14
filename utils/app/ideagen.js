
const workflow = async (fnlibs) => {

    try {
        fnlibs.tellUser("Generating prompt template idea...");


        let promptIdeaSystemPromptV1 = `
These are the bounds that we are going to place on how we use ChatGPT in the workplace: We are going to use the following framework in exploring how to use Generative AI to aid people: 1. Better decision making by having the LLM give them multiple possible approaches to solving a problem, multiple potential interpretations of data, identifying assumptions in their decisions and helping them evaluate the validity of those assumptions, often by challenging them. 2. Coming up with innovative ideas by serving as a brainstorming partner that offers lots of different and diverse options for any task. 3. Simultaneously applying multiple structured approaches to representing and solving problems. 4. Allowing people to iterate faster and spend more time exploring possibilities by creating initial drafts that are good starting points. 5. Aiding in summarization, drafting of plans, identification of supporting quotations or evidence, identification of assumptions, in 3-5 pages of text. Provide one approach to using ChatGPT to perform the following and one specific prompt that would be used for this. Make sure and include placeholders like <INSERT TEXT> (insert actual newlines) if the prompt relies on outside information, etc. If the prompt relies on a lot of information (e.g., more than a sentence or two), separate it like this:
----------------
<INSERT TEXT>
----------------
Be thoughtful and detailed in creating a really useful prompt that can be reused and are very detailed.

Output the prompt in a \`\`\`template code block.
`;

        const extractPromptTemplate = (prompt) => {
            let pattern = /```template\s*\n([\s\S]*?)```/g;
            let matches = pattern.exec(prompt);
            if(matches) {
                return matches[1];
            } else {
                return null;
            }
        };

        const generatePromptIdea = async ( task) => {
            const system = `
        These are the bounds that we are going to place on how we use ChatGPT in the workplace: 
        We are going to use the following framework in exploring how to use Generative AI to aid people: 
        1. Better decision making by allowing the LLM to present multiple potential approaches to solving a problem, 
        along with possible interpretations of data, identifying assumptions in decisions, and assisting in 
        evaluating the validity of those assumptions.
        2. Stimulating the generation of innovative ideas by serving as a brainstorming partner that provides a plethora 
        of different and unique options for any given task.
        3. Applying multiple structured approaches simultaneously to represent and solve problems.
        4. Helping individuals iterate faster and dedicate more time to exploring possibilities by producing 
        initial drafts that serve as good starting points.
        5. Assisting in summarizing, planning, identifying supporting quotations or evidence, and recognizing assumptions 
        in 3-5 pages of text. Suggest a single method for using ChatGPT to perform the following, along with a specific prompt that can be used for this. 
        ...

        Output the prompt in a \`\`\`template code block.
    `;

            const user = `The task is: ${task}

\`\`\`template

\`\`\``;

            return await fnlibs.promptLLM( system, user);
        };

        const assignRolesToPromptInputs = async ( prompt) => {
            const system = `
        The prompt template below contains <PLACEHOLDERS>. 
        The user provides some information and the LLM infers other information from what the user provided.
        We want the LLM to infer as much information as possible. We want the user to provide at most 2-4 pieces of information.
        ...

        Output the updated content in a \`\`\`template code block.
    `;

            const user = `The prompt template is: 

\`\`\`template
${prompt}
\`\`\`
   
The updated prompt template is: 
\`\`\`template

\`\`\`
`;

            return await fnlibs.promptLLM( system, user);
        };


        const describePrompt = async ( prompt) => {
            const system = `
You will be provided a prompt template for a prompt to be sent to an LLM. The information that the user provides is denoted with <USER: PLACEHOLDER>.
What the LLM will infer and output is denoted with <LLM: PLACEHOLDER>. In 2-3 sentences, describe what the user will
provide and what the LLM will infer and output. The output of the LLM should always be described as a "draft" that 
should be double checked by the user and serve as a starting point for the user to iterate on.
`;

            const user = `The prompt template is: 
\`\`\`template
${prompt}
\`\`\`

The 2-3 sentences describing it are:

`;

            return await fnlibs.promptLLM( system, user);
        };

        const namePrompt = async ( description) => {
            const system = `
Based on the provided description, provide a 3-7 word title for the item.
`;

            const user = `The description is: 
\`\`\`template
${description}
\`\`\`

The 3-7 word title describing it in a \`\`\`template code block are:
\`\`\`template
`;

            let name = await fnlibs.promptLLM( system, user);

            if (name.includes("```template")) {
                name = extractPromptTemplate(name);
            }

            return name;
        };

        const tagPrompt = async ( description) => {
            const system = `
Based on the provided description, provide a 3-5 tags for the item as a comma-separated list.
`;

            const user = `The description is: 
\`\`\`template
${description}
\`\`\`

The 3-5 tags in a \`\`\`template code block are:
\`\`\`template
`;

            let tags = await fnlibs.promptLLM( system, user);
            tags = extractPromptTemplate(tags);
            tags = tags.split(",");
            return tags.map(tag => tag.trim());
        };

        function templatizeUserTags(text) {
            const pattern = /<USER:\s*([^>]*)>/gi;
            return text.replace(pattern, (match, p1) => `{{${p1.trim()}}}`);
        }

        const generateIdea = async ( task) => {
            try {
                console.log(`Generating idea for: ${task}`);

                let result = await generatePromptIdea( task);
                result = extractPromptTemplate(result);
                result = await assignRolesToPromptInputs( result);
                result = extractPromptTemplate(result);
                const templatized = templatizeUserTags(result);
                const description = await describePrompt( result);
                const name = await namePrompt( description);
                const tags = await tagPrompt( description);

                const debug = false;
                if (debug) {
                    console.log("================ Name ==============");
                    console.log(name);

                    console.log("================ Tags ==============");
                    console.log(tags);

                    console.log("================ Description ==============");
                    console.log(description);

                    console.log("================ Prompt Template ==============");
                    console.log(templatizeUserTags(result));
                }

                console.log(`Idea generated for: ${task}`);

                return {
                    name: name,
                    tags: tags,
                    description: description,
                    prompt: templatized
                };
            } catch (e) {
                console.log(`An error occurred while generating an idea: ${e}`);
                console.log("Trying again...");
                return await generateIdea( task);
            }
        };

        const generate10Ideas = async ( task) => {
            try {
                let result = await fnlibs.promptLLM( `
            These are the bounds that we are going to place on how we use ChatGPT in the workplace: 
            ...

            LIST EACH SENTENCE ON A SEPARATE LINE in a \`\`\`template code block.
        `, `
           Generate 10 ideas for: ${task}
           
           The 10 ideas on separate lines in a \`\`\`template code block are:
           \`\`\`template
           
           `
                );
                let ideasStr = extractPromptTemplate(result);
                return ideasStr.trim().split("\n");
            } catch (e) {
                console.log(`An error occurred while generating 10 ideas: ${e}`);
                console.log("Trying again...");
                return await generate10Ideas( task);
            }
        };

        const generateIdeasInParallel = async ( task, times) => {
            const the10Ideas = await generate10Ideas( task);
            console.log(`10 ideas generated for: ${task} -- ${the10Ideas}`);

            let results = [];
            // Array to store the promises
            let promises = [];

            for(let i = 0; i < times; i++) {
                // Use the .push method to add a promise to our array
                promises.push(generateIdea( the10Ideas[i % the10Ideas.length]));
            }

            try {
                // Use Promise.all to wait for all the promises to resolve
                results = await Promise.all(promises);
            } catch(e) {
                // Handle exception accordingly
                console.log(`An exception occurred: ${e}`);
            }

            return results;
        };

        const task = getParameter("Task","text");
        const ideas = await generateIdeasInParallel( task, 10);

        let value = {type:"text", data:JSON.stringify(ideas)}; // Initialize value
        return value;
    }
    catch(e){
        throw e;
    }
};//@

const getStreamContent = async (readableStream) => {
    let data = '';
    for await (const chunk of readableStream) {
        data += chunk;
    }
    return data;
};



