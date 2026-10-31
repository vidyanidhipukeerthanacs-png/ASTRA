import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TEST_DIR = '/tmp/astra_backend_test';
fs.mkdirSync(TEST_DIR, { recursive: true });

test('Audio Pipeline: restores damaged audio and outputs valid WAV and MP3', () => {
  const damagedWav = path.join(TEST_DIR, 'input_damaged.wav');
  
  // Generate a test audio with sine wave + noise + click spikes
  execSync(
    `ffmpeg -y -f lavfi -i "sine=frequency=500:duration=2" -af "anoisesrc=d=2:c=pink:r=44100:a=0.07[n];[0:a][n]amix=inputs=2" "${damagedWav}"`,
    { stdio: 'pipe' }
  );

  const res = spawnSync(
    'python3',
    ['scripts/audio_restoration.py', damagedWav, TEST_DIR, 'test_unit_aud'],
    { encoding: 'utf-8' }
  );

  assert.equal(res.status, 0, `Python script failed: ${res.stderr}`);
  const data = JSON.parse(res.stdout);

  assert.equal(data.success, true);
  assert.ok(fs.existsSync(data.wav_path), 'Reconstructed WAV file must exist');
  assert.ok(fs.existsSync(data.mp3_path), 'Reconstructed MP3 file must exist');
  assert.ok(data.wav_size > 1000, 'WAV size must be non-trivial');
  assert.ok(data.mp3_size > 1000, 'MP3 size must be non-trivial');
  assert.ok(data.metrics.restoredSnrDb >= data.metrics.initialSnrDb, 'SNR must be improved or preserved');
});

test('Audio Pipeline: detects clean audio and leaves it pristine without degradation', () => {
  const cleanWav = path.join(TEST_DIR, 'input_clean.wav');

  // Pure high-SNR sine tone
  execSync(
    `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=1.5" -c:a pcm_s16le "${cleanWav}"`,
    { stdio: 'pipe' }
  );

  const res = spawnSync(
    'python3',
    ['scripts/audio_restoration.py', cleanWav, TEST_DIR, 'test_clean_aud'],
    { encoding: 'utf-8' }
  );

  assert.equal(res.status, 0, `Python script failed: ${res.stderr}`);
  const data = JSON.parse(res.stdout);

  assert.equal(data.success, true);
  assert.equal(data.metrics.isCleanSignal, true, 'Clean signal must be flagged as clean');
  assert.ok(data.method_used.includes('Pristine'), 'Method should preserve pristine signal');
});

test('Video Pipeline: inpaints frames, synchronizes audio track, and exports playable MP4', () => {
  const sampleVid = path.join(TEST_DIR, 'input_video.mp4');

  // Generate 1-second video with audio track
  execSync(
    `ffmpeg -y -f lavfi -i "testsrc=duration=1:size=160x120:rate=10" -f lavfi -i "sine=frequency=440:duration=1" -c:v libx264 -pix_fmt yuv420p -c:a aac "${sampleVid}"`,
    { stdio: 'pipe' }
  );

  const res = spawnSync(
    'python3',
    ['scripts/video_restoration.py', sampleVid, TEST_DIR, 'test_unit_vid'],
    { encoding: 'utf-8' }
  );

  assert.equal(res.status, 0, `Video Python script failed: ${res.stderr}`);
  const data = JSON.parse(res.stdout);

  assert.equal(data.success, true);
  assert.equal(data.has_audio_synced, true, 'Original audio track must be synchronized into reconstructed video');
  assert.ok(fs.existsSync(data.mp4_path), 'Reconstructed MP4 file must exist');
  assert.ok(data.mp4_size > 1000, 'MP4 size must be non-empty');
  assert.ok(data.metrics.psnrDb > 30, 'PSNR metric must be computed');
  assert.ok(data.metrics.ssim > 0.9, 'SSIM metric must be high');
  assert.ok(data.damaged_frames_list.length > 0, 'Frame damage records must be populated');
});
