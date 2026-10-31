import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTokenCorrupted,
  repairCorruptedWord,
  reconstructTextLocal,
} from './textReconstruction';

test('isTokenCorrupted identifies missing underscores and noise symbols', () => {
  assert.equal(isTokenCorrupted('____'), true);
  assert.equal(isTokenCorrupted('tr#nsm?ssion'), true);
  assert.equal(isTokenCorrupted('tel@metry'), true);
  assert.equal(isTokenCorrupted('tele-'), true);
  assert.equal(isTokenCorrupted('nominal'), false);
  assert.equal(isTokenCorrupted('orbit'), false);
  assert.equal(isTokenCorrupted('3.1415'), false);
});

test('repairCorruptedWord reconstructs corrupted space words correctly', () => {
  assert.equal(repairCorruptedWord('tr#nsm?ssion'), 'transmission');
  assert.equal(repairCorruptedWord('tel@metry'), 'telemetry');
  assert.equal(repairCorruptedWord('o?bit'), 'orbit');
  assert.equal(repairCorruptedWord('S?gn@l'), 'Signal');
  assert.equal(repairCorruptedWord('sp@cecraft'), 'spacecraft');
  assert.equal(repairCorruptedWord('____', 'deep', 'network'), 'space');
  assert.equal(repairCorruptedWord('____', 'orbital', 'insertion'), 'trajectory');
});

test('reconstructTextLocal processes full transmission log with highlight tokens', () => {
  const corruptedLog = 'Voyager 1 deep ____ carrier s?gn@l detected. All systems nominal. Downlink tel@metry locked.';
  const result = reconstructTextLocal(corruptedLog);

  assert.equal(result.corruptedCount, 3);
  assert.ok(result.reconstructedText.includes('space'));
  assert.ok(result.reconstructedText.includes('signal'));
  assert.ok(result.reconstructedText.includes('telemetry'));
  assert.equal(result.tokens.filter((t: any) => t.isCorrupted).length, 3);
});
