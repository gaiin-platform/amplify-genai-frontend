# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Dev to Main Release

### Added
- **Large Text Block Management**: Comprehensive system for handling large text content with improved UX
  - Implemented multi-row layout for large text blocks to prevent horizontal overflow
  - Added 20-block limit for large text blocks with user-friendly notifications
  - Extended Unicode parenthesized numbers support from 10 to 20 blocks
  - Added CSV upload functionality with preview and validation
  - New `LargeTextDisplay`, `LargeTextTabs`, and `ExpandedTextDisplay` components
  - Added `useLargeTextManager` and `useTextBlockEditor` hooks for state management

- **Workflow Builder Enhancements**: Major improvements to assistant workflow creation
  - Added AI-powered workflow generation with `WorkflowGeneratorModal`
  - Implemented visual workflow builder with drag-and-drop interface
  - Added tool selector components (`ToolSelectorCore`, `ToolSelectorModal`, `ToolSelectorPanel`)
  - Created step editor for detailed workflow customization
  - Added smart tag selector for improved workflow organization

- **Sitemap Processing**: Enhanced website data source handling
  - Implemented sitemap URL selection modal with filtering capabilities
  - Added sitemap exclusion functionality for better control
  - Enhanced website URL validation and processing
  - Added support for unlimited sitemap URL extraction with warnings

- **LaTeX Rendering Improvements**: Major stability and performance enhancements
  - Implemented aggressive layout-stable LaTeX processing for artifacts
  - Added enhanced LaTeX components with layout stability
  - Created specialized `ArtifactLatexBlock` and `LatexBlock` components
  - Improved math display with estimated dimensions to prevent layout shifts

- **API Key Management**: Enhanced security and user experience
  - Added MTD (Month-to-Date) cost tracking for API keys
  - Implemented rotation warning system for API keys
  - Enhanced API key filtering by purpose
  - Added visual indicators for API key status and costs

- **File Upload Enhancements**: Improved file handling capabilities
  - Added attachment display component for better file visualization
  - Enhanced file list functionality with better state management
  - Improved file upload progress tracking
  - Added support for various file type handling

- **Integration Improvements**: Better third-party service connections
  - Added comprehensive integration logos and assets
  - Enhanced Google and Microsoft service integration
  - Improved OAuth integration handling
  - Added integration-specific utilities and helpers

### Enhanced
- **Assistant Management**: Significant improvements to assistant functionality
  - Enhanced assistant modal with better data source management
  - Improved website data source rescanning capabilities
  - Added assistant path publishing features
  - Enhanced assistant workflow display and management
  - Improved assistant configuration options

- **UI/UX Improvements**: Better user interface and experience
  - Enhanced modal components with better accessibility
  - Improved responsive design for various screen sizes
  - Added better loading states and progress indicators
  - Enhanced color palette selector functionality
  - Improved sidebar and navigation components

- **Data Source Management**: More robust data handling
  - Enhanced website URL input with validation
  - Improved data source table functionality
  - Added CSV upload configurations and processing
  - Better error handling and user feedback

### Fixed
- **Text Block Management**: Resolved critical text handling issues
  - Fixed multiple placeholder deletion bug with atomic state updates
  - Resolved TypeScript const reassignment error in handleChange
  - Fixed placeholder expansion while preserving PromptOptimizer improvements
  - Corrected text block numbering for blocks beyond 10

- **Scheduled Tasks**: Improved reliability and error handling
  - Enhanced task log polling and error handling
  - Fixed task creation and management issues
  - Improved scheduled task status display

- **LaTeX Processing**: Major stability improvements
  - Prevented LaTeX processing in code blocks to resolve PowerShell variable interference
  - Fixed layout shifts during LaTeX rendering
  - Improved streaming content handling with LaTeX

- **Component Stability**: Various bug fixes and improvements
  - Fixed edit mode issues in large text block functionality
  - Resolved artifact rendering and streaming issues
  - Improved component state management
  - Fixed various TypeScript and React warnings

### Changed
- **Package Dependencies**: Updated core dependencies
  - Updated various npm packages for security and performance
  - Enhanced package-lock.json with latest versions
  - Improved build and development tooling

- **Code Organization**: Better structure and maintainability
  - Refactored large text handling utilities
  - Reorganized workflow-related components
  - Improved utility functions and helpers
  - Enhanced type definitions and interfaces

- **Configuration**: Updated project settings
  - Enhanced CSV upload configurations
  - Improved integration constants and settings
  - Updated color and styling configurations

### Removed
- **Unused Components**: Cleanup and optimization
  - Removed obsolete pricing page
  - Cleaned up unused integration types
  - Removed deprecated utility functions

### Security
- **API Security**: Enhanced security measures
  - Improved API key rotation warnings
  - Enhanced access control for API keys
  - Better validation for user inputs and file uploads

### Performance
- **Rendering Optimizations**: Improved application performance
  - Optimized LaTeX rendering to prevent layout thrashing
  - Enhanced large text block handling for better memory usage
  - Improved component re-rendering efficiency
  - Better debouncing and throttling for user interactions

---

**Note**: This release represents a major update with significant improvements to text handling, workflow management, and user experience. Please allow time for data source updates to take effect after saving changes to assistants.