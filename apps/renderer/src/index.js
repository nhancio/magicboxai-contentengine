import express from 'express';
import cors from 'cors';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Point to the Remotion project in the web app
const remotionRoot = path.resolve(__dirname, '../../web/src/remotion/entry.ts');

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
    const outputDir = path.resolve(__dirname, '../out');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    
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

const PORT = process.env.PORT || 8005;
app.listen(PORT, () => {
  console.log(`Remotion Rendering Worker listening on port ${PORT}`);
});
