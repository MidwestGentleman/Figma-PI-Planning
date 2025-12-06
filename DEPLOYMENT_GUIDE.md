# PI Planning Templates - Deployment Guide

This guide provides step-by-step instructions for deploying the PI Planning Templates plugin to the Figma Community.

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Preparing Your Plugin](#preparing-your-plugin)
3. [Creating Required Assets](#creating-required-assets)
4. [Publishing to Figma Community](#publishing-to-figma-community)
5. [Post-Publishing](#post-publishing)

---

## Pre-Deployment Checklist

Before publishing, ensure you have completed the following:

### Account Requirements
- [ ] **Two-Factor Authentication (2FA) Enabled**: Mandatory for publishing plugins
  - Go to your Figma account settings
  - Enable 2FA under Security settings
  - This is required before you can publish

### Code Quality
- [ ] **Build Successfully**: Run `npm run build` and verify no errors
- [ ] **Test in FigJam**: Load the plugin and test all features:
  - [ ] Template insertion for all 8 template types
  - [ ] CSV import functionality
  - [ ] CSV export functionality
  - [ ] Duplication detection
  - [ ] Sprint organization
  - [ ] Epic grouping
  - [ ] Jira URL configuration
- [ ] **No Console Errors**: Check browser console for any runtime errors
- [ ] **Manifest Valid**: Verify `manifest.json` is valid JSON

### Documentation
- [ ] **README Updated**: Ensure README.md accurately describes the plugin
- [ ] **Support Contact**: Have a support email or help center URL ready

---

## Preparing Your Plugin

### 1. Build the Plugin

Ensure your plugin is built and ready:

```bash
# Install dependencies (if not already done)
npm install

# Build the plugin
npm run build

# Verify code.js was generated successfully
ls -la code.js
```

### 2. Verify Manifest.json

Your `manifest.json` should look like this:

```json
{
    "name": "PI Planning Templates",
    "id": "pi-planning-templates",
    "api": "1.0.0",
    "main": "code.js",
    "ui": "ui.html",
    "editorType": ["figjam"],
    "networkAccess": {
        "allowedDomains": ["none"]
    }
}
```

**Note**: The manifest is already correctly configured for FigJam-only deployment.

### 3. Test Locally

1. Open Figma Desktop app
2. Open a FigJam file
3. Go to `Menu > Plugins > Development > Import plugin from manifest...`
4. Select your `manifest.json` file
5. Test all features thoroughly
6. Check for any console errors or warnings

---

## Creating Required Assets

You'll need to create visual assets for your plugin listing. Here's what you need:

### 1. Plugin Icon (Required)
- **Size**: 128 x 128 pixels
- **Format**: PNG or SVG
- **Requirements**:
  - Square format
  - Clear and recognizable at small sizes
  - Represents PI Planning or agile planning
  - No text (icon should be visual only)
- **Suggestions**:
  - Use a calendar, sprint board, or planning-related icon
  - Keep it simple and professional
  - Use brand colors if applicable

### 2. Thumbnail/Cover Image (Required)
- **Size**: 1920 x 1080 pixels (16:9 aspect ratio)
- **Format**: PNG or JPG
- **Requirements**:
  - High-quality screenshot or mockup
  - Shows the plugin in action
  - Includes key features visible
- **Suggestions**:
  - Screenshot of the plugin UI with templates visible
  - Show a FigJam board with PI planning cards
  - Include text overlay highlighting key features
  - Use a clean, professional design

### 3. Additional Screenshots/Videos (Optional but Recommended)
- **Up to 9 additional images or videos**
- **Recommended sizes**: 1920 x 1080 pixels
- **Suggestions**:
  - Screenshot showing CSV import process
  - Screenshot showing different template types
  - Screenshot showing sprint organization
  - Screenshot showing epic grouping
  - Short video demonstrating the plugin workflow

### 4. Playground File (Optional)
- A sample FigJam file that demonstrates the plugin
- Users can open this file to try the plugin immediately
- Should showcase various features and use cases

### Asset Creation Tips

1. **Use Figma to Create Assets**: Create your icon and thumbnail in Figma itself
2. **Show Real Usage**: Use actual screenshots from your plugin
3. **Highlight Features**: Use annotations or overlays to point out key features
4. **Consistent Branding**: Use consistent colors and style across all assets
5. **Test at Different Sizes**: Ensure assets look good when scaled down

---

## Publishing to Figma Community

### Step 1: Access Plugin Management

1. **Open Figma Desktop App** (required - cannot publish from browser)
2. **Open any file** (can be a blank file)
3. **Click the Figma menu** (top-left corner)
4. **Navigate to**: `Plugins > Manage Plugins`

### Step 2: Locate Your Plugin

1. Find your plugin under the **"Development"** section
2. It should be named "PI Planning Templates"
3. **Click the ellipsis (`...`)** next to your plugin
4. **Select "Publish"**

### Step 3: Fill Out Plugin Details

#### Basic Information

- **Name**: `PI Planning Templates`
  - Clear and descriptive
  - Matches your manifest.json name

- **Tagline**: A concise one-liner (max ~60 characters)
  - Example: "Streamline PI planning with templates and Jira integration"
  - Example: "Agile planning templates for FigJam with CSV import/export"

- **Description**: Detailed description of your plugin
  - **Recommended content**:
    ```
    PI Planning Templates is a comprehensive FigJam plugin designed to streamline Program Increment (PI) planning sessions. 

    Features:
    • 8 pre-built template types: Theme, Initiative, Milestone, Epic, User Story, Task, Spike, and Test
    • CSV import/export for seamless Jira integration
    • Automatic issue key tracking for round-trip workflows
    • Smart duplication detection for copied cards
    • Sprint organization with capacity tables
    • Epic grouping in columns
    • Jira hyperlink support for quick issue access

    Perfect for agile teams using SAFe methodology or similar PI planning frameworks. Import your Jira backlog, organize by sprint and epic, and export back to Jira with preserved issue keys.
    ```

- **Category**: Select an appropriate category
  - Recommended: **"Software development"** or **"Design tools"**
  - Other options: "Productivity", "Planning"

#### Visual Assets

1. **Upload Icon**: 
   - Click "Upload" and select your 128x128 icon
   - Preview will show how it appears in the plugin browser

2. **Upload Thumbnail**:
   - Click "Upload" and select your 1920x1080 thumbnail
   - This is the main image users see when browsing plugins

3. **Add Additional Media** (Optional):
   - Upload up to 9 additional screenshots or videos
   - Show different features and use cases
   - Videos can be up to 30 seconds

4. **Add Playground File** (Optional):
   - Upload a sample FigJam file
   - Users can open it to try your plugin immediately

### Step 4: Data Security Disclosure

Fill out the security disclosure form:

- **Data Collection**: Does your plugin collect user data?
  - For this plugin: **No** (it only processes CSV files locally)
  
- **Data Storage**: Where is data stored?
  - For this plugin: **Local only** (no external storage)
  
- **Network Access**: Does your plugin make network requests?
  - For this plugin: **No** (networkAccess is set to "none" in manifest)
  
- **Third-Party Services**: Does your plugin use third-party services?
  - For this plugin: **No**

**Be transparent**: Clearly explain what data (if any) your plugin accesses or stores.

### Step 5: Publishing Settings

#### Publishing Destination
- **Publish to**: Figma Community (public)
- **Note**: If you have an organization/enterprise plan, you can also publish privately

#### Publisher Information
- **Publish as**: Choose one:
  - Your personal profile
  - A team (if you're part of a team)
  - An organization (if you have org access)

#### Support Contact
- **Support Email/URL**: Provide contact information
  - Example: `support@yourdomain.com`
  - Or: Link to a help center or GitHub issues page
  - **Important**: Users will contact you here for support

#### Network Access Review
- Verify your network access settings match your manifest
- For this plugin: `"allowedDomains": ["none"]` is correct

#### Contributors (Optional)
- Add other contributors who helped develop the plugin
- They'll be credited on the plugin page

#### Community Interaction
- **Allow Comments**: Choose whether to allow community comments
  - Recommended: **Yes** (helps with feedback and community engagement)

### Step 6: Pricing (Optional)

If you want to monetize your plugin:

- **Requirement**: Must be an approved creator to sell plugins
- **Pricing Options**:
  - One-time payment (minimum $2.00 USD)
  - Subscription (monthly or yearly)
  - Yearly subscription with discount option
- **For this plugin**: Consider keeping it free initially to build user base

### Step 7: Submit for Review

1. **Review all information** you've entered
2. **Double-check**:
   - All required fields are filled
   - Assets are uploaded correctly
   - Description is clear and accurate
   - Support contact is valid
3. **Click "Publish"** to submit for review

---

## Post-Publishing

### Review Process

- **Timeline**: Figma typically reviews plugins within **5-10 business days**
- **Notification**: You'll receive an email when your plugin is:
  - Approved and published
  - Rejected (with feedback for improvements)
- **Status**: You can check status in `Plugins > Manage Plugins`

### If Approved

1. **Share Your Plugin**:
   - Your plugin will have a unique URL
   - Share it on social media, forums, or with your team
   - Example URL format: `https://www.figma.com/community/plugin/[plugin-id]/[plugin-name]`

2. **Monitor Usage**:
   - Check analytics in the plugin management page
   - See how many users have installed it
   - Monitor user feedback and comments

3. **Respond to Feedback**:
   - Answer user questions in comments
   - Address bug reports promptly
   - Consider feature requests for future updates

### If Rejected

1. **Review Feedback**: Figma will provide specific reasons
2. **Make Improvements**: Address the issues mentioned
3. **Resubmit**: Update your plugin and resubmit for review

### Publishing Updates

Once your plugin is published, you can update it without additional review:

1. **Make Changes**: Update your code, fix bugs, add features
2. **Build**: Run `npm run build` to generate new `code.js`
3. **Update Version**: Consider updating version in `package.json` (for your records)
4. **Publish Update**:
   - Go to `Plugins > Manage Plugins`
   - Find your published plugin
   - Click ellipsis (`...`) > "Update"
   - Provide a description of changes
   - Click "Publish Update"

**Note**: Updates are published immediately (no review required for updates)

---

## Best Practices

### Before Publishing

1. **Test Thoroughly**: Test all features in different scenarios
2. **Get Feedback**: Have team members or beta testers try it
3. **Document Well**: Ensure README and descriptions are clear
4. **Prepare Assets**: Create high-quality visual assets
5. **Plan Support**: Be ready to help users after launch

### After Publishing

1. **Monitor Comments**: Respond to user questions and feedback
2. **Track Issues**: Keep track of bugs and feature requests
3. **Iterate**: Regularly update with improvements
4. **Promote**: Share your plugin in relevant communities
5. **Maintain**: Keep the plugin updated as Figma releases new features

### Common Rejection Reasons

- **Missing or unclear description**
- **Poor quality assets** (blurry, unprofessional)
- **Security concerns** (unclear data handling)
- **Doesn't work as described**
- **Violates Figma's terms of service**
- **Incomplete functionality** (broken features)

---

## Troubleshooting

### Plugin Won't Appear in Development List

- Ensure `code.js` exists (run `npm run build`)
- Check that `manifest.json` is valid JSON
- Verify you're using Figma Desktop app (not browser)

### Can't Click "Publish" Button

- Ensure 2FA is enabled on your account
- Check that you're using the Desktop app
- Verify your plugin is under "Development" section

### Build Errors

- Check Node.js version (should be v16+)
- Run `npm install` to ensure dependencies are installed
- Check for TypeScript errors: `npx tsc --noEmit`

### Assets Not Uploading

- Verify file sizes (not too large)
- Check file formats (PNG, JPG, SVG for images)
- Ensure dimensions match requirements

---

## Resources

- [Figma Plugin Documentation](https://www.figma.com/plugin-docs/)
- [Plugin Review Guidelines](https://figma-signup.helpjuice.com/plugin-and-widget-review-guidelines)
- [Figma Community Guidelines](https://www.figma.com/community/guidelines)
- [Plugin API Reference](https://www.figma.com/plugin-docs/api/api-reference/)

---

## Support

If you encounter issues during deployment:

1. Check Figma's plugin documentation
2. Review the plugin review guidelines
3. Contact Figma support if needed
4. Check the Figma Community forum for similar issues

---

**Good luck with your plugin deployment! 🚀**

