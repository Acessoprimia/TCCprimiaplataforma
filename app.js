require("dotenv").config();

const express = require("express");
const app = express();
// O Render (e a maioria das hospedagens) atribui a porta dinamicamente
// via essa variavel - escutar so na 3000 deixa o servico de pe mas
// inacessivel, porque o roteador deles nao acha ninguem ouvindo na
// porta que ele esperava.
const port = process.env.PORT || 3000;

// Sem isso, atras de um proxy reverso (ngrok, Render, etc.) o Express
// nao confia no header X-Forwarded-Proto e req.protocol sempre reporta
// "http", mesmo quando a conexao real era https - foi o que quebrou o
// checkout do Mercado Pago (ele exige back_urls https de verdade).
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static("./app/public"));

app.set("view engine", "ejs");
app.set("views","./app/views");

// Usado em meta tags (og:url, og:image) que precisam de URL absoluta.
// Fica num unico lugar pra nao quebrar quando o dominio de hospedagem mudar.
app.locals.urlBaseSite = process.env.URL_BASE_SITE || `http://localhost:${process.env.PORT || 3000}`;


const SEPARADOR_LINHA = String.fromCharCode(0x2028);
const SEPARADOR_PARAGRAFO = String.fromCharCode(0x2029);

app.locals.jsonParaScript = function (valor) {
  return JSON.stringify(valor)
    .split("<").join("\\u003c")
    .split(">").join("\\u003e")
    .split("&").join("\\u0026")
    .split(SEPARADOR_LINHA).join("\\u2028")
    .split(SEPARADOR_PARAGRAFO).join("\\u2029");
};

const rotaPrincipal = require("./app/routes/router");
app.use("/", rotaPrincipal);


app.listen(port, ()=>{
    console.log(`Servidor online\nhttp://localhost:${port}`);
})
