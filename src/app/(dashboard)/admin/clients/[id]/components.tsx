'use client'

import { useState, useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateClientAction } from '../actions'
import { assignPackagesAction } from '../actions'

type ActionState = { error: string } | null

type Rep = {
  id: string
  name: string | null
}

type Package = {
  id: string
  name: string
}

type ClientEditFormProps = {
  client: {
    id: string
    name: string
    website: string | null
    assigned_rep: string | null
  }
  reps: Rep[]
}

export function ClientEditForm({ client, reps }: ClientEditFormProps) {
  const [repId, setRepId] = useState<string | null>(client.assigned_rep ?? null)
  const [state, formAction, isPending] = useActionState(updateClientAction, null)

  useEffect(() => {
    if (state === null && isPending === false) {
      // state is null means success (after at least one submission)
      // We can't easily distinguish initial null from post-save null
      // without a submission counter, so we use a ref-based approach
    }
  }, [state, isPending])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={client.id} />

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="edit-name">Name *</Label>
        <Input
          id="edit-name"
          name="name"
          defaultValue={client.name}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-website">Website</Label>
        <Input
          id="edit-website"
          name="website"
          type="url"
          defaultValue={client.website ?? ''}
          placeholder="https://example.com"
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label>Assigned Rep</Label>
        <Select
          onValueChange={setRepId}
          value={repId}
          disabled={isPending}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select rep..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {reps.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name ?? r.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="assigned_rep" value={repId ?? ''} />
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

type ServiceAssignmentFormProps = {
  clientId: string
  allPackages: Package[]
  assignedPackageIds: Set<string>
}

export function ServiceAssignmentForm({
  clientId,
  allPackages,
  assignedPackageIds,
}: ServiceAssignmentFormProps) {
  const [state, formAction, isPending] = useActionState(
    assignPackagesAction,
    null as ActionState
  )

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {allPackages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No service packages have been created yet.
        </p>
      ) : (
        <div className="space-y-2">
          {allPackages.map((pkg) => (
            <div key={pkg.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                id={`pkg-${pkg.id}`}
                name="package_ids"
                value={pkg.id}
                defaultChecked={assignedPackageIds.has(pkg.id)}
                disabled={isPending}
                className="h-4 w-4 rounded border-gray-300 text-primary accent-primary"
              />
              <label
                htmlFor={`pkg-${pkg.id}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {pkg.name}
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Assignments'}
        </Button>
      </div>
    </form>
  )
}
