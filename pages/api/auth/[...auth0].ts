import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';


export default handleAuth({
    // @ts-ignore
    async login(req, res) {
        try {
            await handleLogin(req, res, {
                authorizationParams: {
                    connection_scope: 'openid profile',
                },
            });
        } catch (error: unknown) {
            console.error(error);
        }
    },
});