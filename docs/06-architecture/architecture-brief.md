# Architecture Brief

**Status:** preliminar — escolha de stack pendente

## 1. Contexto

- aplicação web;
- usuário individual;
- sem IA;
- sem integrações externas;
- sem orçamento;
- desenvolvimento assistido pelo Claude Code;
- execução local inicialmente;
- futura hospedagem gratuita;
- persistência simples no Walking Skeleton.

## 2. Prioridades

1. simplicidade;
2. legibilidade;
3. facilidade de manutenção;
4. baixo custo;
5. velocidade de desenvolvimento;
6. testabilidade;
7. possibilidade de expansão;
8. segurança básica.

## 3. Restrições

- monólito modular;
- um repositório;
- um mecanismo de persistência;
- nada de microsserviços;
- nada de arquitetura distribuída;
- regras metodológicas separadas da UI;
- textos de orientação separados dos componentes;
- dados preparados para futura IA;
- nenhuma funcionalidade crítica como caixa-preta.

## 4. Stack

Opções serão comparadas formalmente.

SvelteKit possui vantagem preliminar porque:

- já foi utilizado em projeto anterior;
- reduz o número de tecnologias novas;
- oferece TypeScript;
- permite aplicação full stack simples;
- favorece desenvolvimento em um repositório.

A vantagem não representa decisão final.

## 5. Persistência inicial

Release 0:

- protótipo sem persistência real.

Walking Skeleton:

- persistência simples;
- exportação e importação JSON;
- banco local ou equivalente a decidir;
- modelo preparado para migração.

## 6. Testes

- unitários para regras;
- integração para persistência e importação;
- testes de jornada crítica;
- interface manual inicialmente.

## 7. Autenticação

Adiada. O Walking Skeleton poderá operar sem contas, desde que isso não comprometa a arquitetura escolhida.

## 8. Decisões pendentes

- framework;
- banco;
- ORM;
- biblioteca de UI;
- testes;
- localização da aplicação na estrutura do repositório;
- deploy;
- estratégia de migração.
