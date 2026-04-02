'use client'

import { useState } from 'react'
import { triggerScan } from '@/app/actions/scan'
import { Button } from '@/components/ui/button'

export function ScanButton({ clientId }: { clientId: string }) {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ inserted?: number; skipped?: number; error?: string } | null>(null)

  async function handleScan() {
    setPending(true)
    setResult(null)
    const r = await triggerScan(clientId)
    setResult(r)
    setPending(false)
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleScan} disabled={pending} variant="outline" size="sm">
        {pending ? 'Scanning…' : 'Scan now'}
      </Button>
      {result && !result.error && (
        <span className="text-sm text-muted-foreground">
          {result.inserted} new signal{result.inserted !== 1 ? 's' : ''}
          {result.skipped ? `, ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''} skipped` : ''}
        </span>
      )}
      {result?.error && (
        <span className="text-sm text-destructive">{result.error}</span>
      )}
    </div>
  )
}
