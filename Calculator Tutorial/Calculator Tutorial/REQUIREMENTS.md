# Project Requirements & Deployment Specification

## 1. Executive Summary
This application is a **100% Client-Side Progressive Web App (PWA)** featuring:
- High-precision Scientific Calculator (RAD & DEG trigonometric modes)
- Commercial percentage engine (`25,000 - 16% = 21,000`)
- Real-time Currency Converter (13 world currencies)
- Multi-category Unit Converter (Length, Area, Volume, Weight, Temperature, Time, Speed)
- Mobile-optimized touch engine with zero click latency, swipe protection, and haptic feedback.

---

## 2. Technical Stack & Environment Requirements

### Runtime Environment (User-Facing)
- **Engine**: Modern Web Browser (Google Chrome, Apple Safari iOS, Mozilla Firefox, Microsoft Edge, Samsung Internet).
- **Client Prerequisites**: ECMAScript 2020+ (BigInt, optional chaining support).
- **Backend / Database**: **None**. Zero external server dependencies; all mathematical calculations, unit conversions, and storage run entirely inside the client browser.
- **External Network API**: Currency exchange rates use `open.er-api.com` with internal offline fallback rates.

### Server / Hosting Prerequisites
- **Server Type**: Any static web server or CDN (Vercel, Netlify, GitHub Pages, Cloudflare Pages, Nginx, Apache, AWS S3 / CloudFront).
- **Node.js**: **Not required** for production.
- **Build Step**: **None required** (Zero build tools, vanilla HTML/CSS/JS).

---

## 3. Container Specification (Docker)

If hosting on containerized platforms (Docker, Google Cloud Run, AWS ECS, Railway, Render, DigitalOcean):

- **Base Image**: `nginx:alpine` (~23MB footprint)
- **Exposed Port**: `80` (HTTP)
- **Container Build Command**:
  ```bash
  docker build -t calculator-app .
  ```
- **Container Run Command**:
  ```bash
  docker run -d -p 8080:80 --name calculator calculator-app
  ```

---

## 4. Vercel Deployment Requirements & Root Cause Fix

> [!IMPORTANT]
> **Why Vercel was stuck for 30+ minutes:**
> Vercel does **NOT** build or run Dockerfiles. Vercel is a serverless static hosting platform.
> If `server.js` was uploaded to your GitHub repository, Vercel detected `server.js` and assumed this was a Node.js background HTTP server. Because `server.js` contains `server.listen()`, Vercel tried to start an endless background server and hung waiting for it to finish building!

### Files Required in GitHub for Instant Vercel Deploy:
1. `index.html` (Main entry point)
2. `style.css` (Glassmorphic styling)
3. `script.js` (Engine logic)
4. `manifest.json` (PWA configuration)
5. `sw.js` (Service worker)
6. `icon-512.svg` (PWA app icon)
7. `calculator-mobile.html` (Standalone bundle)
8. `vercel.json` (Static routing config)
9. `package.json` (Static build declaration)
10. `.vercelignore` (Tells Vercel to ignore `server.js`)

### Action Items to Deploy Successfully on Vercel:
1. **Delete `server.js` from your GitHub repository** (or leave it if you have `.vercelignore` uploaded).
2. **Make sure `vercel.json` and `package.json` are committed to your GitHub repo.**
3. **In your Vercel Dashboard**:
   - Go to **Project Settings** > **General** > **Build & Development Settings**.
   - **Framework Preset**: Select **Other**.
   - **Build Command**: Leave empty (or toggle Override on and type: `echo Done`).
   - **Output Directory**: Leave empty or `.`.
   - **Install Command**: Leave empty or toggle Override and leave blank.
4. **Click "Deploy" or push a new commit**: It will finish building and go live in **5 to 10 seconds**!
