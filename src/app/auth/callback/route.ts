import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Prevent open redirect: next must be a relative path with no protocol or double-slash
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = /^\/[^/]/.test(rawNext) ? rawNext : '/dashboard'

  if (code && /^[a-zA-Z0-9_-]{20,500}$/.test(code)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
