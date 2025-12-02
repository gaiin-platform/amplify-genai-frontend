# White Labeling Guide

This guide explains how to customize the branding of this application to match your organization's identity. White labeling allows you to configure custom logos, color schemes, and theme defaults without modifying the source code.

## Table of Contents

- [Overview](#overview)
- [Environment Variables](#environment-variables)
- [Logo Configuration](#logo-configuration)
- [Theme Configuration](#theme-configuration)
- [Color Customization](#color-customization)
- [Theme Precedence](#theme-precedence)
- [Troubleshooting](#troubleshooting)
- [Complete Example](#complete-example)

## Overview

White labeling is configured at build time using environment variables and configuration files. All customizations are applied when the container image is built, ensuring consistent branding across all deployments.

**Key Features:**
- Custom logo support (SVG format)
- Default theme selection (light or dark)
- Custom color schemes for both themes
- User preference persistence
- Graceful fallbacks for all configurations

## Environment Variables

All white labeling environment variables use the `NEXT_PUBLIC_` prefix to make them available in the browser. Configure these in your `.env.local` file or through your deployment platform's environment variable settings.

### NEXT_PUBLIC_CUSTOM_LOGO

**Purpose:** Specifies the filename of your custom logo in the `public/logos` directory.

**Type:** String (optional)

**Format:** Filename with extension (e.g., `custom-logo.svg`)

**Example:**
```bash
NEXT_PUBLIC_CUSTOM_LOGO=my-company-logo.svg
```

**Notes:**
- Logo file must be placed in the `public/logos/` directory
- SVG format is recommended for best quality and scalability
- If not specified, the default application logo is used
- If the file doesn't exist, the system falls back to the default logo

### NEXT_PUBLIC_DEFAULT_THEME

**Purpose:** Sets the default theme that users see when they first visit the application.

**Type:** String (optional)

**Valid Values:** `light` or `dark`

**Default:** `light`

**Example:**
```bash
NEXT_PUBLIC_DEFAULT_THEME=dark
```

**Notes:**
- Invalid values will fall back to `light` mode with a console warning
- User preferences (once set) will override this default
- Case-sensitive: must be lowercase

### NEXT_PUBLIC_BRAND_NAME

**Purpose:** Sets the brand name used in the application (e.g., for logo alt text and page titles).

**Type:** String (optional)

**Default:** `Amplify GenAI`

**Example:**
```bash
NEXT_PUBLIC_BRAND_NAME=My Company AI Assistant
```

**Notes:**
- Used for accessibility (logo alt text)
- May appear in various UI elements
- Should be your organization's name or product name

## Logo Configuration

### Step 1: Prepare Your Logo

1. **Format:** SVG is strongly recommended for scalability and quality
2. **Size:** Design for approximately 200x60 pixels (width x height)
3. **Colors:** Ensure your logo works on both light and dark backgrounds
4. **File naming:** Use lowercase with hyphens (e.g., `my-company-logo.svg`)

### Step 2: Add Logo to Project

Place your logo file in the `public/logos/` directory:

```bash
public/
  logos/
    my-company-logo.svg
```

### Step 3: Configure Environment Variable

Add the logo filename to your `.env.local`:

```bash
NEXT_PUBLIC_CUSTOM_LOGO=my-company-logo.svg
```

### Step 4: Rebuild and Deploy

**For Local Development:**
```bash
npm run build
npm start
```

**For Docker Deployment:**
```bash
docker build \
  --build-arg NEXT_PUBLIC_CUSTOM_LOGO="my-company-logo.svg" \
  --build-arg NEXT_PUBLIC_DEFAULT_THEME="dark" \
  --build-arg NEXT_PUBLIC_BRAND_NAME="My Company" \
  -t my-app:latest \
  .

docker run -p 3000:3000 my-app:latest
```

**Note:** Environment variables must be passed as build arguments for Docker builds since they are baked into the application at build time.

### Logo Examples

**Example 1: Simple SVG Logo**
```bash
# .env.local
NEXT_PUBLIC_CUSTOM_LOGO=acme-corp.svg
NEXT_PUBLIC_BRAND_NAME=Acme Corporation
```

**Example 2: Using Default Logo**
```bash
# .env.local
# No NEXT_PUBLIC_CUSTOM_LOGO specified - uses default logo
NEXT_PUBLIC_BRAND_NAME=My Company
```

**Example 3: PNG Logo (Alternative)**
```bash
# .env.local
NEXT_PUBLIC_CUSTOM_LOGO=company-logo.png
```

## Theme Configuration

### Default Theme Selection

Set the theme that users see on their first visit:

```bash
# .env.local
NEXT_PUBLIC_DEFAULT_THEME=dark
```

### How Theme Selection Works

1. **First Visit:** User sees the theme specified in `NEXT_PUBLIC_DEFAULT_THEME`
2. **User Changes Theme:** Their preference is saved to browser local storage
3. **Return Visits:** User's saved preference is loaded automatically
4. **No Saved Preference:** Falls back to `NEXT_PUBLIC_DEFAULT_THEME`

### Theme Examples

**Example 1: Dark Theme by Default**
```bash
# .env.local
NEXT_PUBLIC_DEFAULT_THEME=dark
```

**Example 2: Light Theme by Default (Explicit)**
```bash
# .env.local
NEXT_PUBLIC_DEFAULT_THEME=light
```

**Example 3: Using Default (Light)**
```bash
# .env.local
# No NEXT_PUBLIC_DEFAULT_THEME specified - defaults to light
```

## Color Customization

The application uses CSS custom properties (variables) to define colors, which allows you to customize the entire color scheme without modifying any HTML or component code. All existing Tailwind classes (like `bg-blue-500`, `text-purple-600`) automatically use your custom colors.

### How It Works

The application overrides three main Tailwind color families:
- **Blue** → Primary brand color (buttons, links, highlights)
- **Purple** → Secondary brand color (accents, special features)
- **Green** → Accent color (success states, positive actions)

Each color family has 11 shades (50, 100, 200, ..., 900, 950) that are automatically calculated for both light and dark themes.

### Step 1: Edit CSS Variables

Open `styles/globals.css` and modify the color values in the `:root` and `.dark` sections:

```css
/* styles/globals.css */

:root {
  /* Primary color (replaces blue throughout the app) */
  --color-primary-500: #your-brand-color;
  --color-primary-600: #your-brand-color-darker;
  
  /* Secondary color (replaces purple) */
  --color-secondary-500: #your-secondary-color;
  
  /* Accent color (replaces green) */
  --color-accent-500: #your-accent-color;
  
  /* Customize other shades as needed (50-950) */
}

.dark {
  /* Dark mode versions (usually lighter) */
  --color-primary-500: #your-brand-color-light;
  --color-primary-600: #your-brand-color;
}
```

### Step 2: Rebuild Application

After editing CSS variables, rebuild the application:

```bash
npm run build
```

Or for Docker:

```bash
docker build -t my-app:latest .
```

### No Code Changes Needed

All existing UI components automatically use your custom colors. For example:
- `bg-blue-500` → Uses your `--color-primary-500`
- `text-purple-600` → Uses your `--color-secondary-600`
- `border-green-400` → Uses your `--color-accent-400`

### Color Customization Examples

**Example 1: Corporate Blue Theme**
```css
:root {
  --color-primary-500: #0066cc;
  --color-primary-600: #0052a3;
}

.dark {
  --color-primary-500: #3399ff;
  --color-primary-600: #66b3ff;
}
```

**Example 2: Green Eco Theme**
```css
:root {
  --color-primary-500: #059669;
  --color-primary-600: #047857;
}

.dark {
  --color-primary-500: #10b981;
  --color-primary-600: #34d399;
}
```

**Example 3: Purple Tech Theme**
```css
:root {
  --color-primary-500: #7c3aed;
  --color-primary-600: #6d28d9;
}

.dark {
  --color-primary-500: #8b5cf6;
  --color-primary-600: #a78bfa;
}
```

### Color Guidelines

1. **Contrast:** Ensure sufficient contrast between text and background colors (WCAG AA standard: 4.5:1 for normal text)
2. **Consistency:** Use the same color palette across both themes, adjusting only brightness/saturation
3. **Testing:** Test your colors in both light and dark modes
4. **Accessibility:** Consider color-blind users when choosing color combinations

## Theme Precedence

Understanding how themes are selected helps you configure the right defaults for your users.

### Precedence Order (Highest to Lowest)

1. **User's Saved Preference** (stored in browser local storage)
   - Highest priority
   - Set when user manually toggles theme
   - Persists across browser sessions
   - Specific to each browser/device

2. **Administrator's Default Theme** (from `NEXT_PUBLIC_DEFAULT_THEME`)
   - Applied when user has no saved preference
   - Set at build time
   - Consistent across all users initially

3. **System Default** (`light`)
   - Fallback if no configuration is provided
   - Used when `NEXT_PUBLIC_DEFAULT_THEME` is not set or invalid

### Example Scenarios

**Scenario 1: New User**
```
User visits for first time
→ No saved preference exists
→ System applies NEXT_PUBLIC_DEFAULT_THEME (e.g., "dark")
→ User sees dark theme
```

**Scenario 2: Returning User**
```
User previously selected light theme
→ Saved preference exists in local storage
→ System loads saved preference ("light")
→ User sees light theme (ignores NEXT_PUBLIC_DEFAULT_THEME)
```

**Scenario 3: User Toggles Theme**
```
User clicks theme toggle
→ Theme switches from light to dark
→ Preference saved to local storage
→ On next visit, dark theme loads automatically
```

**Scenario 4: Local Storage Unavailable**
```
User's browser has local storage disabled
→ System cannot save preference
→ Falls back to NEXT_PUBLIC_DEFAULT_THEME
→ Theme resets to default on each visit
```

## Troubleshooting

### Logo Not Appearing

**Problem:** Custom logo doesn't show up, default logo appears instead.

**Solutions:**
1. **Check file location:** Ensure logo is in `public/logos/` directory
2. **Verify filename:** Check that `NEXT_PUBLIC_CUSTOM_LOGO` matches the actual filename exactly (case-sensitive)
3. **Check file format:** Verify the file is a valid SVG or image format
4. **Rebuild application:** Run `npm run build` to apply environment variable changes
5. **Check browser console:** Look for warnings about failed logo loading
6. **Clear cache:** Clear browser cache and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

**Example Debug:**
```bash
# Check if file exists
ls -la public/logos/

# Verify environment variable
echo $NEXT_PUBLIC_CUSTOM_LOGO

# Check build output
npm run build 2>&1 | grep -i logo
```

### Theme Not Applying

**Problem:** Default theme configuration is ignored.

**Solutions:**
1. **Verify environment variable:** Check that `NEXT_PUBLIC_DEFAULT_THEME` is set correctly
2. **Check for typos:** Value must be exactly `light` or `dark` (lowercase)
3. **Clear local storage:** User's saved preference overrides default
   ```javascript
   // In browser console
   localStorage.removeItem('user-theme-preference');
   location.reload();
   ```
4. **Rebuild application:** Environment variables are read at build time
5. **Check browser console:** Look for theme validation warnings

### Custom Colors Not Working

**Problem:** Custom colors defined in Tailwind config don't appear.

**Solutions:**
1. **Rebuild Tailwind:** Run `npm run build` to regenerate CSS
2. **Check syntax:** Verify Tailwind config syntax is correct
3. **Purge cache:** Delete `.next` directory and rebuild
   ```bash
   rm -rf .next
   npm run build
   ```
4. **Verify class names:** Ensure you're using the correct Tailwind class names
5. **Check CSS variables:** Verify CSS custom properties are defined in `globals.css`
6. **Inspect element:** Use browser dev tools to check if classes are applied

### Theme Not Persisting

**Problem:** Theme resets to default on every visit.

**Solutions:**
1. **Check local storage:** Verify browser allows local storage
   ```javascript
   // In browser console
   localStorage.setItem('test', 'value');
   console.log(localStorage.getItem('test')); // Should print 'value'
   ```
2. **Check browser settings:** Ensure cookies/storage are not blocked
3. **Private browsing:** Local storage may not persist in incognito/private mode
4. **Check for errors:** Look for JavaScript errors in browser console
5. **Verify ThemeService:** Ensure `ThemeService.saveTheme()` is being called

### Build Errors

**Problem:** Application fails to build after adding white label configuration.

**Solutions:**
1. **Check Tailwind syntax:** Verify `tailwind.config.js` has valid JavaScript syntax
2. **Verify imports:** Ensure all imports in config files are correct
3. **Check environment variables:** Verify no special characters in variable values
4. **Review error messages:** Read build output carefully for specific errors
5. **Test incrementally:** Add configurations one at a time to isolate issues

### Logo Appears Distorted

**Problem:** Custom logo is stretched or incorrectly sized.

**Solutions:**
1. **Check aspect ratio:** Ensure logo maintains proper aspect ratio
2. **Adjust dimensions:** Modify width/height props in Logo component usage
3. **Use SVG:** SVG format scales better than raster images
4. **Check viewBox:** For SVG files, verify viewBox attribute is set correctly
5. **Test responsive:** Check logo appearance on different screen sizes

## Complete Example

Here's a complete example configuration for a fictional company "Acme Corporation" that wants a dark-themed AI assistant with purple branding.

### .env.local
```bash
# Acme Corporation White Label Configuration

# Custom logo (file located at public/logos/acme-logo.svg)
NEXT_PUBLIC_CUSTOM_LOGO=acme-logo.svg

# Default to dark theme
NEXT_PUBLIC_DEFAULT_THEME=dark

# Brand name for accessibility and UI
NEXT_PUBLIC_BRAND_NAME=Acme AI Assistant
```

### tailwind.config.js
```javascript
// No changes needed - Tailwind config already set up to use CSS variables
// Colors are customized via styles/globals.css instead
```

### styles/globals.css (modifications)
```css
/* Acme Corporation Theme Variables */
/* Edit the existing color variables in styles/globals.css */

:root {
  /* Primary color (purple) - replaces blue throughout app */
  --color-primary-500: #7c3aed;
  --color-primary-600: #6d28d9;
  --color-primary-700: #5b21b6;
  
  /* Secondary color (pink) - replaces purple throughout app */
  --color-secondary-500: #ec4899;
  --color-secondary-600: #db2777;
  
  /* Accent color (gold) - replaces green throughout app */
  --color-accent-500: #f59e0b;
  --color-accent-600: #d97706;
  
  /* Customize other shades (50-950) as needed */
}

.dark {
  /* Dark mode versions (lighter shades) */
  --color-primary-500: #8b5cf6;
  --color-primary-600: #a78bfa;
  
  --color-secondary-500: #f472b6;
  --color-secondary-600: #f9a8d4;
  
  --color-accent-500: #fbbf24;
  --color-accent-600: #fcd34d;
}
```

### File Structure
```
project/
├── .env.local                          # Environment configuration
├── tailwind.config.js                  # Tailwind customization
├── styles/
│   └── globals.css                     # CSS variables
├── public/
│   └── logos/
│       └── acme-logo.svg              # Custom logo file
└── docs/
    └── WHITE_LABEL.md                 # This documentation
```

### Deployment Steps

1. **Prepare logo file:**
   ```bash
   # Copy logo to correct location
   cp /path/to/acme-logo.svg public/logos/
   ```

2. **Customize colors:**
   ```bash
   # Edit styles/globals.css
   # Change the CSS variable values (see example above)
   ```

3. **Build with Docker:**
   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_CUSTOM_LOGO="acme-logo.svg" \
     --build-arg NEXT_PUBLIC_DEFAULT_THEME="dark" \
     --build-arg NEXT_PUBLIC_BRAND_NAME="Acme AI Assistant" \
     -t acme-ai:latest \
     .
   ```

4. **Run and test:**
   ```bash
   # Start container
   docker run -p 3000:3000 acme-ai:latest
   
   # Open browser to http://localhost:3000
   ```

5. **Verify configuration:**
   - Open application in browser
   - Check that Acme logo appears
   - Verify dark theme is default
   - Toggle theme and refresh to test persistence
   - Inspect elements to verify custom colors are applied

### Expected Results

- ✅ Acme logo appears in header and all logo locations
- ✅ Application loads in dark theme by default
- ✅ Purple color scheme is applied throughout
- ✅ Theme toggle works and persists across sessions
- ✅ Custom colors appear in both light and dark modes
- ✅ Fallback to default logo if acme-logo.svg is missing
- ✅ Fallback to light theme if local storage fails

---

## Additional Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [WCAG Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [SVG Optimization Tools](https://jakearchibald.github.io/svgomg/)

## Support

If you encounter issues not covered in this guide:

1. Check the browser console for error messages
2. Verify all file paths and environment variables
3. Ensure you've rebuilt the application after configuration changes
4. Review the troubleshooting section above
5. Check that your configuration follows the examples provided

---

**Last Updated:** December 2, 2025
**Version:** 1.0.0
