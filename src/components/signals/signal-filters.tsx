'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type FilterProps = {
  clients?: { id: string; name: string }[]
}

const SIGNAL_TYPES = ['news', 'funding', 'hiring', 'risk', 'other']
const STATUSES = ['reviewed', 'actioned', 'dismissed']

export function SignalFilters({ clients }: FilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function clearAll() {
    router.push(pathname)
  }

  const hasFilters = searchParams.toString() !== ''

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {clients && clients.length > 0 && (
        <Select
          value={searchParams.get('client') ?? 'all'}
          onValueChange={(v) => updateParam('client', v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={searchParams.get('score') ?? 'all'}
        onValueChange={(v) => updateParam('score', v)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="All scores" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All scores</SelectItem>
          {[5, 4, 3, 2, 1].map((s) => (
            <SelectItem key={s} value={String(s)}>Score {s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('type') ?? 'all'}
        onValueChange={(v) => updateParam('type', v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {SIGNAL_TYPES.map((t) => (
            <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('status') ?? 'all'}
        onValueChange={(v) => updateParam('status', v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="unactioned">Unactioned</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>Clear filters</Button>
      )}
    </div>
  )
}
