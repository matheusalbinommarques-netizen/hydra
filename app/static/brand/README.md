# Hydra — ativos de marca

Pasta de destino no repositório:

`app/static/brand/`

## Arquivos

- `hydra-lockup-primary-transparent.png` — lockup horizontal principal, fundo transparente.
- `hydra-symbol-primary-transparent.png` — símbolo principal para tamanhos médios e grandes.
- `hydra-icon-mini-transparent.png` — mestre do ícone simplificado para tamanhos pequenos.
- `hydra-icon-mini-48.png`, `-32.png`, `-24.png`, `-16.png` — exports prontos para uso.
- `favicon.ico` — favicon com 16, 24, 32 e 48 px.

## Uso no SvelteKit

Arquivos dentro de `static/` são servidos pela raiz:

- `/brand/hydra-lockup-primary-transparent.png`
- `/brand/hydra-symbol-primary-transparent.png`
- `/brand/hydra-icon-mini-transparent.png`

## Tipografia aprovada

- Interface, formulários, listas e textos corridos: fonte sans legível.
- Serifada/nanquim: reservada ao nome “Hydra” e a títulos de destaque.
- Não aplicar a serifada pesada como fonte global da interface.

## Observação técnica

Estes arquivos são PNGs transparentes limpos a partir da arte raster aprovada. Eles não são vetores editáveis.
Para uma identidade definitiva de produção, o símbolo poderá ser redesenhado posteriormente em SVG por um
designer, preservando as proporções e a textura visual desta versão.
