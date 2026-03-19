export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/transactions/:path*", "/budget/:path*", "/investments", "/investments/:path*", "/settings/:path*", "/settings"],
};
