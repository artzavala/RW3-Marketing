# Phase 2: Client & Services Management - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins create and manage clients and service packages. Reps can view their assigned clients. Admins assign service packages to clients and assign/reassign reps to clients. Creating posts, scanning, or signal display are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Client list page
- Table layout with key columns: client name, assigned rep, services (count or tags), status
- Admin sees all clients; rep sees only their assigned clients (role-scoped query)
- Basic sorting by name; no complex filtering needed in this phase
- Standard pagination (not infinite scroll)

### Client detail page
- Sections: basic info (name, contact details), assigned rep, assigned services
- Read-heavy for reps; admin sees edit controls
- Basic info editable inline or via edit form — Claude's discretion

### Service assignment UI
- Admin assigns packages to a client from the client detail page
- Multi-select from existing service packages list
- Service packages are name-only (no price/description needed for v1)
- Changes saved explicitly (not auto-save)

### Rep assignment
- Admin assigns/reassigns rep from client detail page
- Dropdown of available reps
- Inline on the detail page (no modal needed)

### Claude's Discretion
- Form layout and field ordering for client create/edit
- Exact table column widths and responsive behavior
- Loading and empty states within views
- Toast/feedback on successful save

</decisions>

<specifics>
## Specific Ideas

- No specific UI references — standard shadcn/ui table, form, and select components are appropriate
- Admin-only write operations should be enforced at both the UI level (hide controls for reps) and server action level (role check)

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-client-services*
*Context gathered: 2026-04-01*
