# Setup Instructions for New Machine

## Quick Setup

1. **Clone or copy the project** to the new machine
   - Make sure the folder name matches (or update the path in Figma)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the plugin:**
   ```bash
   npm run build
   ```
   This creates the `code.js` file that Figma needs.

4. **Load the plugin in Figma:**
   - Open Figma Desktop
   - Go to `Menu > Plugins > Development > Import plugin from manifest...`
   - Select the `manifest.json` file in the project directory
   - The plugin will appear in your plugins list

## Troubleshooting

### Error: "ENOENT: no such file or directory, lstat '.../code.js'"

**Solution:** Run `npm run build` to generate the `code.js` file.

### Error: Path mismatch

If you see a path error, make sure:
- The project folder name matches what Figma is looking for
- You're loading the plugin from the correct directory
- The `manifest.json` and `code.js` files are in the same directory

### CORS Errors (Gravatar)

The Gravatar CORS errors are harmless warnings and can be ignored. They don't affect plugin functionality.

## Development Workflow

- **Build once:** `npm run build` (creates `code.js`)
- **Watch mode:** `npm run watch` (automatically rebuilds on file changes)
- **After code changes:** Always rebuild before testing in Figma

