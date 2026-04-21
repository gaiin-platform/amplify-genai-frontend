import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

const COGNITO_REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';
const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function ResetPasswordPage() {
  const router = useRouter();
  const { email } = router.query;

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const allRequirementsMet = PASSWORD_REQUIREMENTS.every((req) => req.test(password));
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = code.length >= 6 && allRequirementsMet && passwordsMatch && !loading;

  useEffect(() => {
    if (!email && router.isReady) {
      router.push('/auth/forgot-password');
    }
  }, [email, router]);

  const handleResendCode = async () => {
    setResending(true);
    setResendSuccess(false);
    try {
      await fetch(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.ForgotPassword',
        },
        body: JSON.stringify({ ClientId: COGNITO_CLIENT_ID, Username: email }),
      });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
          },
          body: JSON.stringify({
            ClientId: COGNITO_CLIENT_ID,
            Username: email,
            ConfirmationCode: code,
            Password: password,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        const errorType = data.__type || '';

        if (errorType.includes('CodeMismatchException')) {
          setError('Invalid verification code. Please check and try again.');
          return;
        }
        if (errorType.includes('ExpiredCodeException')) {
          setError('Verification code has expired. Please request a new one.');
          return;
        }
        if (errorType.includes('InvalidPasswordException')) {
          setError('Password does not meet requirements. Please check and try again.');
          return;
        }
        if (errorType.includes('LimitExceededException')) {
          setError('Too many attempts. Please try again later.');
          return;
        }
        setError('Unable to reset password. Please try again.');
        return;
      }

      router.push('/auth/reset-success');
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Reset Password - Amplify</title>
      </Head>
      <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-xl border border-gray-700">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">Enter verification code</h1>
            <p className="text-gray-400 mt-2 text-sm">
              We sent a code to <span className="text-white font-medium">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Verification Code */}
            <div className="mb-4">
              <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">
                Verification code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                autoComplete="one-time-code"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-2xl tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="000000"
                maxLength={6}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending}
                  className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-500 transition-colors"
                >
                  {resending ? 'Resending...' : resendSuccess ? 'Code sent!' : 'Resend code'}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                New password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new password"
              />
              {/* Password requirements checklist */}
              <ul className="mt-3 space-y-1" aria-label="Password requirements">
                {PASSWORD_REQUIREMENTS.map((req) => (
                  <li
                    key={req.label}
                    className={`flex items-center gap-2 text-xs ${
                      password.length === 0
                        ? 'text-gray-500'
                        : req.test(password)
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    <span aria-hidden="true">{password.length === 0 ? '-' : req.test(password) ? '\u2713' : '\u2717'}</span>
                    <span>{req.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirm Password */}
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm new password"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div role="alert" className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              Try a different email
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
