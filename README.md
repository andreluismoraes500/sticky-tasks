# Sticky Tasks ✦

Um sticker de tarefas para a área de trabalho, feito com **Tauri v2**: uma janela pequena, sem bordas, sempre visível, para anotações rápidas num lugar só.

## Recursos

- Janela sem bordas, com cantos arredondados e transparência
- Fica sempre por cima das outras janelas (botão de alfinete liga/desliga)
- Adicionar, concluir, editar (duplo clique) e excluir tarefas
- Barra de progresso com contador de concluídas
- Modo de seleção: marque várias tarefas (ou "Selecionar tudo") e exclua de uma vez, com confirmação
- Ordenação por data de criação (mais recentes ou mais antigas) e data exibida em cada tarefa
- 6 cores: amarelo, rosa, azul, verde, roxo e escuro (botão da paleta)
- Salva automaticamente; tudo volta como você deixou ao reabrir
- Atalhos: `Ctrl/Cmd + L` foca o campo de nova tarefa, `Ctrl/Cmd + A` seleciona tudo, `Esc` sai da seleção, `Delete` exclui as selecionadas

## Requisitos

1. [Node.js](https://nodejs.org) 18+
2. [Rust](https://rustup.rs)
3. Dependências do sistema do Tauri: https://v2.tauri.app/start/prerequisites/

## Como rodar

```bash
npm install

# gera os ícones do app a partir de uma imagem PNG quadrada (1024x1024 recomendado)
npm run tauri icon app-icon.png

# modo desenvolvimento
npm run dev

# gerar o instalador
npm run build
```

> Os ícones já estão incluídos em `src-tauri/icons`. Para trocar, substitua `app-icon.png` e rode o comando acima.

## Estrutura

```
sticky-tasks/
├── package.json
├── src/                 # interface (HTML, CSS, JS puro)
│   ├── index.html
│   ├── style.css
│   └── main.js
└── src-tauri/           # parte Rust / configuração da janela
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    └── src/{main.rs, lib.rs}
```

## Personalizando

- **Tamanho inicial da janela:** `width` e `height` em `src-tauri/tauri.conf.json`
- **Cores:** blocos `body[data-theme="..."]` em `src/style.css`
- **Novos temas:** crie um bloco novo no CSS e adicione o nome em `THEMES` no `main.js`

## Observações

- Em Linux, a transparência exige um compositor ativo (a maioria dos ambientes já tem).
- Os dados ficam no `localStorage` da própria janela do app.
