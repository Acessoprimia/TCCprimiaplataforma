USE DB_NAME;

SET FOREIGN_KEY_CHECKS = 1;


-- =========================================================
-- TABELA: Usuario
-- =========================================================

CREATE TABLE Usuario (
    id_usuario INT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    senha VARCHAR(60) NOT NULL,
    email VARCHAR(100) NOT NULL,
    tipo_usuario ENUM('aluno', 'professor', 'admin') NOT NULL,
    status ENUM('ativo', 'bloqueado', 'inativo') NOT NULL DEFAULT 'ativo',
    foto_url VARCHAR(255) NULL,
    perfil_publico BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_login DATETIME NULL,

    email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    token_verificacao_email VARCHAR(64) NULL,
    token_verificacao_email_expira DATETIME NULL,

    token_redefinicao_senha VARCHAR(64) NULL,
    token_redefinicao_senha_expira DATETIME NULL,

    CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_email UNIQUE (email)
);



-- TABELA: Materia


CREATE TABLE Materia (
    id_materia INT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(45) NOT NULL,
    descricao VARCHAR(100),
    icone_url VARCHAR(255) NULL,
    icone_svg TEXT NULL,

    CONSTRAINT pk_materia PRIMARY KEY (id_materia),
    CONSTRAINT uq_materia_nome UNIQUE (nome)
);


-- =========================================================
-- TABELA: Aluno
-- =========================================================

