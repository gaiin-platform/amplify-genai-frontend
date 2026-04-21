import { withAuth } from "next-auth/middleware";
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Performance cache headers applied to all routes
function applyPerformanceHeaders(request: NextRequest, response: NextResponse) {
  // Cache static assets aggressively
  if (request.nextUrl.pathname.startsWith('/_next/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // Cache images
  else if (request.nextUrl.pathname.match(/\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/i)) {
    response.headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  }
  // Cache fonts
  else if (request.nextUrl.pathname.match(/\.(woff|woff2|ttf|otf)$/i)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // API responses
  else if (request.nextUrl.pathname.startsWith('/api/')) {
    if (request.nextUrl.pathname.includes('/models') && request.method === 'GET') {
      response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    } else if (request.nextUrl.pathname.includes('/settings') && request.method === 'GET') {
      response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
    } else if (request.nextUrl.pathname.includes('/chat')) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }

  return response;
}

// Export middleware with custom configuration
export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      // Apply performance headers to the response for auth-protected routes
      // For non-protected routes, the middleware chain handles it via config.matcher
      return !!token;
    }
  },
  pages: {
    signIn: '/'
  }
});

export const config = {
  matcher: [
    // Auth protection for assistant routes
    "/assistants/:path*",
    // Performance headers for static assets (these don't need auth, just cache headers)
    "/_next/static/:path*",
    // Catch images and fonts for cache headers
    "/(.*\\.(?:jpg|jpeg|png|gif|webp|avif|svg|ico|woff|woff2|ttf|otf)$)",
  ]
};
