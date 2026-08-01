# Hydra — UX & Visual Design Specification

**Versão:** 0.1  
**Status:** direção inicial para exploração visual  
**Observação:** decisões visuais definitivas serão atualizadas após aprovação das telas.

## 1. Objetivo da experiência

O usuário deve sentir:

- clareza;
- orientação;
- progresso;
- segurança;
- autonomia;
- organização;
- competência.

O Hydra não deve parecer:

- uma aula;
- um sistema corporativo antigo;
- um quadro Kanban genérico;
- um formulário burocrático;
- um dashboard carregado;
- uma interface infantil;
- uma cópia de Jira, Trello ou Notion.

## 2. Personalidade visual

A interface deve ser:

- profissional;
- moderna;
- elegante;
- direta;
- tecnológica sem exagero futurista;
- densa o suficiente para transmitir capacidade;
- calma o suficiente para não gerar sobrecarga.

## 3. Conceito visual

A identidade da Hydra pode explorar a ideia de:

- múltiplos caminhos;
- expansão;
- resiliência;
- progresso ramificado;
- estrutura conectada;
- decisões que abrem novas possibilidades.

A metáfora não deve dominar a interface. Ela pode aparecer em:

- iconografia;
- linhas de conexão;
- formas discretas;
- microinterações;
- ilustrações;
- marca.

## 4. Hierarquia da informação

A ordem visual deve ser:

1. próxima ação;
2. objetivo da atividade;
3. campos ou trabalho atual;
4. progresso;
5. orientação;
6. alternativas;
7. aprofundamento.

O usuário não deve precisar ler toda a página para descobrir o CTA principal.

## 5. Estrutura recomendada do workspace

### Navegação lateral

Pode conter:

- logo;
- nome do projeto;
- mapa da jornada;
- etapa atual;
- pendências;
- configurações ou saída.

### Área principal

Contém:

- título orientado à ação;
- descrição curta;
- formulário ou atividade;
- critérios de conclusão;
- botões principais.

### Painel contextual

Contém:

- por que isso importa;
- exemplo;
- dica;
- link `Entender melhor`.

### Cabeçalho contextual

Pode apresentar:

- etapa;
- progresso;
- salvamento;
- ações secundárias.

## 6. Padrão da atividade guiada

Cada atividade deve ter:

- título com verbo;
- pergunta ou instrução central;
- texto de apoio curto;
- campos;
- exemplo acessível;
- critério de conclusão;
- CTA principal;
- voltar;
- pular quando permitido.

Evitar blocos longos de texto antes dos campos.

## 7. Próxima ação

A próxima ação deve ser um componente reconhecível e consistente.

Conteúdo:

- rótulo `Próxima ação recomendada`;
- título;
- motivo curto;
- estimativa opcional futura;
- CTA principal;
- alternativas discretas.

Ela não deve parecer anúncio, modal invasivo ou card promocional.

## 8. Mapa da jornada

O mapa deve:

- mostrar onde o usuário está;
- distinguir concluído, atual, pendente e opcional;
- permitir navegação;
- evitar aparência de curso em módulos;
- evitar exigir leitura de dezenas de etapas;
- usar texto e ícones, não apenas cores.

## 9. Pendências

Pendências devem ser:

- visíveis;
- não alarmistas;
- acionáveis;
- vinculadas à etapa;
- acompanhadas de consequência;
- fáceis de resolver.

O sistema não deve usar vermelho para qualquer pendência. Vermelho deve ser reservado a erro ou risco realmente crítico.

## 10. Tom dos textos

### Usar

- `Defina o resultado esperado`
- `Explique qual situação precisa mudar`
- `Você pode voltar e revisar isso depois`
- `Esta informação ajudará a priorizar as funcionalidades`

### Evitar

- `Módulo 2: Fundamentos da definição de escopo`
- `Resposta incorreta`
- `Você deve obrigatoriamente`
- `Parabéns! Você ganhou 50 XP`
- explicações acadêmicas extensas na área principal.

## 11. Componentes prioritários

- botão principal;
- botão secundário;
- botão textual;
- card de próxima ação;
- item da jornada;
- indicador de progresso;
- campo de texto curto;
- campo de texto longo;
- seleção em cards;
- aviso de consequência;
- pendência;
- exemplo contextual;
- resumo editável;
- estado vazio;
- confirmação de pular.

## 12. Cores

Paleta aprovada: papel/tinta/grafite (`app/src/app.css`).

- fundo e superfícies em tons neutros claros (papel), sem base escura;
- texto principal em tinta escura sobre papel — sem cor de destaque
  separada: ações primárias, links e foco usam a própria tinta;
