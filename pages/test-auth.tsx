import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function TestAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { error, callbackUrl } = router.query;

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Debug Page</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Session Status:</h2>
          <pre className="bg-gray-100 p-2">{status}</pre>
        </div>

        <div>
          <h2 className="font-semibold">Query Parameters:</h2>
          <pre className="bg-gray-100 p-2">{JSON.stringify({ error, callbackUrl }, null, 2)}</pre>
        </div>

        <div>
          <h2 className="font-semibold">Session Data:</h2>
          <pre className="bg-gray-100 p-2">{JSON.stringify(session, null, 2)}</pre>
        </div>

        <div>
          <h2 className="font-semibold">Environment Check:</h2>
          <pre className="bg-gray-100 p-2">
            NEXTAUTH_URL: {process.env.NEXTAUTH_URL || 'not set'}
            NODE_ENV: {process.env.NODE_ENV}
          </pre>
        </div>

        <div className="mt-4">
          <a href="/" className="text-blue-500 underline">Back to Home (without auth check)</a>
        </div>
      </div>
    </div>
  );
}