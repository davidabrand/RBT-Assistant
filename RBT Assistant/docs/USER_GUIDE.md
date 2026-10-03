# RBT Assistant for Office Puzzle
## User Guide for Registered Behavior Technicians

**Version:** 1.1.107  
**Browser:** Google Chrome  
**Works with:** Office Puzzle behavior and replacement/skill-acquisition data pages

---

## What This Extension Does

RBT Assistant is a Chrome extension designed to make Office Puzzle data entry faster and easier.

It can help you:

- Automatically connect to an open Office Puzzle page
- Automatically scan and map behavior/program tables
- Read existing data already entered in Office Puzzle
- Help organize weekly targets
- Review today's value or trial pattern before adding it to a batch
- Run a reviewed batch automatically
- Show progress while a batch is running
- Move between behaviors/programs using a dropdown list
- Use keyboard shortcuts for common actions

The extension is designed to reduce repetitive clicking while keeping the RBT in control of the data being entered.

---

# Important Before You Use It

## Only enter reviewed, observed data

The extension should only be used to enter data that you have actually reviewed and that reflects the session.

Do **not** use the extension to create, guess, or invent:

- Behavior occurrences
- Trial outcomes
- Interval outcomes
- Session results
- Clinical documentation

Your BCBA, supervisor, or employer should determine which targets and programs you are responsible for collecting.

The extension automates the **entry process**. It does not replace clinical judgment or supervision.

---

# Installation

This extension is currently installed as an unpacked Chrome extension.

1. Unzip the extension folder.
2. Open Google Chrome.
3. Go to:

   `chrome://extensions`

4. Turn on **Developer mode** in the top-right corner.
5. Click **Load unpacked**.
6. Select the extension folder.
7. Pin **RBT Assistant for Office Puzzle** to the Chrome toolbar if desired.

---

# Opening the Extension

1. Open Office Puzzle.
2. Navigate to the client's data page.
3. Click the RBT Assistant extension icon.
4. The side panel should open.

The extension should now connect automatically.

You normally do **not** need to:

- Refresh the Office Puzzle page
- Press the extension refresh button
- Manually scan every table

The extension will attempt to do this automatically.

---

# Automatic Connection

When the extension opens, it automatically attempts to connect to the active Office Puzzle tab.

The top of the extension should show:

**Connected**

If Office Puzzle was already open before the extension was loaded, the extension will attempt to attach itself automatically.

The refresh icon can still be used as a manual **Sync now** button if needed.

---

# Automatic Table Scanning

The extension automatically scans the tables on the currently open Office Puzzle page.

The number of tables depends on the client and page that is open.

You may see the scan count increase while Office Puzzle loads:

`5 / 12`

then:

`9 / 12`

then:

`12 / 12`

If Office Puzzle loads additional tables as you scroll, the extension will continue scanning them automatically.

Once all expected tables are mapped, automatic scanning stops for that page.

A **Scan now** button is still available as a fallback.

---

# Selecting a Behavior or Program

Use the dropdown list to select the behavior or replacement program you want to work with.

The previous/next arrow buttons were removed to keep the interface cleaner.

The dropdown is now the main way to move between:

- Behaviors
- Challenging behaviors
- Replacement programs
- Skill-acquisition programs

---

# Weekly Planning

For supported programs, you can enter a weekly target.

The extension may use previously entered Office Puzzle data to show how much has already been completed and how much remains.

Weekly planning is intended to help organize work.

Always review today's value or trial pattern before adding it to the batch.

---

# Adding an Item to the Batch

When today's value or pattern is ready:

1. Review the value or trial pattern.
2. Click **Add to batch**.

Once added, the item is considered:

**Verified**

This means you reviewed the value before adding it.

You do not need to verify it again after Run Batch starts.

---

# Batch Statuses

You may see the following statuses:

### Verified
The item has been reviewed and is ready to run.

### Applying
The extension is currently entering that item into Office Puzzle.

### Completed
The extension entered the data and confirmed the Office Puzzle table reached the expected result.

### Stopped
The extension detected a problem and stopped before continuing to later items.

---

# Run Batch

**Run Batch** is the single batch-start control.

It processes the reviewed items one at a time using the same verified batch engine.

## Office Puzzle tab lock

When you press **Run Batch**, the extension locks the run to that exact Office Puzzle browser tab.

After the run starts:

- You may switch to another Chrome tab.
- You may leave the side panel open while using another tab.
- All batch scans, writes, verification checks, and Stop commands continue targeting the original Office Puzzle tab.
- The Office Puzzle tab must remain open.
- Do not navigate that locked tab away from Office Puzzle while the batch is running.
- If the locked Office Puzzle tab is closed or changed, Run Batch stops instead of writing to another tab.

Example:

1. Program 1 → Completed
2. Program 2 → Completed
3. Program 3 → Completed
4. Program 4 → Completed

The extension waits briefly between items so Office Puzzle has time to update.

You do not need to approve each item again.

---

# Run Batch Progress Bar

The Run Batch section shows the current progress.

Example:

`3 / 8 completed    38%`

The bar updates as each reviewed item is completed.

---

# Sticky Bottom Action Bar

The bottom of the extension stays visible while you scroll.

It contains:

- **Add to batch**
- **Run Batch**
- **Stop**

The buttons automatically control the currently open Office Puzzle page.

---

# Keyboard Shortcuts

You can use these shortcuts:

### Add to batch
**Windows:** `Ctrl + Enter`  
**Mac:** `Command + Enter`

### Run Batch
`Alt + R`

The Alt shortcuts are disabled while you are actively typing in a text field or selecting from a dropdown.

---

# Profile A Behaviors

Supported Profile A behavior pages use **Frequency** data.

Examples include:


For Frequency data, enter the reviewed observed count for the day.

Example:

If the observed count is:

`5`

the extension enters the count into the correct current-day behavior column.

---

# Profile A Replacement / Skill Acquisition

Profile A replacement programs use:

**Percentage of Opportunities**

Each program contains 10 trials.

Each trial should be reviewed as:

`+` = successful opportunity

or

`-` = unsuccessful opportunity

All 10 trials should be reviewed before adding the pattern to the batch.

---

# Profile B Challenging Behaviors

Profile B challenging behaviors may use either:

- Frequency
- Partial Interval

The extension automatically recognizes the configured method for each program.

---

# Profile B Frequency

Frequency programs use a reviewed observed count.

Example:

`3 occurrences`

Enter:

`3`

Then add the reviewed count to the batch.

---

# Profile B Partial Interval

Partial Interval programs use 30-minute intervals.

The number of active intervals depends on the number of hours worked.

