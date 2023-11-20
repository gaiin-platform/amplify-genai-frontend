import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';

console.log(process.env.AUTH0_CLIENT_ID);
console.log(process.env.AUTH0_CLIENT_SECRET);
console.log(process.env.AUTH0_SCOPE);
console.log(process.env.AUTH0_AUDIENCE);
console.log(process.env.AUTH0_SECRET);
export const AUTH0_SECRET=process.env.AUTH0_SECRET;
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