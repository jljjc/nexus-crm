# Nexus CRM — Manual Test Plan
**Version:** 1.0
**Date:** 2026-03-23
**Author:** Liang Jiang / Ozsky Migration
**App URL:** http://localhost:3000 (development)

---

## How to Use This Test Plan

Run each test case manually. Mark `[P]` for pass or `[F]` for fail. Note any issues in the Comments field if the test fails.

---

## Section 1: Authentication & Session Management

---

ID: TC-001
Title: Login with valid Staff credentials
Precondition: User on login page, valid Staff account exists
Steps:
  1. Enter valid staff email/username
  2. Enter correct password
  3. Click "Sign In" button
Expected Result: User authenticated, redirected to dashboard, Staff role confirmed in header/profile
Pass/Fail: [ ]

---

ID: TC-002
Title: Login with valid Manager credentials
Precondition: User on login page, valid Manager account exists
Steps:
  1. Enter valid manager email/username
  2. Enter correct password
  3. Click "Sign In" button
Expected Result: User authenticated, redirected to dashboard, Manager role confirmed, can access admin features
Pass/Fail: [ ]

---

ID: TC-003
Title: Login with wrong password
Precondition: User on login page
Steps:
  1. Enter valid email/username
  2. Enter incorrect password
  3. Click "Sign In" button
Expected Result: Error message displayed, login fails, user remains on login page
Pass/Fail: [ ]

---

ID: TC-004
Title: Sign out successfully
Precondition: User logged in and on dashboard
Steps:
  1. Click user profile menu (top right corner)
  2. Click "Sign Out" option
  3. Confirm sign out if prompted
Expected Result: User logged out, redirected to login page, session cleared
Pass/Fail: [ ]

---

ID: TC-005
Title: Session timeout after inactivity
Precondition: User logged in for extended period (simulate by clear session token)
Steps:
  1. Leave app inactive for configured timeout duration
  2. Attempt any action (click button, navigate)
Expected Result: User redirected to login page, session expired message shown, must re-authenticate
Pass/Fail: [ ]

---

## Section 2: Dashboard

---

ID: TC-006
Title: Dashboard statistics display
Precondition: User logged in, dashboard loaded
Steps:
  1. View main dashboard
  2. Check for client count widget
  3. Check for case count widget
  4. Check for pending task widget
Expected Result: All statistics widgets display with current counts, numbers are non-negative integers
Pass/Fail: [ ]

---

ID: TC-007
Title: Recent activity feed
Precondition: User logged in, some client/case activity exists
Steps:
  1. Navigate to dashboard
  2. Scroll to recent activity section
  3. Verify entries show timestamp and description
Expected Result: Recent activity list displays in chronological order with timestamps, actions (create/edit/delete) are clear
Pass/Fail: [ ]

---

ID: TC-008
Title: Deadlines widget displays upcoming dates
Precondition: Dashboard loaded, cases with upcoming deadlines exist
Steps:
  1. View dashboard deadlines widget
  2. Observe listed dates and descriptions
Expected Result: Upcoming deadlines display with case/task name and due date, sorted by proximity
Pass/Fail: [ ]

---

ID: TC-009
Title: Quick links navigation
Precondition: Dashboard loaded
Steps:
  1. Locate quick links panel
  2. Click "New Client" link
  3. Verify navigation to client creation form
Expected Result: Quick links are functional and navigate to respective sections correctly
Pass/Fail: [ ]

---

ID: TC-010
Title: Dashboard refreshes without losing user state
Precondition: User on dashboard, filters/selections applied
Steps:
  1. Press F5 or click refresh button
  2. Verify dashboard reloads
Expected Result: Dashboard reloads, user remains logged in, view state is restored or reset to default
Pass/Fail: [ ]

---

## Section 3: Clients — CRUD Operations

---

