# Hydra — Instruções para o Claude Code

## 1. Objetivo do produto

Hydra é uma plataforma guiada de gerenciamento de projetos de software.

Seu diferencial central não é apenas registrar tarefas, documentos ou cronogramas. O Hydra deve orientar o usuário sobre:

1. onde ele está no projeto;
2. o que precisa fazer agora;
3. por que essa ação importa;
4. como realizá-la;
5. o que caracteriza sua conclusão;
6. o que vem depois.

O produto inicial é destinado a profissionais de tecnologia que atuam individualmente ou em equipes pequenas e precisam estruturar projetos de software sem apoio formal de PMO ou domínio avançado de gerenciamento de projetos.

## 2. Documentos canônicos

Antes de planejar ou implementar qualquer funcionalidade, leia:

- `@docs/core/PRODUCT_SPEC.md`
- `@docs/core/RELEASE_0_SPEC.md`
- `@docs/core/UX_DESIGN_SPEC.md`
- `@docs/core/TECHNICAL_BRIEF.md`
- `@TASKS.md`

Quando precisar de justificativas, histórico ou maior profundidade, consulte a documentação completa em `docs/`.

A ordem de precedência é:

1. decisão explícita mais recente do usuário;
2. documentos em `docs/core/`;
3. `TASKS.md`;
4. documentação completa em `docs/`;
5. inferências técnicas.

Se houver conflito entre documentos, não escolha silenciosamente. Apresente o conflito antes de alterar o projeto.

## 3. Escopo atual

O trabalho atual é o Release 0, destinado a validar a experiência guiada.

O Release 0 cobre:

- criação simulada de um projeto;
- identificação da origem;
- registro do contexto;
- descrição do problema ou oportunidade;
- definição do resultado desejado;
- apresentação de um resumo;
- indicação da próxima ação;
- edição de respostas;
- possibilidade de pular uma etapa;
- explicação da consequência;
- criação de pendência visível;
- visualização do mapa da jornada.

## 4. Fora do escopo atual

Não implementar sem uma nova decisão explícita:

- inteligência artificial dentro do produto;
- autenticação;
- múltiplos usuários;
- organizações;
- permissões;
- colaboração em tempo real;
- integrações externas;
- aplicativo móvel nativo;
- microsserviços;
- gestão de portfólio;
- cronograma avançado;
- controle financeiro avançado;
- dashboards corporativos;
- automações externas;
- arquitetura distribuída.

## 5. Princípios de produto

### Execução antes de ensino

O Hydra é uma ferramenta de execução com aprendizado contextual. Não deve parecer um curso.

### Orientar sem aprisionar

O sistema recomenda, explica e alerta, mas permite que o usuário continue por outro caminho.

### Complexidade progressiva

Mostrar primeiro o necessário. Informações avançadas devem ser opcionais ou contextuais.

### Uma ação principal

A interface deve destacar uma próxima ação principal. Alternativas e mapa completo devem permanecer acessíveis sem competir visualmente com a recomendação.

### Rastreabilidade

Sempre que aplicável, preservar a ligação:

```text
Problema
→ objetivo
→ capacidade
→ requisito
→ entrega
→ resultado
```

### Explicabilidade

Toda recomendação deve ter um motivo compreensível.

## 6. Regras de implementação

- Não escolher ou alterar a stack sem decisão registrada.
- Não adicionar dependência sem explicar necessidade, alternativa e impacto.
- Preferir arquitetura simples e monolítica.
- Manter regras metodológicas separadas dos componentes visuais.
- Manter textos de orientação fora dos componentes sempre que isso melhorar manutenção.
- Implementar em partes pequenas e compreensíveis.
- Não criar abstrações antes de haver necessidade real.
- Não alterar o escopo silenciosamente.
- Não esconder erros ou limitações.
- Não armazenar tokens, chaves ou segredos no repositório.
- Não realizar `commit`, `push`, `merge`, instalação global ou exclusão de arquivos sem autorização explícita.
- Não considerar uma funcionalidade concluída apenas porque a tela foi renderizada.

## 7. Forma de trabalhar

Antes de alterar arquivos:

1. leia os documentos canônicos;
2. identifique a tarefa atual em `TASKS.md`;
3. apresente o entendimento da tarefa;
4. liste os arquivos que pretende alterar;
5. apresente o plano;
6. aponte dúvidas, conflitos e riscos;
7. aguarde aprovação quando a mudança envolver arquitetura, dependências, escopo ou dados.

Durante a implementação:

- trabalhe em uma tarefa por vez;
- mantenha o escopo da tarefa;
- faça mudanças pequenas;
- preserve o comportamento já aprovado;
- execute testes aplicáveis;
- atualize documentação quando a mudança alterar comportamento ou decisão.

Ao terminar, apresente:

1. o que foi alterado;
2. arquivos afetados;
3. critérios de aceitação atendidos;
4. testes executados;
5. limitações e riscos;
6. pontos que exigem revisão humana;
7. próximo passo recomendado.

## 8. Definition of Done resumida

Uma funcionalidade só pode ser considerada concluída quando:

- critérios de aceitação foram atendidos;
- fluxo principal funciona;
- erros previsíveis foram tratados;
- testes aplicáveis passam;
- interface foi revisada;
- não existe falha crítica conhecida;
- código é compreensível;
- documentação relevante está atualizada;
- a funcionalidade pode ser demonstrada sem manipulação manual de código ou dados.

## 9. Uso de referências visuais

Referências exploratórias ficam em:

- `design/references/`
- `design/explorations/`

Somente arquivos em `design/approved/` representam direção visual aprovada.

Não tratar uma imagem exploratória como especificação definitiva.

Quando uma imagem e uma especificação funcional entrarem em conflito, a especificação funcional prevalece até decisão explícita.

## 10. Primeira resposta esperada em uma nova sessão

Ao receber uma tarefa de implementação, antes de codificar, responda com:

- entendimento do objetivo;
- documentos lidos;
- arquivos possivelmente afetados;
- plano de execução;
- critérios de aceite;
- riscos e dúvidas;
- confirmação de que não ampliará o escopo.
