# Hydra — Design Handoff do Release 0

**Versão:** 0.1  
**Status:** referências visuais para refinamento  
**Importante:** estas imagens ainda não são o design final aprovado.

## Objetivo

Transformar as quatro referências visuais do Release 0 em um protótipo consistente, navegável e tecnicamente implementável.

## Referências

1. `references/release-0/screen-01-home-reference-v2.png`
2. `references/release-0/screen-02-guided-activity-reference-v2.png`
3. `references/release-0/screen-03-discovery-summary-reference-v2.png`
4. `references/release-0/screen-04-workspace-reference-v2.png`
5. `brand/hydra-logo-reference.png`

## Decisões visuais consolidadas

- fundo navy quase preto;
- prata e branco para marca, títulos e contraste;
- ciano como acento principal;
- brilho forte apenas em CTA, foco, etapa ativa e próxima ação;
- superfícies predominantemente planas;
- geometria angular discreta;
- identidade tecnológica sem aparência de videogame;
- tipografia de interface altamente legível;
- não depender apenas de cor para indicar estados.

## Decisões de experiência consolidadas

### Home

- destacar `Continuar projeto`;
- mostrar etapa atual e próxima ação;
- manter projetos recentes;
- evitar analytics corporativo no MVP;
- evitar avatares e colaboração;
- `Modelos` pode aparecer como futuro, sem funcionalidade.

### Atividade guiada

- usar apresentação progressiva das perguntas;
- manter `Por que isso importa`, exemplo e critério de conclusão;
- separar claramente campos opcionais;
- mostrar salvamento;
- permitir voltar e pular;
- pular cria pendência visível;
- evitar cadeados desnecessários.

### Resumo da descoberta

- abrir com `O Hydra entendeu isto`;
- destacar problema, público e resultado;
- agrupar informações em:
  1. O projeto;
  2. O que entendemos;
  3. O que precisa de atenção;
- evitar percentuais artificiais;
- indicar lacunas com quantidade e explicação;
- usar `Resumo do projeto` como termo principal e `Project Brief` como termo secundário.

### Workspace

- usar navegação `Agora | Mapa | Registros`;
- `Agora` é a visão padrão;
- próxima ação deve dominar visualmente;
- mostrar apenas pendências relevantes;
- evitar score artificial de saúde;
- exibir situação qualitativa e explicável;
- preservar acesso ao mapa completo e registros.

## Restrições

Não adicionar ao Release 0:

- IA;
- chat;
- autenticação;
- múltiplos usuários;
- colaboração;
- portfólio;
- dashboards executivos;
- finanças;
- integrações;
- notificações complexas;
- módulos corporativos inventados.

## Entregáveis esperados do refinamento

- quatro telas desktop consistentes;
- componentes reutilizáveis;
- estados hover, focus, disabled, error e loading dos componentes críticos;
- modal ou drawer de confirmação para `Pular etapa`;
- visão de pendência criada;
- mapa da jornada;
- protótipo clicável;
- tokens de cor, espaçamento, tipografia e borda;
- lista de decisões e limitações.

## Critérios de aprovação

- a próxima ação é imediatamente identificável;
- o usuário sabe onde está;
- o usuário entende por que a atividade importa;
- o produto não parece curso;
- o produto não parece dashboard corporativo genérico;
- a UI não fica sobrecarregada;
- os textos estão corretos em português;
- o design é consistente entre as quatro telas;
- a estrutura pode ser implementada com componentes comuns;
- estados importantes combinam texto, ícone e cor.
