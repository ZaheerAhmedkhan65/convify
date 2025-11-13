const db = require("../config/db");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const https = require("https");

let resizedFiles = [];

class ResizeController {

  // ✅ Resize and Crop Image
  async resize(req, res) {
    try {
      if (!req.file || !req.file.filename) {
        return res.status(400).json({ success: false, message: "No image uploaded" });
      }

      const { width, height, crop } = req.body;
      const uploadedPublicId = req.file.filename;

      // Create transformation options dynamically
      const transformations = [];

      if (width || height) {
        transformations.push({
          width: width ? parseInt(width) : undefined,
          height: height ? parseInt(height) : undefined,
          crop: crop || "fill"
        });
      }

      // Generate resized image URL
      const resizedUrl = cloudinary.url(uploadedPublicId, {
        transformation: transformations,
        folder: "resized"
      });

      // Fetch Cloudinary metadata to get size
      const resource = await cloudinary.api.resource(uploadedPublicId, { resource_type: "image" });
      const fileSizeKB = (resource.bytes / 1024).toFixed(1) + " KB";

      // Keep in memory for ZIP download
      resizedFiles.push(resizedUrl);

      // Save to database
      db.run(
        `INSERT INTO resize_history (original_name, resized_name, width, height, crop, file_path, size)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.file.originalname,
          uploadedPublicId,
          width || "auto",
          height || "auto",
          crop || "fill",
          resizedUrl,
          fileSizeKB,
        ]
      );

      res.json({
        success: true,
        file: resizedUrl,
        name: uploadedPublicId,
        width: width || "auto",
        height: height || "auto",
        crop: crop || "fill",
        size: fileSizeKB,
        date: new Date().toISOString(),
      });

    } catch (err) {
      console.error("Resize error:", err);
      res.status(500).json({ success: false, message: "Resize failed", error: err.message });
    }
  }

  // ✅ Download all resized images as ZIP
  async downloadZip(req, res) {
    if (!resizedFiles.length) {
      return res.status(400).send("No resized files available to download.");
    }

    const zipPath = path.join(__dirname, "temp_resized.zip");
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`Created ZIP: ${zipPath}`);
      res.download(zipPath, () => fs.unlinkSync(zipPath));
    });

    archive.on("error", (err) => res.status(500).send({ error: err.message }));
    archive.pipe(output);

    // Download each resized file from Cloudinary and add to ZIP
    let pending = resizedFiles.length;
    resizedFiles.forEach((url, i) => {
      const filename = `resized_${i + 1}${path.extname(url)}`;
      const tempPath = path.join(__dirname, filename);
      const file = fs.createWriteStream(tempPath);

      https.get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            archive.file(tempPath, { name: filename });
            pending--;
            if (pending === 0) archive.finalize();
            setTimeout(() => fs.unlink(tempPath, () => { }), 5000);
          });
        });
      });
    });
  }

  // ✅ Fetch resize history
  async history(req, res) {
    try {
      db.all(`SELECT * FROM resize_history ORDER BY created_at DESC`, (err, rows) => {
        if (err) {
          console.error("DB error:", err);
          res.status(500).json({ success: false, message: "Failed to fetch history." });
        } else {
          res.json({ success: true, history: rows });
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Unexpected error occurred." });
    }
  }
}

module.exports = new ResizeController();