Examples:

| Hours | Active Intervals |
|---:|---:|
| 2.5 | 5 |
| 3.0 | 6 |
| 3.5 | 7 |
| 4.0 | 8 |
| 5.0 | 10 |
| 6.0 | 12 |

Review each active interval as:

`+` = occurrence

`-` = no occurrence

Unused intervals remain blank.

---

# Profile B Replacement / Skill Acquisition

Profile B replacement programs also use:

**Percentage of Opportunities**

There are 10 trials per program.

Review all 10 trial outcomes before adding the item to the batch.

---

# Safe Mode

The extension uses a protected write process.

Reading, scanning, planning, and syncing do not write clinical data.

A write only occurs after a reviewed item is intentionally added/applied.

During Run Batch, each individual Office Puzzle write is still separately authorized by the extension's internal Safe Mode.

---

# What Happens if Something Goes Wrong?

The extension is designed to stop instead of continuing blindly.

If an item cannot be confirmed:

1. The current item is marked as stopped/failed.
2. Run Batch stops.
3. Later items are not touched.
4. Review the Office Puzzle table.
5. Correct or re-review the item if necessary.
6. Run the batch again.

Previously completed items are skipped.

---

# If the Extension Says "Not Connected"

Try the following:

1. Make sure the active browser tab is Office Puzzle.
2. Wait a few seconds.
3. Click the **Sync now** icon.
4. If needed, refresh the Office Puzzle page.
5. Close and reopen the extension side panel.

---

# If Not All Tables Are Mapped

If you see something like:

`7 / 12 mapped`

try:

1. Scroll farther down the Office Puzzle page.
2. Wait a few seconds.
3. Allow the automatic scan to run again.

Office Puzzle may load tables only after they become visible.

You can also click **Scan now**.

---

# If Run Batch Stops

Check the item that stopped.

Confirm that:

- The correct client is open
- The correct date is selected
- The correct Office Puzzle page is open
- The reviewed batch value is correct
- The table finished loading

Do not repeatedly click Run Batch if the Office Puzzle page itself appears frozen or incorrect.

---

# If the Wrong Client or Page Is Showing

Switch to the correct Office Puzzle client/page.

The extension should automatically detect the change and update the side panel.

If it does not, use **Sync now**.

---

# Recommended Daily Workflow

A typical workflow is:

1. Open the client's Office Puzzle page.
2. Open RBT Assistant.
3. Wait for **Connected**.
4. Let the tables auto-map.
5. Select a behavior/program from the dropdown.
6. Review today's observed value or trial pattern.
7. Click **Add to batch**.
8. Repeat for the items you need.
9. Review the Batch Review list.
10. Click **Run Batch**.
11. Watch the progress bar.
12. Confirm the expected items show **Completed**.

---

# Before Leaving the Session

Before finishing your documentation:

- Review the entered Office Puzzle data
- Confirm the correct client was used
- Confirm the correct date was used
- Confirm the expected programs were completed
- Resolve any stopped/failed batch items
- Follow your employer's normal documentation procedures

---

# Privacy and HIPAA

The extension may interact with protected health information displayed in Office Puzzle.

Use it only on:

- Employer-approved devices
- Employer-approved Chrome profiles
- Approved networks
- Approved Office Puzzle accounts

Do not copy or export client-identifying information to personal devices, personal cloud storage, messaging apps, or other unapproved systems.

Follow your employer's HIPAA, privacy, security, and data-retention requirements.

---

# Important Clinical Reminder

RBT Assistant is an automation tool.

It does **not**:

- Make clinical decisions
- Replace a BCBA
- Determine whether a behavior occurred
- Determine whether a trial was successful
- Create session data
- Replace required supervision

The RBT remains responsible for reviewing the information before it is entered.

---

# Quick Reference

| Action | Control |
|---|---|
| Connect/sync | Automatic |
| Manual sync | ↻ Sync now |
| Scan tables | Automatic |
| Manual scan | Scan now |
| Select behavior/program | Dropdown |
| Add reviewed item | Add to batch |
| Run reviewed batch | Run Batch |
| Stop active batch | Stop |
| Add shortcut | Ctrl/Cmd + Enter |
| Run Batch shortcut | Alt + R |

---

## Version

RBT Assistant for Office Puzzle  
**Version 1.1.15**

This guide is intended for RBT users of the extension.


---

# Clickable Date Navigator

The Monday–Friday strip is now an Office Puzzle date navigator.

- Click an available weekday card to switch Office Puzzle to that date.
- Use **‹** immediately before Monday and **›** immediately after Friday to move one week backward or forward.
- Select dates directly from the writable-date strip. Only Office Puzzle dates that are currently available for entry appear there.
- The weekday strip slides sideways when the selected week changes.
- Dates outside the available window are greyed out.
- The extension permits up to 7 days back and 7 days ahead, intersected with any stricter minimum/maximum date exposed by Office Puzzle.
- Reviewed batches remain stored separately by client and selected date.
- Run Batch must be stopped/completed before the selected Office Puzzle date can change.
- Future dates can be opened for planning/review, but observed-data writes are blocked until the date is today or in the past.


---

# Stop During Apply Now

The Stop controls work during both **Apply now** and **Run Batch**.

- Stop becomes enabled as soon as an actual Office Puzzle data writer starts.
- Stop is sent to the exact Office Puzzle tab performing that write.
- A click already dispatched may finish.
- No additional trial, interval, or count clicks should be sent after the writer receives Stop.
- During Run Batch, later batch items do not start after Stop.


---

# In-Table Date Navigation

Date selection does **not** reload Office Puzzle.

The extension reads the actual **Days** row already visible in the Office Puzzle table and uses those exact date columns as the available navigation range.

- Clicking Mon–Fri changes only which existing Office Puzzle table column the extension targets.
- The Office Puzzle page URL does not change.
- Office Puzzle does not refresh just because you select another date in the extension.
- The earliest selectable date is the first date found in the visible Days row.
- The latest selectable date is the last date found in the visible Days row.
- A day is disabled only when that exact date does not exist in the currently rendered Office Puzzle table.
- Previous/next arrows are enabled only when the adjacent week contains at least one available weekday column.
- The extension re-scans the current table in place after changing the target date.


---

# Sticky Next and Simplified Review

The sticky action bar is:

**Add to batch | Next › | Run Batch | Stop**

- **Next ›** advances to the next behavior/replacement/program without scrolling back to the dropdown.
- Next stops at the final item instead of wrapping to the first.
- Shortcut: **Alt + N**.

For Percentage of Opportunities and Partial Interval programs:

