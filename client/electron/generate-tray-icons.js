// Generates two 16x16 RGBA PNGs (default blue circle + alert variant with a red
// dot in the top-right) and prints them as base64 data URLs. Paste the output
// into main.ts as TRAY_ICON_DATA_URL / TRAY_ICON_ALERT_DATA_URL.
const zlib = require('zlib');

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = (crcTable[(c ^ b) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function makePng(w, h, getPixel) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const j = y * (stride + 1) + 1 + x * 4;
      raw[j] = r; raw[j + 1] = g; raw[j + 2] = b; raw[j + 3] = a;
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Anti-aliased blue solid circle matching the existing TRAY_ICON_DATA_URL style.
function blueCircle(x, y) {
  const dx = x - 7.5, dy = y - 7.5;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= 7) return [0, 0, 0, 0];
  const a = d <= 6 ? 255 : Math.round(255 * (7 - d));
  return [30, 100, 220, a];
}

// Composites a red dot over the existing pixel.
function overRed(r, g, b, a, dotA) {
  if (dotA === 0) return [r, g, b, a];
  const aN = dotA / 255, aE = a / 255;
  const outA = aN + aE * (1 - aN);
  if (outA === 0) return [0, 0, 0, 0];
  return [
    Math.round((232 * aN + r * aE * (1 - aN)) / outA),
    Math.round((20  * aN + g * aE * (1 - aN)) / outA),
    Math.round((20  * aN + b * aE * (1 - aN)) / outA),
    Math.round(outA * 255),
  ];
}

const defaultPng = makePng(16, 16, (x, y) => blueCircle(x, y));
const alertPng = makePng(16, 16, (x, y) => {
  let [r, g, b, a] = blueCircle(x, y);
  // Red dot in top-right corner (centered at 12,3, radius 3.5)
  const rdx = x - 12, rdy = y - 3;
  const rd = Math.sqrt(rdx * rdx + rdy * rdy);
  if (rd < 3.5) {
    const dotA = rd <= 3 ? 255 : Math.round(255 * (3.5 - rd));
    [r, g, b, a] = overRed(r, g, b, a, dotA);
  }
  return [r, g, b, a];
});

console.log('DEFAULT_B64:', defaultPng.toString('base64'));
console.log('ALERT_B64:', alertPng.toString('base64'));
