/**
 * Gera variantes responsivas (AVIF + WebP em 640/1280/1920px) das imagens de hero
 * em `public/hero-cat-*.webp`. Rode após trocar qualquer arte de hero:
 *
 *   node scripts/generate-hero-variants.mjs
 *
 * Saída: public/hero-cat-<slug>-<width>.avif e .webp (o .jpg original continua
 * como fallback universal).
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = path.resolve("public");
const WIDTHS = [640, 1280, 1920];

const run = async () => {
  const files = (await readdir(PUBLIC_DIR)).filter(
    (f) => /^hero-cat-[a-z]+\.webp$/.test(f),
  );
  if (files.length === 0) {
    console.log("Nenhuma imagem de hero encontrada.");
    return;
  }

  for (const file of files) {
    const base = file.replace(/\.webp$/, "");
    const input = path.join(PUBLIC_DIR, file);
    for (const width of WIDTHS) {
      const pipeline = sharp(input).resize({ width, withoutEnlargement: true });
      await pipeline
        .clone()
        .avif({ quality: 50, effort: 4 })
        .toFile(path.join(PUBLIC_DIR, `${base}-${width}.avif`));
      await pipeline
        .clone()
        .webp({ quality: 72 })
        .toFile(path.join(PUBLIC_DIR, `${base}-${width}.webp`));
      console.log(`✓ ${base}-${width} (avif + webp)`);
    }
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
