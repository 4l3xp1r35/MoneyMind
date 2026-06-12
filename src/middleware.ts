import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/transactions/:path*", "/budget/:path*", "/investments", "/investments/:path*", "/settings/:path*", "/settings"],
};
