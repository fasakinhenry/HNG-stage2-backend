/**
 * UUID v7 — time-ordered, no external dependencies.
 * Format: unix_ts_ms (48 bits) | ver (4) | rand_a (12) | var (2) | rand_b (62)
 */
function uuidv7() {
  const now = Date.now();
  const tsMsHex = now.toString(16).padStart(12, "0"); // 48-bit = 12 hex chars

  const randA = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, "0");
  const randB = Math.floor(Math.random() * 0x3fff).toString(16).padStart(4, "0");
  const randC = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
  const randD = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");

  // variant bits: 10xx → starts with 8,9,a,b
  const variantHex = (0x8000 | Math.floor(Math.random() * 0x3fff)).toString(16).padStart(4, "0");

  return [
    tsMsHex.slice(0, 8),          // 8 hex = 32 bits of timestamp
    tsMsHex.slice(8, 12),         // 4 hex = 16 bits of timestamp
    "7" + randA,                  // version 7 + 12 rand bits
    variantHex,                   // variant + rand
    randC + randD.slice(0, 8),    // 48 rand bits
  ].join("-");
}

module.exports = { uuidv7 };
