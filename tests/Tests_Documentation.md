# Amplify Frontend Testing Documentation

## Overview

This document provides an overview of the frontend testing infrastructure for Amplify, Vanderbilt University's open-source enterprise platform for generative AI. The testing suite uses Selenium WebDriver with Python's unittest framework to perform end-to-end browser automation tests.

## Test Infrastructure

### Base Test Class
All tests inherit from `BaseTest` (located in `base_test.py`), which provides:
- **Automated login/authentication** using credentials from `.env.local`
- **Persistent Chrome profile** for session management
- **WebDriver setup and teardown** for each test
- **Headless and non-headless modes** for debugging
- **Centralized wait utilities** with WebDriverWait

### Test Environment
- **Framework**: Python unittest
- **Browser Automation**: Selenium WebDriver
- **Browser**: Chrome (managed by ChromeDriverManager)
- **Configuration**: Environment variables from `.env.local`
- **Base URL**: Configurable via `NEXTAUTH_URL` (default: http://localhost:3000)

## Test Organization

The test suite is organized into the following categories:

### 1. AmplifyHelperTests
Tests for Amplify's built-in helper tools and assistants that provide specialized functionality:
- **Create Diagram**: Tests diagram creation assistant functionality
- **Create PowerPoint**: Tests PowerPoint generation assistant
- **Create Visualization**: Tests data visualization assistant
- **CSV Extractor**: Tests CSV data extraction assistant
- **Summary with Quotations**: Tests document summarization with citation features

### 2. ChatTests
Tests for core chat interface functionality:
- **Add Action**: Tests adding actions/tools to conversations
- **Chat Bar Misc**: Tests miscellaneous chat bar features (file uploads, assistant selection, sidebar collapse)
- **Chat Home**: Tests primary chat interface (model selection, settings, sliders, custom instructions)
- **File Inclusions**: Tests file upload and categorization (txt, pdf, pptx, docx, md, html, csv)
- **Response Chat Handler**: Tests chat response interactions (copy, download, edit, branch, artifact creation)
- **Select Enabled Features**: Tests feature selection interface and code interpreter functionality
- **Upper Chat**: Tests upper chat bar controls (settings, clear, share, download, artifacts, privacy, pin)

### 3. ConversationsTests
Tests for conversation management:
- **Create Chat Folders**: Tests folder creation, renaming, deletion, pinning, and drag-and-drop
- **Create Chats**: Tests chat creation, renaming, and deletion
- **Left Search Bar**: Tests conversation search and filtering functionality

### 4. CustomInstructionsTests
Tests for custom instruction and assistant configuration:
- **Default Instructions**: Tests default instruction management
- **Diagram Assistant**: Tests diagram assistant activation and usage
- **PowerPoint Assistant**: Tests PowerPoint assistant configuration
- **Visualization Assistant**: Tests visualization assistant setup

### 5. LeftSidebarTests
Tests for chat creation, selection, and organization functionalities:
- **Clean**: Tests conversation cleanup functionality
- **Folder Handler**: Tests folder management operations
- **Logout**: Tests user logout functionality
- **Mass Delete**: Tests bulk conversation deletion
- **Mass Share**: Tests bulk conversation sharing
- **Tags**: Tests conversation tagging and filtering

### 6. ModalTests
Tests for various modal dialogs throughout the application:
- **Account Modal**: Tests user account information and settings
- **Admin Modals**: Tests administrative interfaces for:
  - Application Variables
  - Configurations
  - Embeddings
  - Feature Data
  - Feature Flags
  - Integrations
  - OpenAI Configuration
  - Operations
  - Supported Models
- **Assistant Modal**: Tests assistant configuration interface
- **Download Modal**: Tests conversation/content download functionality
- **Memory Modal**: Tests conversation memory/context management
- **Prompt Modal**: Tests prompt input and submission
- **Scheduled Tasks Modal**: Tests task scheduling and management
- **Settings Modal**: Tests application settings interface

### 7. RightSidebarTests
Tests for assistant and prompt creation, selection, and organization functionalities
- **Active Assistants List**: Tests active assistant management
- **Assistants Page**: Tests assistant browsing and selection
- **Create Folder**: Tests folder creation for assistants/prompts
- **Folder Handler**: Tests assistant/prompt folder management
- **Mass Delete**: Tests bulk deletion of assistants/prompts
- **Mass Share**: Tests bulk sharing of assistants/prompts
- **Prompt Template**: Tests prompt template management
- **Right Search Bar**: Tests assistant and prompt search

### 8. TabTests
Tests for tab-based interfaces:
- **Artifacts**: Tests artifact management (viewing, downloading, filtering, deletion)
- **Settings Tab**: Tests settings interface features (imports, exports, API management, scheduled tasks)
- **Share Tab**: Tests sharing center and collaboration features

### 9. UserMenuTests
Tests for user menu functionality:
- **Base User Menu**: Tests user menu presence and navigation
- **Billing and Cost Management**: Tests cost tracking, user analytics, and billing groups
- **My Data**: Tests personal data management with advanced filtering and column customization
- **Theme Change**: Tests theme and color scheme customization

### 10. test_files
Contains specific test files for certain tests involving uploading files in Amplify

## Test Files

Total test files: **54 Python test files**
- AmplifyHelperTests: 5 files
- ChatTests: 7 files
- ConversationsTests: 3 files
- CustomInstructionsTests: 4 files
- LeftSidebarTests: 6 files
- ModalTests: 15 files
- RightSidebarTests: 8 files
- TabTests: 3 files
- UserMenuTests: 4 files

## Test Execution

Tests can be run individually or as a suite:

```bash
# Run all tests (involves: chmod +x test_all_files.sh)
./test_all_files.sh 1

# Run a specific test directory (where the viable cases of N are 2-10, all matched alphabetically where 2 = AmplifyHelperTests, 3 = ChatTests, ..., and 10 = UserMenuTests)
./test_all_files.sh N

# Run a specific test file (from tests directory)
pytest testDirectory/test_NameOfTest.py

# Example
pytest ChatTests/test_AddAction.py

```

## Key Testing Patterns

### Element Location
Tests use explicit waits and multiple strategies for element location:
- By ID (most common)
- By CSS Selector
- By Tag Name

### User Interactions
Tests simulate real user interactions:
- **Clicks**: Simple button/element clicks
- **Hover**: ActionChains for hover-triggered elements
- **Drag and Drop**: Complex drag-and-drop operations
- **Text Input**: Form filling and search
- **Alerts**: JavaScript alert handling

### Assertions
Common assertion patterns:
- Element presence and visibility
- Text content verification
- Attribute value checking
- Count verification
- State validation

## Detailed Test Documentation

For detailed information about specific tests in each category, see:
- [AmplifyHelperTests Documentation](./AmplifyHelperTests/AmplifyHelperTests_Test_Document.md)
- [ChatTests Documentation](./ChatTests/ChatTests_Test_Document.md)
- [ConversationsTests Documentation](./ConversationsTests/ConversationsTests_Test_Document.md)
- [CustomInstructionsTests Documentation](./CustomInstructionsTests/CustomInstructionsTests_Test_Document.md)
- [LeftSidebarTests Documentation](./LeftSidebarTests/LeftSidebarTests_Test_Document.md)
- [ModalTests Documentation](./ModalTests/ModalTests_Test_Document.md)
- [RightSidebarTests Documentation](./RightSidebarTests/RightSidebarTests_Test_Document.md)
- [TabTests Documentation](./TabTests/TabTests_Test_Document.md)
- [UserMenuTests Documentation](./UserMenuTests/UserMenuTests_Test_Document.md)

## Notes for Maintainers

- Tests use a persistent Chrome profile to maintain authentication state
- Default test mode is headless; set `headless=False` for debugging
- Tests include sleep delays for UI rendering; these may need adjustment based on system performance
- IMPORTANT: The login process requires manual interaction for 2FA/SSO (35-second delay configured), but usually this is only done for the first case. 
  So once you have done the 2FA once, you should be good to not have to do it again for a while when running individual tests
