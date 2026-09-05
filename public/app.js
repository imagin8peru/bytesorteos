const setupView = document.querySelector('#setup-view');
const liveView = document.querySelector('#live-view');
const canvas = document.querySelector('#wheel');
const ctx = canvas.getContext('2d');
const result = document.querySelector('#result');
const spinButtons = [document.querySelector('#spin'), document.querySelector('#spin-main')];

let participants = Array.from({ length: 120 }, (_, index) => ({
  id: index + 2,
  label: `Usuario_${String(index + 2).padStart(3, '0')}`
}));
let activeParticipants = [...participants];
let rotation = 0;
let currentSpin = 0;
let spinning = false;
const tau = Math.PI * 2;

function parseCsv(text) {
  const delimiter = text.includes(';') && !text.includes(',') ? ';' : ',';
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(field.trim()); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = '';
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function secureInteger(max) {
  if (max <= 0) return 0;
  const range = 0x100000000;
  const limit = range - (range % max);
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return values[0] % max;
}

function mode() {
  const selected = document.querySelector('#label-mode').value;
  return selected === 'auto' ? (activeParticipants.length > 140 ? 'numbers' : 'names') : selected;
}

function labelFor(person) {
  return mode() === 'numbers' ? `#${person.id}` : person.label;
}

function resizeCanvas() {
  const size = Math.max(320, Math.round(canvas.getBoundingClientRect().width));
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawWheel(size);
}

function drawWheel(size = canvas.getBoundingClientRect().width) {
  const n = activeParticipants.length || 1;
  const sector = tau / n;
  const radius = size / 2 - 8;
  const center = size / 2;
  const colors = ['#e53935', '#1769d2', '#10a66a'];
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < n; i += 1) {
    const start = rotation + i * sector - Math.PI / 2;
    const end = start + sector;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[i % 3];
    ctx.fill();
    if (n <= 180) { ctx.strokeStyle = '#080b12'; ctx.lineWidth = .5; ctx.stroke(); }
    const angle = start + sector / 2;
    const fontSize = Math.max(7, Math.min(13, radius * sector * .66));
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(angle);
    ctx.translate(radius * .94, 0);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${fontSize}px system-ui`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelFor(activeParticipants[i]), 0, 0, radius * .72);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(center, center, radius * .14, 0, tau);
  ctx.fillStyle = '#070a12';
  ctx.fill();
  ctx.strokeStyle = '#e8ebf2';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function updateSummary() {
  const n = participants.length;
  document.querySelector('#total-count').textContent = n;
  document.querySelector('#angle-count').textContent = `${(360 / Math.max(n, 1)).toFixed(3)}°`;
  document.querySelector('#spin-count').textContent = document.querySelector('#winning-spin').value;
  document.querySelector('#participant-summary').textContent = `${n} registros disponibles localmente`;
}

async function loadCsv(file) {
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return;
  const dataRows = rows.slice(1).filter(row => row.some(Boolean));
  participants = dataRows.map((row, index) => ({ id: index + 2, label: row.find(Boolean) || `Fila ${index + 2}` }));
  activeParticipants = [...participants];
  updateSummary();
}

function prepare() {
  activeParticipants = [...participants];
  currentSpin = 0;
  rotation = 0;
  document.querySelector('#live-prize').textContent = document.querySelector('#prize').value.trim() || 'Premio del canal';
  document.querySelector('#target-spin').textContent = document.querySelector('#winning-spin').value;
  document.querySelector('#current-spin').textContent = '0';
  document.querySelector('#live-count').textContent = `${activeParticipants.length} participantes`;
  result.classList.add('hidden');
  setupView.classList.add('hidden');
  liveView.classList.remove('hidden');
  requestAnimationFrame(resizeCanvas);
}

function spin() {
  if (spinning || !activeParticipants.length) return;
  spinning = true;
  result.classList.add('hidden');
  const winnerIndex = secureInteger(activeParticipants.length);
  const winner = activeParticipants[winnerIndex];
  const sector = tau / activeParticipants.length;
  const startRotation = rotation;
  let target = -(winnerIndex + .5) * sector - (6 + secureInteger(3)) * tau;
  while (target >= startRotation) target -= tau;
  const startTime = performance.now();
  const duration = 3500;
  spinButtons.forEach(button => button.disabled = true);

  function frame(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);
    rotation = startRotation + (target - startRotation) * eased;
    drawWheel();
    if (progress < 1) return requestAnimationFrame(frame);
    rotation = target;
    currentSpin += 1;
    document.querySelector('#current-spin').textContent = currentSpin;
    const targetSpin = Number(document.querySelector('#winning-spin').value);
    const isWinner = currentSpin === targetSpin;
    document.querySelector('#result-kind').textContent = isWinner ? 'GANADOR' : 'SELECCIONADO PROVISIONAL';
    document.querySelector('#result-name').textContent = `#${winner.id} · ${winner.label}`;
    document.querySelector('#result-message').textContent = isWinner ? '¡Este es el giro ganador!' : document.querySelector('#non-winner-message').value.replaceAll('{usuario}', winner.label);
    document.querySelector('#continue').textContent = isWinner ? 'Finalizar' : 'Siguiente giro';
    result.classList.remove('hidden');
    if (!isWinner && document.querySelector('#remove-selected').checked) {
      activeParticipants.splice(winnerIndex, 1);
      document.querySelector('#live-count').textContent = `${activeParticipants.length} participantes`;
    }
    spinning = false;
    spinButtons.forEach(button => button.disabled = isWinner);
  }
  requestAnimationFrame(frame);
}

document.querySelector('#csv-file').addEventListener('change', event => event.target.files[0] && loadCsv(event.target.files[0]));
document.querySelector('#winning-spin').addEventListener('input', updateSummary);
document.querySelector('#prepare').addEventListener('click', prepare);
document.querySelector('#back').addEventListener('click', () => { if (!spinning) { liveView.classList.add('hidden'); setupView.classList.remove('hidden'); } });
document.querySelector('#continue').addEventListener('click', () => result.classList.add('hidden'));
spinButtons.forEach(button => button.addEventListener('click', spin));
addEventListener('resize', () => { if (!liveView.classList.contains('hidden')) resizeCanvas(); });
updateSummary();
