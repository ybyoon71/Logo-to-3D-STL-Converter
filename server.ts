import express from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import cors from "cors";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// STL Helper functions
function writeVector(buffer: Buffer, offset: number, x: number, y: number, z: number) {
  buffer.writeFloatLE(x, offset);
  buffer.writeFloatLE(y, offset + 4);
  buffer.writeFloatLE(z, offset + 8);
}

function writeFacet(buffer: Buffer, offset: number, normal: [number, number, number], v1: [number, number, number], v2: [number, number, number], v3: [number, number, number]) {
  writeVector(buffer, offset, normal[0], normal[1], normal[2]);
  writeVector(buffer, offset + 12, v1[0], v1[1], v1[2]);
  writeVector(buffer, offset + 24, v2[0], v2[1], v2[2]);
  writeVector(buffer, offset + 36, v3[0], v3[1], v3[2]);
  buffer.writeUInt16LE(0, offset + 48); // Attribute byte count
  return offset + 50;
}

app.post("/api/generate-stl", upload.single("image"), async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    const size = Math.min(parseInt(req.body.size) || 200, 500);
    const maxDim = parseFloat(req.body.maxDim) || 50;
    const baseThickness = parseFloat(req.body.baseThickness) || 3;
    const logoExtrude = parseFloat(req.body.logoExtrude) || 2;
    const threshold = parseInt(req.body.threshold) || 128;
    const invert = req.body.invert === "true";
    const baseShape = req.body.baseShape || "circle";

    // Use sharp to process the image
    // 1. Convert to grayscale
    // 2. Resize to the target resolution
    // 3. Composite onto a white background (handles transparency)
    // 4. Get raw pixel data
    
    let sharpImg = sharp(req.file.buffer);
    
    // Handle SVG or other formats by flattening onto white
    const { data, info } = await sharpImg
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .grayscale()
      .normalize()
      .sharpen() // Apply sharpening for better text detail
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalHeight = baseThickness + logoExtrude;
    const pixelSize = maxDim / size;

    const heights = new Float32Array(size * size);
    const inBase = new Uint8Array(size * size);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        let isInside = false;

        if (baseShape === "circle") {
          const dx = x - centerX + 0.5;
          const dy = y - centerY + 0.5;
          isInside = (dx * dx + dy * dy) <= (radius * radius);
        } else {
          isInside = true;
        }

        if (isInside) {
          inBase[idx] = 1;
          const brightness = data[idx]; // Sharp grayscale raw data is 1 byte per pixel
          
          let isLogo = brightness < threshold;
          if (invert) isLogo = !isLogo;
          heights[idx] = isLogo ? totalHeight : baseThickness;
        } else {
          inBase[idx] = 0;
          heights[idx] = 0;
        }
      }
    }

    const facets: { n: [number, number, number], v: [number, number, number][] }[] = [];

    for (let y = 0; y < size; y++) {
      const y_3d_idx = size - 1 - y;
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        if (!inBase[idx]) continue;

        const x0 = x * pixelSize - maxDim / 2;
        const x1 = (x + 1) * pixelSize - maxDim / 2;
        const y0 = y_3d_idx * pixelSize - maxDim / 2;
        const y1 = (y_3d_idx + 1) * pixelSize - maxDim / 2;
        const z = heights[idx];

        // Top face (Z+) - CCW: [x0,y0,z] -> [x1,y0,z] -> [x1,y1,z] -> [x0,y1,z]
        facets.push({ n: [0, 0, 1], v: [[x0, y0, z], [x1, y0, z], [x1, y1, z]] });
        facets.push({ n: [0, 0, 1], v: [[x0, y0, z], [x1, y1, z], [x0, y1, z]] });

        // Bottom face (Z-) - CCW: [x0,y0,0] -> [x0,y1,0] -> [x1,y1,0] -> [x1,y0,0]
        facets.push({ n: [0, 0, -1], v: [[x0, y0, 0], [x0, y1, 0], [x1, y1, 0]] });
        facets.push({ n: [0, 0, -1], v: [[x0, y0, 0], [x1, y1, 0], [x1, y0, 0]] });

        // Side faces (X-)
        if (x === 0 || !inBase[y * size + (x - 1)] || heights[y * size + (x - 1)] < z) {
          const zMin = (x > 0 && inBase[y * size + (x - 1)]) ? heights[y * size + (x - 1)] : 0;
          facets.push({ n: [-1, 0, 0], v: [[x0, y0, zMin], [x0, y1, zMin], [x0, y1, z]] });
          facets.push({ n: [-1, 0, 0], v: [[x0, y0, zMin], [x0, y1, z], [x0, y0, z]] });
        }
        // Side faces (X+)
        if (x === size - 1 || !inBase[y * size + (x + 1)] || heights[y * size + (x + 1)] < z) {
          const zMin = (x < size - 1 && inBase[y * size + (x + 1)]) ? heights[y * size + (x + 1)] : 0;
          facets.push({ n: [1, 0, 0], v: [[x1, y0, zMin], [x1, y0, z], [x1, y1, z]] });
          facets.push({ n: [1, 0, 0], v: [[x1, y0, zMin], [x1, y1, z], [x1, y1, zMin]] });
        }
        // Side faces (Y+) - Neighbor y-1 in data is +Y in 3D
        if (y === 0 || !inBase[(y - 1) * size + x] || heights[(y - 1) * size + x] < z) {
          const zMin = (y > 0 && inBase[(y - 1) * size + x]) ? heights[(y - 1) * size + x] : 0;
          facets.push({ n: [0, 1, 0], v: [[x0, y1, zMin], [x1, y1, zMin], [x1, y1, z]] });
          facets.push({ n: [0, 1, 0], v: [[x0, y1, zMin], [x1, y1, z], [x0, y1, z]] });
        }
        // Side faces (Y-) - Neighbor y+1 in data is -Y in 3D
        if (y === size - 1 || !inBase[(y + 1) * size + x] || heights[(y + 1) * size + x] < z) {
          const zMin = (y < size - 1 && inBase[(y + 1) * size + x]) ? heights[(y + 1) * size + x] : 0;
          facets.push({ n: [0, -1, 0], v: [[x0, y0, zMin], [x0, y0, z], [x1, y0, z]] });
          facets.push({ n: [0, -1, 0], v: [[x0, y0, zMin], [x1, y0, z], [x1, y0, zMin]] });
        }
      }
    }

    const buffer = Buffer.alloc(84 + facets.length * 50);
    buffer.write("Binary STL Generated by AI Studio CAD Engine", 0);
    buffer.writeUInt32LE(facets.length, 80);

    let offset = 84;
    for (const f of facets) {
      offset = writeFacet(buffer, offset, f.n, f.v[0], f.v[1], f.v[2]);
    }

    console.log(`Generated STL with ${facets.length} facets. Size: ${buffer.length} bytes.`);

    res.setHeader("Content-Type", "application/sla");
    res.setHeader("Content-Disposition", "attachment; filename=pendant.stl");
    res.send(buffer);

  } catch (error) {
    console.error("STL Generation Error:", error);
    res.status(500).json({ error: "Failed to process image and generate STL" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
