import { verifyWebhook } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      const { id, email_addresses, first_name, last_name, public_metadata } = evt.data
      const email = email_addresses[0]?.email_address ?? ''
      const name = [first_name, last_name].filter(Boolean).join(' ')
      const role = (public_metadata?.role as 'admin' | 'rep') ?? 'rep'

      await db.insert(users).values({
        clerkId: id,
        email,
        name,
        role,
      }).onConflictDoUpdate({
        target: users.clerkId,
        set: { email, name, role },
      })
    }

    if (evt.type === 'user.deleted') {
      if (evt.data.id) {
        await db.delete(users).where(eq(users.clerkId, evt.data.id))
      }
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Webhook verification failed', { status: 400 })
  }
}
