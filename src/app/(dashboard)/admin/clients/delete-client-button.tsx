'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { deleteClientAction } from './actions'

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const [, formAction, isPending] = useActionState(deleteClientAction, null)

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={clientId} />
      <Button variant="destructive" size="sm" type="submit" disabled={isPending}>
        {isPending ? 'Deleting...' : 'Delete'}
      </Button>
    </form>
  )
}
