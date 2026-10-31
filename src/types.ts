export type ModalityType = 'image' | 'video' | 'audio' | 'text';

export interface FrameDamageRecord {
  frameIndex: number;
  timestampSec: number;
  hasDamage: boolean;
  damagePercent: number;
  damagedPixels: number;
  anomalyType: 'telemetry_dropout' | 'scanline_loss' | 'sensor_saturation' | 'cosmic_glitch' | 'nominal';
  boundingBox?: { minX: number; minY: number; maxX: number; maxY: number } | null;
  originalThumbnailUrl: string;
  reconstructedThumbnailUrl: string;
  maskThumbnailUrl: string;
}

export interface VideoMetrics {
  psnrDb: number;
  ssim: number;
  temporalContinuity: number; // percentage 0..100
}

export interface VideoReconstructionResult {
  reconstructedBlob: Blob;
  reconstructedUrl: string;
  damageOverlayBlob?: Blob;
  damageOverlayUrl?: string;
  totalFrames: number;
  corruptedFrames: number;
  durationMs: number;
  methodUsed: string;
  damagedFramesList: FrameDamageRecord[];
  metrics: VideoMetrics;
  limitations: string[];
  status: string;
}

export interface TextRestorationItem {
  id: string;
  tokenIndex: number;
  originalSegment: string;
  restoredSegment: string;
  status: 'restored' | 'uncertain' | 'unknown_value';
  confidence: number; // percentage 0..100
  category: 'telemetry_value' | 'lexical_word' | 'acronym' | 'symbol' | 'contextual_gap';
  explanation: string;
}

export interface AudioMetrics {
  initialSnrDb: number;
  restoredSnrDb: number;
  snrGainDb: number;
  thdPercent: number;
  spectralFlatness: number;
  clicksRemoved: number;
  dropoutsInterpolated: number;
  humAttenuatedDb: number;
  clippingCorrectedSamples: number;
  isCleanSignal: boolean;
  channels: number;
  sampleRate: number;
  durationSec: number;
  wavDownloadUrl?: string;
  mp3DownloadUrl?: string;
}

export interface ReconstructionReport {
  id: string;
  modality: ModalityType;
  fileName: string;
  fileSizeBytes: number;
  damageDescription: string;
  damagedAreaPercent?: number; // For images/video
  damageMetrics?: {
    droppedFrames?: number;
    corruptedSamples?: number;
    damagedWordsCount?: number;
  };
  reconstructionSummary: string;
  methodUsed: string;
  measuredTimeMs: number;
  disclaimer: string;
  timestamp: number;
  videoMetrics?: VideoMetrics;
  audioMetrics?: AudioMetrics;
  textItems?: TextRestorationItem[];
}

export interface HistoryItem {
  id: string;
  modality: ModalityType;
  fileName: string;
  timestamp: number;
  methodUsed: string;
  report: ReconstructionReport;
  originalBlob?: Blob;
  reconstructedBlob?: Blob;
  originalUrl?: string;
  reconstructedUrl?: string;
  originalText?: string;
  reconstructedText?: string;
  highlightedIndices?: number[];
  videoMetrics?: VideoMetrics;
  audioMetrics?: AudioMetrics;
  damagedFramesList?: FrameDamageRecord[];
  textItems?: TextRestorationItem[];
}

