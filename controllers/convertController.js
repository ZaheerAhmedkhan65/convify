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
            const uploadedUrl = req.file.path; // Cloudinary URL of the uploaded image
            const outputFormat = req.body.format;
            const baseName = path.parse(req.file.filename || Date.now().toString()).name;

            const tempInputPath = path.join("/tmp", `temp_input${path.extname(req.file.originalname)}`);
            const tempOutputPath = path.join("/tmp", `temp_output.${outputFormat}`);


            // Download the uploaded Cloudinary image locally for conversion
            const https = require("https");
            const file = fs.createWriteStream(tempInputPath);
            https.get(uploadedUrl, (response) => {
                response.pipe(file);
                file.on("finish", () => {
                    file.close(() => {
                        const pythonCmd = process.platform === "win32" ? "python" : "python3";
                        const python = spawn(pythonCmd, [
                            path.join(__dirname, "../python/converter.py"),
                            tempInputPath,
                            outputFormat,
                            tempOutputPath,
                        ]);

                        python.stdout.on("data", (data) => console.log(`Python: ${data}`));
                        python.stderr.on("data", (data) => console.error(`Error: ${data}`));

                        python.on("close", async (code) => {
                            if (code === 0 && fs.existsSync(tempOutputPath)) {
                                try {
                                    // Upload converted file to Cloudinary (converted folder)
                                    const uploadResult = await cloudinary.uploader.upload(tempOutputPath, {
                                        folder: "converted",
                                        resource_type: "auto",
                                    });

                                    const convertedUrl = uploadResult.secure_url;
                                    convertedFiles.push(convertedUrl);

                                    // Get file size (approx.)
                                    const stats = fs.statSync(tempOutputPath);
                                    const sizeKB = (stats.size / 1024).toFixed(1) + " KB";

                                    // Save to DB
                                    db.run(
                                        `INSERT INTO history (original_name, converted_name, format, file_path, size)
                   VALUES (?, ?, ?, ?, ?)`,
                                        [
                                            req.file.originalname,
                                            path.basename(uploadResult.public_id),
                                            outputFormat.toUpperCase(),
                                            convertedUrl,
                                            sizeKB,
                                        ]
                                    );

                                    // Cleanup temp files
                                    fs.unlinkSync(tempInputPath);
                                    fs.unlinkSync(tempOutputPath);

                                    res.json({
                                        success: true,
                                        file: convertedUrl,
                                        name: path.basename(uploadResult.public_id),
                                        format: outputFormat.toUpperCase(),
                                        size: sizeKB,
                                        date: new Date().toISOString(),
                                    });
                                } catch (uploadErr) {
                                    console.error("Cloudinary upload error:", uploadErr);
                                    res.status(500).json({ success: false, message: "Failed to upload converted file." });
                                }
                            } else {
                                res.status(500).json({ success: false, message: "Conversion failed." });
                            }
                        });
                    });
                });
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: "Unexpected error occurred." });
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
