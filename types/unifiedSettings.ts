
export interface SettingsPanel {
  id: string;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    stroke?: number;
    className?: string;
  }>;
  component: React.ComponentType<PanelProps>;
  category: 'user' | 'admin' | 'assistant' | 'system';
  permissions?: string[];
  badge?: () => number | string;
  dependencies?: string[];
}

export interface PanelProps {
  isActive: boolean;
  onNavigate: (panelId: string) => void;
  sharedState: any;
  onStateChange: (key: string, value: any) => void;
}

export interface UnifiedSettingsState {
  activePanel: string;
  panelHistory: string[];
  sharedData: {
    [key: string]: any;
  };
  pendingChanges: {
    [panelId: string]: any;
  };
  dirty: boolean;
}

export interface PanelEvent {
  type: string;
  source: string;
  target?: string;
  data: any;
}

export interface NavCategory {
  title: string;
  panels: string[];
  permissions?: string[];
}