ID: TC-011
Title: Create new client with required fields
Precondition: User on Clients page, no form errors
Steps:
  1. Click "New Client" button
  2. Fill in name, email, phone (required fields)
  3. Click "Create" button
Expected Result: Client created successfully, confirmation message shown, new client appears in client list
Pass/Fail: [ ]

---

ID: TC-012
Title: View client details
Precondition: At least one client exists in system
Steps:
  1. Click on any client in client list
  2. Client details modal/page opens
  3. Verify all sections (Profile, Cases, Notes, Documents) are present
Expected Result: Client detail page displays with all information sections accessible, no errors
Pass/Fail: [ ]

---

ID: TC-013
Title: Edit client information
Precondition: Client details page open
Steps:
  1. Click "Edit" button on client profile
  2. Modify one or more fields (e.g., phone, email)
  3. Click "Save" button
Expected Result: Changes saved successfully, confirmation message shown, updated data displays
Pass/Fail: [ ]

---

ID: TC-014
Title: Delete client
Precondition: Client selected, user has delete permission
Steps:
  1. Click "Delete" button on client details
  2. Confirm deletion in modal
Expected Result: Client deleted, removed from list, confirmation message shown, no longer searchable
Pass/Fail: [ ]

---

ID: TC-015
Title: Search clients by name
Precondition: Multiple clients exist in system
Steps:
  1. Go to Clients page
  2. Enter partial name in search box (e.g., "John")
  3. Press Enter or wait for auto-search
Expected Result: Client list filters to show only matching names, search is case-insensitive
Pass/Fail: [ ]

---

ID: TC-016
Title: Filter clients by type
Precondition: Clients page loaded, multiple client types exist
Steps:
  1. Locate client type filter
  2. Select "Individual" from filter dropdown
  3. Observe filtered results
Expected Result: Client list shows only Individual clients, other types hidden
Pass/Fail: [ ]

---

ID: TC-017
Title: Hover snapshot preview on client list
Precondition: Clients page with client list visible
Steps:
  1. Hover cursor over a client name/row for 2 seconds
  2. Wait for snapshot preview to appear
Expected Result: Snapshot preview tooltip displays key client info (name, email, phone, recent cases)
Pass/Fail: [ ]

---

ID: TC-018
Title: Client notes tab displays all notes
Precondition: Client details open, client has multiple notes
Steps:
  1. Click "Notes" tab in client modal
  2. Verify all notes are listed with timestamps
  3. Scroll through notes
Expected Result: Notes displayed in reverse chronological order, each with author and timestamp
Pass/Fail: [ ]

---

ID: TC-019
Title: Add new note to client via notes tab
Precondition: Client details open, on Notes tab
Steps:
  1. Click "Add Note" button
  2. Enter note text in editor
  3. Click "Save Note" button
Expected Result: Note created, timestamp added, appears at top of notes list
Pass/Fail: [ ]

---

ID: TC-020
Title: Client search with special characters
Precondition: Clients page loaded
Steps:
  1. Enter special characters in search (e.g., "O'Brien", "José")
  2. Press Enter
Expected Result: Search handles special characters correctly, returns matching clients or "no results"
Pass/Fail: [ ]

---

## Section 4: Cases Management

---

ID: TC-021
Title: Create new case for client
Precondition: Client selected, Cases section visible
Steps:
  1. Click "New Case" button
  2. Select case type (e.g., "PR", "Work Visa")
  3. Enter case reference number
  4. Click "Create" button
Expected Result: Case created, linked to client, appears in client's case list
Pass/Fail: [ ]

---

ID: TC-022
Title: Assign case to correct client
Precondition: Case creation form open
Steps:
  1. Click "Select Client" dropdown
  2. Search for and select client name
  3. Verify selection shows in form
Expected Result: Client assignment successful, case linked to correct client
Pass/Fail: [ ]

---

ID: TC-023
Title: Update case status
Precondition: Case details open, case has initial status
Steps:
  1. Click status dropdown field
  2. Select new status (e.g., "In Progress" → "Approved")
  3. Click "Save"
