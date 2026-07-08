import { requireAuth, type ApiRequest, type ApiResponse } from '../lib/adminAuth.js'
import { getActivePersonalityBase, getUserBundle, listUsers } from '../lib/adminData.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!requireAuth(req, res)) return

  try {
    const users = await listUsers()
    const personalityBase = await getActivePersonalityBase()

    if (users.length === 0) {
      res.status(200).json({
        users: [],
        selectedUserId: null,
        facts: [],
        messages: [],
        characterState: null,
        importantDates: [],
        personalityBase,
      })
      return
    }

    const query = new URL(req.url ?? '', 'http://localhost').searchParams
    const requestedUserId = query.get('user')
    const selectedUserId = requestedUserId && users.some((u) => u.id === requestedUserId) ? requestedUserId : users[0].id
    const bundle = await getUserBundle(selectedUserId)

    res.status(200).json({
      users,
      selectedUserId,
      user: bundle.user,
      facts: bundle.facts,
      messages: bundle.messages,
      characterState: bundle.characterState,
      importantDates: bundle.importantDates,
      personalityBase,
    })
  } catch (err) {
    console.error('admin data load failed', err)
    res.status(500).json({ error: 'admin data load failed' })
  }
}
