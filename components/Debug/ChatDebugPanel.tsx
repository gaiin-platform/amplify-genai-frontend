import { Session } from 'next-auth';
import { FC, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';

interface Props {
  isOpen: boolean;
}

export const ChatDebugPanel: FC<Props> = ({ isOpen }) => {
  const { data: session, status } = useSession();
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      let info = '=== Authentication Debug Info ===\n\n';
      info += `Authentication Flow:\n`;
      info += `   - Status: ${status}\n`;
      info += `   - Has Session: ${!!session}\n`;
      // Fixed: Using type assertion to access accessToken if it exists
      info += `   - Has Access Token: ${!!(session as any)?.accessToken}\n`;
      info += `   - Session Error: ${(session as any)?.error || 'None'}\n`;
      
      if ((session as any)?.accessToken) {
        info += `   - Token Type: JWT\n`;
      }
      
      setDebugInfo(info);
    }
  }, [session, status, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-md z-50">
      <h3 className="font-bold mb-2">Debug Panel</h3>
      <pre className="text-xs overflow-auto max-h-64">{debugInfo}</pre>
      {status === 'unauthenticated' && (
        <button 
          onClick={() => signIn('cognito')}
          className="mt-2 bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-sm"
        >
          Sign In
        </button>
      )}
    </div>
  );
};
