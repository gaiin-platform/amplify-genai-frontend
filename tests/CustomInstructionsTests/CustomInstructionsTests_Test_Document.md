# CustomInstructionsTests Documentation

## Overview
This folder contains tests for custom instructions and specialized assistants in Amplify. These assistants provide template-based interactions with customizable instructions, including Default Instructions for general use, and specialized assistants for creating diagrams, PowerPoints, and visualizations.

## Test Files

### test_DefaultInstructions.py
**Test Class**: `DefaultInstructionsTests`

#### Tests:
1. **test_default_instructions_is_interactable**
   - **Purpose**: Ensure the Default Instructions button in the Custom Instructions folder can be clicked on the Assistants Side Bar
   - **Functionality**: Verifies the Default Instructions assistant is accessible and opens its modal

2. **test_share_button**
   - **Purpose**: Ensure the Share button on the Default Instructions button in the Custom Instructions folder can be clicked on the Assistants Side Bar and that it makes the Share Modal appear
   - **Functionality**: Tests sharing functionality for the Default Instructions template

3. **test_default_instructions_duplicate**
   - **Purpose**: Ensure the Duplicate Button on the Default Instructions button in the Custom Instructions folder can be clicked on the Assistants Side Bar and that it creates a duplicate in the prompts
   - **Functionality**: Tests duplication of the Default Instructions template

4. **test_default_instructions_modal_is_interactable_bullet**
   - **Purpose**: Ensure the Default Instructions button in the Custom Instructions folder can be clicked on the Assistants Side Bar and the modal is interactable
   - **Functionality**: Tests submitting the Default Instructions modal with configuration options

---

### test_DiagramAssistant.py
**Test Class**: `DiagramAssistantsTests`

#### Tests:
1. **test_diagram_assistant_is_interactable**
   - **Purpose**: Ensure the Diagram Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar
   - **Functionality**: Verifies the Diagram Assistant is accessible and opens its modal

2. **test_share_button**
   - **Purpose**: Ensure the Share button on the Diagram Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar and that it makes the Share Modal appear
   - **Functionality**: Tests sharing functionality for the Diagram Assistant template

3. **test_diagram_assistant_duplicate**
   - **Purpose**: Ensure the Duplicate Button on the Diagram Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar and that it creates a duplicate in the prompts
   - **Functionality**: Tests duplication of the Diagram Assistant template

4. **test_diagram_assistant_modal_is_interactable**
   - **Purpose**: Ensure the Diagram Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar and the modal is interactable
   - **Functionality**: Tests submitting the Diagram Assistant modal with configuration options

---

### test_PowerPointAssistant.py
**Test Class**: `PowerPointAssistantsTests`

#### Tests:
1. **test_powerpoint_assistant_is_interactable**
   - **Purpose**: Ensure the PowerPoint Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar
   - **Functionality**: Verifies the PowerPoint Assistant is accessible and opens its modal

2. **test_share_button**
   - **Purpose**: Ensure the Share button on the PowerPoint Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar and that it makes the Share Modal appear
   - **Functionality**: Tests sharing functionality for the PowerPoint Assistant template

3. **test_powerpoint_assistant_duplicate**
   - **Purpose**: Ensure the Duplicate Button on the PowerPoint Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar and that it creates a duplicate in the prompts
   - **Functionality**: Tests duplication of the PowerPoint Assistant template

4. **test_powerpoint_assistant_modal_is_interactable**
   - **Purpose**: Ensure the PowerPoint Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar and the modal is interactable
   - **Functionality**: Tests submitting the PowerPoint Assistant modal with configuration options

---

### test_VisualizationAssistant.py
**Test Class**: `VisualizationAssistantTests`

#### Tests:
1. **test_visualization_assistant_is_interactable**
   - **Purpose**: Ensure the Visualization Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar
   - **Functionality**: Verifies the Visualization Assistant is accessible and opens its modal

2. **test_share_button**
   - **Purpose**: Ensure the Share button on the Visualization Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar and that it makes the Share Modal appear
   - **Functionality**: Tests sharing functionality for the Visualization Assistant template

3. **test_visualization_assistant_duplicate**
   - **Purpose**: Ensure the Duplicate Button on the Visualization Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar and that it creates a duplicate in the prompts
   - **Functionality**: Tests duplication of the Visualization Assistant template

4. **test_visualization_assistant_modal_is_interactable**
   - **Purpose**: Ensure the Visualization Assistant button in the Custom Instructions folder can be clicked on the Assistants Side Bar and the modal is interactable
   - **Functionality**: Tests submitting the Visualization Assistant modal with configuration options

## Common Test Patterns

### Helper Method: `click_assistants_tab()`
- Navigates to the Assistants tab in the assistants sidebar
- Used by all test files as a setup step
- Includes wait times for UI rendering

### Test Flow for Each Assistant:
1. Navigate to Assistants tab
2. Expand Custom Instructions folder
3. Locate specific assistant
4. Test interaction (click, share, duplicate, or modal submission)
5. Verify expected behavior

## Notes
- All tests run in headless mode by default
- Tests use explicit waits for element presence
- Each assistant tests follow similar patterns: interactability, sharing, and duplication
- Modal submission tests verify that the Submit button can be clicked successfully
- All assistants are located within the "Custom Instructions" folder on the Assistants sidebar
