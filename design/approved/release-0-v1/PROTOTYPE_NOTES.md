# Hydra Release 0 — Prototype Notes

**Versão:** 1.0  
**Status:** aprovado como referência para implementação  
**Data:** 22/07/2026

## Escopo validado

- Home com nenhum, um ou vários projetos;
- criação de novo projeto;
- estado Novo projeto / Rascunho;
- atividades guiadas;
- orientação contextual;
- validação de campos obrigatórios;
- possibilidade de pular uma atividade;
- confirmação antes de pular;
- criação e resolução de pendências;
- Resumo da descoberta;
- Workspace na visão Agora;
- Mapa do projeto;
- Registros;
- estados Salvando e Salvo.

## Jornada macro aprovada

1. Descoberta
2. Definição do produto
3. Estruturação do projeto
4. Planejamento da entrega
5. Execução e acompanhamento
6. Validação e encerramento

## Atividades da fase Descoberta

1. Origem do projeto
2. Contexto inicial
3. Problema ou oportunidade
4. Público afetado
5. Estado atual
6. Resultado desejado
7. Resumo da descoberta

## Regras obrigatórias para implementação

### Atividade concluída

Uma atividade será concluída quando seus campos obrigatórios forem
preenchidos e validados.

### Atividade pulada

Uma atividade pulada:

- não deve bloquear o avanço;
- deve gerar uma pendência;
- não deve ser recomendada novamente de forma imediata;
- poderá retornar posteriormente como ação para resolver a pendência.

### Estado da fase

- todas as atividades essenciais concluídas:
  `Concluída`;

- existem atividades puladas ou pendências:
  `Concluída com pendências`;

- existem atividades obrigatórias ainda não visitadas:
  `Em andamento`.

### Estado centralizado

Home, Agora, Mapa, Resumo e Registros devem derivar do mesmo estado do
projeto. Nenhuma tela pode possuir sua própria interpretação isolada.

## Observações

- o protótipo é referência de aparência e comportamento;
- o código exportado pelo Claude Design não é código de produção;
- os dados apresentados são simulados;
- a aplicação real deverá possuir testes automatizados para as regras;
- IA, autenticação e colaboração permanecem fora do Release 0.