1. Click **Review trials** / **Review intervals**.
2. The +/- editor appears inline without a separate Review card/header.
3. The same review button becomes **Confirm review**.
4. Confirming enables the sticky **Add to batch** action.
5. **Cancel** and **Apply now** remain beside the inline editor.
6. The duplicate Add to batch buttons inside the page content have been removed; the sticky Add button is the single batch-add control.
7. Editing a +/- outcome after confirming automatically changes the state back to unconfirmed until you press **Confirm review** again.


---

# Review Grid Cleanup

The duplicate +/- grid that used to appear after pressing **Review trials** / **Review intervals** has been removed.

- The existing planned trial/interval pattern remains the single visible set of values.
- Pressing Review now only changes the review button state to **Confirm review** and reveals Cancel / Apply now.
- No second copy of the same 1–10 +/- buttons is shown underneath.


---

# Automatic Client Profiles (v1.1.0)

The extension can now learn a client directly from the Office Puzzle page.

For each visible program it reads:

- exact **Name**
- **Category**
- **Collection Method**
- actual Office Puzzle **table structure**

Supported table structures are mapped automatically:

- **Frequency** → count / X writer
- **Partial Interval** → +/- interval writer
- **Percentage of Opportunities** → 10-trial +/- writer

The learned profile is stored locally per client and grows as additional Office Puzzle program pages are visited. This means a newly-added program can be learned without publishing a new extension version.

### Safety behavior

- Discovery is read-only.
- A program is not assigned a writer from its name alone.
- Collection Method is checked against the actual table structure.
- Unknown/unsupported collection methods are learned as unsupported and are not given a write action.
- Existing legacy Profile A / Profile B lists remain only as fallback until a usable learned profile exists.
- Clinical writes still require the existing explicit Apply/Add-to-batch workflow and Safe Mode write token.


---

# Sticky Previous / Next

The sticky bar now includes both directions:

**Add to batch | ‹ Previous | Next › | Run Batch | Stop**

- **‹ Previous** moves to the prior behavior/replacement/program.
- **Next ›** moves to the next one.
- Previous is disabled on item #1.
- Next is disabled on the final item.
- Both are disabled during an active write or Run Batch.
- Shortcuts: **Alt + P** for Previous and **Alt + N** for Next.


---

# Automatic Discovery Only

Section-level Scan / Discover buttons were removed in v1.1.2.

Normal behavior is now:

1. Open or switch to an Office Puzzle client/page.
2. The extension automatically discovers program names, collection methods, and table mappings.
3. Discovery stops repeating once the current client/page is fully mapped.
4. Use the top-right **↻ Sync** button only when you want to force a refresh/rediscovery.

The top-right Sync performs the same context refresh and automatic client discovery without requiring separate scan buttons in each section.


---

# Multi-Program Discovery + Full Daily Readback (v1.1.3)

The automatic client scanner now binds each visible Office Puzzle **Name** row to
its own program block and its own supported data table.

This fixes the case where only the first behavior/skill on a multi-program page
was learned.

It also reads live values for **every date column visible in the Office Puzzle
table**, not only Monday-Friday of the currently selected week:

- Frequency: daily count for every visible date.
- Partial Interval: daily +/- states and daily average for every visible date.
- Percentage of Opportunities: 10-trial daily +/- states and daily average for every visible date.

Each supported table can be assigned to only one program during discovery, so a
later program cannot accidentally reuse the first program's table.


---

# Full DOM Discovery + Actual-Value Precedence (v1.1.4)

The scanner now reads the **full live Office Puzzle DOM**, including hidden or
collapsed program sections. It no longer requires every program/table to be
visually displayed.

Program binding uses document order:

`Name / Category / Collection Method metadata` → supported data table → next
program's `Name` metadata.

Hidden table cells are parsed by HTML column structure (including `colspan`)
instead of relying on screen coordinates.

Planning now follows a strict display rule:

**An existing Office Puzzle actual value always overrides a generated plan.**

If the selected date already has a Daily average of 60%, the side panel shows
**60% actual**, counts those 6 successes toward the week, and does not continue
showing an old 50% plan for that date.


---

# Automatic Actual-Date Visibility (v1.1.5)

The extension now reads and displays every already-recorded date from the
currently loaded Office Puzzle table immediately. You do not have to select
each date first.

This is one global rule shared by every supported workflow:

**Office Puzzle actual data always overrides planning data.**

- Frequency: all loaded recorded dates show their actual count.
- Partial Interval: all loaded recorded dates show their actual percentage and
  interval states when available.
- Percentage of Opportunities: all loaded recorded dates show their actual
  Daily average and trial states when available.
- Recorded days are counted toward weekly actual totals immediately.
- Recorded days are excluded from remaining generated-plan capacity.
- Stored plans are refreshed when the live actual-date fingerprint changes.

For Frequency, a positive count is actual automatically. A documented zero is
distinguished from a blank date using the Office Puzzle Initials row.

No clinical write/click process was changed in this release.


---

# Inventory-First Client Discovery (v1.1.6)

The automatic profile scanner no longer decides that the client has only one
program just because only one program name was resolved on an early scan.

Discovery now works in this order:

1. Inventory every supported Office Puzzle data table in the full DOM.
2. Resolve program names from multiple sources:
   - hidden and visible `Name:` metadata
   - Office Puzzle native program/behavior/skill `<select>` options
   - table-local headings and attributes
   - current visible program name
3. Match those names to the ordered supported table inventory.
4. Compare `mapped programs` against the independent `table inventory`.
5. Only certify a learned page profile after two identical complete scans.
6. Continue a periodic audit after completion so lazy-loaded tables can still
   be discovered later.

A partial discovery can be stored as progress, but it cannot replace a working
dropdown with `1 of 1`. Version 1.1.6 also bumps the learned-profile schema so
incomplete one-program profiles created by the earlier buggy scanner are
automatically discarded and rebuilt.

No Office Puzzle write/click/fill process was changed.


---

# UI Cleanup (v1.1.7)

The normal workflow now uses the top **Auto profile** indicator as the single
visible discovery/profile status.

The following redundant status bars are hidden from the interface:

- per-section “Mapped X/X … supported tables … names resolved” diagnostics
- “Current-day column found · Existing count … Grid max …” details
- equivalent replacement/interval table-status banners

The elements remain internally available so existing scan/mapping code does not
need to change. This is a visual cleanup only.

No Office Puzzle read, write, Apply now, Run Batch, initialization, pacing,
Safe Mode, or Stop behavior was changed.


---

# UI Polish (v1.1.8)

The visible **Safe Mode** card was removed from the side-panel interface to
reduce clutter. Internal one-write token / confirmation protections remain in
place so the existing Apply now and Run Batch workflows continue working as
before.