Expected Result: Status updated, displayed in case list and details with updated timestamp
Pass/Fail: [ ]

---

ID: TC-024
Title: Add note to case
Precondition: Case details open
Steps:
  1. Scroll to notes section
  2. Click "Add Note" button
  3. Type case note
  4. Click "Save Note"
Expected Result: Note attached to case, displays with timestamp, visible in case timeline
Pass/Fail: [ ]

---

ID: TC-025
Title: Case document checklist
Precondition: Case details open
Steps:
  1. Click "Documents" or "Checklist" tab
  2. Verify list of required documents
  3. Check off items as they are received
Expected Result: Checklist displays with checkboxes, can mark items complete, progress tracked
Pass/Fail: [ ]

---

ID: TC-026
Title: Case search by reference number
Precondition: Cases page loaded
Steps:
  1. Enter case reference number in search
  2. Press Enter
Expected Result: Case found and highlighted, or "no results" if not found
Pass/Fail: [ ]

---

ID: TC-027
Title: View case timeline
Precondition: Case details open
Steps:
  1. Click "Timeline" or "Activity" tab
  2. Observe chronological list of events
Expected Result: Timeline displays all case modifications, assignments, and notes in order
Pass/Fail: [ ]

---

ID: TC-028
Title: Case documents tab lists all attachments
Precondition: Case has uploaded documents
Steps:
  1. Click "Documents" tab
  2. Verify all uploaded files are listed
Expected Result: All documents display with upload date, file type, file size
Pass/Fail: [ ]

---

ID: TC-029
Title: Add deadline to case
Precondition: Case details open
Steps:
  1. Click "Add Deadline" button
  2. Select date from calendar
  3. Enter deadline description
  4. Click "Save"
Expected Result: Deadline created, appears in case details and on dashboard deadline widget
Pass/Fail: [ ]

---

ID: TC-030
Title: Case bulk status update
Precondition: Cases list view, multiple cases selected
Steps:
  1. Select multiple cases (checkboxes)
  2. Click "Bulk Update" button
  3. Select new status for all
  4. Confirm
Expected Result: All selected cases updated to new status simultaneously
Pass/Fail: [ ]

---

## Section 5: Notes System

---

ID: TC-031
Title: Add note via Add Note button
Precondition: Client or case details open
Steps:
  1. Click "Add Note" button
  2. Type note text in editor
  3. Click "Save Note"
Expected Result: Note created, displays in notes list with timestamp and author
Pass/Fail: [ ]

---

ID: TC-032
Title: Save note with Ctrl+Enter
Precondition: Note editor open, cursor in text field
Steps:
  1. Type note text
  2. Press Ctrl+Enter (or Cmd+Enter on Mac)
  3. Verify note saves without clicking button
Expected Result: Note saves and closes editor, keyboard shortcut works
Pass/Fail: [ ]

---

ID: TC-033
Title: Note timestamp displays correctly
Precondition: Note created within last hour
Steps:
  1. View note in list
  2. Check timestamp display
Expected Result: Timestamp shows relative time ("5 minutes ago") or absolute time, is accurate
Pass/Fail: [ ]

---

ID: TC-034
Title: Notes display in reverse chronological order
Precondition: Multiple notes exist on client/case
Steps:
  1. View notes list
  2. Verify newest notes appear at top
Expected Result: Most recent notes at top, oldest at bottom
Pass/Fail: [ ]

---

ID: TC-035
Title: Edit existing note
Precondition: Note exists in system
Steps:
  1. Click note text or edit icon
  2. Modify note content
  3. Click "Save" or press Ctrl+Enter
Expected Result: Note updated, timestamp shows edit time, original content replaced
Pass/Fail: [ ]

---

## Section 6: Import Doc Tab

---

