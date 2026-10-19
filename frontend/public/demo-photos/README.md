# Demo photos

The one-click demo's listings use the images in this folder. They are served by
the frontend and stored as **relative URLs** (`/demo-photos/demo-1.jpg`), so no
Cloudinary account is required.

Drop in up to six images named:

```
demo-1.jpg
demo-2.jpg
demo-3.jpg
demo-4.jpg
demo-5.jpg
demo-6.jpg
```

`.png` and `.webp` work too — just keep the same base names. Prefer a mix of
exterior / living-area / bedroom shots; each listing shows its images as the
cover plus gallery. Anything missing simply does not appear.

To use different filenames, set the backend env var (comma-separated):

```
DEMO_PHOTOS=/demo-photos/front.jpg,/demo-photos/kitchen.jpg
```

The backend exposes this list at `GET /api/config`, so the UI stays in sync
without a rebuild.
