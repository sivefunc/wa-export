# PNG, JPEG and PDF export — design

Requested on 2026-10-24: export formats PDF, PNG and JPEG. User decisions:
- PDF pages are images of the WhatsApp look **plus an invisible text layer** so text can be searched and copied.
- PNG/JPEG give **one whole image** by default, with an option to **split long chats into parts in a ZIP**.

## How

All three reuse the HTML export's look, rendered in a **snapshot mode** of the same renderer:
- no script, no controls, no "Save as PDF" button
- media inline as `data:` URLs: photos, stickers and avatars downscaled to their display size at 2×
- the first frame of a video, with a ▶ badge and its duration (a card if it can't be decoded)
- voice notes and audio as a drawn player; documents as their card

The raster pipeline (`src/export/raster/`) runs in the content script:
1. **Layout:** mount the snapshot offscreen (900 CSS px wide) in a shadow root, wait for images, and measure every item (day chip or message) and every line of text.
2. **Paginate** (pure): cut between items into slices of a maximum height. An item taller than a slice gets a slice of its own and is cut at the slice edge.
3. **Rasterize** each slice: serialize it as XHTML into an SVG `<foreignObject>`, draw it to a canvas at the chosen scale, and encode PNG or JPEG.

Verified on 2026-10-24 that this neither taints the canvas nor loses pixels in Chromium, in a Firefox content script, or under WhatsApp Web's CSP (`img-src data: blob:`, `media-src blob:`, `style-src 'unsafe-inline'`).

**PNG/JPEG**
- The image is 2×, scaled down toward 1× so it stays within 32,000 px per side and 200 M pixels.
- If it still doesn't fit, it's split into parts in a ZIP when the "Long images: split" setting is on. Otherwise it's refused with a message pointing at that setting.

**PDF** (no library)
- A4 portrait. Each page is a JPEG image XObject (DCTDecode) drawn full-bleed.
- The text layer is drawn in render mode 3 (invisible) with a non-embedded Type0/Identity-H font. Each character gets its own CID, and a `ToUnicode` CMap maps CIDs back to text, emoji included.
- Each measured line is placed at its box, and horizontal scaling stretches it to the measured width, so selection follows the image.

## Settings

- `longImages: "single" | "split"`, default `"single"`.
- It appears in the ⚙ menu as "Long images" only while the format is PNG or JPEG, and always on the options page.
- Writers receive the settings as a third argument of `write()`.

## Tests

- **Pure units:** snapshot HTML, pagination, scale and split decisions, and the PDF builder (xref offsets, pages, text layer, ToUnicode).
- **Real browsers:** `test:firefox` runs PNG, JPEG and PDF in a Firefox content script with page-world bytes, and a Chromium check runs the same writers in Chromium.
