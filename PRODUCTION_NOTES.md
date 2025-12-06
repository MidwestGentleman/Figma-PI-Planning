# Production Deployment Notes

## Console Logging

The codebase includes `console.log`, `console.warn`, and `console.error` statements throughout. These are generally acceptable for Figma plugins because:

1. **Console logs only appear in browser DevTools** when the plugin is running
2. **They're helpful for debugging** user-reported issues
3. **Figma doesn't require removing them** for plugin approval

### Current Logging Strategy

- **`console.log`**: Used for debugging workflow steps (e.g., "Starting CSV import")
- **`console.warn`**: Used for non-critical issues (e.g., font loading fallbacks)
- **`console.error`**: Used for actual errors (should always be kept)

### Optional: Conditional Logging

If you want to disable verbose logging in production, you could add a flag:

```typescript
const DEBUG = false; // Set to false for production

if (DEBUG) {
  console.log('Received message:', msg);
}
```

However, this is **not required** for Figma plugin approval.

## Code Quality Checklist

Before publishing, verify:

- [x] Build completes without errors
- [x] TypeScript compiles successfully
- [x] All features tested in FigJam
- [x] No runtime errors in console
- [x] Manifest.json is valid
- [x] Network access correctly configured (none)
- [x] Editor type correctly set (figjam only)

## Performance Considerations

The plugin is already optimized with:
- Batch processing for large CSV imports
- `yieldToUI()` calls to prevent blocking
- Efficient data structures (Set, Map)
- Font loading optimization

## Security Considerations

- ✅ No network access (manifest: `"allowedDomains": ["none"]`)
- ✅ No external API calls
- ✅ Data stored locally only (clientStorage)
- ✅ No user data collection
- ✅ No third-party services

## Browser Compatibility

- Plugin targets ES2020 (compatible with Figma's runtime)
- Uses Figma API 1.0.0 (stable)
- Tested in FigJam environment

## Version Management

Consider adding version tracking:

1. **In package.json**: Already has `"version": "1.0.0"`
2. **In manifest.json**: Could add `"version"` field (optional)
3. **In code**: Could add version constant for debugging

Example manifest with version:
```json
{
  "name": "PI Planning Templates",
  "id": "pi-planning-templates",
  "api": "1.0.0",
  "version": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figjam"],
  "networkAccess": {
    "allowedDomains": ["none"]
  }
}
```

Note: The `version` field in manifest.json is optional and doesn't affect functionality.

## Update Strategy

When publishing updates:

1. **Increment version** in package.json (for your records)
2. **Build new code.js**: `npm run build`
3. **Test thoroughly** before publishing update
4. **Document changes** in update description
5. **Publish update** via Figma Desktop app

Updates are published immediately (no review required).

## Known Limitations

Document any known limitations for users:

- Plugin is optimized for FigJam (may have limited functionality in Figma)
- Large CSV imports (>1000 rows) may take time
- Requires "Issue key" column in CSV for round-trip tracking
- Duplication detection runs periodically (not instant)

## Support Preparation

Be ready to help users with:

- CSV format questions
- Import/export issues
- Template customization
- Jira integration setup
- Performance with large datasets

## Post-Launch Monitoring

After publishing, monitor:

- User comments and feedback
- Common issues or questions
- Feature requests
- Bug reports
- Usage statistics (if available)

---

**Status**: Ready for deployment ✅