The sticky bar was redesigned for narrow extension widths:

**Add to batch | ‹ Prev | Next › | Run Batch | Stop**

- consistent inherited font across every button
- compact spacing
- responsive minimum widths
- smaller typography at very narrow side-panel widths
- Previous/Next no longer clip or overflow
- no change to button behavior or shortcuts


---

# Required Input Validation (v1.1.9)

Missing required values now produce an explicit red validation message and
focus the field that needs attention.

Examples:

- Generate with no Frequency weekly total:
  **Weekly total is required before generating a plan.**
- Generate with no weekly percentage:
  **Weekly percentage is required before generating a plan.**
- Apply/Add to batch with no count:
  **Reviewed count is required…**
- Add a +/- program without confirming review:
  **Review and confirm the trial/interval outcomes…**

The sticky **Add to batch** button remains clickable for a mapped program even
when a reviewed value has not been entered yet, specifically so clicking it can
explain what is missing instead of silently remaining disabled.

A JavaScript empty-string issue was also corrected: `Number("")` evaluates to
zero, so the main Frequency weekly-total planner now checks the raw field before
numeric conversion.

No Office Puzzle writer/click/pacing logic was changed.


---

# Section Heading Cleanup (v1.1.10)

Redundant second-line section headings were removed where the eyebrow label
already explains the section:

- MALADAPTIVE BEHAVIORS
- BEHAVIORS
- REPLACEMENTS / SKILLS

The selected behavior/replacement name remains visible below the section label.
The main app title and Batch Control / Run Batch heading remain because they are
not redundant.

No JavaScript or workflow behavior changed.


---

# Current Client Card Cleanup (v1.1.11)

The top client card was simplified further:

- removed the redundant **Current client** label
- hid the extra page-type line
- kept the actual client name
- kept the connection badge
- kept the **Auto profile · X programs learned** status

This build also includes the v1.1.10 removal of redundant secondary section
titles under MALADAPTIVE BEHAVIORS, BEHAVIORS, and REPLACEMENTS / SKILLS.

No JavaScript or workflow logic changed.


---

# Confirm Review Required (v1.1.12)

For every +/- workflow, **Confirm review is now mandatory** before either action
can continue:

- Apply now
- Add to batch

The Apply now button stays disabled until review is confirmed. Add to batch is
also blocked by the existing review-confirmation validation.

If any +/- outcome is changed after confirmation, the review becomes
unconfirmed again and must be confirmed once more.

Batch Review wording was also clarified. Instead of wording such as:

`2/10 successful · 20%`

the batch now shows:

`Reviewed pattern: 2 + / 8 − · 20%`

This describes exactly what was reviewed without making a planned/unwritten
pattern sound like already-recorded actual data.

No Office Puzzle click/fill process was changed.


---

# Pending Batch Wording (v1.1.13)

Batch metadata for +/- programs now uses short neutral wording.

Example:

`Pending · 2/10 · 20%`

Partial Interval example:

`Pending · 2/8 · 25.0% · 4h`

This replaces the longer “Reviewed pattern” wording and does not describe
pending values as successful outcomes.

No workflow or write logic changed.


---

# Batch Operation Status Wording (v1.1.14)

Batch metadata now reflects the batch operation state itself.

Examples:

- Before running: `Pending · 2/8 · 25.0% · 4h`
- While running: `Applying · 2/8 · 25.0% · 4h`
- After Office Puzzle verifies the item: `Successful · 2/8 · 25.0% · 4h`
- If the item stops/fails: `Stopped · 2/8 · 25.0% · 4h`

`Successful` refers only to the extension successfully completing that batch
item. It does not describe the clinical meaning of the +/- outcomes.

No write/click/batch execution process changed.


---

# Initial Actual-Data Refresh (v1.1.15)

Fixed a startup timing issue affecting the first selected program.

Previously, program #1 could render before automatic Office Puzzle discovery
finished. Discovery would then load the correct live mappings, but the
preserve-draft path did not refresh the weekly/actual-data view until the user
changed to another program.

Now, immediately after discovery completes, the extension refreshes the
currently selected program's live actual-data display for every supported page
type:

- Frequency / maladaptive behaviors
- Challenging behaviors (Frequency and Partial Interval)
- Replacement / skill programs
- Client replacement / skill programs

The refresh preserves any target/count values the user has already typed.

No Office Puzzle writer, click sequence, pacing, batch execution, review gate,
or Stop logic changed.


---

# Planned Count Confirmation (v1.1.18)

Frequency/count workflows no longer show a persistent **Observed count** field.

For supported Frequency behaviors, the extension uses the generated value for
the selected date.

When **Apply now** is clicked, the user must explicitly confirm that the
displayed planned count should be used as the reviewed count before any write
is performed.

When **Add to batch** is clicked, the same confirmation is required before the
planned count is added to the reviewed batch.

If there is no generated planned count for the selected date, the action is
blocked and the user is asked to generate the weekly plan first.

If Office Puzzle already contains actual data for the selected date, the
extension does not silently treat that actual value as a plan. Use
**Clear selected column** first if the intention is to replace it with a newly
generated plan.

The Office Puzzle click/write sequence itself remains unchanged.


---

# Unified Program Dropdowns (v1.1.21)

All program/behavior dropdowns now use the same custom extension-themed menu.

The browser's native black select popup is no longer used as the visible
interface. The original select remains underneath as the authoritative control,
so existing program-selection behavior is preserved.

The custom dropdown provides:

- matching blue light/dark theme
- compact numbered rows
- consistent spacing and selected-state styling
- automatic upward opening when there is not enough room below
- shortened display labels for unusually long program names
- full original program names preserved internally and available as hover text

Examples of shortened display labels:


The full program heading and Office Puzzle mapping names are not changed.


---

# Simplified Plan Generation (v1.1.22)

The separate **Re-roll** button has been removed throughout the extension.

**Generate** now serves both purposes:

- first click: generate the plan
- click again: generate a new plan / re-roll

This keeps the workflow simpler and reduces duplicate controls.

The Chrome extension description was also rewritten for RBT users:

`Speed up Office Puzzle data entry with auto-mapped programs, weekly planning, quick review, and batch entry.`

No Office Puzzle writing logic was changed.


---

# Faster Scroll Discovery (v1.1.23)

Automatic program discovery now reacts directly to Office Puzzle scrolling and
lazy-loaded DOM updates.

When Office Puzzle appends additional behavior/replacement sections while the
user scrolls, the content script sends a lightweight discovery hint to the side
panel. The side panel performs a read-only refresh shortly after scrolling
settles, followed by one confirming pass.

