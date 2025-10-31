import type { Handler } from '@netlify/functions'

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

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID as string
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY as string

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(500, { error: 'Missing OneSignal environment variables' })
  }

  let payload: any
  try {
    payload = event.body ? JSON.parse(event.body) : {}
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { title, message, data } = payload || {}
  if (!title || !message) {
    return json(400, { error: 'Missing title or message' })
  }

  try {
    const isV2 = ONESIGNAL_REST_API_KEY.startsWith('os_')
    const endpoints = isV2
      ? ['https://api.onesignal.com/notifications', 'https://onesignal.com/api/v1/notifications']
      : ['https://onesignal.com/api/v1/notifications', 'https://api.onesignal.com/notifications']

    const headersList = isV2
      ? [`Bearer ${ONESIGNAL_REST_API_KEY}`, ONESIGNAL_REST_API_KEY, `Basic ${ONESIGNAL_REST_API_KEY}`]
      : [`Basic ${ONESIGNAL_REST_API_KEY}`, `Bearer ${ONESIGNAL_REST_API_KEY}`, ONESIGNAL_REST_API_KEY]

    let lastResp: any = null
    for (const endpoint of endpoints) {
      for (const authHeader of headersList) {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            included_segments: ['Subscribed Users'],
            headings: { en: title },
            contents: { en: message },
            data: data ?? undefined,
          }),
        })
        lastResp = { endpoint, authHeader, status: resp.status, body: await resp.json() }
        if (resp.ok) {
          return json(200, { ok: true, result: lastResp.body })
        }
        if (![401, 403].includes(resp.status)) break
      }
    }
    return json(401, { error: 'OneSignal error', details: lastResp })
  } catch (e: any) {
    return json(500, { error: 'Failed to send notification', details: e?.message || String(e) })
  }
}


