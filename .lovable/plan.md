

# Smart Banner Display System — Full Image Visibility

## Problem
All sponsor/ad images use `object-cover` which crops images. Users upload banners of varying proportions and they get cut off, reducing sponsor value.

## Solution
Replace `object-cover` with `object-contain` across all 5 ad/sponsor components, use responsive `aspect-ratio` containers, and add a blur-background fill effect so images always show 100% complete while containers look polished.

## Files to Change

### 1. Create utility: `src/lib/sponsorImage.ts`
Helper to classify image aspect ratio and return appropriate container settings:
- `horizontal` → aspect-ratio 16/4
- `square` → aspect-ratio 1/1  
- `vertical` → aspect-ratio 3/4
- `leaderboard` → aspect-ratio 728/90

Also exports a `SponsorImage` React component that renders:
- A container with the classified aspect-ratio
- Background: blurred version of the image (CSS `background-image` + `filter: blur(20px)` + `scale(1.2)`)
- Foreground: `<img>` with `object-fit: contain` + `object-position: center`
- On mobile: `width: 100%`, `height: auto`, no fixed heights

### 2. Update `src/components/home/SponsorsSection.tsx`
- Replace inline `<img>` with `SponsorImage` component
- Remove `object-cover`, `minHeight`, fixed `aspectRatio` style
- Container keeps rounded corners and hover effects

### 3. Update `src/components/ads/AdBanner.tsx`
- Replace `<img>` with `SponsorImage`
- Remove `object-cover`, mobile `minHeight: '60px'`
- Let aspect ratio be auto-detected or use position-based defaults

### 4. Update `src/components/ads/AdShowcase.tsx`
- Replace both mobile and desktop `<img>` blocks with `SponsorImage`
- Remove `object-cover`, fixed `minHeight` values

### 5. Update `src/components/ads/AdNativeCard.tsx`
- Replace `<img className="h-28 object-cover">` with `SponsorImage`
- Remove fixed height, use contain

### 6. Update `src/components/SponsorAd.tsx`
- Replace `object-cover` in vertical layout with `SponsorImage`
- Keep inline layout's `object-contain` (already correct)
- Update horizontal rotational layout image

### 7. Update `src/pages/AdminSponsorsPage.tsx`
- Add image preview with actual dimensions displayed after upload
- Show recommended size hint per position (e.g., "Recomendado: 1200×300 para banners horizontais")
- Preview uses `SponsorImage` component so admin sees exactly what users will see

## Technical Approach

```text
┌─────────────────────────────────┐
│  Container (aspect-ratio auto)  │
│  ┌───────────────────────────┐  │
│  │ bg: blur(image) scale1.2  │  │
│  │  ┌─────────────────────┐  │  │
│  │  │ img: object-contain  │  │  │
│  │  │ 100% visible, sharp  │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

The `SponsorImage` component:
```tsx
// Detects ratio from naturalWidth/naturalHeight on load
// Applies blur background + contain foreground
// Mobile: removes aspect-ratio, uses width:100% height:auto
```

## Key Rules
- Zero `object-cover` on any sponsor image after this change
- All images show 100% complete — no cropping ever
- Blur background fills empty space elegantly
- Mobile always uses fluid height (no fixed px)
- No changes to tracking, rotation, or data logic

