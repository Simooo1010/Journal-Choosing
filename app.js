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
 * 
 * ============================================================================
 * AGGANCIO FIGMA MCP (PREDISPOSIZIONE ARCHITETTURA FUTURE)
 * ============================================================================
 * Nello sviluppo futuro con l'MCP Figma Server, le variabili DOM sottostanti
 * verranno collegate direttamente agli ID dei nodi grafici e delle istanze
 * di Figma. Le associazioni sono tracciate tramite l'attributo data-figma-id.
 * ============================================================================
 */

// 1. Data Model statico: Il Mazzo Chiuso dei 7 Vettori
const VETTORI_DECK_INITIAL = [
  { id: 1, tipo: "Diretto", testo: "Quale deviazione audace o fuori dagli schemi ho attivamente evitato (o mancato) oggi per rimanere nella mia zona di comfort?", usata: false },
  { id: 2, tipo: "Esistenziale", testo: "Se la giornata di oggi fosse l'unico capitolo scritto di questa settimana, quale scintilla di memorabile follia avrei potuto inserire per renderlo indimenticabile?", usata: false },
  { id: 3, tipo: "Regia Cinematografica", testo: "Se un regista dovesse tagliare la giornata di oggi perché priva di colpi di scena, in quale momento avrei dovuto inserire una scelta improvvisa, folle o dirompente per salvare la scena?", usata: false },
  { id: 4, tipo: "Generatore di Aneddoti", testo: "Tra vent'anni, quale micro-evento di oggi non avrò assolutamente alcuna possibilità di ricordare? Cosa avrei potuto fare di insolito o rischioso per trasformarlo in un aneddoto memorabile?", usata: false },
  { id: 5, tipo: "Alter Ego", testo: "Se oggi avessi ceduto il controllo al mio alter ego più audace, impulsivo e curioso, in quale esatto momento avrebbe preso il sopravvento e cosa avrebbe fatto di totalmente inaspettato?", usata: false },
  { id: 6, tipo: "Costo del Rimpianto", testo: "In quale momento di oggi ho scambiato la sicurezza della routine con la certezza della noia? Quale deviazione elettrizzante ho sacrificato sull'altare del 'computo delle cose da fare'?", usata: false },
  { id: 7, tipo: "Uscita di Sicurezza", testo: "In quale interazione o situazione di oggi ho scelto di essere 'educato e prevedibile' anziché autentico, dirompente o memorabile? Cosa avrei dovuto dire o fare se non avessi temuto il giudizio immediato?", usata: false }
];

// Mappa colori per l'interfaccia (neon accents definiti in CSS)
const VECTOR_COLORS = {
  "Diretto": "var(--accent-blue)",
  "Esistenziale": "var(--accent-purple)",
  "Regia Cinematografica": "var(--accent-yellow)",
  "Generatore di Aneddoti": "var(--accent-emerald)",
  "Alter Ego": "var(--accent-orange)",
  "Costo del Rimpianto": "var(--accent-pink)",
  "Uscita di Sicurezza": "var(--accent-cyan)"
};

// 2. Stato Applicativo Globale
let state = {
  mazzo: JSON.parse(JSON.stringify(VETTORI_DECK_INITIAL)),
  lastReset: 0,
  activeQuestionId: null,      // ID della domanda attiva oggi
  activeQuestionDate: null     // Data (stringa YYYY-MM-DD) di estrazione
};

// Chiave di persistenza in LocalStorage
const STORAGE_KEY = "protocollo_7_vettori_state";