This means newly loaded programs should appear in the behavior/replacement
dropdown much faster instead of waiting for the slower periodic audit.

The regular passive scan remains as a fallback.

No Office Puzzle data-entry writer/click sequence was changed.


---

# Discovery Performance Optimization (v1.1.24)

The visible Auto profile status bar was removed from the normal interface.

Program discovery was optimized around the real Office Puzzle workflow:
programs are usually loaded as the user scrolls and rarely appear randomly.

Performance changes:

- scrolling still triggers fast discovery
- relevant lazy-loaded DOM triggers fast discovery
- all Office Puzzle tables are structurally classified in one pass
- only the matching Frequency / Partial Interval / Replacement inspector runs
  for each table
- expensive full-page program-name extraction is cached until program structure
  actually changes
- irrelevant DOM additions no longer trigger discovery work
- the second fast confirmation scan only runs when the learned profile is still
  incomplete
- the idle fallback audit runs less frequently because event-driven discovery
  is now the primary path

The slower fallback remains in place in case Office Puzzle loads content in an
unexpected way.

No planning, review, batch, Office Puzzle writer, click sequence, pacing, or
Stop logic changed.


---

# Client Header (v1.1.25)

The current-client card now includes a blue **CLIENT** eyebrow above the
client name, matching the visual language used by the extension's other
section headers.

No discovery, planning, review, batch, or Office Puzzle writer logic changed.


---

# Program Header Polish (v1.1.26)

Visible table-detection badges were removed from behavior and replacement
program headers. Mapping state remains available internally to the extension.

The previous plain `1 of 12` style program counter was replaced across all
program sections with a consistent compact progress display:

- blue `PROGRAM` label
- padded current/total counter such as `01 / 12`
- visual progress track
- automatic updates when changing programs
- matching light and dark themes

No discovery engine, planning, review, batch, Office Puzzle writer, pacing, or
Stop behavior changed.


---

# Simplified Planning View (v1.1.27)

Redundant planning-summary boxes are no longer displayed throughout the
extension.

Hidden examples include:

- Actual recorded
- Remaining weekly amount
- Achievable weekly %
- Actual successes recorded
- Remaining planned successes
- duplicate selected-date / current-value summary boxes

These values remain available internally and continue to be updated because
the planning engine and actual-data refresh logic may use them.

The RBT-facing workflow keeps the more actionable information such as the
selected day's plan, planned pattern, review controls, Apply now, and batch
controls.

No discovery, planning calculations, review, batch, Office Puzzle writer,
pacing, or Stop logic changed.


---

# Refresh = Clear Inputs + Resync (v1.1.28)

The top-right refresh button now performs a clean form reset before the RBT
continues working.

After refreshing Office Puzzle context, it clears:

- Maladaptive weekly target
- Replacement / skill weekly target %
- Challenging behavior weekly target
- Profile B replacement / skill weekly target %
- current Hours input
- temporary reviewed +/- trial states
- temporary reviewed interval states
- review confirmations
- visible validation messages/highlights

It does **not** delete:

- data already written to Office Puzzle
- generated plans stored by the extension
- completed Office Puzzle columns
- batch items already added to Batch Review

If an Office Puzzle write or batch is actively running, the refresh reset is
blocked until that operation stops.

No Office Puzzle writer/click/pacing logic changed.


---

# Final Visual + Refresh Cleanup (v1.1.29)

Mapping/discovery diagnostics such as table-detected badges, mapped counts,
scan summaries, and status messages are now internal-only throughout the
extension.

Planned/review trial and interval grids were redesigned to use a consistent
blue visual language:

- softer font weights
- numbered compact chips
- stronger blue for `+`
- quieter blue/slate for `-`
- no green/red state colors
- matching dark-mode palette
- cleaner spacing and container treatment

The top-right refresh button is now a full extension-side reset for the current
client/date workflow. It clears:

- all weekly target inputs
- Hours planning input
- temporary review states/confirmations
- generated weekly plans for the current client/week
- planned trial/interval patterns
- all four batch types for the current client/date, including ready, stopped,
  failed, and completed batches
- resumable/completed batch-run state

Refresh still does **not** delete or alter data already recorded in Office
Puzzle.

No Office Puzzle writer/click/pacing logic changed.


---

# Table Detection Badge Removal (v1.1.30)

The `Table detected` / `Table not detected` badges were removed completely
from the extension UI and from the side-panel rendering code.

This is different from simply hiding the badge with CSS: there is no longer a
table-match element for the renderer to make visible again.

Internal mapping/discovery logic still works normally and still controls
whether actions are available.

No Office Puzzle writer/click/pacing logic changed.


---

# Blue Caution Actions (v1.1.31)

Clear-column and Stop controls now use the extension's blue palette instead of
red.

They remain visually distinct from primary actions by using a darker/navy
treatment, while matching the rest of the product in both light and dark mode.

No behavior or writer logic changed.


---

# Discovery Rollback Test Build (v1.1.33)

The v1.1.32 discovery throttling experiment was rolled back.

This build restores the v1.1.31 discovery behavior that was reliably learning
all programs while scrolling.

Use this version to re-test CPU and memory with the known-good discovery path.
No Office Puzzle writer logic was changed.


---

# Cross-Section Discovery Reset (v1.1.34)

Switching between Office Puzzle sections such as Replacements / Skills and
Behaviors now explicitly starts a fresh discovery cycle for the new page type.

The new page does not inherit scan throttles from the page that was previously
open.

A short second read-only discovery pass also runs after the new section settles,
so discovery does not depend on the user physically scrolling again if the
Office Puzzle scrollbar is already near the bottom.

The reliable v1.1.31 scroll/lazy-load scanner remains otherwise unchanged.

No Office Puzzle writer, planning, batch, review, or pacing logic changed.


---

# Live-Loaded Program UI (v1.1.35)

The extension still remembers the client's complete learned program profile
internally, but the working UI now only exposes programs whose Office Puzzle
tables are currently loaded in the page DOM.

Examples:

- if 5 behavior tables are currently loaded, the UI shows `01 / 05`
- the program dropdown contains only those 5 loaded programs
- as scrolling lazy-loads more tables, the counter/dropdown expands
- when all 12 are actually loaded, it becomes `01 / 12`

This rule applies to:

- Maladaptive Behaviors
- Replacement / Skills
- Challenging Behaviors
- Profile B Replacement / Skills

This prevents the assistant from presenting a program as actionable when its
Office Puzzle table is not currently available for live reads/writes.

The full learned profile is still retained internally for discovery stability.

