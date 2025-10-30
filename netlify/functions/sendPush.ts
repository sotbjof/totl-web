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
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID as string
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY as string

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' })
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(500, { error: 'Missing OneSignal environment variables' })
  }

  let payload: any
  try {
    payload = event.body ? JSON.parse(event.body) : {}
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { userIds, playerIds: rawPlayerIds, title, message, data } = payload || {}
  if (!title || !message) {
    return json(400, { error: 'Missing title or message' })
  }

  const playerIds: string[] = Array.isArray(rawPlayerIds) ? rawPlayerIds.filter(Boolean) : []

  let includePlayerIds: string[] = [...playerIds]
  if (Array.isArray(userIds) && userIds.length > 0) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: rows, error } = await admin
      .from('push_subscriptions')
      .select('player_id')
      .in('user_id', userIds)
      .eq('is_active', true)

    if (error) {
      return json(500, { error: 'Failed to fetch player IDs', details: error.message })
    }

    const fromUsers = (rows || []).map((r: any) => r.player_id).filter(Boolean)
    includePlayerIds = [...includePlayerIds, ...fromUsers]
  }

  // Deduplicate
  includePlayerIds = Array.from(new Set(includePlayerIds))

  if (includePlayerIds.length === 0) {
    return json(400, { error: 'No target player IDs found' })
  }

  try {
    const candidates = [
      ONESIGNAL_REST_API_KEY.startsWith('os_') ? ONESIGNAL_REST_API_KEY : `Basic ${ONESIGNAL_REST_API_KEY}`,
      `Bearer ${ONESIGNAL_REST_API_KEY}`,
      `Basic ${ONESIGNAL_REST_API_KEY}`,
      `Key ${ONESIGNAL_REST_API_KEY}`,
    ]

    let lastResp: any = null
    for (const authHeader of candidates) {
      const resp = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: includePlayerIds,
          headings: { en: title },
          contents: { en: message },
          data: data ?? undefined,
        }),
      })

      lastResp = { status: resp.status, body: await resp.json() }
      if (resp.ok) {
        return json(200, { ok: true, result: lastResp.body })
      }
      if (![401, 403].includes(resp.status)) break
    }
    return json(401, { error: 'OneSignal error', details: lastResp })
  } catch (e: any) {
    return json(500, { error: 'Failed to send notification', details: e?.message || String(e) })
  }
}


