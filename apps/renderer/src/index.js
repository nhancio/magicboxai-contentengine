import express from 'express';
import cors from 'cors';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { composeVideo } from './ffmpeg/composer.js';
import { materializeRemoteManifest } from './ffmpeg/assets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Point to the Remotion project in the web app
const remotionRoot = path.resolve(__dirname, '../../web/src/remotion/entry.ts');
const outputDir = path.resolve(__dirname, '../out');
const workRoot = path.resolve(process.env.RENDERER_WORK_ROOT || path.join(__dirname, '../tmp'));
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(workRoot)) fs.mkdirSync(workRoot, { recursive: true });
app.use('/outputs', express.static(outputDir, { fallthrough: false, maxAge: '1h' }));

function requireInternalRendererToken(req, res, next) {
  const expected = process.env.RENDERER_TOKEN;
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'RENDERER_TOKEN is required in production' });
    }
    return next();
  }
  const authorization = req.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return res.status(401).json({ error: 'unauthorized renderer request' });
  }
  return next();
}

const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Magicbox AI Video Renderer API',
    version: '1.0.0',
    description: 'Remotion & FFmpeg Video Generation, Composition, and Export Engine',
  },
  servers: [{ url: '/', description: 'Renderer Server' }],
  tags: [
    { name: 'Health', description: 'Renderer health and capabilities' },
    { name: 'Render', description: 'Remotion video rendering jobs' },
    { name: 'Compose', description: 'FFmpeg multi-track video composition' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Renderer Health & Capability Status',
        responses: { 200: { description: 'Health status' } },
      },
    },
    '/api/render': {
      post: {
        tags: ['Render'],
        summary: 'Execute Remotion Video Render Job',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Render completed' } },
      },
    },
    '/api/compose-video': {
      post: {
        tags: ['Compose'],
        summary: 'Compose Multi-track Video with FFmpeg',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { 200: { description: 'Composition completed' } },
      },
    },
  },
};

const swaggerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Magicbox AI Video Renderer API - Swagger UI</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
<style>body { margin: 0; padding: 0; }</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
window.ui = SwaggerUIBundle({
  url: '/openapi.json',
  dom_id: '#swagger-ui',
  layout: 'BaseLayout',
  deepLinking: true,
  showExtensions: true,
  showCommonExtensions: true,
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset]
});
</script>
</body>
</html>`;

app.get('/openapi.json', (_req, res) => res.json(openapiSpec));
app.get(['/api/docs', '/api/docs/'], (_req, res) => res.send(swaggerHtml));

app.get('/health', async (_req, res) => {
  res.json({
    ok: true,
    remotion: true,
    ffmpegComposition: true,
    durableStorage: false,
  });
});

app.post('/api/render', async (req, res) => {
  const { templateId, props, videoId, userId } = req.body;

  if (!templateId || !props) {
    return res.status(400).json({ error: 'templateId and props are required' });
  }

  try {
    console.log(`[Renderer] Starting render for template: ${templateId}`);
    
    // 1. Bundle the Remotion project
    const bundled = await bundle({
      entryPoint: remotionRoot,
      webpackOverride: (config) => config,
    });

    console.log(`[Renderer] Bundle created at: ${bundled}`);

    // 2. Select the composition
    const composition = await selectComposition({
      serveUrl: bundled,
      id: templateId,
      inputProps: props,
    });

    console.log(`[Renderer] Composition selected: ${composition.id}`);

    // 3. Render the video
    const outputLocation = path.join(outputDir, `${videoId || 'video'}.mp4`);

    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: 'h264',
      outputLocation,
      inputProps: props,
      onProgress: ({ progress }) => {
        console.log(`[Renderer] Progress: ${Math.round(progress * 100)}%`);
      }
    });

    console.log(`[Renderer] Render complete: ${outputLocation}`);

    // 4. Respond with success (In a real app, upload to GCS/S3 here)
    res.json({ 
      success: true, 
      status: 'completed',
      videoPath: outputLocation, 
      duration: composition.durationInFrames / composition.fps 
    });

  } catch (err) {
    console.error(`[Renderer] Error rendering video:`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Declarative FFmpeg composition endpoint.
 *
 * Remote assets are downloaded into an isolated workspace with HTTPS, DNS,
 * MIME, redirect, and byte-limit checks before FFmpeg sees them.
 */
app.post('/api/compose', requireInternalRendererToken, async (req, res) => {
  const jobId = crypto.randomUUID();
  const inputDir = await fs.promises.mkdtemp(path.join(workRoot, `input-${jobId}-`));
  const outputLocation = path.join(outputDir, `${jobId}.mp4`);

  try {
    const allowedHosts = (process.env.MEDIA_ALLOWED_HOSTS || '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean);
    if (process.env.NODE_ENV === 'production' && allowedHosts.length === 0) {
      throw new Error('MEDIA_ALLOWED_HOSTS is required in production');
    }
    const manifest = await materializeRemoteManifest(req.body?.manifest, {
      workspace: inputDir,
      allowedHosts,
    });
    const result = await composeVideo({
      manifest,
      inputRoot: inputDir,
      outputPath: outputLocation,
      workRoot,
      onProgress: (progress) => {
        console.log(`[FFmpeg:${jobId}]`, progress);
      },
    });
    const publicBase = process.env.RENDERER_PUBLIC_BASE_URL?.replace(/\/+$/, '');
    res.json({
      success: true,
      status: 'completed',
      jobId,
      ...result,
      videoUrl: publicBase ? `${publicBase}/outputs/${jobId}.mp4` : undefined,
      durable: false,
    });
  } catch (error) {
    console.error(`[FFmpeg:${jobId}] composition failed`, error);
    await fs.promises.rm(outputLocation, { force: true });
    res.status(400).json({
      success: false,
      status: 'failed',
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await fs.promises.rm(inputDir, { recursive: true, force: true });
  }
});

const PORT = process.env.PORT || 8005;
app.listen(PORT, () => {
  console.log(`MagicBox Remotion + FFmpeg worker listening on port ${PORT}`);
});
