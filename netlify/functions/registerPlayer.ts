import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL as string
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' })
  }

  let payload: any
  try {
    payload = event.body ? JSON.parse(event.body) : {}
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { playerId, platform } = payload || {}
  if (!playerId) {
    return json(400, { error: 'Missing playerId' })
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization']
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice('Bearer '.length) : undefined

  let userId: string | undefined
  if (token) {
    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data, error } = await supabaseUserClient.auth.getUser()
    if (error) {
      return json(401, { error: 'Invalid Supabase token' })
    }
    userId = data?.user?.id
  }

  // Dev escape hatch (optional): allow specifying user_id directly when explicitly enabled
  if (!userId && process.env.ALLOW_UNAUTH_DEV === 'true' && payload.userId) {
    userId = payload.userId
  }

  if (!userId) {
    return json(401, { error: 'Unauthorized: missing valid user' })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error: upsertError } = await admin
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, player_id: playerId, platform: platform ?? null, is_active: true },
      { onConflict: 'user_id,player_id' }
    )

  if (upsertError) {
    return json(500, { error: 'Failed to upsert subscription', details: upsertError.message })
  }

  return json(200, { ok: true })
}


