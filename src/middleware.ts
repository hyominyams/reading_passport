import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateSession } from '@/lib/supabase/middleware';

const protectedRoutes = ['/map', '/book', '/library', '/teacher', '/admin', '/onboarding', '/passport', '/mypage'];
const teacherRoutes = ['/teacher'];
const adminRoutes = ['/admin'];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // Check if the route is protected
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtected) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Check role-based access using service role (bypasses RLS)
  const isTeacherRoute = teacherRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAdminRoute = adminRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isTeacherRoute || isAdminRoute) {
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: profile } = await serviceClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (isAdminRoute && profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/map';
      return NextResponse.redirect(url);
    }

    if (isTeacherRoute && profile?.role !== 'teacher' && profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/map';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
