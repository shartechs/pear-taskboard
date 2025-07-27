
/** @typedef {import('pear-interface')} */

import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'
const { teardown, updates } = Pear

const swarm = new Hyperswarm()
teardown(() => swarm.destroy())
updates(() => Pear.reload())

let todos = []


swarm.on('connection', peer => {
  peer.on('data', data => handleMessage(data))
  peer.on('error', err => console.error('Peer error', err))
})
swarm.on('update', () => {
  document.querySelector('#peers-count').textContent =
    swarm.connections.size
})

// UI
document
  .querySelector('#create-chat-room')
  .addEventListener('click', createRoom)
document
  .querySelector('#join-form')
  .addEventListener('submit', joinRoom)
document
  .querySelector('#todo-form')
  .addEventListener('submit', addTodo)
document
  .querySelector('#todo-search')
  .addEventListener('input', renderTodos)

// Joining Rooms logic
async function createRoom() {
  const topic = crypto.randomBytes(32)
  await joinSwarm(topic)
}

async function joinRoom(e) {
  e.preventDefault()
  const hex = document
    .querySelector('#join-chat-room-topic')
    .value.trim()
  await joinSwarm(b4a.from(hex, 'hex'))
}

async function joinSwarm(topicBuf) {
  document.querySelector('#setup').classList.add('hidden')
  document.querySelector('#loading').classList.remove('hidden')

  const discovery = swarm.join(topicBuf, {
    client: true,
    server: true
  })
  await discovery.flushed()

  document.querySelector('#chat-room-topic').innerText =
    b4a.toString(topicBuf, 'hex')
  document.querySelector('#loading').classList.add('hidden')
  document.querySelector('#todo').classList.remove('hidden')

  // request a full sync on join
  broadcast({ type: 'sync-request' })
  renderTodos()
}

// messaging
function broadcast(obj) {
  const buf = b4a.from(JSON.stringify(obj))
  for (const peer of swarm.connections) peer.write(buf)
}

function handleMessage(data) {
  let msg
  try {
    msg = JSON.parse(data.toString())
  } catch {
    return
  }

  switch (msg.type) {
    case 'add':
      upsertTodo(msg.todo, false)
      break
    case 'delete':
      removeTodo(msg.id, false)
      break
    case 'toggle':
      toggleTodo(msg.id, false)
      break
    case 'sync':
      todos = msg.todos
      renderTodos()
      break
    case 'sync-request':
      broadcast({ type: 'sync', todos })
      break
  }
}

// Todos Logic
function addTodo(e) {
  e.preventDefault()
  const nameEl = document.querySelector('#todo-name')
  const descEl = document.querySelector('#todo-desc')
  const name = nameEl.value.trim()
  if (!name) return
  const todo = {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name,
    description: descEl.value.trim(),
    timestamp: Date.now(),
    completed: false
  }
  upsertTodo(todo, true)
  e.target.reset()
}

function upsertTodo(todo, announce) {
  if (!todos.find(t => t.id === todo.id)) {
    todos.push(todo)
    todos.sort((a, b) => a.timestamp - b.timestamp)
  }
  renderTodos()
  if (announce) broadcast({ type: 'add', todo })
}

function removeTodo(id, announce) {
  todos = todos.filter(t => t.id !== id)
  renderTodos()
  if (announce) broadcast({ type: 'delete', id })
}

function toggleTodo(id, announce) {
  const t = todos.find(x => x.id === id)
  if (!t) return
  t.completed = !t.completed
  renderTodos()
  if (announce) broadcast({ type: 'toggle', id })
}

// Search functionality
function renderTodos() {
  const listEl = document.querySelector('#todo-list')
  const q = document
    .querySelector('#todo-search')
    .value.trim()
    .toLowerCase()
  listEl.innerHTML = ''

  todos.forEach(todo => {
    const dateStr = new Date(todo.timestamp).toLocaleString()
    if (
      q &&
      !(
        todo.name.toLowerCase().includes(q) ||
        dateStr.toLowerCase().includes(q)
      )
    )
      return

    const item = document.createElement('div')
    item.className = 'todo-item'
    if (todo.completed) item.classList.add('completed')

    // 1) completion checkbox
    const chk = document.createElement('input')
    chk.type = 'checkbox'
    chk.checked = todo.completed
    chk.addEventListener('change', () => toggleTodo(todo.id, true))
    item.append(chk)

    // 2) collapsible details
    const details = document.createElement('details')
    const summary = document.createElement('summary')
    summary.textContent = `${todo.name} • ${new Date(
      todo.timestamp
    ).toLocaleDateString()}`
    details.append(summary)
    if (todo.description) {
      const desc = document.createElement('div')
      desc.textContent = todo.description
      details.append(desc)
    }
    item.append(details)

    // 3) delete button
    const del = document.createElement('button')
    del.textContent = '✕'
    del.className = 'delete'
    del.addEventListener('click', e => {
      e.stopPropagation()
      removeTodo(todo.id, true)
    })
    item.append(del)

    listEl.append(item)
  })

  document.querySelector('#peers-count').textContent =
    swarm.connections.size
}
