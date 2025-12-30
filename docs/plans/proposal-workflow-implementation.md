# Proposal Workflow Implementation Plan

## Goal
Enable end-to-end proposal assembly and delivery: Template → Fragments → Review → PDF → Courier

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Hanawa CMS | ✅ Running | Content/fragment management, workflow engine |
| PDF Worker | ✅ Ready | `POST /pdf` endpoint functional |
| Fragments | ✅ Ready | 8 proposal fragments (EN/JA) in DB |
| Courier | ✅ Ready | PIN-protected sharing via Nexus API |
| Integration | ❌ Missing | No proposal-specific workflow or PDF export |

## Implementation Scope

### Phase 1: Proposal Content Type & Template (Hanawa)

**1.1 Create "Proposal" content type**
- File: `packages/hanawa-cms/src/routes/proposals/+page.server.ts`
- Fields: client_code, client_name, scope, language, status
- Default fragments auto-inserted on creation

**1.2 Proposal creation route**
- Route: `/proposals/new`
- Template selection (start with one: "Standard IT Support Proposal")
- Pre-populates with standard fragment references

**1.3 Proposal list/dashboard**
- Route: `/proposals`
- Filter by status: draft, review, approved, shared
- Show client, scope, last modified

### Phase 2: Fragment Assembly UI

**2.1 Fragment picker component**
- Sidebar showing available fragments by category
- Drag-and-drop or click to insert
- Language toggle (EN/JA preview)

**2.2 Fragment reordering**
- Drag sections up/down in proposal
- Remove unwanted fragments
- Add custom content between fragments

**2.3 Live preview**
- Render fragments inline (resolved, not as references)
- Show both EN and JA versions side-by-side or toggled

### Phase 3: PDF Generation

**3.1 PDF export action**
- Button: "Generate PDF" on proposal page
- Server action renders HTML with:
  - eSolia branding (header/footer)
  - Resolved fragments
  - Provenance metadata footer

**3.2 PDF template**
- Create: `packages/hanawa-cms/src/lib/templates/proposal-pdf.ts`
- eSolia header with logo
- Footer with provenance: document ID, version, date, source

**3.3 Call PDF worker**
- POST to `https://pdf.esolia.co.jp/pdf`
- Return PDF for download or pass to Courier

### Phase 4: Courier Integration

**4.1 "Share via Courier" button**
- Opens modal: recipient email, name, expiry, notes (EN/JA)
- Validates inputs with Zod

**4.2 Server action to create share**
- Generate PDF (if not already)
- Base64 encode
- POST to Courier API with session auth
- Store share_id in proposal metadata

**4.3 Share confirmation UI**
- Show: share URL, PIN (masked until clicked)
- Copy buttons for URL and PIN
- Link to view share status in Courier

### Phase 5: Review Workflow (Optional Enhancement)

**5.1 Use existing workflow engine**
- Proposal status: draft → review → approved
- Staff can add comments
- Approval required before PDF/share

**5.2 Review UI**
- Request review button
- Reviewer sees proposal in their queue
- Approve/reject with comments

## File Structure

```
packages/hanawa-cms/src/
├── routes/
│   └── proposals/
│       ├── +page.server.ts      # List proposals
│       ├── +page.svelte         # Proposals dashboard
│       ├── new/
│       │   ├── +page.server.ts  # Create proposal
│       │   └── +page.svelte     # Creation form
│       └── [id]/
│           ├── +page.server.ts  # Edit, PDF, share actions
│           ├── +page.svelte     # Editor with fragments
│           └── share/
│               └── +page.svelte # Share modal (optional)
├── lib/
│   ├── components/
│   │   ├── FragmentPicker.svelte
│   │   ├── FragmentList.svelte
│   │   ├── ProposalPreview.svelte
│   │   └── ShareModal.svelte
│   ├── templates/
│   │   └── proposal-pdf.ts      # HTML template for PDF
│   └── server/
│       ├── pdf.ts               # PDF worker client
│       └── courier.ts           # Courier API client
```

## Database Changes

Add to existing `content` table or create `proposals` table:

```sql
-- Option A: Use content table with content_type = 'proposal'
-- Add metadata fields via JSON column

-- Option B: Dedicated proposals table
CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  client_code TEXT NOT NULL,
  client_name TEXT,
  scope TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  fragments TEXT DEFAULT '[]',  -- JSON array of fragment refs
  custom_content TEXT,          -- Custom sections (Tiptap JSON)
  status TEXT DEFAULT 'draft',  -- draft, review, approved, shared
  share_id TEXT,                -- Courier share ID if shared
  share_url TEXT,
  shared_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

## Implementation Order (For Tomorrow AM Testing)

### Priority 1: Core Flow (2-3 hours)
1. Create `/proposals` route with list view
2. Create `/proposals/new` with template selection
3. Create `/proposals/[id]` with fragment display
4. Add "Generate PDF" button calling pdf-worker
5. Return PDF download

### Priority 2: Courier Integration (1-2 hours)
6. Add "Share via Courier" button
7. Create share modal with form
8. POST to Courier API
9. Display share confirmation

### Priority 3: Polish (if time)
10. Fragment picker sidebar
11. Drag-and-drop reordering
12. Live preview toggle
13. Review workflow integration

## API Endpoints Created

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/proposals` | GET | List all proposals |
| `/proposals/new` | POST | Create proposal from template |
| `/proposals/[id]` | GET | View/edit proposal |
| `/proposals/[id]` | POST (save) | Save changes |
| `/proposals/[id]` | POST (pdf) | Generate PDF |
| `/proposals/[id]` | POST (share) | Share via Courier |

## Environment Variables Needed

```bash
# Already in Hanawa
PDF_WORKER_URL=https://pdf.esolia.co.jp
PDF_API_KEY=xxx

# Add for Courier integration
COURIER_URL=https://courier.esolia.co.jp
# Use existing Nexus session for auth
```

## Testing Checklist

- [ ] Create new proposal from template
- [ ] See fragment list populated
- [ ] Modify/reorder fragments
- [ ] Generate PDF with branding
- [ ] PDF includes provenance footer
- [ ] Share via Courier
- [ ] Receive PIN email
- [ ] Access shared PDF with PIN

---

*Plan created: 2025-12-29*
