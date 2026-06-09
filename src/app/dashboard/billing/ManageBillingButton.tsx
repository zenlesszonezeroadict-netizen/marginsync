// Shopify App Billing subscriptions are managed directly in the merchant's
// Shopify Admin under Apps → MarginSync. This component links there.

export function ManageBillingButton({ shopDomain }: { shopDomain: string }) {
  const adminUrl = `https://${shopDomain}/admin/charges/app`

  return (
    <a
      href={adminUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 border border-gray-200 bg-white text-sm font-medium text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
    >
      Manage billing in Shopify
      <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 8h10M8 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}
