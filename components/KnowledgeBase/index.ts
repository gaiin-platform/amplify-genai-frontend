/**
 * Knowledge Base Components
 *
 * Export all components for the Office Knowledge Base Portal.
 */

// Main components
export { default as DocumentManager } from './DocumentManager';
export { default as EventsManager } from './EventsManager';
export { default as AssistantPreview } from './AssistantPreview';

// Integration components
export {
  IntegrationsPanel,
  GoogleCalendarConnector,
  InstagramConnector,
  CanvasConnector,
} from './Integrations';
