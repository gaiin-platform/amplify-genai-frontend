// Temporary fix - the home components are misplaced in pages/api/home/
// They should be moved out of the api folder, but for now we'll create a simple page

import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  useEffect(() => {
    if (status === 'loading') return; // Still loading
    
    if (!session) {
      // Not signed in, redirect to Cognito
      signIn('cognito');
    } else {
      // Signed in, redirect to home
      router.push('/home');
    }
  }, [router, session, status]);
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 dark:from-black dark:to-gray-900">
      <div className="text-center animate-fade-in">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full animate-pulse">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to Amplify</h1>
        <p className="text-gray-300 text-lg">
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <span>Checking authentication</span>
              <span className="loading-dots"></span>
            </span>
          ) : (
            'Redirecting to sign in...'
          )}
        </p>
        {status === 'unauthenticated' && (
          <p className="mt-4 text-sm text-gray-400">
            You will be redirected to sign in automatically
          </p>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'en', [
        'common',
        'chat',
        'sidebar',
        'markdown',
        'promptbar',
        'settings',
      ])),
    },
  };
};