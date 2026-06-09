import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Persist auth cookies for 30 days so standalone browser users
              // stay logged in across browser restarts. Falls back to the value
              // Supabase already set (e.g. short-lived PKCE state cookies).
              maxAge: options.maxAge ?? SESSION_MAX_AGE,
            })
          )
        },
      },
    }
  )

  // Refresh session — must happen before any conditional logic
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, searchParams } = request.nextUrl

  // Shopify App Bridge sends ?shop=...&host=... on every embedded app launch.
  // Capture them so the login page can show the correct install/connect UI.
  const shop = searchParams.get('shop')
  const host = searchParams.get('host')
  const isShopifyEmbed = !!(shop && host)

  // Unauthenticated user trying to access a protected route
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Forward Shopify embed params so /login knows to bypass the standard email UI
    if (isShopifyEmbed) {
      url.searchParams.set('shop', shop)
      url.searchParams.set('host', host)
    }
    return NextResponse.redirect(url)
  }

  // Authenticated user hitting login page → send to dashboard
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
