# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.1] - 2025-12-01

### Added

#### Core Features
- **LaTeX Rendering Support**: Comprehensive LaTeX rendering in chat, artifacts, and standalone assistants with streaming-aware scroll fixes
  - Prevents LaTeX processing in code blocks to avoid PowerShell variable interference
  - Improved math display with layout stability
  - Fixed whitespace issues in standalone agent chat
  
- **Visual Workflow Builder**: Complete visual workflow creation system
  - Initial visual workflow builder implementation
  - Enhanced search and filtering capabilities
  - Direct saving functionality with comprehensive fixes
  - Drag-and-drop interface for workflow steps
  - AI-powered workflow generation with improved UX and labeling
  - Multi-select tool picker modal with improved UI consistency
  
- **Large Text Block Management**: Advanced handling for large text content
  - Citation-style placeholder system implementation
  - Horizontal tab-style display with edit functionality
  - Multi-row layout to prevent horizontal overflow
  - 20-block limit with user-friendly notifications
  - Replace Unicode placeholders with [TEXT_N] format
  - Fixed multiple placeholder deletion bugs with atomic state updates
  - Improved edit mode UX and state management
  
- **Microsoft SharePoint Integration**: OneDrive and SharePoint support
  - Service selection for Microsoft data sources
  - Enhanced UI for service selection in AssistantDriveDataSources
  
- **Data Disclosure Viewer**: View data disclosure in settings
  - Improved button styles for accessibility and visual consistency
  - Build fixes for proper functionality
  
- **File Management Enhancements**:
  - Multi-select delete with consolidated toast notifications (replaces per-file toast spam)
  - ZIP file logic integration in file handler
  - File tags support
  - Enhanced drag-and-drop and clipboard paste functionality
  - Embedding status display in file management components
  - Improved file reprocessing functionality with refactored integration icon handling

#### Admin Features
- **User Cost Management**: Seamless auto-loading pagination system
  - Automatic recursive loading for ALL users
  - Real-time progress feedback (count, cost, batch number)
  - "Stop Loading" button for graceful abort
  - Skeleton loaders for smooth transitions
  - Progressive rendering as batches arrive
  - Removed confusing manual "Load More" button and limit selector
  
- **CSV Admin Upload**: Comprehensive upload functionality
  - User validation with detailed feedback
  - Refactored into reusable component system
  - Email validation service integration
  
- **Enhanced Admin UI**:
  - Configurations for AI email domain support
  - User cost management improvements
  - Rate limiting features
  - OpenAI endpoints management enhancements
  - Test endpoints with data transformation for non-completions endpoints
  
- **Scheduled Tasks**: Enhanced component with improved logging
  - Better task log polling and error handling
  - Task execution logging improvements

#### Performance & Technical Improvements
- **LZW Data Compression**: Outgoing request body compression
- **IndexedDB Migration**: Storage refactored from localStorage to IndexedDB
- **API Optimization**: Updated NO_COMPRESSION_PATHS for:
  - `/amp`
  - `/user-data`
  - `/data-disclosure`
  - Additional paths for improved request handling

#### UI/UX Enhancements
- Enhanced Assistant Workflow UI with tooltips and styling improvements
- Workflow preview display
- Refactored SmartTagSelector to eliminate code duplication
- Refactored ToolItem creation with shared factory utilities
- Refactored step editing with shared component and enhanced dark mode support
- Enhanced loading indicators with portal and animation
- Model selector bottom cutoff and jitter fixes during AI streaming
- Advanced conversation settings UI improvements
- Improved integration components with proper icons
- Website URL improvements for assistants
- Dynamic width adjustment for Artifacts component
- Enhanced LegacyWorkspace with modal portal and light mode support
- Fixed star rating rendering in ConversationTable and ConversationPopup

### Fixed

#### Critical Bug Fixes
- **LaTeX Processing**: Prevented in code blocks to resolve PowerShell variable interference (#176, #167)
- **Payload Compression**: Removed problematic logic from requestOp API handler
- **Agent State Handling**: Refactored for better reliability
- **Account Persistence**: Fixed serialization bugs
- **Multiple Placeholder Deletion**: Atomic state updates prevent corruption
- **Text Block Numbering**: Correct numbering for blocks beyond 10

#### Component Fixes
- Standalone assistant functionality improvements
- Assistant Group Interface button availability and interaction bugs
- API Keys component rotation warning logic
- WorkflowGeneratorModal schema requirement compliance
- Edit mode issues in large text block functionality
- TypeScript const reassignment errors in handleChange
- Placeholder expansion while preserving PromptOptimizer improvements

#### Build & Development Fixes
- Multiple build error resolutions
- Test suite updates (Part 1 and Part 2 completed)
- Removed console logging from production code
- Fixed duplicate code across components

### Changed

#### Refactoring
- ToolPicker components renamed to ToolSelector for consistency
- CSV upload refactored into reusable component system
- Large text handling code organization improved
- Email handling refactored in email auto-complete service
- Integration components refactored with proper icons
- UserCostModal refactored (removed pricing page)
- Storage handling migrated to IndexedDB

#### Configuration Updates
- Promptbar and Sidebar components made handleCreateFolder optional
- AssistantModal filters visible data source flags
- AssistantModal and AssistantPathEditor improved path handling
- Model pricing feature flag added
- Enhanced admin configurations

#### Dependencies
- Version bumped to 0.8.1
- react-syntax-highlighter updated to 15.6.6
- jimp added for image processing
- Package-lock updates for security

### Development

#### Code Quality
- Removed duplicate code across multiple components
- Improved TypeScript compliance and type safety
- Better error handling throughout application
- Enhanced component organization
- Eliminated code duplication in multiple areas

#### Testing
- Fixed and modified all remaining tests
- Enhanced test coverage
- Updated test suite for new features

### Contributors
- Karely Rodriguez (@dev-karely)
- Allen Karns
- seviert / seviert23
- Jagadeesh Reddy Vanga / jagadeesh-r1
- Daniel Henricks
- maxmoundas
- Charlie.Perkins.20

### Migration Notes
- Storage has been migrated to IndexedDB - users may need to re-authenticate
- Some admin endpoints have new data transformation requirements
- NO_COMPRESSION_PATHS configuration may need updates for custom deployments

---

## [0.8.0] - 2025-08-19

### Added
- Initial LaTeX feature implementation
- Gemini thinking/reasoning message support
- AssistantReasoningMessage component
- Enhanced admin test endpoints

### Enhanced
- Agent logs now compressed for better performance
- Admin UI improvements for user management

### Fixed
- Various stability and performance improvements

---

**Release Schedule**: Major releases occur when significant feature sets are complete. Patch releases address critical bugs and security issues.

**Support**: This project follows semantic versioning. Breaking changes will only occur in major version updates.
