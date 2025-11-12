const express = require("express");
const router = express.Router();
const ConvertController = require("../controllers/convertController");
const { upload, uploadConverted } = require("../middlewares/upload"); // Cloudinary middlewares

router.get("/convert", (req, res) => {
    res.render("convert", { title: "Image Converter" });
});
router.post("/convert", upload.single("image"), ConvertController.convert);
router.get("/convert/download-zip", ConvertController.downloadZip);
router.get("/convert/history", ConvertController.history);

router.get("/resize", (req, res) => {
    res.render("resize", { title: "Image Resizer" });
});

router.get("/bg_remover", (req, res) => {
    res.render("bg_remover", { title: "Background Remover" });
});

router.get("/img_enhancer", (req, res) => {
    res.render("img_enhancer", { title: "Image Enhancer" });
});

router.get("/img_to_pdf", (req, res) => {
    res.render("img_to_pdf", { title: "Image to PDF Converter" });
})

router.get("/pdf_to_img", (req, res) => {
    res.render("pdf_to_img", { title: "PDF to Image Converter" });
})

router.get("/word_to_pdf", (req, res) => {
    res.render("word_to_pdf", { title: "Word to PDF Converter" });
})

router.get("/pdf_to_word", (req, res) => {
    res.render("pdf_to_word", { title: "PDF to Word Converter" });
})

module.exports = router;