CREATE TABLE Aluno (
    id_aluno INT NOT NULL,
    RA VARCHAR(30) NOT NULL,
    serie VARCHAR(45),
    data_nascimento DATE NOT NULL,

    CONSTRAINT pk_aluno PRIMARY KEY (id_aluno),

    CONSTRAINT fk_aluno_usuario
        FOREIGN KEY (id_aluno)
        REFERENCES Usuario(id_usuario)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- =========================================================
-- TABELA: Professor
-- =========================================================

CREATE TABLE Professor (
    id_professor INT NOT NULL,
    id_materia INT,
    diploma VARCHAR(255) NOT NULL,
    data_nascimento DATE NOT NULL,

    CONSTRAINT pk_professor PRIMARY KEY (id_professor),

    CONSTRAINT fk_prof_usuario
        FOREIGN KEY (id_professor)
        REFERENCES Usuario(id_usuario)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_prof_materia
        FOREIGN KEY (id_materia)
        REFERENCES Materia(id_materia)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);


-- TABELA: Plano_de_Estudo

CREATE TABLE Plano_de_Estudo (
    id_plano_estudos INT NOT NULL AUTO_INCREMENT,
    id_aluno INT NOT NULL,
    id_materia INT NOT NULL,
    hora_aula TIME NOT NULL,

    CONSTRAINT pk_plano_estudos PRIMARY KEY (id_plano_estudos),

    CONSTRAINT fk_pe_aluno
        FOREIGN KEY (id_aluno)
        REFERENCES Aluno(id_aluno)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_pe_materia
        FOREIGN KEY (id_materia)
        REFERENCES Materia(id_materia)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- TABELA: Cronograma

CREATE TABLE Cronograma (
    id_cronograma INT NOT NULL AUTO_INCREMENT,
    id_plano_estudos INT NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    descricao VARCHAR(200),

    prioridade ENUM('baixa', 'media', 'alta') NOT NULL DEFAULT 'media',
    concluido BOOLEAN NOT NULL DEFAULT FALSE,

    titulo_cronograma VARCHAR(150) NULL,
    codigo_lote CHAR(36) NULL,

    hora_fim TIME NULL,
    tipo_atividade VARCHAR(30) NULL,

    CONSTRAINT pk_cronograma PRIMARY KEY (id_cronograma),

    CONSTRAINT fk_cron_plano
        FOREIGN KEY (id_plano_estudos)
        REFERENCES Plano_de_Estudo(id_plano_estudos)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Plano_de_Aula

CREATE TABLE Plano_de_Aula (
    id_plano_aula INT NOT NULL AUTO_INCREMENT,
    id_professor INT NOT NULL,
    id_materia INT NOT NULL,
    data_atual DATE NOT NULL,
    objetivos VARCHAR(200) NOT NULL,
    conteudo VARCHAR(200) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,

    is_premium BOOLEAN NOT NULL DEFAULT FALSE,

    titulo_cronograma VARCHAR(150) NULL,
    codigo_lote CHAR(36) NULL,

    CONSTRAINT pk_plano_aula PRIMARY KEY (id_plano_aula),

    CONSTRAINT fk_pa_professor
        FOREIGN KEY (id_professor)
        REFERENCES Professor(id_professor)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_pa_materia
        FOREIGN KEY (id_materia)
        REFERENCES Materia(id_materia)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- TABELA: Forum

CREATE TABLE Forum (
    id_forum INT NOT NULL AUTO_INCREMENT,
    id_materia INT NOT NULL,
    nome VARCHAR(45) NOT NULL,
    descricao VARCHAR(200),

    CONSTRAINT pk_forum PRIMARY KEY (id_forum),

    CONSTRAINT fk_forum_materia
        FOREIGN KEY (id_materia)
        REFERENCES Materia(id_materia)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);


-- TABELA: Duvidas

CREATE TABLE Duvidas (
    id_duvida INT NOT NULL AUTO_INCREMENT,
    id_aluno INT NOT NULL,
    id_forum INT NOT NULL,
    duvida TEXT NOT NULL,
    data_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM(
        'pendente',
        'respondida',
        'resolvida',
        'removida'
    ) NOT NULL DEFAULT 'pendente',

    CONSTRAINT pk_duvida PRIMARY KEY (id_duvida),

    CONSTRAINT fk_duv_aluno
        FOREIGN KEY (id_aluno)
        REFERENCES Aluno(id_aluno)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_duv_forum
        FOREIGN KEY (id_forum)
        REFERENCES Forum(id_forum)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Respostas

CREATE TABLE Respostas (
    id_resposta INT NOT NULL AUTO_INCREMENT,
    id_professor INT NOT NULL,
    id_duvida INT NOT NULL,
    resposta TEXT NOT NULL,
    data_resposta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_resposta PRIMARY KEY (id_resposta),

    CONSTRAINT fk_resp_professor
        FOREIGN KEY (id_professor)
        REFERENCES Professor(id_professor)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_resp_duvida
        FOREIGN KEY (id_duvida)
        REFERENCES Duvidas(id_duvida)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Notificacao

CREATE TABLE Notificacao (
    id_notificacao INT NOT NULL AUTO_INCREMENT,
    id_usuario INT NOT NULL,

    tipo ENUM(
        'nova_duvida',
        'resposta_duvida',
        'duvida_resolvida',
        'duvida_removida',
        'denuncia',
        'sistema'
    ) NOT NULL,

    titulo VARCHAR(100) NOT NULL,
    mensagem VARCHAR(255) NOT NULL,
    link VARCHAR(255),

    lida BOOLEAN NOT NULL DEFAULT FALSE,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_notificacao PRIMARY KEY (id_notificacao),

    CONSTRAINT fk_notificacao_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES Usuario(id_usuario)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Denuncia

CREATE TABLE Denuncia (
    id_denuncia INT NOT NULL AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    id_duvida INT NULL,

    motivo VARCHAR(100) NOT NULL,
    descricao TEXT,

    status ENUM(
        'aberto',
        'em_analise',
        'resolvido'
    ) NOT NULL DEFAULT 'aberto',

    data_denuncia DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_resolucao DATETIME,

    tipo_conteudo ENUM(
        'duvida',
        'conteudo',
        'formulario',
        'outro'
    ) NOT NULL DEFAULT 'duvida',

    id_conteudo_alvo INT NULL,

    prioridade ENUM(
        'baixa',
        'media',
        'alta'
    ) NOT NULL DEFAULT 'media',

    resolucao ENUM(
        'resolvido',
        'ignorado',
        'conteudo_removido'
    ) NULL,

    resposta_admin TEXT NULL,

    CONSTRAINT pk_denuncia PRIMARY KEY (id_denuncia),

    CONSTRAINT fk_denuncia_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES Usuario(id_usuario)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_denuncia_duvida
        FOREIGN KEY (id_duvida)
        REFERENCES Duvidas(id_duvida)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Conteudo

CREATE TABLE Conteudo (
    id INT NOT NULL AUTO_INCREMENT,
    titulo VARCHAR(150) NOT NULL,
    autor VARCHAR(150),
    descricao TEXT,

    tipo ENUM(
        'livro',
        'video'
    ) NOT NULL,

    materia_id INT,
    professor_id INT,

    arquivo_url VARCHAR(255),
    imagem_url VARCHAR(255),

    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    destaque BOOLEAN NOT NULL DEFAULT FALSE,

    status ENUM(
        'rascunho',
        'publicado'
    ) NOT NULL DEFAULT 'rascunho',

    sinopse_gerada_ia BOOLEAN NOT NULL DEFAULT FALSE,
    arquivado BOOLEAN NOT NULL DEFAULT FALSE,

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_conteudo PRIMARY KEY (id),

    CONSTRAINT fk_conteudo_materia
        FOREIGN KEY (materia_id)
        REFERENCES Materia(id_materia)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_conteudo_professor
        FOREIGN KEY (professor_id)
        REFERENCES Professor(id_professor)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);


-- TABELA: Assinatura_Premium

CREATE TABLE Assinatura_Premium (
    id_assinatura INT NOT NULL AUTO_INCREMENT,
    id_usuario INT NOT NULL,

    status ENUM(
        'ativa',
        'cancelada',
        'expirada'
    ) NOT NULL DEFAULT 'ativa',

    data_inicio DATE NOT NULL,
    data_fim DATE,

    CONSTRAINT pk_assinatura_premium PRIMARY KEY (id_assinatura),

    CONSTRAINT fk_assinatura_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES Usuario(id_usuario)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Mensagem_Contato

CREATE TABLE Mensagem_Contato (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT,

    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    assunto VARCHAR(150),
    mensagem TEXT NOT NULL,
    origem VARCHAR(45),

    status ENUM(
        'pendente',
        'respondido',
        'resolvido'
    ) NOT NULL DEFAULT 'pendente',

    resposta_admin TEXT NULL,
    resolvido_em DATETIME NULL,

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_mensagem_contato PRIMARY KEY (id),

    CONSTRAINT fk_mensagem_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES Usuario(id_usuario)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);


-- TABELA: Formulario

CREATE TABLE Formulario (
    id_formulario INT NOT NULL AUTO_INCREMENT,
    id_aluno INT NULL,
    id_materia INT,
    id_professor INT NULL,

    titulo VARCHAR(150) NOT NULL,
    schema_json JSON NOT NULL,

    gerado_por_ia BOOLEAN NOT NULL DEFAULT FALSE,

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_formulario PRIMARY KEY (id_formulario),

    CONSTRAINT fk_formulario_aluno
        FOREIGN KEY (id_aluno)
        REFERENCES Aluno(id_aluno)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_formulario_materia
        FOREIGN KEY (id_materia)
        REFERENCES Materia(id_materia)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_formulario_professor
        FOREIGN KEY (id_professor)
        REFERENCES Professor(id_professor)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Resposta_Formulario

CREATE TABLE Resposta_Formulario (
    id_resposta_formulario INT NOT NULL AUTO_INCREMENT,
    id_formulario INT NOT NULL,
    id_aluno INT NOT NULL,

    pergunta_ref VARCHAR(50) NOT NULL,
    resposta_aluno TEXT,
    correta BOOLEAN,

    respondido_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_resposta_formulario PRIMARY KEY (id_resposta_formulario),

    CONSTRAINT fk_resposta_formulario_formulario
        FOREIGN KEY (id_formulario)
        REFERENCES Formulario(id_formulario)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_resposta_formulario_aluno
        FOREIGN KEY (id_aluno)
        REFERENCES Aluno(id_aluno)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Redacao

CREATE TABLE Redacao (
    id_redacao INT NOT NULL AUTO_INCREMENT,
    id_aluno INT NOT NULL,

    tema VARCHAR(200) NOT NULL,
    tipo_redacao VARCHAR(40) NOT NULL DEFAULT 'enem_dissertativo_argumentativo',

    texto TEXT NOT NULL,

    nota_c1 SMALLINT NOT NULL,
    nota_c2 SMALLINT NOT NULL,
    nota_c3 SMALLINT NOT NULL,
    nota_c4 SMALLINT NOT NULL,
    nota_c5 SMALLINT NOT NULL,

    nota_total SMALLINT NOT NULL,

    comentario_c1 TEXT NOT NULL,
    comentario_c2 TEXT NOT NULL,
    comentario_c3 TEXT NOT NULL,
    comentario_c4 TEXT NOT NULL,
    comentario_c5 TEXT NOT NULL,

    comentario_geral TEXT NOT NULL,

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_redacao PRIMARY KEY (id_redacao),

    CONSTRAINT fk_redacao_aluno
        FOREIGN KEY (id_aluno)
        REFERENCES Aluno(id_aluno)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Configuracao_Plataforma

CREATE TABLE Configuracao_Plataforma (
    chave VARCHAR(60) NOT NULL,
    valor TEXT NULL,

    atualizado_em DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    id_admin_alteracao INT NULL,

    CONSTRAINT pk_configuracao_plataforma PRIMARY KEY (chave),

    CONSTRAINT fk_configuracao_admin
        FOREIGN KEY (id_admin_alteracao)
        REFERENCES Usuario(id_usuario)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);


-- TABELA: Analise_Desempenho

CREATE TABLE Analise_Desempenho (
    id_aluno INT NOT NULL,

    diagnostico TEXT NOT NULL,
    pontos_fortes TEXT NOT NULL,
    recomendacao_geral TEXT NOT NULL,

    materias_fracas JSON NOT NULL,
    recomendacoes JSON NOT NULL,

    gerado_em DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_analise_desempenho PRIMARY KEY (id_aluno),

    CONSTRAINT fk_analise_desempenho_aluno
        FOREIGN KEY (id_aluno)
        REFERENCES Aluno(id_aluno)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Pagamento

CREATE TABLE Pagamento (
    id_pagamento INT NOT NULL AUTO_INCREMENT,
    id_usuario INT NOT NULL,

    gateway VARCHAR(30) NOT NULL DEFAULT 'mercadopago',

    referencia_externa VARCHAR(64) NOT NULL,
    id_transacao_gateway VARCHAR(100) NULL,

    valor_centavos INT NOT NULL,
    dias_premium INT NOT NULL,

    status ENUM(
        'pendente',
        'aprovado',
        'recusado',
        'cancelado',
        'estornado'
    ) NOT NULL DEFAULT 'pendente',

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_pagamento PRIMARY KEY (id_pagamento),

    CONSTRAINT uk_pagamento_referencia_externa
        UNIQUE (referencia_externa),

    CONSTRAINT fk_pagamento_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES Usuario(id_usuario)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


CREATE TABLE Preferencia_Notificacao (
    id_usuario INT NOT NULL,

    tipo ENUM(
        'nova_duvida',
        'resposta_duvida',
        'duvida_resolvida',
        'duvida_removida',
        'denuncia',
        'sistema'
    ) NOT NULL,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    atualizado_em DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_preferencia_notificacao PRIMARY KEY (id_usuario, tipo),

    CONSTRAINT fk_preferencia_notificacao_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES Usuario(id_usuario)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- TABELA: Log_Auditoria

CREATE TABLE Log_Auditoria (
    id_log INT NOT NULL AUTO_INCREMENT,

    
    id_usuario INT NULL,

    
    nome_usuario VARCHAR(100) NOT NULL,
    tipo_usuario ENUM('aluno', 'professor', 'admin') NOT NULL,

    acao ENUM('criou', 'editou', 'excluiu') NOT NULL,

    entidade ENUM(
        'duvida',
        'resposta',
        'conteudo',
        'formulario',
        'cronograma',
        'redacao',
        'conta'
    ) NOT NULL,

    id_entidade INT NULL,
    descricao VARCHAR(255) NOT NULL,

    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_log_auditoria PRIMARY KEY (id_log),

    CONSTRAINT fk_log_auditoria_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES Usuario(id_usuario)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_log_auditoria_criado_em ON Log_Auditoria (criado_em);