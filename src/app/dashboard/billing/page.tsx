import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UpgradeButton } from './UpgradeButton'
import { ManageBillingButton } from './ManageBillingButton'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/dashboard')

  const admin = createAdminClient()

  const [{ data: org }, { data: connection }] = await Promise.all([
    admin
      .from('organizations')
      .select('plan, subscription_status')
      .eq('id', membership.organization_id)
      .single(),
    admin
      .from('shopify_connections')
      .select('shop_domain')
      .eq('organization_id', membership.organization_id)
      .single(),
  ])

  const isPro = org?.plan === 'pro'
  const hasShopify = !!connection?.shop_domain

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">
          MarginSync Pro is billed through your Shopify account — no credit card required outside of Shopify.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Current plan</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {org?.subscription_status === 'active'
                ? 'Active Shopify subscription'
                : org?.subscription_status === 'frozen'
                ? 'Subscription frozen — check Shopify billing'
                : 'Free tier'}
            </p>
          </div>
          <span className={[
            'text-xs font-semibold rounded-full px-3 py-1.5 border',
            isPro
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : 'bg-gray-50 text-gray-600 border-gray-200',
          ].join(' ')}>
            {isPro ? 'Pro' : 'Free'}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Plan features</p>
          <div className="space-y-2">
            {[
              { feature: 'Supplier file upload (CSV / XLSX)', included: true },
              { feature: 'SKU fuzzy-matching engine', included: true },
              { feature: 'Pricing rule engine + margin flags', included: true },
              { feature: 'Shopify catalog sync', included: true },
              { feature: 'Bulk price write to Shopify', included: isPro, proOnly: true },
              { feature: 'Unlimited repricing runs', included: isPro, proOnly: true },
              { feature: 'CSV export', included: isPro, proOnly: true },
            ].map(({ feature, included, proOnly }) => (
              <div key={feature} className="flex items-center gap-2.5">
                {included ? (
                  <svg className="h-4 w-4 text-emerald-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-gray-300 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                )}
                <span className={`text-sm ${included ? 'text-gray-700' : 'text-gray-400'}`}>
                  {feature}
                  {proOnly && !isPro && (
                    <span className="ml-1.5 text-xs font-medium text-indigo-600">Pro</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isPro ? (
        <div className="flex items-center gap-4">
          {hasShopify && <ManageBillingButton shopDomain={connection!.shop_domain} />}
        </div>
      ) : (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
          <p className="text-base font-semibold text-indigo-900 mb-1">Upgrade to Pro — $19/month</p>
          <p className="text-sm text-indigo-700 mb-4">
            Billed through your Shopify account. Cancel any time from your Shopify Admin.
          </p>
          <UpgradeButton hasShopify={hasShopify} />
        </div>
      )}
    </div>
  )
}
