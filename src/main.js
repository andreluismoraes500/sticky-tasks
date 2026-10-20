// ---------- Tauri (opcional: o app também abre no navegador para testes) ----------
const tauriWindow = window.__TAURI__?.window?.getCurrentWindow?.();

// ---------- Estado e persistência ----------
const STORE_KEY = "sticky-tasks:v1";
const THEMES = ["yellow", "pink", "blue", "green", "purple", "dark"];

let state = load();

// Estado de seleção (não é salvo)
let selecting = false;
const selected = new Set();
let confirmTimer = null;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && Array.isArray(raw.tasks)) {
      const st = { theme: "yellow", pinned: true, sort: "desc", ...raw };
      // tarefas antigas sem data: o início do id é o timestamp de criação
      for (const t of st.tasks) {
        if (!t.createdAt) {
          const ts = parseInt(String(t.id).slice(0, -5), 36);
          t.createdAt = Number.isFinite(ts) && ts > 1e12 ? ts : Date.now();
        }
      }
      return st;
    }
  } catch (_) {}
  const now = Date.now();
  return {
    theme: "yellow",
    pinned: true,
    sort: "desc",
    tasks: [
      { id: uid(), text: "Bem-vindo! Clique na caixa para concluir ✓", done: false, createdAt: now },
      { id: uid(), text: "Duplo clique no texto para editar", done: false, createdAt: now - 1000 },
    ],
  };
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Elementos ----------
const $ = (id) => document.getElementById(id);
const listEl = $("list");
const emptyEl = $("empty");
const form = $("add-form");
const input = $("add-input");

const CHECK_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const DEL_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