ID: TC-036
Title: Upload and extract DOCX file
Precondition: Import Doc tab open, DOCX file available (max 5MB)
Steps:
  1. Click "Upload Document" button
  2. Select DOCX file from system
  3. Wait for processing
  4. Verify text extracted to preview
Expected Result: DOCX processed with Mammoth, text extracted and displayed in preview panel
Pass/Fail: [ ]

---

ID: TC-037
Title: Upload and extract TXT file
Precondition: Import Doc tab open, TXT file available
Steps:
  1. Click "Upload Document" button
  2. Select TXT file
  3. Wait for processing
  4. Verify text displayed
Expected Result: TXT content displayed in preview, ready for field mapping
Pass/Fail: [ ]

---

ID: TC-038
Title: Paste text directly into import
Precondition: Import Doc tab open
Steps:
  1. Click "Paste Text" option
  2. Paste text into text area
  3. Click "Process"
Expected Result: Text processed, displayed in preview, field mapping panel appears
Pass/Fail: [ ]

---

ID: TC-039
Title: Apply extracted data to client record
Precondition: Document imported, text extracted, field mappings configured
Steps:
  1. Click "Apply to Record" button
  2. Select target client
  3. Verify mapped fields
  4. Click "Confirm Apply"
Expected Result: Data applied to client profile, confirmation shown, fields updated
Pass/Fail: [ ]

---

ID: TC-040
Title: Field mapping configuration
Precondition: Document text in preview panel
Steps:
  1. Locate field mapping panel
  2. Drag text from preview to field
  3. Or click to auto-detect fields
  4. Verify mappings are correct
Expected Result: Field mappings display, can be manually adjusted or auto-detected
Pass/Fail: [ ]

---

## Section 7: AI Assistant Tab — Gmail Integration

---

ID: TC-041
Title: Gmail token survives client switch
Precondition: Gmail connected, viewing Client A AI tab
Steps:
  1. Note Gmail shows "已连接"
  2. Close Client A modal
  3. Open Client B modal → go to AI tab
Expected Result: Gmail still shows "已连接" without requiring reconnection
Pass/Fail: [ ]

---

ID: TC-042
Title: Gmail token does NOT survive page refresh
Precondition: Gmail connected
Steps:
  1. Note Gmail shows "已连接"
  2. Refresh the browser (F5)
  3. Open any client modal → AI tab
Expected Result: Gmail shows "连接 Google 账号" button — token cleared
Pass/Fail: [ ]

---

ID: TC-043
Title: Search Gmail emails by keyword
Precondition: Gmail connected, client AI tab open
Steps:
  1. Enter search keyword (e.g., "visa", "invoice") in email search box
  2. Click "Search" button
  3. Wait for results to load
Expected Result: Matching emails display in list with subject, sender, date, snippet
Pass/Fail: [ ]

---

ID: TC-044
Title: Add note to specific email
Precondition: Gmail emails listed, one email selected
Steps:
  1. Click on email row
  2. Click "Add Note" button in email detail
  3. Enter note text
  4. Click "Save Note"
Expected Result: Note created and associated with email, displayed in timeline
Pass/Fail: [ ]

---

ID: TC-045
Title: Add timeline note via email search
Precondition: Email search results displayed
Steps:
  1. Click "Add to Timeline" button
  2. Enter note text describing email significance
  3. Click "Save"
Expected Result: Note added to client timeline, email reference included
Pass/Fail: [ ]

---

ID: TC-046
Title: Reset Gmail query button clears search
Precondition: Gmail search executed, results displayed
Steps:
  1. Click "Reset Query" or clear button
  2. Verify email search box clears
  3. List returns to initial state (no search results)
Expected Result: Search cleared, email list resets to default view
Pass/Fail: [ ]

---

## Section 8: AI Assistant Tab — Document Upload

---

