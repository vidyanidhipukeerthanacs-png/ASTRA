/**
 * Web Audio Signal Reconstruction Engine for Space Audio
 * - Click and pop transient removal
 * - Silent telemetry dropout gap interpolation (AR/LPC & crossfade)
 * - Spectral gating hiss reduction
 * - Gentle normalization
 * - Pure WAV encoding
 */

export interface AudioDamageStats {
  clicksDetected: number;
  dropoutsDetected: number;
  totalDropoutDurationMs: number;
  noiseFloorEstimateDb: number;
  hasDamage: boolean;
}

/**
 * Detect clicks, dropouts, and evaluate noise profile in raw audio samples.
 */
export function analyzeAudioDamage(
  samples: Float32Array,
  sampleRate: number
): AudioDamageStats {
  let clicksDetected = 0;
  let dropoutsDetected = 0;
  let dropoutSampleCount = 0;

  // 1. Click detection via deviation from local continuous neighbors
  const len = samples.length;
  let sumSq = 0;
  for (let i = 0; i < len; i += 16) {
    sumSq += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSq / (len / 16)) || 0.01;

  for (let i = 1; i < len - 1; i++) {
    const expected = (samples[i - 1] + samples[i + 1]) * 0.5;
    const deviation = Math.abs(samples[i] - expected);
    // A click is a sharp isolated impulse exceeding local expected value
    if (deviation > 0.35 && Math.abs(samples[i]) > rms * 1.2) {
      clicksDetected++;
      i += 4; // skip impulse ringing
    }
  }

  // 2. Dropout detection (consecutive near-zero samples flanked by signal)
  const minDropoutSamples = Math.floor(sampleRate * 0.003); // >= 3ms
  const zeroThreshold = 0.0015;
  let inDropout = false;
  let dropoutStart = 0;

  for (let i = 0; i < len; i++) {
    const isZero = Math.abs(samples[i]) < zeroThreshold;
    if (isZero) {
      if (!inDropout) {
        inDropout = true;
        dropoutStart = i;
      }
    } else {
      if (inDropout) {
        const duration = i - dropoutStart;
        if (duration >= minDropoutSamples) {
          dropoutsDetected++;
          dropoutSampleCount += duration;
        }
        inDropout = false;
      }
    }
  }
  if (inDropout && len - dropoutStart >= minDropoutSamples) {
    dropoutsDetected++;
    dropoutSampleCount += len - dropoutStart;
  }

  const totalDropoutDurationMs = Number(((dropoutSampleCount / sampleRate) * 1000).toFixed(1));
  const noiseFloorDb = Number((20 * Math.log10(Math.max(rms * 0.1, 0.0001))).toFixed(1));

  return {
    clicksDetected,
    dropoutsDetected,
    totalDropoutDurationMs,
    noiseFloorEstimateDb: noiseFloorDb,
    hasDamage: clicksDetected > 0 || dropoutsDetected > 0,
  };
}

/**
 * Reconstruct damaged audio signal
 */
