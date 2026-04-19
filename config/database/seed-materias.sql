USE bkxr6owv8ylp656gwrzu;

INSERT INTO Materia (nome, descricao) VALUES
('Português', 'Conteúdos de Português'),
('Matemática', 'Conteúdos de Matemática'),
('História', 'Conteúdos de História'),
('Geografia', 'Conteúdos de Geografia'),
('Biologia', 'Conteúdos de Biologia'),
('Física', 'Conteúdos de Física'),
('Química', 'Conteúdos de Química'),
('Inglês', 'Conteúdos de Inglês'),
('Educação Física', 'Conteúdos de Educação Física'),
('Filosofia', 'Conteúdos de Filosofia'),
('Sociologia', 'Conteúdos de Sociologia'),
('Artes', 'Conteúdos de Artes')
ON DUPLICATE KEY UPDATE
    descricao = VALUES(descricao);
