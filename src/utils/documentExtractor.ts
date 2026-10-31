/**
 * ASTRA Document & Telemetry Log Extraction Pipeline
 * Supports true content-based file sniffing, PDF text extraction via pdfjs-dist,
 * DOCX extraction via JSZip, image OCR fallback via Tesseract.js,
 * safe text decoding, and strict PDF binary artifact sanitization.
 */

import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure pdfjs worker for browser and node environments
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  // Use unpkg worker matching exact version or inline fallback
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  } catch {
    // fallback
  }
}

export type DetectedFileType = 'pdf' | 'docx' | 'image' | 'text' | 'unknown';

export interface DocumentExtractionResult {
  text: string;
  detectedType: DetectedFileType;
  mimeType: string;
  charCount: number;
  pageCount?: number;
  ocrUsed: boolean;
  sanitizedTokensRemoved: number;
  warnings: string[];
}

/**
 * Sniffs the real file type using magic numbers / content headers
 */
export function sniffFileType(buffer: ArrayBuffer, fileName: string = ''): DetectedFileType {
  const bytes = new Uint8Array(buffer.slice(0, 32));
  if (bytes.length < 4) return 'text';

  // 1. PDF: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }

  // 2. PK ZIP (DOCX / XLSX / etc.): 0x50, 0x4B, 0x03, 0x04
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) {
    // If filename ends with docx or doc, or user uploaded a word document
    if (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')) {
      return 'docx';
    }
    return 'docx';
  }

  // 3. Images (PNG, JPEG, GIF, WEBP)
  // PNG: \x89PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image';
  }
  // JPEG: \xFF\xD8\xFF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image';
  }
  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image';
  }
  // WEBP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image';
  }

  // Fallback check: if first 512 bytes contain %PDF- anywhere in first 32 bytes
  const textPrefix = new TextDecoder('ascii', { fatal: false }).decode(bytes);
  if (textPrefix.includes('%PDF-')) {
    return 'pdf';
  }

  return 'text';
}

/**
 * Sanitizes extracted text to strictly strip any PDF binary stream markers,
 * object declarations, FlateDecode filters, and unprintable byte noise.
 */
export function sanitizeDocumentText(rawText: string): { text: string; removedCount: number } {
  let cleaned = rawText;
  let removedCount = 0;

  // Pattern for PDF syntax tokens that should NEVER appear in extracted readable document text
  const pdfArtifactPatterns = [
    /\/FlateDecode/gi,
    /\/Filter\s*\[?[^\]\n]*\]?/gi,
    /\/Producer\s*\([^)]*\)/gi,
    /\/Length\s+\d+/gi,
    /\/Type\s*\/[A-Za-z0-9]+/gi,
    /\bendobj\b/gi,
    /\b\d+\s+\d+\s+obj\b/gi,
    /\bstream[\r\n]+[\s\S]*?[\r\n]+endstream\b/gi,
    /\bstream\b/gi,
    /\bendstream\b/gi,
    /\bxref[\r\n]+[\s\S]*?trailer\b/gi,
    /\btrailer\s*<<[\s\S]*?>>/gi,
    /\bstartxref[\r\n]+\d+/gi,
    /%PDF-[0-9.]+/gi,
  ];

  for (const pattern of pdfArtifactPatterns) {
    const matches = cleaned.match(pattern);
    if (matches) {
      removedCount += matches.length;
      cleaned = cleaned.replace(pattern, ' ');
    }
  }

  // Strip unprintable control characters except newline, carriage return, tab
  // Also strip replacement character sequences (e.g. repeated )
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  cleaned = cleaned.replace(/\uFFFD{2,}/g, ' [corrupted data] ');

  // Normalize excessive blank lines to max 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return { text: cleaned.trim(), removedCount };
}

/**
 * Extracts text from PDF ArrayBuffer using pdfjs-dist
 */
export async function extractFromPdf(buffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pagesText: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items by vertical position (Y) to reconstruct lines accurately
    const lineMap: Map<number, string[]> = new Map();

    for (const item of content.items as any[]) {
      if (!item.str) continue;
      // Round Y coordinate to group characters on the same line (within 3px tolerance)
      const y = Math.round((item.transform ? item.transform[5] : 0) / 4) * 4;
      const existing = lineMap.get(y) || [];
      existing.push(item.str);
      lineMap.set(y, existing);
    }

    // Sort lines from top (highest Y in PDF coordinates) to bottom
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const pageLines = sortedYs.map((y) => (lineMap.get(y) || []).join(' '));

    pagesText.push(pageLines.join('\n'));
  }

  const combined = pagesText.join('\n\n--- Page Break ---\n\n');
  return { text: combined, pageCount };
}

/**
 * Extracts text from DOCX ArrayBuffer by reading word/document.xml via JSZip
 */
