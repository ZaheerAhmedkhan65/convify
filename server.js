const express = require("express");
const multer = require("multer");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const archiver = require("archiver");

const app = express();
app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

const uploadDir = path.join(__dirname, "public/uploads");
const convertedDir = path.join(__dirname, "public/converted");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(convertedDir)) fs.mkdirSync(convertedDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Track converted files in memory (for this session)
let convertedFiles = [];

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/convert", upload.single("image"), (req, res) => {
  const inputPath = req.file.path;
  const outputFormat = req.body.format;
  const baseName = path.parse(req.file.filename).name;
  const outputFilename = `${baseName}.${outputFormat}`;
  const outputPath = path.join(convertedDir, outputFilename);
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  const python = spawn(pythonCmd, [path.join(__dirname, "python/converter.py"), inputPath, outputFormat, outputPath]);

  python.stdout.on("data", (data) => console.log(`Python: ${data}`));
  python.stderr.on("data", (data) => console.error(`Error: ${data}`));

  python.on("close", (code) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      convertedFiles.push(outputFilename);
      res.json({
        success: true,
        file: `/converted/${outputFilename}`,
        name: outputFilename,
      });
    } else {
      res.status(500).json({ success: false, message: "Conversion failed" });
    }
  });
});

// ZIP download route
app.get("/download-zip", (req, res) => {
  if (!convertedFiles.length) {
    return res.status(400).send("No files converted yet.");
  }

  const zipPath = path.join(convertedDir, "convify_converted.zip");
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    console.log(`Created ZIP: ${zipPath}`);
    res.download(zipPath, () => {
      // Optionally clear after download
      fs.unlinkSync(zipPath);
    });
  });

  archive.on("error", (err) => res.status(500).send({ error: err.message }));

  archive.pipe(output);
  convertedFiles.forEach((file) => {
    const filePath = path.join(convertedDir, file);
    archive.file(filePath, { name: file });
  });

  archive.finalize();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Convify running on http://localhost:${PORT}`));
