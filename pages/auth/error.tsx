import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Error() {
  const router = useRouter();
  const { error } = router.query;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <div className="mt-4 text-center text-red-600">
            {error === 'Configuration' && 'There is a problem with the server configuration.'}
            {error === 'AccessDenied' && 'Access was denied.'}
            {error === 'Verification' && 'The verification token has expired or has already been used.'}
            {!error && 'An unknown error occurred.'}
          </div>
        </div>
        <div className="mt-8 text-center">
          <Link href="/auth/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
            Try signing in again
          </Link>
        </div>
        <div className="mt-4 text-center text-sm text-gray-600">
          <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}