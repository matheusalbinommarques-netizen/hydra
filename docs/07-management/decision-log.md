# Registro de Decisões

| ID | Data | Decisão | Status | Justificativa |
|---|---|---|---|---|
| D001 | 22/07/2026 | Focar projetos de software | Aprovada | Reduz amplitude e permite linguagem específica |
| D002 | 22/07/2026 | Público inicial: profissionais de tecnologia | Aprovada | Define persona concreta |
| D003 | 22/07/2026 | Aplicação individual no MVP | Aprovada | Reduz complexidade |
| D004 | 22/07/2026 | Execução antes de ensino | Aprovada | Produto deve ser ferramenta |
| D005 | 22/07/2026 | Orientação incorporada à UI | Aprovada | Diferencial central |
| D006 | 22/07/2026 | Orientar sem aprisionar | Aprovada | Respeita tailoring |
| D007 | 22/07/2026 | IA fora do MVP | Aprovada | Reduz risco técnico e custo |
| D008 | 22/07/2026 | Preparar lógica para IA futura | Aprovada | Evita retrabalho estrutural |
| D009 | 22/07/2026 | Ciclos de duas semanas | Aprovada | Compatível com 10h semanais |
| D010 | 22/07/2026 | GitHub como fonte oficial | Aprovada | Centraliza histórico |
| D011 | 22/07/2026 | Claude Code como ambiente | Aprovada | Apoia implementação |
| D012 | 22/07/2026 | Repositório privado até Release 0 | Aprovada | Organizar antes da exposição |
| D013 | 22/07/2026 | MoSCoW | Aprovada | Priorização simples |
| D014 | 22/07/2026 | Persistência simples com JSON | Aprovada | Evita perda e complexidade |
| D015 | 22/07/2026 | Testes automatizados desde Walking Skeleton | Aprovada | Protege regras críticas |
| D016 | 22/07/2026 | Fluxo híbrido de entrada | Aprovada | Orientação inicial com revisão livre |
| D017 | 22/07/2026 | Uma ação principal e alternativas acessíveis | Aprovada | Reduz carga cognitiva |
| D018 | 22/07/2026 | Pular gera explicação e pendência | Aprovada | Flexibilidade controlada |
| D019 | 22/07/2026 | Comparar stacks com vantagem ao SvelteKit | Aprovada | Evita decisão prematura |
| D020 | 22/07/2026 | Arquitetura e contratos antes da implementação assistida | Aprovada | Evita caixa-preta |
| D021 | 25/07/2026 | Testes com usuários externos serão realizados quando Matheus decidir que o Hydra atingiu maturidade suficiente. Até lá, o desenvolvimento será orientado pela visão de produto, pelas especificações reconciliadas, pela validação técnica e pelo dogfooding em projetos reais. | Aprovada | Uma amostra externa pequena avaliando uma experiência ainda incompleta pode produzir conclusões circunstanciais e induzir mudanças prematuras de direção. A decisão não rejeita definitivamente testes externos; apenas coloca seu momento sob decisão explícita do Product Owner. |
| D022 | 27/07/2026 | Antecipação seletiva e consciente da vertical Cockpit/Impedimentos (registrar, classificar, definir próxima ação, resolver e reabrir um impedimento; persistência, serialização e integração ao ProjectState; tela `/cockpit`; testes e jornada correspondentes), adiantada de Release 3 sem antecipar o restante do escopo daquele release. Responsável: Matheus. | Aprovada | Vertical fina e isolada (coleção independente do catálogo metodológico, sem gerar PendingItem nem alterar o motor de orientação) que já havia sido implementada; formalizar seu escopo em vez de descartar o trabalho. Permanecem em Release 3, não antecipados: quadro completo de execução, gestão de tarefas, dependências entre tarefas, decisões operacionais completas, controle de mudanças, atualização integrada de riscos, métricas, dashboards, colaboração, notificações e priorização inteligente. |
| D023 | 31/07/2026 | Primeira fatia da etapa 3 do roadmap ("Diagnóstico e rota recomendada"): o usuário pode definir explicitamente em qual fase o catálogo o projeto realmente começa (`Project.routeStartPhaseId`, um único sinal estruturado). A rota recomendada não apaga, conclui nem pula fases anteriores — `ActivityProgress` permanece intocado; o percurso completo continua disponível no Mapa; a próxima ação de `/now` passa a operar dentro da rota recomendada; ausência de escolha preserva integralmente o comportamento atual (catálogo completo, sem adaptação). Primeira evolução do schema SQLite desde `0001_init.sql`: aplicada de forma idempotente na inicialização do repositório (`PRAGMA table_info` + `ALTER TABLE` só quando a coluna ainda não existe), fora dos métodos CRUD. Responsável: Matheus. | Aprovada | Investigação prévia confirmou que não existe hoje nenhum sinal estruturado de tipo, aplicabilidade ou contexto de projeto, e que `catalogStatus` não deve ser usado como esse sinal (é propriedade estática de autoria do catálogo, não do projeto). Fora de escopo nesta fatia: classificação/tipos de projeto, aplicabilidade por atividade, status "não aplicável", diagnóstico automático, IA, uso de `catalogStatus` como sinal — permanecem para decisão futura, quando/se necessários. |
