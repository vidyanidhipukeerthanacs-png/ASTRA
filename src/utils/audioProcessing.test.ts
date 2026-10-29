import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeAudioDamage,
  reconstructAudioSignal,
  encodeWavBlob,
} from './audioProcessing';

test('analyzeAudioDamage detects silence dropouts and click transients', () => {
  const sampleRate = 8000;
  const length = 8000; // 1 second
  const samples = new Float32Array(length);

  // Generate 440Hz sine wave
  for (let i = 0; i < length; i++) {
    samples[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  }

  // Inject a silent dropout of 40ms (320 samples)
  for (let i = 2000; i < 2320; i++) {
    samples[i] = 0;
  }

  // Inject 2 extreme click spikes
  samples[4000] = 0.98;
  samples[6000] = -0.99;

  const stats = analyzeAudioDamage(samples, sampleRate);
  assert.equal(stats.hasDamage, true);
  assert.ok(stats.dropoutsDetected >= 1, 'Should detect dropout');
  assert.ok(stats.clicksDetected >= 1, 'Should detect click transients');
  assert.ok(stats.totalDropoutDurationMs >= 30, 'Dropout duration matches');
});

test('reconstructAudioSignal fills gap and removes clicks', () => {
  const sampleRate = 8000;
  const length = 4000;
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    samples[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
  }

  // Silence gap
  const gapStart = 1000;
  const gapEnd = 1100;
  for (let i = gapStart; i < gapEnd; i++) {
    samples[i] = 0;
  }

  // Click spike
  samples[2500] = 0.95;

  const repaired = reconstructAudioSignal(samples, sampleRate);

  // The gap should no longer be 0
  let gapEnergy = 0;
  for (let i = gapStart + 20; i < gapEnd - 20; i++) {
    gapEnergy += Math.abs(repaired[i]);
  }
  assert.ok(gapEnergy > 0.1, 'Gap was interpolated with signal energy');

  // Click spike should be smoothed down
  assert.ok(Math.abs(repaired[2500]) < 0.8, 'Click spike was attenuated');
});

test('encodeWavBlob creates valid RIFF/WAVE header', async () => {
  const sampleRate = 16000;
  const samples = new Float32Array(1600);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 0.2;
  }

  const blob = encodeWavBlob(samples, sampleRate);
  assert.equal(blob.type, 'audio/wav');
  assert.ok(blob.size > 44, 'Blob contains audio data');

  const arrayBuffer = await blob.arrayBuffer();
  const view = new DataView(arrayBuffer);
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));

  assert.equal(riff, 'RIFF');
  assert.equal(wave, 'WAVE');
  assert.equal(view.getUint32(24, true), sampleRate);
});
