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
 * Creates a sample damaged space video WebM Blob (lunar orbiter telemetry with dropouts)
 */
export async function generateSampleDamagedVideoBlob(): Promise<{ blob: Blob; fileName: string }> {
  const width = 512;
  const height = 384;
  const fps = 8;
  const totalFrames = 24; // 3.0 seconds

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const mimeType =
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      if (chunks.length > 0) {
        resolve(new Blob(chunks, { type: mimeType }));
      } else {
        reject(new Error('MediaRecorder generated empty chunks.'));
      }
    };
    recorder.onerror = (err) => reject(err);
  });

  recorder.start(100);

  for (let frame = 0; frame < totalFrames; frame++) {
    // 1. Deep space background with subtle nebula
    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, width, height);

    // Nebula glow
    const grad = ctx.createRadialGradient(width * 0.4, height * 0.45, 10, width * 0.4, height * 0.45, 200);
    grad.addColorStop(0, 'rgba(14, 165, 233, 0.12)');
    grad.addColorStop(0.6, 'rgba(99, 102, 241, 0.08)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Stars
    for (let s = 0; s < 50; s++) {
      const sx = (s * 73 + frame * 0.5) % width;
      const sy = (s * 47) % height;
      ctx.fillStyle = s % 4 === 0 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(241, 245, 249, 0.7)';
      ctx.beginPath();
      ctx.arc(sx, sy, (s % 3) * 0.5 + 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Lunar sphere / celestial body (drifting slightly with camera motion)
    const moonX = width * 0.5 + Math.sin(frame * 0.15) * 16;
    const moonY = height * 0.52;
    const moonR = 85;

    const moonGrad = ctx.createRadialGradient(moonX - 25, moonY - 25, 5, moonX, moonY, moonR);
    moonGrad.addColorStop(0, '#e2e8f0');
    moonGrad.addColorStop(0.5, '#94a3b8');
    moonGrad.addColorStop(0.85, '#475569');
    moonGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();

    // Lunar craters
    const craters = [
      { dx: -20, dy: -15, r: 14 },
      { dx: 25, dy: 10, r: 18 },
      { dx: -5, dy: 30, r: 10 },
      { dx: 35, dy: -25, r: 12 },
    ];
    for (const c of craters) {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
      ctx.beginPath();
      ctx.arc(moonX + c.dx, moonY + c.dy, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(moonX + c.dx - 2, moonY + c.dy - 2, c.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Orbiting satellite with solar wings
    const satX = width * 0.2 + (frame / totalFrames) * (width * 0.6);
    const satY = height * 0.32 + Math.cos(frame * 0.3) * 14;

    // Body
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(satX - 6, satY - 6, 12, 12);
    // Solar panels
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(satX - 24, satY - 4, 15, 8);
    ctx.fillRect(satX + 9, satY - 4, 15, 8);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(satX - 24, satY - 4, 15, 8);
    ctx.strokeRect(satX + 9, satY - 4, 15, 8);

    // 5. INJECT AUTHENTIC CORRUPTION DAMAGE:
    // Sensor telemetry dropout block on lunar surface across frames 5 to 19
    if (frame >= 5 && frame <= 19) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.round(width * 0.42), Math.round(height * 0.44), 62, 50);
    }

    // Horizontal telemetry scanline dropout across frames 8 to 15
    if (frame >= 8 && frame <= 15) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.round(width * 0.15), Math.round(height * 0.68), Math.round(width * 0.7), 4);
    }

    // White telemetry saturation spike in frame 11-13
    if (frame >= 11 && frame <= 13) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(width * 0.62), Math.round(height * 0.28), 35, 4);
    }

    // Frame delay for MediaRecorder capture
    await new Promise((r) => setTimeout(r, 1000 / fps));
  }

  // Allow extra buffer for recorder to finalize
  await new Promise((r) => setTimeout(r, 300));
  recorder.stop();

  const blob = await recordingPromise;
  return { blob, fileName: 'lunar_orbiter_feed.webm' };
}

/**
 * Sample corrupted space transmission text (multi-paragraph flight log with telemetry gaps)
 */
export const SAMPLE_CORRUPTED_TEXT = `MISSION TELEMETRY LOG: VOYAGER-1 DEEP SPACE PROBE
Segment ID: TR-8924 // Subcarrier: 32 // Band: X-Band Downlink

Voyager 1 deep ____ carrier s?gn@l detected on subcarrier 32. All spacecraft systems nominal. Downlink tel@metry locked on X-band receiver. High gain antenna ____ calibrated for ground station acquisition. Solar flare r@diation flux within acceptable margins for deep space tra- .

FLIGHT SUBSYSTEM TELEMETRY:
- Main bus voltage: ___ V
- RTG thermocouple temp: ___ K
- Thruster propellant pressure: ___ psi
- Doppler velocity shift: ___ km/s

Observational notes: Deep space observatory detected ____ cosmic emission along interstellar boundary coordinates. Ground controllers initiated telemetry calibration sequence.`;

