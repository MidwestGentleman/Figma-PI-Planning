# Business Rules & Logic Report
## PI Planning FigJam Plugin

This document outlines the business rules, logic, and nuances of the PI Planning FigJam Plugin. It's designed to help developers understand the "why" behind the code, not just the "how."

---

## Table of Contents

1. [Core Business Purpose](#core-business-purpose)
2. [Data Model & Structure](#data-model--structure)
3. [Team Identification Rules](#team-identification-rules)
4. [Sprint Parsing & Organization](#sprint-parsing--organization)
5. [Epic & Ticket Organization](#epic--ticket-organization)
6. [Layout & Positioning Rules](#layout--positioning-rules)
7. [Import/Export Business Logic](#importexport-business-logic)
8. [Duplicate Detection & Handling](#duplicate-detection--handling)
9. [Validation Rules](#validation-rules)
10. [Special Cases & Edge Cases](#special-cases--edge-cases)
11. [Configuration Constants](#configuration-constants)

---

## Core Business Purpose

The plugin enables **Program Increment (PI) Planning** by:
- Importing Jira issues from CSV exports
- Organizing work items into a visual swimlane layout (teams × sprints)
- Creating visual cards for different work item types (Epics, User Stories, Tasks, etc.)
- Supporting round-trip export back to Jira CSV format
- Maintaining relationships between epics and their child tickets

**Key Business Value:**
- Visual planning board for multi-team sprint planning
- Preserves Jira metadata (issue keys, sprint assignments, epic links)
- Enables collaborative planning in FigJam
- Supports future sprint planning (configurable number of future sprints)

---

## Data Model & Structure

### Card Types (Templates)

The plugin supports 8 card types, each with specific fields:

1. **Theme** - Highest level strategic objective
2. **Initiative** - Large body of work
3. **Milestone** - Time-based marker
4. **Epic** - Large feature or capability
5. **User Story** - User-facing feature (has special "As a/I want/So that" fields)
6. **Task** - Work item
7. **Spike** - Research/exploration work
8. **Test** - Test case (has special "Given/When/Then" fields)

### Card Data Storage

Cards store metadata in Figma's `pluginData`:
- `issueKey` - Jira issue key (e.g., "PROJ-123")
- `sprint` - Sprint assignment
- `epicLink` - Epic this ticket belongs to
- `team` - Team assignment
- `templateType` - Internal template identifier
- `fullDescription` - Full description (display may be truncated)
- `isEpicLabel` - Boolean flag for epic label cards
- `isCopy` - Boolean flag for duplicated cards

### CSV Column Mapping

The plugin maps internal field labels to Jira CSV column names:
- `Summary` → Card title
- `Issue Type` → Template type (Theme, Epic, User Story, etc.)
- `Custom field (Epic Link)` → Epic relationship
- `Custom field (Studio)` → Team name
- `Custom field (Team)` → Alternative team field
- `Sprint` → Sprint assignment
- `Custom field (Story Points)` → Story points value
- `Custom field (Priority Rank)` → Priority ranking

**Important:** Multiple internal fields can map to the same CSV column. The plugin coalesces duplicate column values (uses first non-empty value).

---

## Team Identification Rules

### Priority Order (Highest to Lowest)

1. **`Custom field (Studio)`** - Primary team field, typically contains written team name (e.g., "Triton", "Gadget Hackwrench")
2. **`Custom field (Team)`** - Secondary team field, but only if it's NOT a numeric ID
3. **Sprint name parsing** - Extracts team from sprint name format: `"{Team Name} {Year}-{Sprint Number}"`
4. **Fallback:** `"Unknown"` if no team can be identified

### Team Validation Rules

- **Numeric IDs are rejected:** If `Custom field (Team)` contains only digits (e.g., "1039", "1040"), it's treated as an ID, not a team name
- **Sprint name team extraction:** Only used if the team part is NOT numeric
- **Special case:** "Gadget Hackwrench" team is abbreviated to "GH" in sprint labels

### Business Rationale

Teams may be identified in multiple ways across different Jira instances:
- Some use `Custom field (Studio)` for team names
- Some use `Custom field (Team)` for team names (but may also contain numeric IDs)
- Some embed team names in sprint names
- The priority order ensures we get the most reliable team name first

---

## Sprint Parsing & Organization

### Sprint Name Format

Expected format: `"{Team Name} {Year}-{Sprint Number}"`

Examples:
- `"Triton 2025-25"` → Team: "Triton", Year: 2025, Sprint: 25
- `"GH 2025-1"` → Team: "GH", Year: 2025, Sprint: 1

### Sprint Key Generation

Sprints are grouped by **sprint key**: `"{Year}-{Sprint Number}"`

This allows multiple teams to have concurrent sprints (e.g., "Triton 2025-25" and "GH 2025-25" are both sprint key "2025-25").

### Sprint Value Extraction Priority

1. Exact `"Sprint"` column match (case-insensitive)
2. Columns containing "sprint" (excluding "Custom field" columns)
3. Excludes empty values, `"[]"`, and Smart Checklist values (`"Checklist(...)"`)
4. **Fallback:** `"Backlog"` if no valid sprint found

### Future Sprints

The plugin automatically adds future sprints for PI planning:
- **Default:** 6 future sprints
- **Configurable:** Via import parameters
- **Sprint numbering:** Handles year rollover (sprints max at 25, then roll to next year)
- **Column allocation:** Future sprints use configured column count (default: 6 columns)

### Sprint Date Calculation

1. **Primary:** Extract from issue `"Start Date"` and `"End Date"` fields
2. **Fallback:** Calculate from sprint key using first Wednesday of year + sprint offset
3. **Display format:** `"MM/DD/YYYY - MM/DD/YYYY"`

---

## Epic & Ticket Organization

### Epic Placement Rules

1. **Epic appears in first sprint** where it has linked tickets
2. **Epic card is created** in the first sprint column with tickets
3. **Subsequent sprints** show simplified epic label (not full card)
4. **Epics in backlog** are excluded if they have a designated sprint

### Epic-to-Ticket Relationship

- Tickets link to epics via `Custom field (Epic Link)`, `Epic Link`, or `Epic` columns
- Epic key is extracted from issue key for epic issues
- Tickets without epic link are grouped under `"No Epic"`

### Column Rollover Logic

When an epic has more tickets than `MAX_CARDS_PER_COLUMN` (default: 5):
- Epic card counts toward the limit
- Calculation: `ceil((1 epic card + ticket count) / MAX_CARDS_PER_COLUMN)`
- Cards roll over to new columns, maintaining epic grouping
- Epic label/card width expands to span all columns

### Ticket Sorting Within Epic

Tickets are sorted by:
1. **Story Points** (descending) - Higher points first
2. **Issue Key** (ascending) - Alphabetical tiebreaker

---

## Layout & Positioning Rules

### Multi-Team Swimlane Layout

**Structure:**
- **Rows:** Teams (horizontal swimlanes)
- **Columns:** Sprints + Backlog (vertical columns)
- **Team spacing:** 50px between teams
- **Sprint spacing:** 100px between sprint columns

### Column Width Calculation

**Sprint columns:**
- Width = `(max epics per sprint × column width) - spacing`
- Column width = `card width (500px) + card spacing (50px)`
- Each epic can span multiple columns if it has many tickets

**Backlog column:**
- Minimum: 6 columns
- Actual: `max(6, calculated columns needed)`
- Calculated based on epic ticket counts (same logic as sprint columns)

### Vertical Positioning

**Sprint labels:**
- Fixed Y position at top: `viewport.y + SPRINT_LABEL_Y_OFFSET (-80px)`
- Each team gets its own sprint labels (even if empty)

**Card start position:**
- After sprint label + dates + line + spacing
- Formula: `label.y + label.height + 5px + dates.height + lineSpacing + afterLineSpacing`

**Team Y offset:**
- First team: `fixedSprintLabelY + sprintHeaderHeight`
- Subsequent teams: `previousTeamBottom + teamSpacing + capacityTableSpacing`

### Capacity Table

- **Position:** Below cards in each sprint column
- **Content:** Assignee capacity (story points per assignee)
- **Height:** Variable based on number of assignees
- **Spacing:** Added after table to prevent overlap with next team's cards

### Vertical Separator Boxes

- **Purpose:** Visual separation between backlog and sprints, and between sprint columns
- **Position:** Midpoints between columns
- **Height:** Spans from first team's card start to last team's bottom
- **Created:** After all teams are processed (to know final height)

---

## Import/Export Business Logic

### CSV Import Process

1. **Validation:**
   - CSV size limit: 10MB
   - Structure validation (headers, rows)
   - XSS prevention (script tags, javascript protocol, event handlers)
   - Character encoding handling

2. **Parsing:**
   - Handles quoted fields with escaped quotes
   - Handles multiline fields (quoted content can span lines)
   - Coalesces duplicate column names (uses first non-empty value)

3. **Preprocessing:**
   - Groups issues by team and sprint
   - Separates epic issues from tickets
   - Calculates column widths per sprint
   - Builds epic-to-first-sprint mapping

4. **Card Creation:**
   - Batched processing (10 cards per batch) to prevent UI blocking
   - Font loading with retry logic (3 attempts, exponential backoff)
   - Hyperlink creation for Jira issue keys (if Jira URL provided)

### CSV Export Process

1. **Card Discovery:**
   - Finds frames by name (template card names)
   - Falls back to `pluginData.templateType`
   - Falls back to `pluginData.issueKey` (imported cards)
   - Last resort: Frame structure check (width ~500px, rounded corners, text nodes)

2. **Data Extraction:**
   - Extracts title (removes issue key suffix if present: `"Title | ISSUE-KEY"`)
   - Extracts fields from text nodes (sorted by Y position)
   - Handles large number fields (Story Points, Priority Rank) from bottom right
   - Handles assignee field from bottom left

3. **Field Concatenation:**
   - **User Stories:** Concatenates "As a", "I want", "So that" into single "Description" field
   - **Tests:** Concatenates "Given", "When", "Then" into single "Description" field
   - Removes individual fields after concatenation

4. **Default Value Cleaning:**
   - Removes template default values (e.g., `"[user type]"`, `"?"`, `"#"`)
   - Treats `"?"` and `"#"` as defaults for Story Points and Priority Rank
   - Checks for concatenated default descriptions

5. **CSV Column Mapping:**
   - Maps internal fields to Jira CSV columns
   - Handles multiple fields mapping to same column (uses first found)
   - Preserves round-trip columns: Issue key, Sprint, Epic Link, Team

6. **Column Ordering:**
   - Priority: Summary, Issue key, Issue Type
   - Then: Sprint, Epic Link, Team/Studio
   - Then: Description, Status, Priority, Assignee, Story Points, etc.
   - Remaining columns: Alphabetical

### Round-Trip Preservation

The plugin preserves these fields for round-trip export to Jira:
- `Issue key` - Enables updating existing Jira issues
- `Sprint` - Preserves sprint assignments
- `Custom field (Epic Link)` - Preserves epic relationships
- `Custom field (Studio)` - Preserves team assignments
- `fullDescription` - Full description stored in plugin data (display may be truncated)

---

## Duplicate Detection & Handling

### Detection Triggers

1. **Plugin load** - Checks all cards on page
2. **Selection change** - Detects when cards are duplicated
3. **Periodic check** - Every 1.5 seconds (catches copy/paste)

### Duplicate Identification

- **Primary:** Issue key matching (if multiple cards have same issue key)
- **Secondary:** Cards marked as `isCopy === 'true'` with hyperlinks

### Duplicate Processing Rules

1. **Original determination:**
   - Non-copy cards prioritized over copy cards
   - Earliest created card (by position: `x + y * 10000`) is original
   - First card in sorted list is kept as original

2. **Duplicate handling:**
   - Remove issue key from duplicate (so it's treated as new card on export)
   - Mark duplicate as `isCopy === 'true'`
   - Remove hyperlink from duplicate title (recreates text node without hyperlink)
   - Track processed cards to avoid duplicate notifications

3. **Epic label exclusion:**
   - Epic label cards are excluded from duplicate detection
   - They're visual markers, not work items

### Business Rationale

- Duplicated cards should be treated as new work items (not updates to existing Jira issues)
- Removing issue keys ensures exports create new Jira issues
- Removing hyperlinks prevents confusion (duplicate shouldn't link to original issue)

---

## Validation Rules

### CSV Validation

1. **Size:** Maximum 10MB
2. **Structure:**
   - Must have headers
   - Must have at least one data row
   - Headers must not be empty

3. **Security:**
   - XSS prevention (script tags, javascript protocol, event handlers, iframe tags)
   - Field length limits (10,000 characters per field)

4. **Encoding:**
   - UTF-8 handling (no strict encoding validation - parser handles encoding issues)

### Jira URL Validation

1. **Format:** Must be valid HTTPS URL
2. **Normalization:**
   - Auto-prepends `https://` if protocol missing
   - Removes trailing slash
   - Validates URL structure

3. **Error handling:**
   - Invalid URL shows warning but doesn't fail import
   - Import continues without hyperlinks

### Coordinate Validation

- **Range:** -1,000,000 to 1,000,000
- **Type:** Must be finite number (not NaN, not Infinity)
- **Purpose:** Prevents invalid positioning that could break layout

### Template Type Validation

- Must exist in `TEMPLATES` object
- Valid types: `theme`, `milestone`, `userStory`, `epic`, `initiative`, `task`, `spike`, `test`

---

## Special Cases & Edge Cases

### Epic Label Cards

- **Purpose:** Visual markers for epics in subsequent sprints (after epic card created in first sprint)
- **Characteristics:**
  - Marked with `isEpicLabel === 'true'`
  - Excluded from export
  - Excluded from duplicate detection
  - Simplified display (title, status, priority rank, issue key)

### Empty Sprints

- All sprints are processed, even if team has no tickets
- Sprint labels and dates are still created
- Capacity table is only shown if there are tickets

### Backlog Handling

- Issues without valid sprint assignment go to backlog
- Epics with designated sprints are excluded from backlog
- Backlog column appears before sprint columns
- Backlog has its own label and line (aligned with sprint labels)

### Issue Key Suffix Removal

- Titles may have format: `"Title | ISSUE-KEY"`
- Suffix is removed during export (for cleaner titles)
- Issue key is preserved in plugin data

### Field Value Coalescing

- If CSV has duplicate column names, values are coalesced
- First non-empty value is used
- Empty values don't overwrite existing values

### Team Name Special Cases

- **"Gadget Hackwrench"** → Abbreviated to "GH" in sprint labels
- **Numeric team IDs** (e.g., "1039") → Rejected, not treated as team names
- **"Unknown" team** → Used when no team can be identified, but excluded from valid teams list

### Font Loading Failures

- Retry logic: 3 attempts with exponential backoff
- Delay: 500ms initial, doubles each retry
- If all retries fail, import is aborted (fonts are required)

### Large Imports

- Batched processing: 10 cards per batch
- Yields to UI between batches to prevent blocking
- Progress notifications for large imports

---

## Configuration Constants

### Card Configuration
- **Width:** 500px
- **Padding:** 20px
- **Max cards per column:** 5 (configurable via import)
- **Title wrap length:** 40 characters

### Layout Configuration
- **Card spacing:** 50px
- **Sprint spacing:** 100px
- **Team spacing:** 50px
- **Sprint label font size:** 48px
- **Sprint dates font size:** 20px

### Import Configuration
- **Batch size:** 10 cards
- **Default future sprints:** 6
- **Default future sprint columns:** 6

### Timing Configuration
- **Duplicate check delay:** 300ms (after selection change)
- **Duplicate check interval:** 1500ms (periodic check)

### Validation Configuration
- **Max CSV size:** 10MB
- **Max field length:** 10,000 characters
- **Coordinate range:** -1,000,000 to 1,000,000

---

## Key Business Decisions & Rationale

### Why Multi-Column Epic Layout?

Epics can span multiple columns when they have many tickets. This prevents:
- Extremely long vertical columns
- Cards becoming too small
- Poor visual organization

**Trade-off:** More horizontal space, but better readability.

### Why Epic Labels in Subsequent Sprints?

Full epic cards are only shown in the first sprint where they appear. Subsequent sprints show simplified labels because:
- Reduces visual clutter
- Epics are strategic, tickets are tactical
- Full epic details aren't needed in every sprint column

### Why Remove Issue Keys from Duplicates?

Duplicated cards should be treated as new work items, not updates to existing Jira issues. This ensures:
- Export creates new Jira issues (not updates)
- No accidental overwrites of original issues
- Clear distinction between original and duplicate

### Why Coalesce Duplicate CSV Columns?

Some Jira exports may have duplicate column names (e.g., multiple "Sprint" columns). Coalescing ensures:
- All data is captured (not lost)
- First non-empty value is used (most reliable)
- Import doesn't fail on duplicate columns

### Why Special Handling for User Stories and Tests?

These card types have structured fields that Jira expects as a single "Description" field:
- **User Stories:** "As a [user], I want [feature], so that [benefit]"
- **Tests:** "Given [context], When [event], Then [outcome]"

Concatenation ensures round-trip compatibility with Jira.

---

## Developer Notes

### Critical Code Paths

1. **`preprocessMultiTeamData()`** - Core data organization logic
2. **`processTeamSprintTickets()`** - Epic/ticket layout logic
3. **`importCardsFromCSV()`** - Main import orchestration
4. **`exportCardsToCSV()`** - Main export orchestration
5. **`handleCardDuplication()`** - Duplicate detection and processing

### Common Pitfalls

1. **Team identification:** Don't assume numeric team IDs are valid team names
2. **Sprint parsing:** Sprint names must match exact format for parsing to work
3. **Epic placement:** Epic appears in FIRST sprint with tickets, not necessarily first sprint overall
4. **Column rollover:** Epic card counts toward `MAX_CARDS_PER_COLUMN` limit
5. **Hyperlink timing:** Hyperlinks must be set AFTER all text operations (resize, wrapping)

### Testing Considerations

- Test with various team identification scenarios (Studio field, Team field, sprint name)
- Test with epics spanning multiple columns
- Test duplicate detection with various duplication methods (copy, paste, duplicate command)
- Test large imports (100+ issues) for performance
- Test edge cases: empty sprints, backlog-only issues, epics without tickets

---

## Conclusion

This plugin implements a complex business domain (PI Planning) with many nuanced rules. Understanding these business rules is essential for:
- Debugging issues
- Adding new features
- Maintaining code quality
- Ensuring data integrity

When in doubt, refer to this document or the inline comments in the code that explain the "why" behind the implementation.

