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

async function saveFile(req, res, next) {
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
    next(err);
  }
}

async function unlinkImageToUpdate(req, doc, next) {
  try {
    const newImageURL = req.body.img;

    if (doc?.img) {
      const existingImagePath = join(
        uploadPath,
        getImageFilenameFromUrl(doc.img)
      );
      try {
        await fs.unlink(existingImagePath);
      } catch (err) {
        if (err.code !== "ENOENT") {
          // Ignore if file doesn't exist
          console.error("Error deleting existing image:", err);
        }
      }
    }

    doc.img = newImageURL;
  } catch (err) {
    next(err);
  }
}

function getImageFilenameFromUrl(imgUrl) {
  // [ 'http:', '', 'localhost:5000', '1722419572164.jpg' ] - urlParts
  // 1722419572164.jpg - urlParts[urlParts.length - 1]
  const urlParts = imgUrl.split("/");
  return urlParts[urlParts.length - 1];
}

const uploadOne = multer({
  storage,
  fileFilter,
}).single("img");

module.exports = {
  uploadOne,
  saveFile,
  unlinkImageToUpdate,
};
