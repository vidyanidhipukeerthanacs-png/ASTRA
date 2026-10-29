export type ModalityType = 'image' | 'video' | 'audio' | 'text';

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
}