// ---------- Utilidades ----------
function fmtDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startToday) return `Hoje, ${hm}`;
  if (ts >= startToday - 864e5) return `Ontem, ${hm}`;
  const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${day}, ${hm}`;
}

// Concluídas ficam no fim; dentro de cada grupo, ordena pela data de criação
function sortedTasks() {
  const dir = state.sort === "asc" ? 1 : -1;
  return [...state.tasks].sort(
    (a, b) => Number(a.done) - Number(b.done) || (a.createdAt - b.createdAt) * dir
  );
}

// ---------- Renderização ----------
function render() {
  document.body.dataset.theme = state.theme;
  document.body.classList.toggle("selecting", selecting);
  $("btn-pin").classList.toggle("active", state.pinned);
  $("btn-select").classList.toggle("active", selecting);

  const asc = state.sort === "asc";
  $("sort-label").textContent = asc ? "Mais antigas" : "Mais recentes";
  $("sort-icon").style.transform = asc ? "rotate(180deg)" : "none";

  // remove da seleção o que não existe mais
  for (const id of [...selected]) {
    if (!state.tasks.some((t) => t.id === id)) selected.delete(id);
  }

  listEl.innerHTML = "";
  for (const t of sortedTasks()) listEl.appendChild(taskEl(t));

  const total = state.tasks.length;
  const done = state.tasks.filter((t) => t.done).length;
  $("count-total").textContent = total;
  $("count-done").textContent = done;
  $("progress-bar").style.width = total ? `${(done / total) * 100}%` : "0%";

  emptyEl.classList.toggle("show", total === 0);
  listEl.style.display = total === 0 ? "none" : "flex";
  $("btn-clear").style.visibility = done > 0 && !selecting ? "visible" : "hidden";

  renderSelbar();
}

function renderSelbar() {
  const total = state.tasks.length;
  const n = selected.size;
  const all = total > 0 && n === total;

  $("sel-all-box").classList.toggle("on", all);
  $("sel-all-box").classList.toggle("partial", n > 0 && !all);
  $("sel-all-box").innerHTML = all ? CHECK_SVG : "";
  $("sel-all-label").textContent = all ? "Limpar seleção" : "Selecionar tudo";

  const del = $("sel-delete");
  del.disabled = n === 0;
  del.classList.remove("confirm");
  del.textContent = n > 0 ? `Excluir (${n})` : "Excluir";
  clearTimeout(confirmTimer);
}

function taskEl(t) {
  const li = document.createElement("li");
  li.className = "task" + (t.done ? " done" : "") + (selected.has(t.id) ? " selected" : "");
  li.dataset.id = t.id;

  if (selecting) {
    const sel = document.createElement("span");
    sel.className = "check sel";
    sel.innerHTML = CHECK_SVG;
    li.appendChild(sel);
  } else {
    const check = document.createElement("button");
    check.className = "check";
    check.setAttribute("aria-label", "Concluir");
    check.innerHTML = CHECK_SVG;
    check.addEventListener("click", () => toggle(t.id));
    li.appendChild(check);
  }

  const body = document.createElement("div");
  body.className = "body";

  const text = document.createElement("span");
  text.className = "text";
  text.textContent = t.text;

  const date = document.createElement("span");
  date.className = "date";
  date.textContent = fmtDate(t.createdAt);
  date.title = new Date(t.createdAt).toLocaleString("pt-BR");

  body.append(text, date);
  li.appendChild(body);

  if (selecting) {
    li.addEventListener("click", () => toggleSelect(t.id));
  } else {
    text.addEventListener("dblclick", () => startEdit(li, t));
    const del = document.createElement("button");
    del.className = "del";
    del.setAttribute("aria-label", "Excluir");
    del.innerHTML = DEL_SVG;
    del.addEventListener("click", () => remove(t.id, li));
    li.appendChild(del);
  }
  return li;
}

// ---------- Ações ----------
function add(text) {
  state.tasks.push({ id: uid(), text, done: false, createdAt: Date.now() });
  save();
  render();
  listEl.scrollTop = state.sort === "desc" ? 0 : listEl.scrollHeight;
}

function toggle(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  save();
  render();
}

function remove(id, li) {
  li.classList.add("removing");
  setTimeout(() => {
    state.tasks = state.tasks.filter((x) => x.id !== id);
    save();
    render();
  }, 180);
}

function startEdit(li, t) {
  const span = li.querySelector(".text");
  const editor = document.createElement("input");
  editor.className = "text-edit";
  editor.value = t.text;
  editor.maxLength = 140;
  span.replaceWith(editor);
  editor.focus();
  editor.select();

  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    const value = editor.value.trim();
    if (commit && value) t.text = value;
    save();
    render();
  };
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  editor.addEventListener("blur", () => finish(true));
}

// ---------- Seleção em lote ----------
function setSelecting(on) {
  selecting = on;
  selected.clear();
  render();
}

function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  render();
}

$("btn-select").addEventListener("click", () => setSelecting(!selecting));
$("sel-cancel").addEventListener("click", () => setSelecting(false));

$("sel-all").addEventListener("click", () => {
  if (selected.size === state.tasks.length) selected.clear();
  else state.tasks.forEach((t) => selected.add(t.id));
  render();
});

// Primeiro clique pede confirmação; o segundo exclui
$("sel-delete").addEventListener("click", () => {
  const del = $("sel-delete");
  if (!selected.size) return;
  if (!del.classList.contains("confirm")) {
    del.classList.add("confirm");
    del.textContent = `Confirmar? (${selected.size})`;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(renderSelbar, 3000);
    return;
  }
  state.tasks = state.tasks.filter((t) => !selected.has(t.id));
  selected.clear();
  selecting = false;
  save();
  render();
});

// ---------- Ordenação ----------
$("btn-sort").addEventListener("click", () => {
  state.sort = state.sort === "desc" ? "asc" : "desc";
  save();
  render();
});

// ---------- Eventos gerais ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  add(value);
  input.value = "";
  input.focus();
});

$("btn-clear").addEventListener("click", () => {
  state.tasks = state.tasks.filter((t) => !t.done);
  save();
  render();
});

$("btn-theme").addEventListener("click", () => {
  const next = THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length];
  state.theme = next;
  save();
  render();
});

$("btn-pin").addEventListener("click", async () => {
  state.pinned = !state.pinned;
  save();
  render();
  await tauriWindow?.setAlwaysOnTop(state.pinned);
});

$("btn-min").addEventListener("click", () => tauriWindow?.minimize());
$("btn-close").addEventListener("click", () => tauriWindow?.close());

window.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + L: foca o campo de nova tarefa
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
    e.preventDefault();
    if (selecting) setSelecting(false);
    input.focus();
  }
  // Ctrl/Cmd + A (fora de campos de texto): seleciona tudo
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !/input|textarea/i.test(e.target.tagName)) {
    e.preventDefault();
    if (!selecting) selecting = true;
    state.tasks.forEach((t) => selected.add(t.id));
    render();
  }
  if (e.key === "Escape" && selecting) setSelecting(false);
  if (e.key === "Delete" && selecting && selected.size) $("sel-delete").click();
});

// Atualiza "Hoje/Ontem" se o app ficar aberto por muito tempo
setInterval(() => { if (!document.querySelector(".text-edit")) render(); }, 60_000);

// ---------- Início ----------
render();
tauriWindow?.setAlwaysOnTop(state.pinned);
