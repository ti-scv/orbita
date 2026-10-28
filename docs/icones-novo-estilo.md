# Novo Estilo de Ícones do Órbita — Guia e Especificação

Este documento estabelece o padrão visual e técnico para todos os ícones da interface do Órbita (SCV Messenger), em conformidade com o pedido do Danilo e a referência de estilo aprovada (`/tmp/icone-referencia.png`).

---

## 1. O Estilo Visual de Referência

A imagem de referência apresenta uma lâmpada desenhada com contorno de traço grosso e cantos arredondados, preenchida internamente com uma cor suave translúcida (estilo **duotone**).

### Princípios do Estilo:
1. **Traço uniforme e amigável:** Espessura padrão de `1.85` a `2.0` (em viewBox `0 0 24 24`), com extremidades e junções obrigatoriamente arredondadas (`strokeLinecap="round"`, `strokeLinejoin="round"`).
2. **Preenchimento suave duotone:** As formas volumétricas fechadas (corpo de objetos, círculos, cartões) contam com uma camada translúcida de preenchimento (`fill="currentColor"` com opacidade `0.20` ou `fillOpacity="0.20"`), produzindo uma tonalidade pastel harmônica na mesma família cromática do contorno.
3. **Traço puro para elementos lineares:** Setas, chevrons, sinais de adição/subtração, barras de rolagem e traçados puramente lineares mantêm traço uniforme sem preenchimento artificial.
4. **Cores do tema (NUNCA fixar amarelo):** Todos os ícones do sistema utilizam `currentColor` e as variáveis CSS semânticas do Órbita. Eles reagem automaticamente à alternância entre modo claro e escuro. A cor âmbar/dourada é exclusiva do estado aceso do botão de tema (`ThemeToggle.tsx` no modo claro, correspondendo diretamente à captura de referência).
5. **Contexto de escala e hierarquia:**
   - `14px – 16px`: Ações compactas em linhas de tabela, botões secundários e badges de coluna.
   - `18px – 20px`: Botões primários, itens de navegação na barra lateral, gavetas e formulários.
   - `22px – 24px`: Destaques, ícones de cabeçalho e modais.

---

## 2. Regra de Cores: WhatsApp e Usuário / Avatar

Conforme determinação explícita, a regra de cores consolidada do projeto foi estritamente preservada:

### Status do WhatsApp e Atendimentos (`WhatsAppStatus` e `patient-icon`)
O indicador visual de cada atendimento expressa o ciclo de vida da comunicação pelo WhatsApp, utilizando cores com alto contraste acessível (WCAG AA):

| Estado | Significado | Cor (Tema Claro) | Cor (Tema Escuro) |
| :--- | :--- | :--- | :--- |
| `sent` | Mensagem enviada / entregue / lida | `#15803d` (Verde escuro) | `#4ade80` (Verde claro) |
| `confirmed` | Paciente confirmou o agendamento | `#2563eb` (Azul royal) | `#60a5fa` (Azul celeste) |
| `declined` | Paciente recusou o agendamento | `#7c3aed` (Roxo) | `#c084fc` (Lilás) |
| `error` | Falha de entrega ou contato inválido | `#dc2626` (Vermelho) | `#f87171` (Coral vivo) |
| `not_sent` | Envio pendente / não executado | `var(--text-secondary)` | `var(--text-secondary)` |

- **Ícone do Paciente (`User` / `patient-icon`):** O avatar circular do paciente herda a cor exata do status via `currentColor`. No novo estilo duotone, a cabeça e o tronco do paciente recebem o preenchimento suave da mesma cor do status, criando um efeito visual muito mais rico e informativo.
- **Ícone de Status do WhatsApp (`WhatsApp` / `whatsapp-status`):** O balão de conversa com o fone interno recebe contorno com traço arredondado e preenchimento suave na cor do estado correspondente.
- **Marca Oficial WhatsApp:** O logotipo institucional nos nós de conexão de canais (`ReportWhatsApp.tsx`) e na animação de login preserva o verde oficial `#25D366` com o fone branco, garantindo reconhecimento imediato da marca.

---

## 3. Arquitetura do Pacote Central de Ícones

Todos os ícones da aplicação foram centralizados em `frontend/src/components/icons`:

