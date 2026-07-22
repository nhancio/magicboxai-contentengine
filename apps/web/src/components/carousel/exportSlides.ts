import { toPng } from "html-to-image";

/** Rasterize each slide node to a PNG data URL (full 1080px canvas). */
export async function exportSlidePngs(
  nodes: (HTMLElement | null)[],
): Promise<string[]> {
  const urls: string[] = [];
  for (const node of nodes) {
    if (!node) continue;
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 1,
      quality: 1,
    });
    urls.push(dataUrl);
  }
  return urls;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function downloadAllSlides(dataUrls: string[], topicSlug: string) {
  dataUrls.forEach((url, i) => {
    downloadDataUrl(url, `${topicSlug}-slide-${i + 1}.png`);
  });
}
