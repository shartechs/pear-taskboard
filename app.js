/** @typedef {import('pear-interface')} */

import Hyperswarm from "hyperswarm";
import crypto from "hypercore-crypto";
import b4a from "b4a";
const { teardown, updates } = Pear;

const swarm = new Hyperswarm();
teardown(() => swarm.destroy());
updates(() => Pear.reload());

const STATUSES = ["todo", "in-progress", "done"];
let todos = [];

let dragInitialized = false;
const sortableInstances = {};

// --- Peer networking ---
swarm.on("connection", (peer) => {
  peer.on("data", (data) => handleMessage(data));
  peer.on("error", (err) => console.error("Peer error", err));
});
swarm.on("update", () => {
  const pc = document.querySelector("#peers-count");
  if (pc) pc.textContent = swarm.connections.size;
});

// --- UI hooks ---
document
  .querySelector("#create-chat-room")
  .addEventListener("click", createRoom);
document.querySelector("#join-form").addEventListener("submit", joinRoom);
document.querySelector("#todo-form").addEventListener("submit", addTodo);
document.querySelector("#todo-search").addEventListener("input", renderTodos);

// --- Room logic ---
async function createRoom() {
  const topic = crypto.randomBytes(32);
  await joinSwarm(topic);
}

async function joinRoom(e) {
  e.preventDefault();
  const hex = document.querySelector("#join-chat-room-topic").value.trim();
  await joinSwarm(b4a.from(hex, "hex"));
}

async function joinSwarm(topicBuf) {
  document.querySelector("#setup").classList.add("hidden");
  document.querySelector("#loading").classList.remove("hidden");

  const discovery = swarm.join(topicBuf, {
    client: true,
    server: true,
  });
  await discovery.flushed();

  document.querySelector("#chat-room-topic").innerText = b4a.toString(
    topicBuf,
    "hex"
  );
  document.querySelector("#loading").classList.add("hidden");
  document.querySelector("#todo").classList.remove("hidden");

  // request full sync
  broadcast({ type: "sync-request" });

  setupDragAndDrop();
  renderTodos();
}

// --- Messaging ---
function broadcast(obj) {
  const buf = b4a.from(JSON.stringify(obj));
  for (const peer of swarm.connections) peer.write(buf);
}

function handleMessage(data) {
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch {
    return;
  }

  switch (msg.type) {
    case "add":
      upsertTodo(msg.todo, false);
      break;
    case "delete":
      removeTodo(msg.id, false);
      break;
    case "move":
      updateStatus(msg.id, msg.status, false);
      break;
    case "sync":
      todos = Array.isArray(msg.todos) ? msg.todos : [];
      renderTodos();
      break;
    case "sync-request":
      broadcast({ type: "sync", todos });
      break;
  }
}

// --- Todo operations ---
function addTodo(e) {
  e.preventDefault();
  const nameEl = document.querySelector("#todo-name");
  const descEl = document.querySelector("#todo-desc");
  const name = nameEl.value.trim();
  if (!name) return;
  const todo = {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name,
    description: descEl.value.trim(),
    timestamp: Date.now(),
    status: "todo",
  };
  upsertTodo(todo, true);
  e.target.reset();
}

function upsertTodo(todo, announce) {
  const existing = todos.find((t) => t.id === todo.id);
  if (!existing) {
    todos.push(todo);
  } else {
    existing.name = todo.name;
    existing.description = todo.description;
    existing.timestamp = todo.timestamp;
    if (todo.status) existing.status = todo.status;
  }
  sortTodos();
  renderTodos();
  if (announce) broadcast({ type: "add", todo });
}

function removeTodo(id, announce) {
  todos = todos.filter((t) => t.id !== id);
  renderTodos();
  if (announce) broadcast({ type: "delete", id });
}

function updateStatus(id, newStatus, announce) {
  if (!STATUSES.includes(newStatus)) return;
  const t = todos.find((x) => x.id === id);
  if (!t) return;
  t.status = newStatus;
  renderTodos();
  if (announce) broadcast({ type: "move", id, status: newStatus });
}

function sortTodos() {
  todos.sort((a, b) => a.timestamp - b.timestamp);
}

// --- Render & search ---
function renderTodos() {
  const q = document.querySelector("#todo-search").value.trim().toLowerCase();

  STATUSES.forEach((status) => {
    const listEl = document.querySelector(`#list-${status}`);
    if (!listEl) return;
    listEl.innerHTML = "";

    todos
      .filter((t) => t.status === status)
      .filter((t) => {
        if (!q) return true;
        const dateStr = new Date(t.timestamp).toLocaleString();
        return (
          t.name.toLowerCase().includes(q) || dateStr.toLowerCase().includes(q)
        );
      })
      .forEach((todo) => {
        const item = document.createElement("div");
        item.className = "todo-item";
        if (todo.status === "done") item.classList.add("done");
        item.dataset.id = todo.id;

        // title + meta
        const summary = document.createElement("div");
        summary.className = "todo-summary";
        summary.innerHTML = `<div><strong>${escapeHtml(
          todo.name
        )}</strong></div><div class="todo-meta">${new Date(
          todo.timestamp
        ).toLocaleDateString()}</div>`;
        item.append(summary);

        // description
        if (todo.description) {
          const desc = document.createElement("div");
          desc.className = "todo-desc";
          desc.textContent = todo.description;
          item.append(desc);
        }

        // delete
        const del = document.createElement("button");
        del.className = "delete";
        del.setAttribute("aria-label", "Delete task");
        del.textContent = "✕";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          removeTodo(todo.id, true);
        });
        item.append(del);

        listEl.append(item);
      });
  });

  const pc = document.querySelector("#peers-count");
  if (pc) pc.textContent = swarm.connections.size;
}

// --- Drag & Drop (SortableJS) ---
function setupDragAndDrop() {
  if (dragInitialized) return;
  if (typeof Sortable === "undefined") {
    console.warn("SortableJS not present; drag/drop won’t initialize");
    return;
  }

  STATUSES.forEach((status) => {
    const el = document.getElementById(`list-${status}`);
    if (!el) return;

    sortableInstances[status] = Sortable.create(el, {
      group: { name: "todos", pull: true, put: true },
      animation: 150,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onAdd: (evt) => {
        const id = evt.item.dataset.id;
        const targetStatus = evt.to.dataset.status;
        if (id && targetStatus) {
          updateStatus(id, targetStatus, true);
        }
      },
    });
  });

  dragInitialized = true;
}

// --- Helpers ---
function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
