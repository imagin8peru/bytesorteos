/**
 * RULETA BYTE DE TECNOLOGÍA
 * Ruleta visual, importador flexible y filtros reutilizables por sorteo.
 */
(function () {
  'use strict';
  const VIEW_MODE = new URLSearchParams(window.location.search).get('view') === 'display' ? 'display' : 'control';
  document.body.classList.add(`view-${VIEW_MODE}`);

  const INITIAL_NICKS_REF = [
    'RaulitoPerez', 'AlexTechYT', 'CodeMaster', 'LindaGamer', 'TechnoLuis', 'SoyByteFan',
    'CyberVane', 'PixelMaster', 'DevLucia', 'NicoBytes', 'TechGuru_MX', 'HardwareHero',
    'QuantumByte', 'BytesAndBits', 'RetroGaming', 'MegaTechTV', 'MasterCoder',
    'GamerPro2026', 'ZeroLatency', 'SorteosTech', 'FuturoDigital', 'AnaCode',
    'Overclocked_ES', 'MicroProcesador', 'SiliconValle', 'DataNerd', 'GeekMaster',
    'NubeKube', 'ByteKnight', 'TerminalNinja', 'FastFrame', 'UltraHD_Gamer',
    'RoboTech', 'NeuralNet', 'BitCoinerYT', 'KernelPanic', 'SyntaxError',
    'StackOverflowUser', 'GitCommit', 'MainThread'
  ];

  function generateDemoNicks(count) {
    const list = [...INITIAL_NICKS_REF];
    const prefixes = ['Tech', 'Gamer', 'Byte', 'Pixel', 'Code', 'Cyber', 'Mega', 'Ultra', 'Super', 'Zero', 'Alpha', 'Beta', 'Neon'];
    const suffixes = ['YT', 'TV', 'Pro', 'Master', 'Official', 'MX', 'ES', 'Gamer', 'Dev', 'Live', 'Zone', 'Lab'];
    if (count <= list.length) return list.slice(0, count);
    let sequence = 1;
    while (list.length < count) {
      const prefix = prefixes[sequence % prefixes.length];
      const suffix = suffixes[Math.floor(sequence / prefixes.length) % suffixes.length];
      list.push(`${prefix}${suffix}_${String(sequence).padStart(4, '0')}`);
      sequence += 1;
    }
    return list;
  }

  const DEFAULT_STATE = {
    prizeName: 'Teclado mecánico',
    spinsCount: 23,
    participants: generateDemoNicks(1248),
    participantContacts: Array(1248).fill(''), participantDetails: [],
    winnersHistory: [
      { spin: 23, number: 3, nick: 'AlexTechYT', contact: 'alex@example.com', prize: 'Teclado mecánico', eventTitle: 'Sorteo Cooler Master 50 Aniversario', registeredAt: '2026-10-01T12:45:21-05:00' },
      { spin: 22, number: 28, nick: 'CodeMaster', contact: 'code@example.com', prize: 'Teclado mecánico', eventTitle: 'Sorteo Cooler Master 50 Aniversario', registeredAt: '2026-10-01T12:41:07-05:00' },
      { spin: 21, number: 11, nick: 'LindaGamer', contact: 'linda@example.com', prize: 'Teclado mecánico', eventTitle: 'Sorteo Cooler Master 50 Aniversario', registeredAt: '2026-10-01T12:36:52-05:00' }
    ],
    prizes: null, currentPrizeIndex: 0, confirmedWinners: [], raffleComplete: false, selectedParticipant: null,
    selectedWinner: null,
    soundEnabled: true,
    hideResult: false,
    spinDurationSeconds: 6,
    googleSheetsUrl: '',
    importConfig: { nameColumn: '', contactColumn: '', countryColumn: '', answerColumn: '', duplicateColumn: '', duplicateKeep: 'first', filters: [] },
    eventTitle: 'Sorteo Cooler Master 50 Aniversario',
    winningSpinNumber: 5,
    currentSequenceSpin: 0,
    losingMessages: ['Perdiste, pendejo 😜', 'Todavía no…', '¡Casi, casi!', 'La suerte sigue girando'],
    winnerMessage: '¡Ganaste!',
    displayResult: { type: 'ready', message: 'El ganador se revelará en el giro final', spin: 0 }
  };

  let state = loadStateFromStorage();
  function activePrize() { return state.prizes[state.currentPrizeIndex] || state.prizes[state.prizes.length - 1]; }
  function syncPrize() { const prize = activePrize(); state.prizeName = prize.name; state.winningSpinNumber = prize.spins; }
  function eligibleIndexes() { const excluded = new Set(state.confirmedWinners.map(item => item.index)); return state.participants.map((_, index) => index).filter(index => !excluded.has(index)); }
  function normalizeRaffle(data) {
    data.prizes = Array.isArray(data.prizes) && data.prizes.length ? data.prizes.map((p, i) => ({ name: String(p.name || `Premio ${i + 1}`), spins: Math.min(99, Math.max(1, Number(p.spins) || 1)) })) : [{ name: data.prizeName, spins: Math.max(1, Number(data.winningSpinNumber) || 1) }];
    data.currentPrizeIndex = Math.min(data.prizes.length - 1, Math.max(0, Number(data.currentPrizeIndex) || 0));
    data.confirmedWinners = Array.isArray(data.confirmedWinners) ? data.confirmedWinners : [];
    return data;
  }
  let importedRows = [];
  let importedHeaders = [];
  let filteredImport = { participants: [], contacts: [], filtered: 0, duplicates: 0 };
  let draftParticipantEntries = [];

  function loadStateFromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem('ruleta_byte_state') || 'null');
      if (saved) {
        const restored = {
        ...DEFAULT_STATE,
        ...saved,
        importConfig: { ...DEFAULT_STATE.importConfig, ...(saved.importConfig || {}) },
        displayResult: { ...DEFAULT_STATE.displayResult, ...(saved.displayResult || {}) }
        };
        restored.participantContacts = restored.participants.map((_, index) => String(saved.participantContacts?.[index] || ''));
        restored.participantDetails = restored.participants.map((_, index) => ({ country: String(saved.participantDetails?.[index]?.country || ''), answer: String(saved.participantDetails?.[index]?.answer || '') }));
        return normalizeRaffle(restored);
      }
    } catch (error) {
      console.warn('No se pudo recuperar la configuración local:', error);
    }
    return normalizeRaffle({ ...DEFAULT_STATE, participants: [...DEFAULT_STATE.participants], participantContacts: [...DEFAULT_STATE.participantContacts], confirmedWinners: [] });
  }

  function saveStateToStorage() {
    try { localStorage.setItem('ruleta_byte_state', JSON.stringify(state)); }
    catch (error) { console.error('No se pudo guardar la configuración:', error); }
  }

  class SoundManager {
    constructor() { this.ctx = null; }
    initCtx() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
    playTick() {
      if (!state.soundEnabled) return;
      this.initCtx();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + 0.04);
      } catch (_) { /* El audio es opcional. */ }
    }
    playFanfare() {
      if (!state.soundEnabled) return;
      this.initCtx();
      if (!this.ctx) return;
      try {
        [523.25, 659.25, 783.99, 1046.50].forEach((frequency, index) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const starts = this.ctx.currentTime + index * 0.12;
          osc.frequency.setValueAtTime(frequency, starts);
          gain.gain.setValueAtTime(0.25, starts);
          gain.gain.exponentialRampToValueAtTime(0.001, starts + 0.3);
          osc.connect(gain); gain.connect(this.ctx.destination);
          osc.start(starts); osc.stop(starts + 0.3);
        });
      } catch (_) { /* El audio es opcional. */ }
    }
  }
  const audioSynth = new SoundManager();

  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    const source = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (char === '"') {
        if (quoted && source[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(field); field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && source[i + 1] === '\n') i += 1;
        row.push(field); field = '';
        if (row.some(cell => String(cell).trim())) rows.push(row);
        row = [];
      } else field += char;
    }
    row.push(field);
    if (row.some(cell => String(cell).trim())) rows.push(row);
    if (!rows.length) return [];
    const headers = rows.shift().map((header, index) => String(header).trim() || `Columna ${index + 1}`);
    return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  function normalizeSourceUrl(url) {
    const trimmed = url.trim();
    const sheetMatch = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/i);
    if (!sheetMatch) return trimmed;
    const gid = (trimmed.match(/[?#&]gid=(\d+)/i) || [])[1] || '0';
    return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
  }

  function rowsFromJSON(data) {
    const source = Array.isArray(data) ? data : (data.rows || data.participants || data.data || []);
    if (!Array.isArray(source)) throw new Error('La respuesta JSON no contiene una lista de registros.');
    return source.map(item => typeof item === 'string' ? { 'Nombre de usuario': item } : item);
  }

  const SheetsService = {
    async fetchRows(url) {
      const response = await fetch(normalizeSourceUrl(url));
      if (!response.ok) throw new Error(`La fuente respondió HTTP ${response.status}.`);
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('json') || /^[\s\r\n]*[\[{]/.test(text)) {
        try { return rowsFromJSON(JSON.parse(text)); }
        catch (error) { if (contentType.includes('json')) throw error; }
      }
      return parseCSV(text);
    },
    async pushWinner(url, winner) {
      if (!url || !/script\.google\.com/i.test(url)) return false;
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'winner', winner }) });
        return response.ok;
      } catch (_) { return false; }
    }
  };

  const elementIds = [
    'statParticipants', 'statPrize', 'statSpins', 'rouletteCanvas', 'bulbsContainer', 'spinTriggerCap',
    'soundToggle', 'winnerCard', 'selectedNumberDisplay', 'selectedNickDisplay',
    'confirmWinnerBtn', 'hideResultToggle', 'hideStatusSubtitle', 'recentWinnersGrid', 'openHistoryBtn',
    'openConfigBtn', 'closeConfigBtn', 'cancelConfigBtn', 'saveConfigBtn', 'configModal', 'prizeCountInput', 'prizesEditor', 'prizeConfigHint', 'newRaffleBtn', 'downloadParticipantsBtn',
    'participantsTextarea', 'modalNickCount', 'btnPreset50', 'btnPreset100', 'btnPreset1248',
    'spinDurationSelect', 'sheetsUrlInput', 'testSheetsBtn', 'sheetsStatus', 'csvFileInput',
    'cameraListToggle', 'cameraParticipants', 'cameraParticipantCount', 'cameraParticipantSearch', 'cameraParticipantHead', 'cameraParticipantBody', 'countryColumnSelect', 'answerColumnSelect',
    'importBuilder', 'nameColumnSelect', 'contactColumnSelect', 'duplicateColumnSelect', 'duplicateKeepSelect', 'addFilterBtn',
    'filtersContainer', 'summaryTotal', 'summaryFiltered', 'summaryDuplicates', 'summaryValid',
    'importPreview', 'previewLimitNote', 'applyImportBtn', 'clearHistoryBtn', 'resetAllBtn',
    'historyModal', 'closeHistoryBtn', 'closeHistoryFooterBtn', 'fullHistoryTableBody', 'fullHistoryCount',
    'exportCsvBtn', 'wheelDataNote', 'openDisplayBtn', 'eventTitleDisplay', 'spinProgressDisplay',
    'resultRibbonText', 'resultMessageDisplay', 'eventTitleInput',
    'winnerMessageInput', 'losingMessagesTextarea', 'resetSequenceBtn', 'sequenceConfigStatus'
  ];
  const DOM = Object.fromEntries(elementIds.map(id => [id === 'rouletteCanvas' ? 'canvas' : id, document.getElementById(id)]));

  const ctx = DOM.canvas.getContext('2d');
  const SEGMENT_COLORS = [{ bg: '#161b2e', text: '#fff' }, { bg: '#f02a8b', text: '#fff' }, { bg: '#9beb32', text: '#161b2e' }];
  let currentAngle = 0, isSpinning = false, lastSoundSliceIndex = -1, lastTickAt = 0;

  function renderOuterBulbs() {
    DOM.bulbsContainer.innerHTML = '';
    const bulbRadius = Math.max(0, (DOM.bulbsContainer.getBoundingClientRect().width / 2) - 10);
    for (let i = 0; i < 24; i += 1) {
      const bulb = document.createElement('div');
      const angle = i * 360 / 24 * Math.PI / 180;
      bulb.className = `bulb ${['active-pink', 'active-lime', 'active-white'][i % 3]}`;
      bulb.style.transform = `translate(${bulbRadius * Math.cos(angle)}px, ${bulbRadius * Math.sin(angle)}px)`;
      DOM.bulbsContainer.appendChild(bulb);
    }
  }

  function drawRouletteWheel(rotationAngle, forceLabelIndex = -1) {
    const width = DOM.canvas.width, center = width / 2, radius = center - 8;
    const total = Math.max(1, state.participants.length), sliceAngle = 2 * Math.PI / total;
    const namesVisible = total <= 18;
    const labelStep = namesVisible ? 1 : Math.max(1, Math.ceil(total / 72));
    ctx.clearRect(0, 0, width, width);
    ctx.save(); ctx.translate(center, center); ctx.rotate(rotationAngle);
    for (let i = 0; i < total; i += 1) {
      const start = i * sliceAngle, end = start + sliceAngle, colors = state.confirmedWinners.some(item => item.index === i) ? { bg: '#626271', text: '#b8b8c1' } : SEGMENT_COLORS[i % 3];
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, start, end); ctx.closePath();
      ctx.fillStyle = colors.bg; ctx.fill();
      ctx.lineWidth = total > 180 ? 0.35 : total > 60 ? 0.8 : 2.2;
      ctx.strokeStyle = '#141928'; ctx.stroke();
      if (i % labelStep !== 0 && i !== forceLabelIndex) continue;
      ctx.save(); ctx.rotate(start + sliceAngle / 2); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = colors.text;
      if (namesVisible) {
        const nick = state.participants[i] || '';
        const available = Math.max(7, Math.floor(30 - total * 0.45));
        const label = `${i + 1} · ${nick.length > available ? `${nick.slice(0, available - 1)}…` : nick}`;
        ctx.font = `700 ${total <= 10 ? 18 : 14}px 'Fredoka', sans-serif`;
        ctx.fillText(label, radius - 22, 0, radius - 105);
      } else {
        ctx.font = `700 ${total <= 72 ? 15 : 12}px 'Fredoka', sans-serif`;
        ctx.fillText(String(i + 1), radius - 20, 0);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function spinRoulette() {
    if (isSpinning || (VIEW_MODE === 'display' && !DOM.cameraParticipants.hidden)) return;
    if (state.raffleComplete) return;
    syncPrize();
    const eligible = eligibleIndexes();
    if (!eligible.length) return alert('No hay participantes válidos. Importa o agrega una lista antes de girar.');
    const winningSpin = Math.max(1, Number(state.winningSpinNumber) || 1);
    if (state.displayResult?.type === 'winner' && state.currentSequenceSpin >= winningSpin) {
      if (VIEW_MODE === 'control') alert('Confirma el ganador o reinicia la secuencia antes de volver a girar.');
      return;
    }
    isSpinning = true; DOM.cameraListToggle.disabled = true; audioSynth.initCtx();
    const total = state.participants.length, winnerIndex = eligible[Math.floor(Math.random() * eligible.length)];
    const sequenceSpin = Math.min(state.currentSequenceSpin + 1, winningSpin);
    const isWinnerSpin = sequenceSpin === winningSpin;
    const sliceAngle = 2 * Math.PI / total, pointerAngle = 3 * Math.PI / 2;
    let targetFinalAngle = pointerAngle - (winnerIndex * sliceAngle + sliceAngle / 2);
    const startAngle = currentAngle % (2 * Math.PI);
    while (targetFinalAngle < startAngle) targetFinalAngle += 2 * Math.PI;
    const finalAngle = targetFinalAngle + (5 + Math.floor(Math.random() * 3)) * 2 * Math.PI;
    const startTime = performance.now(), duration = state.spinDurationSeconds * 1000;
    const bulbInterval = setInterval(() => DOM.bulbsContainer.querySelectorAll('.bulb').forEach(bulb => {
      const colors = ['active-pink', 'active-lime', 'active-white'];
      bulb.classList.remove(...colors); bulb.classList.add(colors[Math.floor(Math.random() * colors.length)]);
    }), 120);
    function animate(now) {
      const progress = Math.min((now - startTime) / duration, 1), eased = 1 - Math.pow(1 - progress, 3);
      currentAngle = startAngle + (finalAngle - startAngle) * eased;
      drawRouletteWheel(currentAngle, winnerIndex);
      const normalized = ((pointerAngle - currentAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const passed = Math.floor(normalized / sliceAngle);
      if (passed !== lastSoundSliceIndex && now - lastTickAt > 45) {
        lastSoundSliceIndex = passed; lastTickAt = now; audioSynth.playTick();
      }
      if (progress < 1) requestAnimationFrame(animate);
      else {
        clearInterval(bulbInterval); isSpinning = false; DOM.cameraListToggle.disabled = false; renderOuterBulbs();
        state.currentSequenceSpin = sequenceSpin;
        if (isWinnerSpin) {
          state.selectedParticipant = null;
          state.selectedWinner = {
            number: winnerIndex + 1,
            nick: state.participants[winnerIndex],
            contact: state.participantContacts?.[winnerIndex] || '',
            index: winnerIndex
          };
          state.displayResult = { type: 'winner', message: state.winnerMessage || '¡Ganaste!', spin: sequenceSpin };
        } else {
          const messages = state.losingMessages?.filter(Boolean) || [];
          const message = messages.length ? messages[(sequenceSpin - 1) % messages.length] : 'Esta vez no…';
          state.selectedWinner = null;
          state.selectedParticipant = { index: winnerIndex, number: winnerIndex + 1, nick: state.participants[winnerIndex] };
          state.displayResult = { type: 'losing', message, spin: sequenceSpin };
        }
        state.spinsCount += 1; saveStateToStorage(); updateUI(); audioSynth.playFanfare();
        const animatedResult = isWinnerSpin ? DOM.selectedNickDisplay : DOM.resultMessageDisplay;
        animatedResult.classList.remove('pop-anim'); void animatedResult.offsetWidth; animatedResult.classList.add('pop-anim');
      }
    }
    requestAnimationFrame(animate);
  }

  function confirmCurrentWinner() {
    const winner = state.selectedWinner;
    if (isSpinning || !winner || winner.index < 0 || !state.participants[winner.index] || state.confirmedWinners.some(item => item.index === winner.index) || state.raffleComplete) return;
    const historyItem = {
      spin: state.spinsCount,
      number: winner.number,
      registeredAt: new Date().toISOString(),
      eventTitle: state.eventTitle || 'Sorteo en vivo',
      prize: state.prizeName || 'Premio sorpresa',
      nick: winner.nick,
      contact: winner.contact || state.participantContacts?.[winner.index] || ''
    };
    state.winnersHistory.unshift(historyItem);
    state.confirmedWinners.push({ ...historyItem, index: winner.index, prizeIndex: state.currentPrizeIndex });
    state.raffleComplete = state.currentPrizeIndex === state.prizes.length - 1;
    if (!state.raffleComplete) state.currentPrizeIndex += 1;
    syncPrize();
    state.selectedParticipant = null;
    state.selectedWinner = null;
    state.currentSequenceSpin = 0;
    state.displayResult = state.raffleComplete ? { type: 'complete', message: 'Sorteo finalizado · ¡Gracias por participar!', spin: 0 } : { type: 'ready', message: 'El ganador se revelará en el giro final', spin: 0 };
    SheetsService.pushWinner(state.googleSheetsUrl, historyItem); saveStateToStorage(); updateUI(); drawRouletteWheel(currentAngle);
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function formatRegisteredAt(item) {
    if (item.registeredAt) {
      const date = new Date(item.registeredAt);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('es-PE', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).format(date);
      }
    }
    return item.time ? `Fecha no registrada · ${item.time}` : 'Fecha no registrada';
  }

  function historyTimeOnly(item) {
    if (item.registeredAt) {
      const date = new Date(item.registeredAt);
      if (!Number.isNaN(date.getTime())) return date.toLocaleTimeString('es-PE', { hour12: false });
    }
    return item.time || '--:--:--';
  }

  function updateUI() {
    syncPrize();
    const total = state.participants.length;
    const winningSpin = Math.max(1, Number(state.winningSpinNumber) || 1);
    const nextSequenceSpin = Math.min(state.currentSequenceSpin + 1, winningSpin);
    DOM.statParticipants.textContent = total.toLocaleString('es-PE');
    DOM.statPrize.textContent = state.prizeName;
    DOM.statSpins.textContent = state.raffleComplete ? 'FINALIZADO' : `PREMIO ${state.currentPrizeIndex + 1}/${state.prizes.length} · GIRO ${state.selectedWinner ? winningSpin : nextSequenceSpin}/${winningSpin}`;
    DOM.confirmWinnerBtn.disabled = !state.selectedWinner || state.raffleComplete || isSpinning;
    DOM.eventTitleDisplay.textContent = state.eventTitle || 'Sorteo en vivo';
    DOM.wheelDataNote.textContent = total <= 18 ? `${total.toLocaleString('es-PE')} participantes · nombres visibles` : `${total.toLocaleString('es-PE')} participantes · vista numérica`;
    const result = state.displayResult || DEFAULT_STATE.displayResult;
    const selected = state.selectedWinner || (result.type === 'losing' ? state.selectedParticipant : null);
    DOM.winnerCard.classList.toggle('has-selection', Boolean(selected));
    DOM.winnerCard.classList.toggle('is-winner', result.type === 'winner');
    DOM.winnerCard.classList.toggle('is-losing', result.type !== 'winner');
    DOM.resultMessageDisplay.textContent = result.message || '';
    if (selected) {
      DOM.resultRibbonText.textContent = result.type === 'winner' ? '¡GANADOR!' : `GIRO ${result.spin} · SIN PREMIO`;
      DOM.selectedNumberDisplay.textContent = `N.º ${selected.number}`;
      DOM.selectedNickDisplay.textContent = state.hideResult ? '••••••••••••' : (selected.nick || '---');
      DOM.hideStatusSubtitle.textContent = state.hideResult ? 'El resultado está oculto para OBS' : 'El resultado se mostrará públicamente';
      DOM.spinProgressDisplay.textContent = `GIRO GANADOR · ${winningSpin} DE ${winningSpin}`;
    } else {
      DOM.resultRibbonText.textContent = state.raffleComplete ? 'SORTEO FINALIZADO' : 'LISTOS PARA GIRAR';
      DOM.selectedNumberDisplay.textContent = '';
      DOM.selectedNickDisplay.textContent = '';
      const nextSpin = Math.min(state.currentSequenceSpin + 1, winningSpin);
      DOM.spinProgressDisplay.textContent = `PRÓXIMO GIRO · ${nextSpin} DE ${winningSpin}`;
    }
    DOM.soundToggle.checked = state.soundEnabled; DOM.hideResultToggle.checked = state.hideResult;
    renderRecentWinnersGrid(); renderFullHistoryTable();
    if (VIEW_MODE === 'display' && !DOM.cameraParticipants.hidden) renderCameraParticipants();
    if (VIEW_MODE === 'display') requestAnimationFrame(fitCameraResultText);
  }

  // Fit variable messages and nicks inside the camera card's fixed dimensions.
  function fitCameraResultText() {
    [DOM.resultMessageDisplay, DOM.selectedNickDisplay].forEach(element => {
      element.style.fontSize = '';
      if (!element.textContent || !element.clientHeight) return;
      let size = parseFloat(getComputedStyle(element).fontSize);
      while (size > 12 && (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)) {
        size -= 1;
        element.style.fontSize = `${size}px`;
      }
    });
  }

  function renderRecentWinnersGrid() {
    DOM.recentWinnersGrid.innerHTML = '';
    if (!state.winnersHistory.length) {
      DOM.recentWinnersGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;font-size:.8rem;color:#5b657e;padding:12px">Aún no se han registrado ganadores.</div>'; return;
    }
    state.winnersHistory.slice(0, 6).forEach(item => {
      const row = document.createElement('div'); row.className = 'winner-row-item';
      row.innerHTML = `<span class="winner-item-spin">${escapeHTML(item.spin)}</span><span class="winner-item-num">N.º ${escapeHTML(item.number)}</span><span class="winner-item-nick" title="${escapeHTML(item.nick)}">${escapeHTML(item.nick)}</span><span class="winner-item-time">${escapeHTML(historyTimeOnly(item))}</span>`;
      DOM.recentWinnersGrid.appendChild(row);
    });
  }

  function renderFullHistoryTable() {
    DOM.fullHistoryTableBody.innerHTML = ''; DOM.fullHistoryCount.textContent = `Total: ${state.winnersHistory.length} ganadores`;
    if (!state.winnersHistory.length) { DOM.fullHistoryTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">El historial está vacío.</td></tr>'; return; }
    state.winnersHistory.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${escapeHTML(formatRegisteredAt(item))}</td><td>${escapeHTML(item.eventTitle || 'Sorteo no registrado')}</td><td>${escapeHTML(item.prize || 'Premio no registrado')}</td><td><strong style="color:var(--lime-accent)">${escapeHTML(item.nick)}</strong></td><td>${escapeHTML(item.contact || 'No registrado')}</td>`;
      DOM.fullHistoryTableBody.appendChild(row);
    });
  }

  function setSelectOptions(select, headers, includeNone = false, noneLabel = 'No eliminar duplicados') {
    const previous = select.value; select.innerHTML = '';
    if (includeNone) select.add(new Option(noneLabel, ''));
    headers.forEach(header => select.add(new Option(header, header)));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function findSuggestedHeader(headers, words, fallback = headers[0] || '') {
    return words.map(word => headers.find(header => header.toLocaleLowerCase('es').includes(word))).find(Boolean) || fallback;
  }

  function loadImportedRows(rows, sourceLabel) {
    importedRows = rows.filter(row => row && typeof row === 'object');
    importedHeaders = [...new Set(importedRows.flatMap(row => Object.keys(row)))];
    if (!importedRows.length || !importedHeaders.length) throw new Error('No se encontraron filas con encabezados.');
    setSelectOptions(DOM.nameColumnSelect, importedHeaders);
    setSelectOptions(DOM.contactColumnSelect, importedHeaders, true, 'No usar contacto');
    setSelectOptions(DOM.countryColumnSelect, importedHeaders, true, 'No mostrar país');
    setSelectOptions(DOM.answerColumnSelect, importedHeaders, true, 'No mostrar respuesta');
    setSelectOptions(DOM.duplicateColumnSelect, importedHeaders, true);
    const saved = state.importConfig || {};
    DOM.nameColumnSelect.value = importedHeaders.includes(saved.nameColumn) ? saved.nameColumn : findSuggestedHeader(importedHeaders, ['usuario', 'nombre', 'nick', 'youtube']);
    DOM.contactColumnSelect.value = importedHeaders.includes(saved.contactColumn) ? saved.contactColumn : findSuggestedHeader(importedHeaders, ['correo', 'email', 'contacto', 'celular', 'teléfono', 'telefono'], '');
    DOM.duplicateColumnSelect.value = importedHeaders.includes(saved.duplicateColumn) ? saved.duplicateColumn : findSuggestedHeader(importedHeaders, ['correo', 'email', 'usuario', 'teléfono', 'telefono']);
    DOM.countryColumnSelect.value = importedHeaders.includes(saved.countryColumn) ? saved.countryColumn : findSuggestedHeader(importedHeaders, ['país', 'pais', 'country'], '');
    DOM.answerColumnSelect.value = importedHeaders.includes(saved.answerColumn) ? saved.answerColumn : findSuggestedHeader(importedHeaders, ['respuesta', 'answer'], '');
    DOM.duplicateKeepSelect.value = saved.duplicateKeep || 'first'; DOM.filtersContainer.innerHTML = '';
    (saved.filters || []).forEach(filter => addFilterRow(filter));
    DOM.importBuilder.hidden = false; DOM.sheetsStatus.textContent = `${sourceLabel}: ${importedRows.length.toLocaleString('es-PE')} filas`; DOM.sheetsStatus.style.color = '#9beb32';
    recomputeImportPreview();
  }

  function addFilterRow(filter = {}) {
    const row = document.createElement('div'); row.className = 'filter-row';
    const column = document.createElement('select'); column.className = 'config-select filter-column'; setSelectOptions(column, importedHeaders);
    if (importedHeaders.includes(filter.column)) column.value = filter.column;
    const operator = document.createElement('select'); operator.className = 'config-select filter-operator';
    [['equals', 'Es igual a'], ['not_equals', 'No es igual a'], ['contains', 'Contiene'], ['not_contains', 'No contiene'], ['not_empty', 'No está vacío'], ['empty', 'Está vacío']].forEach(([value, label]) => operator.add(new Option(label, value)));
    operator.value = filter.operator || 'equals';
    const value = document.createElement('input'); value.className = 'config-input filter-value'; value.placeholder = 'Valor'; value.value = filter.value || '';
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'filter-remove'; remove.textContent = '×'; remove.title = 'Eliminar condición';
    function syncValueState() { value.disabled = ['empty', 'not_empty'].includes(operator.value); recomputeImportPreview(); }
    [column, value].forEach(element => element.addEventListener('input', recomputeImportPreview));
    operator.addEventListener('change', syncValueState); remove.addEventListener('click', () => { row.remove(); recomputeImportPreview(); });
    row.append(column, operator, value, remove); DOM.filtersContainer.appendChild(row); syncValueState();
  }

  function getFiltersFromUI() {
    return [...DOM.filtersContainer.querySelectorAll('.filter-row')].map(row => ({ column: row.querySelector('.filter-column').value, operator: row.querySelector('.filter-operator').value, value: row.querySelector('.filter-value').value.trim() }));
  }
  function normalized(value) { return String(value ?? '').trim().toLocaleLowerCase('es'); }
  function matchesFilter(row, filter) {
    const actual = normalized(row[filter.column]), expected = normalized(filter.value);
    if (filter.operator === 'equals') return actual === expected;
    if (filter.operator === 'not_equals') return actual !== expected;
    if (filter.operator === 'contains') return actual.includes(expected);
    if (filter.operator === 'not_contains') return !actual.includes(expected);
    if (filter.operator === 'not_empty') return actual.length > 0;
    if (filter.operator === 'empty') return actual.length === 0;
    return true;
  }

  function recomputeImportPreview() {
    if (!importedRows.length) return;
    const nameColumn = DOM.nameColumnSelect.value, contactColumn = DOM.contactColumnSelect.value, duplicateColumn = DOM.duplicateColumnSelect.value, keep = DOM.duplicateKeepSelect.value, filters = getFiltersFromUI();
    const passing = importedRows.filter(row => normalized(row[nameColumn]) && filters.every(filter => matchesFilter(row, filter)));
    let deduped = passing, duplicates = 0;
    if (duplicateColumn) {
      const seen = new Set(), source = keep === 'last' ? [...passing].reverse() : passing;
      deduped = source.filter(row => {
        const key = normalized(row[duplicateColumn]);
        if (!key) return true;
        if (seen.has(key)) { duplicates += 1; return false; }
        seen.add(key); return true;
      });
      if (keep === 'last') deduped.reverse();
    }
    filteredImport = {
      participants: deduped.map(row => String(row[nameColumn]).trim()),
      contacts: deduped.map(row => contactColumn ? String(row[contactColumn] || '').trim() : ''),
      details: deduped.map(row => ({ country: String(row[DOM.countryColumnSelect.value] || '').trim(), answer: String(row[DOM.answerColumnSelect.value] || '').trim() })),
      filtered: importedRows.length - passing.length,
      duplicates
    };
    DOM.summaryTotal.textContent = importedRows.length.toLocaleString('es-PE'); DOM.summaryFiltered.textContent = filteredImport.filtered.toLocaleString('es-PE');
    DOM.summaryDuplicates.textContent = duplicates.toLocaleString('es-PE'); DOM.summaryValid.textContent = filteredImport.participants.length.toLocaleString('es-PE');
    DOM.importPreview.innerHTML = '';
    filteredImport.participants.slice(0, 30).forEach((participant, index) => {
      const item = document.createElement('div'), number = document.createElement('b');
      item.className = 'preview-person'; number.textContent = `${index + 1}.`; item.append(number, document.createTextNode(participant)); DOM.importPreview.appendChild(item);
    });
    DOM.previewLimitNote.textContent = filteredImport.participants.length > 30 ? 'Mostrando los primeros 30' : '';
    DOM.applyImportBtn.disabled = !filteredImport.participants.length;
  }

  function openConfigModal() {
    DOM.prizeCountInput.value = state.prizes.length; renderPrizesEditor(state.prizes);
    DOM.participantsTextarea.value = state.participants.join('\n');
    draftParticipantEntries = state.participants.map((nick, index) => ({ nick, contact: state.participantContacts?.[index] || '', details: state.participantDetails?.[index] || {} }));
    DOM.modalNickCount.textContent = `${state.participants.length.toLocaleString('es-PE')} nicks`; DOM.spinDurationSelect.value = state.spinDurationSeconds;
    DOM.sheetsUrlInput.value = state.googleSheetsUrl || '';
    DOM.eventTitleInput.value = state.eventTitle || '';

    DOM.winnerMessageInput.value = state.winnerMessage || '¡Ganaste!';
    DOM.losingMessagesTextarea.value = (state.losingMessages || []).join('\n');
    updateSequenceConfigStatus();
    const locked = raffleStarted();
    [DOM.prizeCountInput, DOM.participantsTextarea, DOM.csvFileInput, DOM.testSheetsBtn, DOM.applyImportBtn, DOM.btnPreset50, DOM.btnPreset100, DOM.btnPreset1248, DOM.eventTitleInput].forEach(el => el.disabled = locked);
    DOM.prizeConfigHint.textContent = locked ? 'Hay ganadores confirmados. Para cambiar los premios o participantes, pulsa «Preparar un nuevo sorteo». El historial se conserva.' : 'Configura el nombre y los giros de cada premio. Guardar cambios reinicia los giros de prueba que aún no tengan ganador confirmado.';
    DOM.resetSequenceBtn.disabled = state.raffleComplete;
    DOM.configModal.classList.add('active');
  }

  function updateSequenceConfigStatus() {
    const winningSpin = activePrize().spins;
    DOM.sequenceConfigStatus.textContent = `Giro ${Math.min(state.currentSequenceSpin, winningSpin)} de ${winningSpin}`;
  }

  function saveConfig() {
    const participants = DOM.participantsTextarea.value.split('\n').map(value => value.trim()).filter(Boolean);
    const locked = raffleStarted();
    if (!locked) { state.prizes = readPrizesEditor(); state.currentPrizeIndex = 0; state.confirmedWinners = []; state.raffleComplete = false; }
    state.spinDurationSeconds = Number(DOM.spinDurationSelect.value) || 6;
    state.eventTitle = DOM.eventTitleInput.value.trim() || 'Sorteo en vivo';

    state.winnerMessage = DOM.winnerMessageInput.value.trim() || '¡Ganaste!';
    state.losingMessages = DOM.losingMessagesTextarea.value.split('\n').map(value => value.trim()).filter(Boolean);
    const entryQueues = new Map();
    draftParticipantEntries.forEach(entry => {
      const key = normalized(entry.nick);
      if (!entryQueues.has(key)) entryQueues.set(key, []);
      entryQueues.get(key).push(entry);
    });
    state.googleSheetsUrl = DOM.sheetsUrlInput.value.trim();
    if (!locked) state.participants = participants;
    const entries = state.participants.map(nick => entryQueues.get(normalized(nick))?.shift() || {});
    state.participantContacts = entries.map(entry => entry.contact || '');
    state.participantDetails = entries.map(entry => ({ country: entry.details?.country || '', answer: entry.details?.answer || '' }));
    if (!locked) { state.currentSequenceSpin = 0; state.selectedWinner = null; state.selectedParticipant = null; state.displayResult = { type: 'ready', message: 'El ganador se revelará en el giro final', spin: 0 }; }
    syncPrize();
    saveStateToStorage(); updateUI(); drawRouletteWheel(currentAngle); DOM.configModal.classList.remove('active');
  }

  function raffleStarted() { return state.confirmedWinners.length > 0 || isSpinning; }
  function readPrizesEditor() { return [...DOM.prizesEditor.querySelectorAll('.prize-editor-row')].map(row => ({ name: row.querySelector('.prize-name').value.trim() || 'Premio sorpresa', spins: Math.min(99, Math.max(1, Number(row.querySelector('.prize-spins').value) || 1)) })); }
  function renderPrizesEditor(prizes) {
    const count = Math.min(50, Math.max(1, Number(DOM.prizeCountInput.value) || 1)); DOM.prizeCountInput.value = count;
    DOM.prizesEditor.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      const row = document.createElement('div'); row.className = 'prize-editor-row';
      row.innerHTML = `<label>Premio ${i + 1}<input class="config-input prize-name" aria-label="Nombre del premio ${i + 1}" maxlength="120"></label><label>Giros<input class="config-input prize-spins" aria-label="Giros del premio ${i + 1}" type="number" min="1" max="99"></label>`;
      row.querySelector('.prize-name').value = prizes[i]?.name || `Premio ${i + 1}`; row.querySelector('.prize-spins').value = prizes[i]?.spins || 1;
      row.querySelectorAll('input').forEach(el => el.disabled = raffleStarted()); DOM.prizesEditor.appendChild(row);
    }
  }
  function prepareNewRaffle() {
    if (isSpinning || !confirm('¿Preparar un nuevo sorteo? Descarga la lista actual antes: se restablecerán ganadores y elegibilidad. El historial se conserva.')) return;
    state.confirmedWinners = []; state.currentPrizeIndex = 0; state.raffleComplete = false; state.currentSequenceSpin = 0; state.selectedWinner = null; state.selectedParticipant = null;
    state.displayResult = { type: 'ready', message: 'El ganador se revelará en el giro final', spin: 0 };
    syncPrize(); saveStateToStorage(); updateUI(); drawRouletteWheel(currentAngle); openConfigModal();
  }
  function participantsCSV() {
    const quote = value => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = "'" + text; return `"${text.replace(/"/g, '""')}"`; };
    const country = Boolean(state.importConfig.countryColumn) || state.participantDetails.some(item => item.country);
    const answer = Boolean(state.importConfig.answerColumn) || state.participantDetails.some(item => item.answer);
    const header = ['Número', 'Usuario', ...(country ? ['País'] : []), ...(answer ? ['Respuesta'] : []), 'Estado', 'Premio', 'Fecha de confirmación', 'Sorteo'];
    const rows = state.participants.map((nick, index) => {
      const winner = state.confirmedWinners.find(item => item.index === index), detail = state.participantDetails[index] || {};
      return [index + 1, nick, ...(country ? [detail.country || ''] : []), ...(answer ? [detail.answer || ''] : []), winner ? 'Ganador confirmado' : 'Participante habilitado', winner?.prize || '', winner?.registeredAt || '', state.eventTitle];
    });
    return '\uFEFF' + [header, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
  }
  function exportParticipantsCSV() {
    const url = URL.createObjectURL(new Blob([participantsCSV()], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    const name = (state.eventTitle || 'sorteo').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);
    link.download = `participantes_${name}_${new Date().toISOString().slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportHistoryToCSV() {
    if (!state.winnersHistory.length) return alert('No hay historial para exportar.');
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [
      'Fecha y hora,Nombre del sorteo,Premio,Nick del ganador,Dato de contacto',
      ...state.winnersHistory.map(item => [
        quote(formatRegisteredAt(item)),
        quote(item.eventTitle || 'Sorteo no registrado'),
        quote(item.prize || 'Premio no registrado'),
        quote(item.nick),
        quote(item.contact || '')
      ].join(','))
    ];
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `ganadores_ruleta_byte_${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  function setManualParticipants(list, contacts = [], details = []) {
    DOM.participantsTextarea.value = list.join('\n'); DOM.modalNickCount.textContent = `${list.length.toLocaleString('es-PE')} nicks`;
    draftParticipantEntries = list.map((nick, index) => ({ nick, contact: contacts[index] || '', details: details[index] || {} }));
  }

  function renderCameraParticipants(focusWinner = false) {
    const details = state.participantDetails || [];
    const country = Boolean(state.importConfig.countryColumn) || details.some(item => item.country);
    const answer = Boolean(state.importConfig.answerColumn) || details.some(item => item.answer);
    const query = normalized(DOM.cameraParticipantSearch.value);
    DOM.cameraParticipantHead.innerHTML = ''; DOM.cameraParticipantBody.innerHTML = '';
    const heading = document.createElement('tr');
    const columns = ['N.º', 'Usuario', 'Estado', 'Premio', ...(country ? ['País'] : []), ...(answer ? ['Respuesta'] : [])];
    columns.forEach(label => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; heading.appendChild(cell); });
    DOM.cameraParticipantHead.appendChild(heading);
    const fragment = document.createDocumentFragment();
    let winnerRow = null, shown = 0;
    state.participants.forEach((nick, index) => {
      const number = index + 1;
      if (query && (/^\d+$/.test(query) ? String(number) !== query : !normalized(nick).includes(query))) return;
      const row = document.createElement('tr');
      const confirmed = state.confirmedWinners.find(item => item.index === index);
      if (confirmed) row.className = 'participant-confirmed';
      if (!state.hideResult && state.displayResult.type === 'winner' && state.selectedWinner?.index === index) {
        row.className = 'participant-is-winner'; row.setAttribute('aria-label', `Ganador: número ${number}, ${nick}`); winnerRow = row;
      }
      [number, nick, confirmed ? 'Ya ganó' : 'Participando', confirmed?.prize || '—', ...(country ? [details[index]?.country || '—'] : []), ...(answer ? [details[index]?.answer || '—'] : [])].forEach(value => {
        const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
      });
      fragment.appendChild(row); shown += 1;
    });
    if (!shown) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = columns.length; cell.textContent = 'No se encontraron participantes'; row.appendChild(cell); fragment.appendChild(row); }
    DOM.cameraParticipantBody.appendChild(fragment);
    DOM.cameraParticipantCount.textContent = `${shown.toLocaleString('es-PE')} de ${state.participants.length.toLocaleString('es-PE')} participantes · numeración de la ruleta`;
    if (focusWinner && winnerRow) requestAnimationFrame(() => winnerRow.scrollIntoView({ block: 'center' }));
  }

  function toggleCameraParticipants() {
    const show = DOM.cameraParticipants.hidden;
    DOM.cameraParticipants.hidden = !show;
    document.body.classList.toggle('show-participants', show);
    DOM.cameraListToggle.setAttribute('aria-expanded', String(show));
    const label = show ? 'Volver a la ruleta' : 'Mostrar participantes';
    DOM.cameraListToggle.setAttribute('aria-label', label); DOM.cameraListToggle.title = label;
    DOM.cameraListToggle.querySelector('svg').innerHTML = show ? '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M6.3 17.7L17.7 6.3"/>' : '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>';
    if (show) { DOM.cameraParticipantSearch.value = ''; renderCameraParticipants(true); }
    else requestAnimationFrame(() => { renderOuterBulbs(); drawRouletteWheel(currentAngle); fitCameraResultText(); });
  }

  function init() {
    DOM.cameraListToggle.addEventListener('click', toggleCameraParticipants);
    DOM.cameraParticipantSearch.addEventListener('input', () => renderCameraParticipants());
    renderOuterBulbs(); drawRouletteWheel(currentAngle); updateUI();
    if (VIEW_MODE === 'display') {
      new ResizeObserver(fitCameraResultText).observe(DOM.winnerCard);
      document.fonts.ready.then(fitCameraResultText);
    }
    DOM.spinTriggerCap.addEventListener('click', spinRoulette); DOM.canvas.addEventListener('click', spinRoulette);
    DOM.confirmWinnerBtn.addEventListener('click', confirmCurrentWinner);
    DOM.soundToggle.addEventListener('change', event => { state.soundEnabled = event.target.checked; saveStateToStorage(); });
    DOM.hideResultToggle.addEventListener('change', event => { state.hideResult = event.target.checked; saveStateToStorage(); updateUI(); });
    DOM.openConfigBtn.addEventListener('click', openConfigModal); DOM.closeConfigBtn.addEventListener('click', () => DOM.configModal.classList.remove('active'));
    DOM.openDisplayBtn.addEventListener('click', () => window.open(`${window.location.pathname}?view=display`, 'ruletaByteDisplay'));
    DOM.cancelConfigBtn.addEventListener('click', () => DOM.configModal.classList.remove('active')); DOM.saveConfigBtn.addEventListener('click', saveConfig);
    DOM.participantsTextarea.addEventListener('input', () => { const count = DOM.participantsTextarea.value.split('\n').filter(value => value.trim()).length; DOM.modalNickCount.textContent = `${count.toLocaleString('es-PE')} nicks`; });
    DOM.btnPreset50.addEventListener('click', () => setManualParticipants(generateDemoNicks(50))); DOM.btnPreset100.addEventListener('click', () => setManualParticipants(generateDemoNicks(100)));
    DOM.btnPreset1248.addEventListener('click', () => setManualParticipants(generateDemoNicks(1248)));
    DOM.prizeCountInput.addEventListener('input', () => {
      const count = Number(DOM.prizeCountInput.value);
      if (Number.isInteger(count) && count >= 1 && count <= 50) renderPrizesEditor(readPrizesEditor());
    });
    DOM.prizeCountInput.addEventListener('change', () => renderPrizesEditor(readPrizesEditor()));
    DOM.downloadParticipantsBtn.addEventListener('click', exportParticipantsCSV);
    DOM.newRaffleBtn.addEventListener('click', prepareNewRaffle);
    DOM.resetSequenceBtn.addEventListener('click', () => {
      if (state.raffleComplete || isSpinning) return;
      state.currentSequenceSpin = 0;
      state.selectedWinner = null; state.selectedParticipant = null;
      state.displayResult = { type: 'ready', message: 'El ganador se revelará en el giro final', spin: 0 };
      saveStateToStorage(); updateSequenceConfigStatus(); updateUI();
    });
    DOM.testSheetsBtn.addEventListener('click', async () => {
      const url = DOM.sheetsUrlInput.value.trim(); if (!url) return alert('Pega la URL de una hoja pública o Web App de Apps Script.');
      DOM.sheetsStatus.textContent = 'Importando…'; DOM.sheetsStatus.style.color = '#ffb703';
      try { loadImportedRows(await SheetsService.fetchRows(url), 'Fuente conectada'); }
      catch (error) { DOM.sheetsStatus.textContent = 'No se pudo importar'; DOM.sheetsStatus.style.color = '#ff68b4'; alert(`No se pudo leer la fuente. Verifica que sea pública y permita acceso web.\n\n${error.message}`); }
    });
    DOM.csvFileInput.addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      try { loadImportedRows(parseCSV(await file.text()), file.name); } catch (error) { alert(`No se pudo leer el archivo: ${error.message}`); }
    });
    DOM.addFilterBtn.addEventListener('click', () => addFilterRow());
    [DOM.nameColumnSelect, DOM.contactColumnSelect, DOM.countryColumnSelect, DOM.answerColumnSelect, DOM.duplicateColumnSelect, DOM.duplicateKeepSelect].forEach(element => element.addEventListener('change', recomputeImportPreview));
    DOM.applyImportBtn.addEventListener('click', () => {
      if (!filteredImport.participants.length) return;
      setManualParticipants(filteredImport.participants, filteredImport.contacts, filteredImport.details);
      state.importConfig = { nameColumn: DOM.nameColumnSelect.value, contactColumn: DOM.contactColumnSelect.value, countryColumn: DOM.countryColumnSelect.value, answerColumn: DOM.answerColumnSelect.value, duplicateColumn: DOM.duplicateColumnSelect.value, duplicateKeep: DOM.duplicateKeepSelect.value, filters: getFiltersFromUI() };
      DOM.sheetsStatus.textContent = `${filteredImport.participants.length.toLocaleString('es-PE')} participantes listos`;
      DOM.participantsTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    DOM.clearHistoryBtn.addEventListener('click', () => { if (confirm('¿Limpiar todo el historial de ganadores?')) { state.winnersHistory = []; saveStateToStorage(); updateUI(); } });
    DOM.resetAllBtn.addEventListener('click', () => {
      if (!confirm('¿Restablecer participantes, filtros e historial?')) return;
      state = normalizeRaffle({ ...DEFAULT_STATE, participants: generateDemoNicks(1248), participantContacts: Array(1248).fill(''), participantDetails: [], confirmedWinners: [], importConfig: { ...DEFAULT_STATE.importConfig } });
      saveStateToStorage(); updateUI(); drawRouletteWheel(currentAngle); DOM.configModal.classList.remove('active');
    });
    DOM.openHistoryBtn.addEventListener('click', () => { renderFullHistoryTable(); DOM.historyModal.classList.add('active'); });
    DOM.closeHistoryBtn.addEventListener('click', () => DOM.historyModal.classList.remove('active')); DOM.closeHistoryFooterBtn.addEventListener('click', () => DOM.historyModal.classList.remove('active'));
    DOM.exportCsvBtn.addEventListener('click', exportHistoryToCSV);
    document.addEventListener('keydown', event => {
      if (event.code === 'Space' && !DOM.configModal.classList.contains('active') && !DOM.historyModal.classList.contains('active') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); spinRoulette(); }
    });
    window.addEventListener('storage', event => {
      if (event.key !== 'ruleta_byte_state') return;
      state = loadStateFromStorage(); updateUI(); drawRouletteWheel(currentAngle); renderOuterBulbs();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