```
frontend/src/components/icons/
├── types.ts              # Definições de tipos e propriedades (IconProps, SvgNode, etc.)
├── createDuotoneIcon.tsx # Fábrica de componentes duotone acessíveis (SVG, viewBox 24, fillOpacity 0.20)
├── definitions.ts        # Dados vetoriais de contorno e preenchimento de todos os 98 ícones + customizados
├── Icon.tsx              # Componente central <Icon name="..." /> para renderização dinâmica
└── index.ts              # Exportações nomeadas de todos os componentes e apelidos de compatibilidade
```

### Configuração de Resolução e Alias:
No `vite.config.ts` e no `tsconfig.json`, o módulo `lucide-react` foi mapeado via alias para `./src/components/icons`. Isso garante que:
1. Qualquer arquivo que importe `{ Search, Calendar, User } from "lucide-react"` recebe automaticamente a versão duotone no novo estilo.
2. Acessos diretos ou dinâmicos podem importar `{ Icon, Search } from "@/components/icons"`.
3. Novos cadastros ou telas mantêm sintaxe simples e padronizada.

---

## 4. Como Adicionar um Novo Ícone

Para adicionar um novo ícone ao ecossistema do Órbita:

1. Abra `frontend/src/components/icons/definitions.ts`.
2. Adicione a entrada do ícone no objeto `iconDefinitions`:
   ```ts
   definitions["MeuIcone"] = {
     stroke: [
       ["path", { d: "M..." }]
     ],
     fill: [
       ["path", { d: "M... Z" }] // elementos que devem receber o preenchimento translúcido
     ]
   };
   ```
3. Exporte o componente em `frontend/src/components/icons/index.ts`:
   ```ts
   export const MeuIcone = icons["MeuIcone"];
   ```
4. Utilize em qualquer tela:
   ```tsx
   <MeuIcone size={20} aria-label="Ação do ícone" />
   // ou dinamicamente:
   <Icon name="MeuIcone" size={20} />
   ```

---

## 5. Relação com Outras Sessões e Arquivos Concorrentes (Tarefas 29d / 30c)

- **Trabalho isolado:** O desenvolvimento foi realizado exclusivamente no worktree `/opt/orbita-icones`, ramificado a partir de `396f078` na branch `feature/canvas-icones`.
- **Arquivos sensíveis preservados:** `frontend/src/components/Login.tsx` e `docs/canvas-auditoria-estatica-2026-10-28.md` não foram tocados nem commitados.
- **Arquivos concorrentes das tarefas 29d e 30c:** Os arquivos `ReportCanvas.tsx`, `ReportWorkspace.tsx`, `ReportAppConnections.tsx` e `TopBar.tsx` não sofreram alterações invasivas de código no worktree de ícones. Como o novo sistema atua via alias de resolução do compilador (`vite.config.ts` e `tsconfig.json`), essas telas ganham todos os ícones duotone de forma transparente, eliminando qualquer risco de conflito no futuro rebase ou merge.

---

## 6. Testes Automatizados e Validação Visual

1. **Testes Unitários e de Conformidade (`frontend/src/icons.test.tsx`):**
   - Validação da estrutura SVG (viewBox 24, classes `orbita-icon`, grupos `.orbita-icon-fill` e `.orbita-icon-stroke`).
   - Validação do ícone de lâmpada idêntico à referência.
   - Validação da ausência de amarelos hardcoded.
   - Validação da preservação da regra de cores do WhatsApp e Usuário nos modos claro e escuro.
   - Auditoria estática que bloqueia a importação de bibliotecas concorrentes externas.
2. **Verificação do Frontend (`canvas-check.sh`):**
   - `npm ci`: OK
   - `canvas hooks`: OK
   - `tsc -b`: OK (0 erros de tipagem)
   - `vitest run`: OK (541 testes passando em 51 arquivos de teste)
   - `vite build`: OK (build completo de produção)
3. **Evidências Visuais geradas na porta 8093 (`docs/icones-qa-prints/`):**
   - `icones-01-sidebar-light.png`: Barra lateral e workspace no tema claro com ícones duotone.
   - `icones-01-sidebar-dark.png`: Barra lateral no tema escuro.
   - `icones-02-tabela-atendimentos-light.png`: Tabela com paciente e WhatsApp em todos os estados de cor.
   - `icones-02-tabela-atendimentos-dark.png`: Tabela no tema escuro com alto contraste WCAG.
   - `icones-03-theme-toggle-light.png`: Botão da lâmpada acesa no tema claro (fiel à referência).
   - `icones-03-theme-toggle-dark.png`: Botão da lâmpada no tema escuro.
   - `icones-04-matriz-98-duotone.png`: Matriz completa de todos os 98 ícones renderizados lado a lado.
