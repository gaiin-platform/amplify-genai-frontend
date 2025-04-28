import React, { useState } from 'react';
import { Modal } from './Modal';

const helpContent = (
  <div>
    <h2 className="text-lg font-bold mb-2">Help & Guidelines</h2>
    <ul className="list-disc pl-5 space-y-2 text-sm">
      <li>Do not rely solely on AI for critical information.</li>
      <li>Use AI ethically and do not plagiarize.</li>
      <li>Be aware of biases in AI models.</li>
      <li>Choose reputable AI tools.</li>
      <li>Balance AI with real-world learning.</li>
    </ul>
  </div>
);

const FloatingHelpButtonWithModal = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="floating-help-btn"
        onClick={() => setOpen(true)}
        aria-label="Help"
      >
        ?
      </button>
      {open && (
        <Modal
          title="Help & Guidelines"
          content={helpContent}
          showClose={true}
          showCancel={false}
          showSubmit={false}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default FloatingHelpButtonWithModal; 