# AmplifyHelperTests Documentation

## Overview
This folder contains tests for Amplify's built-in helper tools and assistants. These assistants provide specialized functionality for creating diagrams, PowerPoint presentations, visualizations, extracting CSV data, and generating summaries with quotations.

## Test Files

### test_CreateDiagram.py
**Test Class**: `CreateDiagramTests`

#### Tests:
1. **test_create_diagram_is_interactable**
   - **Purpose**: Ensure the Create Diagram button in the Amplify Helpers folder can be clicked on the Assistants Side Bar
   - **Functionality**: Verifies the Create Diagram assistant is accessible and opens its modal

2. **test_share_button**
   - **Purpose**: Ensure the Share button on the Create Diagram button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it makes the Share Modal appear
   - **Functionality**: Tests sharing functionality for the Create Diagram template

3. **test_create_diagram_duplicate**
   - **Purpose**: Ensure the Duplicate Button on the Create Diagram button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it creates a duplicate in the prompts
   - **Functionality**: Tests duplication of the Create Diagram template

4. **test_create_diagram_modal_is_interactable_bullet**
   - **Purpose**: Ensure the Create Diagram button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and the modal is interactable
   - **Functionality**: Tests submitting the Create Diagram modal with configuration options

---

### test_CreatePowerPoint.py
**Test Class**: `CreatePowerPointTests`

#### Tests:
1. **test_create_powerpoint_is_interactable**
   - **Purpose**: Ensure the Create PowerPoint button in the Amplify Helpers folder can be clicked on the Assitants Side Bar
   - **Functionality**: Verifies the Create PowerPoint assistant is accessible and opens its modal

2. **test_share_button**
   - **Purpose**: Ensure the Share button on the Create PowerPoint button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it makes the Share Modal appear
   - **Functionality**: Tests sharing functionality for the Create PowerPoint template

3. **test_create_powerpoint_duplicate**
   - **Purpose**: Ensure the Duplicate Button on the Create PowerPoint button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it creates a duplicate in the prompts
   - **Functionality**: Tests duplication of the Create PowerPoint template

4. **test_create_powerpoint_modal_is_interactable_bullet**
   - **Purpose**: Ensure the Create Diagram button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and the modal is interactable
   - **Functionality**: Tests submitting the Create PowerPoint modal with configuration options

---

### test_CreateVisualization.py
**Test Class**: `CreateVisualizationsTests`

#### Tests:
1. **test_create_visualization_is_interactable**
   - **Purpose**: Ensure the Create Visualization button in the Amplify Helpers folder can be clicked on the Assitants Side Bar
   - **Functionality**: Verifies the Create Visualization assistant is accessible and opens its modal

2. **test_share_button**
   - **Purpose**: Ensure the Share button on the Create Visualization button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it makes the Share Modal appear
   - **Functionality**: Tests sharing functionality for the Create Visualization template

3. **test_create_visualization_duplicate**
   - **Purpose**: Ensure the Duplicate Button on the Create Visualization button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it creates a duplicate in the prompts
   - **Functionality**: Tests duplication of the Create Visualization template

4. **test_create_visualization_modal_is_interactable_bullet**
   - **Purpose**: Ensure the Create Visualization button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and the modal is interactable
   - **Functionality**: Tests submitting the Create Visualization modal with configuration options

---

### test_CSVExtractor.py
**Test Class**: `CSVExtractorTests`

#### Tests:
1. **test_csv_extractor_is_interactable**
   - **Purpose**: Ensure the CSV Extractor button in the Amplify Helpers folder can be clicked on the Assitants Side Bar
   - **Functionality**: Verifies the CSV Extractor assistant is accessible and opens its modal

2. **test_csv_extractor_shared**
   - **Purpose**: Ensure the Share button on the CSV Extractor button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it makes the Share Modal appear
   - **Functionality**: Tests sharing functionality for the CSV Extractor template

3. **test_csv_extractor_duplicate**
   - **Purpose**: Ensure the Duplicate Button on the CSV Extractor button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it creates a duplicate in the prompts
   - **Functionality**: Tests duplication of the CSV Extractor template

4. **test_create_visualization_modal_is_interactable_bullet**
   - **Purpose**: Ensure the CSV Extractor button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and the modal is interactable
   - **Functionality**: Tests submitting the CSV Extractor modal with configuration options

---

### test_SummaryWithQuotations.py
**Test Class**: `SummaryWithQuotationsTests`

#### Tests:
1. **test_dropdown_closes_after_selection**
   - **Purpose**: Ensure the Amplify Helpers folder can be clicked and that the folder expands on the Assitants Side Bar
   - **Functionality**: Tests folder expand/collapse functionality

2. **test_summary_with_quotations_is_interactable**
   - **Purpose**: Ensure the Summary with Quotations button in the Amplify Helpers folder can be clicked on the Assitants Side Bar
   - **Functionality**: Verifies the Summary with Quotations assistant is accessible and opens its modal

3. **test_share_button**
   - **Purpose**: Ensure the Share button on the Summary with Quotations button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it makes the Share Modal appear
   - **Functionality**: Tests sharing functionality for the Summary with Quotations template

4. **test_summary_with_quotations_duplicate**
   - **Purpose**: Ensure the Duplicate Button on the Summary with Quotations button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and that it creates a duplicate in the prompts
   - **Functionality**: Tests duplication of the Summary with Quotations template

5. **test_summary_with_quotations_modal_is_interactable_bullet**
   - **Purpose**: Ensure the Summary with Quotations button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and the modal is interactable with bullet points
   - **Functionality**: Tests submitting the Summary with Quotations modal with bullet point formatting, including file upload and dropdown selection

6. **test_summary_with_quotations_modal_is_interactable_number**
   - **Purpose**: Ensure the Summary with Quotations button in the Amplify Helpers folder can be clicked on the Assitants Side Bar and the modal is interactable with numbered list
   - **Functionality**: Tests submitting the Summary with Quotations modal with numbered list formatting

## Common Test Patterns

### Helper Method: `click_assistants_tab()`
- Navigates to the Assistants tab in the assistants sidebar
- Used by all test files as a setup step
- Includes wait times for UI rendering

### Helper Method: `upload_file(filename)`
- Uploads test files from the `test_files` directory
- Used in Summary with Quotations tests
- Handles file input element interaction

### Test Flow for Each Assistant:
1. Navigate to Assistants tab
2. Expand Amplify Helpers folder
3. Locate specific assistant
4. Test interaction (click, share, duplicate, or modal submission)
5. Verify expected behavior

## Notes
- All tests run in headless mode by default
- Tests use explicit waits for element presence
- Each assistant tests follow similar patterns: interactability, sharing, and duplication
- Modal submission tests include file uploads and dropdown selections where applicable