ID: TC-047
Title: Upload passport image (JPG/PNG)
Precondition: AI Documents section open
Steps:
  1. Click "Upload Document" button
  2. Select JPG or PNG image file
  3. Verify upload success message
Expected Result: Image uploaded, OCR processed if available, text extracted
Pass/Fail: [ ]

---

ID: TC-048
Title: Upload PDF visa grant letter
Precondition: AI Documents section open, PDF file available
Steps:
  1. Click "Upload Document" button
  2. Select PDF file
  3. Wait for processing
Expected Result: PDF uploaded, text extracted, displayed in preview
Pass/Fail: [ ]

---

ID: TC-049
Title: Upload DOCX file via AI tab
Precondition: AI Documents section open
Steps:
  1. Click "Upload Document" button
  2. Select DOCX file (e.g., contract, agreement)
  3. Wait for Mammoth extraction
Expected Result: DOCX processed, text extracted and displayed for snapshot generation
Pass/Fail: [ ]

---

ID: TC-050
Title: Upload TXT file via AI tab
Precondition: AI Documents section open
Steps:
  1. Click "Upload Document" button
  2. Select TXT file
  3. Verify content displayed
Expected Result: TXT content loaded, can be used in snapshot generation
Pass/Fail: [ ]

---

## Section 9: AI Assistant Tab — Apply to Profile

---

ID: TC-051
Title: Apply to Profile — no-clobber on populated field
Precondition: Client has passportNo = "EJ2927083"
Steps:
  1. Generate snapshot for the client
  2. Click "应用到档案"
  3. Confirm Apply (overwrite toggle OFF)
Expected Result: Client's passportNo remains "EJ2927083" — not overwritten
Pass/Fail: [ ]

---

ID: TC-052
Title: Apply to Profile — overwrites when toggle ON
Precondition: Client has passportNo = "OLD123", snapshot contains passportNo = "NEW456"
Steps:
  1. Generate snapshot
  2. Click "应用到档案"
  3. Toggle ON "覆盖已有字段"
  4. Confirm Apply
Expected Result: Client's passportNo changes to "NEW456"
Pass/Fail: [ ]

---

ID: TC-053
Title: Apply to Profile — appends to existing visaHistory
Precondition: Client has 1 visaHistory entry (applicationNo = "A1")
Steps:
  1. Generate snapshot containing 2 entries: A1 and A2
  2. Apply to Profile (overwrite OFF)
Expected Result: visaHistory has 2 entries — A1 kept, A2 appended, no duplicate A1
Pass/Fail: [ ]

---

## Section 10: AI Assistant Tab — Snapshot Generation

---

ID: TC-054
Title: Generate snapshot with CRM data only
Precondition: Client details complete, no emails/documents uploaded
Steps:
  1. Go to Snapshot section
  2. Click "Generate Snapshot — CRM Only"
  3. Wait for generation
Expected Result: Snapshot generated with 7 sections, contains CRM data (name, phone, email, visa history)
Pass/Fail: [ ]

---

ID: TC-055
Title: Generate snapshot with CRM + emails
Precondition: Gmail connected, emails searched and selected
Steps:
  1. Go to Snapshot section
  2. Click "Generate Snapshot — CRM + Gmail"
  3. Wait for processing
Expected Result: Snapshot includes email summaries in relevant sections, Gmail data integrated
Pass/Fail: [ ]

---

ID: TC-056
Title: Generate snapshot with CRM + documents
Precondition: Documents uploaded to AI tab
Steps:
  1. Go to Snapshot section
  2. Click "Generate Snapshot — CRM + Docs"
  3. Wait for processing
Expected Result: Snapshot includes extracted document text, OCR results integrated
Pass/Fail: [ ]

---

ID: TC-057
Title: Generate snapshot with all three sources
Precondition: Gmail connected, emails selected, documents uploaded
Steps:
  1. Go to Snapshot section
  2. Click "Generate Full Snapshot"
  3. Wait for all processing
