# Technical Product Requirements Document
## Figma PI Planning Plugin - Enterprise Enhancements

**Version:** 1.0  
**Date:** 2025-01-XX  
**Status:** Implementation Ready

---

## Executive Summary

This document outlines the technical requirements for enhancing the Figma PI Planning Plugin to meet enterprise-grade standards. The enhancements focus on improved usability, flexibility, and visual clarity for large-scale PI planning sessions.

---

## 1. Team Name in Backlog Title

### 1.1 Requirement
Display the team name in the backlog column title to improve visual clarity in multi-team layouts.

### 1.2 Current Behavior
- Backlog label displays as "Backlog" for all teams
- No team identification in backlog column

### 1.3 Target Behavior
- Backlog label displays as "{Team Name} Backlog" (e.g., "Triton Backlog", "GH Backlog")
- Maintains consistent formatting with sprint labels
- Special case: "Gadget Hackwrench" abbreviated to "GH" (matching sprint label behavior)

### 1.4 Technical Implementation
- **File:** `src/code.tsx`
- **Function:** `importCardsFromCSV` (around line 2052)
- **Change:** Modify backlog label creation to include team name
- **Format:** `{teamLabel} Backlog` where teamLabel follows sprint label abbreviation rules

### 1.5 Acceptance Criteria
- [ ] Backlog title shows team name for each team row
- [ ] "Gadget Hackwrench" abbreviates to "GH" in backlog title
- [ ] Formatting matches sprint label styling
- [ ] Works correctly for all teams in multi-team layout

---

## 2. Show Rolling Tickets Toggle

### 2.1 Requirement
Add a settings toggle to control sprint assignment behavior for tickets that appear in multiple sprints.

### 2.2 Current Behavior
- Tickets are assigned to the first sprint column found in CSV
- No user control over sprint assignment logic

### 2.3 Target Behavior
- **Toggle Name:** "Show Rolling Tickets"
- **Default State:** Unchecked (false)
- **When Unchecked:** Assign ticket to the latest sprint it appears in
- **When Checked:** Assign ticket to the first sprint it appeared in (current behavior)

### 2.4 Technical Implementation
- **Files:**
  - `ui.html`: Add checkbox in settings section
  - `src/types.ts`: Add message types for toggle
  - `src/code.tsx`: Modify `getSprintValue` function to handle multiple sprint columns
- **Logic Changes:**
  - When unchecked: Collect all sprint values, return the last one (latest sprint)
  - When checked: Return first sprint found (current behavior)
  - Handle multiple "Sprint" columns dynamically

### 2.5 Acceptance Criteria
- [ ] Toggle appears in settings panel
- [ ] Toggle defaults to unchecked
- [ ] When unchecked, tickets with multiple sprints use latest sprint
- [ ] When checked, tickets with multiple sprints use first sprint
- [ ] Setting persists across plugin sessions
- [ ] Works correctly with dynamic CSV column structures

---

## 3. New Ticket Types with Custom Icons

### 3.1 Requirement
Add support for three new ticket types with custom icons: Security, Internal, and Sub Test Execution.

### 3.2 Current Behavior
- Limited ticket types: Theme, Epic, User Story, Task, Spike, Test, Bug
- Icons are shape-based or text-based (X for bugs)

### 3.3 Target Behavior

#### 3.3.1 Security Tickets
- **Issue Type:** "Security"
- **Template Base:** Task template
- **Icon:** Padlock (🔒 or text-based "🔒")
- **Color:** Task template color (green)

#### 3.3.2 Internal Tickets
- **Issue Type:** "Internal"
- **Template Base:** Task template
- **Icon:** Heart (❤️ or text-based "❤")
- **Color:** Task template color (green)

#### 3.3.3 Sub Test Execution Tickets
- **Issue Type:** "Sub Test Execution"
- **Template Base:** Test template
- **Icon:** ">>" (text-based, similar to bug "X")
- **Color:** Test template color (blue)

### 3.4 Technical Implementation
- **Files:**
  - `src/code.tsx`: Update `mapJiraIssueToTemplate` function
  - `src/card-creation.ts`: Update `createIconShape` function
  - `src/templates.ts`: No changes needed (reuse existing templates)
- **Icon Implementation:**
  - Security: Text node with padlock emoji or Unicode character
  - Internal: Text node with heart emoji or Unicode character
  - Sub Test Execution: Text node with ">>" characters

### 3.5 Acceptance Criteria
- [ ] Security tickets use task template with padlock icon
- [ ] Internal tickets use task template with heart icon
- [ ] Sub Test Execution tickets use test template with ">>" icon
- [ ] Icons display correctly in card creation
- [ ] Issue type mapping works correctly during import
- [ ] Export preserves issue types correctly

---

## 4. Team Display Ordering

### 4.1 Requirement
Sort teams by plan robustness (most sprints, then most tickets) to prioritize teams with more comprehensive planning.

### 4.2 Current Behavior
- Teams sorted alphabetically
- No consideration of planning completeness

### 4.3 Target Behavior
- **Primary Sort:** Number of populated sprints (descending)
- **Secondary Sort:** Number of tickets assigned to sprints (descending)
- **Tertiary Sort:** Alphabetical (for complete ties)

