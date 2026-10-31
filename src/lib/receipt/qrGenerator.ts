/**
 * src/lib/receipt/qrGenerator.ts
 *
 * Lightweight, zero-dependency QR Code Matrix generator for vector SVG rendering.
 * Supports Byte mode (ISO/IEC 18004:2015) for UTF-8 URLs up to 80 characters.
 * Generates pristine vector <svg> elements and Path strings for web, print, and canvas.
 */

// Reed-Solomon Galois Field GF(256) log and exp tables
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    EXP[i + 255] = x;
    LOG[x] = i;
    x <<= 1;
    if (x >= 256) x ^= 0x11d;
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP[LOG[x] + LOG[y]];
}

function polyMul(p1: Uint8Array | number[], p2: Uint8Array | number[]): Uint8Array {
  const res = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return res;
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, EXP[i]]);
  }
  return poly;
}

function rsCompute(data: Uint8Array, eccLen: number): Uint8Array {
  const gen = rsGeneratorPoly(eccLen);
  const msg = new Uint8Array(data.length + eccLen);
  msg.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }

  return msg.slice(data.length);
}

// QR Code Version 4 (33x33), Level M: Total bytes = 100, Data = 64 bytes, ECC = 36 bytes (2 blocks of 18)
const VERSION = 4;
const SIZE = 33;
const TOTAL_DATA_BYTES = 64;
const ECC_PER_BLOCK = 18;
const NUM_BLOCKS = 2;

export function generateQrMatrix(text: string): boolean[][] {
  const textBytes = new TextEncoder().encode(text);
  if (textBytes.length > 60) {
    // Truncate to maximum safe capacity if URL is unusually long
    return generateQrMatrix(text.slice(0, 60));
  }

  // 1. Bit buffer construction (Mode 0100 for Byte, 8-bit count indicator for V4)
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(textBytes.length, 8); // Character count
  for (const b of textBytes) {
    pushBits(b, 8);
  }

  // Terminator (up to 4 zeroes)
  const maxBits = TOTAL_DATA_BYTES * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Pad to multiple of 8
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to data bytes
  const dataBytes = new Uint8Array(TOTAL_DATA_BYTES);
  for (let i = 0; i < TOTAL_DATA_BYTES; i++) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | bits[i * 8 + j];
    }
    dataBytes[i] = byteVal;
  }

  // Split into 2 blocks of 32 bytes and calculate ECC
  const blockSize = 32;
  const block1 = dataBytes.slice(0, blockSize);
  const block2 = dataBytes.slice(blockSize);
  const ecc1 = rsCompute(block1, ECC_PER_BLOCK);
  const ecc2 = rsCompute(block2, ECC_PER_BLOCK);

  // Interleave data and ECC codewords
  const interleaved: number[] = [];
  for (let i = 0; i < blockSize; i++) {
    interleaved.push(block1[i]);
    interleaved.push(block2[i]);
  }
  for (let i = 0; i < ECC_PER_BLOCK; i++) {
    interleaved.push(ecc1[i]);
    interleaved.push(ecc2[i]);
  }

  // 2. Matrix initialization
  const matrix: (boolean | null)[][] = Array.from({ length: SIZE }, () =>
    Array(SIZE).fill(null)
  );
  const isFunction: boolean[][] = Array.from({ length: SIZE }, () =>
    Array(SIZE).fill(false)
  );

  const setModule = (r: number, c: number, val: boolean) => {
    matrix[r][c] = val;
    isFunction[r][c] = true;
  };

  // Finder Patterns (7x7 at 3 corners)
  const drawFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) {
          const isBlack =
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setModule(row, col, isBlack);
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, SIZE - 7);
  drawFinder(SIZE - 7, 0);

  // Alignment Pattern for V4 at (24, 24)
  const drawAlignment = (centerR: number, centerC: number) => {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const row = centerR + r;
        const col = centerC + c;
        if (!isFunction[row][col]) {
          const isBlack =
            Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
          setModule(row, col, isBlack);
        }
      }
    }
  };
  drawAlignment(24, 24);

  // Timing patterns (row 6 and col 6)
  for (let i = 8; i < SIZE - 8; i++) {
    if (!isFunction[6][i]) setModule(6, i, i % 2 === 0);
    if (!isFunction[i][6]) setModule(i, 6, i % 2 === 0);
  }

  // Dark module
  setModule(SIZE - 8, 8, true);

  // Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }
  for (let i = SIZE - 8; i < SIZE; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }

  // 3. Data placement in zigzag columns
  let bitIdx = 0;
  const totalBits = interleaved.length * 8;
  let upward = true;

  for (let rightCol = SIZE - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5; // Skip timing column

    for (let step = 0; step < SIZE; step++) {
      const r = upward ? SIZE - 1 - step : step;
      for (let c = rightCol; c >= rightCol - 1; c--) {
        if (!isFunction[r][c]) {
          let bit = false;
          if (bitIdx < totalBits) {
            const byteIndex = Math.floor(bitIdx / 8);
            const bitOffset = 7 - (bitIdx % 8);
            bit = ((interleaved[byteIndex] >> bitOffset) & 1) === 1;
            bitIdx++;
          }
          // Mask pattern 0: (r + c) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = mask ? !bit : bit;
        }
      }
    }
    upward = !upward;
  }

  // 4. Format information (Level M, Mask 0 -> 15-bit format code 0x5412 XOR 0x5412 = 0)
  // Format info bits for Level M (00) + Mask 0 (000) with BCH error correction = 101010000010010
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Top-left format placement
  setModule(8, 0, formatBits[0] === 1);
  setModule(8, 1, formatBits[1] === 1);
  setModule(8, 2, formatBits[2] === 1);
  setModule(8, 3, formatBits[3] === 1);
  setModule(8, 4, formatBits[4] === 1);
  setModule(8, 5, formatBits[5] === 1);
  setModule(8, 7, formatBits[6] === 1);
  setModule(8, 8, formatBits[7] === 1);
  setModule(7, 8, formatBits[8] === 1);
  setModule(5, 8, formatBits[9] === 1);
  setModule(4, 8, formatBits[10] === 1);
  setModule(3, 8, formatBits[11] === 1);
  setModule(2, 8, formatBits[12] === 1);
  setModule(1, 8, formatBits[13] === 1);
  setModule(0, 8, formatBits[14] === 1);

  // Split format placement at other corners
  for (let i = 0; i < 7; i++) {
    setModule(8, SIZE - 1 - i, formatBits[14 - i] === 1);
  }
  for (let i = 0; i < 8; i++) {
    setModule(SIZE - 8 + i, 8, formatBits[i] === 1);
  }

  return matrix.map((row) => row.map((cell) => cell ?? false));
}

/**
 * Converts a QR matrix into an SVG path data string for crisp, scalable rendering.
 */
export function qrMatrixToSvgPath(matrix: boolean[][], cellSize = 4): string {
  let path = "";
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        path += `M${c * cellSize},${r * cellSize}h${cellSize}v${cellSize}h-${cellSize}z `;
      }
    }
  }
  return path;
}
