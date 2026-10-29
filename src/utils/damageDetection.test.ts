import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isExtremePixel,
  dilateMask,
  createFeatheredMask,
  detectImageDamage,
  verifyInpaintingResult,
} from './damageDetection';

test('isExtremePixel accurately flags black and white dropouts', () => {
  assert.equal(isExtremePixel(5, 8, 10), 'black');
  assert.equal(isExtremePixel(12, 12, 12), 'black');
  assert.equal(isExtremePixel(13, 10, 10), null);
  assert.equal(isExtremePixel(250, 248, 255), 'white');
  assert.equal(isExtremePixel(240, 245, 245), null);
  assert.equal(isExtremePixel(128, 128, 128), null);
});

test('dilateMask expands damaged region by requested radius', () => {
  const width = 20;
  const height = 20;
  const mask = new Uint8Array(width * height);
  // Single damaged pixel in center (10, 10)
  mask[10 * width + 10] = 1;

  const dilated = dilateMask(mask, width, height, 6);
  assert.equal(dilated[10 * width + 10], 1);
  // (10, 16) is exactly distance 6
  assert.equal(dilated[10 * width + 16], 1);
  // (10, 4) is distance 6
  assert.equal(dilated[10 * width + 4], 1);
  // (10, 17) is distance 7 -> 0
  assert.equal(dilated[10 * width + 17], 0);
});

test('createFeatheredMask produces smooth gradient at boundaries', () => {
  const width = 10;
  const height = 10;
  const mask = new Uint8Array(width * height);
  for (let y = 3; y <= 7; y++) {
    for (let x = 3; x <= 7; x++) {
      mask[y * width + x] = 1;
    }
  }

  const feathered = createFeatheredMask(mask, width, height, 3);
  // Center is high weight
  assert.ok(feathered[5 * width + 5] > 0.8);
  // Boundary pixel (3, 5) is inside mask but near the edge, so has intermediate feather weight
  assert.ok(feathered[5 * width + 3] > 0.0 && feathered[5 * width + 3] < 0.9);
  // Outside mask (2, 5) must be 0 to keep pixels outside mask untouched
  assert.equal(feathered[5 * width + 2], 0);
});

test('detectImageDamage finds rectangular sensor dropout block', () => {
  const width = 40;
  const height = 40;
  const rgba = new Uint8ClampedArray(width * height * 4);

  // Fill with space nebula background (RGB 40, 60, 90)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = 40;
    rgba[i * 4 + 1] = 60;
    rgba[i * 4 + 2] = 90;
    rgba[i * 4 + 3] = 255;
  }

  // Inject a 10x10 dead sensor black dropout (RGB 0, 0, 0) in center
  for (let y = 15; y < 25; y++) {
    for (let x = 15; x < 25; x++) {
      const idx = (y * width + x) * 4;
      rgba[idx] = 0;
      rgba[idx + 1] = 0;
      rgba[idx + 2] = 0;
    }
  }

  const result = detectImageDamage(width, height, rgba);
  assert.equal(result.hasDamage, true);
  assert.ok(result.damagedAreaPercent > 0);
  assert.ok(result.boundingBox !== null);
  assert.ok(result.boundingBox.minX <= 15);
  assert.ok(result.boundingBox.maxX >= 24);
});

test('verifyInpaintingResult detects when repair failed', () => {
  const width = 10;
  const height = 10;
  const orig = new Uint8ClampedArray(width * height * 4);
  const result = new Uint8ClampedArray(width * height * 4);
  const mask = new Uint8Array(width * height);

  // 10 pixels damaged
  for (let i = 0; i < 10; i++) {
    mask[i] = 1;
    // result is still pure black
    result[i * 4] = 0;
    result[i * 4 + 1] = 0;
    result[i * 4 + 2] = 0;
  }

  const check = verifyInpaintingResult(orig, result, mask, width, height);
  assert.equal(check.passed, false);
  assert.ok(check.failedPercent > 5);

  // Now fix result with valid repaired pixels
  for (let i = 0; i < 10; i++) {
    result[i * 4] = 140;
    result[i * 4 + 1] = 150;
    result[i * 4 + 2] = 160;
  }
  const check2 = verifyInpaintingResult(orig, result, mask, width, height);
  assert.equal(check2.passed, true);
  assert.equal(check2.failedPercent, 0);
});

import { isValidOnnxModelBuffer } from './lamaModel';

test('isValidOnnxModelBuffer rejects small buffers, HTML, and validates real protobuf tags', () => {
  // Empty or null
  assert.equal(isValidOnnxModelBuffer(null), false);
  assert.equal(isValidOnnxModelBuffer(new ArrayBuffer(100)), false);

  // HTML error response (< 1000 bytes starting with '<')
  const htmlBuf = new TextEncoder().encode('<!DOCTYPE html><html><body>Error 404</body></html>');
  assert.equal(isValidOnnxModelBuffer(htmlBuf.buffer), false);

  // Large buffer (>= 180MB) with valid tag 0x08
  const validHeader = new Uint8Array(185 * 1024 * 1024);
  validHeader[0] = 0x08;
  assert.equal(isValidOnnxModelBuffer(validHeader.buffer), true);

  // Large buffer starting with '<' (e.g. large HTML error)
  const invalidHtmlLarge = new Uint8Array(185 * 1024 * 1024);
  invalidHtmlLarge[0] = 0x3c;
  assert.equal(isValidOnnxModelBuffer(invalidHtmlLarge.buffer), false);
});
