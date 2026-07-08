import { requireAuth, type ApiRequest, type ApiResponse } from '../lib/adminAuth.js'
import {
  createFact,
  createImportantDate,
  deleteFact,
  deleteImportantDate,
  deleteMessage,
  updateFact,
  updateImportantDate,
  updatePersonalityBaseDistilledPrompt,
  updateUser,
  upsertCharacterState,
  type EditableCharacterStateFields,
  type EditableImportantDateFields,
  type EditableUserFields,
} from '../lib/adminData.js'
import { FACT_CATEGORIES, type FactCategory } from '../lib/types.js'

type MutateBody =
  | { resource: 'user'; id: string; fields: EditableUserFields }
  | { resource: 'characterState'; userId: string; fields: EditableCharacterStateFields }
  | { resource: 'fact'; action: 'create'; userId: string; content: string; category: string }
  | { resource: 'fact'; action: 'update'; id: string; fields: { content?: string; category?: string } }
  | { resource: 'fact'; action: 'delete'; id: string }
  | { resource: 'importantDate'; action: 'create'; userId: string; fields: EditableImportantDateFields }
  | { resource: 'importantDate'; action: 'update'; id: string; fields: Partial<EditableImportantDateFields> }
  | { resource: 'importantDate'; action: 'delete'; id: string }
  | { resource: 'message'; action: 'delete'; id: string }
  | { resource: 'personalityBase'; id: string; distilledPrompt: string }

function isValidFactCategory(value: string): value is FactCategory {
  return (FACT_CATEGORIES as readonly string[]).includes(value)
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!requireAuth(req, res)) return

  const raw = req.body
  if (!raw || typeof raw !== 'object' || typeof (raw as { resource?: unknown }).resource !== 'string') {
    res.status(400).json({ error: 'invalid request body' })
    return
  }
  const body = raw as MutateBody

  try {
    switch (body.resource) {
      case 'user':
        await updateUser(body.id, body.fields)
        break
      case 'characterState':
        await upsertCharacterState(body.userId, body.fields)
        break
      case 'fact':
        if (body.action === 'create') {
          if (!isValidFactCategory(body.category)) {
            res.status(400).json({ error: 'invalid category' })
            return
          }
          await createFact(body.userId, body.content, body.category)
        } else if (body.action === 'update') {
          const fields = body.fields ?? {}
          if (fields.category !== undefined && !isValidFactCategory(fields.category)) {
            res.status(400).json({ error: 'invalid category' })
            return
          }
          await updateFact(body.id, fields as { content?: string; category?: FactCategory })
        } else if (body.action === 'delete') {
          await deleteFact(body.id)
        } else {
          res.status(400).json({ error: 'unknown fact action' })
          return
        }
        break
      case 'importantDate':
        if (body.action === 'create') {
          await createImportantDate(body.userId, body.fields)
        } else if (body.action === 'update') {
          await updateImportantDate(body.id, body.fields ?? {})
        } else if (body.action === 'delete') {
          await deleteImportantDate(body.id)
        } else {
          res.status(400).json({ error: 'unknown importantDate action' })
          return
        }
        break
      case 'message':
        if (body.action !== 'delete') {
          res.status(400).json({ error: 'unknown message action' })
          return
        }
        await deleteMessage(body.id)
        break
      case 'personalityBase':
        await updatePersonalityBaseDistilledPrompt(body.id, body.distilledPrompt)
        break
      default:
        res.status(400).json({ error: 'unknown resource' })
        return
    }
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('admin mutate failed', err)
    res.status(500).json({ error: 'admin mutate failed' })
  }
}
