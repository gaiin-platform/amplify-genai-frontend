import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';

console.log(process.env.AUTH0_CLIENT_ID);
console.log(process.env.AUTH0_CLIENT_SECRET);
console.log(process.env.AUTH0_SCOPE);
console.log(process.env.AUTH0_AUDIENCE);
console.log(process.env.AUTH0_SECRET);
export const AUTH0_SECRET=process.env.AUTH0_SECRET;
export const issuerBaseURL=process.env.AUTH0_ISSUER_BASE_URL;
export const baseURL=process.env.AUTH0_BASE_URL;
export const clientID=process.env.AUTH0_CLIENT_ID;
export const clientSecret=process.env.AUTH0_CLIENT_SECRET;
console.log(AUTH0_SECRET);

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