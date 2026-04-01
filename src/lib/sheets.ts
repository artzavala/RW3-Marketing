// src/lib/sheets.ts
// Reads client rows from a Google Sheet using a service account.
//
// Expected sheet format:
//   Row 1: header (skipped)
//   Column A: client name (required)
//   Column B: website (optional)
//   Column C: rep email (optional)

import { google } from 'googleapis'

export type SheetRow = {
  name: string
  website: string
  repEmail: string
  rowIndex: number  // 1-based row number (used as sheets_row_id)
}

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')

  const credentials = JSON.parse(json)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

function extractSheetId(url: string): string {
  // Handles: https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) throw new Error('Invalid Google Sheets URL')
  return match[1]
}

export async function readSheet(sheetUrl: string, tabName: string): Promise<SheetRow[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const spreadsheetId = extractSheetId(sheetUrl)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:C`,
  })

  const rows = response.data.values ?? []

  // Skip header row (index 0 = row 1 in the sheet)
  return rows.slice(1).map((row, i) => ({
    name: (row[0] as string | undefined)?.trim() ?? '',
    website: (row[1] as string | undefined)?.trim() ?? '',
    repEmail: (row[2] as string | undefined)?.trim() ?? '',
    rowIndex: i + 2,  // row 2 onward (1-based, header is row 1)
  })).filter((row) => row.name !== '')  // skip blank name rows
}
