/**
 * app.js - Protocollo dei 7 Vettori dell'Intensità
 * 
 * ============================================================================
 * MATEMATICA E LOGICA DEL TEMPORAL RESET SETTIMANALE AUTOMATICO
 * ============================================================================
 * Sia T_now il timestamp corrente in millisecondi (Date.now()).
 * Sia T_last_reset il timestamp dell'ultimo reset registrato in LocalStorage.
 * 
 * Per determinare se è necessario eseguire un reset automatico, calcoliamo il
 * timestamp T_monday_start corrispondente all'inizio della settimana corrente
 * (Lunedì alle ore 00:00:00.000 locali).
 * 
 * 1. Otteniamo il giorno corrente del sistema d in {0..6} via getDay() (0 = Domenica, 1 = Lunedì...).
 * 2. Mappiamo Domenica (0) a 7 per avere un indice ISO d_iso in {1..7} (Lunedì=1, Domenica=7):
 *    d_iso = (d === 0) ? 7 : d
 * 3. Sottraiamo (d_iso - 1) giorni dal giorno corrente per risalire a Lunedì.
 * 4. Azzariamo ore, minuti, secondi e millisecondi per posizionarci esattamente a mezzanotte:
 *    T_monday_start = Monday(00:00:00.000)
 * 
 * Condizione di Reset:
 *    T_last_reset < T_monday_start
 * ============================================================================
 */
// 0. Global Error Logger (diagnostic tool for mobile devices)
window.onerror = function (message, source, lineno, colno, error) {
  const errorDiv = document.createElement("div");
  errorDiv.style.position = "fixed";
  errorDiv.style.top = "0";
  errorDiv.style.left = "0";
  errorDiv.style.width = "100%";
  errorDiv.style.background = "#a82021";
  errorDiv.style.color = "#fff";
  errorDiv.style.padding = "15px";
  errorDiv.style.zIndex = "999999";
  errorDiv.style.fontSize = "13px";
  errorDiv.style.fontFamily = "monospace";
  errorDiv.style.textAlign = "left";
  errorDiv.style.whiteSpace = "pre-wrap";
  errorDiv.innerHTML = "Global Error: " + message + "<br>Source: " + source + ":" + lineno + ":" + colno;
  document.body.appendChild(errorDiv);
  return false;
};

let isInitialized = false;

// 1. Dataset: Set a doppio vettore proattivo
const VETTORI_DECK_INITIAL = [
  { id: 1, tipo: "Diretto", testo: "Quale deviazione audace ho evitato oggi per rimanere comodo, e come posso riprogrammare esattamente quella deviazione (o una simile) per la giornata di domani?", usata: false },
  { id: 2, tipo: "Esistenziale", testo: "Se oggi è stato un capitolo piatto, quale singola azione straordinaria o fuori dagli schemi pianifico deliberatamente per domani per rendere memorabile questa settimana?", usata: false },
  { id: 3, tipo: "Regia Cinematografica", testo: "Se un regista tagliasse la giornata di oggi perché priva di colpi di scena, quale 'scena madre' o inversione di rotta inaspettata decido di scrivere e recitare domani?", usata: false },
  { id: 4, tipo: "Generatore di Aneddoti", testo: "Oggi non ha prodotto storie da raccontare. Quale micro-azione insolita o rischiosa imposterò domani per assicurarmi un aneddoto memorabile tra vent'anni?", usata: false },
  { id: 5, tipo: "Alter Ego", testo: "Se oggi il mio alter ego audace è rimasto in ombra, in quale momento esatto di domani gli cederò il controllo e quale azione dirompente gli farò compiere?", usata: false },
  { id: 6, tipo: "Costo del Rimpianto", testo: "Quale stimolo elettrizzante ho sacrificato oggi sull'altare della routine, e in quale blocco orario di domani inserirò una scommessa deliberata contro la noia?", usata: false },
  { id: 7, tipo: "Uscita di Sicurezza", testo: "Dove sono stato troppo 'prevedibile' oggi per compiacere gli altri? In quale interazione di domani romperò lo schema per agire con assoluta e sorprendente autenticità?", usata: false }
];

