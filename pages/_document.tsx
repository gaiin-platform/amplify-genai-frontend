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
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `
          // Settings fix for localStorage compatibility
          try {
            const settingsKey = 'settings';
            const settingsJson = localStorage.getItem(settingsKey);
            
            if (settingsJson) {
              const settings = JSON.parse(settingsJson);
              
              // Ensure featureOptions exists
              if (!settings.featureOptions) {
                settings.featureOptions = {};
                localStorage.setItem(settingsKey, JSON.stringify(settings));
                console.log('Fixed settings: added missing featureOptions');
              }
            }
          } catch (e) {
            console.error('Settings fix error:', e);
          }
        ` }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
