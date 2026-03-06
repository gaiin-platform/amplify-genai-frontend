import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { mcpOAuthExchange } from '@/services/mcpService';

type Status = 'loading' | 'success' | 'error';

export default function MCPOAuthCallback() {
    const router = useRouter();
    const [status, setStatus] = useState<Status>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!router.isReady) return;

        const { code, state, error, error_description } = router.query;

        if (error) {
            setStatus('error');
            setMessage(String(error_description || error));
            return;
        }

        if (!code || !state) {
            setStatus('error');
            setMessage('Missing authorization code or state parameter.');
            return;
        }

        mcpOAuthExchange(String(code), String(state))
            .then(result => {
                if (result.success) {
                    setStatus('success');
                    setMessage('MCP server authenticated successfully. You can close this window.');
                } else {
                    setStatus('error');
                    setMessage(result.error || 'Token exchange failed. Please try again.');
                }
            })
            .catch((err: unknown) => {
                setStatus('error');
                setMessage((err instanceof Error ? err.message : null) || 'An unexpected error occurred.');
            });
    }, [router.isReady, router.query]);

    const color = status === 'success' ? '#2ecc71' : status === 'error' ? '#e74c3c' : '#3498db';
    const heading = status === 'success' ? '✓ Connected' : status === 'error' ? '✕ Authentication Failed' : 'Connecting…';

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', margin: 0, background: '#f0f0f0' }}>
            <div style={{ textAlign: 'center', padding: '2rem', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,.1)', maxWidth: '400px' }}>
                <h1 style={{ color, marginBottom: '0.5rem' }}>{heading}</h1>
                {status === 'loading' ? (
                    <div style={{ border: '3px solid #f3f3f3', borderTop: '3px solid #3498db', borderRadius: '50%', width: 40, height: 40, margin: '1rem auto', animation: 'spin 1s linear infinite' }} />
                ) : (
                    <>
                        <p style={{ color: '#555', marginBottom: '1.5rem', wordBreak: 'break-word' }}>{message}</p>
                        <button
                            style={{ padding: '0.5rem 1.5rem', background: color, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
                            onClick={() => window.close()}
                        >
                            Close
                        </button>
                    </>
                )}
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
