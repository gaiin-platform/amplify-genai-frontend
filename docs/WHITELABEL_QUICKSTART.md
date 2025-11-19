# White Label Quick Start

## 🎨 Local Development (3 Steps)

### Step 1: Add Your Logo
Place your logo file in `public/logos/`:
```bash
public/logos/your-company-logo.svg
```

### Step 2: Configure Environment Variables
Add to `.env.local`:
```bash
# Your company logo
NEXT_PUBLIC_BRAND_LOGO=/logos/your-company-logo.svg

# Your brand colors (hex format)
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#525364
NEXT_PUBLIC_BRAND_HOVER_COLOR=#3d3e4d
```

### Step 3: Restart & Test
```bash
npm run dev
```

Visit the login screen to see your branding!

---

## 🐳 Docker/Production Deployment

**⚠️ Important:** Next.js embeds `NEXT_PUBLIC_*` variables at **build time**. You must set them when building the Docker image, not at runtime.

### Step 1: Add Your Logo
```bash
cp ~/your-logo.svg public/logos/your-logo.svg
```

### Step 2: Build with Branding
```bash
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/your-logo.svg \
  --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#525364 \
  --build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#3d3e4d \
  -t your-app:branded \
  .
```

### Step 3: Push & Deploy
```bash
# Tag and push to ECR
docker tag your-app:branded ${ECR_REGISTRY}/your-app:latest
docker push ${ECR_REGISTRY}/your-app:latest

# Deploy to ECS
aws ecs update-service \
  --cluster your-cluster \
  --service your-service \
  --force-new-deployment
```

📖 **See `docs/WHITE_LABELING_BUILD.md` for detailed build instructions**

---

## 📋 What Gets Customized

✅ Login screen logo  
✅ Login button primary color  
✅ Login button hover color  
✅ Brand colors available throughout the app via Tailwind classes

## 🔧 Files Modified

- `.env.local.example` - Added white label environment variables
- `utils/app/branding.ts` - New branding configuration utility
- `pages/api/home/home.tsx` - Updated login screen with configurable logo/colors
- `pages/assistants/[assistantSlug].tsx` - Updated assistant login screen
- `tailwind.config.js` - Added brand color theme support
- `public/logos/default-logo.svg` - Default logo file

## 📚 Full Documentation

See `docs/WHITE_LABELING.md` for complete details, examples, and troubleshooting.

## 🎯 Example Configurations

**Tech Startup (Blue)**
```bash
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#3b82f6
NEXT_PUBLIC_BRAND_HOVER_COLOR=#2563eb
```

**Enterprise (Gray)**
```bash
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#525364
NEXT_PUBLIC_BRAND_HOVER_COLOR=#3d3e4d
```

**Creative Agency (Purple)**
```bash
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#8b5cf6
NEXT_PUBLIC_BRAND_HOVER_COLOR=#7c3aed
```