### 4.4 Technical Implementation
- **File:** `src/code.tsx`
- **Function:** `preprocessMultiTeamData` (around line 889)
- **Change:** Replace alphabetical sort with robustness-based sort
- **Calculation:**
  - For each team, count unique sprint keys with tickets
  - For each team, count total tickets in sprints (excluding backlog)
  - Sort by sprint count (desc), then ticket count (desc), then name (asc)

### 4.5 Acceptance Criteria
- [ ] Teams sorted by sprint count (most first)
- [ ] Ties broken by ticket count (most first)
- [ ] Final ties broken alphabetically
- [ ] Backlog tickets excluded from ticket count
- [ ] Empty sprints excluded from sprint count

---

## 5. Dynamic Team Assignment Logic

### 5.1 Requirement
Ensure team assignment logic adjusts dynamically based on team and sprint positions after sorting.

### 5.2 Current Behavior
- Team boundaries detected by position
- Sprint boundaries detected by position
- Assignment happens during import, not dynamically

### 5.3 Target Behavior
- Team assignment uses position-based detection
- Sprint assignment uses position-based detection
- Both adjust when teams are reordered
- Works correctly with new sorting logic

### 5.4 Technical Implementation
- **Files:**
  - `src/utils.ts`: `assignTeamByPosition`, `assignSprintByPosition` (already implemented)
  - `src/code.tsx`: Ensure these functions are used during import
- **Note:** The position-based assignment is already implemented. This requirement ensures it works correctly with the new sorting.

### 5.5 Acceptance Criteria
- [ ] Team assignment uses position detection
- [ ] Sprint assignment uses position detection
- [ ] Works correctly with sorted teams
- [ ] Handles edge cases (overlapping boundaries, etc.)

---

## 6. Import Verbose Default Setting

### 6.1 Requirement
Set "Import Verbose" setting to be unchecked (false) by default.

### 6.2 Current Behavior
- Default varies: `false` in some places, `true` in others
- Inconsistent user experience

### 6.3 Target Behavior
- Default value: `false` (unchecked)
- Consistent across all code paths
- User can still enable if needed

### 6.4 Technical Implementation
- **Files:**
  - `src/code.tsx`: Update all default parameter values
  - `ui.html`: Ensure checkbox defaults to unchecked
  - `src/types.ts`: Verify message handling

### 6.5 Acceptance Criteria
- [ ] Import Verbose defaults to unchecked
- [ ] Setting persists when changed
- [ ] Consistent across all import functions
- [ ] UI reflects default state on load

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Update Import Verbose default
2. Add team name to backlog title
3. Update team sorting logic

### Phase 2: Settings & Sprint Logic (Week 2)
4. Add "Show Rolling Tickets" toggle
5. Implement multiple sprint column handling
6. Update sprint assignment logic

### Phase 3: New Ticket Types (Week 3)
7. Add Security ticket type
8. Add Internal ticket type
9. Add Sub Test Execution ticket type
10. Update icon creation logic

### Phase 4: Testing & Refinement (Week 4)
11. Integration testing
12. Edge case handling
13. Documentation updates

---

## Technical Considerations

### Dynamic Column Handling
- CSV columns are dynamic based on export configuration
- Must handle multiple "Sprint" columns gracefully
- Must handle missing columns without errors

### Performance
- Sorting should be efficient (O(n log n) at worst)
- Icon creation should not significantly impact import time
- Position-based assignment should be fast

### Backward Compatibility
- Existing cards should continue to work
- Export format should remain compatible
- Settings should migrate gracefully

### Error Handling
- Graceful degradation if team name unavailable
- Fallback to "Backlog" if team name missing
- Error messages for invalid configurations

---

## Testing Strategy

### Unit Tests
- Sprint assignment logic (first vs. last)
- Team sorting algorithm
- Icon creation for new types
- Team name extraction

### Integration Tests
- Full import with all new features
- Multi-team layout with sorting
- Settings persistence
- Export compatibility

### User Acceptance Tests
- Visual verification of backlog titles
- Toggle behavior verification
- New ticket type display
- Team ordering verification

---

## Success Metrics

1. **Usability:** Reduced confusion in multi-team layouts
2. **Flexibility:** Support for more ticket types
3. **Clarity:** Better visual organization with sorted teams
4. **Performance:** No significant import time increase
5. **Reliability:** All features work with dynamic CSV structures

---

## Appendix: Code Locations

### Key Functions
- `getSprintValue`: `src/code.tsx` line ~467
- `preprocessMultiTeamData`: `src/code.tsx` line ~705
- `importCardsFromCSV`: `src/code.tsx` line ~1693
- `createIconShape`: `src/card-creation.ts` line ~27
- `mapJiraIssueToTemplate`: `src/code.tsx` line ~244
- `assignTeamByPosition`: `src/utils.ts` line ~603
- `assignSprintByPosition`: `src/utils.ts` line ~638

### Key Files
- `src/code.tsx`: Main import logic
- `src/card-creation.ts`: Card and icon creation
- `src/types.ts`: Type definitions and message types
- `src/utils.ts`: Utility functions
- `ui.html`: UI and settings
- `src/templates.ts`: Template definitions

