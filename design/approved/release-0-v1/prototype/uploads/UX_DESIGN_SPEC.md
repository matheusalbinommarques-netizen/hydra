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

A paleta final ainda não está aprovada.

Direção inicial:

- base escura ou neutra sofisticada;
- acento inspirado na identidade Hydra;
- cores de estado acessíveis;
- contraste forte;
- ausência de gradientes excessivos;
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

A direção inicial pode privilegiar tema escuro, coerente com a identidade já explorada para o Hydra, mas a escolha deverá ser validada pelas imagens de referência.

O design deve funcionar sem parecer uma interface de videogame.

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
