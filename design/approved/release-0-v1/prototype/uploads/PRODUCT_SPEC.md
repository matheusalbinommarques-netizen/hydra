# Hydra — Product Specification

**Versão:** 0.1  
**Status:** canônico  
**Data:** 22/07/2026

## 1. Resumo

Hydra é uma plataforma guiada de gerenciamento de projetos de software.

A proposta é transformar boas práticas de gerenciamento de projetos em uma experiência de uso simples, contextual e orientada. Em vez de entregar apenas ferramentas, o Hydra ajuda o usuário a entender o que precisa fazer e em qual sequência.

## 2. Problema

Ferramentas atuais permitem criar tarefas, quadros, cronogramas e documentos, mas normalmente pressupõem que o usuário já saiba:

- qual problema deve ser definido;
- o que fazer primeiro;
- quais práticas aplicar;
- quais informações são necessárias;
- como conectar objetivos, requisitos e entregas;
- quando uma atividade está suficientemente concluída;
- qual deve ser o próximo passo.

Como consequência, ferramentas de gerenciamento podem ser utilizadas apenas como listas de tarefas, sem uma jornada metodológica coerente.

## 3. Público inicial

Profissionais de tecnologia que:

- atuam individualmente ou em equipes pequenas;
- precisam transformar uma ideia, problema ou demanda em projeto de software;
- não possuem apoio formal de PMO;
- não dominam profundamente gerenciamento de projetos;
- reconhecem o valor de organização, previsibilidade e rastreabilidade;
- desejam uma ferramenta simples e orientada.

Exemplos:

- desenvolvedor em projeto próprio;
- analista de TI responsável por melhoria interna;
- profissional liderando seu primeiro projeto;
- freelancer;
- pequeno time de produto ou software.

## 4. Proposta de valor

> O Hydra transforma boas práticas de gerenciamento de projetos em uma jornada simples, contextual e orientada, ajudando profissionais de tecnologia a saber o que fazer agora, por que fazer e o que vem depois.

## 5. Promessa

> Você não precisa dominar uma ferramenta antes de começar a gerenciar seu projeto.

## 6. Diferencial central

O diferencial do Hydra é um **Motor de Orientação Metodológica**.

Seu comportamento conceitual é:

```text
Entender o contexto
→ identificar lacunas
→ recomendar uma ação
→ explicar o motivo
→ orientar a execução
→ verificar conclusão
→ atualizar o estado
→ recomendar o próximo passo
```

O núcleo inicial será determinístico e baseado em regras. IA não é necessária para validar a proposta central.

## 7. Princípios do produto

### 7.1 Execução antes de ensino

O usuário entra para conduzir um projeto. Explicações aparecem quando ajudam uma decisão ou atividade.

### 7.2 Orientar sem aprisionar

O Hydra recomenda um caminho, mas permite:

- voltar;
- editar;
- pular;
- antecipar;
- seguir uma alternativa.

Quando o usuário se afasta do caminho recomendado, o sistema deve explicar a consequência e manter pendências visíveis.

### 7.3 Complexidade progressiva

O projeto mais simples não deve exigir artefatos avançados. A profundidade cresce conforme o contexto.

### 7.4 Uma ação principal

A tela deve deixar clara a ação recomendada atual. Alternativas e mapa completo ficam acessíveis sem competir com a ação principal.

### 7.5 Metodologia incorporada à interface

O usuário não deve precisar interpretar sozinho um manual para saber como utilizar a plataforma.

### 7.6 Explicabilidade

O sistema deve explicar por que solicita uma informação ou recomenda uma ação.

### 7.7 Rastreabilidade

O produto deve favorecer a ligação:

```text
Problema
→ necessidade
→ objetivo
→ capacidade
→ requisito
→ entrega
→ resultado
```

### 7.8 Flexibilidade controlada

Liberdade não significa ausência de contexto. O sistema registra lacunas, riscos e pendências geradas pelas decisões.

## 8. Jornada completa pretendida

```text
Criar projeto
→ entender a necessidade
→ definir o produto
→ estruturar o projeto
→ planejar a entrega
→ executar o trabalho
→ acompanhar e adaptar
→ validar resultados
→ encerrar e aprender
```

## 9. Escopo do MVP

O MVP deverá permitir:

- criar um projeto;
- registrar problema ou oportunidade;
- identificar usuário ou cliente;
- definir resultado desejado;
- criar visão e objetivo;
- registrar stakeholders, premissas, restrições e riscos;
- definir capacidades e funcionalidades;
- registrar fora do escopo;
- criar backlog;
- planejar uma primeira entrega;
- acompanhar trabalho;
- registrar impedimentos, decisões e mudanças;
- revisar resultado;
- registrar aceite, retrospectiva e lições;
- encerrar o projeto;
- visualizar a próxima ação durante a jornada.

## 10. Fora do MVP

- IA integrada;
- múltiplos usuários;
- organizações e permissões;
- colaboração em tempo real;
- integrações;
- gestão de portfólio;
- mobile nativo;
- cronograma avançado;
- finanças avançadas;
- aquisições;
- dashboards corporativos;
- arquitetura distribuída.

## 11. Critérios iniciais de sucesso

O produto será considerado útil quando um profissional de tecnologia sem treinamento prévio conseguir:

1. iniciar e estruturar um projeto pequeno;
2. entender onde está na jornada;
3. identificar o próximo passo;
4. compreender o motivo da recomendação;
5. editar decisões anteriores;
6. pular conscientemente uma etapa;
7. reconhecer pendências;
8. produzir artefatos essenciais conectados.

## 12. Tom de comunicação

Profissional, simples e próximo.

Evitar:

- linguagem infantil;
- tom professoral;
- excesso de jargão;
- textos longos na área principal;
- gamificação vazia;
- mensagens autoritárias;
- promessas de certeza metodológica.

Preferir:

- verbos de ação;
- explicações curtas;
- exemplos concretos;
- alertas proporcionais;
- liberdade com contexto.
