# Contribuindo com o Hydra

O projeto é inicialmente individual, mas seguirá práticas mínimas de controle para preservar rastreabilidade e qualidade.

## Fluxo de trabalho

1. selecionar um item em `Ready`;
2. mover para `In Progress`;
3. criar branch curta e descritiva;
4. implementar ou documentar apenas o escopo aprovado;
5. executar os testes aplicáveis;
6. revisar os critérios de aceitação;
7. abrir Pull Request;
8. mover para `In Review`;
9. aprovar e integrar;
10. mover para `Done`.

## Convenção de branches

```text
feature/<descricao>
fix/<descricao>
docs/<descricao>
spike/<descricao>
```

## Commits

Preferir commits pequenos, compreensíveis e relacionados a uma única intenção.

Exemplos:

```text
docs: consolida visão do produto
feat: adiciona recomendação de próxima ação
test: cobre regra de pendência ao pular etapa
fix: preserva respostas na importação JSON
```

## Regra para mudanças de escopo

Novas ideias entram no backlog e não alteram o ciclo em andamento, exceto quando:

- corrigem erro crítico;
- evitam perda de dados;
- resolvem risco de segurança;
- uma descoberta invalida o objetivo atual.
