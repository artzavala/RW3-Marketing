# Requirements — Client Intelligence Platform v1

26 requirements across 7 categories.

---

## AUTH & ROLES

- **AUTH-01**: User can log in with email/password
- **AUTH-02**: User session persists across browser refresh
- **AUTH-03**: User can log out from any page
- **AUTH-04**: Admin can view and manage all clients
- **AUTH-05**: Client Service Rep can only view clients assigned to them

---

## CLIENTS

- **CLI-01**: Admin can add a client (name, website, assigned rep)
- **CLI-02**: Admin can edit client details and reassign rep
- **CLI-03**: Admin can remove a client
- **CLI-04**: User can view their accessible client list
- **CLI-05**: User can view a client detail page

---

## GOOGLE SHEETS IMPORT

- **GS-01**: Admin can configure a Google Sheets URL as the client data source
- **GS-02**: System reads client rows (name, website, rep email) from the sheet
- **GS-03**: Admin can trigger a manual sync from the sheet
- **GS-04**: New rows in sheet create new clients; existing rows update fields

---

## SERVICES

- **SVC-01**: Admin can create a service package (name, description)
- **SVC-02**: Admin can edit a service package
- **SVC-03**: Admin can remove a service package
- **SVC-04**: User can assign/unassign packages to a client
- **SVC-05**: User can see which packages a client uses vs. doesn't use

---

## SCANNING

- **SCN-01**: System runs a daily cron job scanning all active clients
- **SCN-02**: User can trigger a manual "scan now" for any client they can access
- **SCN-03**: Scan uses Serper.dev to find recent news (last 30 days)
- **SCN-04**: Each article is analyzed by Gemini: summary + score 1–5 + signal type
- **SCN-05**: Scan results are stored as signals linked to the client

---

## SIGNALS

- **SIG-01**: User can view signals for their accessible clients (newest first)
- **SIG-02**: Admin can view a global signal feed across all clients
- **SIG-03**: User can filter signals by client, score, signal type, status
- **SIG-04**: User can mark a signal as Reviewed, Actioned, or Dismissed
- **SIG-05**: User can add a note when actioning/dismissing a signal

---

## ANALYTICS

- **ANL-01**: Client detail page shows score trend chart (last 90 days)
- **ANL-02**: Dashboard shows aggregate signal volume by week

---

## v2 (Deferred)

- HubSpot integration (read contacts, write activity notes)
- Slack/email notifications for high-score signals
- Per-client configurable scan frequency
- Competitor tracking
- AI-drafted outreach suggestions
- Granular sub-roles (e.g., read-only analyst)
