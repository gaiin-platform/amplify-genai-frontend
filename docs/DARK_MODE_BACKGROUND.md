# Dark Mode Background Customization

## Overview

You can now customize the dark mode background color to match your brand. By default, the app uses `#343541` for dark mode backgrounds.

## Configuration

### Build Argument

Add the `NEXT_PUBLIC_BRAND_DARK_BG` build argument when building your Docker image:

```bash
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg \
  --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000 \
  --build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000 \
  --build-arg NEXT_PUBLIC_BRAND_DARK_BG=#8B0000 \
  -t your-app:branded \
  .
```

### Local Development

Add to your `.env.local` file:

```bash
NEXT_PUBLIC_BRAND_LOGO=/logos/your-logo.svg
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000
NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000
NEXT_PUBLIC_BRAND_DARK_BG=#8B0000
```

## How It Works

The `BrandStyles` component injects CSS that overrides the default dark mode background color (`#343541`) with your custom color. This applies to:

- Main application background
- Chat interface background
- Sidebar backgrounds
- Modal backgrounds
- Any element using the `dark:bg-[#343541]` class

## Examples

### NC State (Dark Red)
```bash
NEXT_PUBLIC_BRAND_DARK_BG=#8B0000
```

### Duke (Dark Blue)
```bash
NEXT_PUBLIC_BRAND_DARK_BG=#001A57
```

### UNC (Dark Blue)
```bash
NEXT_PUBLIC_BRAND_DARK_BG=#13294B
```

### Corporate Gray (Slightly Darker)
```bash
NEXT_PUBLIC_BRAND_DARK_BG=#2A2B35
```

## Tips

1. **Choose a dark color**: The background should be dark enough for white text to be readable
2. **Test contrast**: Ensure sufficient contrast with text (WCAG AA: 4.5:1 ratio)
3. **Match your brand**: Use a darker shade of your primary brand color
4. **Test in dark mode**: Always test with dark mode enabled to see the effect

## Color Contrast Tool

Use this formula to check if your color is dark enough:

```
Relative Luminance = (R/255)^2.2 * 0.2126 + (G/255)^2.2 * 0.7152 + (B/255)^2.2 * 0.0722
```

For dark backgrounds, aim for a relative luminance < 0.2

Or use online tools:
- https://webaim.org/resources/contrastchecker/
- https://contrast-ratio.com/

## Complete Example

```bash
# Build with full branding including dark mode background
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg \
  --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000 \
  --build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000 \
  --build-arg NEXT_PUBLIC_BRAND_DARK_BG=#8B0000 \
  -t your-app:nc-state \
  .

# Tag and push
docker tag your-app:nc-state ${ECR_REGISTRY}/your-app:nc-state
docker push ${ECR_REGISTRY}/your-app:nc-state

# Deploy
aws ecs update-service \
  --cluster your-cluster \
  --service your-service \
  --force-new-deployment
```

## Troubleshooting

### Background color not changing

1. **Rebuild the image**: The variable must be set at build time
2. **Clear browser cache**: Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
3. **Check dark mode is enabled**: The custom color only applies in dark mode
4. **Verify the build arg**: Check that you included `--build-arg NEXT_PUBLIC_BRAND_DARK_BG=...`

### Color looks wrong

1. **Check hex format**: Ensure it starts with `#` and has 6 characters
2. **Test the color**: Use a color picker to verify the hex code
3. **Consider opacity**: Some elements may have opacity applied

## Default Value

If not specified, the default dark mode background is `#343541` (a dark gray-blue).
