import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

// One shared, deterministic back cover for comics and summary booklets.
export async function createLogoBackCover() {
  const logo = await fs.readFile(path.join(
    process.cwd(), "public", "brand", "summit-visual-lab-horizontal.png"
  ));
  const { data, info } = await sharp(logo)
    .trim()
    .resize({ width: 600, height: 320, fit: "inside" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const image = await sharp({ create: {
    width: 1536, height: 1024, channels: 4, background: "#ffffff",
  } }).composite([{
    input: data,
    left: Math.round((1536 - info.width) / 2),
    top: Math.round((1024 - info.height) / 2),
  }]).png().toBuffer();
  return `data:image/png;base64,${image.toString("base64")}`;
}
