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
 * 
 * Correttezza Matematica:
 * - Se l'app viene aperta a settimana inoltrata e l'ultimo reset appartiene alla settimana precedente
 *   (ovvero T_last_reset < T_monday_start), la condizione è vera e viene eseguito resetMazzo().
 * - Non appena resetMazzo() viene eseguito, aggiorniamo T_last_reset = T_now.
 *   Poiché T_now >= T_monday_start per definizione, nei successivi controlli della settimana
 *   la condizione T_last_reset < T_monday_start sarà falsa, evitando reset duplicati.
 * - Il controllo viene agganciato a:
 *   a) Caricamento iniziale della pagina (DOMContentLoaded).
 *   b) Focus della finestra (window.onfocus) - es. riapertura tab o risveglio da standby.
 *   c) Cambio visibilità (visibilitychange) - es. cambio scheda del browser.
 * ============================================================================
 */

// 1. Nuovo Dataset: Set a doppio vettore (Riflessione + Azione Proattiva)
const VETTORI_DECK_INITIAL = [
  { id: 1, tipo: "Diretto", testo: "Quale deviazione audace ho evitato oggi per rimanere comodo, e come posso riprogrammare esattamente quella deviazione (o una simile) per la giornata di domani?", usata: false },
  { id: 2, tipo: "Esistenziale", testo: "Se oggi è stato un capitolo piatto, quale singola azione straordinaria o fuori dagli schemi pianifico deliberatamente per domani per rendere memorabile questa settimana?", usata: false },
  { id: 3, tipo: "Regia Cinematografica", testo: "Se un regista tagliasse la giornata di oggi perché priva di colpi di scena, quale 'scena madre' o inversione di rotta inaspettata decido di scrivere e recitare domani?", usata: false },
  { id: 4, tipo: "Generatore di Aneddoti", testo: "Oggi non ha prodotto storie da raccontare. Quale micro-azione insolita o rischiosa imposterò domani per assicurarmi un aneddoto memorabile tra vent'anni?", usata: false },
  { id: 5, tipo: "Alter Ego", testo: "Se oggi il mio alter ego audace è rimasto in ombra, in quale momento esatto di domani gli cederò il controllo e quale azione dirompente gli farò compiere?", usata: false },
  { id: 6, tipo: "Costo del Rimpianto", testo: "Quale stimolo elettrizzante ho sacrificato oggi sull'altare della routine, e in quale blocco orario di domani inserirò una scommessa deliberata contro la noia?", usata: false },
  { id: 7, tipo: "Uscita di Sicurezza", testo: "Dove sono stato troppo 'prevedibile' oggi per compiacere gli altri? In quale interazione di domani romperò lo schema per agire con assoluta e sorprendente autenticità?", usata: false }
];

// 2. Stato Applicativo Globale
let state = {
  mazzo: JSON.parse(JSON.stringify(VETTORI_DECK_INITIAL)),
  lastReset: 0,
  activeQuestionId: null,      // ID della domanda attiva oggi
  activeQuestionDate: null,    // Data (stringa YYYY-MM-DD) di estrazione
  history: []                  // Cronologia Storica delle pianificazioni salvate
};

// Chiave di persistenza in LocalStorage
const STORAGE_KEY = "protocollo_7_vettori_state_v2"; // Aggiornata la versione per evitare conflitti

// 3. Riferimenti agli elementi DOM
const dom = {
  deckCounter: document.getElementById("deck-counter"),
  resetStatus: document.getElementById("reset-status"),
  deckGrid: document.getElementById("deck-grid"),
  
  // Stages
  drawStage: document.getElementById("draw-stage"),
  activeStage: document.getElementById("active-stage"),
  completedStage: document.getElementById("completed-stage"),
  
  // Actions & Active Question Elements
  btnExtract: document.getElementById("btn-extract"),
  categoryBadge: document.getElementById("category-badge"),
  cardDate: document.getElementById("card-date"),
  questionText: document.getElementById("question-text"),
  
  // Inputs (Split Layout)
  inputReflectionToday: document.getElementById("input-reflection-today"),
  inputActionTomorrow: document.getElementById("input-action-tomorrow"),
  btnSave: document.getElementById("btn-save"),
  
  // Completed Stage Previews
  completedCategoryBadge: document.getElementById("completed-category-badge"),
  completedCardDate: document.getElementById("completed-card-date"),
  completedQuestionText: document.getElementById("completed-question-text"),
  previewReflectionToday: document.getElementById("preview-reflection-today"),
  previewActionTomorrow: document.getElementById("preview-action-tomorrow"),
  
  // Archive & Reset
  historyList: document.getElementById("history-list"),
  btnManualReset: document.getElementById("btn-manual-reset")
};