- vermelho de lápis (`--hydra-warning`) é o único ponto de cor fora do
  neutro, reservado a conteúdo gerado/derivado pelo sistema (sugestões,
  alertas, conflitos) — nunca a ações do usuário ou decoração;
- contraste forte entre texto e papel;
- ausência de gradientes, brilho, cromado ou efeitos metálicos;
- não depender somente de verde e vermelho.

Como o usuário possui daltonismo para alguns tons de verde claro/verde-água, estados importantes devem combinar:

- ícone;
- texto;
- forma;
- contraste;
- cor.

## 13. Tipografia

Requisitos:

- alta legibilidade;
- títulos fortes, sem excesso de peso;
- corpo confortável;
- hierarquia clara;
- números e estados fáceis de escanear.

A fonte final será definida posteriormente. Não depender de fonte paga.

## 14. Tema

Tema claro (papel), coerente com a paleta papel/tinta/grafite adotada.

O design deve funcionar sem parecer uma interface de videogame, nem
sci-fi, brilhante, cromada ou metálica.

## 15. Responsividade

Release 0:

- prioridade desktop;
- adaptação básica a notebook e telas menores;
- mobile completo fora do escopo;
- nenhum elemento principal deve depender de hover.

## 16. Acessibilidade mínima

- contraste adequado;
- foco visível;
- labels explícitos;
- estados descritos por texto;
- navegação principal por teclado;
- ícones acompanhados de rótulo quando seu significado não for universal;
- mensagens de erro associadas ao campo;
- alvos de clique confortáveis.

## 17. Referências visuais

### Exploratório

- `design/references/`
- `design/explorations/`

### Aprovado

- `design/approved/`

Somente o conteúdo aprovado deve orientar a implementação final.

## 18. Telas prioritárias para geração de imagens

1. Tela inicial / projetos
2. Atividade guiada
3. Resumo da descoberta
4. Workspace principal com próxima ação

## 19. Checklist de aprovação de uma tela

- a ação principal está clara;
- a etapa atual está clara;
- a interface não parece curso;
- a orientação não domina o trabalho;
- o usuário consegue voltar;
- pular é possível quando previsto;
- consequências são compreensíveis;
- o mapa não gera sobrecarga;
- a linguagem é profissional e próxima;
- o design parece parte do mesmo produto;
- os elementos podem ser implementados como componentes reutilizáveis.

## 20. Decisões finais do Release 0

O protótipo localizado em `design/approved/release-0-v1/` é a referência
visual oficial para o primeiro desenvolvimento funcional.

### Navegação global

- Projetos
- Configurações

### Navegação dentro do projeto

- Agora
- Mapa
- Registros

### Home

A Home prioriza:

1. continuar o projeto atual;
2. visualizar fase e atividade atuais;
3. acessar projetos recentes;
4. criar um novo projeto.

Métricas corporativas e analytics permanecem fora do Release 0.

### Atividades guiadas

Cada atividade apresenta:

- fase atual;
- posição dentro da fase;
- pergunta principal;
- explicação contextual;
- exemplo;
- critério de conclusão;
- campos obrigatórios e opcionais;
- voltar;
- pular;
- salvar e continuar.

### Próxima ação

A visão Agora deve destacar uma única próxima ação recomendada, contendo:

- título;
- motivo;
- exemplo;
- critério de conclusão;
- CTA principal;
- alternativas;
- possibilidade de pular.

### Atenção e estados

A interface utiliza:

- Pendências;
- Hipóteses.

O termo `Lacunas` não será utilizado como uma terceira categoria visível.

Estados importantes devem combinar:

- texto;
- ícone;
- forma;
- cor.

### Identidade visual

- paleta papel/tinta/grafite (ver §12) — interface predominantemente
  clara, sem base navy nem acento colorido próprio;
- ações primárias, foco e etapa ativa usam a própria tinta sobre papel,
  não uma cor de destaque separada;
- superfícies predominantemente planas, com elevação sutil (sombra
  discreta) só para diferenciar camadas do shell, não para efeito
  decorativo;
- iconografia linear consistente;
- ausência de geometria futurista, brilho, cromado, metálico ou
  gradientes decorativos.

### Tipografia

- Manrope como fonte operacional — interface, formulários, listas,
  navegação, corpo e metadados;
- Source Serif 4 reservada ao nome "Hydra" e a títulos de destaque de
  página (`<h1>`), nunca à interface operacional;
- textos secundários não devem comprometer a legibilidade.

### Regra de precedência

Em caso de divergência entre imagem e requisito funcional:

1. regra funcional aprovada;
2. especificação canônica;
3. design aprovado;
4. referência exploratória.