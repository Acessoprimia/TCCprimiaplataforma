USE bkxr6owv8ylp656gwrzu;


SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE Usuario (
    id_usuario INT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL,
    tipo_usuario ENUM('aluno', 'professor') NOT NULL,
    status ENUM('ativo', 'bloqueado', 'inativo') NOT NULL DEFAULT 'ativo',

    CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_email UNIQUE (email)
);

CREATE TABLE Materia (
    id_materia INT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(45) NOT NULL,
    descricao VARCHAR(100),

    CONSTRAINT pk_materia PRIMARY KEY (id_materia),
    CONSTRAINT uq_materia_nome UNIQUE (nome)
);

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

CREATE TABLE Cronograma (
    id_cronograma INT NOT NULL AUTO_INCREMENT,
    id_plano_estudos INT NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    descricao VARCHAR(200),

    CONSTRAINT pk_cronograma PRIMARY KEY (id_cronograma),

    CONSTRAINT fk_cron_plano
        FOREIGN KEY (id_plano_estudos)
        REFERENCES Plano_de_Estudo(id_plano_estudos)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE Plano_de_Aula (
    id_plano_aula INT NOT NULL AUTO_INCREMENT,
    id_professor INT NOT NULL,
    id_materia INT NOT NULL,
    data_atual DATE NOT NULL,
    objetivos VARCHAR(200) NOT NULL,
    conteudo VARCHAR(200) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,

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

CREATE TABLE Duvidas (
    id_duvida INT NOT NULL AUTO_INCREMENT,
    id_aluno INT NOT NULL,
    id_forum INT NOT NULL,
    duvida TEXT NOT NULL,
    data_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pendente', 'respondida', 'resolvida', 'removida') NOT NULL DEFAULT 'pendente',

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

CREATE TABLE Denuncia (
    id_denuncia INT NOT NULL AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    id_duvida INT NOT NULL,
    motivo VARCHAR(100) NOT NULL,
    descricao TEXT,
    status ENUM('pendente', 'analisada', 'resolvida', 'ignorada') NOT NULL DEFAULT 'pendente',
    data_denuncia DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_resolucao DATETIME,

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



