// ── Beta free mode ────────────────────────────────────────────────────────────
// While this is `true`, MarginSync is 100% free:
//   • the $19/mo Pro plan is disabled — no one can be charged
//   • every Pro-gated feature (price sync, CSV export) is unlocked for all users
//   • the "Upgrade to Pro" prompts are hidden
//
// This keeps our public "free during beta" messaging completely honest.
//
// TO START CHARGING FOR PRO AFTER BETA: set this to `false`. That single change
// re-enables the upgrade button, the paywall on sync/export, and Shopify billing.
export const BETA_FREE_MODE = true
