import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

const COGNITO_REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';
const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call Cognito ForgotPassword API directly
      const response = await fetch(
        `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.ForgotPassword',
          },
          body: JSON.stringify({
            ClientId: COGNITO_CLIENT_ID,
            Username: email,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        const errorType = data.__type || '';

        if (errorType.includes('UserNotFoundException')) {
          // Don't reveal whether user exists — show success anyway
          router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
          return;
        }
        if (errorType.includes('LimitExceededException')) {
          setError('Too many attempts. Please try again later.');
          return;
        }
        setError('Unable to process your request. Please try again.');
        return;
      }

      // Success — redirect to code entry page
      router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Forgot Password - Amplify</title>
      </Head>
      <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-xl border border-gray-700">
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4"
              aria-hidden="true"
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Reset your password</h1>
            <p className="text-gray-400 mt-2">
              Enter your email address and we&apos;ll send you a verification code.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                aria-describedby={error ? 'email-error' : undefined}
              />
            </div>

            {error && (
              <div id="email-error" role="alert" className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              {loading ? 'Sending...' : 'Send verification code'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
