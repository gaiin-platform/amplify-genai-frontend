import {Toaster} from 'react-hot-toast';
import {QueryClient, QueryClientProvider} from 'react-query';
import { SessionProvider } from "next-auth/react"
import {appWithTranslation} from 'next-i18next';
import type {AppProps} from 'next/app';
import {Inter} from 'next/font/google';
import { initializeHasOwnPropertyFix } from '@/utils/app/hasOwnPropertyFix';

import '@/styles/globals.css';

// Initialize hasOwnProperty fix on app load
if (typeof window !== 'undefined') {
  initializeHasOwnPropertyFix();
}

const inter = Inter({subsets: ['latin']});

function App({ Component, pageProps }: AppProps) {
    const queryClient = new QueryClient();

    return (
        <SessionProvider
            refetchInterval={60}
            refetchOnWindowFocus={true}
            refetchWhenOffline={false}
        >
            <div className={inter.className}>
                <Toaster/>
                <QueryClientProvider client={queryClient}>
                    <Component {...pageProps} />
                </QueryClientProvider>
            </div>
        </SessionProvider>
    );
}

export default appWithTranslation(App);