export async function extractFromDocx(buffer: ArrayBuffer): Promise<{ text: string }> {
  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');

  if (!docXmlFile) {
    throw new Error('Invalid DOCX format: word/document.xml missing.');
  }

  const xmlContent = await docXmlFile.async('text');

  // Parse paragraphs <w:p> and text runs <w:t>
  const paragraphs: string[] = [];
  const pRegex = /<w:p(?:[\s>])([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(xmlContent)) !== null) {
    const pBody = pMatch[1];
    const tRegex = /<w:t(?:[\s>][^>]*)?>(.*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    const textPieces: string[] = [];

    while ((tMatch = tRegex.exec(pBody)) !== null) {
      textPieces.push(tMatch[1]);
    }

    if (textPieces.length > 0) {
      paragraphs.push(textPieces.join(''));
    }
  }

  // Fallback regex if specific paragraph structure was minimal
  if (paragraphs.length === 0) {
    const allText = xmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return { text: allText };
  }

  return { text: paragraphs.join('\n\n') };
}

/**
 * OCR helper for scanned PDFs or document photos using Tesseract.js
 */
export async function performOcr(imageSource: string | Blob | HTMLCanvasElement): Promise<string> {
  try {
    // Dynamic import Tesseract to ensure lightweight startup
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const ret = await worker.recognize(imageSource);
    await worker.terminate();
    return ret.data.text || '';
  } catch (err) {
    console.warn('OCR processing error:', err);
    return '';
  }
}

/**
 * Safe text decoding with UTF-8 primary and Latin-1/Windows-1252 fallbacks
 */
export function safeDecodeText(buffer: ArrayBuffer): string {
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(buffer);
  } catch {
    try {
      const winDecoder = new TextDecoder('windows-1252', { fatal: false });
      return winDecoder.decode(buffer);
    } catch {
      const latin1Decoder = new TextDecoder('iso-8859-1', { fatal: false });
      return latin1Decoder.decode(buffer);
    }
  }
}

/**
 * Universal document parser and sanitizer
 */
export async function extractDocumentText(
  file: File | { name: string; buffer: ArrayBuffer }
): Promise<DocumentExtractionResult> {
  const fileName = file.name;
  const buffer = 'arrayBuffer' in file && typeof file.arrayBuffer === 'function'
    ? await file.arrayBuffer()
    : (file as { buffer: ArrayBuffer }).buffer;

  const detectedType = sniffFileType(buffer, fileName);
  let rawText = '';
  let pageCount: number | undefined;
  let ocrUsed = false;
  const warnings: string[] = [];

  if (detectedType === 'pdf') {
    try {
      const pdfRes = await extractFromPdf(buffer);
      rawText = pdfRes.text;
      pageCount = pdfRes.pageCount;

      // If PDF has virtually no extractable text (likely a scanned telemetry chart or document)
      if (rawText.replace(/\s+/g, '').length < 25) {
        warnings.push('PDF contains scanned or rasterized pages; initiating OCR fallback.');
        // If in browser environment with canvas support, render first page for OCR
        if (typeof document !== 'undefined') {
          try {
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d')!;
            await (page.render as any)({ canvasContext: ctx, viewport }).promise;
            const ocrText = await performOcr(canvas);
            if (ocrText.trim().length > rawText.trim().length) {
              rawText = ocrText;
              ocrUsed = true;
            }
          } catch (ocrErr) {
            console.warn('Failed OCR fallback for scanned PDF:', ocrErr);
          }
        }
      }
    } catch (err: any) {
      warnings.push(`PDF parser warning: ${err.message || 'Standard text stream extraction fallback applied'}.`);
      rawText = safeDecodeText(buffer);
    }
  } else if (detectedType === 'docx') {
    try {
      const docxRes = await extractFromDocx(buffer);
      rawText = docxRes.text;
    } catch (err: any) {
      warnings.push(`DOCX extraction warning: ${err.message}.`);
      rawText = safeDecodeText(buffer);
    }
  } else if (detectedType === 'image') {
    ocrUsed = true;
    if (typeof window !== 'undefined') {
      const blob = new Blob([buffer]);
      rawText = await performOcr(blob);
    }
  } else {
    rawText = safeDecodeText(buffer);
  }

  // Sanitize raw text to strip PDF binary objects, FlateDecode tokens, stream codes
  const { text: sanitized, removedCount } = sanitizeDocumentText(rawText);

  if (removedCount > 0) {
    warnings.push(`Sanitized ${removedCount} low-level PDF stream tokens or binary control sequences.`);
  }

  return {
    text: sanitized,
    detectedType,
    mimeType:
      detectedType === 'pdf'
        ? 'application/pdf'
        : detectedType === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : detectedType === 'image'
        ? 'image/*'
        : 'text/plain',
    charCount: sanitized.length,
    pageCount,
    ocrUsed,
    sanitizedTokensRemoved: removedCount,
    warnings,
  };
}