No Office Puzzle writer, batch execution, review, planning algorithm, or pacing
logic changed.


---

# v1.1.38 Review Interval Fix

The Partial Interval **Review intervals** control now opens the same compact
review/confirmation flow used elsewhere in the extension.

No duplicate interval grid is required. The selected-day planned interval
pattern remains the visible pattern to review, while the review controls open
below it.

This build is based directly on v1.1.37 and retains its batch runner fixes.


---

# App Customization (v1.1.39)

A new **Customize** control (gear icon) is available in the top bar.

Customization is presentation-only. It never removes Office Puzzle mapping
elements, changes clinical writers, changes saved Office Puzzle data, or
modifies batch/write verification.

## Presets

- **Focus** — minimal working view
- **Balanced** — clean default view
- **Full** — shows every available panel

## Show / hide controls

You can independently show or hide:

- Client card
- Program progress
- Program title
- Program selector
- Weekly target / hours inputs
- Generate button
- Week overview
- Selected-day card
- Planned trial / interval pattern
- Clear selected column
- Batch Review
- Batch Control
- Bottom quick-action bar
- Helper/instruction text

The large planned `+ / -` pattern pane is **hidden by default** in Balanced
mode, per the requested cleaner interface. It can be restored instantly in
Customize.

## Layout controls

- Tight / Compact / Roomy spacing
- Standard / Deep / Soft blue palette
- Sticky header on/off
- Animations on/off

Preferences are stored locally in Chrome and survive reopening the extension.

Use **Reset defaults** at any time to return to the Balanced layout.


---

# v1.1.40 UI cleanup

Removed the visible challenging/partial-interval card that showed:

- Selected day planned percentage
- Saved day hours

The underlying IDs remain hidden internally so existing date, plan, review,
and rendering code continues to work unchanged.


---

# Per-item Batch Removal (v1.1.41)

Every item in **Batch Review** now has a trash/bin icon.

Clicking it removes only that reviewed item from the extension batch list.

- Office Puzzle data is never deleted by the trash button.
- Pending, completed, or stopped rows can be removed.
- Removal is disabled while a write or batch is actively running.
- Batch count, progress, Run Batch controls, and locally saved batch state
  update immediately through the existing batch-save path.


---

# v1.1.42 Selected-Day Card

The challenging/partial-interval workflow now shows:

- Selected day planned percentage

The old **Saved day hours** value remains hidden from the UI.

The saved-hours element IDs remain available internally so existing planning,
review, and date logic continues to work unchanged.


---

# v1.1.43 Simplified Batch Controls

The batch workflow now uses shorter CTAs:

- **Add** — adds the reviewed current item to Batch Review
- **Run** — runs all reviewed items in Batch Review
- **Stop** — stops an active write or batch
- **Prev / Next** — changes the selected program

The Batch Control card no longer shows a large `Run Batch` heading or visible
`Off` badge. It now focuses on the current status, progress bar, and Stop / Run
controls. Progress numbers still update internally but are hidden from the UI.

Tooltips and accessibility labels explain the short buttons without adding
visual clutter.

No writer, batch execution, review, planning, discovery, pacing, or
verification logic changed.


---

# v1.1.44 One-Step Trial / Interval Actions

The separate Review → Confirm → Apply workflow has been removed.

For Replacement / Skill trials and Partial Interval behaviors:

- **Apply now** opens one concise confirmation showing the exact planned +/- pattern.
- **Add** opens one concise confirmation showing the exact planned +/- pattern,
  then adds it to Batch Review.
- There is no separate Review trials / Review intervals button.
- There is no separate Cancel / Confirm review panel.

The confirmation dialog is now the single review point before a planned pattern
is used for documentation or added to a batch.

Frequency/count workflows keep their existing one-step confirmation behavior.

The actual Office Puzzle writer functions and pacing are unchanged.


---

# v1.1.45 Friendlier Task Language

The working queue now uses plain language:

- **Tasks**
- **No tasks added yet**
- **Add a task to get started**
- **Ready when you are**
- **Running 1 of 3...**
- **All tasks completed**
- **Clear all**

The words `Batch Review`, `Run Batch`, and `verified batch` were removed from
the main user-facing workflow. Internal function names and storage keys remain
unchanged for compatibility.


---

# v1.1.46 Simple Confirmations

Trial/interval outcome symbols are no longer shown anywhere in the visible app.

For **Apply now**, the confirmation only identifies:

- the program
- the selected date
- that the planned entry will be applied to Office Puzzle

For **Add**, the confirmation only identifies:

- the program
- the selected date
- that the planned entry will be added to Tasks
- that it will not run until **Run** is pressed

Both dialogs use **Cancel / Confirm**.

The internal trial/interval state is still preserved for the existing writer.
The visible planned-pattern panes and their Customize option were removed.


---

# v1.1.47 RBT UX Polish

This release removes several workflow dead ends.

## Existing entry flow

If **Generate** is pressed for a date that already has Office Puzzle data, the
assistant now asks:

**Existing entry found**

- **Keep current** — leave the Office Puzzle entry as-is and plan the remaining days.
- **Replace** — create a new plan for that date.

Planning a replacement does not modify Office Puzzle. The actual entry changes
only after **Apply** or **Run**.

The replacement plan is tied to the exact data that existed when it was
created. If the recorded entry changes before use, the replacement intent is
invalidated instead of silently overwriting newer data.

## Friendlier language

- `Selected day planned` → `Plan for selected day`
- `Daily average` → `Currently recorded`
- `Actual recorded` → `Recorded this week`
- `Remaining weekly amount` → `Still to plan`
- `Achievable weekly %` → `Weekly goal`

## More actions

`Clear selected column` is now **Clear current date** and is moved into a
collapsed **More actions** area at the bottom of each workflow.

The existing Office Puzzle clear writer is unchanged.

## Actionable errors

Dead-end messages now tell the RBT the next action: enter a target, scroll until
the program is loaded, Generate a plan, or choose Replace.


---

# v1.1.48 Performance / Startup Pass

This release changes performance infrastructure only. Clinical writer behavior,
batch execution, permissions, and pacing are intentionally unchanged.

## Instant side-panel startup

The assistant stores a small local UI snapshot containing only the last client
context and visible program names. On the next open it renders that structure
immediately with a **Refreshing** connection state, then replaces it with live
Office Puzzle data in the background.

Cached table IDs are never reused for writes. All write controls rely on the
fresh live mapping.

If there is no cached snapshot, a fixed-height loading skeleton is shown instead
of the wrong default workflow, preventing the old blank/default flash.

## Lower discovery CPU

