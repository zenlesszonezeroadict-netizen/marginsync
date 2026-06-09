import { createAdminClient } from './server'

const BUCKET = 'supplier-files'

/**
 * Upload a supplier file to Supabase Storage.
 * Uses the admin client (service role) to bypass Storage RLS.
 * Path structure: {orgId}/{runId}/{filename}
 * Returns the storage path.
 */
export async function uploadSupplierFile(
  orgId: string,
  runId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const supabase = createAdminClient()
  const storagePath = `${orgId}/${runId}/${filename}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  return storagePath
}

/**
 * Download a supplier file buffer from Supabase Storage.
 */
export async function downloadSupplierFile(storagePath: string): Promise<Buffer> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath)

  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message ?? 'no data'}`)
  }

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