// 4. Caricamento e Persistenza dello Stato
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
      // Assicura che la struttura del mazzo sia corretta
      if (!state.mazzo || state.mazzo.length !== 7) {
        state.mazzo = JSON.parse(JSON.stringify(VETTORI_DECK_INITIAL));
      }
      if (!state.history) {
        state.history = [];
      }
    } catch (e) {
      console.error("Errore nel parse del LocalStorage, inizializzo default", e);
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
  state.history = [];
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// 5. Funzioni Temporali (Reset Automatico Lunedì)

/**
 * Calcola il timestamp del Lunedì della settimana corrente alle 00:00:00.000 locali.
 */
function getStartOfWeekMonday() {
  const now = new Date();
  const day = now.getDay(); // 0 = Domenica, 1 = Lunedì, etc.
  const isoDay = (day === 0) ? 7 : day; // Lunedì=1, Domenica=7
  
  const monday = new Date(now);
  monday.setDate(now.getDate() - (isoDay - 1));
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

/**
 * Esegue il controllo del timestamp e attiva il reset se necessario.
 */
function checkWeeklyReset() {
  const mondayStart = getStartOfWeekMonday();
  
  if (state.lastReset < mondayStart) {
    console.log("Weekly reset rilevato! Eseguo resetMazzo()...");
    resetMazzo();
    return true;
  }
  return false;
}

/**
 * Funzione resetMazzo(): Reinizializza il mazzo per una nuova settimana solare.
 */
function resetMazzo() {
  state.mazzo.forEach(q => q.usata = false);
  state.activeQuestionId = null;
  state.activeQuestionDate = null;
  state.lastReset = Date.now(); // Imposta l'ultimo reset ad ora
  saveState();
  renderAll();
  console.log("Mazzo ripristinato con successo per il nuovo ciclo settimanale.");
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

// 7. Meccanica Core: Estrazione Domanda
function estraiDomanda() {
  const todayStr = getTodayString();
  if (state.activeQuestionDate === todayStr) {
    alert("Hai già estratto il vettore di oggi!");
    return;
  }

  const pool = state.mazzo.filter(q => !q.usata);
  
  if (pool.length === 0) {
    alert("Tutti i 7 vettori sono stati usati! Attendi il reset automatico di Lunedì o procedi con un reset manuale.");
    return;
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  const selectedQuestion = pool[randomIndex];

  const originalQuestion = state.mazzo.find(q => q.id === selectedQuestion.id);
  if (originalQuestion) {
    originalQuestion.usata = true;
  }

  state.activeQuestionId = selectedQuestion.id;
  state.activeQuestionDate = todayStr;
  
  saveState();

  // Animazione card shake
  const cardBack = document.querySelector(".card-back-design");
  if (cardBack) {
    cardBack.classList.add("card-shake");
    setTimeout(() => {
      cardBack.classList.remove("card-shake");
      renderAll();
    }, 500);
  } else {
    renderAll();
  }
}

// 8. Meccanica Core: Salvataggio Pianificazione (Doppio Vettore)
function salvaPianificazione() {
  const reflection = dom.inputReflectionToday.value.trim();
  const action = dom.inputActionTomorrow.value.trim();

  if (!reflection || !action) {
    alert("Compila entrambi i campi prima di salvare: la riflessione sull'oggi e l'azione pianificata per domani.");
    return;
  }

  const activeQuestion = state.mazzo.find(q => q.id === state.activeQuestionId);
  if (!activeQuestion) {
    alert("Errore: nessuna domanda attiva trovata.");
    return;
  }

  // Aggiungi alla cronologia storica
  const entry = {
    questionId: activeQuestion.id,
    questionTipo: activeQuestion.tipo,
    questionTesto: activeQuestion.testo,
    reflectionToday: reflection,
    actionTomorrow: action,
    timestamp: Date.now(),
    dateString: formatDate(new Date())
  };

  state.history.unshift(entry);

  // Resetta i campi di testo inseriti
  dom.inputReflectionToday.value = "";
  dom.inputActionTomorrow.value = "";

  saveState();
  renderAll();
}

// 9. Aggiornamento UI (Rendering)
function renderAll() {
  const todayStr = getTodayString();
  const activeQuestion = state.mazzo.find(q => q.id === state.activeQuestionId);
  
  // A. Contatori
  const usateCount = state.mazzo.filter(q => q.usata).length;
  dom.deckCounter.textContent = `${usateCount} / 7 estratti`;
  
  const nextResetDate = new Date(getStartOfWeekMonday() + 7 * 24 * 60 * 60 * 1000);
  dom.resetStatus.textContent = formatDate(nextResetDate) + " 00:00";

  // B. Griglia dei 7 Vettori
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

  // C. Gestione Stage Centrale
  
  // Caso 1: Nessuna domanda estratta per oggi
  if (!state.activeQuestionDate || state.activeQuestionDate !== todayStr) {
    dom.drawStage.classList.remove("hidden");
    dom.activeStage.classList.add("hidden");
    dom.completedStage.classList.add("hidden");
  } 
  // Caso 2: C'è una domanda estratta oggi
  else {
    // Controlla se la pianificazione è stata già salvata per oggi
    const alreadySavedToday = state.history.find(entry => {
      const entryDate = new Date(entry.timestamp);
      const entryDateStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
      return entryDateStr === todayStr && entry.questionId === state.activeQuestionId;
    });

    if (alreadySavedToday) {
      // Caso 2.A: Già salvato oggi -> Mostra visualizzazione di riepilogo
      dom.drawStage.classList.add("hidden");
      dom.activeStage.classList.add("hidden");
      dom.completedStage.classList.remove("hidden");

      dom.completedCategoryBadge.textContent = activeQuestion.tipo;
      dom.completedCardDate.textContent = formatDate(new Date(alreadySavedToday.timestamp));
      dom.completedQuestionText.textContent = `"${activeQuestion.testo}"`;
      dom.previewReflectionToday.textContent = alreadySavedToday.reflectionToday;
      dom.previewActionTomorrow.textContent = alreadySavedToday.actionTomorrow;
    } else {
      // Caso 2.B: Estratta ma non ancora pianificata -> Mostra il form split
      dom.drawStage.classList.add("hidden");
      dom.activeStage.classList.remove("hidden");
      dom.completedStage.classList.add("hidden");

      dom.categoryBadge.textContent = activeQuestion.tipo;
      dom.cardDate.textContent = formatDate(new Date());
      dom.questionText.textContent = `"${activeQuestion.testo}"`;
    }
  }

  // D. Rendering della Cronologia Storica
  dom.historyList.innerHTML = "";
  if (state.history.length === 0) {
    dom.historyList.innerHTML = `
      <div class="no-history">Nessuna riflessione registrata finora. Inizia oggi!</div>
    `;
  } else {
    state.history.forEach(entry => {
      const histItem = document.createElement("div");
      histItem.className = "history-item";
      
      histItem.innerHTML = `
        <div class="history-meta">
          <span class="history-category badge">${entry.questionTipo}</span>
          <span class="history-time">${entry.dateString} - ${new Date(entry.timestamp).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div class="history-question">"${entry.questionTesto}"</div>
        <div class="history-split-previews">
          <div class="hist-preview-block">
            <strong>Riflessione sull'Oggi:</strong>
            <p>${entry.reflectionToday}</p>
          </div>
          <div class="hist-preview-block highlight-tomorrow">
            <strong>Pianificazione Domani:</strong>
            <p>${entry.actionTomorrow}</p>
          </div>
        </div>
      `;
      dom.historyList.appendChild(histItem);
    });
  }
}

// 10. Registrazione Event Listeners
dom.btnExtract.addEventListener("click", estraiDomanda);
dom.btnSave.addEventListener("click", salvaPianificazione);

dom.btnManualReset.addEventListener("click", () => {
  if (confirm("Sei sicuro di voler reinizializzare manualmente il mazzo settimanale? Questo pulirà lo stato di estrazione corrente.")) {
    resetMazzo();
  }
});

// 11. Inizializzazione ed Eventi di Resuming/Focus (Focalità Temporale Reattiva)
function initApp() {
  loadState();
  checkWeeklyReset();
  renderAll();
  console.log("Applicazione '7 Vettori' inizializzata con successo.");
}

// Evento 1: Caricamento Pagina
document.addEventListener("DOMContentLoaded", initApp);

// Evento 2: Finestra Focus (ripristino stato da background)
window.addEventListener("focus", () => {
  console.log("Finestra in focus, verifico temporalità...");
  const resetTriggered = checkWeeklyReset();
  if (!resetTriggered) {
    renderAll();
  }
});

// Evento 3: Visibility Change (cambio tab o risveglio mobile browser)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    console.log("Visibilità ripristinata, verifico temporalità...");
    const resetTriggered = checkWeeklyReset();
    if (!resetTriggered) {
      renderAll();
    }
  }
});

// 12. Registrazione Service Worker per supporto PWA Offline
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("Service Worker registrato con successo:", reg.scope))
      .catch((err) => console.error("Errore registrazione Service Worker:", err));
  });
}
