import React from 'react';

import { NotebookApp } from '@/components/Notebook/NotebookApp';
import { useNotebookFeatureFlag } from '@/components/NewUI/shared/notebookFeatureFlag';

/**
 * Keeps the Notebook page on the same stable flag source as New UI navigation.
 * This must live below HomeContext.Provider, unlike the Home component itself.
 */
export const NotebookFeatureGate: React.FC = () => {
  const notebookEnabled = useNotebookFeatureFlag();
  return notebookEnabled ? <NotebookApp /> : null;
};

export default NotebookFeatureGate;
