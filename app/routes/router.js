var express = require("express");
var router = express.Router();

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

module.exports = router;


