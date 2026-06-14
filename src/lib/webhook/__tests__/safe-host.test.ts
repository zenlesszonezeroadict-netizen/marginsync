import { describe, it, expect } from 'vitest'
import { isSafeWebhookHost } from '../safe-host'

describe('isSafeWebhookHost', () => {
  describe('allows public hostnames', () => {
    it('allows a public domain', () => {
      expect(isSafeWebhookHost('hooks.zapier.com')).toBe(true)
    })

    it('allows a public IP outside private ranges', () => {
      expect(isSafeWebhookHost('8.8.8.8')).toBe(true)
    })

    it('allows 172.15.x.x (just below 172.16)', () => {
      expect(isSafeWebhookHost('172.15.0.1')).toBe(true)
    })

    it('allows 172.32.x.x (just above 172.31)', () => {
      expect(isSafeWebhookHost('172.32.0.1')).toBe(true)
    })
  })

  describe('blocks loopback', () => {
    it('blocks localhost', () => {
      expect(isSafeWebhookHost('localhost')).toBe(false)
    })

    it('blocks 127.0.0.1', () => {
      expect(isSafeWebhookHost('127.0.0.1')).toBe(false)
    })

    it('blocks 127.x.x.x range', () => {
      expect(isSafeWebhookHost('127.255.255.255')).toBe(false)
    })

    it('blocks ::1 IPv6 loopback', () => {
      expect(isSafeWebhookHost('::1')).toBe(false)
    })

    it('blocks full IPv6 loopback form', () => {
      expect(isSafeWebhookHost('0:0:0:0:0:0:0:1')).toBe(false)
    })
  })

  describe('blocks RFC-1918 private ranges', () => {
    it('blocks 10.x.x.x', () => {
      expect(isSafeWebhookHost('10.0.0.1')).toBe(false)
    })

    it('blocks 192.168.x.x', () => {
      expect(isSafeWebhookHost('192.168.1.1')).toBe(false)
    })

    it('blocks 172.16.x.x', () => {
      expect(isSafeWebhookHost('172.16.0.1')).toBe(false)
    })

    it('blocks 172.31.x.x', () => {
      expect(isSafeWebhookHost('172.31.255.255')).toBe(false)
    })

    it('blocks 172.20.x.x (middle of range)', () => {
      expect(isSafeWebhookHost('172.20.0.1')).toBe(false)
    })
  })

  describe('blocks link-local / APIPA', () => {
    it('blocks 169.254.169.254 (IMDS endpoint)', () => {
      expect(isSafeWebhookHost('169.254.169.254')).toBe(false)
    })

    it('blocks 169.254.x.x range', () => {
      expect(isSafeWebhookHost('169.254.0.1')).toBe(false)
    })

    it('blocks 0.0.0.0', () => {
      expect(isSafeWebhookHost('0.0.0.0')).toBe(false)
    })
  })

  describe('blocks IPv6 private ranges', () => {
    it('blocks fe80:: link-local', () => {
      expect(isSafeWebhookHost('fe80::1')).toBe(false)
    })

    it('blocks fc00:: unique-local', () => {
      expect(isSafeWebhookHost('fc00::1')).toBe(false)
    })

    it('blocks fd00:: unique-local', () => {
      expect(isSafeWebhookHost('fd00::1')).toBe(false)
    })

    it('blocks ::ffff: IPv4-mapped', () => {
      expect(isSafeWebhookHost('::ffff:192.168.1.1')).toBe(false)
    })
  })

  describe('case-insensitive matching', () => {
    it('blocks LOCALHOST (uppercase)', () => {
      expect(isSafeWebhookHost('LOCALHOST')).toBe(false)
    })

    it('blocks FE80::1 (uppercase)', () => {
      expect(isSafeWebhookHost('FE80::1')).toBe(false)
    })
  })
})
