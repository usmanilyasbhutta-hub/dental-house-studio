# Google Earth Studio: the location zoom for the whitening Reel

Earth Studio is free and runs in Chrome on your computer. It makes a "zoom from space to the clinic" as a numbered
JPEG sequence; the video adds the pin, the "Dental House" tag and the credit on top.

Clinic pin (from your Google Maps link, saved in `src/brand.ts`): **32.5054616, 74.546536**

## Steps (about 10 minutes, mostly waiting for the render)

1. Open **https://earth.google.com/studio** in **Chrome** and sign in with your Google account.
   (First time only: accept the terms; access is usually instant.)
2. **New Project → Quick-Start → Zoom To**.
3. In the location search, paste: `32.5054616, 74.546536` and pick it. Click **Next**.
4. Settings on the Quick-Start page:
   - **Dimensions:** Custom **1080 × 1920** (portrait)
   - **Frame rate:** **30 fps**
   - **Duration:** **4 seconds** (120 frames). The video plays it faster in 2.5 s; 4 s gives smoother motion.
   - Click **Start**.
5. Press play once to check: it should start on the globe and end looking down on Commissioner Road with the clinic
   in the **centre** of the frame. If the end is too high or too low, drag the last camera keyframe's **Altitude** to about
   **400–600 m** and keep the target centred.
6. **Render** (top right) → **Local**:
   - File name: **dental-house** (the frames then come out as `dental-house_000.jpeg`, `dental-house_001.jpeg`, …)
   - Format: **JPEG**, quality high
   - **Attribution:** turn the burned-in attribution **off**. The video adds it in a readable place instead
     (Instagram's buttons would cover Earth Studio's own bottom line).
   - Click **Render** and wait; it downloads a **.zip**.
7. While the project is open, note the **attribution text** Earth Studio shows (for example
   "Google Earth · Image © 2026 Airbus"). Send it to me exactly, because Google requires it on screen.
8. Send me the **.zip** (upload it here, or share it from Google Drive).

## What I do with it

- Unzip into `public/footage/earth/2026-11-wedding-whitening/` (not committed to git).
- Set `map_zoom.pending: false` and the credit text in the brief, then render the full video.
- The pin drops on the clinic at the end of the zoom, with the "Dental House / Ahsan Medical Centre, Commissioner Road, Sialkot"
  tag, and the credit stays visible for the whole shot.
