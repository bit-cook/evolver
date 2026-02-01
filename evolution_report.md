**Status**: [SUCCESS]

**Changes Implemented**:
- **Stability (Feishu Sticker)**: Added automatic compression for large images (>5MB).
  - Uses `ffmpeg` (already available) to convert/resize to WebP.
  - Prevents "Image Too Large" API errors from Feishu.
  - Fallback logic ensures if compression fails or doesn't help, original is used.