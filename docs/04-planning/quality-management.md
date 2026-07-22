# Plano de Gerenciamento da Qualidade

## 1. Objetivo

Assegurar que o Hydra seja simples de compreender, confiável e tecnicamente sustentável dentro das restrições do projeto.

## 2. Qualidade da experiência

Desde o protótipo, o usuário deve:

- saber onde está;
- saber o que fazer agora;
- entender por que deve fazer;
- saber o que acontecerá depois;
- editar respostas anteriores;
- pular etapas;
- entender a consequência;
- visualizar pendências;
- utilizar o fluxo sem conhecer terminologia avançada.

## 3. Plataforma inicial

- desktop;
- navegadores baseados em Chromium;
- responsividade suficiente para telas menores;
- mobile nativo fora do escopo;
- uso em celular não é requisito do Release 0.

## 4. Acessibilidade mínima

- não depender apenas de cor;
- contraste adequado;
- campos com rótulos claros;
- ações principais acessíveis por teclado;
- mensagens compreensíveis;
- foco visual perceptível.

## 5. Persistência

No Walking Skeleton:

- persistência simples;
- exportação JSON;
- importação JSON;
- validação do arquivo;
- tratamento de erro;
- prevenção de perda silenciosa.

## 6. Qualidade técnica

- arquitetura simples;
- funções e módulos com responsabilidade clara;
- código legível;
- regras metodológicas separadas da UI;
- conteúdo de orientação separado de componentes visuais;
- testes automatizados para regras críticas;
- segredos fora do repositório;
- execução local documentada;
- dependências reduzidas.

## 7. Estratégia de testes

### Automatizados

- motor de orientação;
- validações;
- transições de estado;
- pendências;
- importação e exportação;
- persistência;
- regras de conclusão.

### Manuais

- interface;
- clareza;
- navegação;
- acessibilidade básica;
- jornada completa;
- teste exploratório.

## 8. Critérios de release

Uma release não será aprovada se houver:

- perda de dados;
- bloqueio da jornada principal;
- recomendação contraditória;
- incapacidade de voltar ou editar;
- importação inválida não tratada;
- falha crítica conhecida sem mitigação.
