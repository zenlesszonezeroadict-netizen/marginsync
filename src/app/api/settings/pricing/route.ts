import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { PricingRule } from '@/lib/pricing/types'
import type { Json } from '@/lib/types/database'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: org } = await supabase
    .from('organizations')
    .select('pricing_rule, margin_target_pct')
    .eq('id', membership.organization_id)
    .single()

  return NextResponse.json({
    pricingRule: (org?.pricing_rule as PricingRule | null) ?? { type: 'markup', value: 1.4, rounding: '0.99' },
    marginTargetPct: org?.margin_target_pct ?? 30,
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const body = await request.json() as {
    pricingRule?: PricingRule
    marginTargetPct?: number
  }

  if (body.pricingRule !== undefined) {
    if (
      body.pricingRule.type !== 'markup' ||
      typeof body.pricingRule.value !== 'number' ||
      body.pricingRule.value <= 0 ||
      !['0.99', '0.00', 'none'].includes(body.pricingRule.rounding)
    ) {
      return NextResponse.json({ error: 'Invalid pricing rule' }, { status: 400 })
    }
    // Validate Step-3 scarcity rules if present
    if (body.pricingRule.scarcityRules !== undefined) {
      if (!Array.isArray(body.pricingRule.scarcityRules)) {
        return NextResponse.json({ error: 'scarcityRules must be an array' }, { status: 400 })
      }
      for (const sr of body.pricingRule.scarcityRules) {
        if (
          typeof sr.inventoryThreshold !== 'number' ||
          sr.inventoryThreshold <= 0 ||
          typeof sr.extraMarkupPct !== 'number' ||
          sr.extraMarkupPct < 0 ||
          sr.extraMarkupPct > 500
        ) {
          return NextResponse.json(
            { error: 'Each scarcity rule needs inventoryThreshold > 0 and extraMarkupPct 0–500' },
            { status: 400 }
          )
        }
      }
    }
  }

  if (body.marginTargetPct !== undefined) {
    if (typeof body.marginTargetPct !== 'number' || body.marginTargetPct < 0 || body.marginTargetPct > 100) {
      return NextResponse.json({ error: 'marginTargetPct must be 0–100' }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  if (body.pricingRule !== undefined && body.marginTargetPct !== undefined) {
    await admin
      .from('organizations')
      .update({ pricing_rule: body.pricingRule as unknown as Json, margin_target_pct: body.marginTargetPct })
      .eq('id', membership.organization_id)
  } else if (body.pricingRule !== undefined) {
    await admin
      .from('organizations')
      .update({ pricing_rule: body.pricingRule as unknown as Json })
      .eq('id', membership.organization_id)
  } else if (body.marginTargetPct !== undefined) {
    await admin
      .from('organizations')
      .update({ margin_target_pct: body.marginTargetPct })
      .eq('id', membership.organization_id)
  }

  return NextResponse.json({ ok: true })
}
