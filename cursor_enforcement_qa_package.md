# Cursor Enforcement Checklist, QA Test Plan, and Frontend Component Contract

This document is **binding**. It is designed to prevent partial implementations, flat UI, or skipped functionality when using Cursor or any AI-assisted builder. All sections must be satisfied for acceptance.

---

## PART I — CURSOR ENFORCEMENT CHECKLIST (NON‑NEGOTIABLE)

Cursor output is **REJECTED** if any item below is missing, stubbed, static, or non-interactive.

### A. Global Enforcement
- [ ] No placeholder data or mock-only UI
- [ ] All data shown is backed by real CRUD logic
- [ ] Every action has success, loading, and error states
- [ ] No dead-end screens or buttons
- [ ] All dashboards are interactive (filters, tabs, pagination)
- [ ] Mobile, tablet, and desktop layouts verified

---

### B. Event Management (Admin)
- [ ] Create Event form includes **all fields** (name, type, description, date, time, timezone)
- [ ] Invitation-only toggle affects downstream behavior
- [ ] Services selectable independently (Invitation / RSVP / Guestbook)
- [ ] Communication defaults selectable (Email / SMS / WhatsApp)
- [ ] Initial phase logic selectable (auto / manual)
- [ ] Edit Event allows modification of **every field** post-creation
- [ ] Disabling a service revokes public access immediately

---

### C. Template System
- [ ] Full CRUD for templates
- [ ] Template categories enforced
- [ ] Thumbnail preview exists for every template
- [ ] Live preview renders injected event data
- [ ] Template assignment UI per event with preview
- [ ] Event cannot be published with missing required templates

---

### D. RSVP System
- [ ] RSVP form is embedded in invitation template
- [ ] Invitation-only events enforce Pending state
- [ ] Couple can approve/reject RSVPs
- [ ] Rejected RSVPs receive rejection message
- [ ] Approved RSVPs trigger invitation pass issuance

---

### E. Invitation Pass & Check‑In
- [ ] QR code generation works
- [ ] 6-digit manual code generated and validated
- [ ] Invitation card is downloadable/printable
- [ ] Check-in UI supports scan + manual entry
- [ ] Duplicate check-ins are blocked

---

### F. Guestbook (HIGHEST PRIORITY)
- [ ] Guestbook access respects invitation-only rules
- [ ] Video recording auto-enables camera
- [ ] Live video preview is visible
- [ ] Audio recording shows waveform
- [ ] One-tap record with animated state
- [ ] Timer visible with hard stop
- [ ] Upload progress shown
- [ ] Photo uploads enforce per-device limits
- [ ] Booth mode auto-resets and runs full-screen

---

### G. Couple Dashboard
- [ ] RSVP list visible with filters
- [ ] Media timeline fully interactive
- [ ] Inline video/audio playback works
- [ ] Photo gallery has lightbox
- [ ] Individual downloads work
- [ ] ZIP download works
- [ ] Premium reel generation is real, async, and downloadable

---

## PART II — QA TEST PLAN (EXECUTABLE)

Each test must PASS.

### 1. Event Lifecycle Tests
- Create event → Save as draft → Edit → Publish
- Toggle invitation-only → Verify guestbook access rules
- Change phase manually → Guest access updates immediately

---

### 2. Template Tests
- Upload template → Preview → Assign to event
- Delete template → System blocks dependent event publishing
- Render invitation page with real event data

---

### 3. RSVP Tests
- Submit RSVP (open event)
- Submit RSVP (invitation-only)
- Approve RSVP → Invitation issued
- Reject RSVP → Message sent, access denied

---

### 4. Check‑In Tests
- Scan valid QR → Success
- Reuse QR → Blocked
- Enter valid manual code → Success
- Enter invalid code → Error shown

---

### 5. Guestbook Tests
- Access guestbook (open event)
- Access guestbook (invitation-only, unapproved) → Denied
- Record video → Upload → Appears in dashboard
- Record audio → Upload → Appears in dashboard
- Upload photos → Quota enforced
- Booth mode resets after submission

---

### 6. Media Tests
- Play video inline
- Play audio inline
- View photo gallery
- Download single file
- Download ZIP
- Generate reel → Wait → Download MP4

---

## PART III — FRONTEND COMPONENT CONTRACT (MANDATORY)

Cursor **must implement every component listed below with full interactivity**.

### A. Core Layout Components
- AppShell (sidebar + header)
- ResponsiveSidebar (collapsible)
- PageHeader (contextual)
- EmptyState
- LoadingState
- ErrorState

---

### B. Admin Components
- EventCreateForm (multi-section)
- EventEditForm
- ServiceTogglePanel
- PhaseControlWidget
- TemplateSelector (thumbnail + preview)
- CommunicationSettingsPanel

---

### C. RSVP Components
- RSVPForm (template-embedded)
- RSVPStatusBadge
- RSVPApprovalTable
- ApprovalActionModal

---

### D. Invitation & Check‑In
- InvitationCardPreview
- QRCodeRenderer
- ManualCodeInput
- CheckInResultToast

---

### E. Guestbook Components (NON-OPTIONAL DEPTH)
- GuestModeSelector
- PermissionGate
- VideoRecorder (live preview, timer, animation)
- AudioRecorder (waveform)
- RecordingProgressOverlay
- UploadProgressIndicator
- BoothModeWrapper

---

### F. Media Components
- MediaTimeline
- VideoPlayerCard
- AudioPlayerCard
- PhotoGallery
- MediaFilterControls
- DownloadManager
- ReelGenerationPanel

---

## FINAL ENFORCEMENT RULE

If a component exists visually but lacks:
- State
- Interactivity
- Real data
- Error handling

…it is considered **NOT IMPLEMENTED**.

This document is the final authority for acceptance.

