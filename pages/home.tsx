import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { getSession } from 'next-auth/react';
// @ts-ignore - The home component is in an unusual location
import Home from './api/home/home';

export default Home;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  // Get environment variables needed by the Home component
  // Using Lambda Function URL for faster streaming responses
  const chatEndpoint = process.env.CHAT_ENDPOINT || 'https://avxjw3hiwxhop4rbyvmprg6jku0jtcwq.lambda-url.us-east-1.on.aws/';
  const mixPanelToken = process.env.MIXPANEL_TOKEN || '';
  const cognitoClientId = process.env.COGNITO_CLIENT_ID || '';
  const cognitoDomain = process.env.COGNITO_DOMAIN || '';

  return {
    props: {
      session,
      chatEndpoint,
      mixPanelToken,
      cognitoClientId,
      cognitoDomain,
      ...(await serverSideTranslations(context.locale ?? 'en', [
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