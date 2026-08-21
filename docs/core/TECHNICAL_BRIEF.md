# Hydra — Technical Brief

> **HISTÓRICO / NÃO AUTORIDADE CORRENTE.** Este documento descreve o
> planejamento técnico anterior à implementação (stack não decidida,
> `app/` ainda não criado). A stack já foi decidida e implementada
> (SvelteKit + TypeScript, ver `app/`). Para restrições e contrato
> técnico vigentes, o código atual é autoridade — ver
> `docs/core/README.md`.

**Versão:** 0.1  
**Status:** canônico para planejamento técnico  
**Stack:** pendente de decisão formal

## 1. Contexto

O Hydra será inicialmente:

- aplicação web;
- desenvolvido individualmente;
- construído com assistência do Claude Code;
- sem orçamento inicial;
- executado localmente antes de hospedagem;
- voltado a um único usuário;
- sem IA no MVP;
- sem integrações externas;
- desenvolvido de forma incremental.

## 2. Prioridades técnicas

1. simplicidade;
2. legibilidade;
3. facilidade de manutenção;
4. baixo custo;
5. velocidade de desenvolvimento;
6. testabilidade;
7. preservação dos dados;
8. possibilidade de expansão;
9. segurança básica.

## 3. Restrições arquiteturais

- monólito modular;
- um único repositório;
- um mecanismo principal de persistência;
- nada de microsserviços;
- nada de arquitetura distribuída;
- nada de event-driven complexo;
- nada de infraestrutura empresarial antecipada;
- nada de abstração genérica sem caso real;
- nada de dependência paga obrigatória.

## 4. Separação de responsabilidades

A implementação deve separar, conceitualmente:

### Domínio do projeto

- projeto;
- contexto;
- etapa;
- resposta;
- pendência;
- recomendação;
- artefato;
- progresso.

### Motor de orientação

- regras;
- pré-condições;
- lacunas;
- prioridade;
- recomendação;
- consequência;
- transição.

### Conteúdo metodológico

- títulos;
- instruções;
- motivos;
- exemplos;
- aprofundamentos;
- critérios de conclusão.

### Interface

- telas;
- componentes;
- navegação;
- estados visuais;
- acessibilidade.

### Persistência

- leitura;
- escrita;
- exportação;
- importação;
- validação;
- migração futura.

## 5. Princípio de preparação para IA

A IA futura deve consumir dados e regras existentes, não substituir o núcleo do produto.

Para isso:

- dados devem ser estruturados;
- regras devem ser identificáveis;
- textos devem ser separáveis;
- histórico de decisões deve ser preservado;
- recomendações devem possuir motivo;
- entradas e saídas devem ter contratos claros.

Não implementar SDK, API, embeddings, vetor ou agente no MVP.

## 6. Persistência

### Release 0

- dados simulados;
- persistência real não obrigatória.

### Walking Skeleton

- persistência simples;
- exportação JSON;
- importação JSON;
- validação do formato;
- mensagens de erro;
- proteção contra perda silenciosa.

A tecnologia será escolhida após o modelo conceitual.

## 7. Autenticação

Adiada.

O primeiro sistema funcional poderá operar localmente ou sem conta. Não criar arquitetura complexa de autenticação antes de existir necessidade.

## 8. Testes

Obrigatórios a partir do Walking Skeleton:

### Unitários

- regras do motor;
- validações;
- conclusão de etapas;
- criação de pendências;
- prioridade da recomendação.

### Integração

- persistência;
- exportação;
- importação;
- atualização de projeto.

### Jornada

- criar projeto;
- responder atividades;
- pular etapa;
- revisar resumo;
- receber próxima ação.

### Manuais

- clareza visual;
- navegação;
- estados;
- mensagens;
- acessibilidade básica.

## 9. Stack

A stack não está aprovada.

SvelteKit + TypeScript possui vantagem preliminar por:

- experiência anterior;
- menor quantidade de tecnologias novas;
- possibilidade full stack;
- boa integração com componentes;
- tipagem;
- execução em um repositório.

Antes da decisão:

1. concluir direção visual;
2. definir modelo conceitual;
3. comparar poucas opções;
4. registrar ADR-001;
5. aprovar comandos e estrutura inicial.

## 10. Dependências

Antes de adicionar qualquer dependência, registrar:

- problema resolvido;
- alternativa sem dependência;
- maturidade;
- manutenção;
- licença;
- impacto no bundle;
- impacto de aprendizado;
- custo;
- risco de lock-in.

## 11. Segurança básica

- segredos em variáveis de ambiente;
- nenhum token no Git;
- validação de entradas;
- importação de JSON tratada como não confiável;
- prevenção de execução de conteúdo importado;
- dependências revisadas;
- mensagens sem expor dados sensíveis;
- backups por exportação.

## 12. Estrutura de código

A estrutura definitiva será criada somente após decisão de stack.

A organização deverá favorecer:

- domínio identificável;
- regras testáveis;
- componentes reutilizáveis;
- baixo acoplamento;
- arquivos com tamanho compreensível;
- nomes descritivos;
- documentação apenas onde agrega valor.

## 13. Critérios para iniciar desenvolvimento

Não criar a aplicação antes de:

- telas prioritárias aprovadas;
- Release 0 revisado;
- modelo conceitual inicial;
- stack aprovada;
- ADR-001 registrado;
- plano técnico revisado;
- primeira ordem de implementação definida.

## 14. Primeira entrega funcional

O Walking Skeleton deverá provar:

```text
Criar projeto
→ registrar problema
→ definir resultado
→ visualizar resumo
→ receber próxima ação
→ salvar
→ exportar
→ importar
```

A profundidade metodológica virá depois.