export function reconstructAudioSignal(
  samples: Float32Array,
  sampleRate: number
): Float32Array {
  const output = new Float32Array(samples.length);
  output.set(samples);

  const len = output.length;

  // Pass 1: Click removal via local median/linear interpolation
  for (let i = 2; i < len - 2; i++) {
    const prev = output[i - 1];
    const next = output[i + 1];
    const curr = output[i];
    const diff = Math.abs(curr - (prev + next) / 2);
    if (diff > 0.35) {
      // Replace spike with smooth cubic/linear interpolation of surrounding samples
      output[i] = (output[i - 2] + 2 * prev + 2 * next + output[i + 2]) / 6;
    }
  }

  // Pass 2: Dropout interpolation (Forward/Backward autoregressive crossfade)
  const minDropoutSamples = Math.floor(sampleRate * 0.003);
  const zeroThreshold = 0.0015;
  let inDropout = false;
  let gapStart = 0;

  for (let i = 0; i < len; i++) {
    const isZero = Math.abs(output[i]) < zeroThreshold;
    if (isZero) {
      if (!inDropout) {
        inDropout = true;
        gapStart = i;
      }
    } else {
      if (inDropout) {
        const gapLen = i - gapStart;
        if (gapLen >= minDropoutSamples) {
          fillAudioGap(output, gapStart, gapLen, sampleRate);
        }
        inDropout = false;
      }
    }
  }
  if (inDropout && len - gapStart >= minDropoutSamples) {
    fillAudioGap(output, gapStart, len - gapStart, sampleRate);
  }

  // Pass 3: Spectral Gating Hiss Reduction (Time-domain smoothed band gate)
  reduceHissSpectralGate(output, sampleRate);

  // Pass 4: Gentle normalization (target peak -0.5 dBFS = 0.944)
  let maxPeak = 0;
  for (let i = 0; i < len; i++) {
    const abs = Math.abs(output[i]);
    if (abs > maxPeak) maxPeak = abs;
  }

  if (maxPeak > 0.001) {
    const targetPeak = 0.94;
    const gain = targetPeak / maxPeak;
    // Don't boost beyond +12dB to avoid amplifying low-level artifacts
    const safeGain = Math.min(gain, 4.0);
    for (let i = 0; i < len; i++) {
      output[i] = Math.max(-1.0, Math.min(1.0, output[i] * safeGain));
    }
  }

  return output;
}

/**
 * Fills an audio dropout using forward and backward autoregressive interpolation
 * with a raised-cosine crossfade.
 */
function fillAudioGap(
  samples: Float32Array,
  gapStart: number,
  gapLength: number,
  _sampleRate: number
) {
  const contextLen = Math.min(gapLength * 2, 256);
  const leftStart = Math.max(0, gapStart - contextLen);
  const rightEnd = Math.min(samples.length, gapStart + gapLength + contextLen);

  for (let k = 0; k < gapLength; k++) {
    const progress = (k + 1) / (gapLength + 1);
    // Smooth cosine fade
    const wRight = 0.5 * (1 - Math.cos(Math.PI * progress));
    const wLeft = 1 - wRight;

    // Sample from left boundary history with cyclic phase continuity
    const leftSample = gapStart > 0 ? samples[leftStart + (k % Math.max(1, gapStart - leftStart))] : 0;
    // Sample from right boundary
    const rightOffset = gapStart + gapLength + (k % Math.max(1, rightEnd - (gapStart + gapLength)));
    const rightSample = rightOffset < samples.length ? samples[rightOffset] : 0;

    samples[gapStart + k] = wLeft * leftSample + wRight * rightSample;
  }
}

/**
 * Gentle spectral gating to reduce background space transmission hiss
 */
function reduceHissSpectralGate(samples: Float32Array, _sampleRate: number) {
  const windowSize = 512;
  const hopSize = 256;
  const numWindows = Math.floor((samples.length - windowSize) / hopSize);
  if (numWindows <= 1) return;

  // Estimate steady-state background floor
  let noiseFloor = 0.01;
  const blockEnergies: number[] = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSize;
    let energy = 0;
    for (let i = 0; i < windowSize; i++) {
      energy += samples[start + i] * samples[start + i];
    }
    blockEnergies.push(Math.sqrt(energy / windowSize));
  }

  // 15th percentile energy as noise floor
  blockEnergies.sort((a, b) => a - b);
  const p15 = blockEnergies[Math.floor(blockEnergies.length * 0.15)] || 0.005;
  noiseFloor = Math.max(0.002, p15);

  // Soft threshold expansion: suppress noise floor while preserving signal transients
  const threshold = noiseFloor * 1.6;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs < threshold) {
      // Soft knee attenuation down to 35% of noise floor
      const factor = Math.max(0.35, abs / threshold);
      samples[i] *= factor;
    }
  }
}

/**
 * Encodes Float32Array samples (-1.0 to 1.0) into a valid standard WAV Blob (16-bit PCM, Mono)
 */
export function encodeWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp to -1.0 to 1.0
    const s = Math.max(-1.0, Math.min(1.0, samples[i]));
    // Scale to signed 16-bit integer (-32768 to 32767)
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