// 2. Stato Applicativo Globale (Senza storico riflessioni)
let state = {
  mazzo: JSON.parse(JSON.stringify(VETTORI_DECK_INITIAL)),
  lastReset: 0,
  activeQuestionId: null,      // ID della domanda attiva correntemente
  activeQuestionDate: null     // Data di estrazione
};

// Chiave di persistenza in LocalStorage
const STORAGE_KEY = "protocollo_7_vettori_state_v3";

// 3. Riferimenti agli elementi DOM (inizializzati al caricamento della pagina)
const dom = {};

function initDOM() {
  dom.deckCounter = document.getElementById("deck-counter");
  dom.resetStatus = document.getElementById("reset-status");
  dom.deckGrid = document.getElementById("deck-grid");
  dom.cardBackView = document.getElementById("card-back-view");
  dom.activeCardView = document.getElementById("active-card-view");
  dom.categoryBadge = document.getElementById("category-badge");
  dom.cardDate = document.getElementById("card-date");
  dom.questionText = document.getElementById("question-text");
  dom.btnExtract = document.getElementById("btn-extract");
  dom.btnManualReset = document.getElementById("btn-manual-reset");
}

// 4. Caricamento e Persistenza dello Stato
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        state.mazzo = parsed.mazzo && parsed.mazzo.length === 7 ? parsed.mazzo : JSON.parse(JSON.stringify(VETTORI_DECK_INITIAL));
        state.lastReset = typeof parsed.lastReset === 'number' ? parsed.lastReset : Date.now();
        state.activeQuestionId = typeof parsed.activeQuestionId === 'number' || parsed.activeQuestionId === null ? parsed.activeQuestionId : null;
        state.activeQuestionDate = typeof parsed.activeQuestionDate === 'string' || parsed.activeQuestionDate === null ? parsed.activeQuestionDate : null;
      } else {
        initDefaultState();
      }
    } catch (e) {
      console.error("Errore nel parse dello stato, inizializzo default", e);
      initDefaultState();
    }
  } else {
    initDefaultState();
  }
}

