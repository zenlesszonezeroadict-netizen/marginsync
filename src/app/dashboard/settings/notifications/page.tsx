'use client'

import { useState, useEffect } from 'react'
import type { NotificationSettings } from '@/app/api/settings/notifications/route'

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [notifyOnComplete, setNotifyOnComplete] = useState(false)
  const [notifyOnMarginAlert, setNotifyOnMarginAlert] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [marginAlertThreshold, setMarginAlertThreshold] = useState('0')

  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/settings/notifications')
      const data = (await res.json()) as NotificationSettings & { error?: string }
      if (!res.ok) { setLoadError(data.error ?? 'Failed to load settings'); return }
      setSettings(data)
      setNotifyOnComplete(data.notifyOnComplete)
      setNotifyOnMarginAlert(data.notifyOnMarginAlert)
      setWebhookUrl(data.webhookUrl)
      setMarginAlertThreshold(String(data.marginAlertThreshold))
    })()
  }, [])

  const handleSave = async () => {
    setSaveError(null)
    setSaveSuccess(false)
    if (webhookUrl && !/^https?:\/\//.test(webhookUrl)) {
      setSaveError('Webhook URL must start with http:// or https://')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyOnComplete,
          notifyOnMarginAlert,
          webhookUrl,
          marginAlertThreshold: Number(marginAlertThreshold) || 0,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    if (!webhookUrl) { setSaveError('Enter a webhook URL first'); return }
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      setTestResult(res.ok && data.ok ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    } finally {
      setIsTesting(false)
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{loadError}</div>
      </div>
    )
  }
  if (!settings) {
    return (
      <div className="p-8 flex items-center gap-3 text-sm text-gray-500">
        <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Send a webhook payload to any URL when repricing events occur — pipe it into email, Slack,
          Zapier, or any automation tool.
        </p>
      </div>

      <div className="space-y-6">
        {/* Webhook URL */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <label className="block text-sm font-semibold text-gray-800 mb-1">Webhook URL</label>
          <p className="text-xs text-gray-500 mb-3">
            MarginSync will POST a JSON payload to this URL on notification events. Works with
            Zapier, Make, Pipedream, n8n, or any custom endpoint.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 font-mono"
            />
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={isTesting || !webhookUrl}
              className="shrink-0 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isTesting ? 'Testing…' : 'Test'}
            </button>
          </div>
          {testResult === 'ok' && (
            <p className="mt-2 text-xs text-emerald-600 font-medium">✓ Webhook responded successfully</p>
          )}
          {testResult === 'fail' && (
            <p className="mt-2 text-xs text-red-600 font-medium">✗ Webhook did not respond — check the URL</p>
          )}
        </div>

        {/* Notification toggles */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <p className="text-sm font-semibold text-gray-800 mb-2">Notify me when…</p>

          <Toggle
            id="notify-complete"
            label="A repricing run completes"
            description="Fires after every successful sync, with a count of products updated."
            checked={notifyOnComplete}
            onChange={setNotifyOnComplete}
          />

          <div className="border-t border-gray-100 pt-4">
            <Toggle
              id="notify-margin"
              label="Items fall below the margin floor"
              description="Fires when a run has at least the threshold number of below-margin items."
              checked={notifyOnMarginAlert}
              onChange={setNotifyOnMarginAlert}
            />
            {notifyOnMarginAlert && (
              <div className="mt-3 flex items-center gap-2 pl-12">
                <span className="text-xs text-gray-500">Alert if more than</span>
                <input
                  type="number" min="0" step="1"
                  value={marginAlertThreshold}
                  onChange={(e) => setMarginAlertThreshold(e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <span className="text-xs text-gray-500">items below margin</span>
              </div>
            )}
          </div>
        </div>

        {/* Payload reference */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Webhook payload (JSON)
          </p>
          <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed">
{`{
  "event": "run_completed",
  "runId": "uuid",
  "filename": "supplier-prices.csv",
  "synced": 142,
  "failed": 0,
  "status": "completed",
  "itemsBelowMargin": 3,
  "marginAlertTriggered": true,
  "timestamp": "2026-06-09T12:00:00.000Z"
}`}
          </pre>
        </div>
      </div>

      {saveError && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? (
            <><div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Saving…</>
          ) : 'Save notification settings'}
        </button>
        {saveSuccess && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
      </div>
    </div>
  )
}

function Toggle({
  id, label, description, checked, onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-4 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
        <input
          id={id} type="checkbox" className="sr-only peer"
          checked={checked} onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-10 h-6 bg-gray-200 peer-checked:bg-indigo-600 rounded-full transition-colors" />
        <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </label>
  )
}
