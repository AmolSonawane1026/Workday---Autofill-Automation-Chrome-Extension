import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(size) {
  const width = size;
  const height = size;
  
  // Create RGBA raw buffer
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  
  const bgR = 37, bgG = 99, bgB = 235; // #2563eb royal blue
  const fgR = 255, fgG = 255, fgB = 255; // White #ffffff
  
  const cornerRadius = size * 0.22;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      // Check rounded corner distance
      let isInside = true;
      let alpha = 255;

      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);

      if (dx < cornerRadius && dy < cornerRadius) {
        const dist = Math.hypot(cornerRadius - dx, cornerRadius - dy);
        if (dist > cornerRadius) {
          alpha = 0;
          isInside = false;
        }
      }

      if (!isInside || alpha === 0) {
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        continue;
      }

      // Draw "W" character representation in the middle
      // Normalized coordinates (0.0 to 1.0)
      const nx = x / width;
      const ny = y / height;

      // Clean geometry for 'W'
      let isW = false;
      const wTop = 0.28;
      const wBottom = 0.72;
      const thickness = Math.max(0.08, 1.5 / size);

      if (ny >= wTop && ny <= wBottom) {
        const relY = (ny - wTop) / (wBottom - wTop); // 0 at top, 1 at bottom
        
        // Left stroke \: from x=0.25 to x=0.38
        const x1 = 0.24 + relY * 0.12;
        // Mid-left stroke /: from x=0.36 to x=0.50
        const x2 = 0.48 - (1 - relY) * 0.12;
        // Mid-right stroke \: from x=0.50 to x=0.64
        const x3 = 0.52 + (1 - relY) * 0.12;
        // Right stroke /: from x=0.62 to x=0.76
        const x4 = 0.76 - relY * 0.12;

        if (Math.abs(nx - x1) < thickness ||
            Math.abs(nx - x2) < thickness ||
            Math.abs(nx - x3) < thickness ||
            Math.abs(nx - x4) < thickness) {
          isW = true;
        }
      }

      if (isW) {
        rawData[offset++] = fgR;
        rawData[offset++] = fgG;
        rawData[offset++] = fgB;
        rawData[offset++] = 255;
      } else {
        rawData[offset++] = bgR;
        rawData[offset++] = bgG;
        rawData[offset++] = bgB;
        rawData[offset++] = 255;
      }
    }
  }

  // Deflate image data
  const compressed = zlib.deflateSync(rawData);

  // Build PNG chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression: 0
  ihdr[11] = 0; // Filter: 0
  ihdr[12] = 0; // Interlace: 0

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(len + 12);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, len + 8));
  chunk.writeUInt32BE(crc, len + 8);
  return chunk;
}

// CRC32 table & calculation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const targetDirs = [
  path.resolve('./public/icons'),
  path.resolve('./dist/icons')
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  [16, 32, 48, 128].forEach(size => {
    const pngBuf = createPNG(size);
    fs.writeFileSync(path.join(dir, `icon${size}.png`), pngBuf);
  });
}

console.log('✅ Professional Blue Workday "W" icons generated in public/icons and dist/icons');
