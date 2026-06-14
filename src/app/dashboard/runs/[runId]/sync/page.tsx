import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SyncPageClient } from './SyncPageClient'

export default async function SyncPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params

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
  const { data: org } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', membership.organization_id)
    .single()

  if (org?.plan !== 'pro') {
    redirect('/dashboard/billing')
  }

  return <SyncPageClient />
}
