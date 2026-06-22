// Генератор иконки приложения без внешних зависимостей: рисует мотив «весы
// общественного мнения» (зелёная чаша = поддержка, красная = против, на синем
// коромысле) и кодирует PNG через встроенный zlib.
// Запуск: node mobile/scripts/make-icon.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const S = 1024;
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../assets');

function canvas() {
  return new Uint8Array(S * S * 4); // RGBA, прозрачный
}
function px(buf, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  const af = a / 255;
  const ba = buf[i + 3] / 255;
  const oa = af + ba * (1 - af);
  if (oa === 0) return;
  buf[i] = (r * af + buf[i] * ba * (1 - af)) / oa;
  buf[i + 1] = (g * af + buf[i + 1] * ba * (1 - af)) / oa;
  buf[i + 2] = (b * af + buf[i + 2] * ba * (1 - af)) / oa;
  buf[i + 3] = oa * 255;
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), h.length > 7 ? parseInt(h.slice(7, 9), 16) : 255];

function fillRect(buf, x0, y0, w, h, c, r = 0) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (r > 0) {
        const dx = Math.min(x - x0, x0 + w - 1 - x);
        const dy = Math.min(y - y0, y0 + h - 1 - y);
        if (dx < r && dy < r) {
          const d = Math.hypot(r - dx, r - dy);
          if (d > r) continue;
          if (d > r - 1.5) { px(buf, x, y, [c[0], c[1], c[2], (c[3] ?? 255) * (r - d) / 1.5]); continue; }
        }
      }
      px(buf, x, y, c);
    }
}
function fillCircle(buf, cx, cy, rad, c) {
  for (let y = cy - rad; y <= cy + rad; y++)
    for (let x = cx - rad; x <= cx + rad; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rad) px(buf, x, y, d > rad - 1.5 ? [c[0], c[1], c[2], (c[3] ?? 255) * (rad - d) / 1.5] : c);
    }
}
// нижняя половина эллипса — «чаша весов»
function bowl(buf, cx, cy, rx, ry, c) {
  for (let y = cy; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d <= 1) px(buf, x, y, d > 0.9 ? [c[0], c[1], c[2], (c[3] ?? 255) * (1 - d) / 0.1] : c);
    }
}
function thickLine(buf, x0, y0, x1, y1, w, c) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    fillCircle(buf, Math.round(x), Math.round(y), w / 2, c);
  }
}

function drawMotif(buf) {
  const cx = S / 2;
  const slate = hex('#e2e8f0');
  const accent = hex('#60a5fa');
  const green = hex('#34d399');
  const red = hex('#f87171');

  // стойка и основание
  fillRect(buf, cx - 18, 330, 36, 400, slate, 14);
  fillRect(buf, cx - 110, 716, 220, 34, slate, 16);
  fillRect(buf, cx - 150, 748, 300, 26, slate, 12);
  // верхний узел
  fillCircle(buf, cx, 330, 26, accent);
  // коромысло (горизонтальное — равновесие)
  fillRect(buf, cx - 250, 352, 500, 26, accent, 13);
  fillCircle(buf, cx - 250, 365, 16, accent);
  fillCircle(buf, cx + 250, 365, 16, accent);
  // подвесы
  thickLine(buf, cx - 250, 372, cx - 250, 470, 7, hex('#94a3b8'));
  thickLine(buf, cx + 250, 372, cx + 250, 470, 7, hex('#94a3b8'));
  thickLine(buf, cx - 250, 470, cx - 322, 486, 5, hex('#94a3b8'));
  thickLine(buf, cx - 250, 470, cx - 178, 486, 5, hex('#94a3b8'));
  thickLine(buf, cx + 250, 470, cx + 322, 486, 5, hex('#94a3b8'));
  thickLine(buf, cx + 250, 470, cx + 178, 486, 5, hex('#94a3b8'));
  // чаши: зелёная (поддержка) и красная (против)
  bowl(buf, cx - 250, 486, 80, 54, green);
  bowl(buf, cx + 250, 486, 80, 54, red);
}

function radialGlow(buf, cx, cy, rad, c) {
  for (let y = cy - rad; y <= cy + rad; y++)
    for (let x = cx - rad; x <= cx + rad; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rad) px(buf, x, y, [c[0], c[1], c[2], (c[3] ?? 255) * (1 - d / rad)]);
    }
}

function encodePng(buf) {
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0; // filter none
    Buffer.from(buf.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const chunks = [];
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0);
    chunks.push(len, t, data, crc);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunk('IHDR', ihdr);
  chunk('IDAT', idat);
  chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); return c ^ 0xffffffff; }

// --- icon.png: тёмный фон + сияние + мотив ---
const icon = canvas();
fillRect(icon, 0, 0, S, S, hex('#0b1120'));
for (let y = 0; y < S; y++) fillRect(icon, 0, y, S, 1, hex('#111a2e' + Math.round((y / S) * 90).toString(16).padStart(2, '0')));
radialGlow(icon, S / 2, 470, 520, hex('#1d4ed833'));
drawMotif(icon);
writeFileSync(resolve(OUT, 'icon.png'), encodePng(icon));

// --- adaptive-foreground.png: прозрачный фон, мотив в безопасной зоне ---
const fg = canvas();
radialGlow(fg, S / 2, 470, 360, hex('#1d4ed822'));
drawMotif(fg);
writeFileSync(resolve(OUT, 'adaptive-foreground.png'), encodePng(fg));

// --- splash-icon.png: то же, что иконка ---
writeFileSync(resolve(OUT, 'splash-icon.png'), encodePng(icon));

console.log('Иконки записаны в', OUT, ': icon.png, adaptive-foreground.png, splash-icon.png');
