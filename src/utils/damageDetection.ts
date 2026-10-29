/**
 * Automatic Damage Detection & Mask Processing for Space Data
 * Distinguishes telemetry dropouts, sensor dead zones, cosmic ray streaks,
 * and transmission lines from natural astronomical background.
 */

export interface DamageMaskResult {
  mask: Uint8Array; // 1 = damaged (to fill), 0 = keep (dilated by 6px)
  rawMask?: Uint8Array; // 1 = un-dilated core damaged pixels
  width: number;
  height: number;
  damagedPixels: number;
  totalPixels: number;
  damagedAreaPercent: number;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number } | null;
  hasDamage: boolean;
}

/**
 * Checks if a pixel is near pure black (RGB <= 12) or pure white (RGB >= 245)
 */
export function isExtremePixel(r: number, g: number, b: number): 'black' | 'white' | null {
  if (r <= 12 && g <= 12 && b <= 12) return 'black';
  if (r >= 245 && g >= 245 && b >= 245) return 'white';
  return null;
}

/**
 * Detect damage in an image buffer.
 * Rules:
 * - Filled black (<=12) or white (>=245) blocks up to 60% of image.
 * - Horizontal/vertical telemetry corruption lines and scratches.
 * - Corrupted patches and smeared streaks.
 * - Natural deep space (ambient dark sky) is preserved, not flagged as damage.
 */
