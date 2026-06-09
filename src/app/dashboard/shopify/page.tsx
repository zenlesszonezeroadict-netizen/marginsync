import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ConnectForm } from './ConnectForm'
import { SyncButton } from './SyncButton'

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string }>
}

export default async function ShopifyPage({ searchParams }: PageProps) {
  const { connected, error } = await searchParams

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
  const { data: connection } = await admin
    .from('shopify_connections')
    .select('id, shop_domain, installed_at')
    .eq('organization_id', membership.organization_id)
    .single()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Shopify Connection</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect your Shopify store to match supplier SKUs against your live catalog.
        </p>
      </div>

      {connected === '1' && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4">
          <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-semibold text-emerald-800">
            Store connected successfully.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-5 py-4">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">Connection failed</p>
            <p className="text-xs text-red-700 mt-0.5">{errorMessage(error)}</p>
          </div>
        </div>
      )}

      {connection ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">{connection.shop_domain}</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Connected {new Date(connection.installed_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2.5 py-1">
                Active
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Sync catalog</h2>
            <p className="text-xs text-gray-500 mb-4">
              Pull your latest product variants and prices from Shopify. Run this after adding new products or updating SKUs in Shopify.
            </p>
            <SyncButton />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Reconnect store</h2>
            <p className="text-xs text-gray-500 mb-4">
              If you&apos;ve changed your API credentials or revoked access, reconnect here.
            </p>
            <ConnectForm />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Connect your store</h2>
          <p className="text-xs text-gray-500 mb-4">
            Enter your Shopify store URL to start the OAuth connection.
          </p>
          <ConnectForm />
        </div>
      )}
    </div>
  )
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    invalid_shop: 'Invalid shop domain. Must be a *.myshopify.com address.',
    invalid_state: 'Security check failed. Please try connecting again.',
    invalid_hmac: 'Shopify signature verification failed.',
    token_exchange_failed: 'Could not exchange authorization code for access token.',
    no_token: 'Shopify did not return an access token.',
    config_error: 'Shopify API credentials are not configured.',
    db_error: 'Failed to save connection to database.',
    no_org: 'No organization found for your account.',
  }
  return messages[code] ?? `Unknown error: ${code}`
}
