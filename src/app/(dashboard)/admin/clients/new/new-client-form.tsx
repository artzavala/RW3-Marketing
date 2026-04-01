'use client'

import { useState, useActionState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClientAction } from '../actions'

type Rep = {
  id: string
  name: string | null
}

export function NewClientForm({ reps }: { reps: Rep[] }) {
  const [repId, setRepId] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(createClientAction, null)

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          placeholder="Acme Corp"
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://example.com"
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label>Assigned Rep</Label>
        <Select onValueChange={setRepId} value={repId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Assign rep..." />
          </SelectTrigger>
          <SelectContent>
            {reps.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name ?? r.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="assigned_rep" value={repId ?? ''} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Client'}
        </Button>
        <a
          href="/admin/clients"
          className={buttonVariants({ variant: 'outline' })}
        >
          Cancel
        </a>
      </div>
    </form>
  )
}
