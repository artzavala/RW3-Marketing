'use client'

import { useState, useTransition } from 'react'
import { createAction } from '@/app/actions/signals'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

type SignalAction = { status: string; note: string | null } | null

type Signal = {
  id: string
  headline: string
  source_url: string
  published_at: string | null
  summary: string | null
  score: number
  signal_type: string
  opportunity: boolean
  client_name?: string
  action: SignalAction
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score <= 2 ? 'bg-red-100 text-red-700' :
    score === 3 ? 'bg-yellow-100 text-yellow-700' :
    'bg-green-100 text-green-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}/5
    </span>
  )
}

export function SignalCard({ signal }: { signal: Signal }) {
  const [currentAction, setCurrentAction] = useState(signal.action)
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState(signal.action?.note ?? '')
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const domain = (() => { try { return new URL(signal.source_url).hostname } catch { return signal.source_url } })()

  function handleAction(status: 'reviewed' | 'actioned' | 'dismissed') {
    if (status === 'actioned' || status === 'dismissed') {
      setPendingStatus(status)
      setShowNote(true)
      return
    }
    submitAction(status, undefined)
  }

  function submitAction(status: 'reviewed' | 'actioned' | 'dismissed', noteText?: string) {
    setCurrentAction({ status, note: noteText ?? null })
    setShowNote(false)
    setPendingStatus(null)

    startTransition(async () => {
      await createAction(signal.id, status, noteText)
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <a
              href={signal.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline line-clamp-2"
            >
              {signal.headline}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{domain}</span>
              {signal.published_at && (
                <span>{new Date(signal.published_at).toLocaleDateString()}</span>
              )}
              {signal.client_name && (
                <span className="font-medium text-foreground">{signal.client_name}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ScoreBadge score={signal.score} />
            <Badge variant="outline" className="text-xs">{signal.signal_type}</Badge>
            {signal.opportunity && (
              <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">opportunity</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {signal.summary && (
          <p className="text-sm text-muted-foreground">{signal.summary}</p>
        )}

        {showNote && pendingStatus && (
          <div className="space-y-2">
            <Textarea
              placeholder="Add a note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => submitAction(pendingStatus as 'actioned' | 'dismissed', note || undefined)}
                disabled={isPending}
              >
                {isPending ? 'Saving…' : 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowNote(false); setPendingStatus(null) }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {currentAction && (
            <Badge variant="secondary" className="capitalize">{currentAction.status}</Badge>
          )}
          {!showNote && (
            <div className="flex gap-1">
              {(['reviewed', 'actioned', 'dismissed'] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={currentAction?.status === s ? 'default' : 'ghost'}
                  className="h-7 px-2 text-xs capitalize"
                  onClick={() => handleAction(s)}
                  disabled={isPending}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}
        </div>
        {currentAction?.note && (
          <p className="text-xs text-muted-foreground italic">Note: {currentAction.note}</p>
        )}
      </CardContent>
    </Card>
  )
}
