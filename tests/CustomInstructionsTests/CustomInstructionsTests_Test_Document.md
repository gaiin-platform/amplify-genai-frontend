# CustomInstructionsTests Documentation

## Overview
This folder contains tests for custom instructions and specialized assistants that modify how the AI responds to user prompts. These include default instructions and specialized assistants for creating diagrams, PowerPoints, and visualizations.

## Test Files

### test_DefaultInstructions.py
**Test Class**: `DefaultInstructionsTests`

#### Tests:
1. **test_default_instructions_presence**
   - **Purpose**: Tests that default instructions are present and visible in the settings
   - **Functionality**: Verifies default instructions setting is accessible

2. **test_default_instructions_edit**
   - **Purpose**: Tests editing default instructions and verifying the changes are saved
   - **Functionality**: Tests:
     - Opening default instructions editor
     - Modifying instruction text
     - Saving changes
     - Verifying persistence

3. **test_default_instructions_clear**
   - **Purpose**: Tests clearing default instructions and verifying they are removed
   - **Functionality**: Tests:
     - Clearing instruction text
     - Confirming clear action
     - Verifying instructions are empty

---

### test_DiagramAssistant.py
**Test Class**: `DiagramAssistantTests`

#### Tests:
1. **test_diagram_assistant_activation**
   - **Purpose**: Tests activating the Diagram Assistant and verifying it appears in the active assistants list
   - **Functionality**: Tests:
     - Navigating to assistants panel
     - Selecting Diagram Assistant
     - Verifying activation status
     - Checking active assistants list

2. **test_diagram_generation**
   - **Purpose**: Tests generating a diagram through the assistant and verifying the output
   - **Functionality**: Tests:
     - Activating Diagram Assistant
     - Submitting diagram request
     - Verifying diagram output/artifact creation

3. **test_diagram_assistant_deactivation**
   - **Purpose**: Tests deactivating the Diagram Assistant
   - **Functionality**: Tests:
     - Deactivating assistant
     - Verifying removal from active list

---

### test_PowerPointAssistant.py
**Test Class**: `PowerPointAssistantTests`

#### Tests:
1. **test_powerpoint_assistant_activation**
   - **Purpose**: Tests activating the PowerPoint Assistant
   - **Functionality**: Tests:
     - Navigating to assistants panel
     - Selecting PowerPoint Assistant
     - Verifying activation status

2. **test_powerpoint_generation**
   - **Purpose**: Tests generating a PowerPoint presentation through the assistant
   - **Functionality**: Tests:
     - Activating PowerPoint Assistant
     - Submitting presentation request
     - Verifying output generation

3. **test_powerpoint_assistant_deactivation**
   - **Purpose**: Tests deactivating the PowerPoint Assistant
   - **Functionality**: Tests:
     - Deactivating assistant
     - Verifying removal from active list

---

### test_VisualizationAssistant.py
**Test Class**: `VisualizationAssistantTests`

#### Tests:
1. **test_visualization_assistant_activation**
   - **Purpose**: Tests activating the Visualization Assistant
   - **Functionality**: Tests:
     - Navigating to assistants panel
     - Selecting Visualization Assistant
     - Verifying activation status

2. **test_visualization_generation**
   - **Purpose**: Tests generating visualizations through the assistant
   - **Functionality**: Tests:
     - Activating Visualization Assistant
     - Submitting visualization request
     - Verifying chart/graph output

3. **test_visualization_assistant_deactivation**
   - **Purpose**: Tests deactivating the Visualization Assistant
   - **Functionality**: Tests:
     - Deactivating assistant
     - Verifying removal from active list

## Common Test Patterns

### Assistant Activation Flow:
1. Navigate to Assistants page/panel (usually in assistants sidebar)
2. Locate specific assistant in list
3. Click to activate assistant
4. Verify assistant appears in "Active Assistants" list
5. Verify assistant badge/indicator in chat interface

### Assistant Usage Flow:
1. Activate assistant
2. Send message/request in chat
3. Wait for assistant to process request
4. Verify output matches assistant's purpose
5. Check for artifacts if applicable

### Assistant Deactivation Flow:
1. Locate assistant in active list
2. Click deactivate/remove button
3. Verify assistant removed from active list
4. Verify assistant no longer influences chat behavior

## Notes
- Custom instructions apply globally to all conversations unless overridden
- Specialized assistants (Diagram, PowerPoint, Visualization) provide structured output
- Assistants can be activated/deactivated on a per-conversation basis
- Multiple assistants can be active simultaneously
- Default instructions act as a baseline that assistants build upon
- These tests focus on UI interaction; actual AI generation quality is not tested
