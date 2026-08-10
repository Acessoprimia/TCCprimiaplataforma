# Integração com o banco de dados — status e próximos passos

> Documento de contexto pra retomar em outra conversa. Atualizado em 2026-08-10.
> Projeto: Primia (plataforma educacional — aluno/professor/admin). Stack: Node/Express/EJS/MySQL.

## Já integrado e funcionando (não mexer sem necessidade)

- **Biblioteca, vídeo-aulas, foto de perfil, contato, simulado (IA + manual), cronograma/plano de estudo** (com grade semanal própria, premium-aware, rotação de chave Gemini).
- **Admin — Dashboard**: métricas, gráfico de crescimento (6 meses) e pendências reais (`adminModel.js`).
- **Admin — Usuários**: listagem real, editar, bloquear/ativar, **conceder/remover premium**, excluir. "Alterar tipo de conta" é só visual (ver seção de gaps).
- **Admin — Conteúdos**: CRUD real de livro/vídeo (destaque, premium, arquivar, duplicar, excluir) + CRUD de Matéria (criar/remover com proteção, upload de ícone com recolorização — SVG recolorido de verdade via `currentColor`, raster via filtro CSS calculado).
- **Admin — Relatórios**: agregados diários reais (novos alunos/professores, conteúdos publicados, dúvidas respondidas, premiums vendidos). "Acessos por matéria" foi renomeado pra "Conteúdos publicados por matéria" porque não existe rastreamento de acesso no banco (ver gap correspondente abaixo).
- **Admin — Suporte (Denúncias + Contato)**: ver detalhes na seção "Suporte" logo abaixo — schema reestruturado, models, rotas e telas prontos; falta só rodar o SQL e testar ao vivo.
- **Carrossel da home + cadastro de professor**: matérias vêm do banco (`Materia.listarAtivas()`), não são mais hardcoded.
- **Fórum/dúvidas, notificações do usuário (sino do aluno/professor)**: já eram reais antes desta rodada de trabalho.

## Admin — Suporte (implementado em 2026-08-10, ação pendente sua)

Tudo foi escrito e testado estaticamente (sintaxe + renderização EJS com dados no formato real), mas **o banco local estava offline (`ECONNREFUSED`) no momento** — então não rodei teste contra banco real nem verificação ao vivo no navegador. Antes de usar em produção, faça isso:

1. **Rode o novo bloco `-- GERADO AGORA` no fim de `config/database/schema.sql`** (ALTER em `Denuncia` e `Mensagem_Contato`). Já verifiquei ao vivo antes de escrever o SQL: `Denuncia` estava com 0 linhas (o `MODIFY` é seguro) e `Mensagem_Contato` tinha 20 linhas, todas `status='pendente'` — por isso esse bloco só ADICIONA `'resolvido'` ao ENUM, nunca remove/renomeia `'pendente'`.
2. Depois de rodar o SQL, teste manualmente: página `/admin/suporte` (abas Denúncias e Contato, responder/resolver/ignorar/excluir) e o botão "Denunciar" em `/livro/:id` (menu de opções → escolhe motivo → envia).

O que foi implementado:
- `Denuncia` deixou de ser só-fórum: agora tem `tipo_conteudo` (`duvida`/`conteudo`/`formulario`/`outro`) + `id_conteudo_alvo` genérico, `prioridade`, `resolucao`, `resposta_admin`. `denunciaModel.js` (novo) faz o JOIN condicional certo pra cada tipo.
- `contatoModel.js` ganhou `responder`, `resolver`, `remover` (antes só tinha `criar`/`listar`/`marcarRespondido`, e nada disso era chamado por lugar nenhum do admin).
- Rotas novas em `router.js`: `POST /admin/denuncias/:id/responder`, `/resolver`; `POST /admin/contatos/:id/responder`, `/resolver`, `/excluir`; e `POST /livro/:id/denunciar` (pública, autenticada) — essa última é a primeira forma real de denunciar algo no sistema, o botão "Denunciar" em `livro.ejs` era só um `alert()` decorativo antes.
- **Decisão de escopo, não esquecimento**: a ação "Remover conteúdo denunciado" (no menu de 3 pontos de uma denúncia) só marca `resolucao='conteudo_removido'` como rótulo administrativo — **não apaga de verdade** o `Conteudo`/`Formulario`/`Duvida` por trás. Um cascade-delete automático ali seria uma ação destrutiva bem mais arriscada do que cabia decidir sozinho; se quiser isso de verdade no futuro, é melhor implementar com uma confirmação extra dedicada.
- `suporteMock.js` foi apagado (mesma limpeza já feita com usuarios/conteudos/relatorios).

