import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sniffFileType,
  sanitizeDocumentText,
  safeDecodeText,
} from './documentExtractor';

test('sniffFileType identifies PDF and text by magic bytes', () => {
  // %PDF-1.5
  const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]).buffer;
  assert.equal(sniffFileType(pdfHeader, 'corrupted_telemetry.bin'), 'pdf');

  // DOCX zip magic PK\x03\x04
  const docxHeader = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]).buffer;
  assert.equal(sniffFileType(docxHeader, 'report.docx'), 'docx');

  // Plain text
  const textBuffer = new TextEncoder().encode('MISSION TELEMETRY LOG: VOYAGER-1').buffer;
  assert.equal(sniffFileType(textBuffer, 'notes.txt'), 'text');
});

test('sanitizeDocumentText removes /FlateDecode, stream, endobj and binary artifacts', () => {
  const corruptedPdfText = `
4 0 obj
<< /Filter /FlateDecode /Length 284 >>
stream
x\x9c+T0\x00\x00\x01\x19\x00\x9b
endstream
endobj
VOYAGER 1 DEEP SPACE TELEMETRY RECORD
Carrier frequency locked on subcarrier 32.
All spacecraft systems nominal.
`;

  const { text, removedCount } = sanitizeDocumentText(corruptedPdfText);

  assert.ok(removedCount > 0);
  assert.ok(!text.includes('/FlateDecode'));
  assert.ok(!text.includes('endobj'));
  assert.ok(!text.includes('stream'));
  assert.ok(text.includes('VOYAGER 1 DEEP SPACE TELEMETRY RECORD'));
  assert.ok(text.includes('Carrier frequency locked on subcarrier 32.'));
});

test('safeDecodeText handles UTF-8 gracefully', () => {
  const enc = new TextEncoder();
  const raw = enc.encode('Orbital trajectory insertion: nominal status.');
  const decoded = safeDecodeText(raw.buffer);
  assert.equal(decoded, 'Orbital trajectory insertion: nominal status.');
});
