var express = require("express");
var router = express.Router();
const { body, validationResult } = require("express-validator");

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
  res.render("pages/login");
});

router.get("/areapremium", function (req, res) {
  res.render("pages/areapremium");
});


router.get("/telainicial", function (req, res) {
  res.render("pages/telainicial");
});

router.get("/contato", function (req, res) {
  res.render("pages/contato");
});

router.get("/contatoprofessor", function (req, res) {
  res.render("pages/contatoprofessor");
});



router.get("/video", function (req, res) {
  res.render("pages/video");
});

router.get("/videoaula", function (req, res) {
  res.render("pages/videoaula");
});

router.get("/cronograma", function (req, res) {
  res.render("pages/cronograma");
});



router.get("/areadosimulado", function (req, res) {
  res.render("pages/areadosimulado");
});


router.get("/cadastroprofessor", function (req, res) {
  res.render("pages/cadastroprofessor");
});

router.get("/partepremium", function (req, res) {
  res.render("pages/partepremium");
});


router.get("/partepremiumprofessor", function (req, res) {
  res.render("pages/partepremiumprofessor");
});



router.get("/biblioteca", function (req, res) {
  res.render("pages/biblioteca");
});


router.get("/areapremiumprofessor", function (req, res) {
  res.render("pages/areapremiumprofessor");
});


router.get("/simuladoprofessor", function (req, res) {
  res.render("pages/simuladoprofessor");
});

router.get("/videoaulaprofessor", function (req, res) {
  res.render("pages/videoaulaprofessor");
});

router.get("/cronogramaprofessor", function (req, res) {
  res.render("pages/cronogramaprofessor");
});



router.get("/bibliotecaprofessor", function (req, res) {
  res.render("pages/bibliotecaprofessor");
});


router.get("/livro", function (req, res) {
  res.render("pages/livro");
});

router.get("/forumdeduvidas", function (req, res) {
  res.render("pages/forumdeduvidas");
});

router.get("/forumprofessor", function (req, res) {
  res.render("pages/forumprofessor");
});

router.get("/planoestudoprofessor", function (req, res) {
  res.render("pages/planoestudoprofessor");
});


router.get("/logincadastro", function (req, res) {
  res.render("pages/logincadastro");
});

router.get("/entradaprofessor", function (req, res) {
  res.render("pages/entradaprofessor");
});

router.get("/planoestudo", function (req, res) {
  res.render("pages/planoestudo");
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

router.get("/sobreprofessor", function (req, res) {
  res.render("pages/sobreprofessor");
});


router.get("/sobre", function (req, res) {
  res.render("pages/sobre");
});


// ========== ROTA GET CADASTRO ==========
router.get("/cadastro", (req, res) => {
  res.render("pages/cadastro", {
    erros: null,
    valores: {
      usuario: "",
      email: "",
      senha: "",
      confirmar_senha: "",
      data_nascimento: "",
      ra: "",
      serie: "",
    },
    retorno: null,
    erroValidacao: {},
    msgErro: {},
  });
});

// ========== ROTA POST CADASTRO ==========
router.post(
  "/cadastro",

  // Validação dos campos
  body("usuario")
    .trim()
    .notEmpty()
    .withMessage("O nome de usuário é obrigatório!")
    .isLength({ min: 3 })
    .withMessage("O nome deve ter pelo menos 3 caracteres!"),

  body("email")
    .notEmpty()
    .withMessage("O e-mail é obrigatório!")
    .isEmail()
    .withMessage("Digite um e-mail válido!"),

  body("senha")
    .notEmpty()
    .withMessage("A senha é obrigatória!")
    .isLength({ min: 6 })
    .withMessage("A senha deve ter pelo menos 6 caracteres!"),

  body("confirmar_senha")
    .notEmpty()
    .withMessage("A confirmação de senha é obrigatória!")
    .custom((value, { req }) => {
      if (value !== req.body.senha) {
        throw new Error("As senhas não conferem!");
      }
      return true;
    }),

  body("data_nascimento")
    .notEmpty()
    .withMessage("A data de nascimento é obrigatória!"),

  body("ra")
    .notEmpty()
    .withMessage("O RA é obrigatório!"),

  body("serie")
    .notEmpty()
    .withMessage("A série escolar é obrigatória!"),

  // Função principal
  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // Cria objetos para marcar os campos com erro
      const erroValidacao = {};
      const msgErro = {};

      errors.array().forEach((erro) => {
        erroValidacao[erro.path] = "erro";
        msgErro[erro.path] = erro.msg;
      });

      // Recarrega a página de cadastro com as mensagens de erro
      return res.render("pages/cadastro", {
        erros: errors,
        valores: req.body,
        retorno: null,
        erroValidacao,
        msgErro,
      });
    }

    // Se tudo estiver certo, redireciona pra /entrada
    res.redirect("/entrada");
  }
);

router.post("/entrada", function(req, res) {
    const { nome, email, senha, confirmar_senha, data_nascimento, ra, serie } = req.body;

    // Aqui você pode validar de novo no backend se quiser
    // ou simplesmente redirecionar para a página de entrada
    res.render("pages/entrada", { nome }); // se quiser passar algum dado para a página
});



router.get("/cadastroprofessor", (req, res) => {
  res.render("pages/cadastroprofessor");
});

router.post("/entradaprofessor", (req, res) => {
  res.render("pages/entradaprofessor");
});

// ========== ROTA GET LOGIN ==========
router.get("/login", (req, res) => {
  res.render("pages/login", {
    erros: null,
    valores: { email: "", senha: "" },
    erroValidacao: {},
    msgErro: {},
  });
});

// ========== ROTA POST LOGIN ==========
router.post(
  "/login",
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("O e-mail é obrigatório!")
      .isEmail()
      .withMessage("Digite um e-mail válido!"),
    body("senha")
      .notEmpty()
      .withMessage("A senha é obrigatória!")
      .isLength({ min: 6 })
      .withMessage("A senha deve ter pelo menos 6 caracteres!"),
  ],
  (req, res) => {
    const errors = validationResult(req);

    // Se houver erros, volta pro login com mensagens
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
        erroValidacao,
        msgErro,
      });
    }

    // Caso não haja erros
    const { email, senha } = req.body;

    // 🔹 Aqui você pode mudar depois pra uma checagem real no banco de dados
    // Por enquanto, detecta professor/aluno por uma regra simples:
    if (email.includes("prof") || email.includes("teacher")) {
      // Login de professor
      return res.redirect("/entradaprofessor");
    } else {
      // Login de aluno
      return res.redirect("/entrada");
    }
  }
);



module.exports = router;







