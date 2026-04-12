

## Analysis

The profile page for `jean-carlos-curitiba` has **all portfolio items as `.mp4` video files**, but the code treats everything as images:

1. **`portfolioThumb()`** converts URLs to Supabase's `/render/image/` endpoint, which fails on video files
2. **`<img>` tags** can't display `.mp4` files — they trigger `onError`
3. **`handleImageError()`** hides the element entirely (`img.style.display = 'none'`), making everything invisible
4. **ImageLightbox** also uses `<img>` tags with `portfolioFull()` — same problem for videos

Additionally, `optimizedImageUrl()` doesn't check if the URL is a video before applying image transforms — this is a **global issue** affecting any video uploaded as portfolio content.

## Plan

### 1. Add video URL detection utility
Create a helper function `isVideoUrl(url)` in `src/lib/imageOptimizer.ts` that checks file extensions (`.mp4`, `.mov`, `.webm`, `.avi`). Make `optimizedImageUrl()` skip transform for video URLs (return original URL unchanged).

### 2. Update `handleImageError` to show placeholder instead of hiding
In `src/lib/imageResolver.ts`, change the last-resort behavior from `img.style.display = 'none'` to showing a generic placeholder image or a neutral background — never hide the element.

### 3. Support video rendering in portfolio grid (ProviderProfile.tsx)
In the portfolio rendering sections (both album-based and flat grid), detect video URLs and render `<video>` with poster/thumbnail instead of `<img>`. Videos should show a play icon overlay and autoplay muted on hover (or play inline in the lightbox).

### 4. Support video in ImageLightbox
Update `ImageLightbox.tsx` to detect video URLs and render a `<video>` element with controls instead of `<img>` when the current item is a video.

### 5. Prevent duplicate media entries (data cleanup)
The media table has duplicate entries for the same files. This is a data quality issue but not blocking display — will note for future cleanup.

### Technical details

**Files to modify:**
- `src/lib/imageOptimizer.ts` — add `isVideoUrl()`, guard `optimizedImageUrl()`
- `src/lib/imageResolver.ts` — fix `handleImageError` fallback behavior
- `src/pages/ProviderProfile.tsx` — render `<video>` for video URLs in portfolio grid
- `src/components/ImageLightbox.tsx` — render `<video>` for video URLs in lightbox

**No database changes needed.** The data is correct — the code just doesn't handle video media types.