export function detectImageDamage(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array
): DamageMaskResult {
  const totalPixels = width * height;
  const rawMask = new Uint8Array(totalPixels);

  // 1. Mark extreme candidate pixels
  const isCandidate = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    if (isExtremePixel(r, g, b)) {
      isCandidate[i] = 1;
    }
  }

  // 2. Detect telemetry scanlines (horizontal and vertical lines of extreme pixels)
  // Space telemetry often drops 1-4 scan lines across rows or columns
  for (let y = 0; y < height; y++) {
    let runStart = -1;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isCandidate[idx]) {
        if (runStart === -1) runStart = x;
      } else {
        if (runStart !== -1) {
          const runLength = x - runStart;
          // A horizontal streak of extreme pixels >= 15px or >= 20% width
          if (runLength >= 15 || runLength >= width * 0.2) {
            for (let rx = runStart; rx < x; rx++) {
              rawMask[y * width + rx] = 1;
            }
          }
          runStart = -1;
        }
      }
    }
    if (runStart !== -1 && (width - runStart >= 15 || width - runStart >= width * 0.2)) {
      for (let rx = runStart; rx < width; rx++) {
        rawMask[y * width + rx] = 1;
      }
    }
  }

  // Detect vertical drop lines
  for (let x = 0; x < width; x++) {
    let runStart = -1;
    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      if (isCandidate[idx]) {
        if (runStart === -1) runStart = y;
      } else {
        if (runStart !== -1) {
          const runLength = y - runStart;
          if (runLength >= 15 || runLength >= height * 0.2) {
            for (let ry = runStart; ry < y; ry++) {
              rawMask[ry * width + x] = 1;
            }
          }
          runStart = -1;
        }
      }
    }
    if (runStart !== -1 && (height - runStart >= 15 || height - runStart >= height * 0.2)) {
      for (let ry = runStart; ry < height; ry++) {
        rawMask[ry * width + x] = 1;
      }
    }
  }

  // 3. Connected Component Analysis for blocks and patches
  // Flood-fill connected regions of candidates
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    if (!isCandidate[i] || visited[i]) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;

    let minX = i % width;
    let maxX = minX;
    let minY = Math.floor(i / width);
    let maxY = minY;
    let componentSize = 0;
    let touchesBorder = false;

    while (head < tail) {
      const curr = queue[head++];
      componentSize++;
      const cx = curr % width;
      const cy = Math.floor(curr / width);

      if (cx === 0 || cx === width - 1 || cy === 0 || cy === height - 1) {
        touchesBorder = true;
      }

      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      // 4-connected neighbors
      const neighbors = [
        cy > 0 ? curr - width : -1,
        cy < height - 1 ? curr + width : -1,
        cx > 0 ? curr - 1 : -1,
        cx < width - 1 ? curr + 1 : -1,
      ];

      for (const n of neighbors) {
        if (n >= 0 && !visited[n] && isCandidate[n]) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const boxArea = boxWidth * boxHeight;
    const density = componentSize / boxArea;
    const isWhite = rgba[i * 4] >= 240;

    // Distinguish natural space from black damage:
    // Natural dark space is vast, low-density around celestial objects, or dominates border.
    // If black and component occupies more than 60% of entire image, it is the space background!
    const isTooLarge = componentSize > totalPixels * 0.6;

    // Sensor dropouts and telemetry missing blocks:
    // Have high rectangular density (compact blocks or sensor grids) OR are isolated sharp blocks
    const isCompactBlock = density >= 0.45 && componentSize >= 16;
    const isStreakOrLine = (boxWidth >= 12 && boxHeight <= 6) || (boxHeight >= 12 && boxWidth <= 6);
    const isMediumPatch = componentSize >= 20 && componentSize <= totalPixels * 0.5;

    // Natural space background: if black, touches borders broadly, and is diffuse (density < 0.35)
    // or covers huge area, it is astronomical sky.
    const isNaturalSky = !isWhite && touchesBorder && (density < 0.4 || componentSize > totalPixels * 0.5);

    if (!isTooLarge && !isNaturalSky && (isCompactBlock || isStreakOrLine || isMediumPatch || isWhite)) {
      for (let k = 0; k < tail; k++) {
        rawMask[queue[k]] = 1;
      }
    }
  }

  // 4. Morphological Dilation by 6 px as specified in requirements
  const dilatedMask = dilateMask(rawMask, width, height, 6);

  // 5. Compute bounding box and stats
  let damagedPixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (dilatedMask[y * width + x] === 1) {
        damagedPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const hasDamage = damagedPixels > 0 && maxX >= minX && maxY >= minY;
  const damagedAreaPercent = Number(((damagedPixels / totalPixels) * 100).toFixed(2));

  return {
    mask: dilatedMask,
    rawMask,
    width,
    height,
    damagedPixels,
    totalPixels,
    damagedAreaPercent,
    boundingBox: hasDamage ? { minX, minY, maxX, maxY } : null,
    hasDamage,
  };
}

/**
 * Dilates a binary mask by a given radius in pixels using Manhattan/Chebyshev distance
 */
export function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number = 6
): Uint8Array {
  const result = new Uint8Array(width * height);
  const r2 = radius * radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 1) {
        // Expand circle of radius
        const yMin = Math.max(0, y - radius);
        const yMax = Math.min(height - 1, y + radius);
        const xMin = Math.max(0, x - radius);
        const xMax = Math.min(width - 1, x + radius);

        for (let dy = yMin; dy <= yMax; dy++) {
          const yDist = (dy - y) * (dy - y);
          for (let dx = xMin; dx <= xMax; dx++) {
            if (yDist + (dx - x) * (dx - x) <= r2) {
              result[dy * width + dx] = 1;
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Creates a feathered alpha mask with a 3px smooth transition at boundaries
 */
export function createFeatheredMask(
  mask: Uint8Array,
  width: number,
  height: number,
  featherRadius: number = 3
): Float32Array {
  const feathered = new Float32Array(width * height);
  if (featherRadius <= 0) {
    for (let i = 0; i < mask.length; i++) feathered[i] = mask[i];
    return feathered;
  }

  // Distance from inside pixel to nearest mask=0 pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0) {
        feathered[idx] = 0;
        continue;
      }

      // Check distance to boundary within featherRadius window
      let minDistance = featherRadius;
      const yMin = Math.max(0, y - featherRadius);
      const yMax = Math.min(height - 1, y + featherRadius);
      const xMin = Math.max(0, x - featherRadius);
      const xMax = Math.min(width - 1, x + featherRadius);

      for (let ny = yMin; ny <= yMax; ny++) {
        for (let nx = xMin; nx <= xMax; nx++) {
          if (mask[ny * width + nx] === 0) {
            const dist = Math.hypot(x - nx, y - ny);
            if (dist < minDistance) {
              minDistance = dist;
            }
          }
        }
      }

      // If comfortably inside, weight = 1.0; near edge, smooth sigmoid/linear ramp
      const t = minDistance / featherRadius;
      feathered[idx] = Math.max(0.0, Math.min(1.0, t * t * (3 - 2 * t))); // Smoothstep
    }
  }

  return feathered;
}

/**
 * Verifies if inpainting succeeded:
 * "Verify: if more than 5% of the masked pixels are still near-black or unchanged, run LaMa once more;
 * if it still fails, show the real error text and a Retry button. Never show a partly filled image as the result."
 */
export function verifyInpaintingResult(
  originalRgba: Uint8ClampedArray | Uint8Array,
  resultRgba: Uint8ClampedArray | Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
  rawMask?: Uint8Array
): { passed: boolean; failedPercent: number; reason?: string } {
  let maskedPixelCount = 0;
  let failedPixelCount = 0;

  // Use rawMask if available to test the true damaged locations, otherwise filter for pixels with extreme values
  const checkMask = rawMask || mask;

  for (let i = 0; i < checkMask.length; i++) {
    if (checkMask[i] === 1) {
      const idx = i * 4;
      const origR = originalRgba[idx];
      const origG = originalRgba[idx + 1];
      const origB = originalRgba[idx + 2];

      // If evaluating without rawMask, only check pixels that were initially corrupted
      if (!rawMask && !isExtremePixel(origR, origG, origB)) {
        continue;
      }

      maskedPixelCount++;
      const r = resultRgba[idx];
      const g = resultRgba[idx + 1];
      const b = resultRgba[idx + 2];

      const wasBlack = origR <= 12 && origG <= 12 && origB <= 12;

      // Check if still unchanged from damaged original
      const isUnchanged = Math.abs(r - origR) < 3 && Math.abs(g - origG) < 3 && Math.abs(b - origB) < 3;
      // Or black damage remained unfilled near-black
      const isStillNearBlack = wasBlack && (r <= 12 && g <= 12 && b <= 12);
      // Or corrupted pixel became empty black (<= 2)
      const isZeroOutput = r <= 2 && g <= 2 && b <= 2 && !wasBlack;

      if (isUnchanged || isStillNearBlack || isZeroOutput) {
        failedPixelCount++;
      }
    }
  }

  if (maskedPixelCount === 0) {
    return { passed: true, failedPercent: 0 };
  }

  const failedPercent = (failedPixelCount / maskedPixelCount) * 100;
  if (failedPercent > 5.0) {
    return {
      passed: false,
      failedPercent: Number(failedPercent.toFixed(2)),
      reason: `${failedPercent.toFixed(1)}% of repaired pixels remained incomplete or near-black (threshold: 5.0%).`,
    };
  }

  return { passed: true, failedPercent: Number(failedPercent.toFixed(2)) };
}
