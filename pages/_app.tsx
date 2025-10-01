import {Toaster} from 'react-hot-toast';
import {QueryClient, QueryClientProvider} from 'react-query';
import { SessionProvider } from "next-auth/react"
import {appWithTranslation} from 'next-i18next';
import type {AppProps} from 'next/app';
import {Inter} from 'next/font/google';
import { useEffect } from 'react';

import '@/styles/globals.css';

const inter = Inter({subsets: ['latin']});

function App({ Component, pageProps }: AppProps) {
    const queryClient = new QueryClient();

    // Initialize chat color palette on app load
    useEffect(() => {
        const savedPalette = localStorage.getItem('chatColorPalette');
        if (savedPalette) {
            document.body.setAttribute('data-chat-palette', savedPalette);
        } else {
            // Set default palette
            document.body.setAttribute('data-chat-palette', 'warm-browns');
        }
    }, []);

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