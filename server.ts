import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const UPLOAD_DIR = '/tmp/astra_uploads';
const RESULTS_DIR = '/tmp/astra_results';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(RESULTS_DIR, { recursive: true });

// Setup multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const unique = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    system: 'ASTRA Multimodal Space Data Reconstruction Engine',
    capabilities: ['audio_restoration', 'video_restoration', 'document_reconstruction', 'image_inpainting'],
  });
});

// Audio reconstruction endpoint
app.post('/api/reconstruct/audio', upload.single('audio'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio file uploaded.' });
    return;
  }

  const inputPath = req.file.path;
  const fileId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const scriptPath = path.resolve(__dirname, 'scripts/audio_restoration.py');

  try {
    const py = spawn('python3', [scriptPath, inputPath, RESULTS_DIR, fileId]);
    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    py.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    py.on('close', (code) => {
      // Clean up uploaded temp file
      try {
        fs.unlinkSync(inputPath);
      } catch {}

      if (code !== 0) {
        console.error('Audio reconstruction script error:', stderrData);
        res.status(500).json({
          error: 'Audio reconstruction failed in DSP pipeline.',
          details: stderrData,
        });
        return;
      }

      try {
        const result = JSON.parse(stdoutData.trim());
        result.wavDownloadUrl = `/api/download/audio/${fileId}/wav`;
        result.mp3DownloadUrl = `/api/download/audio/${fileId}/mp3`;
        result.originalFileName = req.file?.originalname || 'space_audio';
        res.json(result);
      } catch (err: any) {
        res.status(500).json({
          error: 'Failed to parse reconstruction telemetry output.',
          raw: stdoutData,
        });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal audio processing failure.' });
  }
});

// Video reconstruction endpoint
app.post('/api/reconstruct/video', upload.single('video'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No video file uploaded.' });
    return;
  }

  const inputPath = req.file.path;
  const fileId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const scriptPath = path.resolve(__dirname, 'scripts/video_restoration.py');

  try {
    const py = spawn('python3', [scriptPath, inputPath, RESULTS_DIR, fileId]);
    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    py.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    py.on('close', (code) => {
      try {
        fs.unlinkSync(inputPath);
      } catch {}

      if (code !== 0) {
        console.error('Video reconstruction script error:', stderrData);
        res.status(500).json({
          error: 'Video reconstruction failed in temporal inpainting pipeline.',
          details: stderrData,
        });
        return;
      }

      try {
        const result = JSON.parse(stdoutData.trim());
        result.mp4DownloadUrl = `/api/download/video/${fileId}/mp4`;
        result.originalFileName = req.file?.originalname || 'space_video';
        res.json(result);
      } catch (err: any) {
        res.status(500).json({
          error: 'Failed to parse video reconstruction telemetry output.',
          raw: stdoutData,
        });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal video processing failure.' });
  }
});

// Audio download endpoint
app.get('/api/download/audio/:fileId/:format', (req: Request, res: Response) => {
  const { fileId, format } = req.params;
  const ext = format === 'mp3' ? 'mp3' : 'wav';
  const filePath = path.join(RESULTS_DIR, `${fileId}_restored.${ext}`);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Requested audio file not found or expired.' });
    return;
  }

  res.setHeader('Content-Type', ext === 'mp3' ? 'audio/mpeg' : 'audio/wav');
  res.setHeader('Content-Disposition', `attachment; filename="reconstructed_space_signal.${ext}"`);
  fs.createReadStream(filePath).pipe(res);
});

// Video download endpoint
app.get('/api/download/video/:fileId/mp4', (req: Request, res: Response) => {
  const { fileId } = req.params;
  const filePath = path.join(RESULTS_DIR, `${fileId}_reconstructed.mp4`);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Requested video file not found or expired.' });
    return;
  }

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', 'attachment; filename="reconstructed_space_video.mp4"');
  fs.createReadStream(filePath).pipe(res);
});

// Thumbnail download endpoint for scrubber frames
app.get('/api/download/thumb/:fileId/:filename', (req: Request, res: Response) => {
  const { fileId, filename } = req.params;
  // Sanitize filename to prevent directory traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(RESULTS_DIR, `${fileId}_thumbs`, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Thumbnail not found');
    return;
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

// Initialize Dev or Prod Vite integration
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ASTRA full-stack reconstruction server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
