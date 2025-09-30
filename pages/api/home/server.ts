import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
    const chatEndpoint = process.env.CHAT_ENDPOINT;
    const mixPanelToken = process.env.MIXPANEL_TOKEN;
    const cognitoClientId = process.env.COGNITO_CLIENT_ID;
    const cognitoDomain = process.env.COGNITO_DOMAIN;
    const aiEmailDomain = process.env.AI_EMAIL_DOMAIN || '';

    return {
        props: {
            chatEndpoint,
            mixPanelToken,
            cognitoClientId,
            cognitoDomain,
            aiEmailDomain,
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