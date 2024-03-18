export function incrementalJSONtoCSV() {
    const states = {
        SEARCHING_FOR_ROWS_KEY: 0,
        FIND_LIST_START: 1,
        FIND_ROW_START: 2,
        FIND_PROPERTY_KEY_OR_ROW_END: 3,
        FIND_PROPERTY_KEY_START: 4,
        FIND_PROPERTY_KEY_END: 5,
        FIND_PROPERTY_VALUE_START: 6,
        INSIDE_PROPERTY_VALUE: 7,
        FIND_PROPERTY_VALUE_END: 8,
        FIND_ROW_END_OR_NEXT_PROPERTY: 9,
        SKIP_NEXT_VALUE: 10 // Skip the value when the key is not 'name' or 'age'
    };

    let state = states.SEARCHING_FOR_ROWS_KEY;
    let buffer = '';
    let csvOutput = '';

    function processCharacter(char) {
        buffer += char;

        // State machine transitions
        switch (state) {
            case states.SEARCHING_FOR_ROWS_KEY:
                if (buffer.endsWith('"rows":[')) {
                    state = states.FIND_LIST_START;
                    buffer = '';
                }
                break;

            case states.FIND_LIST_START:
                if (char === '{') {
                    state = states.FIND_ROW_START;
                }
                break;

            case states.FIND_ROW_START:
                if (char === '"') {
                    state = states.FIND_PROPERTY_KEY_END;
                } else if (char === '}') {
                    state = states.FIND_LIST_START; // New row or end of list
                }
                break;

            case states.FIND_PROPERTY_KEY_START:
                state = char === '"' ? states.FIND_PROPERTY_KEY_END : state;
                break;

            case states.FIND_PROPERTY_KEY_END:
                if (char === '"' && buffer[buffer.length - 2] !== '\\') {
                    state = states.FIND_PROPERTY_VALUE_START;
                }
                break;

            case states.SKIP_NEXT_VALUE:
                if (char === '"') {
                    state = states.INSIDE_PROPERTY_VALUE;
                }
                break;

            case states.FIND_PROPERTY_VALUE_START:
                if (char === '"') {
                    state = states.INSIDE_PROPERTY_VALUE;
                }
                else if(char === '}') {
                    csvOutput += '\n';
                }
                break;


            case states.INSIDE_PROPERTY_VALUE:
                if (char === '"') {
                    state = states.FIND_PROPERTY_VALUE_END;
                } else {
                    // Output character immediately
                    csvOutput += char;
                }
                break;

            case states.FIND_PROPERTY_VALUE_END:
                if (char === ',') {
                    csvOutput += ','; // Next property in this row
                    state = states.FIND_PROPERTY_KEY_START;
                } else if (char === '}') {
                    csvOutput += '\n'; // End of this row
                    state = states.FIND_LIST_START;
                }
                buffer = '';
                break;
        }
    }

    // Function which processes the input one character at a time
    function parse(chunk) {
        for (const char of chunk) {
            processCharacter(char);
        }

        // Return the output accumulated so far
        let output = csvOutput;
        csvOutput = ''; // Clear the output now that it's been used
        return output;
    }

    return parse;
}

//
//
// // Usage:
// const parser = incrementalJSONtoCSV();
// let value = '';
// value += parser('{"name":"answer", "arg');
// value += parser('uments":{"rows":[{');
// value += parser('"name":"John Doe","age":"30"');
// value += parser('},{"name":"Jane Sm');
// value += parser('ith","age":"28"}');
// value += parser(',{"name":"Alice Johnson","age":"3');
// value += parser('5"},{"name":"Michael Brown","age":"42"}]}');
// value += parser('}}');
//
// console.log(value);



