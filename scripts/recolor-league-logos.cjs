const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const assets = [
  ["premier-league.png", "white"],
  ["ligue-1.png", "white"],
  ["champions-league.png", "white"],
  ["europa-league.png", "orange"],
  ["conference-league.png", "green"],
  ["super-lig.png", "red"],
];

function keepColor(r, g, b, color) {
  if (color === "orange") return r > 150 && g > 35 && g < 190 && b < 100 && r > g * 1.25;
  if (color === "green") return g > 70 && g > r * 1.25 && g > b * 1.15;
  if (color === "red") return r > 100 && r > g * 1.35 && r > b * 1.35;
  return false;
}

async function main() {
  const dir = path.join(process.cwd(), "public", "leagues");
  for (const [filename, color] of assets) {
    const target = path.join(dir, filename);
    const image = sharp(target);
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      if (!keepColor(data[i], data[i + 1], data[i + 2], color)) data[i] = data[i + 1] = data[i + 2] = 255;
    }
    const tmp = `${target}.tmp.png`;
    let output = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
    // Ligue 1 is delivered with a very large transparent canvas. Remove that
    // padding and keep its visible mark aligned with the other 150px assets.
    if (filename === "ligue-1.png") output = output.trim().resize({ height: 150, withoutEnlargement: true });
    await output.png({ compressionLevel: 9, palette: true, colours: 32, effort: 10 }).toFile(tmp);
    fs.renameSync(tmp, target);
    console.log(`${filename}: ${info.width}x${info.height}`);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
