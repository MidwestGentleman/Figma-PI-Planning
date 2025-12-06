# PI Planning Templates - Deployment Checklist

Use this checklist to ensure you're ready to publish your plugin to the Figma Community.

## Pre-Deployment

### Account Setup
- [ ] Two-Factor Authentication (2FA) enabled on Figma account
- [ ] Figma Desktop app installed and updated
- [ ] Logged into Figma account in Desktop app

### Code Preparation
- [ ] All code changes committed to version control
- [ ] `npm install` completed successfully
- [ ] `npm run build` completed without errors
- [ ] `code.js` file exists and is up-to-date
- [ ] `manifest.json` is valid JSON
- [ ] Plugin tested locally in FigJam
- [ ] All features working correctly:
  - [ ] Template insertion (all 8 types)
  - [ ] CSV import
  - [ ] CSV export
  - [ ] Duplication detection
  - [ ] Sprint organization
  - [ ] Epic grouping
  - [ ] Jira URL configuration
- [ ] No console errors in browser DevTools
- [ ] No TypeScript compilation errors

### Documentation
- [ ] README.md is up-to-date and accurate
- [ ] Plugin description written (for publishing form)
- [ ] Tagline created (concise, ~60 characters)
- [ ] Support contact information ready (email or URL)

### Assets Preparation
- [ ] **Plugin Icon** (128x128px PNG/SVG)
  - [ ] Created and saved
  - [ ] Clear and recognizable
  - [ ] No text in icon
  - [ ] Professional appearance
  
- [ ] **Thumbnail/Cover Image** (1920x1080px PNG/JPG)
  - [ ] Created and saved
  - [ ] Shows plugin in action
  - [ ] High quality
  - [ ] Highlights key features
  
- [ ] **Additional Screenshots** (Optional, up to 9)
  - [ ] CSV import screenshot
  - [ ] Template types showcase
  - [ ] Sprint organization view
  - [ ] Epic grouping view
  - [ ] Other feature highlights
  
- [ ] **Playground File** (Optional)
  - [ ] Sample FigJam file created
  - [ ] Demonstrates plugin features
  - [ ] Ready to upload

## Publishing Process

### Step 1: Access Publishing
- [ ] Opened Figma Desktop app
- [ ] Opened any file (or blank file)
- [ ] Navigated to `Plugins > Manage Plugins`
- [ ] Found plugin under "Development" section
- [ ] Clicked ellipsis (`...`) > "Publish"

### Step 2: Basic Information
- [ ] **Name**: Entered "PI Planning Templates"
- [ ] **Tagline**: Entered concise description
- [ ] **Description**: Entered detailed description with features
- [ ] **Category**: Selected appropriate category (e.g., "Software development")

### Step 3: Visual Assets
- [ ] **Icon**: Uploaded 128x128 icon
- [ ] **Thumbnail**: Uploaded 1920x1080 thumbnail
- [ ] **Additional Media**: Uploaded screenshots/videos (if any)
- [ ] **Playground File**: Uploaded sample file (if any)
- [ ] Previewed all assets to ensure they look good

### Step 4: Data Security
- [ ] Filled out data security disclosure form
- [ ] Indicated no data collection (if applicable)
- [ ] Specified local-only storage (if applicable)
- [ ] Confirmed no network access (matches manifest)
- [ ] Confirmed no third-party services

### Step 5: Publishing Settings
- [ ] **Publishing Destination**: Selected "Figma Community"
- [ ] **Publisher**: Selected personal profile/team/organization
- [ ] **Support Contact**: Entered email or URL
- [ ] **Network Access**: Reviewed and confirmed settings
- [ ] **Contributors**: Added (if any)
- [ ] **Community Comments**: Enabled/disabled as preferred

### Step 6: Pricing (Optional)
- [ ] Decided on free or paid
- [ ] If paid: Set pricing structure
- [ ] If paid: Verified creator approval status

### Step 7: Submit
- [ ] Reviewed all information
- [ ] Verified all required fields completed
- [ ] Checked for typos or errors
- [ ] Clicked "Publish" to submit for review

## Post-Submission

### While Waiting for Review
- [ ] Noted submission date
- [ ] Expected review time: 5-10 business days
- [ ] Prepared to respond to any feedback

### After Approval
- [ ] Received approval email
- [ ] Verified plugin is live in Figma Community
- [ ] Copied plugin URL for sharing
- [ ] Shared plugin URL with team/community
- [ ] Monitored initial user feedback
- [ ] Responded to any user questions

### After Rejection (if applicable)
- [ ] Reviewed rejection feedback
- [ ] Identified issues to address
- [ ] Made necessary improvements
- [ ] Resubmitted for review

## Ongoing Maintenance

### Regular Updates
- [ ] Set up process for tracking bugs
- [ ] Set up process for feature requests
- [ ] Plan regular update schedule
- [ ] Document update process

### User Support
- [ ] Monitor plugin comments
- [ ] Respond to user questions
- [ ] Address bug reports
- [ ] Consider feature requests

### Analytics
- [ ] Check plugin usage statistics
- [ ] Monitor install count
- [ ] Track user feedback trends

---

## Quick Reference

### Required Files
- `manifest.json` ✓
- `code.js` (built) ✓
- `ui.html` ✓

### Required Assets
- Icon: 128x128px
- Thumbnail: 1920x1080px

### Required Information
- Plugin name
- Tagline
- Description
- Category
- Support contact

### Publishing Location
- Figma Desktop App
- `Plugins > Manage Plugins`
- Development section → Publish

---

**Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete

**Last Updated**: [Date]