Expected Result: Snapshot includes CRM, email, and document data in 7 bilingual sections
Pass/Fail: [ ]

---

ID: TC-058
Title: Download snapshot as TXT file
Precondition: Snapshot generated and displayed
Steps:
  1. Click "Download as TXT" button
  2. Save file to downloads folder
  3. Open file and verify content
Expected Result: TXT file downloaded with full snapshot content, readable in text editor
Pass/Fail: [ ]

---

ID: TC-059
Title: Copy snapshot to clipboard
Precondition: Snapshot generated and displayed
Steps:
  1. Click "Copy to Clipboard" button
  2. Verify success message
  3. Paste into external application
Expected Result: Full snapshot text copied to clipboard, can be pasted elsewhere
Pass/Fail: [ ]

---

ID: TC-060
Title: Save snapshot as client note
Precondition: Snapshot generated and displayed
Steps:
  1. Click "Save as Note" button
  2. Verify snapshot content appears in client notes
  3. Check timestamp
Expected Result: Snapshot saved as timestamped note in client record
Pass/Fail: [ ]

---

## Section 11: WeChat Chat Import

---

ID: TC-061
Title: WeChat chat export and import
Precondition: WeChat chat history file available (JSON format)
Steps:
  1. Go to WeChat Chat Import tab
  2. Click "Import Chat" button
  3. Select WeChat export file
  4. Wait for processing
Expected Result: Chat messages imported, displayed in timeline, associated with client
Pass/Fail: [ ]

---

ID: TC-062
Title: Parse WeChat messages for contact info
Precondition: WeChat chat imported, contains phone numbers and addresses
Steps:
  1. View imported chat
  2. Verify phone numbers and addresses are detected
  3. Check if offered for snapshot inclusion
Expected Result: Contact information extracted and available for snapshot generation
Pass/Fail: [ ]

---

ID: TC-063
Title: WeChat image attachment handling
Precondition: WeChat chat contains images
Steps:
  1. View imported chat with images
  2. Click on image reference
Expected Result: Images display or links provided, not breaking import process
Pass/Fail: [ ]

---

ID: TC-064
Title: WeChat messages appear in client timeline
Precondition: WeChat chat imported
Steps:
  1. Go to client details
  2. Click "Timeline" tab
  3. Look for WeChat message entries
Expected Result: WeChat messages displayed chronologically in timeline with "[WeChat]" label
Pass/Fail: [ ]

---

ID: TC-065
Title: Multiple WeChat chats for same client
Precondition: Client has multiple WeChat chat exports
Steps:
  1. Import first WeChat file
  2. Import second WeChat file for same client
  3. Verify both are appended
Expected Result: Multiple chats merged into client timeline, all messages retained, no duplicates
Pass/Fail: [ ]

---

## Section 12: Leads Management

---

ID: TC-066
Title: Create new lead
Precondition: Leads page accessible
Steps:
  1. Click "New Lead" button
  2. Enter name, email, phone
  3. Select visa type of interest
  4. Click "Create Lead"
Expected Result: Lead created, appears in leads list, marked as "Prospect"
Pass/Fail: [ ]

---

ID: TC-067
Title: Convert lead to client
Precondition: Lead exists in system
Steps:
  1. Click on lead in list
  2. Click "Convert to Client" button
  3. Confirm conversion
Expected Result: Lead converted to Client, moved from Leads to Clients list, status changes
Pass/Fail: [ ]

---

ID: TC-068
Title: Lead qualification status tracking
Precondition: Lead created
Steps:
  1. Open lead details
  2. Update qualification status (e.g., "Hot", "Warm", "Cold")
  3. Save
Expected Result: Lead status updated, displayed in lead list with color coding
Pass/Fail: [ ]

---

ID: TC-069
Title: Lead follow-up reminders
Precondition: Lead created with follow-up date set
Steps:
  1. Set follow-up date on lead
  2. Wait for reminder notification
