import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export { default } from '@/components/Home';

// Lives in the page file (not components/) so Next strips server-only code
// (serverSideTranslations -> fs) from the client bundle.
export const getServerSideProps: GetServerSideProps = async ({ locale }) => {

    const chatEndpoint = process.env.CHAT_ENDPOINT;
    const mixPanelToken = process.env.MIXPANEL_TOKEN;
    const cognitoClientId = process.env.COGNITO_CLIENT_ID;
    const cognitoDomain = process.env.COGNITO_DOMAIN;
    
    // const googleApiKey = process.env.GOOGLE_API_KEY;
    // const googleCSEId = process.env.GOOGLE_CSE_ID;
    // if (googleApiKey && googleCSEId) {
    //     serverSidePluginKeysSet = true;
    // }

    return {
        props: {
            chatEndpoint,
            mixPanelToken,
            cognitoClientId,
            cognitoDomain,
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
