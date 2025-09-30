import { GetServerSidePropsContext } from 'next';
import { getCsrfToken, getProviders, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

interface Props {
  providers: any;
  csrfToken: string;
}

export default function SignIn({ providers, csrfToken }: Props) {
  const router = useRouter();
  const { error, callbackUrl } = router.query;

  // Log for debugging
  useEffect(() => {
    console.log('[SignIn Page] Mounted with error:', error);
    console.log('[SignIn Page] CallbackUrl:', callbackUrl);
    console.log('[SignIn Page] Providers:', Object.keys(providers || {}));
  }, [error, callbackUrl, providers]);

  // Removed auto-redirect to prevent loops

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Amplify
          </h2>
          {error && (
            <div className="mt-4 text-center text-red-600">
              {error === 'OAuthSignin' && 'Error signing in with OAuth provider'}
              {error === 'OAuthCallback' && 'Error in OAuth callback'}
              {error === 'OAuthCreateAccount' && 'Could not create OAuth account'}
              {error === 'EmailCreateAccount' && 'Could not create email account'}
              {error === 'Callback' && 'Error in callback handler'}
              {error === 'Default' && 'Unable to sign in'}
            </div>
          )}
        </div>
        <div className="mt-8 space-y-6">
          {providers && Object.values(providers).map((provider: any) => (
            <div key={provider.name}>
              <button
                onClick={() => signIn(provider.id, { callbackUrl: callbackUrl as string || '/' })}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign in with {provider.name}
              </button>
            </div>
          ))}
        </div>
        <div className="text-center text-sm text-gray-600">
          <a href="/" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const providers = await getProviders();
  const csrfToken = await getCsrfToken(context);

  return {
    props: { providers, csrfToken },
  };
}