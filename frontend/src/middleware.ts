import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Block requests probing for Server Actions - this app uses none
  if (request.headers.has('next-action')) {
    return new NextResponse(null, { status: 400 });
  }

  const response = NextResponse.next()

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  if (process.env.NODE_ENV === 'production') {
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : '*.supabase.co';
    response.headers.set(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://${supabaseHost} https://images.dog.ceo https://randomfox.ca https://cdn2.thecatapi.com; font-src 'self'; connect-src 'self' https://${supabaseHost} https://plausible.io https://api.resend.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`
    )
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
