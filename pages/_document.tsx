import { DocumentProps, Head, Html, Main, NextScript } from 'next/document';

import i18nextConfig from '../next-i18next.config';

type Props = DocumentProps & {
  // add custom document props
};

export default function Document(props: Props) {
  const currentLocale =
    props.__NEXT_DATA__.locale ?? i18nextConfig.i18n.defaultLocale;
  return (
    <Html lang={currentLocale}>
      <Head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Amplify"></meta>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var settingsStr = localStorage.getItem('settings');
                  console.log('[Theme Debug] _document script - localStorage settings:', settingsStr);
                  var settings = JSON.parse(settingsStr || '{}');
                  var theme = settings.theme || '${process.env.NEXT_PUBLIC_DEFAULT_THEME || 'light'}';
                  console.log('[Theme Debug] _document script - resolved theme:', theme);
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    console.log('[Theme Debug] _document script - added dark class');
                  } else {
                    console.log('[Theme Debug] _document script - NOT adding dark class (theme is light)');
                  }
                } catch (e) {
                  console.error('[Theme Debug] _document script error:', e);
                }
              })();
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
