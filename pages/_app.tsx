import {Toaster} from 'react-hot-toast';
import {QueryClient, QueryClientProvider} from 'react-query';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import {appWithTranslation} from 'next-i18next';
import type {AppProps} from 'next/app';
import {Inter} from 'next/font/google';

import '@/styles/globals.css';

const inter = Inter({subsets: ['latin']});

function App({ Component, pageProps }: AppProps) {
    const queryClient = new QueryClient();

    return (
        <UserProvider>
            <div className={inter.className}>
                <Toaster/>
                <QueryClientProvider client={queryClient}>
                    <Component {...pageProps} />
                </QueryClientProvider>
            </div>
        </UserProvider>
    );
}

export default appWithTranslation(App);
