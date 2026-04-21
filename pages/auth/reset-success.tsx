import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function ResetSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <>
      <Head>
        <title>Password Reset Successful - Amplify</title>
      </Head>
      <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-xl border border-gray-700 text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-6"
            aria-hidden="true"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Password reset successful</h1>
          <p className="text-gray-400 mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>

          <Link
            href="/"
            className="inline-block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
          >
            Sign in
          </Link>

          <p className="mt-4 text-sm text-gray-500" aria-live="polite">
            Redirecting to sign in in {countdown} seconds...
          </p>
        </div>
      </main>
    </>
  );
}
