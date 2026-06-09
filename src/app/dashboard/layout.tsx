import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .single()

  let orgName = 'My Organization'
  let plan: 'free' | 'pro' = 'free'

  if (membership) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, plan')
      .eq('id', membership.organization_id)
      .single()

    if (org) {
      orgName = org.name
      plan = (org.plan === 'pro' ? 'pro' : 'free') as 'free' | 'pro'
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        userEmail={user.email ?? ''}
        orgName={orgName}
        plan={plan}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
