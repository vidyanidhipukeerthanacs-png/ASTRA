/**
 * Browser-native Text Reconstruction Engine
 * Restores space mission telemetry logs, scientific records, and observational notes.
 * - Detects missing words (____ gaps), noise characters (?, #, @), and truncated words.
 * - Runs Llama-3.2-1B-Instruct via WebLLM when WebGPU is available.
 * - Falls back to domain-aware local context & space dictionary when WebGPU is unavailable.
 */

export interface CorruptedToken {
  index: number;
  original: string;
  isCorrupted: boolean;
  reconstructed?: string;
  reason?: string;
}

export interface TextReconstructionResult {
  originalText: string;
  reconstructedText: string;
  tokens: CorruptedToken[];
  corruptedCount: number;
  methodUsed: string;
}

// Deep space and astronomical mission lexicon
export const SPACE_LEXICON = [
  'transmission', 'telemetry', 'trajectory', 'orbit', 'orbital', 'signal', 'frequency',
  'propulsion', 'spacecraft', 'sensor', 'sensors', 'communication', 'communications',
  'planetary', 'lunar', 'cosmic', 'radiation', 'galaxy', 'galaxies', 'star', 'stars',
  'spectrum', 'spectroscopy', 'velocity', 'altitude', 'calibration', 'calibrated',
  'mission', 'earth', 'mars', 'jupiter', 'saturn', 'venus', 'mercury', 'neptune', 'uranus',
  'satellite', 'battery', 'temperature', 'pressure', 'magnetic', 'payload', 'payloads',
  'antenna', 'downlink', 'uplink', 'deep', 'space', 'network', 'station', 'observatory',
  'hubble', 'webb', 'telescope', 'astronomical', 'celestial', 'exoplanet', 'nebula',
  'supernova', 'pulsar', 'quasar', 'magnetosphere', 'ionosphere', 'atmosphere',
  'solar', 'corona', 'flare', 'wind', 'voyager', 'perseverance', 'curiosity', 'artemis',
  'apollo', 'horizon', 'rendezvous', 'docking', 'maneuver', 'insertion', 'apogee',
  'perigee', 'perihelion', 'aphelion', 'thruster', 'attitude', 'navigation', 'inertial',
  'spectrometer', 'radiometer', 'photometer', 'detector', 'optical', 'infrared',
  'ultraviolet', 'x-ray', 'gamma', 'wavelength', 'frequency', 'doppler', 'shift',
  'anomaly', 'nominal', 'critical', 'status', 'system', 'subsystem', 'vector', 'coordinates'
];

/**
 * Checks if a token shows signs of corruption (?, #, @, _, etc.)
 */
