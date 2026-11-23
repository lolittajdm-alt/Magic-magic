import sharp from "sharp";
import { stat } from "node:fs/promises";

const assets = [
  "hero-meadow",
  "hero-bird",
  "hero-squirrel",
  "hero-magnetic-board",
  "magnetic-game-box-square",
  "magnetic-game-box-refined",
  "reference",
  "rule-1-enhanced",
  "rule-2-enhanced",
  "rule-3-enhanced",
  "rule-4-enhanced",
];
let before = 0,
  after = 0;
for (const name of assets) {
  const input = `public/assets/${name}.png`;
  const output = `public/assets/${name}.webp`;
  // Preserve geometry and transparency; only optimize delivery encoding.
  await sharp(input)
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(output);
  before += (await stat(input)).size;
  after += (await stat(output)).size;
}
await sharp("public/assets/magnetic-chess.jpg")
  .resize({ width: 240, withoutEnlargement: true })
  .webp({ quality: 85 })
  .toFile("public/assets/checkout-product.webp");
await sharp("public/assets/hero-magnet-glossy.png")
  .resize({ width: 128, withoutEnlargement: true })
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile("public/assets/hero-magnet-glossy.webp");
await sharp("public/assets/magnetic-box-front-approved.png")
  .webp({ lossless: true, effort: 6 })
  .toFile("public/assets/magnetic-box-front-approved.webp");
console.log(
  `Illustrations: ${(before / 1048576).toFixed(2)} MB → ${(after / 1048576).toFixed(2)} MB (${Math.round((1 - after / before) * 100)}% smaller)`,
);