function initDefaultState() {
  state.mazzo = JSON.parse(JSON.stringify(VETTORI_DECK_INITIAL));
  state.lastReset = Date.now();
  state.activeQuestionId = null;
  state.activeQuestionDate = null;
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// 5. Funzioni Temporali (Reset Automatico Lunedì)
function getStartOfWeekMonday() {
  const now = new Date();
  const day = now.getDay();
  const isoDay = (day === 0) ? 7 : day;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() - (isoDay - 1));
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

function checkWeeklyReset() {
  const mondayStart = getStartOfWeekMonday();
  if (state.lastReset < mondayStart) {
    console.log("Weekly reset rilevato! Ripristino il mazzo...");
    resetMazzo();
    return true;
  }
  return false;
}

function resetMazzo() {
  state.mazzo.forEach(q => q.usata = false);
  state.activeQuestionId = null;
  state.activeQuestionDate = null;
  state.lastReset = Date.now();
  saveState();
  renderAll();
  console.log("Mazzo ripristinato con successo.");
}

// 6. Formattazione Date
function formatDate(date) {
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('it-IT', options);
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 7. Estrazione Domanda (Estraibile in ogni momento, purché rimangano carte)
function estraiDomanda() {
  const pool = state.mazzo.filter(q => !q.usata);
  
  if (pool.length === 0) {
    if (confirm("Tutti i 7 vettori sono stati estratti questa settimana. Vuoi reinizializzare il mazzo per ricominciare?")) {
      resetMazzo();
    }
    return;
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selectedQuestion = pool[randomIndex];

  const originalQuestion = state.mazzo.find(q => q.id === selectedQuestion.id);
  if (originalQuestion) {
    originalQuestion.usata = true;
  }

  state.activeQuestionId = selectedQuestion.id;
  state.activeQuestionDate = getTodayString();
  
  saveState();

  // Animazione card shuffle
  const cardDesign = document.querySelector(".card-back-design");
  if (cardDesign && !dom.cardBackView.classList.contains("hidden")) {
    cardDesign.classList.add("card-shake");
    setTimeout(() => {
      cardDesign.classList.remove("card-shake");
      renderAll();
    }, 500);
  } else {
    // Se la carta era già rivelata, facciamo un effetto di fade sull'area di testo
    const activeView = dom.activeCardView;
    activeView.style.opacity = "0.3";
    setTimeout(() => {
      renderAll();
      activeView.style.opacity = "1";
    }, 150);
  }
}

// 8. Aggiornamento UI (Rendering Centrato e Semplificato)
function renderAll() {
  const activeQuestion = state.mazzo.find(q => q.id === state.activeQuestionId);
  
  // A. Aggiorna Contatori
  const usateCount = state.mazzo.filter(q => q.usata).length;
  dom.deckCounter.textContent = `${usateCount} / 7 estratti`;
  
  const nextResetDate = new Date(getStartOfWeekMonday() + 7 * 24 * 60 * 60 * 1000);
  dom.resetStatus.textContent = formatDate(nextResetDate) + " 00:00";

  // B. Aggiorna la griglia visuale
  dom.deckGrid.innerHTML = "";
  VETTORI_DECK_INITIAL.forEach(vInit => {
    const currentStatus = state.mazzo.find(q => q.id === vInit.id);
    const pill = document.createElement("div");
    pill.className = `vector-pill v-${vInit.id} ${currentStatus.usata ? 'used' : ''}`;
    pill.title = `${vInit.tipo}: ${vInit.testo}`;
    pill.setAttribute("data-figma-id", `vector-pill-${vInit.id}`);

    pill.innerHTML = `
      <span class="vector-num">V${vInit.id}</span>
      <span class="vector-name">${vInit.tipo}</span>
    `;
    dom.deckGrid.appendChild(pill);
  });

  // C. Gestione dello Stage
  if (!activeQuestion) {
    // Nessun vettore attivo: mostra il dorso della carta
    dom.cardBackView.classList.remove("hidden");
    dom.activeCardView.classList.add("hidden");
  } else {
    // Vettore attivo: mostra la domanda rivelata
    dom.cardBackView.classList.add("hidden");
    dom.activeCardView.classList.remove("hidden");
    
    dom.categoryBadge.textContent = activeQuestion.tipo;
    dom.cardDate.textContent = formatDate(new Date());
    dom.questionText.textContent = `"${activeQuestion.testo}"`;
  }

  // D. Aggiorna stato del pulsante di estrazione
  const pool = state.mazzo.filter(q => !q.usata);
  if (pool.length === 0) {
    dom.btnExtract.innerHTML = `<span class="btn-icon">🔄</span> Ricomincia Mazzo`;
  } else {
    dom.btnExtract.innerHTML = `<span class="btn-icon">🎲</span> Estrai Vettore`;
  }
}

// 9. Inizializzazione ed Eventi di Focus/Visibilità
function initApp() {
  if (isInitialized) return;
  
  try {
    initDOM();
    
    // Registrazione Eventi dopo l'inizializzazione del DOM
    dom.btnExtract.addEventListener("click", estraiDomanda);
    dom.btnManualReset.addEventListener("click", () => {
      if (confirm("Sei sicuro di voler reinizializzare manualmente il mazzo settimanale?")) {
        resetMazzo();
      }
    });

    loadState();
    checkWeeklyReset();
    renderAll();
    isInitialized = true;
    console.log("Applicazione '7 Vettori' caricata con successo.");
  } catch (e) {
    console.error("Errore durante initApp:", e);
    window.onerror(e.message, "app.js", 0, 0, e);
  }
}

// ReadyState detection - robust loading mechanism
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

window.addEventListener("focus", () => {
  if (!isInitialized) return;
  const resetTriggered = checkWeeklyReset();
  if (!resetTriggered) {
    renderAll();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (!isInitialized) return;
    const resetTriggered = checkWeeklyReset();
    if (!resetTriggered) {
      renderAll();
    }
  }
});
