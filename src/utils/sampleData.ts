/**
 * Generates authentic damaged space samples for immediate 1-click testing:
 * - Damaged Deep Space Image (Hubble Deep Field simulation with dead sensor dropout box and telemetry line)
 * - Damaged Deep Space Audio (Apollo radio telemetry with clicks and silent dropouts)
 * - Corrupted Telemetry Log Text
 */

import { encodeWavBlob } from './audioProcessing';

/**
 * Creates a realistic damaged deep space image canvas
 */
export function generateSampleDamagedImage(width: number = 512, height: number = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep space background
  const bgGrad = ctx.createRadialGradient(
    width * 0.45,
    height * 0.45,
    20,
    width * 0.5,
    height * 0.5,
    width * 0.75
  );
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.3, '#0b1329');
  bgGrad.addColorStop(0.7, '#070b16');
  bgGrad.addColorStop(1, '#03050a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Stars field
  const rand = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  let seed = 42;
  for (let i = 0; i < 280; i++) {
    const x = rand(seed++) * width;
    const y = rand(seed++) * height;
    const r = rand(seed++) * 1.6 + 0.3;
    const alpha = rand(seed++) * 0.8 + 0.2;
    ctx.fillStyle = `rgba(224, 242, 254, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Cosmic gas nebula clouds
  const nebulaColors = [
    'rgba(6, 182, 212, 0.16)', // cyan
    'rgba(14, 165, 233, 0.14)', // sky
    'rgba(99, 102, 241, 0.12)', // indigo
    'rgba(244, 63, 94, 0.1)',  // rose
  ];

  for (let c = 0; c < nebulaColors.length; c++) {
    const cx = width * (0.35 + c * 0.1);
    const cy = height * (0.4 + (c % 2) * 0.15);
    const rad = ctx.createRadialGradient(cx, cy, 10, cx, cy, width * 0.38);
    rad.addColorStop(0, nebulaColors[c]);
    rad.addColorStop(0.5, nebulaColors[(c + 1) % nebulaColors.length]);
    rad.addColorStop(1, 'transparent');
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(cx, cy, width * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Spiral galaxy core in upper right
  const gx = width * 0.68;
  const gy = height * 0.35;
  const gGrad = ctx.createRadialGradient(gx, gy, 2, gx, gy, 70);
  gGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gGrad.addColorStop(0.2, 'rgba(254, 240, 138, 0.7)');
  gGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.25)');
  gGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = gGrad;
  ctx.beginPath();
  ctx.ellipse(gx, gy, 65, 35, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  // 5. INJECT REAL SENSOR CORRUPTION DAMAGE:
  // Pure black sensor dropout block (RGB 0,0,0) in center quadrant
  ctx.fillStyle = 'rgb(0, 0, 0)';
  ctx.fillRect(Math.round(width * 0.32), Math.round(height * 0.42), 64, 52);

  // Horizontal transmission line dropout across width
  ctx.fillRect(Math.round(width * 0.1), Math.round(height * 0.68), Math.round(width * 0.75), 4);

  // Pure white cosmic ray saturation streak
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.fillRect(Math.round(width * 0.58), Math.round(height * 0.22), 36, 4);

  return canvas;
}

/**
 * Creates a sample damaged space audio WAV Blob
 */
export function generateSampleDamagedAudio(): { blob: Blob; fileName: string } {
  const sampleRate = 16000;
  const durationSec = 3.5;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(totalSamples);

  // Synthesize multi-tone space telemetry carrier + Apollo Quindar tone
  const fCarrier = 640;
  const fSubcarrier = 320;
  const fTone = 1200;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Modulated carrier tone
    const sig =
      0.32 * Math.sin(2 * Math.PI * fCarrier * t) +
      0.18 * Math.sin(2 * Math.PI * fSubcarrier * t + 0.4) +
      (t < 0.25 ? 0.35 * Math.sin(2 * Math.PI * fTone * t) : 0);

    // Subtle background transmission noise
    const noise = (Math.random() - 0.5) * 0.08;
    samples[i] = sig + noise;
  }

  // Inject silent dropouts (telemetry packets lost in transit)
  // Dropout 1: at 1.1s (60ms)
  const d1Start = Math.floor(1.1 * sampleRate);
  for (let i = d1Start; i < d1Start + Math.floor(0.06 * sampleRate); i++) {
    samples[i] = 0;
  }

  // Dropout 2: at 2.4s (45ms)
  const d2Start = Math.floor(2.4 * sampleRate);
  for (let i = d2Start; i < d2Start + Math.floor(0.045 * sampleRate); i++) {
    samples[i] = 0;
  }

  // Inject sharp telemetry clicks
  samples[Math.floor(0.7 * sampleRate)] = 0.96;
  samples[Math.floor(1.85 * sampleRate)] = -0.95;
  samples[Math.floor(2.95 * sampleRate)] = 0.98;

  const blob = encodeWavBlob(samples, sampleRate);
  return { blob, fileName: 'voyager_deep_space_telemetry.wav' };
}

/**
 * Sample corrupted space transmission text
 */
export const SAMPLE_CORRUPTED_TEXT =
  'Voyager 1 deep ____ carrier s?gn@l detected on subcarrier 32. All spacecraft systems nominal. Downlink tel@metry locked on X-band. High gain antenna ____ calibrated. Solar flare r@diation flux within acceptable margins for deep space tra- .';
