import { NextRequest, NextResponse } from 'next/server';
import { withMiddlewareAuthRequired, getSession } from '@auth0/nextjs-auth0/edge';



export default withMiddlewareAuthRequired(async (req: NextRequest) => {
    const res = NextResponse.next();
    const user = await getSession(req, res);

    return res;
});

// only work on the '/' path
export const config = {
    matcher: ['/api/chat','/api/models','/api/google'],
};