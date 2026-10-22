// Monta a aplicação Express: sessão, arquivos do front-end, fotos e rotas da API.
const path = require('path');
const express = require('express');
const session = require('express-session');
const { segredoSessao, pastaUploads, raiz, minutosSessao } = require('./config/env');
const rotas = require('./routes');
const { naoEncontrado, tratarErros } = require('./middlewares/erros');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: segredoSessao,
    resave: false,
    saveUninitialized: false,
    rolling: true, // renova o prazo a cada requisição (RNF01.2)
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: minutosSessao * 60 * 1000 },
  })
);

// Front-end (HTML, CSS e JS) e fotos enviadas
app.use(express.static(path.join(raiz, 'public')));
app.use('/uploads', express.static(pastaUploads));

// API
app.use('/api', rotas);
app.use('/api', naoEncontrado);
app.use(tratarErros);

module.exports = app;
