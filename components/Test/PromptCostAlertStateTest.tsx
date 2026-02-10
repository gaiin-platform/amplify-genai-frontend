/**
 * Prompt Cost Alert State Test Component
 *
 * This is a temporary test component to verify that Part 2 implementation works.
 * It displays the promptCostAlert state in a fixed position on the screen.
 *
 * Usage:
 * 1. Import this component into pages/index.tsx
 * 2. Add <PromptCostAlertStateTest /> somewhere in the component tree
 * 3. Load the app and you should see the state displayed in top-right corner
 * 4. Remove this component once testing is complete
 */

import { useContext } from 'react';
import HomeContext from '@/pages/api/home/home.context';

export const PromptCostAlertStateTest = () => {
  const { state: { promptCostAlert } } = useContext(HomeContext);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: '#1a1a1a',
      color: '#00ff00',
      padding: '15px',
      border: '2px solid #00ff00',
      borderRadius: '8px',
      zIndex: 9999,
      fontFamily: 'monospace',
      fontSize: '12px',
      maxWidth: '400px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#00ff00', fontSize: '14px' }}>
        ✅ Prompt Cost Alert State Test
      </h3>

      {promptCostAlert ? (
        <div>
          <div style={{ marginBottom: '5px' }}>
            <strong>Status:</strong> <span style={{ color: '#ffff00' }}>LOADED</span>
          </div>
          <div style={{ marginBottom: '10px', borderTop: '1px solid #00ff00', paddingTop: '10px' }}>
            <pre style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              background: '#0a0a0a',
              padding: '8px',
              borderRadius: '4px'
            }}>
              {JSON.stringify(promptCostAlert, null, 2)}
            </pre>
          </div>

          <div style={{ fontSize: '11px', color: '#888', borderTop: '1px solid #333', paddingTop: '8px' }}>
            <div>isActive: {promptCostAlert.isActive ? '✓ true' : '✗ false'}</div>
            <div>cost: ${promptCostAlert.cost}</div>
            <div>message length: {promptCostAlert.alertMessage?.length || 0} chars</div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '5px' }}>
            <strong>Status:</strong> <span style={{ color: '#ff0000' }}>NULL</span>
          </div>
          <div style={{ color: '#ffff00', marginTop: '10px' }}>
            ⚠️ State has not been loaded yet.
            <br />
            Check:
            <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
              <li>Backend is running (Part 1)</li>
              <li>API call succeeded</li>
              <li>Browser console for errors</li>
            </ul>
          </div>
        </div>
      )}

      <div style={{
        fontSize: '10px',
        marginTop: '10px',
        color: '#666',
        borderTop: '1px solid #333',
        paddingTop: '8px'
      }}>
        Part 2 Test Component - Remove after testing
      </div>
    </div>
  );
};
