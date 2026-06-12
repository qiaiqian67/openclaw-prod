// Generates two 32x32 RGBA tray icons for the Electron client:
//   - tray-default.png — the PeerOP logo, downsampled with box-filter averaging
//   - tray-alert.png   — the same logo with a red dot in the top-right
// Both are written to client/build/, which is electron-builder's
// buildResources directory (see electron-builder.yml). The packaged
// build puts them under resources/build/ where main.ts picks them up.
//
// Run via npm prebuild:electron hook. Fails fast on missing logo.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.resolve(__dirname, '..');
const LOGO_PATH = path.resolve(ROOT, '..', 'logo.png');
const OUT_DIR = path.join(ROOT, 'build');
const TRAY_SIZE = 32;
const OUT_DEFAULT = path.join(OUT_DIR, 'tray-default.png');
const OUT_ALERT = path.join(OUT_DIR, 'tray-alert.png');

if (!fs.existsSync(LOGO_PATH)) {
  console.error(`[tray-icons] logo not found at ${LOGO_PATH}`);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

// Read the source logo and force RGBA. pngjs sync.read always returns RGBA
// (alpha defaults to 255 if the source is RGB) so this is just a safety net.
const src = PNG.sync.read(fs.readFileSync(LOGO_PATH));
const srcW = src.width;
const srcH = src.height;
console.log(`[tray-icons] logo ${srcW}x${srcH} → ${TRAY_SIZE}x${TRAY_SIZE}`);

// Box-filter average downsample: for each destination pixel, average the
// source pixels covered by its footprint. Smoother than nearest-neighbour
// at 25× downscale and critical for the logo's circular CQ mark staying
// legible. Each output channel is computed independently.
function downscale(srcW, srcH, srcData, dstW, dstH) {
  const out = Buffer.alloc(dstW * dstH * 4);
  const ratioX = srcW / dstW;
  const ratioY = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy0 = Math.floor(y * ratioY);
    const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * ratioY));
    for (let x = 0; x < dstW; x++) {
      const sx0 = Math.floor(x * ratioX);
      const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * ratioX));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * srcW + sx) * 4;
          r += srcData[i];
          g += srcData[i + 1];
          b += srcData[i + 2];
          a += srcData[i + 3];
          n++;
        }
      }
      const j = (y * dstW + x) * 4;
      out[j]     = Math.round(r / n);
      out[j + 1] = Math.round(g / n);
      out[j + 2] = Math.round(b / n);
      out[j + 3] = Math.round(a / n);
    }
  }
  return out;
}

// Compose a red dot over an existing RGBA buffer at fractional pixel
// coordinates with a soft 1px edge. Porter-Duff "over" for proper alpha.
function overRed(dst, dstW, dstH, cx, cy, r, dr, dg, db) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(dstW - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(dstH - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ddx = x + 0.5 - cx;
      const ddy = y + 0.5 - cy;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d >= r) continue;
      // 1px feathered edge: 0 alpha at d=r, 255 alpha at d=r-1
      const dotA = d <= r - 1 ? 255 : Math.round(255 * (r - d));
      const j = (y * dstW + x) * 4;
      const aE = dst[j + 3] / 255;
      const aN = dotA / 255;
      const outA = aN + aE * (1 - aN);
      if (outA === 0) continue;
      dst[j]     = Math.round((dr * aN + dst[j]     * aE * (1 - aN)) / outA);
      dst[j + 1] = Math.round((dg * aN + dst[j + 1] * aE * (1 - aN)) / outA);
      dst[j + 2] = Math.round((db * aN + dst[j + 2] * aE * (1 - aN)) / outA);
      dst[j + 3] = Math.round(outA * 255);
    }
  }
}

const defaultData = downscale(srcW, srcH, src.data, TRAY_SIZE, TRAY_SIZE);
const alertData = Buffer.from(defaultData); // independent copy

// Red dot: centre (25, 6), radius 5. Sized so the badge reads as a
// discrete alert indicator (10px diameter ≈ 1/3 of the icon) without
// covering the CQ mark. The 1px top/right bleed keeps the dot visible
// at 16x16 fallback on standard-DPI Windows taskbars.
overRed(alertData, TRAY_SIZE, TRAY_SIZE, 25, 6, 5, 232, 20, 20);

const defaultPng = PNG.sync.write({
  width: TRAY_SIZE, height: TRAY_SIZE, data: defaultData,
});
const alertPng = PNG.sync.write({
  width: TRAY_SIZE, height: TRAY_SIZE, data: alertData,
});

fs.writeFileSync(OUT_DEFAULT, defaultPng);
fs.writeFileSync(OUT_ALERT, alertPng);
console.log(`[tray-icons] wrote ${OUT_DEFAULT} (${defaultPng.length} bytes)`);
console.log(`[tray-icons] wrote ${OUT_ALERT} (${alertPng.length} bytes)`);