- `GET_CONTEXT` is cached inside the content script while the relevant Office
  Puzzle DOM is unchanged.
- Date navigation is read once per context snapshot instead of repeatedly.
- Body text used by page/client/method detection is shared between readers.
- Discovery hints include a DOM revision number.
- Repeated scrolling over already-known content does not trigger repeated scans.
- Scroll fallback hints are sent only after meaningful new scroll depth.
- DOM mutation hints remain the primary fast path for lazy-loaded programs.
- The passive safety heartbeat was slowed from 3.5 seconds to 8 seconds.
- Completed pages use a 60-second audit window instead of 30 seconds.
- Page/context transitions reuse the already-read context instead of immediately
  requesting it a second time.


---

# v1.1.49 Replacement Task Fix

The existing-data action is now simply **Replace**.

Replacement / Skill and Partial Interval tasks now run as one resumable
operation:

1. clear the existing selected-date Office Puzzle entry
2. persist that the clear step completed
3. wait for Office Puzzle to settle
4. rediscover the program table and selected date
5. apply the new planned entry
6. verify the completed write

If a run is stopped or Office Puzzle rerenders after the clear step, the task
remembers that it was already cleared. Pressing Run again continues with the
planned write instead of trying to clear the blank column a second time.

The same clear → refresh → write flow is used by **Apply now** for replacement
and interval workflows.

Frequency/count replacements retain their existing dedicated replacement writer.


---

# v1.1.50 Design System, Accessibility & Onboarding

## Visual system

A new `styles/design-system.css` is loaded after the legacy stylesheet and owns
the final visible product layer. It defines shared tokens for:

- one blue brand accent
- neutral surfaces and text
- 4 / 8 px spacing scale
- typography sizes
- border radii
- shadows
- focus treatment
- 160–200 ms motion

Interactive motion is limited to transform / opacity and the whole extension
respects `prefers-reduced-motion`.

Muted text contrast was strengthened for WCAG AA readability.

## Theme behavior

On a browser where the user has never manually chosen a theme, RBT Assistant
now follows the operating-system `prefers-color-scheme` setting.

Once the moon/sun button is used, that explicit light/dark choice remains saved
in `chrome.storage.local`.

## Keyboard accessibility

Program dropdowns now support:

- Arrow Down / Arrow Up
- Home / End
- Enter / Space
- Escape
- Tab

Dialogs and the Customize drawer trap keyboard focus while open and return focus
to the control that opened them.

Every interactive control receives a consistent visible `:focus-visible` ring.

## First-run welcome

New users see one short welcome guide explaining:

1. choose a loaded program
2. Generate a plan
3. Apply now or add to Tasks and Run

The welcome screen is shown once and stores only a local seen flag. It can be
opened again from **Customize → Show welcome guide**.

## Performance-safe implementation

The clinical writers, batch engine, content script, discovery engine,
permissions, and Office Puzzle interaction code are unchanged.

The large UI logo was reduced from 1254 px to 256 px because it is rendered at
small interface sizes.


---

# v1.1.51 Fluid Date Selection

Clicking another day inside the current week now feels immediate.

The selected-day highlight moves right away while Office Puzzle verifies and
refreshes the date-specific data in the background. The five-day strip stays in
place instead of sliding out and back in.

The slide transition remains only for **Previous week / Next week**.

Successful day selection no longer produces a redundant toast.

Date cards also support **Enter** and **Space** from the keyboard and expose the
selected state with `aria-pressed`.


---

# v1.1.52 Production Finishing Pass

## Immediate action feedback

Generate, Apply, and Clear current date controls now show an immediate busy
label while their existing async workflow is running. The busy wrapper prevents
duplicate clicks without changing the underlying writer/planning functions.

## Cleaner Tasks empty state

An empty Tasks panel now uses a single message:

**No tasks yet — press Add when you're ready.**

The empty list placeholder is removed, and **Clear all** is hidden until at
least one task exists.

## Semantic status styling

Batch status feedback no longer injects one-off color values from JavaScript.
It sets a semantic tone (`normal`, `good`, `wait`, `bad`) that the design system
styles consistently in light and dark mode.

## Reduced motion

Automatic scrolling while Run follows the active task now switches to instant
scrolling when the operating system requests reduced motion.

## Production package

Historical release notes are removed from the shipped extension. The package
keeps only the current release note, install instructions, and user guide.


---

# v1.1.53 Replacement Plan Generation Fix

Fixed a mismatch where **Replace** could display a selected-day percentage but
fail to generate the internal trial plan needed by **Apply now**.

The cause was an older Replacement/Skills history path that read recorded daily
averages directly instead of going through the planning layer. That bypassed the
temporary existing-data suppression used while generating a replacement.

Both Replacement/Skills planners now use the same `actualDataForDate()` path as
the rest of the app, so a selected existing date is genuinely treated as open
for a replacement plan while Generate runs.

The selected-day UI is also defensive now: it will only display a replacement
as a new plan when a real planned allocation and internal trial pattern exist.


---

# v1.1.54 In-Dialog Apply Feedback

**Apply now** is now one continuous focused interaction.

The existing confirmation dialog transitions through:

1. **Confirm**
2. **Applying…** or **Replacing entry…**
3. **Applied successfully**
4. **Done**

The success message stays in the same dialog instead of appearing as a toast at
the bottom of the side panel.

Expected Apply failures also stay in the same dialog as **Couldn’t apply plan**,
so the RBT never has to hunt for feedback elsewhere on the screen.

This behavior is consistent across:

- Frequency behaviors
- Replacement / Skills
- Profile B Replacement / Skills
- Partial Interval
- Challenging Frequency

The dialog cannot be dismissed while an Office Puzzle write is actively in
progress. After success or error, **Done** closes it and keyboard focus returns
to the Apply control that started the action.

Task/Run status messaging remains unchanged.


---

# v1.1.55 12-Hour Partial Interval Support

The extension's Partial Interval session-hours setting now accepts:

**0.5 to 12 hours**, in 30-minute increments.

That corresponds to **1–24 active intervals**.

The full interval pipeline was updated together:

- hours input maximum
- hours validation
- weekly planning
- selected-day plan validation
- saved day-hours
- interval table discovery
- Partial Interval writer
- final-state buffers
- batch result state
- legacy client profile metadata

The writer now recognizes Interval rows through **Interval 24**.

## Office Puzzle table capacity

The extension maximum is 12 hours, but it will never invent interval rows that
are not present in the current Office Puzzle table.

For example, if a specific Office Puzzle table exposes only 12 interval rows,
the assistant will explain that the table currently supports **6 hours** and
will stop before sending any data clicks for a longer session.

