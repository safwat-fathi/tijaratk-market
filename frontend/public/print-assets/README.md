# QR Code Sticker Assets & Generation Guide

This directory contains print-ready marketing materials and stickers that brick-and-mortar store merchants can print and place in their storefronts. Scanning these stickers directs customers to the store's digital storefront branch on Tijaratk.

## Specifications of Desired Output

To ensure high-quality physical printing, the stickers must adhere to the following strict print specifications:

| Parameter | Specification | Description |
| :--- | :--- | :--- |
| **Trim Size** | $200\text{mm} \times 300\text{mm}$ | The final cut dimensions of the physical sticker. |
| **Bleed Margin** | $3\text{mm}$ | Extra printing margin on all 4 sides to avoid white gaps after cutting. |
| **Canvas Size (with Bleed)** | $206\text{mm} \times 306\text{mm}$ | The dimensions of the `@page` size and body artwork in HTML/CSS. |
| **Safe Area Margin** | $9\text{mm}$ inset ($6\text{mm}$ inside trim line) | Margins containing critical text/logos to prevent truncation during trimming. |
| **Color Space** | **CMYK** (`DeviceCMYK`) | Essential color model for commercial printing presses (converts RGB from web rendering). |
| **QR Code Contrast** | Brand Green (`#0f5a3d`) | Sharp rendering with high contrast against the white card backing. |
| **QR Render Engine** | Vector paths with crisp edges | Standard SVG path data rendered using `shape-rendering="crispEdges"`. |

---

## Directory Structure

- `tijaratk-qr-sticker.html`: The master blank template layout. Contains placeholders for the QR code and merchant name.
- `tijaratk-qr-sticker-haya.html` / `.pdf`: Active assets for Haya Market.
- `tijaratk-qr-sticker-online.html` / `.pdf`: Active assets for Online Market.
- `tijaratk-qr-sticker-elnahas.html` / `.pdf`: Active assets for Elnahas Pharmacy.

---

## Generation & Build Steps

To generate a new custom QR sticker for a merchant, follow this standard process:

### 1. Copy the Master Template
Duplicate `tijaratk-qr-sticker.html` and rename it using the merchant slug:
```bash
cp tijaratk-qr-sticker.html tijaratk-qr-sticker-[merchant-slug].html
```

### 2. Fetch the QR Code SVG
Call the goQR.me API (or similar tool) to generate a vector SVG QR code with the brand color and standard quiet zone margin:
```url
https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.tijaratk.com/[merchant-slug]&format=svg&color=0f5a3d&qzone=4
```

### 3. Clean and Embed the SVG
1. Open the downloaded SVG and strip the `<?xml ...>` header and `<!DOCTYPE ...>` declarations.
2. Replace the opening `<svg>` tag attributes with:
   ```html
   <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 [width] [height]" width="100%" height="100%" aria-hidden="true" shape-rendering="crispEdges">
   ```
   *(Ensure the `viewBox` coordinates match the native width/height attributes returned by the API).*
3. Place this cleaned SVG code inside the `<div class="qr">` placeholder.

### 4. Update Merchant Text & Title
1. Change the `<title>` element in the `<head>` to:
   ```html
   <title>Tijaratk QR Sticker - [Merchant Name]</title>
   ```
2. Replace `&nbsp;` inside `<div class="store-name">` with the merchant's Arabic/English brand name (e.g. `صيدليات النحاس`).

### 5. Compile to RGB PDF
Use headless Google Chrome (or a server-side equivalent like Puppeteer) to render the HTML layout to a high-resolution PDF:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless \
  --disable-gpu \
  --no-sandbox \
  --print-to-pdf="tijaratk-qr-sticker-[merchant-slug]-rgb.pdf" \
  "file:///path/to/tijaratk-qr-sticker-[merchant-slug].html"
```

### 6. Convert to CMYK Color Space
Use Ghostscript to convert the RGB PDF to a production-ready CMYK PDF:
```bash
gs -dNOPAUSE -dBATCH -sDEVICE=pdfwrite \
   -sColorConversionStrategy=CMYK \
   -dProcessColorModel=/DeviceCMYK \
   -dOverrideICC=true \
   -sOutputFile="tijaratk-qr-sticker-[merchant-slug].pdf" \
   "tijaratk-qr-sticker-[merchant-slug]-rgb.pdf"
```

### 7. Cleanup
Remove the temporary RGB file:
```bash
rm "tijaratk-qr-sticker-[merchant-slug]-rgb.pdf"
```

---

## Color Verification
To check that the compiled PDF color space has been successfully converted from RGB to CMYK, run:
```bash
grep -ao "/DeviceCMYK" "tijaratk-qr-sticker-[merchant-slug].pdf" | sort | uniq -c
```
A successful conversion will return multiple occurrences of `/DeviceCMYK`.

---

## Important Alignment & Centering Guidelines

A common pitfall during QR code generation is having the QR code appear offset or cropped inside the white bordered square. To ensure this does not happen in the future, adhere to the following rules:

### 1. Match the SVG `viewBox` with the Content Canvas
When the API generates the QR code, it outputs a `<svg>` element with specific `width` and `height` attributes (for example, `width="185"` and `height="185"`). 
* **The Issue**: If you set the `viewBox` to a hardcoded size (like `viewBox="0 0 164 164"`) that is smaller than the actual dimensions of the QR elements (like `<rect width="185" height="185" />`), the browser crops the SVG coordinate system. This causes the QR code to render shifted towards the top-left corner.
* **The Fix**: Always ensure the `viewBox` coordinates exactly match the actual canvas size of the SVG content:
  ```html
  <!-- CORRECT: viewBox matches the dimensions of the rect/elements inside -->
  <svg viewBox="0 0 185 185" ...>
  ```

### 2. Configure the QR Wrapper to Explicitly Center the SVG
Ensure the parent `.qr` container and the `svg` element are styled in CSS to automatically center and scale the vector graphic inside the card.
The `.qr` wrapper must be styled as a grid container centering its child:
```css
.qr {
  width: 92mm;
  height: 92mm;
  position: relative;
  display: grid;
  place-items: center; /* Centers the QR code horizontally and vertically */
}

.qr svg {
  width: 100%;
  height: 100%;
  display: block; /* Avoids inline block spacing quirks */
}
```
This guarantees the QR vector stays crisp, responsive, and perfectly centered in the bordered square.

