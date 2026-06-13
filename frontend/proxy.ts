import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Check for access token in cookies
  // We use the raw string "access_token" because we can't import STORAGE_KEYS here easily 
  // without ensuring it's edge-compatible.
  const token = request.cookies.get('access_token');
  const adminToken = request.cookies.get('admin_access_token');
  const { pathname } = request.nextUrl;

  // Define protected routes pattern
  // Protects /merchant and all sub-routes
  if (pathname.startsWith('/merchant')) {
    // Exclude Auth Routes from checks
    if (pathname.includes('/login') || pathname.includes('/register')) {
      // If user is already logged in, redirect to dashboard
      if (token) {
        const dashboardUrl = new URL('/merchant', request.url);
        return NextResponse.redirect(dashboardUrl);
      }
      
      // Allow access to login/register pages under /merchant if not logged in
      return NextResponse.next();
    }

    if (!token) {
      // Redirect to login if no token found
      // Note: Now login is at /merchant/login
      const loginUrl = new URL('/merchant/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === '/admin/login' && adminToken) {
    const adminUrl = new URL('/admin', request.url);
    return NextResponse.redirect(adminUrl);
  }

  // Allow request to proceed
  return NextResponse.next();
}

export const config = {
	matcher: ["/merchant/:path*", "/admin/:path*"],
};
