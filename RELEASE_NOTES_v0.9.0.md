# Release Notes: v0.9.0

**Release Date**: February 2026
**Previous Version**: v0.8.1 (December 2, 2025)
**Branch**: main

---

## Summary

Version 0.9.0 is a major frontend update delivering new platform capabilities and significant UI/UX improvements. With **130 commits**, **155 files changed**, and **8 merged pull requests**, this release adds JIT user provisioning, MCP integration, web search, critical error tracking, and enhanced admin tooling.

### Highlights at a Glance
- :warning: **Requires Backend v0.9.0** — Must deploy backend first (breaking Parameter Store migration)
- :electric_plug: **MCP Integration** — Client-side Model Context Protocol support
- :mag: **Web Search** — Admin-configurable web search in conversations
- :bell: **Critical Error Dashboard** — Admin UI for monitoring system errors
- :file_folder: **Batch Processing** — Multi-select operations for data sources
- :bar_chart: **Enhanced Cost Tracking** — Auto-loading user costs, cached token costs, cost history

---

## :warning: Breaking Changes

### Requires Backend v0.9.0

This release **requires** the backend v0.9.0 to be deployed first. The backend has migrated all shared environment variables to AWS Parameter Store.

1. Deploy the [backend](https://github.com/gaiin-platform/amplify-genai-backend) first
2. If you have the `amplify-lambda-basic-ops` service, handle the `/user-data` endpoint migration
3. Then rebuild and deploy the frontend container

See the [Migration Guide](https://github.com/gaiin-platform/amplify-genai-backend/blob/main/scripts/MIGRATION_README.md) for complete instructions.

---

## :new: New Features

### MCP (Model Context Protocol) Integration

Client-side MCP support for extending AI capabilities with external tools:
- `MCPServersTab` component for MCP server configuration
- `mcpService` and `mcpToolExecutor` for MCP operations
- MCP tool result display blocks in chat interface
- New `useMCPChat` hook for MCP-enabled conversations
- Feature flag support for MCP functionality

*Pull Request: #209*

---

### Web Search Functionality

Admin-configurable web search integration:
- `WebSearchIntegration` component in Admin UI
- `adminWebSearchService` for web search API management
- Per-conversation web search toggle for user control
- Feature flag support

*Pull Request: #209*

---

### Critical Error Tracking Dashboard

New admin dashboard for monitoring system errors:
- Admin tab for tracking critical system errors
- Email notification configuration for error alerts
- Relative timestamps for recent error events
- Conditional rendering based on feature flags

*Pull Request: #209*

---

### Batch Processing

Multi-item operations for data source management:
- `BatchProcessModal` component for batch operations
- Multi-select functionality in DataSources tables
- Consolidated toast notifications for batch operations
- Individual file tracking with success/failure reporting

*Pull Request: #209*

---

## :bar_chart: Cost Tracking & Admin Enhancements

### User Cost Management
- Replaced manual pagination with seamless auto-loading for user costs
- Real-time loading progress indicators with live count, cost, and batch number
- User cost history functionality in `UserCostsModal`
- Display user names from `amplifyUsers` mapping
- Support for cached token costs (`inputWriteCachedTokenCost`)
- Enhanced model cost fields in Admin UI and Supported Models

### Admin UI Improvements
- Refactored Configurations and IntegrationsTab components
- Integrated `amplifyUsers` mapping across admin components
- Conditional tab rendering based on feature flags
- Enhanced API integration display in Assistant management
- New Admin Consent Setting for Microsoft Azure integrations

*Pull Requests: #203, #209*

---

## :file_folder: File & Data Source Management

### Enhanced File Handling
- Better file type translations and MIME type handling
- Improved attachment display across chat interface
- Enhanced file upload handling in AssistantModal

### Data Sources
- Multi-select delete functionality with batch operations
- Improved button styles for better visibility
- Enhanced embedding document status handling
- User context integration in EmbeddingsTab
- Parallel API calls for improved integration checking performance

*Pull Request: #209*

---

## :robot: Assistant & Workflow Enhancements

- Enhanced workflow template integration in ScheduledTasks
- Loading indicators and expanded step management in AssistantWorkflowBuilder
- Dark mode background adjustments for workflow templates
- Improved task tracking logic
- Better agent management and API integration display

*Pull Request: #209*

---

## :art: UI/UX Improvements

### Email & User Management
- Case-insensitive email autocomplete functionality
- LZW compression support for email suggestion fetching
- Display user names from `amplifyUsers` in shared items lists

### Visual Enhancements
- ColorPaletteSelector improvements for palette management
- Sidebar layout refactoring for better structure
- Table style enhancements with new CSS
- Better dark mode support across components
- Collapse/expand functionality for ActionsList component

### White Label Support
- Branding and white-label customization support

### Download Enhancements
- Download artifacts as DOCX
- Download code files inside artifacts as ZIP

*Pull Requests: #198, #202, #217*

---

## :wrench: Technical Improvements

### Code Quality & Performance
- Refactored user identification to use `getUserIdentifier` utility
- Parallel API calls for improved performance in integration checks
- Cleaned up duplicate code and unused functions
- Removed unused `promptOptimizerService`
- Updated PromptOptimizerButton to use advanced model with adjusted token limits
- Improved group type handling across chat components

### Microsoft Integration
- Refactored Microsoft service selection logic in AssistantDriveDataSources
- New Admin Consent Setting for Microsoft Azure integrations

### Configuration & Dependencies
- Updated Next.js configuration for improved syntax highlighting
- Updated package dependencies including visualization libraries
- Enhanced file type translations
- Better settings management utilities
- Removed `package-lock.json` to streamline dependency management

*Pull Requests: #197, #203, #215*

---

## :chart_with_upwards_trend: Stats

| Metric | Count |
|--------|-------|
| Commits | 130 |
| Files changed | 155 |
| Insertions | +17,738 |
| Deletions | -5,135 |
| Pull Requests | 8 |

---

## :busts_in_silhouette: Contributors

- **Karely Rodriguez** (@karelyrodri) — Lead developer, JIT provisioning, MCP integration, admin features
- **Allen Karns** (@karnsab) — Release management, dependency cleanup
- **Jason Bradley** (@jasonbrd) — White label support
- **Seviert** (@seviert23) — Microsoft Azure admin consent
- **Daniel Henricks** (@DanielPHenricks) — DOCX/ZIP download functionality

---

## Deployment Instructions

1. **Deploy the backend v0.9.0 first** — see [backend release notes](https://github.com/gaiin-platform/amplify-genai-backend/releases/tag/v0.9.0)
2. Rebuild the frontend Docker image
3. Push to ECR and update the ECS service

See the full [deployment guide](https://github.com/gaiin-platform/.github/blob/main/profile/README.md) for detailed instructions.