// 3. Riferimenti agli elementi DOM (FUTURI ELEMENTI FIGMA MCP)
const dom = {
  // Elemento: Contatore mazzo (Figma Node: "DeckCounter" o "mazzo-counter")
  deckCounter: document.getElementById("deck-counter"),
  
  // Elemento: Indicatore reset (Figma Node: "ResetStatus" o "reset-status")
  resetStatus: document.getElementById("reset-status"),
  
  // Elemento: Griglia del mazzo (Figma Frame: "DeckGrid" o "deck-grid")
  deckGrid: document.getElementById("deck-grid"),
  
  // Elemento: Stage di estrazione (Figma State: "StageDraw")
  drawStage: document.getElementById("draw-stage"),
  
  // Elemento: Stage attivo di visualizzazione (Figma State: "StageActive")
  activeStage: document.getElementById("active-stage"),
  
  // Elemento: Pulsante estrazione (Figma Instance: "BtnExtract" -> data-figma-id="btn-extract")
  btnExtract: document.getElementById("btn-extract"),
  
  // Elemento: Badge Categoria (Figma Text: "BadgeCategory" -> data-figma-id="badge-category")
  categoryBadge: document.getElementById("category-badge"),
  
  // Elemento: Data della carta (Figma Text: "CardDate")
  cardDate: document.getElementById("card-date"),
  
  // Elemento: Testo Domanda (Figma Text: "TextQuestion" -> data-figma-id="text-question")
  questionText: document.getElementById("question-text"),
  
  // Elemento: Pulsante reset manuale
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
  
  // Se l'ultimo reset salvato è precedente al Lunedì a mezzanotte della settimana corrente
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
  state.lastReset = Date.now(); // Imposta l'ultimo reset ad ora per bloccare duplicati
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

// 7. Meccanica Core: Estrazione Domanda
function estraiDomanda() {
  // A. Controlla prima se c'è già una domanda estratta oggi
  const todayStr = getTodayString();
  if (state.activeQuestionDate === todayStr) {
    alert("Hai già estratto il vettore di oggi!");
    return;
  }

  // B. Filtra le domande non usate (usata === false)
  const pool = state.mazzo.filter(q => !q.usata);
  
  if (pool.length === 0) {
    alert("Tutti i 7 vettori sono stati usati! Attendi il reset automatico di Lunedì o procedi con un reset manuale.");
    return;
  }

  // C. Estrazione casuale
  const randomIndex = Math.floor(Math.random() * pool.length);
  const selectedQuestion = pool[randomIndex];

  // D. Aggiorna lo stato della domanda nel mazzo persistito
  const originalQuestion = state.mazzo.find(q => q.id === selectedQuestion.id);
  if (originalQuestion) {
    originalQuestion.usata = true;
  }

  // E. Imposta lo stato della domanda attiva corrente
  state.activeQuestionId = selectedQuestion.id;
  state.activeQuestionDate = todayStr;
  
  saveState();

  // F. Animazione card shuffle e rendering
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

// 8. Aggiornamento UI (Rendering)
function renderAll() {
  const todayStr = getTodayString();
  const activeQuestion = state.mazzo.find(q => q.id === state.activeQuestionId);
  
  // A. Aggiorna contatori e stato in alto
  const usateCount = state.mazzo.filter(q => q.usata).length;
  dom.deckCounter.textContent = `${usateCount} / 7 estratti`;
  
  const nextResetDate = new Date(getStartOfWeekMonday() + 7 * 24 * 60 * 60 * 1000);
  dom.resetStatus.textContent = formatDate(nextResetDate) + " 00:00";

  // B. Aggiorna la griglia visuale dei 7 Vettori
  dom.deckGrid.innerHTML = "";
  VETTORI_DECK_INITIAL.forEach(vInit => {
    const currentStatus = state.mazzo.find(q => q.id === vInit.id);
    const pill = document.createElement("div");
    pill.className = `vector-pill v-${vInit.id} ${currentStatus.usata ? 'used' : ''}`;
    pill.title = `${vInit.tipo}: ${vInit.testo}`;
    
    // Predisposizione data-figma-id per Figma Node mapping
    pill.setAttribute("data-figma-id", `vector-pill-${vInit.id}`);

    pill.innerHTML = `
      <span class="vector-num">V${vInit.id}</span>
      <span class="vector-name">${vInit.tipo}</span>
    `;
    dom.deckGrid.appendChild(pill);
  });

  // C. Gestione degli Stati di Rendering sullo Stage Centrale
  
  // Caso 1: Nessuna domanda estratta per oggi
  if (!state.activeQuestionDate || state.activeQuestionDate !== todayStr) {
    dom.drawStage.classList.remove("hidden");
    dom.activeStage.classList.add("hidden");
  } 
  // Caso 2: C'è una domanda estratta oggi
  else {
    dom.drawStage.classList.add("hidden");
    dom.activeStage.classList.remove("hidden");

    dom.activeStage.style.setProperty('--vector-color', VECTOR_COLORS[activeQuestion.tipo]);
    dom.categoryBadge.style.backgroundColor = VECTOR_COLORS[activeQuestion.tipo];
    dom.categoryBadge.textContent = activeQuestion.tipo;
    dom.cardDate.textContent = formatDate(new Date());
    dom.questionText.textContent = `"${activeQuestion.testo}"`;
  }
}

// 9. Registrazione Event Listeners (FUTURO COLLEGAMENTO INTERATTIVO FIGMA MCP)
dom.btnExtract.addEventListener("click", estraiDomanda);

dom.btnManualReset.addEventListener("click", () => {
  if (confirm("Sei sicuro di voler reinizializzare manualmente il mazzo per questa settimana?")) {
    resetMazzo();
  }
});

// 10. Inizializzazione ed Eventi di Resuming/Focus (Focalità Temporale Reattiva)
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
    renderAll(); // Ricarica modifiche esterne / aggiorna date
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

// 11. Registrazione Service Worker per supporto PWA Offline
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("Service Worker registrato con successo:", reg.scope))
      .catch((err) => console.error("Errore registrazione Service Worker:", err));
  });
}
