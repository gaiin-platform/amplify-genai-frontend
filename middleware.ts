import { withAuth } from "next-auth/middleware";

// Export middleware with custom configuration
export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token
  },
  pages: {
    signIn: '/'
  }
});

export const config = {
  matcher: "/assistants/:path*"
}; 