If the table exposes all 24 rows, the full 12-hour plan can be generated and
written.

Office Puzzle's known native initialization behavior for Intervals 1–8 remains
unchanged. Intervals 9+ continue to use the existing blank-row writer logic.


---

# v1.1.56 Instant Add to Tasks

**Add** no longer opens a confirmation dialog.

Adding an item only places it in the extension's Tasks list; it does not write
to Office Puzzle. Because of that, the extra confirmation step was removed.

The workflow is now:

**Generate → Add → Run**

or:

**Generate → Apply now**

Replacement intent, planned states, hours, counts, and selected Office Puzzle
date are still stored with the queued task exactly as before.

**Run** remains the deliberate action that performs the actual Office Puzzle
writes.


---

# v1.1.57 Replacement Initialization / Duplicate Request Fix

A blank Replacement / Skills date requires one special Office Puzzle native
initialization click before individual trial correction begins.

That initializer now sends **one click event only**.

Previously the helper emitted a full pointer + mouse event sequence. That was
useful for broad browser compatibility, but Office Puzzle can route more than
one of those event types into its native save behavior and report a duplicate
request.

Only the native blank-day initializer was changed. The normal per-trial
correction writer and its existing save pacing remain unchanged.

Initialization verification is also stronger:

- visible Trial 1 `+` is accepted
- a stable visual change is accepted
- Office Puzzle Daily average = 10% is accepted as authoritative confirmation
  of the known native `+---------` initialization

If Office Puzzle visibly reports a duplicate-request error, the extension stops
without sending a retry or touching later trials and gives a simple recovery
message.

The same single-request initializer is used for:

- Profile A Replacement / Skills
- Profile B Replacement / Skills
- the first native Partial Interval blank-day initialization

## Tasks status fix

After Run stops or completes, the Tasks card is now re-rendered **after** the
Run lock is released. A stopped task can no longer leave the summary stuck on
`Running tasks…`.


---

# v1.1.58 Run Failure Recovery

A failed Tasks run is now recoverable instead of leaving the assistant stuck.

When a task fails:

- the task remains in **Tasks**
- its row is marked **Stopped**
- the status explains that Office Puzzle needs attention
- **Run** changes to **Retry**
- Add / Previous / Next become available again because the run lock is released

Pressing **Retry** immediately retries from the stopped task. Tasks that were
already completed are skipped.

For replacement tasks, Retry preserves the internal replacement stage. If the
old Office Puzzle entry was already cleared before the failure, Retry continues
with the planned write instead of clearing the date again.

An empty Tasks list can no longer remain in a `Running…` state.

**Clear all** is blocked while a Run/write is active, so queued Tasks cannot be
deleted underneath the active runner.

If the RBT chooses to Add the task again instead of Retry, adding it clears the
old stopped-run state automatically and makes the new task runnable.


---

# v1.1.59 Adaptive Cell Writer

The `+ / - / blank` writers no longer depend on a hard-coded Office Puzzle
initialization pattern.

## New write model

For Replacement / Skills and Partial Interval tables, the writer now uses:

**observe → decide → click once → observe again → decide**

For each target cell:

1. read the current cell state
2. compare it with the reviewed plan
3. if a change is needed, click the cell once
4. re-read that exact cell after Office Puzzle updates
5. use the observed result to decide the next action
6. never send a blind automatic second click when the result is uncertain

The observed result can be confirmed from:

- a directly readable `+` or `-`
- the cell's semantic DOM signature
- the cell's visual signature
- Office Puzzle's own Daily Average change
- a captured pre-initialization blank signature when the day started empty

## Blank-day initialization

A fully blank day still needs one Office Puzzle native initializer click.

The assistant now:

1. captures the blank selected-date column
2. sends one single-request initializer click
3. waits for Office Puzzle to settle
4. rescans the complete selected-date column
5. continues from what Office Puzzle actually rendered

No `+---------` or other assumed initializer pattern is inserted into the
writer's logical state.

## Partial Interval

Partial Interval uses the same adaptive cell logic through the configured
1–24 interval rows.

For short sessions where Office Puzzle initializes unused early intervals, the
assistant captures each row's original blank signature before initialization
and cycles unused rows until that exact blank state is observed again.

## Safety / pacing

The proven Office Puzzle save barriers remain unchanged:

- Profile A Replacement transition pacing remains 1400 ms
- Profile B Replacement transition pacing remains 1600 ms
- Partial Interval transition pacing remains 1700 ms
- native initialization settle periods remain in place

This release changes **how the next state is decided**, not the conservative
save timing.

Frequency/count writers are unchanged.


---

# v1.1.60 Strict Three-State Cell Reading + Apply Stop

Replacement / Skills now follows the confirmed Office Puzzle cell cycle:

**`+ → blank → - → +`**

The writer still does not assume how a blank date initializes. After the one
native initializer click, it rescans the actual selected-date column.

For each reviewed trial it now:

1. reads the exact current cell
2. refuses to click if the current state cannot be confidently identified
3. compares that observed state to the reviewed plan
4. if needed, clicks exactly once
5. watches that exact cell until its DOM/visual state stabilizes
6. confirms the observed result follows `+ → blank → - → +`
7. only then decides whether one more click is necessary

Because the reviewed plan contains only `+` and `-`, a known cell can reach its
reviewed state in at most **two correction clicks**. The writer will not exceed
that limit for one trial.

Daily Average is no longer used to infer the state of an individual cell. It is
kept only as the final whole-column verification.

Partial Interval also refuses to click from an unknown current state and
re-reads the exact interval after every click. Its cell cycle is not hard-coded;
it remains observation-driven until its Office Puzzle cycle is separately
confirmed.

## Stop during Apply

The in-dialog **Applying…** state now includes a visible **Stop** button.

Stop requests `ABORT_ACTIVE_WRITE` on the exact Office Puzzle tab. The current
click may finish, but no additional data clicks are sent. The same dialog then
shows a neutral **Stopped** result instead of a bottom toast or red failure.


---

# v1.1.61 Visual Cell Reader

Replacement / Skills can now recognize Office Puzzle cells whose visible `+`
or `-` is rendered through icon/CSS markup instead of clean DOM text.

The reader combines literal/accessibility markers, blank detection, normalized
cell visual/DOM fingerprints, and the selected date's Office Puzzle Daily
Average.

For a complete 10-trial column, Daily Average can safely label repeated visual
fingerprints. Example: a 10% day with one fingerprint appearing once and another
appearing nine times uniquely identifies positive and negative cell styles
without clicking.

Every click still requires the exact target cell to change and stabilize before
the next decision. Truly ambiguous cells still stop rather than guess.
