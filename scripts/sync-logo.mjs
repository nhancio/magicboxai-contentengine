import fs from 'node:fs';
import path from 'node:path';

const srcPng = fs.readFileSync('apps/web/public/logo-512.png');
const base64Png = srcPng.toString('base64');
const dataUri = `data:image/png;base64,${base64Png}`;

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="${dataUri}" width="512" height="512" preserveAspectRatio="xMidYMid meet" />
</svg>
`;

const targets = ['apps/web/public', 'apps/landing/public', 'apps/admin/public'];

for (const dir of targets) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'logo.svg'), svgContent);
  fs.writeFileSync(path.join(dir, 'favicon.svg'), svgContent);
  fs.copyFileSync('apps/web/public/logo-512.png', path.join(dir, 'logo-512.png'));
  fs.copyFileSync('apps/web/public/logo-512.png', path.join(dir, 'logo.png'));
  fs.copyFileSync('apps/web/public/favicon.png', path.join(dir, 'favicon.png'));
  fs.copyFileSync('apps/web/public/apple-touch-icon.png', path.join(dir, 'apple-touch-icon.png'));
}

if (fs.existsSync('apps/landing/public/logo-128.webp')) {
  fs.copyFileSync('apps/landing/public/logo-128.webp', 'apps/web/public/logo-128.webp');
  fs.copyFileSync('apps/landing/public/logo-128.webp', 'apps/admin/public/logo-128.webp');
}

console.log('Successfully synced all HD logo assets and generated SVG wrappers!');
