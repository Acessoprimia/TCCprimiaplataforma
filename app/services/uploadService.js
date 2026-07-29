const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UploadService = Object.freeze({
  async enviarArquivo(bufferArquivo, pasta = "primia", resourceType = "auto") {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: pasta, resource_type: resourceType },
        (erro, resultado) => {
          if (erro) return reject(erro);
          resolve(resultado.secure_url);
        }
      );
      stream.end(bufferArquivo);
    });
  },

  async enviarImagem(bufferArquivo, pasta = "primia") {
    return UploadService.enviarArquivo(bufferArquivo, pasta, "image");
  },
});

module.exports = UploadService;