## O que falta integrar (gaps confirmados em 2026-08-10)

### 1. Premium enforcement incompleto (risco real, não é só "feature faltando")
- Hoje **só `/planoestudo` (cronograma) checa `Models.assinaturas.estaAtiva()`**.
- **Biblioteca, vídeo-aulas e simulado NÃO checam premium antes de servir conteúdo.** Um aluno gratuito que souber/adivinhar a URL de um `/livro/:id`, `/videoaula/:id` ou simulado marcado como `is_premium=true` consegue acessar normalmente, mesmo sem assinatura.
- Vale corrigir: adicionar `estaAtiva()` (ou passar o status já calculado) nessas 3 rotas e bloquear/redirecionar quando o conteúdo é premium e o aluno não é assinante.
- Bônus encontrado: `Models.formularios.listarPublicadosPremium()` tem nome enganoso — a query real só filtra `id_professor IS NOT NULL`, **não filtra premium nenhum**. Todo aluno vê todo simulado de professor, independente de ser premium ou não. Vale revisar se isso é intencional ou bug.

### 2. Admin — Configurações (não wired, sem decisão de design ainda)
- Form 100% estático, sem `action`, botão de submit é `type="button"` — literalmente não salva nada hoje.
- Campos que já existem na tela (então já indicam o que "deveria" ser configurável): aviso do site (texto), texto institucional, banner principal (upload), recurso premium em destaque (select).
- **Decisão pendente antes de implementar**: vale criar uma tabela genérica `configuracoes_plataforma` (chave/valor) pra isso, ou tratar cada campo como coluna própria em alguma tabela de config singleton? O comentário deixado no código já sugere a primeira opção.

### 3. Sino de notificações do admin (estático)
- `partials/notificacoesadmin.ejs` é hardcoded (4 itens fixos tipo "6 professores aguardando aprovação").
- Pra ficar real, precisa decidir o que conta como "notificação administrativa" — provavelmente uma agregação das mesmas pendências que já aparecem no dashboard (denúncias pendentes, mensagens de contato pendentes, conteúdo em rascunho) em vez de uma tabela nova.

### 4. "Alterar tipo de conta" (admin/usuários) — decisão deliberada, não esquecimento
- Fica só visual de propósito: mudar `tipo_usuario` de verdade exige criar/apagar a linha correspondente em `Aluno` (RA, série, data de nascimento) ou `Professor` (diploma, matéria) — campos que o modal atual não coleta.
- Se for implementar de verdade no futuro, precisa de um fluxo com campos extras dependendo da direção da troca (aluno→professor pede diploma/matéria; professor→aluno pede RA/série).

## Do que já foi resolvido nesta rodada (não é mais gap)

- ~~Faltava `Usuario.criado_em`/`ultimo_login`~~ → adicionado, usado no dashboard e nos relatórios.
- ~~"Acessos por matéria" travado~~ → resolvido substituindo por métrica real (conteúdo publicado por matéria).
- ~~Matéria não tinha CRUD nem ícone~~ → resolvido (upload + recolorização).
- ~~Admin — Suporte (Denúncias + Contato) não wired~~ → resolvido (ver seção dedicada acima). Falta só você rodar o SQL pendente e testar ao vivo.

## Como retomar

Se o usuário pedir "o que mais podemos integrar", comece por este arquivo em vez de reauditar do zero. Prioridade sugerida (mas sempre perguntar antes de escolher, como já é praxe nesta conversa):
1. **Premium enforcement** (item 1) — é o mais parecido com um bug de segurança/produto, não uma feature nova.
2. **Configurações** — precisa decisão de schema antes.
3. **Sino do admin** — pequeno, mas depende de decidir a fonte de dado.

Padrões desta sessão que valem continuar seguindo:
- Toda mudança de schema vai em `config/database/schema.sql` como bloco `-- GERADO AGORA`, nunca aplicada automaticamente — o usuário roda manualmente no Workbench.
- Nunca usar dado mockado/fake pra "disfarçar" uma limitação — se não dá pra ter o dado real, cortar a feature ou renomear pra refletir o que ela realmente mostra (foi o caso do gráfico de matérias nos relatórios).
- Testar sempre: `node -c` em tudo que for editado, teste isolado da lógica pura quando fizer sentido, teste contra o banco real dentro de transação com rollback quando envolver mutação, e checagem visual/DOM real via browser quando for mudança de UI.
