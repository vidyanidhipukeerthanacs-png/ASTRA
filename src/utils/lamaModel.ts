/**
 * Browser-native LaMa ONNX Model Inpainting Engine
 * Uses onnxruntime-web (WebGPU / WASM)
 * Caches 208MB model locally in IndexedDB / Cache API
 */

import {
  detectImageDamage,
  createFeatheredMask,
  verifyInpaintingResult,
  DamageMaskResult,
} from './damageDetection';

declare global {
  interface Window {
    ort?: any;
  }
}

const LAMA_MODEL_URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx';
const DB_NAME = 'astra_model_cache';
const STORE_NAME = 'models';
const MODEL_KEY = 'lama_fp32_onnx';

let cachedSession: any = null;

/**
 * Open or create IndexedDB for model binary caching
 */
function openModelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCachedModelBuffer(): Promise<ArrayBuffer | null> {
  try {
    const db = await openModelDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(MODEL_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveModelBuffer(buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await openModelDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(buffer, MODEL_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to cache model to IndexedDB:', err);
  }
}

/**
 * Validates that a buffer is an authentic ONNX model binary and not an HTML error or truncated download
 */
export function isValidOnnxModelBuffer(buffer: ArrayBuffer | Uint8Array | null | undefined): boolean {
  if (!buffer) return false;
  const byteLength = buffer instanceof Uint8Array ? buffer.byteLength : buffer.byteLength;

  // The LaMa ONNX model is ~208 MB (208,044,816 bytes). A valid buffer must be at least 180 MB.
  if (byteLength < 180 * 1024 * 1024) {
    return false;
  }

  // Inspect header bytes
  const u8 = buffer instanceof Uint8Array
    ? buffer.subarray(0, 32)
    : new Uint8Array(buffer, 0, Math.min(32, byteLength));

  // ONNX models begin with protobuf field 1 tag 0x08 (ir_version)
  // Must NOT be HTML ('<' = 0x3C) or JSON ('{' = 0x7B)
  if (u8[0] === 0x3c || u8[0] === 0x7b) {
    return false;
  }

  if (u8[0] !== 0x08) {
    return false;
  }

  return true;
}

export async function clearCachedModel(): Promise<void> {
  try {
    cachedSession = null;
    const db = await openModelDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(MODEL_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore error on cache purge
  }
}

/**
 * Download LaMa model with progress tracking
 */
export async function loadLamaModel(
  onProgress?: (progress: number, statusText: string) => void
): Promise<any> {
  if (cachedSession) return cachedSession;

  if (typeof window === 'undefined' || !window.ort) {
    throw new Error('ONNX Runtime Web is not loaded. Please check your network connection.');
  }

  const ort = window.ort;
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/';
  ort.env.wasm.numThreads = window.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;

  // Check cache first
  onProgress?.(5, 'Checking browser model cache...');
  let modelBuffer = await getCachedModelBuffer();

  // Validate cached buffer to prevent Protobuf parsing failure on truncated or HTML cache
  if (modelBuffer && !isValidOnnxModelBuffer(modelBuffer)) {
    console.warn('Cached model in IndexedDB failed Protobuf validation. Purging corrupted cache...');
    await clearCachedModel();
    modelBuffer = null;
  }

  if (!modelBuffer) {
    onProgress?.(10, 'Getting ready (first time only) — downloading LaMa model (208 MB)...');

    // Candidate endpoints: local proxy first (prevents 302 cross-origin redirect CORS issues), then direct HuggingFace
    const candidateUrls = [
      '/api/model/lama.onnx',
      LAMA_MODEL_URL,
      'https://hf-mirror.com/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx',
    ];

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        const contentType = res.headers.get('content-type') || '';
        // Guard against HTML error pages
        if (res.ok && !contentType.includes('text/html') && !contentType.includes('application/json')) {
          response = res;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model fetch from ${url} failed:`, err);
      }
    }

    if (!response || !response.ok) {
      throw new Error(
        `Failed to download LaMa model (208 MB): ${lastError?.message || 'Network error accessing model mirror'}. Please check your connection and retry.`
      );
    }

    const contentLength = +(response.headers.get('Content-Length') || 208044816);
    const reader = response.body?.getReader();

    if (!reader) {
      const buf = await response.arrayBuffer();
      if (!isValidOnnxModelBuffer(buf)) {
        throw new Error('Downloaded model binary is invalid or incomplete. Please click Retry.');
      }
      modelBuffer = buf;
      saveModelBuffer(modelBuffer).catch(() => {});
    } else {
      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        const percent = Math.min(92, Math.round(10 + (receivedBytes / contentLength) * 80));
        const mb = (receivedBytes / (1024 * 1024)).toFixed(1);
        onProgress?.(percent, `Getting ready (first time only) — downloaded ${mb} MB / ~208 MB...`);
      }

      const totalArray = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        totalArray.set(chunk, offset);
        offset += chunk.length;
      }

      if (!isValidOnnxModelBuffer(totalArray.buffer)) {
        throw new Error(
          `Downloaded model data is incomplete (received ${totalArray.byteLength} bytes). Please retry the download.`
        );
      }

      modelBuffer = totalArray.buffer;

      // Save verified model to IndexedDB
      saveModelBuffer(modelBuffer).catch(() => {});
    }
  }

  onProgress?.(95, 'Compiling model runtime engine...');
  await new Promise((r) => setTimeout(r, 50));

  // Pass Uint8Array view into InferenceSession
  const modelUint8 = new Uint8Array(modelBuffer);

  // Note: LaMa architecture uses Fast Fourier Convolutions (FFC).
  // onnxruntime-web's WebGPU provider has a known WGSL shader broadcasting bug on /generator/model/model.5/conv1/ffc/convg2g/Add
  // ("Can't perform binary op on the given tensors"). The WASM engine natively supports all FFC ops with full numerical accuracy.
  const sessionOptions = {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'basic',
    executionMode: 'sequential',
  };

  try {
    cachedSession = await ort.InferenceSession.create(modelUint8, sessionOptions);
  } catch (sessionErr: any) {
    console.error('Session creation failed. Clearing cache to allow clean retry:', sessionErr);
    await clearCachedModel();
    throw new Error(
      `Failed to initialize neural model session: ${sessionErr?.message || sessionErr}. Model cache has been reset. Please click Retry.`
    );
  }

  onProgress?.(100, 'Model initialized');
  return cachedSession;
}

export interface InpaintingProgressCallback {
  (progress: number, statusText: string): void;
}

/**
 * Executes the complete LaMa inpainting pipeline on an ImageData buffer:
 * 1. Automatic damage detection & dilation by 6px
 * 2. Context crop around bounding box
 * 3. 512x512 inference
 * 4. 3px feathered edge compositing inside mask
 * 5. Verification check (>5% failed pixels triggers retry)
 */
export async function inpaintSpaceImage(
  canvas: HTMLCanvasElement,
  onProgress?: InpaintingProgressCallback,
  retryCount: number = 0
): Promise<{
  resultCanvas: HTMLCanvasElement;
  damageResult: DamageMaskResult;
  methodUsed: string;
  durationMs: number;
}> {
  const startTime = performance.now();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context.');

  const width = canvas.width;
  const height = canvas.height;
  const originalImageData = ctx.getImageData(0, 0, width, height);

  onProgress?.(15, 'Scanning telemetry stream for sensor dropouts & corruption...');
  const damageResult = detectImageDamage(width, height, originalImageData.data);

  if (!damageResult.hasDamage || !damageResult.boundingBox) {
    throw new Error('No sensor corruption or telemetry damage detected in this image.');
  }

  onProgress?.(30, 'Getting ready (first time only) / loading neural inpainter...');
  const session = await loadLamaModel(onProgress);

  onProgress?.(65, 'Reconstructing missing space pixels with LaMa...');

  // Crop square around bounding box with generous context
  const bb = damageResult.boundingBox;
  const bbW = bb.maxX - bb.minX + 1;
  const bbH = bb.maxY - bb.minY + 1;
  const contextMargin = Math.max(32, Math.round(Math.max(bbW, bbH) * 0.35));

  const cropCenterX = (bb.minX + bb.maxX) / 2;
  const cropCenterY = (bb.minY + bb.maxY) / 2;
  const cropSize = Math.max(bbW, bbH) + contextMargin * 2;

  let cropX0 = Math.round(cropCenterX - cropSize / 2);
  let cropY0 = Math.round(cropCenterY - cropSize / 2);
  let cropX1 = Math.round(cropCenterX + cropSize / 2);
  let cropY1 = Math.round(cropCenterY + cropSize / 2);

  // Clamp crop region within image bounds
  cropX0 = Math.max(0, cropX0);
  cropY0 = Math.max(0, cropY0);
  cropX1 = Math.min(width, cropX1);
  cropY1 = Math.min(height, cropY1);

  const finalCropW = cropX1 - cropX0;
  const finalCropH = cropY1 - cropY0;

  // Render crop image and crop mask to 512x512 temporary canvases
  const tempImgCanvas = document.createElement('canvas');
  tempImgCanvas.width = 512;
  tempImgCanvas.height = 512;
  const tempImgCtx = tempImgCanvas.getContext('2d')!;
  tempImgCtx.imageSmoothingEnabled = true;
  tempImgCtx.drawImage(canvas, cropX0, cropY0, finalCropW, finalCropH, 0, 0, 512, 512);

  // Build mask canvas
  const tempMaskCanvas = document.createElement('canvas');
  tempMaskCanvas.width = width;
  tempMaskCanvas.height = height;
  const tempMaskCtx = tempMaskCanvas.getContext('2d')!;
  const maskImgData = tempMaskCtx.createImageData(width, height);
  for (let i = 0; i < damageResult.mask.length; i++) {
    const val = damageResult.mask[i] === 1 ? 255 : 0;
    maskImgData.data[i * 4] = val;
    maskImgData.data[i * 4 + 1] = val;
    maskImgData.data[i * 4 + 2] = val;
    maskImgData.data[i * 4 + 3] = 255;
  }
  tempMaskCtx.putImageData(maskImgData, 0, 0);

  const scaledMaskCanvas = document.createElement('canvas');
  scaledMaskCanvas.width = 512;
  scaledMaskCanvas.height = 512;
  const scaledMaskCtx = scaledMaskCanvas.getContext('2d')!;
  scaledMaskCtx.imageSmoothingEnabled = false;
  scaledMaskCtx.drawImage(tempMaskCanvas, cropX0, cropY0, finalCropW, finalCropH, 0, 0, 512, 512);

  const img512Data = tempImgCtx.getImageData(0, 0, 512, 512).data;
  const mask512Data = scaledMaskCtx.getImageData(0, 0, 512, 512).data;

  // Format inputs according to LaMa model contract:
  // image: float32 [1, 3, 512, 512], RGB normalized 0..1, channels-first
  // mask: float32 [1, 1, 512, 512], 1 = fill, 0 = keep
  const imageTensorData = new Float32Array(1 * 3 * 512 * 512);
  const maskTensorData = new Float32Array(1 * 1 * 512 * 512);

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      const r = img512Data[idx] / 255.0;
      const g = img512Data[idx + 1] / 255.0;
      const b = img512Data[idx + 2] / 255.0;
      const m = mask512Data[idx] > 128 ? 1.0 : 0.0;

      const pIdx = y * 512 + x;
      // Channels first: all R, then all G, then all B
      imageTensorData[pIdx] = r;
      imageTensorData[512 * 512 + pIdx] = g;
      imageTensorData[2 * 512 * 512 + pIdx] = b;

      maskTensorData[pIdx] = m;
    }
  }

  const ort = window.ort;
  const inputImageTensor = new ort.Tensor('float32', imageTensorData, [1, 3, 512, 512]);
  const inputMaskTensor = new ort.Tensor('float32', maskTensorData, [1, 1, 512, 512]);

  const feeds: Record<string, any> = {};
  feeds[session.inputNames[0]] = inputImageTensor;
  feeds[session.inputNames[1]] = inputMaskTensor;

  onProgress?.(80, 'Synthesizing cosmic structures...');
  await new Promise((r) => setTimeout(r, 60));

  let results;
  try {
    results = await session.run(feeds);
  } catch (runErr: any) {
    if (
      runErr?.message?.includes('WebGPU') ||
      runErr?.message?.includes('Kernel') ||
      runErr?.message?.includes('binary op') ||
      runErr?.message?.includes('convg2g')
    ) {
      console.warn('WebGPU execution failed on FFC layer. Switching to WASM session:', runErr);
      cachedSession = null;
      const wasmSession = await loadLamaModel(onProgress);
      results = await wasmSession.run(feeds);
    } else {
      throw runErr;
    }
  }

  const outputTensor = results[session.outputNames?.[0] || Object.keys(results)[0]] || Object.values(results)[0];
  const outputRaw = outputTensor.data as Float32Array;

  // Convert output tensor [1, 3, 512, 512] (already 0..255) to 512x512 RGBA canvas
  const reconstructed512Canvas = document.createElement('canvas');
  reconstructed512Canvas.width = 512;
  reconstructed512Canvas.height = 512;
  const rec512Ctx = reconstructed512Canvas.getContext('2d')!;
  const rec512ImgData = rec512Ctx.createImageData(512, 512);

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const pIdx = y * 512 + x;
      const outIdx = pIdx * 4;
      const r = Math.max(0, Math.min(255, outputRaw[pIdx]));
      const g = Math.max(0, Math.min(255, outputRaw[512 * 512 + pIdx]));
      const b = Math.max(0, Math.min(255, outputRaw[2 * 512 * 512 + pIdx]));

      rec512ImgData.data[outIdx] = Math.round(r);
      rec512ImgData.data[outIdx + 1] = Math.round(g);
      rec512ImgData.data[outIdx + 2] = Math.round(b);
      rec512ImgData.data[outIdx + 3] = 255;
    }
  }
  rec512Ctx.putImageData(rec512ImgData, 0, 0);

  // Resize back to original crop dimension
  const unscaledRecCanvas = document.createElement('canvas');
  unscaledRecCanvas.width = finalCropW;
  unscaledRecCanvas.height = finalCropH;
  const unscaledCtx = unscaledRecCanvas.getContext('2d')!;
  unscaledCtx.imageSmoothingEnabled = true;
  unscaledCtx.drawImage(reconstructed512Canvas, 0, 0, 512, 512, 0, 0, finalCropW, finalCropH);
  const unscaledRecData = unscaledCtx.getImageData(0, 0, finalCropW, finalCropH).data;

  // 4. Composite result ONLY inside the mask with a 3px feathered edge
  onProgress?.(90, 'Compositing with 3px feathered edge...');
  const featheredMask = createFeatheredMask(damageResult.mask, width, height, 3);

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const resultCtx = resultCanvas.getContext('2d')!;
  const resultImageData = resultCtx.createImageData(width, height);

  // Initialize with exact uploaded pixels
  resultImageData.data.set(originalImageData.data);

  for (let cy = 0; cy < finalCropH; cy++) {
    const y = cropY0 + cy;
    for (let cx = 0; cx < finalCropW; cx++) {
      const x = cropX0 + cx;
      const maskIdx = y * width + x;
      const alpha = featheredMask[maskIdx];

      if (alpha > 0.0) {
        const fullIdx = maskIdx * 4;
        const cropIdx = (cy * finalCropW + cx) * 4;

        const origR = originalImageData.data[fullIdx];
        const origG = originalImageData.data[fullIdx + 1];
        const origB = originalImageData.data[fullIdx + 2];

        const recR = unscaledRecData[cropIdx];
        const recG = unscaledRecData[cropIdx + 1];
        const recB = unscaledRecData[cropIdx + 2];

        resultImageData.data[fullIdx] = Math.round(origR * (1 - alpha) + recR * alpha);
        resultImageData.data[fullIdx + 1] = Math.round(origG * (1 - alpha) + recG * alpha);
        resultImageData.data[fullIdx + 2] = Math.round(origB * (1 - alpha) + recB * alpha);
      }
    }
  }
  resultCtx.putImageData(resultImageData, 0, 0);

  // 5. Verification:
  // "Verify: if more than 5% of the masked pixels are still near-black or unchanged, run LaMa once more;
  // if it still fails, show the real error text and a Retry button. Never show a partly filled image as the result."
  const verification = verifyInpaintingResult(
    originalImageData.data,
    resultImageData.data,
    damageResult.mask,
    width,
    height,
    damageResult.rawMask
  );

  if (!verification.passed) {
    if (retryCount === 0) {
      onProgress?.(50, 'Retrying neural inpainting pass to resolve residual artifacts...');
      return inpaintSpaceImage(canvas, onProgress, 1);
    }
    throw new Error(
      `Reconstruction verification failed: ${verification.reason || 'Residual artifacts exceed 5% threshold'}.`
    );
  }

  const durationMs = Math.round(performance.now() - startTime);

  return {
    resultCanvas,
    damageResult,
    methodUsed: 'LaMa Neural Inpainting (ONNX in Browser)',
    durationMs,
  };
}
