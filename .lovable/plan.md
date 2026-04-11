

# Fix: Touch Navigation in ImageLightbox

## Problem
Touch events on the `<img>` element don't bubble to the parent `<div>` because `onClick={e => e.stopPropagation()}` on the image interferes. Since the image covers ~85% of the viewport, most swipe gestures start on the image and never trigger the parent's touch handlers.

## Solution

**File:** `src/components/ImageLightbox.tsx`

- Move `onTouchStart`, `onTouchMove`, `onTouchEnd` handlers directly onto the `<img>` element (or a wrapper `<div>` around the image)
- Add `touch-action: pan-y` on the image wrapper so horizontal swipes are captured by JS while vertical scroll is allowed
- Fix the backdrop close logic: only call `onClose()` on the backdrop div click if the target is the backdrop itself (not a child), removing the need for `stopPropagation` on the image
- Keep the `swiping.current` flag to prevent close after a swipe gesture

Changes are confined to a single file with no dependencies.