Expected Result: Notification appears for follow-up, can be dismissed or actioned
Pass/Fail: [ ]

---

ID: TC-070
Title: Lead notes and timeline
Precondition: Lead with notes added
Steps:
  1. View lead details
  2. Check Notes tab
  3. Verify all follow-up actions listed
Expected Result: Lead timeline shows all interactions, notes, and status changes chronologically
Pass/Fail: [ ]

---

## Section 13: Additional Modules

---

ID: TC-071
Title: Create invoice for client
Precondition: Client selected, invoice creation page accessible
Steps:
  1. Click "New Invoice" button
  2. Select client
  3. Enter invoice amount and description
  4. Set due date
  5. Click "Create"
Expected Result: Invoice created, assigned number, email sent to client if enabled
Pass/Fail: [ ]

---

ID: TC-072
Title: Invoice payment tracking
Precondition: Invoice created
Steps:
  1. Open invoice details
  2. Click "Mark as Paid" button
  3. Enter payment date
Expected Result: Invoice status changes to "Paid", payment date recorded
Pass/Fail: [ ]

---

ID: TC-073
Title: Calendar event creation
Precondition: Calendar module accessible
Steps:
  1. Click on calendar date
  2. Click "New Event"
  3. Enter event name, time, client
  4. Click "Create"
Expected Result: Event appears on calendar, notification set for day before
Pass/Fail: [ ]

---

ID: TC-074
Title: Reports — client statistics
Precondition: Reports page loaded
Steps:
  1. Go to Reports section
  2. Click "Client Report"
  3. Select date range
  4. Click "Generate"
Expected Result: Report displays client count, case distribution, visa type breakdown
Pass/Fail: [ ]

---

ID: TC-075
Title: Reports — case completion rate
Precondition: Reports page loaded
Steps:
  1. Go to Reports section
  2. Click "Case Report"
  3. Select month or quarter
Expected Result: Report shows case completion rates, average processing time, bottlenecks
Pass/Fail: [ ]

---

## Section 14: Language & Localization

---

ID: TC-076
Title: Language toggle English to Chinese
Precondition: App loaded in English
Steps:
  1. Locate language toggle (usually header)
  2. Click English (EN)
  3. Select Chinese (ZH-CN)
  4. Verify page reloads
Expected Result: All labels, buttons, and text switch to Chinese, key terms translated correctly
Pass/Fail: [ ]

---

ID: TC-077
Title: Language toggle Chinese to English
Precondition: App loaded in Chinese
Steps:
  1. Locate language toggle
  2. Click Chinese (ZH-CN)
  3. Select English (EN)
  4. Verify page reloads
Expected Result: All interface text switches to English, no missing labels
Pass/Fail: [ ]

---

ID: TC-078
Title: Bilingual form labels and validation messages
Precondition: Language toggle available, form with validation errors
Steps:
  1. Toggle to Chinese
  2. Fill form with invalid data
  3. Submit and check error messages
  4. Toggle to English and repeat
Expected Result: Error messages display in selected language, validation consistent
Pass/Fail: [ ]

---

## Section 15: Contract Generation

---

ID: TC-079
Title: Generate contract template for client
Precondition: Client details complete
Steps:
  1. Open client details
  2. Click "Generate Contract" button
  3. Select contract template type
  4. Click "Generate"
Expected Result: Contract PDF generated with client data populated, download starts
Pass/Fail: [ ]

---

ID: TC-080
Title: Contract signature and archival
Precondition: Contract generated
Steps:
  1. Download contract
  2. Sign contract document
  3. Upload signed version to client record
  4. Check "Documents" tab for archived contract
Expected Result: Signed contract stored in client file, timestamp recorded, marked as executed
Pass/Fail: [ ]

---

## End of Test Plan

**Total Test Cases:** 80
**Last Updated:** 2026-03-23
**Status:** Ready for Execution
