const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(process.cwd(), '.tmp/phase-20-1-media');
fs.mkdirSync(outputDir, { recursive: true });

const imagePath = path.join(outputDir, 'phase-20-1-test-image.png');
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnSUswAAAAASUVORK5CYII=';

fs.writeFileSync(imagePath, Buffer.from(pngBase64, 'base64'));

console.log(
  JSON.stringify(
    {
      ok: true,
      outputDir,
      imagePath,
      imageExists: fs.existsSync(imagePath),
      imageSize: fs.statSync(imagePath).size,
    },
    null,
    2
  )
);