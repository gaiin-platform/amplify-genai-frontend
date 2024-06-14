# Amplify

# Prompting Language Documentation

This documentation provides examples of how to format prompts for different output structures and validation schemas. The examples illustrate requests for information about the first four presidents of the United States and their ages when they assumed office. Below are different prompting formats along with their descriptions.

## CSV Format

To request data in CSV format, use the `csv` command followed by the desired data schema enclosed in curly braces `{}`. Each property in the schema is represented by a key-value pair, where the key is the column name and the value is the data type as a string.

### Example
```plaintext
csv({name:"string", age:"string"}): Who were the first four presidents of the US and how old were they when they became president
```
This prompt would generate a CSV output with two columns: `name` and `age`, both expected to contain string values.

## JSON Object Format

To request data in a simple JSON format, use the `json` command with a similar data schema as used for the CSV format.

### Example
```plaintext
json({name:"string", age:"string"}): Who were the first four presidents of the US and how old were they when they became president
```
This prompt would result in a JSON object output where the `name` and `age` keys are expected to have string values.

## JSON Schema Validation Format

For a more advanced JSON format with validation, use the `json!` keyword. The JSON schema provided should adhere to standards such as the JSON Schema Draft 07 or other relevant drafts.

### Example
```plaintext
json!({
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "age": {
      "type": "integer",
      "minimum": 0
    }
  },
  "required": ["name", "age"]
}) Who were the first presidents of the US and the age they became president?
```
In this example, the JSON schema ensures that the output will be an object with the `name` as a string and the `age` as a non-negative integer. Additionally, both `name` and `age` fields are required in the output.

### Notes
- The structure of the command and schema should match the intended output format.
- When using the `json!` format for schema validation, ensure that the schema provided is compatible with the relevant JSON Schema draft specification.
- The data types and constraints within the schema, such as `type`, `minimum`, or `required`, can be customized to fit the needs of the user's request.

# Building

**Docker**

Build locally:

```shell
docker build -t dev-gen-ai-image .
docker run -p 3000:3000 dev-gen-ai-image
docker run --env-file ./.env.local  -p 3000:3000 dev-gen-ai-image to pull in env file for multiple azure variables needed
```

Pull from ghcr:

```
docker run -p 3000:3000 ghcr.io/mckaywrigley/chatbot-ui:main
```

## Running Locally

**1. Clone Repo**

```bash
git clone https://github.com/mckaywrigley/chatbot-ui.git
```

**2. Install Dependencies**

```bash
npm i
```

**3. Run App**

```bash
npm run dev
```

**4. Use It**

You should be able to start chatting.

## Configuration

When deploying the application, the following environment variables can be set:

| Environment Variable              | Default value                  | Description                                                                                                                               |
| --------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
OpenAI                                                                                   |
| OPENAI_API_HOST                   | `https://api.openai.com`       | The base url, for Azure use `https://<endpoint>.openai.azure.com`                                                                         |
| OPENAI_API_TYPE                   | `openai`                       | The API type, options are `openai` or `azure`                                                                                             |
| OPENAI_API_VERSION                | `2023-03-15-preview`           | Only applicable for Azure OpenAI                                                                                                          |
| AZURE_DEPLOYMENT_ID               |                                | Needed when Azure OpenAI, Ref [Azure OpenAI API](https://learn.microsoft.com/zh-cn/azure/cognitive-services/openai/reference#completions) |
| OPENAI_ORGANIZATION               |                                | Your OpenAI organization ID                                                                                                               |
| DEFAULT_MODEL                     | `gpt-3.5-turbo`                | The default model to use on new conversations, for Azure use `gpt-35-turbo`                                                               |
| NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT | [see here](utils/app/const.ts) | The default system prompt to use on new conversations                                                                                     |
| NEXT_PUBLIC_DEFAULT_TEMPERATURE   | 1                              | The default temperature to use on new conversations                                                                                       |
| GOOGLE_API_KEY                    |                                | See [Custom Search JSON API documentation][GCSE]                                                                                          |
| GOOGLE_CSE_ID                     |                                | See [Custom Search JSON API documentation][GCSE]                                                                                          |

## Contact

If you have any questions, feel free to reach out to Mckay on [Twitter](https://twitter.com/mckaywrigley).

[GCSE]: https://developers.google.com/custom-search/v1/overview
