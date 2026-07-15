import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = resolve(root, "dist/index.html");
const serverEntry = resolve(root, "dist-ssr/entry-server.js");
const template = await readFile(htmlPath, "utf8");
const { render } = await import(pathToFileURL(serverEntry).href);
const marker = '<div id="root"></div>';

if (!template.includes(marker)) {
  throw new Error("Landing prerender marker was not found in dist/index.html");
}

await writeFile(htmlPath, template.replace(marker, `<div id="root">${render()}</div>`));
console.log("Prerendered the MagicBox landing page into dist/index.html");
