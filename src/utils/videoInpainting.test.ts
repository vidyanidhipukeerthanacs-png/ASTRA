import test from 'node:test';
import assert from 'node:assert/strict';
import { detectImageDamage } from './damageDetection';
import { inpaintVideoFramesSequence } from './videoReconstruction';

test('detectImageDamage accurately detects black sensor dropout blocks', () => {
  const width = 120;
  const height = 100;
  const totalPixels = width * height;
  const rgba = new Uint8ClampedArray(totalPixels * 4);

  // Fill with space gray / starfield background (RGB 40, 50, 70)
  for (let i = 0; i < totalPixels; i++) {
    rgba[i * 4] = 40;
    rgba[i * 4 + 1] = 50;
    rgba[i * 4 + 2] = 70;
    rgba[i * 4 + 3] = 255;
  }

  // Inject a black sensor dropout block: [30..60, 30..60] (30x30 pixels)
  for (let y = 30; y < 60; y++) {
    for (let x = 30; x < 60; x++) {
      const idx = (y * width + x) * 4;
      rgba[idx] = 0;
      rgba[idx + 1] = 0;
      rgba[idx + 2] = 0;
      rgba[idx + 3] = 255;
    }
  }

  const result = detectImageDamage(width, height, rgba);

  assert.equal(result.hasDamage, true);
  assert.ok(result.damagedPixels >= 30 * 30);
  assert.ok(result.boundingBox !== null);

  // Center of damaged block must be marked as damaged (1)
  const centerIdx = 45 * width + 45;
  assert.equal(result.mask[centerIdx], 1);

  // Far clean pixel must be marked as undamaged (0)
  const cleanIdx = 10 * width + 10;
  assert.equal(result.mask[cleanIdx], 0);
});

test('inpaintVideoFramesSequence reconstructs damaged frames and strictly preserves undamaged pixels', () => {
  const width = 80;
  const height = 60;
  const totalPixels = width * height;

  // Create 3 frames: Frame 0 clean, Frame 1 damaged with black box, Frame 2 clean
  const frame0 = new Uint8ClampedArray(totalPixels * 4);
  const frame1 = new Uint8ClampedArray(totalPixels * 4);
  const frame2 = new Uint8ClampedArray(totalPixels * 4);

  for (let i = 0; i < totalPixels; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    // Gradient celestial pattern
    const r = Math.min(240, 40 + x * 2);
    const g = Math.min(240, 60 + y * 2);
    const b = 120;

    frame0[i * 4] = r;
    frame0[i * 4 + 1] = g;
    frame0[i * 4 + 2] = b;
    frame0[i * 4 + 3] = 255;

    frame1[i * 4] = r;
    frame1[i * 4 + 1] = g;
    frame1[i * 4 + 2] = b;
    frame1[i * 4 + 3] = 255;

    frame2[i * 4] = r;
    frame2[i * 4 + 1] = g;
    frame2[i * 4 + 2] = b;
    frame2[i * 4 + 3] = 255;
  }

  // Inject black dropout block into Frame 1 [20..40, 20..40]
  for (let y = 20; y < 40; y++) {
    for (let x = 20; x < 40; x++) {
      const idx = (y * width + x) * 4;
      frame1[idx] = 0;
      frame1[idx + 1] = 0;
      frame1[idx + 2] = 0;
    }
  }

  const d0 = detectImageDamage(width, height, frame0);
  const d1 = detectImageDamage(width, height, frame1);
  const d2 = detectImageDamage(width, height, frame2);

  assert.equal(d1.hasDamage, true);

  const restored = inpaintVideoFramesSequence([frame0, frame1, frame2], [d0, d1, d2], width, height);

  assert.equal(restored.length, 3);
  const restoredFrame1 = restored[1];

  // 1. Damaged region in center (30, 30) MUST be reconstructed and not black (0,0,0)
  const centerP = (30 * width + 30) * 4;
  const centerR = restoredFrame1[centerP];
  const centerG = restoredFrame1[centerP + 1];
  const centerB = restoredFrame1[centerP + 2];
  assert.ok(centerR > 15 || centerG > 15 || centerB > 15, 'Center of damaged region was not reconstructed!');

  // 2. 100% preservation of undamaged pixels outside the mask
  let identicalCount = 0;
  let cleanTotal = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (d1.mask[i] === 0) {
      cleanTotal++;
      const p = i * 4;
      if (
        restoredFrame1[p] === frame1[p] &&
        restoredFrame1[p + 1] === frame1[p + 1] &&
        restoredFrame1[p + 2] === frame1[p + 2]
      ) {
        identicalCount++;
      }
    }
  }

  assert.equal(identicalCount, cleanTotal, 'Undamaged pixels were altered!');
});

test('inpaintVideoFramesSequence performs spatial inpainting when all frames are damaged', () => {
  const width = 60;
  const height = 50;
  const totalPixels = width * height;

  const f0 = new Uint8ClampedArray(totalPixels * 4);
  const f1 = new Uint8ClampedArray(totalPixels * 4);

  // Fill with lunar surface gray (100, 100, 110)
  for (let i = 0; i < totalPixels; i++) {
    f0[i * 4] = 100;
    f0[i * 4 + 1] = 100;
    f0[i * 4 + 2] = 110;
    f0[i * 4 + 3] = 255;

    f1[i * 4] = 100;
    f1[i * 4 + 1] = 100;
    f1[i * 4 + 2] = 110;
    f1[i * 4 + 3] = 255;
  }

  // Inject black block in both frames [15..35, 15..35]
  for (let y = 15; y < 35; y++) {
    for (let x = 15; x < 35; x++) {
      const idx = (y * width + x) * 4;
      f0[idx] = 0;
      f0[idx + 1] = 0;
      f0[idx + 2] = 0;

      f1[idx] = 0;
      f1[idx + 1] = 0;
      f1[idx + 2] = 0;
    }
  }

  const d0 = detectImageDamage(width, height, f0);
  const d1 = detectImageDamage(width, height, f1);

  const restored = inpaintVideoFramesSequence([f0, f1], [d0, d1], width, height);

  // Even though both frames were damaged, the center must be filled with boundary gray context
  const testCenterP = (25 * width + 25) * 4;
  assert.ok(restored[0][testCenterP] > 20, 'Spatial inpainting failed to fill black block');
  assert.ok(restored[1][testCenterP] > 20, 'Spatial inpainting failed to fill black block in frame 1');
});
