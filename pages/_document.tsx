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
        {/* PWA Meta */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Amplify" />

        {/* SEO & Accessibility Meta */}
        <meta name="description" content="Amplify - AI-powered chat assistant for Holy Family University. Access Claude, GPT, and Gemini models in one unified interface." />
        <meta name="theme-color" content="#202123" />

        {/* Accessibility - ensure text scaling works */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
