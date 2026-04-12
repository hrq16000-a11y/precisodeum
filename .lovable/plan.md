

# Add Social Media Links & YouTube Videos to Services/Portfolio

## What we're building

Adding Instagram, Facebook, and YouTube link fields to the service registration form, and supporting YouTube video embeds in the portfolio/profile display.

## Database Migration

Add 3 new columns to the `services` table:
```sql
ALTER TABLE public.services ADD COLUMN instagram_url text DEFAULT '';
ALTER TABLE public.services ADD COLUMN facebook_url text DEFAULT '';
ALTER TABLE public.services ADD COLUMN youtube_url text DEFAULT '';
```

## Changes

### 1. Service form — DashboardServicesPage.tsx
- Add `instagram_url`, `facebook_url`, `youtube_url` to the form state
- Add input fields with Instagram/Facebook/YouTube icons in the dialog (after the photo upload section)
- Include these fields in the save/edit payload and in `handleEdit` pre-fill

### 2. Service Wizard — ServiceWizard.tsx (onboarding)
- Add social link fields in Step 2 (Details) — optional inputs for Instagram, Facebook, YouTube URLs

### 3. Admin ServiceEditDialog.tsx
- Add the 3 social URL fields to the edit form and save payload

### 4. YouTube URL detection — imageOptimizer.ts
- Add `isYouTubeUrl(url)` helper that detects `youtube.com/watch`, `youtu.be/`, `youtube.com/shorts/` patterns
- Add `getYouTubeEmbedUrl(url)` to convert any YouTube URL to an embeddable `youtube.com/embed/` URL
- Add `getYouTubeThumbnail(url)` to extract the video thumbnail

### 5. Provider Profile — ProviderProfile.tsx
- In the services section, display social media icon links (Instagram, Facebook, YouTube) when populated
- For YouTube URLs: render an embedded iframe or clickable thumbnail with play overlay
- In portfolio rendering, detect YouTube URLs and render embedded iframe instead of `<video>` tag

### 6. ImageLightbox.tsx
- Add YouTube embed support: when current item is a YouTube URL, render an iframe instead of `<img>` or `<video>`

## Technical Details

- Social URL fields are optional (nullable, default empty string)
- YouTube detection covers: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`
- Embed format: `https://www.youtube.com/embed/{videoId}` with `autoplay=1` in lightbox
- All fields use `encodeURIComponent` where needed and validate URL format client-side
- No breaking changes to existing data or UI

