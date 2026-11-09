/**
 * ChatBusyNoticeHost — renders the "please wait" notice when the user tries to send while a
 * different chat is still generating. Mounted once at the new-UI root in `home.tsx`; raised by
 * `blockIfOtherChatGenerating()` (hooks/useChatSendService) via a window event, so any send
 * entry point (landing page, composer, retry/edit) can trigger it.
 */
import React, { useEffect, useState } from 'react';
import { NoticeDialog } from './NoticeDialog';
import { CHAT_BUSY_EVENT } from '@/hooks/useChatSendService';

export const ChatBusyNoticeHost: React.FC = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onBusy = () => setOpen(true);
    window.addEventListener(CHAT_BUSY_EVENT, onBusy);
    return () => window.removeEventListener(CHAT_BUSY_EVENT, onBusy);
  }, []);
  return (
    <NoticeDialog
      open={open}
      title="Another chat is still responding"
      message="Please wait for your other prompt to finish before sending a new one. Your message has been kept."
      onClose={() => setOpen(false)}
    />
  );
};
