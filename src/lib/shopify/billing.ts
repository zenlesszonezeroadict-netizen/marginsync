// ============================================================
// Shopify App Billing — GraphQL client
// Uses the store's per-merchant access token (decrypted from
// shopify_connections) to call the Admin GraphQL API.
// ============================================================

const API_VERSION = '2024-01'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppSubscriptionStatus =
  | 'ACTIVE'
  | 'CANCELLED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'FROZEN'
  | 'PENDING'

export interface AppSubscription {
  id: string           // GID: "gid://shopify/AppSubscription/123"
  status: AppSubscriptionStatus
  name: string
}

// ---------------------------------------------------------------------------
// GraphQL helper
// ---------------------------------------------------------------------------

async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(
    `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${text}`)
  }
  const json = (await res.json()) as { data: T; errors?: { message: string }[] }
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`)
  }
  return json.data
}

// ---------------------------------------------------------------------------
// createSubscription
// Calls appSubscriptionCreate and returns the Shopify-hosted confirmation URL.
// After the merchant approves, Shopify redirects to returnUrl?charge_id={id}.
// ---------------------------------------------------------------------------

const CREATE_SUBSCRIPTION = /* GraphQL */ `
  mutation appSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $test: Boolean
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      lineItems: $lineItems
    ) {
      userErrors { field message }
      appSubscription { id status }
      confirmationUrl
    }
  }
`

export async function createSubscription({
  shopDomain,
  accessToken,
  returnUrl,
  test = false,
}: {
  shopDomain: string
  accessToken: string
  returnUrl: string
  test?: boolean
}): Promise<{ confirmationUrl: string; subscriptionId: string }> {
  const data = await shopifyGraphQL<{
    appSubscriptionCreate: {
      userErrors: { field: string; message: string }[]
      appSubscription: { id: string; status: string } | null
      confirmationUrl: string | null
    }
  }>(shopDomain, accessToken, CREATE_SUBSCRIPTION, {
    name: 'MarginSync Pro',
    returnUrl,
    test,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount: '19.00', currencyCode: 'USD' },
            interval: 'EVERY_30_DAYS',
          },
        },
      },
    ],
  })

  const result = data.appSubscriptionCreate
  if (result.userErrors.length > 0) {
    throw new Error(`Shopify billing error: ${result.userErrors[0].message}`)
  }
  if (!result.confirmationUrl || !result.appSubscription) {
    throw new Error('No confirmationUrl returned from Shopify')
  }

  return {
    confirmationUrl: result.confirmationUrl,
    subscriptionId: result.appSubscription.id,
  }
}

// ---------------------------------------------------------------------------
// getSubscription
// Verifies a subscription by GID after the merchant approves.
// charge_id from the returnUrl query param maps to:
// "gid://shopify/AppSubscription/{charge_id}"
// ---------------------------------------------------------------------------

const GET_SUBSCRIPTION = /* GraphQL */ `
  query GetSubscription($id: ID!) {
    node(id: $id) {
      ... on AppSubscription {
        id
        status
        name
      }
    }
  }
`

export async function getSubscription(
  shopDomain: string,
  accessToken: string,
  chargeId: string
): Promise<AppSubscription | null> {
  const gid = `gid://shopify/AppSubscription/${chargeId}`
  const data = await shopifyGraphQL<{ node: AppSubscription | null }>(
    shopDomain,
    accessToken,
    GET_SUBSCRIPTION,
    { id: gid }
  )
  return data.node
}

// ---------------------------------------------------------------------------
// getCurrentSubscription
// Used to hydrate the billing page status without a separate charge_id.
// ---------------------------------------------------------------------------

const CURRENT_SUBSCRIPTION = /* GraphQL */ `
  query {
    currentAppSubscription {
      id
      status
      name
    }
  }
`

export async function getCurrentSubscription(
  shopDomain: string,
  accessToken: string
): Promise<AppSubscription | null> {
  const data = await shopifyGraphQL<{
    currentAppSubscription: AppSubscription | null
  }>(shopDomain, accessToken, CURRENT_SUBSCRIPTION)
  return data.currentAppSubscription
}

// ---------------------------------------------------------------------------
// statusToplan
// Maps Shopify AppSubscriptionStatus to our internal plan/subscription_status.
// ---------------------------------------------------------------------------

export function statusToPlan(status: AppSubscriptionStatus): {
  plan: 'free' | 'pro'
  subscription_status: string
} {
  switch (status) {
    case 'ACTIVE':
      return { plan: 'pro', subscription_status: 'active' }
    case 'FROZEN':
      // Payment issue — keep Pro access while Shopify retries
      return { plan: 'pro', subscription_status: 'frozen' }
    case 'PENDING':
      return { plan: 'free', subscription_status: 'pending' }
    case 'CANCELLED':
      return { plan: 'free', subscription_status: 'canceled' }
    case 'DECLINED':
      return { plan: 'free', subscription_status: 'declined' }
    case 'EXPIRED':
      return { plan: 'free', subscription_status: 'expired' }
    default:
      return { plan: 'free', subscription_status: 'unknown' }
  }
}
