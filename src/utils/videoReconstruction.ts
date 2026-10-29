/**
 * Browser-native Video Reconstruction Pipeline
 * - Extracts frames at 8 fps (512px wide)
 * - Detects telemetry loss / damage per frame
 * - Runs LaMa inpainting
 * - Temporal neighbor frame blending to eliminate flicker
 * - Reassembles into downloadable video via MediaRecorder
 */

import { detectImageDamage, createFeatheredMask } from './damageDetection';
import { loadLamaModel } from './lamaModel';

export interface VideoProgressCallback {
  (frameCurrent: number, frameTotal: number, statusText: string): void;
}

export interface VideoReconstructionResult {
  reconstructedBlob: Blob;
  reconstructedUrl: string;
  totalFrames: number;
  corruptedFrames: number;
  durationMs: number;
  methodUsed: string;
}

export async function reconstructSpaceVideo(
  videoFile: File,
  onProgress?: VideoProgressCallback
): Promise<VideoReconstructionResult> {
  const startTime = performance.now();

  // 1. Load video element to inspect duration and dimensions
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  const videoUrl = URL.createObjectURL(videoFile);
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video file. Ensure it is a valid MP4/WebM video.'));
  });

  if (video.duration > 5.05) {
    URL.revokeObjectURL(videoUrl);
    throw new Error(
      `Video clip duration is ${video.duration.toFixed(1)}s (maximum allowed is 5.0s). Please trim the clip to 5 seconds or less for browser-native reconstruction.`
    );
  }

  const fps = 8;
  const duration = video.duration;
  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const targetWidth = 512;
  const targetHeight = Math.round((512 / video.videoWidth) * video.videoHeight) || 512;

  // Initialize LaMa model first
  onProgress?.(0, totalFrames, 'Getting ready (first time only) — loading neural inpainter...');
  const session = await loadLamaModel();

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = targetWidth;
  frameCanvas.height = targetHeight;
  const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true })!;

  const processedCanvases: HTMLCanvasElement[] = [];
  let previousFrameData: Uint8ClampedArray | null = null;
  let corruptedFrames = 0;

  // 2. Extract and process each frame at 8 fps
  for (let f = 0; f < totalFrames; f++) {
    const time = f / fps;
    video.currentTime = Math.min(time, duration - 0.01);

    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
    });

    onProgress?.(f + 1, totalFrames, `Processing frame ${f + 1} of ${totalFrames}...`);

    frameCtx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const frameImgData = frameCtx.getImageData(0, 0, targetWidth, targetHeight);

    // Detect damage on frame
    const damage = detectImageDamage(targetWidth, targetHeight, frameImgData.data);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetWidth;
    outCanvas.height = targetHeight;
    const outCtx = outCanvas.getContext('2d')!;

    if (damage.hasDamage && damage.boundingBox) {
      corruptedFrames++;

      // Resize crop to 512x512 for LaMa
      const temp512 = document.createElement('canvas');
      temp512.width = 512;
      temp512.height = 512;
      const tCtx = temp512.getContext('2d')!;
      tCtx.drawImage(frameCanvas, 0, 0, 512, 512);

      const m512 = document.createElement('canvas');
      m512.width = 512;
      m512.height = 512;
      const mCtx = m512.getContext('2d')!;
      const mData = mCtx.createImageData(512, 512);

      // Scale mask to 512x512
      for (let y = 0; y < 512; y++) {
        const origY = Math.floor((y / 512) * targetHeight);
        for (let x = 0; x < 512; x++) {
          const origX = Math.floor((x / 512) * targetWidth);
          const val = damage.mask[origY * targetWidth + origX] === 1 ? 255 : 0;
          const idx = (y * 512 + x) * 4;
          mData.data[idx] = val;
          mData.data[idx + 1] = val;
          mData.data[idx + 2] = val;
          mData.data[idx + 3] = 255;
        }
      }
      mCtx.putImageData(mData, 0, 0);

      // Model inputs
      const img512 = tCtx.getImageData(0, 0, 512, 512).data;
      const mask512 = mCtx.getImageData(0, 0, 512, 512).data;

      const imgTensor = new Float32Array(1 * 3 * 512 * 512);
      const maskTensor = new Float32Array(1 * 1 * 512 * 512);

      for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
          const idx = (y * 512 + x) * 4;
          const pIdx = y * 512 + x;
          imgTensor[pIdx] = img512[idx] / 255;
          imgTensor[512 * 512 + pIdx] = img512[idx + 1] / 255;
          imgTensor[2 * 512 * 512 + pIdx] = img512[idx + 2] / 255;
          maskTensor[pIdx] = mask512[idx] > 128 ? 1.0 : 0.0;
        }
      }

      const ort = window.ort;
      const feeds = {
        image: new ort.Tensor('float32', imgTensor, [1, 3, 512, 512]),
        mask: new ort.Tensor('float32', maskTensor, [1, 1, 512, 512]),
      };

      const results = await session.run(feeds);
      const outTensor = results[session.outputNames[0]] || Object.values(results)[0];
      const outData = outTensor.data as Float32Array;

      // Unscale to targetWidth x targetHeight
      const res512 = document.createElement('canvas');
      res512.width = 512;
      res512.height = 512;
      const resCtx = res512.getContext('2d')!;
      const resImgData = resCtx.createImageData(512, 512);

      for (let i = 0; i < 512 * 512; i++) {
        resImgData.data[i * 4] = Math.max(0, Math.min(255, outData[i]));
        resImgData.data[i * 4 + 1] = Math.max(0, Math.min(255, outData[512 * 512 + i]));
        resImgData.data[i * 4 + 2] = Math.max(0, Math.min(255, outData[2 * 512 * 512 + i]));
        resImgData.data[i * 4 + 3] = 255;
      }
      resCtx.putImageData(resImgData, 0, 0);

      const unscaled = document.createElement('canvas');
      unscaled.width = targetWidth;
      unscaled.height = targetHeight;
      const uCtx = unscaled.getContext('2d')!;
      uCtx.drawImage(res512, 0, 0, targetWidth, targetHeight);
      const unscaledData = uCtx.getImageData(0, 0, targetWidth, targetHeight).data;

      // Feathered compositing + Temporal neighbor blending
      const feathered = createFeatheredMask(damage.mask, targetWidth, targetHeight, 3);
      const combined = outCtx.createImageData(targetWidth, targetHeight);
      combined.data.set(frameImgData.data);

      for (let i = 0; i < targetWidth * targetHeight; i++) {
        const alpha = feathered[i];
        if (alpha > 0) {
          const idx = i * 4;
          let recR = unscaledData[idx];
          let recG = unscaledData[idx + 1];
          let recB = unscaledData[idx + 2];

          // Blend lightly with previous frame (0.85 current + 0.15 previous) to reduce flicker
          if (previousFrameData) {
            recR = Math.round(recR * 0.85 + previousFrameData[idx] * 0.15);
            recG = Math.round(recG * 0.85 + previousFrameData[idx + 1] * 0.15);
            recB = Math.round(recB * 0.85 + previousFrameData[idx + 2] * 0.15);
          }

          combined.data[idx] = Math.round(frameImgData.data[idx] * (1 - alpha) + recR * alpha);
          combined.data[idx + 1] = Math.round(frameImgData.data[idx + 1] * (1 - alpha) + recG * alpha);
          combined.data[idx + 2] = Math.round(frameImgData.data[idx + 2] * (1 - alpha) + recB * alpha);
        }
      }
      outCtx.putImageData(combined, 0, 0);
      previousFrameData = combined.data;
    } else {
      outCtx.drawImage(frameCanvas, 0, 0);
      previousFrameData = frameImgData.data;
    }

    processedCanvases.push(outCanvas);
  }

  // 3. Assemble frames with MediaRecorder
  onProgress?.(totalFrames, totalFrames, 'Encoding reconstructed video stream...');

  const streamCanvas = document.createElement('canvas');
  streamCanvas.width = targetWidth;
  streamCanvas.height = targetHeight;
  const streamCtx = streamCanvas.getContext('2d')!;

  const stream = streamCanvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/mp4')
    ? 'video/mp4'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType });
  const recordedChunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(recordedChunks, { type: mimeType }));
    };
  });

  recorder.start();

  // Play frames at 8 fps into stream canvas
  for (let f = 0; f < processedCanvases.length; f++) {
    streamCtx.drawImage(processedCanvases[f], 0, 0);
    await new Promise((r) => setTimeout(r, 1000 / fps));
  }

  recorder.stop();
  const videoBlob = await recordingPromise;
  const resultUrl = URL.createObjectURL(videoBlob);
  URL.revokeObjectURL(videoUrl);

  const durationMs = Math.round(performance.now() - startTime);

  return {
    reconstructedBlob: videoBlob,
    reconstructedUrl: resultUrl,
    totalFrames,
    corruptedFrames,
    durationMs,
    methodUsed: 'Per-frame LaMa Inpainting + Temporal Inter-frame Blending',
  };
}
