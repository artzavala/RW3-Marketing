'use client'

import { useActionState, useState } from 'react'
import { Clock } from 'lucide-react'
import { saveConfig, syncSheet, SyncResult } from '@/app/actions/sheets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Config = { sheet_url: string; tab_name: string; last_synced_at: string | null } | null

export function SheetsConfigForm({ config }: { config: Config }) {
  const [configState, configAction, configPending] = useActionState(saveConfig, {})
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncSheet()
      setSyncResult(result)
    } catch (err) {
      setSyncResult({ error: err instanceof Error ? err.message : 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-8 max-w-lg">
      <div>
        <h2 className="text-base font-semibold mb-4">Google Sheets configuration</h2>
        <form action={configAction} className="space-y-4">
          {configState.error && <p className="text-sm text-destructive">{configState.error}</p>}
          {configState.success && <p className="text-sm text-green-600">Saved.</p>}
          <div className="space-y-1.5">
            <Label htmlFor="sheet_url">Sheet URL *</Label>
            <Input
              id="sheet_url"
              name="sheet_url"
              defaultValue={config?.sheet_url}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tab_name">Tab name</Label>
            <Input
              id="tab_name"
              name="tab_name"
              defaultValue={config?.tab_name ?? 'Sheet1'}
              placeholder="Sheet1"
            />
          </div>
          <Button type="submit" disabled={configPending}>
            {configPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </div>

      {config && (
        <div>
          <hr className="border-border mb-8 -mt-2" />
          <h2 className="text-base font-semibold mb-2">Sync</h2>
          {config.last_synced_at && (
            <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Last synced: {new Date(config.last_synced_at).toLocaleString()}
            </p>
          )}
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          {syncResult && (
            <div className="mt-3 text-sm">
              {syncResult.error && <p className="text-destructive">{syncResult.error}</p>}
              {syncResult.created !== undefined && (
                <p className="text-green-600">
                  {syncResult.created} created, {syncResult.updated} updated
                  {syncResult.errors && syncResult.errors.length > 0 && (
                    <span className="text-destructive ml-2">({syncResult.errors.length} errors)</span>
                  )}
                </p>
              )}
              {syncResult.errors?.map((e, i) => (
                <p key={i} className="text-destructive">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
