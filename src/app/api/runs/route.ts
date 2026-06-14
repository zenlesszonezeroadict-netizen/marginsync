import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { uploadSupplierFile } from '@/lib/supabase/storage'
import { parseFile } from '@/lib/parser/parse-file'
import { checkRunQuota, MAX_ROWS_PER_UPLOAD } from '@/lib/billing/quota'
import { validateHeaders } from '@/lib/parser/validate-headers'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 400 })
  }

  const orgId = membership.organization_id

  const quota = await checkRunQuota(orgId)
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason ?? 'Run quota exceeded' }, { status: 402 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const MAX_FILE_BYTES = 20 * 1024 * 1024
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File must be under 20 MB' }, { status: 413 })
  }

  const fileExt = file.name.toLowerCase().split('.').pop()
  const allowedExts = ['csv', 'xlsx', 'xls']
  if (!allowedExts.includes(fileExt ?? '')) {
    return NextResponse.json({ error: 'Only CSV and XLSX files are supported' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create the run record at 'pending'
  const { data: run, error: runError } = await admin
    .from('reprice_runs')
    .insert({
      organization_id: orgId,
      created_by: user.id,
      source_filename: file.name,
      status: 'pending',
    })
    .select('id')
    .single()

  if (runError || !run) {
    return NextResponse.json({ error: 'Failed to create run record' }, { status: 500 })
  }

  const runId = run.id

  const MALFORMED_RESPONSE = NextResponse.json(
    {
      error: 'MALFORMED_CSV',
      message: "We couldn't read this file. Please verify it is a valid CSV with correct column headers.",
    },
    { status: 400 }
  )

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage — failure here is a server error, not a user error
    await uploadSupplierFile(orgId, runId, file.name, buffer, file.type)

    // Parse the file — throw from here means the file is malformed/unreadable
    let rows
    try {
      rows = await parseFile(buffer, file.name, file.type)
    } catch {
      await admin
        .from('reprice_runs')
        .update({ status: 'failed', error: 'Malformed or unreadable file' })
        .eq('id', runId)
      return MALFORMED_RESPONSE
    }

    if (rows.length === 0) {
      await admin
        .from('reprice_runs')
        .update({ status: 'failed', error: 'File contained no parseable rows' })
        .eq('id', runId)
      return MALFORMED_RESPONSE
    }

    if (rows.length > MAX_ROWS_PER_UPLOAD) {
      await admin
        .from('reprice_runs')
        .update({ status: 'failed', error: 'File exceeds row limit' })
        .eq('id', runId)
      return NextResponse.json(
        { error: `File has ${rows.length.toLocaleString()} rows. Maximum allowed is ${MAX_ROWS_PER_UPLOAD.toLocaleString()}.` },
        { status: 413 }
      )
    }

    const headers = Object.keys(rows[0] ?? {})

    const headerValidation = validateHeaders(headers)
    if (!headerValidation.valid) {
      await admin
        .from('reprice_runs')
        .update({ status: 'failed', error: headerValidation.errors.join(' | ') })
        .eq('id', runId)
      return MALFORMED_RESPONSE
    }

    const preview = rows.slice(0, 10)

    // Advance run to 'parsed'
    await admin
      .from('reprice_runs')
      .update({
        status: 'parsed',
        items_total: rows.length,
        column_config: { headers },
      })
      .eq('id', runId)

    return NextResponse.json({
      runId,
      totalRows: rows.length,
      headers,
      preview,
    })
  } catch (err) {
    await admin
      .from('reprice_runs')
      .update({
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      .eq('id', runId)

    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 })
  }
}
