'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  createPackageAction,
  updatePackageAction,
  deletePackageAction,
} from './actions'

// ---------------------------------------------------------------------------
// Add Package Dialog
// ---------------------------------------------------------------------------

export function AddPackageDialog() {
  const [state, formAction, isPending] = useActionState(createPackageAction, null)

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="default" />}>
        Add Package
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Service Package</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="add-name">Name</Label>
            <Input id="add-name" name="name" placeholder="Package name" required />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Edit Package Dialog
// ---------------------------------------------------------------------------

export function EditPackageDialog({ id, name }: { id: string; name: string }) {
  const [state, formAction, isPending] = useActionState(updatePackageAction, null)

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Service Package</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-name-${id}`}>Name</Label>
            <Input
              id={`edit-name-${id}`}
              name="name"
              defaultValue={name}
              placeholder="Package name"
              required
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Delete Package Button
// ---------------------------------------------------------------------------

export function DeletePackageButton({ id }: { id: string }) {
  const [, formAction, isPending] = useActionState(deletePackageAction, null)

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm('Delete this service package?')) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button variant="destructive" size="sm" type="submit" disabled={isPending}>
        {isPending ? 'Deleting...' : 'Delete'}
      </Button>
    </form>
  )
}
