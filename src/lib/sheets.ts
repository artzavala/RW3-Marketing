// src/lib/sheets.ts
// Reads client rows from a Google Sheet using an API key.
// The sheet must be shared as "Anyone with the link can view".
//
// Expected sheet format:
//   Row 1: header (skipped)
//   Column A: client name (required)
//   Column B: website (optional)
//   Column C: rep email (optional)

export type SheetRow = {
  name: string
  website: string
  repEmail: string
  rowIndex: number  // 1-based row number (used as sheets_row_id)
}

function extractSheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) throw new Error('Invalid Google Sheets URL')
  return match[1]
}

export async function readSheet(sheetUrl: string, tabName: string): Promise<SheetRow[]> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_SHEETS_API_KEY is not set')

  const spreadsheetId = extractSheetId(sheetUrl)
  const range = encodeURIComponent(`${tabName}!A:C`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Sheets API error ${res.status}: ${body}`)
  }

  const data = await res.json() as { values?: string[][] }
  const rows = data.values ?? []

  // Skip header row (index 0 = row 1 in the sheet)
  return rows.slice(1).map((row, i) => ({
    name: row[0]?.trim() ?? '',
    website: row[1]?.trim() ?? '',
    repEmail: row[2]?.trim() ?? '',
    rowIndex: i + 2,  // row 2 onward (1-based, header is row 1)
  })).filter((row) => row.name !== '')  // skip blank name rows
}
