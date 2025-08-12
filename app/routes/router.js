var express = require("express");
var router = express.Router();
const { body, validationResult } = require("express-validator")

router.get("/", function (req, res) {
  res.render("pages/telainicial");
});

router.get("/materia1", function (req, res) {
  res.render("pages/materia1");
});

router.get("/paginaMaterias", function (req, res) {
  res.render("pages/paginaMaterias");
});

router.get("/login", function (req, res) {
  res.render("pages/login", {
    erros: null,
    valores: {
      nome: "",
      email: "",
      senha: "",
      confirmarSenha: "",
    },
    retorno: null,
    erroValidacao: {},
    msgErro: {},});
}); 

router.get("/professor", function (req, res) {
  res.render("pages/professor");
});

router.get("/telainicial", function (req, res) {
  res.render("pages/telainicial");
});

router.get("/contato", function (req, res) {
  res.render("pages/contato");
});

router.get("/logincadastro", function (req, res) {
  res.render("pages/logincadastro");
});

router.get("/entrada", function (req, res) {
  res.render("pages/entrada");
});

router.get("/duvida", function (req, res) {
  res.render("pages/duvida");
});

router.get("/chat", function (req, res) {
  res.render("pages/chat");
});



router.get("/sobre", function (req, res) {
  res.render("pages/sobre");
});

router.post(
  "/login",
  body("nome")
    .trim()
    .notEmpty()
    .withMessage("Campo obrigatório!")
    .bail()
    .isLength({ min: 3, max: 50 })
    .withMessage("O Nome de usuário deve conter entre 3 e 50 caracteres!")
    .matches(/^[A-Za-zÀ-ú\s]+$/)
    .withMessage("O nome deve conter apenas letras!"),

  body("email")
    .notEmpty()
    .withMessage("Campo obrigatório!")
    .bail()
    .isEmail()
    .withMessage("Endereço de email inválido!"),

  body("senha")
    .notEmpty()
    .withMessage("Campo obrigatório!")
    .bail()
    .isStrongPassword({
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
    .withMessage(
      "Senha fraca!"
    ),

  body("confirmarSenha")
    .notEmpty()
    .withMessage("Campo obrigatório!")
    .custom((value, { req }) => {
      if (value !== req.body.senha) {
        throw new Error("*As senhas não conferem!");
      }
      return true;
    }),

  function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const erroValidacao = {};
      const msgErro = {};

      errors.array().forEach((erro) => {
        erroValidacao[erro.path] = "erro";
        msgErro[erro.path] = erro.msg;
      });

      return res.render("pages/login", {
        erros: errors,
        valores: req.body,
        retorno: null,
        erroValidacao,
        msgErro,
      });
    }
    res.redirect("/entrada");
  }
);


module.exports = router;


