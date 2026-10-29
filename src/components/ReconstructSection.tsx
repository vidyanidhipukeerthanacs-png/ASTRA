import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  FileText,
  UploadCloud,
  X,
  Download,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { AudioPlayerWaveform } from './AudioPlayerWaveform';
import { inpaintSpaceImage, clearCachedModel } from '../utils/lamaModel';
import { reconstructSpaceVideo } from '../utils/videoReconstruction';
import {
  analyzeAudioDamage,
  reconstructAudioSignal,
  encodeWavBlob,
} from '../utils/audioProcessing';
import {
  reconstructTextLocal,
  isWebGpuSupported,
} from '../utils/textReconstruction';
import {
  generateSampleDamagedImage,
  generateSampleDamagedAudio,
  SAMPLE_CORRUPTED_TEXT,
} from '../utils/sampleData';
import { ReconstructionReport, HistoryItem } from '../types';

interface ReconstructSectionProps {
  onReconstructionComplete: (historyItem: HistoryItem) => void;
}

export const ReconstructSection: React.FC<ReconstructSectionProps> = ({
  onReconstructionComplete,
}) => {
  // -------------------------------------------------------------
  // IMAGE STATE
  // -------------------------------------------------------------
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageOriginalUrl, setImageOriginalUrl] = useState<string | null>(null);
  const [imageResultUrl, setImageResultUrl] = useState<string | null>(null);
  const [imageResultBlob, setImageResultBlob] = useState<Blob | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageProgress, setImageProgress] = useState<number>(0);
  const [imageStatusText, setImageStatusText] = useState<string>('');
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------
  // VIDEO STATE
  // -------------------------------------------------------------
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoOriginalUrl, setVideoOriginalUrl] = useState<string | null>(null);
  const [videoResultUrl, setVideoResultUrl] = useState<string | null>(null);
  const [videoResultBlob, setVideoResultBlob] = useState<Blob | null>(null);
  const [videoLoading, setVideoLoading] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [videoStatusText, setVideoStatusText] = useState<string>('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------
  // AUDIO STATE
  // -------------------------------------------------------------
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioOriginalBlob, setAudioOriginalBlob] = useState<Blob | null>(null);
  const [audioResultBlob, setAudioResultBlob] = useState<Blob | null>(null);
  const [audioLoading, setAudioLoading] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [audioStatusText, setAudioStatusText] = useState<string>('');
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------------------------------------------------
  // TEXT STATE
  // -------------------------------------------------------------
  const [textInput, setTextInput] = useState<string>('');
  const [textResult, setTextResult] = useState<string | null>(null);
  const [textHighlightedTokens, setTextHighlightedTokens] = useState<Array<{ original: string; reconstructed?: string; isCorrupted: boolean }>>([]);
  const [textLoading, setTextLoading] = useState<boolean>(false);
  const [textProgress, setTextProgress] = useState<number>(0);
  const [textStatusText, setTextStatusText] = useState<string>('');
  const [textError, setTextError] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  // =============================================================
  // IMAGE HANDLERS
  // =============================================================
  const handleImageSelect = (file: File) => {
    setImageFile(file);
    setImageError(null);
    setImageResultUrl(null);
    setImageResultBlob(null);
    const url = URL.createObjectURL(file);
    setImageOriginalUrl(url);
  };

  const handleLoadSampleImage = () => {
    const canvas = generateSampleDamagedImage(512, 512);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'jwst_deep_field_sensor_drop.png', { type: 'image/png' });
      handleImageSelect(file);
    }, 'image/png');
  };

  const clearImage = () => {
    setImageFile(null);
    if (imageOriginalUrl) URL.revokeObjectURL(imageOriginalUrl);
    if (imageResultUrl) URL.revokeObjectURL(imageResultUrl);
    setImageOriginalUrl(null);
    setImageResultUrl(null);
    setImageResultBlob(null);
    setImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const runImageReconstruction = async () => {
    if (!imageOriginalUrl || !imageFile) return;
    setImageLoading(true);
    setImageError(null);
    setImageProgress(10);
    setImageStatusText('Reconstructing... please wait.');

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageOriginalUrl;
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('Could not render image onto canvas.'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 512;
      canvas.height = img.naturalHeight || 512;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const result = await inpaintSpaceImage(canvas, (pct, msg) => {
        setImageProgress(pct);
        setImageStatusText(msg);
      });

      result.resultCanvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to generate PNG blob from reconstructed canvas.');
        }

        const resUrl = URL.createObjectURL(blob);
        setImageResultUrl(resUrl);
        setImageResultBlob(blob);
        setImageLoading(false);

        const report: ReconstructionReport = {
          id: `rec-img-${Date.now()}`,
          modality: 'image',
          fileName: imageFile.name,
          fileSizeBytes: imageFile.size,
          damageDescription: `Telemetry sensor dropouts and scanline corruption detected (${result.damageResult.damagedAreaPercent}% damaged area).`,
          damagedAreaPercent: result.damageResult.damagedAreaPercent,
          reconstructionSummary: `Repaired ${result.damageResult.damagedPixels.toLocaleString()} missing pixels using LaMa neural inpainting with 3px feathered boundary compositing.`,
          methodUsed: result.methodUsed,
          measuredTimeMs: result.durationMs,
          disclaimer: "Missing parts are estimated from the visible parts and may not match the original exactly.",
          timestamp: Date.now(),
        };

        const item: HistoryItem = {
          id: report.id,
          modality: 'image',
          fileName: imageFile.name,
          timestamp: report.timestamp,
          methodUsed: result.methodUsed,
          report,
          originalBlob: imageFile,
          reconstructedBlob: blob,
          originalUrl: imageOriginalUrl,
          reconstructedUrl: resUrl,
        };

        onReconstructionComplete(item);
      }, 'image/png');
    } catch (err: any) {
      console.error('Image reconstruction error:', err);
      setImageError(err.message || 'Image reconstruction failed.');
      setImageLoading(false);
    }
  };

  const downloadImageResult = () => {
    if (!imageResultBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(imageResultBlob);
    a.download = `reconstructed_${imageFile?.name || 'space_image.png'}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // =============================================================
  // VIDEO HANDLERS
  // =============================================================
  const handleVideoSelect = (file: File) => {
    setVideoFile(file);
    setVideoError(null);
    setVideoResultUrl(null);
    setVideoResultBlob(null);
    const url = URL.createObjectURL(file);
    setVideoOriginalUrl(url);
  };

  const handleLoadSampleVideo = () => {
    // Generate a short 2-second animated canvas video
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;

    const stream = canvas.captureStream(8);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const file = new File([blob], 'lunar_orbiter_feed.webm', { type: 'video/webm' });
      handleVideoSelect(file);
    };

    recorder.start();

    let frame = 0;
    const totalFrames = 16; // 2 seconds at 8 fps

    const interval = setInterval(() => {
      if (frame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
        return;
      }

      // Draw starry celestial scene with moving orbiter
      ctx.fillStyle = '#060a14';
      ctx.fillRect(0, 0, 512, 384);

      // Star dots
      for (let s = 0; s < 60; s++) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc((s * 73) % 512, (s * 47) % 384, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Celestial moon
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(256 + Math.sin(frame * 0.2) * 20, 192, 70, 0, Math.PI * 2);
      ctx.fill();

      // INJECT CORRUPTION: Black sensor telemetry bar across frames 4 to 12
      if (frame >= 4 && frame <= 12) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(180, 160, 60, 48);
      }

      frame++;
    }, 125);
  };

  const clearVideo = () => {
    setVideoFile(null);
    if (videoOriginalUrl) URL.revokeObjectURL(videoOriginalUrl);
    if (videoResultUrl) URL.revokeObjectURL(videoResultUrl);
    setVideoOriginalUrl(null);
    setVideoResultUrl(null);
    setVideoResultBlob(null);
    setVideoError(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const runVideoReconstruction = async () => {
    if (!videoFile) return;
    setVideoLoading(true);
    setVideoError(null);
    setVideoProgress(5);
    setVideoStatusText('Reconstructing... please wait.');

    try {
      const result = await reconstructSpaceVideo(videoFile, (curr, tot, msg) => {
        const pct = tot > 0 ? Math.round((curr / tot) * 100) : 10;
        setVideoProgress(pct);
        setVideoStatusText(`Frame ${curr} of ${tot}: ${msg}`);
      });

      setVideoResultUrl(result.reconstructedUrl);
      setVideoResultBlob(result.reconstructedBlob);
      setVideoLoading(false);

      const report: ReconstructionReport = {
        id: `rec-vid-${Date.now()}`,
        modality: 'video',
        fileName: videoFile.name,
        fileSizeBytes: videoFile.size,
        damageDescription: `${result.corruptedFrames} of ${result.totalFrames} frames had sensor telemetry dropouts.`,
        damageMetrics: {
          droppedFrames: result.corruptedFrames,
        },
        reconstructionSummary: `Restored ${result.corruptedFrames} frames at 8 fps with LaMa and temporal neighbor blending to prevent flicker.`,
        methodUsed: result.methodUsed,
        measuredTimeMs: result.durationMs,
        disclaimer: "Missing parts are estimated from the visible parts and may not match the original exactly.",
        timestamp: Date.now(),
      };

      const item: HistoryItem = {
        id: report.id,
        modality: 'video',
        fileName: videoFile.name,
        timestamp: report.timestamp,
        methodUsed: result.methodUsed,
        report,
        originalBlob: videoFile,
        reconstructedBlob: result.reconstructedBlob,
        originalUrl: videoOriginalUrl || undefined,
        reconstructedUrl: result.reconstructedUrl,
      };

      onReconstructionComplete(item);
    } catch (err: any) {
      console.error('Video reconstruction error:', err);
      setVideoError(err.message || 'Video reconstruction failed.');
      setVideoLoading(false);
    }
  };

  const downloadVideoResult = () => {
    if (!videoResultBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(videoResultBlob);
    a.download = `reconstructed_${videoFile?.name?.replace(/\.[^/.]+$/, '') || 'space_video'}.webm`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // =============================================================
  // AUDIO HANDLERS
  // =============================================================
  const handleAudioSelect = (file: File) => {
    setAudioFile(file);
    setAudioOriginalBlob(file);
    setAudioResultBlob(null);
    setAudioError(null);
  };

  const handleLoadSampleAudio = () => {
    const sample = generateSampleDamagedAudio();
    const file = new File([sample.blob], sample.fileName, { type: 'audio/wav' });
    handleAudioSelect(file);
  };

  const clearAudio = () => {
    setAudioFile(null);
    setAudioOriginalBlob(null);
    setAudioResultBlob(null);
    setAudioError(null);
    if (audioInputRef.current) audioInputRef.current.value = '';
  };

  const runAudioReconstruction = async () => {
    if (!audioFile) return;
    setAudioLoading(true);
    setAudioError(null);
    setAudioProgress(20);
    setAudioStatusText('Reconstructing... please wait.');
    const startTime = performance.now();

    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      setAudioProgress(40);
      setAudioStatusText('Analyzing signal for silent dropouts & click transients...');

      const stats = analyzeAudioDamage(channelData, sampleRate);

      setAudioProgress(70);
      setAudioStatusText('Applying linear prediction gap interpolation & spectral gating...');

      const repairedSamples = reconstructAudioSignal(channelData, sampleRate);
      audioCtx.close();

      setAudioProgress(90);
      setAudioStatusText('Encoding clean WAV signal...');

      const wavBlob = encodeWavBlob(repairedSamples, sampleRate);
      setAudioResultBlob(wavBlob);
      setAudioLoading(false);

      const durationMs = Math.round(performance.now() - startTime);

      const report: ReconstructionReport = {
        id: `rec-aud-${Date.now()}`,
        modality: 'audio',
        fileName: audioFile.name,
        fileSizeBytes: audioFile.size,
        damageDescription: `Detected ${stats.clicksDetected} click transients and ${stats.dropoutsDetected} silent dropouts (${stats.totalDropoutDurationMs} ms total lost signal). Estimated noise floor: ${stats.noiseFloorEstimateDb} dB.`,
        damageMetrics: {
          corruptedSamples: Math.round((stats.totalDropoutDurationMs / 1000) * sampleRate),
        },
        reconstructionSummary: `Restored silent signal dropouts with autoregressive linear-prediction interpolation, suppressed impulse clicks, and applied spectral gating hiss reduction with gentle peak normalization.`,
        methodUsed: 'Web Audio Linear-Prediction Interpolation & Spectral Gating',
        measuredTimeMs: durationMs,
        disclaimer: "Missing parts are estimated from the visible parts and may not match the original exactly.",
        timestamp: Date.now(),
      };

      const item: HistoryItem = {
        id: report.id,
        modality: 'audio',
        fileName: audioFile.name,
        timestamp: report.timestamp,
        methodUsed: report.methodUsed,
        report,
        originalBlob: audioFile,
        reconstructedBlob: wavBlob,
      };

      onReconstructionComplete(item);
    } catch (err: any) {
      console.error('Audio reconstruction error:', err);
      setAudioError(err.message || 'Audio reconstruction failed.');
      setAudioLoading(false);
    }
  };

  const downloadAudioResult = () => {
    if (!audioResultBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(audioResultBlob);
    a.download = `reconstructed_${audioFile?.name || 'space_signal.wav'}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // =============================================================
  // TEXT HANDLERS
  // =============================================================
  const handleLoadSampleText = () => {
    setTextInput(SAMPLE_CORRUPTED_TEXT);
    setTextResult(null);
    setTextHighlightedTokens([]);
    setTextError(null);
  };

  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setTextInput(content);
      setTextResult(null);
      setTextHighlightedTokens([]);
      setTextError(null);
    };
    reader.readAsText(file);
  };

  const clearText = () => {
    setTextInput('');
    setTextResult(null);
    setTextHighlightedTokens([]);
    setTextError(null);
    if (textInputRef.current) textInputRef.current.value = '';
  };

  const runTextReconstruction = async () => {
    if (!textInput.trim()) return;
    setTextLoading(true);
    setTextError(null);
    setTextProgress(20);
    setTextStatusText('Reconstructing... please wait.');
    const startTime = performance.now();

    try {
      let finalReconstructed = '';
      let methodUsed = '';
      let tokens: Array<{ original: string; reconstructed?: string; isCorrupted: boolean }> = [];
      let corruptedCount = 0;

      // Check if WebGPU is available for browser Llama-3.2-1B-Instruct
      const webGpuAvailable = await isWebGpuSupported();

      if (webGpuAvailable) {
        setTextProgress(40);
        setTextStatusText('Getting ready (first time only) — loading Llama 3.2 1B in browser...');
        try {
          // Dynamic import of webllm to keep initial bundle light
          const webllm = await import('@mlc-ai/web-llm');
          const engine = await webllm.CreateMLCEngine(
            'Llama-3.2-1B-Instruct-q4f16_1-MLC',
            {
              initProgressCallback: (report) => {
                const pct = Math.min(90, Math.round(report.progress * 100));
                setTextProgress(pct);
                setTextStatusText(`Getting ready (first time only): ${report.text}`);
              },
            }
          );

          setTextProgress(92);
          setTextStatusText('Llama restoring space telemetry log...');

          const completion = await engine.chat.completions.create({
            messages: [
              {
                role: 'system',
                content:
                  'You are an astronomical telemetry decoder. Restore the missing or corrupted words marked with ____ or noisy characters (?, #, @) in the space log. Return ONLY the restored log text without preamble or commentary.',
              },
              { role: 'user', content: textInput },
            ],
            temperature: 0.2,
          });

          finalReconstructed = completion.choices[0]?.message?.content || '';
          methodUsed = 'Llama-3.2-1B-Instruct (Browser WebGPU)';
          const localParsed = reconstructTextLocal(textInput);
          tokens = localParsed.tokens;
          corruptedCount = localParsed.corruptedCount;
        } catch (llamaErr: any) {
          console.warn('WebLLM run failed, falling back to local space lexicon:', llamaErr);
          const localResult = reconstructTextLocal(textInput);
          finalReconstructed = localResult.reconstructedText;
          tokens = localResult.tokens;
          corruptedCount = localResult.corruptedCount;
          methodUsed = 'Local Context Grammar & Space Lexicon (WebGPU engine error fallback)';
        }
      } else {
        // Fallback as explicitly requested by prompt
        const localResult = reconstructTextLocal(textInput);
        finalReconstructed = localResult.reconstructedText;
        tokens = localResult.tokens;
        corruptedCount = localResult.corruptedCount;
        methodUsed = 'Local Space Lexicon & Context Grammar (WebGPU not available on this device)';
      }

      setTextResult(finalReconstructed);
      setTextHighlightedTokens(tokens);
      setTextLoading(false);

      const durationMs = Math.round(performance.now() - startTime);

      const report: ReconstructionReport = {
        id: `rec-txt-${Date.now()}`,
        modality: 'text',
        fileName: 'telemetry_log.txt',
        fileSizeBytes: new Blob([textInput]).size,
        damageDescription: `Found ${corruptedCount} missing (____) or noise-corrupted (?, #, @) words across deep space transmission record.`,
        damageMetrics: {
          damagedWordsCount: corruptedCount,
        },
        reconstructionSummary: `Restored ${corruptedCount} corrupted terms using ${methodUsed} without altering contextual meaning.`,
        methodUsed,
        measuredTimeMs: durationMs,
        disclaimer: "Missing parts are estimated from the visible parts and may not match the original exactly.",
        timestamp: Date.now(),
      };

      const item: HistoryItem = {
        id: report.id,
        modality: 'text',
        fileName: 'telemetry_log.txt',
        timestamp: report.timestamp,
        methodUsed,
        report,
        originalText: textInput,
        reconstructedText: finalReconstructed,
      };

      onReconstructionComplete(item);
    } catch (err: any) {
      console.error('Text reconstruction error:', err);
      setTextError(err.message || 'Text reconstruction failed.');
      setTextLoading(false);
    }
  };

  const downloadTextResult = () => {
    if (!textResult) return;
    const blob = new Blob([textResult], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'reconstructed_space_telemetry.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Helper for progress bar
  const renderProgressBar = (progress: number, statusText: string) => (
    <div className="space-y-2 py-3">
      <div className="flex items-center justify-between text-xs text-cyan-300 font-mono">
        <span className="truncate pr-2">{statusText || 'Reconstructing... please wait.'}</span>
        <span className="tabular-nums font-semibold shrink-0">{progress}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );

  return (
    <section id="reconstruct" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* 2x2 Grid, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* ========================================================= */}
        {/* 1. IMAGE RECONSTRUCTION BOX */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-cyan-500/15 bg-white/[0.03] backdrop-blur-md p-5 sm:p-6 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
          <div>
            {/* Box Header */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">Image</h3>
              </div>

              <button
                type="button"
                onClick={handleLoadSampleImage}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Try space sample</span>
              </button>
            </div>

            {/* Upload Area & Reconstruct Button */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-4">
              <div
                onClick={() => imageInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleImageSelect(e.dataTransfer.files[0]);
                }}
                className={`flex-1 min-h-[90px] border border-dashed rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  imageFile
                    ? 'border-cyan-500/50 bg-cyan-950/20'
                    : 'border-slate-700/80 hover:border-cyan-500/40 bg-slate-950/40'
                }`}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleImageSelect(e.target.files[0]);
                  }}
                />

                {imageOriginalUrl ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3 truncate">
                      <img
                        src={imageOriginalUrl}
                        alt="Damaged preview"
                        className="w-14 h-14 object-cover rounded-lg border border-cyan-500/30 shrink-0"
                      />
                      <div className="truncate">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {imageFile?.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearImage();
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-2"
                      aria-label="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-slate-400 w-full justify-center py-2">
                    <UploadCloud className="w-5 h-5 text-cyan-400 shrink-0" />
                    <span className="text-xs">Drag & drop damaged space image or click</span>
                  </div>
                )}
              </div>

              {/* Reconstruct Button */}
              <button
                type="button"
                disabled={!imageFile || imageLoading}
                onClick={runImageReconstruction}
                className="px-5 py-3 rounded-xl font-medium text-xs whitespace-nowrap bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                {imageLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Working</span>
                  </>
                ) : (
                  <span>Reconstruct</span>
                )}
              </button>
            </div>

            {/* Progress bar */}
            {imageLoading && renderProgressBar(imageProgress, imageStatusText)}

            {/* Error Message */}
            {imageError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{imageError}</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (imageError?.includes('protobuf') || imageError?.includes('model')) {
                      await clearCachedModel();
                    }
                    runImageReconstruction();
                  }}
                  className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs transition-colors shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Before / After Slider Result */}
            {imageOriginalUrl && imageResultUrl && (
              <div className="mt-2 space-y-3">
                <BeforeAfterSlider
                  beforeUrl={imageOriginalUrl}
                  afterUrl={imageResultUrl}
                  beforeLabel="Damaged"
                  afterLabel="Reconstructed"
                />

                <button
                  type="button"
                  onClick={downloadImageResult}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Reconstructed PNG</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. VIDEO RECONSTRUCTION BOX */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-cyan-500/15 bg-white/[0.03] backdrop-blur-md p-5 sm:p-6 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
          <div>
            {/* Box Header */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <VideoIcon className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">Video</h3>
              </div>

              <button
                type="button"
                onClick={handleLoadSampleVideo}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Try space sample</span>
              </button>
            </div>

            {/* Upload Area & Reconstruct Button */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-4">
              <div
                onClick={() => videoInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleVideoSelect(e.dataTransfer.files[0]);
                }}
                className={`flex-1 min-h-[90px] border border-dashed rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  videoFile
                    ? 'border-cyan-500/50 bg-cyan-950/20'
                    : 'border-slate-700/80 hover:border-cyan-500/40 bg-slate-950/40'
                }`}
              >
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleVideoSelect(e.target.files[0]);
                  }}
                />

                {videoFile ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-14 h-14 rounded-lg bg-black/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <VideoIcon className="w-6 h-6" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {videoFile.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {(videoFile.size / 1024).toFixed(1)} KB (Max 5s)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearVideo();
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-2"
                      aria-label="Remove video"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-slate-400 w-full justify-center py-2">
                    <UploadCloud className="w-5 h-5 text-cyan-400 shrink-0" />
                    <span className="text-xs">Drag & drop space MP4 (up to 5s) or click</span>
                  </div>
                )}
              </div>

              {/* Reconstruct Button */}
              <button
                type="button"
                disabled={!videoFile || videoLoading}
                onClick={runVideoReconstruction}
                className="px-5 py-3 rounded-xl font-medium text-xs whitespace-nowrap bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                {videoLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Working</span>
                  </>
                ) : (
                  <span>Reconstruct</span>
                )}
              </button>
            </div>

            {/* Progress bar */}
            {videoLoading && renderProgressBar(videoProgress, videoStatusText)}

            {/* Error Message */}
            {videoError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{videoError}</span>
                </div>
                <button
                  type="button"
                  onClick={runVideoReconstruction}
                  className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs transition-colors shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Before / After Video Player */}
            {videoOriginalUrl && videoResultUrl && (
              <div className="mt-2 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 mb-1 block">Damaged</span>
                    <video
                      src={videoOriginalUrl}
                      controls
                      loop
                      playsInline
                      className="w-full aspect-video rounded-lg border border-slate-800 bg-black object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-cyan-400 mb-1 block">Reconstructed</span>
                    <video
                      src={videoResultUrl}
                      controls
                      loop
                      playsInline
                      className="w-full aspect-video rounded-lg border border-cyan-500/30 bg-black object-contain"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={downloadVideoResult}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Reconstructed Video</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. AUDIO RECONSTRUCTION BOX */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-cyan-500/15 bg-white/[0.03] backdrop-blur-md p-5 sm:p-6 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
          <div>
            {/* Box Header */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Music className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">Audio</h3>
              </div>

              <button
                type="button"
                onClick={handleLoadSampleAudio}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Try space sample</span>
              </button>
            </div>

            {/* Upload Area & Reconstruct Button */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-4">
              <div
                onClick={() => audioInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleAudioSelect(e.dataTransfer.files[0]);
                }}
                className={`flex-1 min-h-[90px] border border-dashed rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  audioFile
                    ? 'border-cyan-500/50 bg-cyan-950/20'
                    : 'border-slate-700/80 hover:border-cyan-500/40 bg-slate-950/40'
                }`}
              >
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/wav,audio/mp3,audio/mpeg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleAudioSelect(e.target.files[0]);
                  }}
                />

                {audioFile ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-14 h-14 rounded-lg bg-black/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                        <Music className="w-6 h-6" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {audioFile.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {(audioFile.size / 1024).toFixed(1)} KB (WAV / MP3)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAudio();
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-2"
                      aria-label="Remove audio"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-slate-400 w-full justify-center py-2">
                    <UploadCloud className="w-5 h-5 text-cyan-400 shrink-0" />
                    <span className="text-xs">Drag & drop space WAV or MP3, or click</span>
                  </div>
                )}
              </div>

              {/* Reconstruct Button */}
              <button
                type="button"
                disabled={!audioFile || audioLoading}
                onClick={runAudioReconstruction}
                className="px-5 py-3 rounded-xl font-medium text-xs whitespace-nowrap bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                {audioLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Working</span>
                  </>
                ) : (
                  <span>Reconstruct</span>
                )}
              </button>
            </div>

            {/* Progress bar */}
            {audioLoading && renderProgressBar(audioProgress, audioStatusText)}

            {/* Error Message */}
            {audioError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{audioError}</span>
                </div>
                <button
                  type="button"
                  onClick={runAudioReconstruction}
                  className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs transition-colors shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Dual Audio Players: Damaged vs Reconstructed */}
            {audioOriginalBlob && audioResultBlob && (
              <div className="mt-2 space-y-3">
                <AudioPlayerWaveform
                  label="Damaged Signal"
                  blob={audioOriginalBlob}
                  highlightColor="#94a3b8"
                />
                <AudioPlayerWaveform
                  label="Reconstructed Clean Signal"
                  blob={audioResultBlob}
                  highlightColor="#06b6d4"
                />

                <button
                  type="button"
                  onClick={downloadAudioResult}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Reconstructed WAV</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 4. TEXT RECONSTRUCTION BOX */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-cyan-500/15 bg-white/[0.03] backdrop-blur-md p-5 sm:p-6 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
          <div>
            {/* Box Header */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">Text</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleText}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Try space sample</span>
                </button>
                {textInput && (
                  <button
                    type="button"
                    onClick={clearText}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Clear text input"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Text Paste / Upload Area */}
            <div className="space-y-3 mb-4">
              <textarea
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                  setTextResult(null);
                  setTextHighlightedTokens([]);
                  setTextError(null);
                }}
                rows={4}
                placeholder="Paste corrupted space telemetry log, or drop file with gaps (____) and noise (?, #, @)..."
                className="w-full rounded-xl bg-slate-950/50 border border-slate-700/80 focus:border-cyan-500/60 p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-colors resize-none font-mono"
              />

              <div className="flex items-center justify-between gap-3">
                <label className="text-xs text-slate-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1.5 transition-colors">
                  <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Upload .txt file</span>
                  <input
                    ref={textInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    className="hidden"
                    onChange={handleTextFileUpload}
                  />
                </label>

                {/* Reconstruct Button */}
                <button
                  type="button"
                  disabled={!textInput.trim() || textLoading}
                  onClick={runTextReconstruction}
                  className="px-5 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {textLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Working</span>
                    </>
                  ) : (
                    <span>Reconstruct</span>
                  )}
                </button>
              </div>
            </div>

            {/* Progress bar */}
            {textLoading && renderProgressBar(textProgress, textStatusText)}

            {/* Error Message */}
            {textError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{textError}</span>
                </div>
                <button
                  type="button"
                  onClick={runTextReconstruction}
                  className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs transition-colors shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Restored Text with Changed Words Highlighted */}
            {textResult && (
              <div className="mt-2 space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-xs font-mono leading-relaxed text-slate-200 select-text max-h-48 overflow-y-auto">
                  {textHighlightedTokens.length > 0 ? (
                    textHighlightedTokens.map((t, idx) => {
                      if (t.isCorrupted && t.reconstructed) {
                        return (
                          <span
                            key={idx}
                            title={`Restored from: ${t.original}`}
                            className="text-cyan-300 font-semibold underline decoration-cyan-500/50 underline-offset-2"
                          >
                            {t.reconstructed}{' '}
                          </span>
                        );
                      }
                      return <span key={idx}>{t.original}{' '}</span>;
                    })
                  ) : (
                    <span>{textResult}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={downloadTextResult}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Restored TXT</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
