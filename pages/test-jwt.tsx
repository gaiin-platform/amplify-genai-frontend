import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function TestJWT() {
  const { data: session, status } = useSession();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testJWT = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/test-jwt');
      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>JWT Test Page</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Session Status: {status}</h2>
        {session && (
          <div>
            <p>User: {session.user?.email}</p>
            <p>Access Token: {session.accessToken ? 'Present' : 'Missing'}</p>
            {session.accessToken && (
              <p>Token Preview: {(session.accessToken as string).substring(0, 50)}...</p>
            )}
          </div>
        )}
      </div>

      <button 
        onClick={testJWT} 
        disabled={loading || status !== 'authenticated'}
        style={{ 
          padding: '10px 20px', 
          fontSize: '16px',
          backgroundColor: status === 'authenticated' ? '#2563eb' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: status === 'authenticated' ? 'pointer' : 'not-allowed'
        }}
      >
        {loading ? 'Testing...' : 'Test JWT Against Backend'}
      </button>

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h2>Test Result:</h2>
          <pre style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '400px'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}