/**
 * Blocks RFC-1918, loopback, link-local, APIPA, and IPv6 private/loopback ranges
 * to prevent SSRF via user-supplied webhook URLs.
 */
export function isSafeWebhookHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '::1', '0:0:0:0:0:0:0:1']
  if (blocked.includes(h)) return false
  if (
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.startsWith('127.') ||
    h.startsWith('169.254.')
  ) return false
  const m = h.match(/^172\.(\d+)\./)
  if (m && parseInt(m[1], 10) >= 16 && parseInt(m[1], 10) <= 31) return false
  if (h === '::' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('::ffff:')) return false
  return true
}