export function isTokenCorrupted(token: string): boolean {
  const clean = token.trim();
  if (!clean) return false;

  // Underscore gaps: e.g. ____ or __
  if (/^_{2,}$/.test(clean) || clean.includes('___')) return true;

  // Noise characters in word
  if (/[#@?%*^$]/.test(clean)) return true;

  // Truncated trailing hyphen attached to partial word (e.g., 'tele-')
  if (/^[a-zA-Z]{2,}-$/.test(clean)) return true;

  return false;
}

/**
 * Finds the closest dictionary word for a noisy/corrupted token
 */
export function repairCorruptedWord(token: string, previousWord?: string, nextWord?: string): string {
  // Strip punctuation around token while preserving noise chars inside
  const match = token.match(/^([^a-zA-Z0-9_#@?%*^$]*)(.*?)([^a-zA-Z0-9_#@?%*^$]*)$/);
  const prefix = match ? match[1] : '';
  const core = match ? match[2] : token;
  const suffix = match ? match[3] : '';

  const lowerCore = core.toLowerCase();

  // If blank ____, infer from adjacent context collocations
  if (/^_{2,}$/.test(lowerCore) || lowerCore.includes('___')) {
    const prev = (previousWord || '').toLowerCase().replace(/[^a-z]/g, '');
    const next = (nextWord || '').toLowerCase().replace(/[^a-z]/g, '');

    if (prev === 'deep') return `${prefix}space${suffix}`;
    if (next === 'space') return `${prefix}deep${suffix}`;
    if (prev === 'orbital' || next === 'insertion') return `${prefix}trajectory${suffix}`;
    if (prev === 'solar' || next === 'radiation' || next === 'storm') return `${prefix}flare${suffix}`;
    if (prev === 'radio' || next === 'frequency' || next === 'carrier') return `${prefix}signal${suffix}`;
    if (prev === 'space' || next === 'telescope') return `${prefix}station${suffix}`;
    if (next === 'nominal' || prev === 'all') return `${prefix}systems${suffix}`;
    if (prev === 'lunar' || next === 'module') return `${prefix}orbit${suffix}`;
    if (prev === 'sensor' || next === 'data') return `${prefix}calibration${suffix}`;
    return `${prefix}signal${suffix}`;
  }

  // Regex pattern matching for words with ?, #, @ wildcards
  // Convert #, @, ?, % to single-letter wildcard '.'
  const patternStr = '^' + lowerCore
    .replace(/[#@?%*^$]/g, '.')
    .replace(/-$/, '.*') + '$';

  try {
    const regex = new RegExp(patternStr);
    for (const word of SPACE_LEXICON) {
      if (regex.test(word)) {
        return preserveCasing(core, word, prefix, suffix);
      }
    }
  } catch {
    // fallback if regex special chars fail
  }

  // Levenshtein / character overlap matching if exact regex didn't hit
  let bestWord = core;
  let highestScore = -1;

  for (const candidate of SPACE_LEXICON) {
    if (Math.abs(candidate.length - lowerCore.length) > 3) continue;

    let matchingLetters = 0;
    const minLen = Math.min(candidate.length, lowerCore.length);
    for (let c = 0; c < minLen; c++) {
      const ch = lowerCore[c];
      if (ch === candidate[c]) {
        matchingLetters++;
      } else if (/[#@?%*^$]/.test(ch)) {
        matchingLetters += 0.7; // wildcard matches
      }
    }

    const score = matchingLetters / Math.max(candidate.length, lowerCore.length);
    if (score > highestScore && score >= 0.55) {
      highestScore = score;
      bestWord = candidate;
    }
  }

  if (highestScore >= 0.55) {
    return preserveCasing(core, bestWord, prefix, suffix);
  }

  // If no good dictionary candidate, strip noise chars cleanly
  const cleaned = core.replace(/[#@?%*^$]/g, '');
  return `${prefix}${cleaned || 'data'}${suffix}`;
}

function preserveCasing(original: string, replacement: string, prefix: string, suffix: string): string {
  if (original.length > 0 && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return `${prefix}${replacement}${suffix}`;
}

/**
 * Parses and reconstructs text using local context and dictionary
 */
export function reconstructTextLocal(text: string): TextReconstructionResult {
  const rawTokens = text.split(/(\s+)/);
  const tokens: CorruptedToken[] = [];
  let corruptedCount = 0;
  const reconstructedTokens: string[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    // Check if whitespace
    if (/^\s+$/.test(token)) {
      reconstructedTokens.push(token);
      continue;
    }

    const isCorrupt = isTokenCorrupted(token);
    if (isCorrupt) {
      corruptedCount++;
      const prevWord = rawTokens[i - 2];
      const nextWord = rawTokens[i + 2];
      const repaired = repairCorruptedWord(token, prevWord, nextWord);

      tokens.push({
        index: i,
        original: token,
        isCorrupted: true,
        reconstructed: repaired,
      });
      reconstructedTokens.push(repaired);
    } else {
      tokens.push({
        index: i,
        original: token,
        isCorrupted: false,
      });
      reconstructedTokens.push(token);
    }
  }

  return {
    originalText: text,
    reconstructedText: reconstructedTokens.join(''),
    tokens,
    corruptedCount,
    methodUsed: 'Space Lexicon & Context Grammar (Local)',
  };
}

/**
 * Checks whether WebGPU is supported by the client browser
 */
export async function isWebGpuSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false;
  }
  try {
    const adapter = await (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}
