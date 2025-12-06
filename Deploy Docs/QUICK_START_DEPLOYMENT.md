# Quick Start: Deploy to Figma Community

This is a condensed guide for quickly deploying your plugin. For detailed instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## Prerequisites (5 minutes)

1. **Enable 2FA** on your Figma account (required)
   - Account Settings → Security → Enable 2FA

2. **Build your plugin**
   ```bash
   npm run build
   ```

3. **Test locally**
   - Open Figma Desktop
   - Load plugin: `Plugins > Development > Import plugin from manifest...`
   - Test all features in FigJam

## Create Assets (30-60 minutes)

### Required:
- **Icon**: 128x128px PNG (simple, recognizable)
- **Thumbnail**: 1920x1080px PNG/JPG (shows plugin in action)

### Optional but Recommended:
- 3-5 additional screenshots (1920x1080px)
- Playground file (sample FigJam file)

See [ASSET_PREPARATION_GUIDE.md](./ASSET_PREPARATION_GUIDE.md) for details.

## Publish (15 minutes)

1. **Open Figma Desktop** → Any file
2. **Go to**: `Plugins > Manage Plugins`
3. **Find plugin** under "Development" → Click `...` → **Publish**

4. **Fill out form**:
   - **Name**: `PI Planning Templates`
   - **Tagline**: `Streamline PI planning with templates and Jira integration`
   - **Description**: [See DEPLOYMENT_GUIDE.md for template]
   - **Category**: `Software development`
   - **Icon**: Upload 128x128 icon
   - **Thumbnail**: Upload 1920x1080 thumbnail
   - **Support Contact**: Your email or support URL
   - **Data Security**: No data collection, local-only storage
   - **Network Access**: None (matches manifest)

5. **Click "Publish"** → Wait 5-10 business days for review

## After Approval

- Share your plugin URL
- Monitor user feedback
- Respond to comments
- Publish updates as needed

## Need Help?

- **Detailed Guide**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Checklist**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **Assets**: [ASSET_PREPARATION_GUIDE.md](./ASSET_PREPARATION_GUIDE.md)

---

**Estimated Total Time**: 1-2 hours (mostly asset creation)

