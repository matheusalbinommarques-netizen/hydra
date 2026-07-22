# Prompt para o Claude Design

Use os documentos e imagens anexados como fonte de verdade para refinar o protótipo visual do Hydra.

## Contexto

Hydra é uma plataforma guiada de gerenciamento de projetos de software. O diferencial é mostrar ao usuário:

- onde está;
- o que fazer agora;
- por que fazer;
- como concluir;
- o que vem depois.

A experiência deve orientar sem aprisionar e ensinar somente no momento necessário.

## Arquivos de referência

- `PRODUCT_SPEC.md`
- `RELEASE_0_SPEC.md`
- `UX_DESIGN_SPEC.md`
- `DESIGN_HANDOFF.md`
- `hydra-logo-reference.png`
- as quatro imagens `screen-*-reference-v2.png`

## Tarefa

Crie um protótipo navegável e consistente das seguintes telas:

1. Home / projetos
2. Atividade guiada — entendimento do problema
3. Resumo da descoberta
4. Workspace — visão Agora com próxima ação

## Regras

- preserve a identidade navy, prata e ciano;
- não use roxo como cor principal;
- reduza glow decorativo;
- use ciano forte apenas em foco, CTA, etapa ativa e próxima ação;
- não invente funcionalidades;
- não adicione analytics corporativo;
- não adicione avatares ou colaboração;
- não use scores artificiais de saúde ou descoberta;
- use `Agora | Mapa | Registros` no workspace;
- mantenha a Home focada em continuar o projeto;
- mantenha as perguntas da atividade em expansão progressiva;
- destaque no resumo: problema, para quem e resultado esperado;
- preserve voltar, editar e pular;
- ao pular, apresente consequência e gere pendência;
- use linguagem profissional, simples e próxima;
- corrija qualquer erro textual presente nas imagens;
- garanta consistência de componentes e espaçamento.

## Componentes a definir

- sidebar global;
- sidebar do projeto;
- header;
- card de projeto;
- card de próxima ação;
- item de jornada;
- formulário em acordeão;
- painel contextual;
- resumo editável;
- pendência;
- alerta de consequência;
- botões primário, secundário e textual;
- campos de texto;
- indicadores de estado;
- estado vazio.

## Estados a representar

- normal;
- hover;
- focus;
- preenchido;
- incompleto;
- erro;
- pulado;
- pendente;
- concluído;
- salvando;
- salvo.

## Saída esperada

Antes de construir, apresente:

1. leitura crítica das referências;
2. inconsistências encontradas;
3. sistema visual proposto;
4. componentes reutilizáveis;
5. fluxo de navegação;
6. alterações recomendadas.

Depois, produza o protótipo. Não altere requisitos funcionais sem apontar a mudança.
