const db = require("../config/db");
const cloudinary = require("../config/cloudinary"); // to upload converted files manually if needed
const { spawn } = require("child_process");
const fs = require("fs");
const archiver = require("archiver");
const path = require("path");
const axios = require("axios");
let convertedFiles = [];

class ConvertController {

    async convert(req, res) {
        try {
            const uploadedUrl = req.file.path; // Cloudinary URL
            const outputFormat = req.body.format?.toLowerCase() || "webp";

            // Generate transformed image via Cloudinary
            const transformedUrl = cloudinary.url(req.file.filename, {
                transformation: [
                    { format: outputFormat },
                    { quality: "auto" },
                ],
                folder: "converted"
            });

            // 🔹 Fetch resource info from Cloudinary to get file size
            const resource = await cloudinary.api.resource(req.file.filename, { resource_type: "image" });
            const fileSizeKB = (resource.bytes / 1024).toFixed(1) + " KB";

            // Save to DB
            db.run(
                `INSERT INTO history (original_name, converted_name, format, file_path, size)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    req.file.originalname,
                    req.file.filename,
                    outputFormat.toUpperCase(),
                    transformedUrl,
                    fileSizeKB,
                ]
            );

            res.json({
                success: true,
                file: transformedUrl,
                name: req.file.filename,
                format: outputFormat.toUpperCase(),
                size: fileSizeKB,
                date: new Date().toISOString(),
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Conversion failed.", error: err.message });
        }
    }

    async downloadZip(req, res) {
        if (!convertedFiles.length) {
            return res.status(400).send("No files converted yet.");
        }

        const zipPath = path.join(__dirname, "temp_converted.zip");
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", () => {
            console.log(`Created ZIP: ${zipPath}`);
            res.download(zipPath, () => fs.unlinkSync(zipPath));
        });

        archive.on("error", (err) => res.status(500).send({ error: err.message }));
        archive.pipe(output);

        // Download each converted file from Cloudinary and add to zip
        const https = require("https");
        let pending = convertedFiles.length;
        convertedFiles.forEach((url, i) => {
            const filename = `converted_${i + 1}${path.extname(url)}`;
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

    async history(req, res) {
        try {
            db.all(`SELECT * FROM history ORDER BY created_at DESC`, (err, rows) => {
                if (err) {
                    console.error("Database error:", err);
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

module.exports = new ConvertController();
