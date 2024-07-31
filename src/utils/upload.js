const multer = require("multer");
const storage = multer.memoryStorage();
const fs = require("fs/promises");
const { join, extname } = require("path");
const uploadPath = join(__dirname, "../uploads");

function fileFilter(req, file, cb) {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/bmp",
    "image/webp",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error(`Unsupported image mimetype !`), false);
  }

  cb(null, true);
}

async function saveFile(req, res) {
  try {
    await fs.mkdir(uploadPath, { recursive: true });

    if (req?.file) {
      const extension = extname(req.file.originalname);
      const filename = Date.now() + extension;
      const filePath = join(uploadPath, filename);

      await fs.writeFile(filePath, req.file.buffer);
      const url = `${req.protocol}://${req.get("host")}/${filename}`;
      req.body.img = url;
    }
  } catch (err) {
    res.status(500).json({
      msg: `Internal server error: ${err?.message ? err.message : err}`,
    });
  }
}



const uploadOne = multer({
  storage,
  fileFilter,
}).single("img");

module.exports = {
  uploadOne,
  saveFile,
};
