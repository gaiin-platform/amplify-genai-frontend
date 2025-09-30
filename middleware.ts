import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Log all requests for debugging the redirect loop
  console.log('=== Middleware: Request ===');
  console.log('URL:', request.url);
  console.log('Pathname:', request.nextUrl.pathname);
  console.log('Search params:', request.nextUrl.searchParams.toString());
  console.log('Headers:', {
    host: request.headers.get('host'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
    'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    'x-forwarded-for': request.headers.get('x-forwarded-for'),
    'x-forwarded-port': request.headers.get('x-forwarded-port'),
    referer: request.headers.get('referer'),
  });
  
  // Check cookies
  const sessionToken = request.cookies.get('next-auth.session-token');
  const csrfToken = request.cookies.get('next-auth.csrf-token');
  console.log('Session token exists:', !!sessionToken);
  console.log('CSRF token exists:', !!csrfToken);
  
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    console.log('>>> This is an auth API request');
  }
  console.log('================================');

  // Continue with the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};