import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const REQUIRED_ENV_KEYS = [
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TOKEN_ENCRYPTION_KEY',
]

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-health-secret')

  if (!secret || secret !== process.env.INTERNAL_HEALTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const timestamp = new Date().toISOString()

  try {
    const supabase = createAdminClient()
    const { error: dbError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
    if (dbError) throw new Error(`Database: ${dbError.message}`)

    const envLoaded = REQUIRED_ENV_KEYS.every(k => Boolean(process.env[k]))

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp,
        checks: {
          database: 'connected',
          environment: envLoaded ? 'validated' : 'missing_keys',
        },
      },
      { status: envLoaded ? 200 : 500 }
    )
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', timestamp },
      { status: 500 }
    )
  }
}
