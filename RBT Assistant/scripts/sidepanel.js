// Program lists are learned from the open Office Puzzle page at runtime.
// No client-specific program names are bundled with the extension.
const LEGACY_BEHAVIORS = [];
const LEGACY_REPLACEMENTS = [];
const LEGACY_CLIENT2_REPLACEMENTS = [];
const LEGACY_CHALLENGING = [];


let BEHAVIORS=[...LEGACY_BEHAVIORS];
let REPLACEMENTS=[...LEGACY_REPLACEMENTS];
let CLIENT2_REPLACEMENTS=[...LEGACY_CLIENT2_REPLACEMENTS];
let CHALLENGING=LEGACY_CHALLENGING.map(item=>({...item}));


const PROGRAM_DROPDOWN_SHORT_NAMES = new Map([]);

function compactProgramDropdownName(name) {
  const raw=String(name || "").trim();
  if(!raw) return "";

  const exact=PROGRAM_DROPDOWN_SHORT_NAMES.get(raw);
  if(exact) return exact;

  return raw
    .replace(/\s+ABLLS-R\s+[A-Z]\d+\s*$/i,"")
    .replace(/^Learning to engage in\s+/i,"")
    .replace(/^Learning and using\s+/i,"Use ")
    .replace(/\s{2,}/g," ")
    .trim();
}

function closeAllCustomSelects(except=null) {
  document.querySelectorAll(".customProgramSelect.open").forEach(wrapper=>{
    if(wrapper===except) return;
    wrapper.classList.remove("open","openUp");
    const field=wrapper.querySelector(".customSelectTrigger");
    if(field) field.setAttribute("aria-expanded","false");

    const native=wrapper.previousElementSibling;
    if(native?.matches?.("select")) syncCustomSelect(native);
  });
}

function customSelectLabelParts(option,index) {
  const original=String(option?.textContent || "").trim();
  const stripped=original.replace(/^\s*\d+\.\s*/,"").trim();
  return {
    number:String(index+1),
    full:stripped,
    compact:compactProgramDropdownName(stripped)
  };
}

function normalizeProgramSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function selectCustomProgramOption(select,value) {
  if(!select) return;
  select.value=String(value);
  select.dispatchEvent(new Event("change",{bubbles:true}));
  closeAllCustomSelects();
  syncCustomSelect(select);
}

function syncCustomSelect(selectOrId) {
  const select=typeof selectOrId==="string" ? $(selectOrId) : selectOrId;
  if(!select) return;

  const wrapper=select.nextElementSibling?.classList?.contains("customProgramSelect")
    ? select.nextElementSibling
    : null;
  if(!wrapper) return;

  const input=wrapper.querySelector(".customSelectSearch");
  const number=wrapper.querySelector(".customSelectNumber");
  const value=String(select.value ?? "");
  const selectedIndex=Math.max(
    0,
    Array.from(select.options).findIndex(option=>String(option.value)===value)
  );
  const option=select.options[selectedIndex] || select.options[0];

  if(option) {
    const parts=customSelectLabelParts(option,selectedIndex);
    if(number) number.textContent=parts.number;
    if(input && !wrapper.classList.contains("open")) {
      input.value=parts.compact;
      input.title=parts.full;
    }
  }

  wrapper.querySelectorAll(".customSelectOption").forEach(button=>{
    const selected=String(button.dataset.value)===value;
    button.classList.toggle("selected",selected);
    button.setAttribute("aria-selected",selected ? "true" : "false");
  });
}

function customSelectVisibleOptions(wrapper) {
  return [...wrapper.querySelectorAll(".customSelectOption")]
    .filter(button=>!button.hidden);
}

function updateCustomSelectFilter(select,wrapper,query="") {
  const q=normalizeProgramSearch(query);
  const input=wrapper.querySelector(".customSelectSearch");
  const empty=wrapper.querySelector(".customSelectEmpty");
  const options=[...wrapper.querySelectorAll(".customSelectOption")];

  let firstVisible=null;
  let exact=null;

  for(const button of options) {
    const haystack=button.dataset.search || "";
    const match=!q || haystack.includes(q);
    button.hidden=!match;
    if(match && !firstVisible) firstVisible=button;
    if(
      match &&
      (button.dataset.name===q || button.dataset.compact===q)
    ) exact=button;
  }

  const visible=options.filter(button=>!button.hidden).length;
  if(empty) empty.hidden=visible>0;

  if(input) {
    input.setAttribute("aria-label",`Search ${select.options.length} programs`);
  }

  return {firstVisible:exact || firstVisible,visible};
}

function rebuildCustomSelect(select) {
  const wrapper=select.nextElementSibling?.classList?.contains("customProgramSelect")
    ? select.nextElementSibling
    : null;
  if(!wrapper) return;

  const optionsHost=wrapper.querySelector(".customSelectOptions");
  if(!optionsHost) return;
  optionsHost.innerHTML="";

  Array.from(select.options).forEach((option,index)=>{
    const parts=customSelectLabelParts(option,index);
    const button=document.createElement("button");
    button.type="button";
    button.className="customSelectOption";
    button.dataset.value=String(option.value);
    button.dataset.name=normalizeProgramSearch(parts.full);
    button.dataset.compact=normalizeProgramSearch(parts.compact);
    button.dataset.search=normalizeProgramSearch(`${parts.full} ${parts.compact}`);
    button.setAttribute("role","option");
    button.id=`${select.id}Option${index}`;
    button.title=parts.full;

    const number=document.createElement("span");
    number.className="customSelectOptionNumber";
    number.textContent=parts.number;

    const label=document.createElement("span");
    label.className="customSelectOptionLabel";
    label.textContent=parts.full;

    const check=document.createElement("span");
    check.className="customSelectOptionCheck";
    check.textContent="✓";
    check.setAttribute("aria-hidden","true");

    button.append(number,label,check);
    button.addEventListener("click",()=>selectCustomProgramOption(select,option.value));
    optionsHost.appendChild(button);
  });

  syncCustomSelect(select);
  updateCustomSelectFilter(select,wrapper,"");
}

function installCustomProgramSelect(selectId) {
  const select=$(selectId);
  if(!select || select.dataset.customized==="true") return;

  select.dataset.customized="true";
  select.classList.add("nativeProgramSelect");

  const wrapper=document.createElement("div");
  wrapper.className="customProgramSelect";

  const field=document.createElement("div");
  field.className="customSelectTrigger";
  field.setAttribute("role","combobox");
  field.setAttribute("aria-haspopup","listbox");
  field.setAttribute("aria-expanded","false");

  const number=document.createElement("span");
  number.className="customSelectNumber";
  number.textContent="1";

  const input=document.createElement("input");
  input.type="text";
  input.className="customSelectSearch";
  input.autocomplete="off";
  input.spellcheck=false;
  input.placeholder="Search programs";
  input.setAttribute("aria-autocomplete","list");

  const chevron=document.createElement("button");
  chevron.type="button";
  chevron.className="customSelectChevron";
  chevron.setAttribute("aria-label","Show all programs");
  chevron.textContent="⌄";

  field.append(number,input,chevron);

  const menu=document.createElement("div");
  menu.className="customSelectMenu";
  menu.id=`${selectId}Listbox`;
  menu.setAttribute("role","listbox");
  menu.setAttribute("aria-label","Programs");
  field.setAttribute("aria-controls",menu.id);

  const optionsHost=document.createElement("div");
  optionsHost.className="customSelectOptions";

  const empty=document.createElement("div");
  empty.className="customSelectEmpty";
  empty.hidden=true;
  empty.textContent="No matching programs";

  menu.append(optionsHost,empty);
  wrapper.append(field,menu);
  select.insertAdjacentElement("afterend",wrapper);

  const menuButtons=()=>customSelectVisibleOptions(wrapper);

  const focusOption=index=>{
    const buttons=menuButtons();
    if(!buttons.length) return;
    const bounded=Math.max(0,Math.min(buttons.length-1,index));
    buttons[bounded].focus();
    buttons[bounded].scrollIntoView({block:"nearest"});
  };

  const openMenu=()=>{
    closeAllCustomSelects(wrapper);
    rebuildCustomSelect(select);
    wrapper.classList.add("open");
    field.setAttribute("aria-expanded","true");
    input.value="";
    updateCustomSelectFilter(select,wrapper,"");

    requestAnimationFrame(()=>{
      const rect=wrapper.getBoundingClientRect();
      const menuHeight=Math.min(menu.scrollHeight,390);
      const roomBelow=window.innerHeight-rect.bottom-12;
      const roomAbove=rect.top-12;
      wrapper.classList.toggle("openUp",roomBelow<menuHeight && roomAbove>roomBelow);
      input.focus({preventScroll:true});
    });
  };

  const chooseBestMatch=()=>{
    const result=updateCustomSelectFilter(select,wrapper,input.value);
    if(result.firstVisible) {
      selectCustomProgramOption(select,result.firstVisible.dataset.value);
      return true;
    }
    return false;
  };

  input.addEventListener("focus",()=>{
    if(!wrapper.classList.contains("open")) openMenu();
  });

  input.addEventListener("pointerdown",()=>{
    if(!wrapper.classList.contains("open")) openMenu();
  });

  input.addEventListener("input",()=>{
    if(!wrapper.classList.contains("open")) openMenu();
    updateCustomSelectFilter(select,wrapper,input.value);
  });

  input.addEventListener("keydown",event=>{
    if(event.key==="Enter") {
      event.preventDefault();
      chooseBestMatch();
      return;
    }

    if(event.key==="ArrowDown" || event.key==="ArrowUp") {
      event.preventDefault();
      if(!wrapper.classList.contains("open")) openMenu();
      const buttons=menuButtons();
      focusOption(event.key==="ArrowUp" ? buttons.length-1 : 0);
      return;
    }

    if(event.key==="Escape") {
      event.preventDefault();
      closeAllCustomSelects();
      input.blur();
    }
  });

  chevron.addEventListener("click",event=>{
    event.preventDefault();
    if(wrapper.classList.contains("open")) {
      closeAllCustomSelects();
      return;
    }
    openMenu();
  });

  menu.addEventListener("keydown",event=>{
    const buttons=menuButtons();
    const current=buttons.indexOf(document.activeElement);
    if(!buttons.length) return;

    if(event.key==="ArrowDown" || event.key==="ArrowUp") {
      event.preventDefault();
      const delta=event.key==="ArrowDown" ? 1 : -1;
      const next=current<0 ? 0 : (current+delta+buttons.length)%buttons.length;
      focusOption(next);
      return;
    }

    if(event.key==="Escape") {
      event.preventDefault();
      closeAllCustomSelects();
      input.focus();
      return;
    }

    if(event.key==="Tab") closeAllCustomSelects();
  });

  const observer=new MutationObserver(()=>rebuildCustomSelect(select));
  observer.observe(select,{childList:true,subtree:true});
  rebuildCustomSelect(select);
}

function installCustomProgramSelects() {
  [
    "behaviorSelect",
    "challengingSelect",
    "replacementSelect",
    "client2ReplacementSelect"
  ].forEach(installCustomProgramSelect);

  document.addEventListener("pointerdown",event=>{
    if(!event.target.closest(".customProgramSelect")) closeAllCustomSelects();
  });

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape") closeAllCustomSelects();
  });
}

const AUTO_CLIENT_PROFILE_VERSION=2;
let learnedClientProfile=null;
let autoProfileBusy=false;
let autoProfileLastScanAt=0;
const AUTO_PROFILE_SCAN_MIN_MS=1400;

const CLIENT2_DEFAULT_HOURS = 5;
const CLIENT2_INTERVAL_MINUTES = 30;
const CLIENT2_MAX_HOURS = 12;
const CLIENT2_MAX_INTERVALS = CLIENT2_MAX_HOURS * 2;

const DAYS = [
  { key:1, short:"Mon" },
  { key:2, short:"Tue" },
  { key:3, short:"Wed" },
  { key:4, short:"Thu" },
  { key:5, short:"Fri" },
  { key:6, short:"Sat" },
  { key:7, short:"Sun" }
];

function isoWeekdayKey(dateLike) {
  const d=dateLike instanceof Date
    ? dateLike
    : new Date(`${dateLike}T12:00:00`);
  const jsDay=d.getDay();
  return jsDay===0 ? 7 : jsDay;
}

function validISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
}

function planningDatesForMapping(mapping,selectedDate,fallbackDateForDay) {
  const learned=[...new Set(
    (Array.isArray(mapping?.planningDates) ? mapping.planningDates : [])
      .filter(validISODate)
  )].sort();

  // Office Puzzle is authoritative. planningDates is the WRITE-ENABLED subset
  // of the merged Weekly-average group that contains the selected date. The
  // period may begin/end on any weekday and can grow as Office Puzzle unlocks
  // another date on a later day.
  if(learned.length && (!selectedDate || learned.includes(selectedDate))) {
    return learned;
  }

  // If a mapping is briefly stale while Office Puzzle is virtualizing, prefer
  // the live writable date inventory over inventing a Monday-Sunday period.
  const knownWritable=(dateNavigationState?.availableDates || [])
    .filter(validISODate);
  if(knownWritable.length && (!selectedDate || knownWritable.includes(selectedDate))) {
    return [...new Set(knownWritable)].sort();
  }

  // Last-resort compatibility only. Fresh discovery replaces this immediately.
  if(typeof fallbackDateForDay==="function") {
    return DAYS.map(day=>fallbackDateForDay(day.key)).filter(validISODate);
  }

  return [];
}

function weekdayLabelForDate(dateISO) {
  if(!validISODate(dateISO)) return "";
  return new Date(`${dateISO}T12:00:00`)
    .toLocaleDateString(undefined,{weekday:"short"})
    .replace(/\.$/,"");
}

function visiblePlanningDates(mapping,selectedDate,fallbackDateForDay,plan=null) {
  const live=planningDatesForMapping(mapping,selectedDate,fallbackDateForDay);
  const saved=(plan?.planningDates || []).filter(validISODate);
  const writable=new Set(effectiveNavigatorDates());

  let dates=live.length ? live : saved;
  if(writable.size) dates=dates.filter(date=>writable.has(date));

  // A plan saved before another day unlocked may be narrower than the fresh
  // mapping. Always let the fresh Office Puzzle period win when available.
  if(live.length) dates=live.filter(date=>!writable.size || writable.has(date));

  return [...new Set(dates)].sort();
}

function configurePlanningDateStrip(host,dates) {
  if(!host) return;
  const count=Math.max(1,(dates || []).length);
  host.style.setProperty(
    "grid-template-columns",
    `repeat(${count}, minmax(0, 1fr))`,
    "important"
  );
  host.dataset.dateCount=String((dates || []).length);
}

function planningDatesSignature(dates) {
  return [...new Set((dates || []).filter(validISODate))].sort().join("|");
}

function planningPeriodKey(mapping,selectedDate,fallbackDateForDay) {
  const dates=planningDatesForMapping(mapping,selectedDate,fallbackDateForDay);
  return dates[0] || (validISODate(selectedDate) ? selectedDate : localTodayISODate());
}

function allocationForDate(allocations,date) {
  if(!Array.isArray(allocations) || !validISODate(date)) return null;
  return allocations.find(item=>item?.date===date) ||
    allocations.find(item=>item?.dayKey===isoWeekdayKey(date)) ||
    null;
}

function mappingKnowsPlanningPeriod(mapping,selectedDate) {
  return Array.isArray(mapping?.planningDates) &&
    mapping.planningDates.includes(selectedDate);
}

async function refreshPlanningPeriodIfNeeded(getMapping,selectedDate) {
  let mapping=typeof getMapping==="function" ? getMapping() : null;
  if(mappingKnowsPlanningPeriod(mapping,selectedDate)) return mapping;

  try {
    await discoverAndApplyClientPrograms({
      preserveDraft:true,
      manual:false
    });
  } catch(_) {}

  mapping=typeof getMapping==="function" ? getMapping() : mapping;
  return mapping;
}

function selectedDateIsPlannable(mapping,selectedDate,fallbackDateForDay) {
  if(!validISODate(selectedDate)) return false;
  return planningDatesForMapping(mapping,selectedDate,fallbackDateForDay).includes(selectedDate);
}

function unavailablePlanningDateMessage(selectedDate) {
  return `${friendlyDateLabel(selectedDate)} is visible in Office Puzzle but is not enabled for recording. Choose an available date.`;
}

function actualFingerprintForDates(mapping,dates,methodHint="") {
  return (dates || []).map(date=>{
    const actual=actualDataForDate(mapping,date,methodHint);
    return `${date}:${actual.hasActual ? actual.value ?? "recorded" : ""}`;
  }).join("|");
}

function allocateRemainingDates(totalRemaining,dates,perDayCap=null) {
  const clean=(dates || []).filter(validISODate);
  if(!clean.length) return [];
  const cap=Number.isFinite(Number(perDayCap)) && Number(perDayCap)>0
    ? Math.floor(Number(perDayCap))
    : null;
  const safeTotal=Math.max(0,Math.floor(Number(totalRemaining)||0));
  const capacities=clean.map(()=>cap || Math.max(1,safeTotal));
  const values=allocateCappedRandom(
    cap ? Math.min(safeTotal,clean.length*cap) : safeTotal,
    capacities
  );
  return clean.map((date,index)=>({
    date,
    dayKey:isoWeekdayKey(date),
    value:values[index]
  }));
}

let context = {};
let behaviorMappings = [];
let selectedBehaviorIndex = 0;
let replacementMappings = [];
let selectedReplacementIndex = 0;
let reviewedTrialStates = Array(10).fill("");
let replacementReviewConfirmed = false;
let clientKey = "client";

let client2ReplacementMapping = null;
let client2ReplacementMappingsByName = {};
let selectedClient2ReplacementIndex = 0;
let reviewedClient2ReplacementStates = [];
let client2ReplacementReviewConfirmed = false;
let client2ReplacementScanInProgress = false;
let lastClient2ReplacementScanAt = 0;

let challengingMapping = null;
let challengingMappingsByName = {};
let selectedChallengingIndex = 0;
let reviewedChallengingStates = [];
let challengingReviewConfirmed = false;
let challengingScanInProgress = false;
let lastChallengingScanAt = 0;

// When a write stops or fails after touching Office Puzzle, the current
// planning period becomes live-truth-only until the user deliberately creates
// a new plan or a later write verifies successfully. This prevents future
// planned values from looking like recorded data beside a failed/cleared day.
const writeTruthOnlyDates=new Set();

function writeTruthOnlyKey(pageType,name,date) {
  return [
    clientKey || cleanClientKey(context?.clientLabel || 'client'),
    String(pageType || context?.pageType || ''),
    normalizeProgramSearch(name || ''),
    String(date || '')
  ].join('::');
}

function markWriteTruthOnlyDate(pageType,name,date) {
  if(!name || !date) return;
  writeTruthOnlyDates.add(writeTruthOnlyKey(pageType,name,date));
}

function clearWriteTruthOnlyDate(pageType,name,date) {
  if(!name || !date) return;
  writeTruthOnlyDates.delete(writeTruthOnlyKey(pageType,name,date));
}

function isWriteTruthOnlyDate(pageType,name,date) {
  if(!name || !date) return false;
  return writeTruthOnlyDates.has(writeTruthOnlyKey(pageType,name,date));
}

function writeTruthDatesForMapping(mapping,selectedDate="") {
  const dates=[];
  const seen=new Set();

  for(const value of [
    ...(Array.isArray(mapping?.planningDates) ? mapping.planningDates : []),
    selectedDate || mapping?.selectedDate || ""
  ]) {
    const date=String(value || "");
    if(!date || seen.has(date)) continue;
    seen.add(date);
    dates.push(date);
  }

  return dates;
}

function markWriteTruthOnlyMapping(pageType,mapping,selectedDate="") {
  const name=mapping?.name || "";
  if(!name) return;
  writeTruthDatesForMapping(mapping,selectedDate)
    .forEach(date=>markWriteTruthOnlyDate(pageType,name,date));
}

function clearWriteTruthOnlyMapping(pageType,mapping,selectedDate="") {
  const name=mapping?.name || "";
  if(!name) return;
  writeTruthDatesForMapping(mapping,selectedDate)
    .forEach(date=>clearWriteTruthOnlyDate(pageType,name,date));
}

let batchState = {
  client1Behaviors: [],
  client1Replacements: [],
  client2Challenging: [],
  client2Replacements: []
};

let batchContextKey = "";
let batchRunningKind = null;
let batchTargetTabId = null;
const animatedVerifiedBatchKeys=new Set();

let autoBatchState = {
  armed:false,
  busy:false,
  stoppedOnError:false,
  completed:false,
  lastContextSignature:"",
  // Exact Office Puzzle tab captured when Run Batch starts.
  // While present, every scan/write/Stop message is routed to this tab
  // even if the user switches to another Chrome tab.
  lockedTabId:null
};

let autoBatchTimer = null;

let dateNavigationTabId=null;
let dateSelectionRequestSerial=0;

// Tracks any actual Office Puzzle data writer, including Apply now and Run Batch.
// The Stop controls use the exact tab ID here so an in-flight writer can be
// cancelled even when the user has switched to another Chrome tab.
let activeWriteUiState={
  busy:false,
  tabId:null,
  label:""
};
let pendingWriteTabId=null;

let dateNavigationState={
  selectedDate:"",
  availableDates:[],
  minDate:null,
  maxDate:null,
  supported:false,
  busy:false,
  // Writable-date availability is CLIENT-SCOPED. Office Puzzle exposes the
  // same writable dates across that client's Behaviors/Replacements pages, so
  // page switches must never trigger a second availability decision.
  clientKey:"",
  verifiedClientKey:"",
  verifiedDay:""
};

let passiveSyncTimer = null;
let localDateRolloverTimer = null;
let lastObservedLocalDay = "";
let passiveSyncBusy = false;
let lastPassiveContextSignature = "";
let lastSeenDomRevision = -1;
let latestDiscoveryHintRevision = -1;

const UI_BOOT_SNAPSHOT_KEY="rbtUiBootSnapshotV1";

const WELCOME_SEEN_STORAGE_KEY="rbtWelcomeSeenV1";
let welcomeSeenAtBoot=false;
let themeIsExplicit=false;
let systemThemeMedia=null;
let rbtConfirmReturnFocus=null;
let customizeReturnFocus=null;
let welcomeReturnFocus=null;
let lastBootSnapshotSignature="";
let lastBootSnapshotData=null;

let autoScanBusy=false;
let lastAutoScanAt=0;
let autoScanContextStatus={};
const AUTO_SCAN_MIN_INTERVAL_MS=5000;

const DATA_COLLECTION_PAGE_TYPES=new Set([
  "maladaptive",
  "replacement",
  "challenging",
  "client2replacement"
]);
let clientGateOpen=false;
let clientSwitchSafetyCheckTimer=null;

function credibleClientLabel(label) {
  const value=String(label || "").trim();
  if(!value) return false;
  if(/^(?:client|office\s*puzzle|loading|select\s+a\s+client)$/i.test(value)) return false;
  return true;
}

function isDataSheetsRoute(r=context) {
  const raw=String(r?.url || "").trim();
  if(!raw) return false;
  try {
    return new URL(raw).pathname.includes("/data/sheets");
  } catch(_) {
    return /\/data\/sheets(?:[/?#]|$)/i.test(raw);
  }
}

function hasUsableDataContext(r=context) {
  return Boolean(
    r?.ok &&
    isDataSheetsRoute(r) &&
    credibleClientLabel(r?.clientLabel) &&
    DATA_COLLECTION_PAGE_TYPES.has(String(r?.pageType || "")) &&
    // v1.1.95: Office Puzzle can leave old Client/Category text in the DOM
    // after navigating away. The content script now confirms that the actual
    // visible data-entry grid is still mounted. Undefined is tolerated only as
    // a compatibility fallback for an already-open tab during extension reload.
    r?.dataPageReady !== false
  );
}

function setClientGate(open,{message=""}={}) {
  clientGateOpen=Boolean(open);
  const gate=$("clientGate");
  const app=$("appMain");
  const text=$("clientGateMessage");

  if(text && message) text.textContent=message;
  if(gate) gate.hidden=!clientGateOpen;
  if(app) {
    app.inert=clientGateOpen;
    app.setAttribute("aria-busy",clientGateOpen ? "true" : "false");
  }
  document.body.classList.toggle("clientGateOpen",clientGateOpen);
}

function showClientSelectionGate() {
  setClientGate(true,{
    message:"Choose a client in Office Puzzle to continue."
  });
}

function hideClientSelectionGate() {
  setClientGate(false);
}

async function stopActiveWorkForMissingClient() {
  const active=Boolean(
    autoBatchState.armed ||
    autoBatchState.busy ||
    batchRunningKind ||
    activeWriteUiState.busy
  );
  if(!active) return false;

  autoBatchState.armed=false;
  autoBatchState.busy=false;
  autoBatchState.completed=false;
  autoBatchState.stoppedOnError=false;
  try { await sendTab({type:"ABORT_ACTIVE_WRITE"}); } catch(_) {}
  try { await persistAutoBatchRunnerState(); } catch(_) {}
  batchRunningKind=null;
  activeWriteUiState.busy=false;
  activeWriteUiState.tabId=null;
  activeWriteUiState.label="";
  setAutoBatchMessage("Stopped because no client is selected.","wait");
  updateStickyActionBar();
  updateStopControls();
  return true;
}

async function stopForClientContextChange(nextContext) {
  const oldKey=cleanClientKey(context?.clientLabel || "");
  const newKey=cleanClientKey(nextContext?.clientLabel || "");
  if(!oldKey || !newKey || oldKey===newKey) return false;

  const active=Boolean(
    autoBatchState.armed ||
    autoBatchState.busy ||
    batchRunningKind ||
    activeWriteUiState.busy
  );
  if(!active) return false;

  autoBatchState.armed=false;
  autoBatchState.busy=false;
  autoBatchState.completed=false;
  autoBatchState.stoppedOnError=false;
  try { await sendTab({type:"ABORT_ACTIVE_WRITE"}); } catch(_) {}
  try { await persistAutoBatchRunnerState(); } catch(_) {}
  batchRunningKind=null;
  activeWriteUiState.busy=false;
  activeWriteUiState.tabId=null;
  activeWriteUiState.label="";
  setAutoBatchMessage("Stopped because the selected client changed.","wait");
  updateStickyActionBar();
  updateStopControls();
  return true;
}

function contextSignature(r=context) {
  return `${cleanClientKey(r?.clientLabel || clientKey)}::${r?.selectedDate || ""}::${r?.pageType || ""}`;
}

function cachedProgramSnapshot(result) {
  return (result?.programs || [])
    .filter(item=>item?.name && item?.found && item?.writerKind!=="unsupported")
    .map(item=>({
      name:item.name,
      writerKind:item.writerKind,
      method:item.method || "",
      found:true,
      selectedDate:result?.selectedDate || context?.selectedDate || null
    }));
}

async function saveBootSnapshot(r=context,discovery=null) {
  if(!r?.pageType || !r?.clientLabel) return;

  const existing=lastBootSnapshotData;
  const sameContext=existing?.context && contextSignature(existing.context)===contextSignature(r);
  const programs=discovery
    ? cachedProgramSnapshot(discovery)
    : (sameContext ? (existing?.programs || []) : []);

  const payload={
    version:1,
    context:{
      ok:true,
      clientLabel:r.clientLabel || "Client",
      pageType:r.pageType || "officepuzzle",
      selectedDate:r.selectedDate || null,
      dateMin:r.dateMin || null,
      dateMax:r.dateMax || null,
      availableDates:Array.isArray(r.availableDates) ? r.availableDates : [],
      dateNavigationSupported:Boolean(r.dateNavigationSupported),
      currentName:r.currentName || "",
      collectionMethod:r.collectionMethod || "",
      domRevision:Number(r.domRevision ?? discovery?.domRevision ?? -1)
    },
    programs
  };

  const signature=JSON.stringify(payload);
  if(signature===lastBootSnapshotSignature) return;

  const snapshot={...payload,savedAt:Date.now()};
  lastBootSnapshotSignature=signature;
  lastBootSnapshotData=snapshot;
  await storageSet({[UI_BOOT_SNAPSHOT_KEY]:snapshot});
}

function hideStartupSkeleton() {
  const skeleton=$("startupSkeleton");
  if(skeleton) skeleton.hidden=true;

  $("appMain")?.setAttribute(
    "aria-busy",
    "false"
  );
}

function showOnlyContextSection(pageType) {
  $("maladaptiveSection").hidden=pageType!=="maladaptive";
  $("challengingSection").hidden=pageType!=="challenging";
  $("client2ReplacementSection").hidden=pageType!=="client2replacement";
  $("replacementSection").hidden=pageType!=="replacement";
  if(pageType!=="challenging" && $("clientHoursControl")) {
    $("clientHoursControl").hidden=true;
  }
}

async function applyCachedBootSnapshot(snapshot) {
  if(!snapshot?.context?.pageType) return false;

  const cachedContext={...snapshot.context};
  context=cachedContext;
  clientKey=cleanClientKey(cachedContext.clientLabel);
  refreshDateNavigationStateFromContext(cachedContext);

  $("clientLabel").textContent=cachedContext.clientLabel || "Client";
  $("pageType").textContent =
    cachedContext.pageType==="maladaptive" ? "Maladaptive Behaviors" :
    cachedContext.pageType==="challenging" ? "Challenging Behaviors" :
    cachedContext.pageType==="client2replacement" ? "Replacement Behaviors / Skill Acquisitions" :
    cachedContext.pageType==="replacement" ? "Replacement / Acquisition" :
    "Office Puzzle";

  $("connectionBadge").textContent="Sync";
  $("connectionBadge").className="badge neutral";

  showOnlyContextSection(cachedContext.pageType);

  const cachedPrograms=Array.isArray(snapshot.programs) ? snapshot.programs : [];
  if(cachedPrograms.length) {
    applyLiveProgramLists({
      pageType:cachedContext.pageType,
      programs:cachedPrograms
    });

    // Cached program names are safe for instant layout, but cached table IDs
    // are deliberately never treated as writable live mappings.
    const visualPrograms=cachedPrograms.map(item=>({
      ...item,
      found:false,
      tableId:null,
      selectedDate:cachedContext.selectedDate || item.selectedDate || null
    }));

    applyLiveDiscoveryMappings({
      pageType:cachedContext.pageType,
      programs:visualPrograms
    });
  }

  if(cachedContext.pageType==="maladaptive") {
    renderSelectedBehavior(true);
    await loadBehaviorPlan({preserveInput:false});
  } else if(cachedContext.pageType==="replacement") {
    renderSelectedReplacement(true);
    await loadReplacementPlan({preserveInput:false});
  } else if(cachedContext.pageType==="challenging") {
    challengingMapping=selectedChallengingMapping();
    await loadTodayChallengingHours();
    await renderChallengingMapping(true);
    await loadChallengingPlan({preserveInput:false});
  } else if(cachedContext.pageType==="client2replacement") {
    client2ReplacementMapping=client2ReplacementPlaceholder(selectedClient2ReplacementName());
    client2ReplacementMapping.selectedDate=cachedContext.selectedDate || null;
    await renderClient2Replacement(true);
    await loadClient2ReplacementPlan({preserveInput:false});
  }

  hideStartupSkeleton();
  updateStickyActionBar();
  return true;
}

async function loadStartupUiState() {
  const saved=await storageGet([
    "rbtTheme",
    UI_PREF_STORAGE_KEY,
    UI_BOOT_SNAPSHOT_KEY,
    WELCOME_SEEN_STORAGE_KEY
  ]);

  themeIsExplicit=
    saved.rbtTheme==="light" ||
    saved.rbtTheme==="dark";

  applyTheme(
    themeIsExplicit
      ? saved.rbtTheme
      : preferredSystemTheme()
  );

  // v1.1.68: customization is removed. Always boot into the single Focus UI.
  uiPreferences={...DEFAULT_UI_PREFERENCES};
  applyUiPreferences(uiPreferences,{syncControls:false});
  if(saved[UI_PREF_STORAGE_KEY]) {
    storageRemove([UI_PREF_STORAGE_KEY]).catch(()=>{});
  }

  welcomeSeenAtBoot=Boolean(
    saved[WELCOME_SEEN_STORAGE_KEY]
  );

  lastBootSnapshotData=
    saved[UI_BOOT_SNAPSHOT_KEY] || null;

  if(lastBootSnapshotData) {
    const {savedAt,...payload}=lastBootSnapshotData;
    lastBootSnapshotSignature=JSON.stringify(payload);
    await applyCachedBootSnapshot(lastBootSnapshotData);
  }

  return lastBootSnapshotData;
}

function autoScanContextKey(r=context) {
  return contextSignature(r);
}

function autoScanExpectedTotal(pageType,r=context) {
  const key=autoScanContextKey(r);
  const known=autoScanContextStatus[key];

  if(Number(known?.expectedInventory)>0) {
    return Number(known.expectedInventory);
  }

  // Before the first inventory scan, use the compatibility fallback only as a
  // retry hint. It is NEVER used to declare discovery complete.
  if(pageType==="maladaptive") return LEGACY_BEHAVIORS.length;
  if(pageType==="replacement") return LEGACY_REPLACEMENTS.length;
  if(pageType==="challenging") return LEGACY_CHALLENGING.length;
  if(pageType==="client2replacement") return LEGACY_CLIENT2_REPLACEMENTS.length;
  return 0;
}

function autoScanManualScanBusy(pageType) {
  if(pageType==="maladaptive") return !!scanInProgress;
  if(pageType==="replacement") return !!replacementScanInProgress;
  if(pageType==="challenging") return !!challengingScanInProgress;
  if(pageType==="client2replacement") return !!client2ReplacementScanInProgress;
  return false;
}

async function refreshQueuedMappingsFromAutoScan(kind,byName) {
  const list=batchState[kind] || [];
  if(!list.length) return;

  let changed=false;

  for(const queued of list) {
    const fresh=byName?.[queued.name];
    if(!fresh?.found) continue;

    if(JSON.stringify(queued.mapping || {})!==JSON.stringify(fresh)) {
      queued.mapping={...fresh};
      changed=true;
    }
  }

  if(changed) {
    await saveBatchKind(kind);
  }
}

async function quietAutoScanCurrentPage(r=context,{force=false}={}) {
  if(
    autoScanBusy ||
    autoProfileBusy ||
    autoBatchState.busy ||
    batchRunningKind ||
    dateNavigationState.busy
  ) return;

  const pageType=r?.pageType;
  const expected=autoScanExpectedTotal(pageType);
  if(!expected) return;
  if(autoScanManualScanBusy(pageType)) return;

  const key=autoScanContextKey(r);
  const known=autoScanContextStatus[key];
  const now=Date.now();

  // Once a complete inventory is known for this client/page, trust it for the
  // working session. Programs almost never change mid-session, and dropdowns /
  // routine DOM updates must never wake a full inventory workflow.
  if(!force && known?.complete) return;

  const minimumGap=force ? 650 : AUTO_SCAN_MIN_INTERVAL_MS;
  if(now-lastAutoScanAt<minimumGap) return;

  autoScanBusy=true;
  lastAutoScanAt=now;

  try {
    return await discoverAndApplyClientPrograms({
      preserveDraft:true,
      manual:false,
      force
    });
  } finally {
    autoScanBusy=false;
  }
}


function armFreshDiscoveryForContext(r) {
  const key=autoScanContextKey(r);

  autoScanContextStatus[key]={
    ...(autoScanContextStatus[key] || {}),
    complete:false,
    lastScanAt:0
  };

  // These throttles are intentionally reset on Office Puzzle page-type changes.
  // A completed Replacement page must never delay discovery of a newly opened
  // Behaviors page (or vice versa).
  lastAutoScanAt=0;
  autoProfileLastScanAt=0;
}

async function checkClientContextDuringActiveWork() {
  if(clientSwitchSafetyCheckTimer) clearTimeout(clientSwitchSafetyCheckTimer);
  clientSwitchSafetyCheckTimer=setTimeout(async()=>{
    clientSwitchSafetyCheckTimer=null;
    try {
      const live=await sendTab({type:"GET_CONTEXT"});
      if(!live?.ok) return;

      // URL is the authority for the client gate. Office Puzzle can remove
      // the table/client header during Behaviors <-> Replacements while staying
      // on /data/sheets; that must never look like "no client selected".
      if(!isDataSheetsRoute(live)) {
        await stopActiveWorkForMissingClient();
        cancelSameClientPageHandoff();
        showClientSelectionGate();
        return;
      }

      if(!hasUsableDataContext(live)) {
        hideClientSelectionGate();
        const key=cleanClientKey(context?.clientLabel || "");
        if(key) scheduleSameClientPageHandoffCheck(key);
        return;
      }

      const oldKey=cleanClientKey(context?.clientLabel || "");
      const newKey=cleanClientKey(live.clientLabel || "");
      if(oldKey && newKey && oldKey!==newKey) {
        await stopForClientContextChange(live);
        // A direct client-to-client switch can remain on /data/sheets the whole
        // time. Stop stale work, but do not show the "Select a client" gate
        // unless the URL actually leaves the data/sheets workflow.
        hideClientSelectionGate();
      }
    } catch(_) {}
  },80);
}

let dataPageGuardTimer=null;
let dataPageGuardFollowupTimer=null;
let sameClientPageHandoffTimer=null;
let sameClientPageHandoffKey="";
const SAME_CLIENT_PAGE_HANDOFF_GRACE_MS=900;
const SAME_CLIENT_PAGE_HANDOFF_MAX_MS=4500;

function cancelSameClientPageHandoff() {
  if(sameClientPageHandoffTimer) clearTimeout(sameClientPageHandoffTimer);
  sameClientPageHandoffTimer=null;
  sameClientPageHandoffKey="";
}

function sameClientTemporaryPageGap(live) {
  const currentKey=credibleClientLabel(context?.clientLabel)
    ? cleanClientKey(context.clientLabel)
    : "";

  // During a Behaviors <-> Replacements/Skills SPA transition Office Puzzle
  // can temporarily remove BOTH the collection grid and the client header.
  // Therefore the transient GET_CONTEXT snapshot cannot be required to repeat
  // the client label. The last fully verified data-page context owns the short
  // handoff until navigation settles. A genuinely unsupported destination will
  // be gated by the settle check below.
  return Boolean(
    currentKey &&
    DATA_COLLECTION_PAGE_TYPES.has(String(context?.pageType || "")) &&
    live?.dataPageReady===false
  );
}

function sameClientPageTransitionEvidence(live,expectedKey) {
  const liveKey=credibleClientLabel(live?.clientLabel)
    ? cleanClientKey(live.clientLabel)
    : "";

  return Boolean(
    (expectedKey && liveKey && liveKey===expectedKey) ||
    DATA_COLLECTION_PAGE_TYPES.has(String(live?.pageType || ""))
  );
}

function scheduleSameClientPageHandoffCheck(clientKeyAtGap,{startedAt=Date.now()}={}) {
  if(
    sameClientPageHandoffTimer &&
    sameClientPageHandoffKey===clientKeyAtGap
  ) return;

  cancelSameClientPageHandoff();
  sameClientPageHandoffKey=clientKeyAtGap;

  const check=async()=>{
    sameClientPageHandoffTimer=null;
    const expectedKey=sameClientPageHandoffKey;
    if(!expectedKey) return;

    try {
      const live=await sendTab({type:"GET_CONTEXT"});
      const liveKey=credibleClientLabel(live?.clientLabel)
        ? cleanClientKey(live.clientLabel)
        : "";

      if(live?.ok && hasUsableDataContext(live)) {
        cancelSameClientPageHandoff();

        // Same client, new collection page: keep the UI continuous and run the
        // required full page inventory scan. No Select Client flash.
        if(liveKey===expectedKey) {
          armFreshDiscoveryForContext(live);
          await refreshContext(live,{forcePageInventory:true});
          return;
        }

        // A different client is already fully mounted. There is no longer a
        // client-less state to display; switch safely to the new client.
        await stopForClientContextChange(live);
        armFreshDiscoveryForContext(live);
        await refreshContext(live,{forcePageInventory:true,forceClientDates:true});
        return;
      }

      // Gate only after positively reading a URL that has left /data/sheets.
      // If the tab is briefly unreadable, preserve the last verified client UI
      // rather than manufacturing a false "no client" state.
      if(!live?.ok) return;

      if(isDataSheetsRoute(live)) {
        hideClientSelectionGate();
        const elapsed=Date.now()-startedAt;
        if(elapsed<SAME_CLIENT_PAGE_HANDOFF_MAX_MS) {
          sameClientPageHandoffTimer=setTimeout(
            check,
            Math.min(600,SAME_CLIENT_PAGE_HANDOFF_MAX_MS-elapsed)
          );
        } else {
          cancelSameClientPageHandoff();
        }
        return;
      }

      cancelSameClientPageHandoff();
      await stopActiveWorkForMissingClient();
      showClientSelectionGate();
      if($("clientLabel")) $("clientLabel").textContent="No client selected";
      if($("pageType")) $("pageType").textContent="Select a client in Office Puzzle";
      if($("connectionBadge")) $("connectionBadge").hidden=true;
    } catch(_) {
      // Navigation can briefly make the tab unreadable. Keep the last verified
      // client visible and let the next route/DOM hint or heartbeat settle it.
    }
  };

  sameClientPageHandoffTimer=setTimeout(check,SAME_CLIENT_PAGE_HANDOFF_GRACE_MS);
}

async function guardCurrentDataPageNow() {
  try {
    const live=await sendTab({type:"GET_CONTEXT"});

    if(!live?.ok) return true;

    // URL-first gate: staying on /data/sheets means the user is still in the
    // client data workflow, even if Office Puzzle temporarily removes the
    // client header/table while switching Behaviors <-> Replacements.
    if(!isDataSheetsRoute(live)) {
      cancelSameClientPageHandoff();
      await stopActiveWorkForMissingClient();
      showClientSelectionGate();
      if($("clientLabel")) $("clientLabel").textContent="No client selected";
      if($("pageType")) $("pageType").textContent="Select a client in Office Puzzle";
      if($("connectionBadge")) $("connectionBadge").hidden=true;
      return false;
    }

    hideClientSelectionGate();

    if(!hasUsableDataContext(live)) {
      const key=cleanClientKey(context?.clientLabel || "");
      if(key) scheduleSameClientPageHandoffCheck(key);
      return true;
    }

    cancelSameClientPageHandoff();

    // If we are coming BACK from the gate, even to the same client/page, Office
    // Puzzle has rebuilt that page. Treat it as a fresh page entry and run the
    // full lazy inventory sweep again before exposing the normal workflow.
    if(clientGateOpen) {
      armFreshDiscoveryForContext(live);
      await refreshContext(live,{forcePageInventory:true});
    }

    return true;
  } catch(_) {
    return false;
  }
}

function scheduleImmediateDataPageGuard() {
  clearTimeout(dataPageGuardTimer);
  clearTimeout(dataPageGuardFollowupTimer);

  dataPageGuardTimer=setTimeout(async()=>{
    const stillOnDataPage=await guardCurrentDataPageNow();
    if(!stillOnDataPage) return;

    // SPA route changes can report the old mounted table for one microtask.
    // Re-check once after Office Puzzle has had a moment to unmount/remount.
    dataPageGuardFollowupTimer=setTimeout(async()=>{
      const liveOkay=await guardCurrentDataPageNow();
      if(liveOkay) passiveContextSync();
    },180);
  },20);
}

async function passiveContextSync() {
  if(lastObservedLocalDay && lastObservedLocalDay!==localTodayISODate()) {
    await refreshForLocalDateRollover();
    return;
  }

  if(
    passiveSyncBusy ||
    autoBatchState.busy ||
    batchRunningKind ||
    dateNavigationState.busy ||
    activeWriteUiState.busy
  ) return;

  passiveSyncBusy=true;

  try {
    const r=await sendTab({type:"GET_CONTEXT"});
    if(!r?.ok) return;

    const signature=contextSignature(r);
    const revision=Number(r.domRevision ?? -1);

    if(signature!==lastPassiveContextSignature) {
      armFreshDiscoveryForContext(r);
      await refreshContext(r);
      return;
    }

    if($("connectionBadge")) $("connectionBadge").hidden=true;

    // If the Office Puzzle DOM has not changed since our last successful read,
    // there is nothing useful to rediscover. This is the main idle-CPU guard.
    if(revision>=0 && revision===lastSeenDomRevision) return;

    if(revision>=0) lastSeenDomRevision=revision;

    const status=autoScanContextStatus[autoScanContextKey(r)];
    if(status?.complete) {
      // The program inventory is already known. A revision on a completed page
      // is much more likely to be data changing than inventory changing, so do
      // a cheap current-table truth sync instead of waking the full scanner.
      scheduleLiveTruthSync({domRevision:revision});
      return;
    }

    await quietAutoScanCurrentPage(r,{force:false});
  } catch(_) {
    // Quiet fallback. The visible badge is updated by the next live refresh.
  } finally {
    passiveSyncBusy=false;
  }
}


let fastDiscoveryTimer=null;
let fastDiscoveryFollowupTimer=null;

async function fastDiscoveryRefresh(hintRevision=-1) {
  if(
    passiveSyncBusy ||
    autoScanBusy ||
    autoProfileBusy ||
    autoBatchState.busy ||
    batchRunningKind ||
    dateNavigationState.busy ||
    activeWriteUiState.busy
  ) return null;

  try {
    const r=await sendTab({type:"GET_CONTEXT"});
    if(!r?.ok) return null;

    const signature=contextSignature(r);
    const revision=Number(r.domRevision ?? hintRevision ?? -1);

    if(signature!==lastPassiveContextSignature) {
      armFreshDiscoveryForContext(r);
      await refreshContext(r);
      return null;
    }

    const status=autoScanContextStatus[autoScanContextKey(r)];

    // Learned inventories are frozen during normal use. Clinical writes perform
    // their own exact mapping refresh, so UI mutations do not need to rediscover
    // the complete program inventory.
    if(status?.complete) return null;

    // A scroll event by itself is not a reason to rescan a completed, unchanged
    // page. Lazy-loaded content produces a DOM revision/mutation hint.
    if(
      revision>=0 &&
      revision===lastSeenDomRevision &&
      status?.complete
    ) return null;

    if(revision>=0) lastSeenDomRevision=revision;
    return await quietAutoScanCurrentPage(r,{force:true});
  } catch(_) {
    return null;
  }
}

let liveTruthSyncTimer=null;
let liveTruthSyncBusy=false;
let lastLiveTruthSyncRevision=-1;

async function syncCurrentPageTruthFromOfficePuzzle(hintRevision=-1,{force=false}={}) {
  if(
    liveTruthSyncBusy ||
    passiveSyncBusy ||
    autoScanBusy ||
    autoProfileBusy ||
    autoBatchState.busy ||
    batchRunningKind ||
    dateNavigationState.busy ||
    activeWriteUiState.busy
  ) return false;

  liveTruthSyncBusy=true;

  try {
    const live=await sendTab({type:"GET_CONTEXT"});
    if(!live?.ok || !isDataSheetsRoute(live)) return false;

    const liveClient=cleanClientKey(live.clientLabel || "");
    const currentClient=cleanClientKey(context?.clientLabel || "");

    // A route/client/page transition owns its own refresh pipeline. This helper
    // is only for live data edits inside the already-mounted current page.
    if(
      !liveClient ||
      !currentClient ||
      liveClient!==currentClient ||
      live.pageType!==context?.pageType
    ) return false;

    const revision=Number(live.domRevision ?? hintRevision ?? -1);
    if(!force && revision>=0 && revision===lastLiveTruthSyncRevision) return true;

    if(live.pageType==="challenging") {
      // Partial Interval/Frequency pages already expose a current-table reader.
      // Use it instead of rediscovering every visible program just to refresh
      // one changed day.
      const refreshed=await refreshChallengingActualFromOfficePuzzle({
        render:false,
        attempts:1
      });
      if(!refreshed) return false;
      await renderChallengingMapping(true);
      await loadChallengingPlan({preserveInput:true});
    } else {
      await refreshCurrentMappingsForSelectedTableDate(live.pageType);

      if(live.pageType==="maladaptive") {
        await loadBehaviorPlan({preserveInput:true});
      } else if(live.pageType==="replacement") {
        await loadReplacementPlan({preserveInput:true});
      } else if(live.pageType==="client2replacement") {
        await loadClient2ReplacementPlan({preserveInput:true});
      }
    }

    if(revision>=0) {
      lastLiveTruthSyncRevision=revision;
      lastSeenDomRevision=Math.max(lastSeenDomRevision,revision);
    }
    updateAllWeekNavigators();
    return true;
  } catch(_) {
    return false;
  } finally {
    liveTruthSyncBusy=false;
  }
}

function scheduleLiveTruthSync(msg={}) {
  const revision=Number(msg?.domRevision ?? -1);
  const force=Boolean(msg?.force);

  if(
    !force &&
    revision>=0 &&
    revision===lastLiveTruthSyncRevision
  ) return;

  clearTimeout(liveTruthSyncTimer);
  liveTruthSyncTimer=setTimeout(()=>{
    liveTruthSyncTimer=null;
    syncCurrentPageTruthFromOfficePuzzle(revision,{force});
  },280);
}

function scheduleFastDiscoveryRefresh(msg={}) {
  const hintRevision=Number(msg?.domRevision ?? -1);
  latestDiscoveryHintRevision=Math.max(latestDiscoveryHintRevision,hintRevision);

  const currentStatus=autoScanContextStatus[autoScanContextKey()];

  // Cell/data edits are reconciled by the lightweight live-truth reader. They
  // are not inventory changes and should never wake the full page scanner.
  if(msg?.reason==="data" && currentStatus?.complete) return;

  // Repeated scrolling over already-known content should be effectively free.
  if(
    msg?.reason==="scroll" &&
    currentStatus?.complete &&
    hintRevision>=0 &&
    hintRevision<=lastSeenDomRevision
  ) return;

  clearTimeout(fastDiscoveryTimer);

  const urgentContextChange=
    msg?.reason==="route" || msg?.reason==="data-page-change";

  fastDiscoveryTimer=setTimeout(async()=>{
    const result=await fastDiscoveryRefresh(latestDiscoveryHintRevision);
    if(!result?.pageType) return;

    const status=autoScanContextStatus[autoScanContextKey(result)];
    if(status?.complete) return;

    clearTimeout(fastDiscoveryFollowupTimer);
    fastDiscoveryFollowupTimer=setTimeout(()=>{
      fastDiscoveryRefresh(latestDiscoveryHintRevision);
    },1200);
  },urgentContextChange ? 45 : 240);
}

chrome.runtime.onMessage.addListener((msg)=>{
  if(msg?.type!=="RBT_DISCOVERY_HINT") return;

  if(
    autoBatchState.armed ||
    autoBatchState.busy ||
    batchRunningKind ||
    activeWriteUiState.busy
  ) {
    checkClientContextDuringActiveWork();
  }

  if(msg?.reason==="route" || msg?.reason==="data-page-change") {
    scheduleImmediateDataPageGuard();
  }

  if(msg?.reason==="data") {
    scheduleLiveTruthSync(msg);
  }

  scheduleFastDiscoveryRefresh(msg);
});

const AUTO_BATCH_RESUME_KEY="autoBatchResumeState";
const AUTO_BATCH_RESUME_TTL_MS=30*60*1000;

function syncAutoBatchTicker() {
  if(autoBatchTimer) {
    clearInterval(autoBatchTimer);
    autoBatchTimer=null;
  }

  // No background 1.2-second wakeups while idle. The ticker exists only while
  // an Auto Run is armed/resumable, where it is needed for reconnect retries.
  if(!autoBatchState.armed) return;

  autoBatchTimer=setInterval(()=>{
    if(autoBatchState.armed && !autoBatchState.busy) {
      autoBatchTick();
    }
  },1200);
}

async function persistAutoBatchRunnerState() {
  syncAutoBatchTicker();
  if(!autoBatchState.armed) {
    // Once a run is completed/stopped/failed, normal extension actions should
    // go back to following the active tab.
    autoBatchState.lockedTabId=null;

    await storageSet({
      [AUTO_BATCH_RESUME_KEY]:{
        armed:false,
        lockedTabId:null,
        expiresAt:0
      }
    });
    return;
  }

  await storageSet({
    [AUTO_BATCH_RESUME_KEY]:{
      armed:true,
      lockedTabId:Number.isInteger(autoBatchState.lockedTabId)
        ? autoBatchState.lockedTabId
        : null,
      expiresAt:Date.now()+AUTO_BATCH_RESUME_TTL_MS
    }
  });
}

async function primeRunBatchTabLockFromStorage() {
  const saved=await storageGet([AUTO_BATCH_RESUME_KEY]);
  const state=saved[AUTO_BATCH_RESUME_KEY];

  if(
    !state?.armed ||
    Number(state.expiresAt||0)<=Date.now() ||
    !Number.isInteger(state.lockedTabId)
  ) {
    autoBatchState.lockedTabId=null;
    return false;
  }

  try {
    const tab=await getTabById(state.lockedTabId);

    if(!isOfficePuzzleUrl(tab?.url)) {
      autoBatchState.lockedTabId=null;
      return false;
    }

    autoBatchState.lockedTabId=state.lockedTabId;
    return true;
  } catch(_) {
    autoBatchState.lockedTabId=null;
    return false;
  }
}

async function restoreAutoBatchRunnerState() {
  const saved=await storageGet([AUTO_BATCH_RESUME_KEY]);
  const state=saved[AUTO_BATCH_RESUME_KEY];

  if(
    !state?.armed ||
    Number(state.expiresAt||0)<=Date.now() ||
    !Number.isInteger(state.lockedTabId)
  ) {
    autoBatchState.armed=false;
    autoBatchState.busy=false;
    autoBatchState.stoppedOnError=false;
    autoBatchState.completed=false;
    autoBatchState.lockedTabId=null;

    if(state?.armed) {
      await storageSet({
        [AUTO_BATCH_RESUME_KEY]:{
          armed:false,
          lockedTabId:null,
          expiresAt:0
        }
      });
    }

    setAutoBatchMessage("Ready when you are.");
    return false;
  }

  try {
    const lockedTab=await getTabById(state.lockedTabId);

    if(!isOfficePuzzleUrl(lockedTab?.url)) {
      throw new Error("Locked tab is no longer Office Puzzle.");
    }

    autoBatchState.lockedTabId=state.lockedTabId;
  } catch(_) {
    autoBatchState.armed=false;
    autoBatchState.busy=false;
    autoBatchState.stoppedOnError=true;
    autoBatchState.completed=false;
    autoBatchState.lockedTabId=null;

    await storageSet({
      [AUTO_BATCH_RESUME_KEY]:{
        armed:false,
        lockedTabId:null,
        expiresAt:0
      }
    });

    setAutoBatchMessage(
      "Could not resume because the Office Puzzle tab was closed or changed.",
      "bad"
    );
    return false;
  }

  // Office Puzzle can re-render/reload the side panel after a successful
  // table write. Restore the runner so it continues with the next item.
  autoBatchState.armed=true;
  autoBatchState.busy=false;
  autoBatchState.stoppedOnError=false;
  autoBatchState.completed=false;
  autoBatchState.lastContextSignature="";

  // Any stale "applying" marker came from a document reload in the middle
  // of UI bookkeeping. Put it back into the already human-verified state.
  // The existing writer will read the live table and only make changes
  // required to reach the reviewed target/pattern.
  let changed=false;

  for(const kind of Object.keys(batchState)) {
    for(const item of batchState[kind] || []) {
      if(item.status==="applying") {
        item.status="ready";
        item.error="";
        changed=true;
      }
    }

    if(changed) {
      await saveBatchKind(kind);
      changed=false;
    }
  }

  setAutoBatchMessage(
    "Resumed after Office Puzzle refreshed. Continuing with the next task…",
    "wait"
  );

  return true;
}





const $ = id => document.getElementById(id);

function positionToastAboveControls() {
  const el=$("toast");
  if(!el || el.hidden) return;
  const bar=$("stickyActionBar");
  const rect=bar && !bar.hidden ? bar.getBoundingClientRect() : null;
  const bottom=rect?.height>0
    ? Math.max(15,window.innerHeight-rect.top+10)
    : 15;
  el.style.bottom=`${bottom}px`;
  el.style.maxHeight=`${Math.max(48,window.innerHeight-bottom-16)}px`;
}

function installToastPositioning() {
  window.addEventListener("resize",positionToastAboveControls,{passive:true});
  const bar=$("stickyActionBar");
  if(bar && typeof ResizeObserver!=="undefined") {
    const observer=new ResizeObserver(positionToastAboveControls);
    observer.observe(bar);
  }
}

function toast(message, ms=2800) {
  const el=$("toast");
  el.classList.remove("validationToast");
  el.setAttribute("role","status");
  el.setAttribute("aria-live","polite");
  el.textContent=message;
  el.hidden=false;
  positionToastAboveControls();
  clearTimeout(toast._timer);
  toast._timer=setTimeout(()=>{el.hidden=true;},ms);
}

function validationError(message,fieldId=null) {
  const el=$("toast");
  if(el) {
    el.setAttribute("role","alert");
    el.setAttribute("aria-live","assertive");
    el.textContent=message;
    el.hidden=false;
    el.classList.add("validationToast");
    positionToastAboveControls();
    clearTimeout(toast._timer);
    toast._timer=setTimeout(()=>{
      el.hidden=true;
      el.classList.remove("validationToast");
    },6000);
  }

  if(fieldId) {
    const field=$(fieldId);
    if(field) {
      field.classList.remove("validationFieldError");
      // Restart animation if the same validation fires twice.
      void field.offsetWidth;
      field.classList.add("validationFieldError");
      field.focus({preventScroll:false});
      setTimeout(
        ()=>field.classList.remove("validationFieldError"),
        1800
      );
    }
  }

  return false;
}

function storageGet(keys) { return new Promise(r=>chrome.storage.local.get(keys,r)); }
function storageSet(obj) { return new Promise(r=>chrome.storage.local.set(obj,r)); }
function storageRemove(keys) {
  return new Promise(r=>chrome.storage.local.remove(keys,r));
}

async function getActiveTab() {
  let tabs=await chrome.tabs.query({active:true,currentWindow:true});
  if(tabs[0]) return tabs[0];

  tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  return tabs[0]||null;
}

function getTabById(tabId) {
  return new Promise((resolve,reject)=>{
    chrome.tabs.get(tabId,tab=>{
      if(chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(tab);
      }
    });
  });
}

async function getMessageTargetTab() {
  if(Number.isInteger(autoBatchState.lockedTabId)) {
    let lockedTab;

    try {
      lockedTab=await getTabById(autoBatchState.lockedTabId);
    } catch(_) {
      throw new Error(
        "The Office Puzzle tab was closed. The run has stopped."
      );
    }

    if(!isOfficePuzzleUrl(lockedTab?.url)) {
      throw new Error(
        "The selected tab is no longer on Office Puzzle. The run has stopped."
      );
    }

    return lockedTab;
  }

  if(Number.isInteger(batchTargetTabId)) {
    try {
      const lockedBatchTab=await getTabById(batchTargetTabId);

      if(!isOfficePuzzleUrl(lockedBatchTab?.url)) {
        throw new Error("Locked batch tab left Office Puzzle.");
      }

      return lockedBatchTab;
    } catch(_) {
      throw new Error("The Office Puzzle tab for this batch run is no longer available.");
    }
  }

  if(Number.isInteger(activeWriteUiState.tabId)) {
    try {
      const writeTab=await getTabById(activeWriteUiState.tabId);

      if(!isOfficePuzzleUrl(writeTab?.url)) {
        throw new Error("Active write tab left Office Puzzle.");
      }

      return writeTab;
    } catch(_) {
      throw new Error("The Office Puzzle tab with the active write was closed.");
    }
  }

  if(Number.isInteger(dateNavigationTabId)) {
    try {
      const tab=await getTabById(dateNavigationTabId);
      if(!isOfficePuzzleUrl(tab?.url)) {
        throw new Error("Date navigation tab left Office Puzzle.");
      }
      return tab;
    } catch(_) {
      throw new Error("The Office Puzzle tab used for date navigation was closed.");
    }
  }

  return await getActiveTab();
}

function isOfficePuzzleUrl(url) {
  return /^https:\/\/(?:[^/]+\.)?officepuzzle\.com\//i.test(String(url||""));
}

function isRecoverableBatchConnectionError(errorLike) {
  const msg=String(errorLike?.message || errorLike || "").toLowerCase();

  if(!msg) return false;

  if(
    msg.includes("tab was closed") ||
    msg.includes("no longer on office puzzle") ||
    msg.includes("the office puzzle tab was closed")
  ) {
    return false;
  }

  return (
    msg.includes("receiving end does not exist") ||
    msg.includes("message port closed before a response was received") ||
    msg.includes("office puzzle context was unavailable") ||
    msg.includes("could not connect to office puzzle") ||
    msg.includes("no target tab") ||
    msg.includes("frame was removed")
  );
}

function sendMessageToTab(tabId,message) {
  return new Promise((resolve,reject)=>{
    chrome.tabs.sendMessage(tabId,message,response=>{
      if(chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function ensureTabConnection(tab) {
  if(!tab?.id) throw new Error("No target tab.");

  if(!isOfficePuzzleUrl(tab.url)) {
    throw new Error("Open Office Puzzle in the target tab.");
  }

  const result=await chrome.runtime.sendMessage({
    type:"ENSURE_RBT_CONTENT_SCRIPT",
    tabId:tab.id
  });

  if(!result?.ok) {
    throw new Error(result?.error || "Could not connect to Office Puzzle.");
  }

  return result;
}

const CLINICAL_WRITE_MESSAGE_TYPES=new Set([
  "SET_BEHAVIOR_COUNT",
  "SET_REPLACEMENT_TRIALS",
  "SET_CHALLENGING_INTERVALS",
  "SET_CLIENT2_REPLACEMENT_TRIALS",
  "CLEAR_SELECTED_COLUMN"
]);

async function sendTab(message) {
  if(
    CLINICAL_WRITE_MESSAGE_TYPES.has(message?.type) &&
    String(context?.selectedDate || "")>localTodayISODate()
  ) {
    return {
      ok:false,
      verified:false,
      error:"Future dates are available for planning/review only. Select today or a past date to write observed data."
    };
  }

  const isClinicalWrite=CLINICAL_WRITE_MESSAGE_TYPES.has(message?.type);

  if(
    isClinicalWrite &&
    rbtActionMode &&
    rbtActionStopRequested
  ) {
    pendingWriteTabId=null;
    return {
      ok:false,
      verified:false,
      aborted:true,
      cancelled:true,
      error:"Stopped by user."
    };
  }

  let tab;

  if(isClinicalWrite && Number.isInteger(pendingWriteTabId)) {
    try {
      tab=await getTabById(pendingWriteTabId);
    } catch(_) {
      pendingWriteTabId=null;
      throw new Error("The Office Puzzle tab armed for this write was closed.");
    }

    if(!isOfficePuzzleUrl(tab?.url)) {
      pendingWriteTabId=null;
      throw new Error("The Office Puzzle tab armed for this write is no longer on Office Puzzle.");
    }
  } else {
    tab=await getMessageTargetTab();
  }

  if(!tab?.id) throw new Error("No target tab.");

  if(isClinicalWrite) {
    activeWriteUiState.busy=true;
    activeWriteUiState.tabId=tab.id;
    activeWriteUiState.label=message.type;
    pendingWriteTabId=null;
    updateStickyActionBar();
    updateStopControls();
  }

  try {
    try {
      return await sendMessageToTab(tab.id,message);
    } catch(firstError) {
      // If Office Puzzle was already open before this unpacked extension was
      // loaded/reloaded, Chrome has no content-script receiver yet.
      await ensureTabConnection(tab);
      return await sendMessageToTab(tab.id,message);
    }
  } finally {
    if(isClinicalWrite) {
      activeWriteUiState.busy=false;
      activeWriteUiState.tabId=null;
      activeWriteUiState.label="";
      updateStickyActionBar();
      updateStopControls();
    }
  }
}

async function armOneWrite() {
  const token=crypto.randomUUID();
  const tab=await getMessageTargetTab();

  if(!tab?.id) throw new Error("No Office Puzzle tab available for this write.");

  try {
    await ensureTabConnection(tab);
  } catch(_) {
    // ensureTabConnection also handles the already-connected case; continue
    // with the exact-tab message below so Chrome returns the useful error.
  }

  const result=await sendMessageToTab(tab.id,{type:"ARM_WRITE",token});

  if(!result?.ok || !result?.armed) {
    throw new Error("Could not arm safe write mode.");
  }

  // The very next clinical write must go to the same tab that received the
  // one-use safe-write token, even if the user switches tabs in between.
  pendingWriteTabId=tab.id;
  return token;
}


function cleanClientKey(name) {
  return String(name||"client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"")
    .slice(0,80) || "client";
}

function autoProfileStorageKey(label=context?.clientLabel) {
  return `autoClientProfile::${cleanClientKey(label || "client")}`;
}

function emptyAutoClientProfile(label=context?.clientLabel) {
  return {
    version:AUTO_CLIENT_PROFILE_VERSION,
    clientKey:cleanClientKey(label || "client"),
    clientLabel:label || "Client",
    pages:{
      maladaptive:[],
      replacement:[],
      challenging:[],
      client2replacement:[]
    },
    pageDiscovery:{
      maladaptive:null,
      replacement:null,
      challenging:null,
      client2replacement:null
    },
    updatedAt:new Date().toISOString()
  };
}

function profileProgramRecord(program) {
  return {
    name:String(program?.name || "").trim(),
    pageType:String(program?.pageType || context?.pageType || ""),
    category:String(program?.category || "").trim(),
    method:String(program?.method || ""),
    rawMethod:String(program?.rawMethod || "").trim(),
    writerKind:String(program?.writerKind || "unsupported"),
    methodSource:String(program?.methodSource || ""),
    maxOccurrences:Number.isFinite(Number(program?.maxOccurrences))
      ? Number(program.maxOccurrences)
      : null,
    maxIntervals:Number.isFinite(Number(program?.maxIntervals))
      ? Number(program.maxIntervals)
      : null,
    trials:Number.isFinite(Number(program?.trials))
      ? Number(program.trials)
      : null,
    lastSeenAt:new Date().toISOString()
  };
}

function mergeProfileProgramList(existing,incoming) {
  const out=(existing || []).map(item=>({...item}));
  const indexByName=new Map(
    out.map((item,index)=>[cleanClientKey(item.name),index])
  );

  for(const raw of incoming || []) {
    const item=profileProgramRecord(raw);
    if(!item.name) continue;

    const key=cleanClientKey(item.name);
    const index=indexByName.get(key);

    if(index==null) {
      indexByName.set(key,out.length);
      out.push(item);
    } else {
      out[index]={
        ...out[index],
        ...item,
        name:out[index].name || item.name
      };
    }
  }

  return out;
}

async function mergeAndSaveAutoClientProfile(discovery) {
  const label=discovery?.clientLabel || context?.clientLabel || "Client";
  const key=autoProfileStorageKey(label);
  const saved=await storageGet([key]);

  const profile=
    saved[key] &&
    saved[key].version===AUTO_CLIENT_PROFILE_VERSION
      ? saved[key]
      : emptyAutoClientProfile(label);

  profile.clientLabel=label;
  profile.clientKey=cleanClientKey(label);
  profile.pages=profile.pages || emptyAutoClientProfile(label).pages;
  profile.pageDiscovery=
    profile.pageDiscovery ||
    emptyAutoClientProfile(label).pageDiscovery;

  const pageType=discovery?.pageType;

  if(profile.pages[pageType]) {
    // Merge only; never shrink a previously fuller learned profile because a
    // later scan was partial/lazy.
    profile.pages[pageType]=mergeProfileProgramList(
      profile.pages[pageType],
      discovery.programs || []
    );
  }

  if(profile.pageDiscovery[pageType] !== undefined) {
    const prior=profile.pageDiscovery[pageType] || {};
    const expected=Math.max(
      0,
      Number(discovery?.inventoryExpected || 0)
    );
    const mapped=(discovery?.programs || []).filter(item=>
      item?.found &&
      item.writerKind!=="unsupported"
    ).length;

    const names=(discovery?.programs || [])
      .filter(item=>item?.found && item.writerKind!=="unsupported")
      .map(item=>item.name)
      .join("|");

    const signature=[
      expected,
      Number(discovery?.supportedTableCount || 0),
      Number(discovery?.resolvedNameCount || 0),
      mapped,
      names
    ].join("::");

    const sameSignature=prior.signature===signature;
    const stablePasses=sameSignature
      ? Number(prior.stablePasses || 0)+1
      : 1;

    const inventoryComplete=
      Boolean(discovery?.inventoryComplete) &&
      expected>0 &&
      mapped>=expected;

    profile.pageDiscovery[pageType]={
      expectedInventory:expected,
      supportedTableCount:Number(discovery?.supportedTableCount || 0),
      resolvedNameCount:Number(discovery?.resolvedNameCount || 0),
      mapped,
      unresolvedTableCount:Number(discovery?.unresolvedTableCount || 0),
      signature,
      stablePasses,
      // Two identical complete passes protect against an Office Puzzle page
      // that is still lazy-loading more program sections.
      complete:inventoryComplete && stablePasses>=2,
      lastScanAt:Date.now()
    };
  }

  profile.updatedAt=new Date().toISOString();
  learnedClientProfile=profile;

  await storageSet({[key]:profile});
  return profile;
}

async function loadAutoClientProfile(label=context?.clientLabel) {
  const key=autoProfileStorageKey(label);
  const saved=await storageGet([key]);

  learnedClientProfile=
    saved[key] &&
    saved[key].version===AUTO_CLIENT_PROFILE_VERSION
      ? saved[key]
      : emptyAutoClientProfile(label);

  return learnedClientProfile;
}

function supportedProfilePrograms(pageType,profile=learnedClientProfile) {
  const list=profile?.pages?.[pageType] || [];

  if(pageType==="maladaptive") {
    return list.filter(item=>item.writerKind==="count");
  }

  if(pageType==="replacement" || pageType==="client2replacement") {
    return list.filter(item=>item.writerKind==="replacement");
  }

  if(pageType==="challenging") {
    return list.filter(item=>
      item.writerKind==="count" ||
      item.writerKind==="partial_interval"
    );
  }

  return [];
}

function profileProgramCount(profile=learnedClientProfile) {
  if(!profile?.pages) return 0;

  return Object.values(profile.pages)
    .flat()
    .filter(item=>item?.name)
    .length;
}

function renderAutoProfileStatus(discovery=null) {
  const el=$("autoProfileStatus");
  if(!el) return;

  const total=profileProgramCount();
  const pageType=context?.pageType;
  const current=supportedProfilePrograms(pageType).length;
  const state=learnedClientProfile?.pageDiscovery?.[pageType] || null;
  const unsupported=(learnedClientProfile?.pages?.[pageType] || [])
    .filter(item=>item.writerKind==="unsupported").length;

  if(state && !state.complete) {
    const expected=Number(state.expectedInventory || 0);
    const mapped=Number(state.mapped || 0);
    const names=Number(state.resolvedNameCount || 0);

    el.textContent=
      expected>0
        ? `Auto profile · ${mapped}/${expected} mapped · ${names} names resolved · still discovering`
        : "Auto profile: inventorying this client…";

    el.className="autoProfileStatus learning";
    return;
  }

  if(total===0) {
    el.textContent="Auto profile: learning this client from Office Puzzle…";
    el.className="autoProfileStatus learning";
    return;
  }

  el.textContent=
    `Auto profile · ${total} program${total===1 ? "" : "s"} learned` +
    (current ? ` · ${current} on this page` : "") +
    (unsupported ? ` · ${unsupported} unsupported` : "");

  el.className="autoProfileStatus learned";
}

function preserveSelectedNameForPage(pageType) {
  if(pageType==="maladaptive") return BEHAVIORS[selectedBehaviorIndex] || "";
  if(pageType==="replacement") return REPLACEMENTS[selectedReplacementIndex] || "";
  if(pageType==="challenging") return CHALLENGING[selectedChallengingIndex]?.name || "";
  if(pageType==="client2replacement") {
    return CLIENT2_REPLACEMENTS[selectedClient2ReplacementIndex] || "";
  }
  return "";
}

function applyProfileListsForCurrentPage(profile=learnedClientProfile) {
  const pageType=context?.pageType;
  const learned=supportedProfilePrograms(pageType,profile);
  const discovery=profile?.pageDiscovery?.[pageType];

  // A partial scan must never collapse the dropdown to "1 of 1". Keep the
  // compatibility list until the Office Puzzle table inventory and resolved
  // program names agree on a stable complete set.
  if(!learned.length || !discovery?.complete) {
    renderAutoProfileStatus();
    return false;
  }

  const selectedName=preserveSelectedNameForPage(pageType);

  if(pageType==="maladaptive") {
    BEHAVIORS=learned.map(item=>item.name);
    const next=BEHAVIORS.indexOf(selectedName);
    selectedBehaviorIndex=next>=0 ? next : Math.min(selectedBehaviorIndex,BEHAVIORS.length-1);
    populateBehaviorSelect();
  }

  if(pageType==="replacement") {
    REPLACEMENTS=learned.map(item=>item.name);
    const next=REPLACEMENTS.indexOf(selectedName);
    selectedReplacementIndex=next>=0 ? next : Math.min(selectedReplacementIndex,REPLACEMENTS.length-1);
    populateReplacementSelect();
  }

  if(pageType==="challenging") {
    CHALLENGING=learned.map(item=>({
      name:item.name,
      method:
        item.writerKind==="partial_interval"
          ? "partial_interval"
          : "frequency"
    }));

    const next=CHALLENGING.findIndex(item=>item.name===selectedName);
    selectedChallengingIndex=next>=0
      ? next
      : Math.min(selectedChallengingIndex,CHALLENGING.length-1);

    populateChallengingSelect();
  }

  if(pageType==="client2replacement") {
    CLIENT2_REPLACEMENTS=learned.map(item=>item.name);
    const next=CLIENT2_REPLACEMENTS.indexOf(selectedName);
    selectedClient2ReplacementIndex=next>=0
      ? next
      : Math.min(selectedClient2ReplacementIndex,CLIENT2_REPLACEMENTS.length-1);

    populateClient2ReplacementSelect();
  }

  renderAutoProfileStatus();
  return true;
}

function liveSupportedPrograms(discovery) {
  const seen=new Set();

  return (discovery?.programs || []).filter(item=>{
    if(
      !item?.found ||
      item.writerKind==="unsupported" ||
      !String(item.name || "").trim()
    ) return false;

    const key=String(item.name).trim().toLowerCase();
    if(seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function mergeUniqueProgramNames(...groups) {
  const seen=new Set();
  const out=[];

  for(const group of groups) {
    for(const raw of (group || [])) {
      const name=String(raw?.name ?? raw ?? "").trim();
      if(!name) continue;
      const key=name.toLowerCase();
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }

  return out;
}

function mergeFullInventoryNames(names,pageType=context?.pageType,{authoritative=false}={}) {
  const incoming=[...new Set((names || []).map(name=>String(name || "").trim()).filter(Boolean))];
  if(!incoming.length || !pageType) return false;

  const previousSelected=
    pageType==="maladaptive" ? BEHAVIORS[selectedBehaviorIndex] :
    pageType==="replacement" ? REPLACEMENTS[selectedReplacementIndex] :
    pageType==="client2replacement" ? CLIENT2_REPLACEMENTS[selectedClient2ReplacementIndex] :
    pageType==="challenging" ? selectedChallengingName() : "";

  let selectId="";

  if(pageType==="maladaptive") {
    BEHAVIORS=authoritative ? [...incoming] : mergeUniqueProgramNames(BEHAVIORS,incoming);
    selectedBehaviorIndex=Math.max(0,BEHAVIORS.indexOf(previousSelected));
    populateBehaviorSelect();
    selectId="behaviorSelect";
  } else if(pageType==="replacement") {
    REPLACEMENTS=authoritative ? [...incoming] : mergeUniqueProgramNames(REPLACEMENTS,incoming);
    selectedReplacementIndex=Math.max(0,REPLACEMENTS.indexOf(previousSelected));
    populateReplacementSelect();
    selectId="replacementSelect";
  } else if(pageType==="client2replacement") {
    CLIENT2_REPLACEMENTS=authoritative ? [...incoming] : mergeUniqueProgramNames(CLIENT2_REPLACEMENTS,incoming);
    selectedClient2ReplacementIndex=Math.max(0,CLIENT2_REPLACEMENTS.indexOf(previousSelected));
    populateClient2ReplacementSelect();
    selectId="client2ReplacementSelect";
  } else if(pageType==="challenging") {
    const existingByName=new Map(CHALLENGING.map(item=>[normalizeProgramSearch(item.name),item]));

    if(authoritative) {
      CHALLENGING=incoming.map(name=>{
        const known=existingByName.get(normalizeProgramSearch(name));
        return known ? {...known,name} : {name,method:""};
      });
    } else {
      for(const name of incoming) {
        const key=normalizeProgramSearch(name);
        if(!key || existingByName.has(key)) continue;
        const item={name,method:""};
        CHALLENGING.push(item);
        existingByName.set(key,item);
      }
    }

    const next=CHALLENGING.findIndex(item=>item.name===previousSelected);
    selectedChallengingIndex=next>=0 ? next : Math.min(selectedChallengingIndex,Math.max(0,CHALLENGING.length-1));
    populateChallengingSelect();
    selectId="challengingSelect";
  }

  if(selectId) {
    const select=$(selectId);
    if(select) {
      const wrapper=select.nextElementSibling?.classList?.contains("customProgramSelect")
        ? select.nextElementSibling
        : null;
      const query=wrapper?.classList.contains("open")
        ? (wrapper.querySelector(".customSelectSearch")?.value || "")
        : "";
      rebuildCustomSelect(select);
      if(wrapper?.classList.contains("open")) {
        updateCustomSelectFilter(select,wrapper,query);
        const input=wrapper.querySelector(".customSelectSearch");
        if(input) input.value=query;
      }
    }
  }

  return true;
}

let fullInventoryWarmPromise=null;
let fullInventoryWarmCache={key:"",at:0,result:null};

const FULL_INVENTORY_MEMORY_VERSION=1;
let rememberedInventorySession=new Map();

function fullInventoryMemoryKey(
  label=context?.clientLabel,
  pageType=context?.pageType
) {
  return `rbtFullInventoryV1::${cleanClientKey(label || "client")}::${String(pageType || "page")}`;
}

function rememberedInventoryFor(
  label=context?.clientLabel,
  pageType=context?.pageType
) {
  return rememberedInventorySession.get(fullInventoryMemoryKey(label,pageType)) || null;
}

async function saveRememberedFullInventory(result,{label=context?.clientLabel,pageType=context?.pageType}={}) {
  const names=[...new Set(
    (result?.programNames || [])
      .map(name=>String(name || "").trim())
      .filter(Boolean)
  )];

  if(!names.length || !label || !pageType) return null;

  const key=fullInventoryMemoryKey(label,pageType);
  const value={
    version:FULL_INVENTORY_MEMORY_VERSION,
    clientLabel:String(label),
    pageType:String(pageType),
    programNames:names,
    authoritative:true,
    remembered:true,
    savedAt:Date.now()
  };

  rememberedInventorySession.set(key,value);
  await storageSet({[key]:value});
  return value;
}

async function loadRememberedFullInventory(
  label=context?.clientLabel,
  pageType=context?.pageType
) {
  if(!label || !pageType) return null;

  const key=fullInventoryMemoryKey(label,pageType);
  const inSession=rememberedInventorySession.get(key);
  if(inSession?.programNames?.length) return inSession;

  const saved=await storageGet([key]);
  const value=saved?.[key];
  if(
    value?.version!==FULL_INVENTORY_MEMORY_VERSION ||
    !Array.isArray(value?.programNames) ||
    !value.programNames.length
  ) return null;

  rememberedInventorySession.set(key,value);
  return value;
}

async function forgetRememberedFullInventory(
  label=context?.clientLabel,
  pageType=context?.pageType
) {
  if(!label || !pageType) return;
  const key=fullInventoryMemoryKey(label,pageType);
  rememberedInventorySession.delete(key);
  await storageRemove([key]);
}

async function seedRememberedInventoryFromLearnedProfile(
  label=context?.clientLabel,
  pageType=context?.pageType
) {
  const discovery=learnedClientProfile?.pageDiscovery?.[pageType];
  const names=(learnedClientProfile?.pages?.[pageType] || [])
    .map(item=>String(item?.name || "").trim())
    .filter(Boolean);

  if(!discovery?.complete || !names.length) return null;

  const existing=await loadRememberedFullInventory(label,pageType);
  if(existing?.programNames?.length) return existing;

  return await saveRememberedFullInventory(
    {programNames:names},
    {label,pageType}
  );
}

async function applyRememberedFullInventory(
  label=context?.clientLabel,
  pageType=context?.pageType
) {
  const remembered=await loadRememberedFullInventory(label,pageType);
  if(!remembered?.programNames?.length) return null;

  mergeFullInventoryNames(remembered.programNames,pageType,{authoritative:true});

  const statusKey=autoScanContextKey(context);
  autoScanContextStatus[statusKey]={
    ...(autoScanContextStatus[statusKey] || {}),
    complete:true,
    expectedInventory:remembered.programNames.length,
    lastScanAt:Date.now(),
    remembered:true
  };

  return remembered;
}

async function warmFullProgramInventory({force=false}={}) {
  if(fullInventoryWarmPromise) {
    if(!force) return fullInventoryWarmPromise;
    try { await fullInventoryWarmPromise; } catch(_) {}
    fullInventoryWarmPromise=null;
  }

  fullInventoryWarmPromise=(async()=>{
    if(!force) {
      const remembered=await applyRememberedFullInventory();
      if(remembered?.programNames?.length) {
        return {
          ok:true,
          authoritative:true,
          remembered:true,
          pageType:context?.pageType,
          programNames:[...remembered.programNames]
        };
      }
    }

    let tab=null;
    try {
      tab=await getMessageTargetTab();
    } catch(_) {}

    const cacheKey=`${tab?.id || ""}::${contextSignature(context)}`;
    const cached=fullInventoryWarmCache;

    if(
      !force &&
      cached.key===cacheKey &&
      cached.result?.authoritative &&
      Array.isArray(cached.result?.programNames) &&
      cached.result.programNames.length &&
      Date.now()-cached.at<45000
    ) {
      return cached.result;
    }

    let freezeImage="";
    let result=null;

    // Fast path: if Chrome can snapshot the currently visible Office Puzzle
    // viewport, scan the ACTUAL page while that frozen image masks the automated
    // bottom-scroll. This preserves the exact SPA/client state.
    if(tab?.id && tab.active) {
      try {
        const captured=await chrome.runtime.sendMessage({
          type:"CAPTURE_RBT_TAB_VIEW",
          tabId:tab.id
        });
        if(captured?.ok && captured.dataUrl) freezeImage=captured.dataUrl;
      } catch(_) {}
    }

    // Always scan the EXISTING Office Puzzle tab. Never create or open a
    // worker tab. When a frozen viewport capture is available, the user sees
    // no motion at all; otherwise the live page performs a fast real-bottom
    // sweep and snaps back to the exact original position immediately.
    try {
      result=await sendTab({
        type:"PREPARE_SILENT_FULL_SCAN",
        freezeImage,
        force:!!force
      });
    } catch(err) {
      result={ok:false,error:String(err?.message || err),programNames:[]};
    }

    if(result?.programNames?.length) {
      mergeFullInventoryNames(
        result.programNames,
        result.pageType || context?.pageType,
        {
          // Only a scanner that explicitly reached a confirmed true bottom may
          // replace the learned full list. Incomplete sweeps can add names but
          // are never allowed to shrink a previously learned inventory.
          authoritative:result.authoritative===true
        }
      );
    }

    if(result?.authoritative && result?.programNames?.length) {
      fullInventoryWarmCache={key:cacheKey,at:Date.now(),result};
      await saveRememberedFullInventory(result);
    }

    return result;
  })();

  try {
    return await fullInventoryWarmPromise;
  } finally {
    // Keep de-duping simultaneous requests but allow a later audit after the
    // current full sweep has completed.
    setTimeout(()=>{ fullInventoryWarmPromise=null; },1200);
  }
}

function applyLiveProgramLists(discovery) {
  const pageType=discovery?.pageType;
  const live=liveSupportedPrograms(discovery);
  if(!pageType || !live.length) return false;

  const previousSelected=preserveSelectedNameForPage(pageType);
  const currentName=String(context?.currentName || "").trim();
  const learned=supportedProfilePrograms(pageType,learnedClientProfile);
  const learnedComplete=Boolean(
    learnedClientProfile?.pageDiscovery?.[pageType]?.complete
  );

  const chooseIndex=(names,selected)=>{
    const preferred=
      names.includes(selected)
        ? selected
        : (
            currentName && names.includes(currentName)
              ? currentName
              : names[0]
          );
    return Math.max(0,names.indexOf(preferred));
  };

  if(pageType==="maladaptive") {
    const liveNames=live.filter(item=>item.writerKind==="count").map(item=>item.name);
    const learnedNames=learned.filter(item=>item.writerKind==="count").map(item=>item.name);
    const base=learnedComplete && learnedNames.length ? learnedNames : BEHAVIORS;
    BEHAVIORS=mergeUniqueProgramNames(base,learnedNames,liveNames);
    selectedBehaviorIndex=chooseIndex(BEHAVIORS,previousSelected);
    populateBehaviorSelect();
  }

  if(pageType==="replacement") {
    const liveNames=live.filter(item=>item.writerKind==="replacement").map(item=>item.name);
    const learnedNames=learned.filter(item=>item.writerKind==="replacement").map(item=>item.name);
    const base=learnedComplete && learnedNames.length ? learnedNames : REPLACEMENTS;
    REPLACEMENTS=mergeUniqueProgramNames(base,learnedNames,liveNames);
    selectedReplacementIndex=chooseIndex(REPLACEMENTS,previousSelected);
    populateReplacementSelect();
  }

  if(pageType==="challenging") {
    const methodByName=new Map();

    for(const item of [...CHALLENGING,...learned,...live]) {
      const name=String(item?.name || "").trim();
      if(!name) continue;
      const method=
        item?.method ||
        (item?.writerKind==="partial_interval" ? "partial_interval" : "frequency");
      methodByName.set(name,method);
    }

    const liveNames=live
      .filter(item=>item.writerKind==="count" || item.writerKind==="partial_interval")
      .map(item=>item.name);
    const learnedNames=learned
      .filter(item=>item.writerKind==="count" || item.writerKind==="partial_interval")
      .map(item=>item.name);
    const currentNames=CHALLENGING.map(item=>item.name);
    const base=learnedComplete && learnedNames.length ? learnedNames : currentNames;
    const names=mergeUniqueProgramNames(base,learnedNames,liveNames);

    CHALLENGING=names.map(name=>({
      name,
      method:methodByName.get(name) || "frequency"
    }));

    selectedChallengingIndex=Math.max(
      0,
      CHALLENGING.findIndex(item=>item.name===previousSelected)
    );
    if(selectedChallengingIndex<0) selectedChallengingIndex=0;
    populateChallengingSelect();
  }

  if(pageType==="client2replacement") {
    const liveNames=live.filter(item=>item.writerKind==="replacement").map(item=>item.name);
    const learnedNames=learned.filter(item=>item.writerKind==="replacement").map(item=>item.name);
    const base=learnedComplete && learnedNames.length ? learnedNames : CLIENT2_REPLACEMENTS;
    CLIENT2_REPLACEMENTS=mergeUniqueProgramNames(base,learnedNames,liveNames);
    selectedClient2ReplacementIndex=chooseIndex(CLIENT2_REPLACEMENTS,previousSelected);
    populateClient2ReplacementSelect();
  }

  return true;
}

function applyLiveDiscoveryMappings(discovery) {
  const programs=discovery?.programs || [];
  const pageType=discovery?.pageType;

  if(pageType==="maladaptive") {
    behaviorMappings=programs
      .filter(item=>item.writerKind==="count")
      .map(item=>({...item}));
  }

  if(pageType==="replacement") {
    replacementMappings=programs
      .filter(item=>item.writerKind==="replacement")
      .map(item=>({...item}));
  }

  if(pageType==="challenging") {
    challengingMappingsByName={};

    for(const item of programs) {
      if(item.writerKind!=="count" && item.writerKind!=="partial_interval") continue;
      challengingMappingsByName[item.name]={...item};
    }

    const name=selectedChallengingName();
    challengingMapping=
      challengingMappingsByName[name] ||
      challengingPlaceholder(name);
  }

  if(pageType==="client2replacement") {
    client2ReplacementMappingsByName={};

    for(const item of programs) {
      if(item.writerKind!=="replacement") continue;
      client2ReplacementMappingsByName[item.name]={...item};
    }

    const name=selectedClient2ReplacementName();
    client2ReplacementMapping=
      client2ReplacementMappingsByName[name] ||
      client2ReplacementPlaceholder(name);
  }
}

async function discoverAndApplyClientPrograms({
  preserveDraft=true,
  manual=false,
  force=false
}={}) {
  if(autoProfileBusy) return null;

  const now=Date.now();
  if(
    !manual &&
    !force &&
    now-autoProfileLastScanAt<AUTO_PROFILE_SCAN_MIN_MS
  ) return null;

  autoProfileBusy=true;
  autoProfileLastScanAt=now;

  try {
    const result=await sendTab({type:"DISCOVER_CLIENT_PROGRAMS"});
    if(!result?.ok) throw new Error(result?.error || "Client discovery failed.");

    context.selectedDate=result.selectedDate || context.selectedDate;
    const profile=await mergeAndSaveAutoClientProfile(result);

    applyLiveProgramLists(result);
    applyLiveDiscoveryMappings(result);
    renderAutoProfileStatus(result);

    if(Number.isFinite(Number(result.domRevision))) {
      lastSeenDomRevision=Number(result.domRevision);
    }
    await saveBootSnapshot(context,result);

    const supported=supportedProfilePrograms(result.pageType,profile);
    const liveSupported=(result.programs || []).filter(item=>
      item.writerKind!=="unsupported" &&
      item.found
    );

    const expectedInventory=Math.max(
      Number(result.inventoryExpected || 0),
      Number(result.supportedTableCount || 0),
      liveSupported.length
    );

    const pageDiscovery=profile?.pageDiscovery?.[result.pageType] || {};

    if(result.pageType==="maladaptive") {
      $("detectedCount").textContent=
        `${liveSupported.length}/${expectedInventory || "?"}`;

      $("scanSummary").textContent=
        liveSupported.length
          ? `Mapped ${liveSupported.length}/${expectedInventory || "?"} behavior programs · ` +
            `${result.supportedTableCount ?? 0} supported tables · ${result.resolvedNameCount ?? 0} names resolved.`
          : `No mapped behavior programs yet · ${result.supportedTableCount ?? 0} supported tables found.`;

      renderSelectedBehavior(preserveDraft);

      if(preserveDraft) {
        await loadBehaviorPlan({preserveInput:true});
      }
    }

    if(result.pageType==="replacement") {
      $("replacementDetectedCount").textContent=
        `${liveSupported.length}/${expectedInventory || "?"}`;

      $("replacementScanSummary").textContent=
        liveSupported.length
          ? `Mapped ${liveSupported.length}/${expectedInventory || "?"} replacement/skill programs · ` +
            `${result.supportedTableCount ?? 0} supported tables · ${result.resolvedNameCount ?? 0} names resolved.`
          : `No mapped replacement/skill programs yet · ${result.supportedTableCount ?? 0} supported tables found.`;

      renderSelectedReplacement(preserveDraft);

      if(preserveDraft) {
        await loadReplacementPlan({preserveInput:true});
      }
    }

    if(result.pageType==="challenging") {
      const name=selectedChallengingName();
      challengingMapping=
        challengingMappingsByName[name] ||
        challengingPlaceholder(name);

      $("challengingScanSummary").textContent=
        liveSupported.length
          ? `Mapped ${liveSupported.length}/${expectedInventory || "?"} behavior programs · ` +
            `${result.supportedTableCount ?? 0} supported tables · ${result.resolvedNameCount ?? 0} names resolved.`
          : `No mapped behavior programs yet · ${result.supportedTableCount ?? 0} supported tables found.`;

      await loadTodayChallengingHours();
      await renderChallengingMapping(preserveDraft);

      if(preserveDraft) {
        await loadChallengingPlan({preserveInput:true});
      }
    }

    if(result.pageType==="client2replacement") {
      const name=selectedClient2ReplacementName();
      client2ReplacementMapping=
        client2ReplacementMappingsByName[name] ||
        client2ReplacementPlaceholder(name);

      $("client2ReplacementScanSummary").textContent=
        liveSupported.length
          ? `Mapped ${liveSupported.length}/${expectedInventory || "?"} replacement/skill programs · ` +
            `${result.supportedTableCount ?? 0} supported tables · ${result.resolvedNameCount ?? 0} names resolved.`
          : `No mapped replacement/skill programs yet · ${result.supportedTableCount ?? 0} supported tables found.`;

      await renderClient2Replacement(preserveDraft);

      if(preserveDraft) {
        await loadClient2ReplacementPlan({preserveInput:true});
      }
    }

    if(manual) {
      toast(
        liveSupported.length
          ? `Learned ${liveSupported.length} supported program${liveSupported.length===1 ? "" : "s"} from this Office Puzzle page.`
          : "No supported program tables were found on this page.",
        5000
      );
    }

    autoScanContextStatus[autoScanContextKey()]={
      found:liveSupported.length,
      total:expectedInventory,
      expectedInventory,
      supportedTableCount:Number(result.supportedTableCount || 0),
      resolvedNameCount:Number(result.resolvedNameCount || 0),
      complete:Boolean(pageDiscovery.complete),
      lastScanAt:Date.now()
    };

    return result;
  } catch(err) {
    if(manual) toast(String(err?.message || err),5000);
    renderAutoProfileStatus();
    return null;
  } finally {
    autoProfileBusy=false;
    updateStickyActionBar();
  }
}



let planningActualSuppression=null;
let quickQueueMode=false;
let quickOneOffMode=false;
const oneOffSuppressedKinds=new Set();
let lastPlanActionSucceeded=false;

function friendlyDateLabel(dateISO) {
  if(!dateISO) return "the selected date";

  const date=new Date(`${dateISO}T12:00:00`);
  if(Number.isNaN(date.getTime())) return dateISO;

  return new Intl.DateTimeFormat("en-US",{
    month:"short",
    day:"numeric"
  }).format(date);
}

function actualSignatureForDate(mapping,date,methodHint="") {
  const prior=planningActualSuppression;
  planningActualSuppression=null;

  try {
    const actual=actualDataForDate(mapping,date,methodHint);

    if(!actual.hasActual) return "";

    return JSON.stringify({
      value:actual.value ?? null,
      states:Array.isArray(actual.states)
        ? actual.states
        : []
    });
  } finally {
    planningActualSuppression=prior;
  }
}

function validPlanReplacement(plan,mapping,methodHint="") {
  const date=String(plan?.replaceDate || "");
  const expected=String(plan?.replaceActualSignature || "");

  if(!date || !expected) return null;

  const current=actualSignatureForDate(
    mapping,
    date,
    methodHint
  );

  if(!current || current!==expected) return null;

  return {
    mappingName:mapping?.name || "",
    date,
    methodHint,
    signature:expected
  };
}

async function withPlanningSuppression(spec,fn) {
  const previous=planningActualSuppression;
  planningActualSuppression=spec || null;

  try {
    return await fn();
  } finally {
    planningActualSuppression=previous;
  }
}

function addReplacementMeta(plan,spec) {
  if(!spec) return plan;

  return {
    ...plan,
    replaceDate:spec.date,
    replaceActualSignature:spec.signature
  };
}

async function chooseExistingDataPlan({
  mapping,
  date,
  methodHint,
  programName
}) {
  const actual=actualDataForDate(mapping,date,methodHint);

  if(!actual.hasActual) {
    return {hasActual:false,spec:null};
  }

  // One-off workflow prepares the replacement plan silently, then the direct
  // writer asks exactly once before overwriting. Empty dates still write with
  // no confirmation.
  if(quickOneOffMode) {
    return {
      hasActual:true,
      spec:{
        mappingName:mapping?.name || "",
        date,
        methodHint,
        signature:actualSignatureForDate(mapping,date,methodHint)
      }
    };
  }

  // High-volume RBT workflow: Add + Next never interrupts the user with a
  // replacement prompt. Existing recorded data is protected and kept as-is.
  if(quickQueueMode) {
    return {hasActual:true,spec:null,keptExisting:true};
  }

  const replace=await rbtConfirm({
    title:"Existing entry found",
    message:
      `Office Puzzle already has data for ${programName} on ${friendlyDateLabel(date)}.\n\n` +
      "Would you like to keep the current entry or create a new plan to replace it?",
    confirmText:"Replace",
    cancelText:"Keep current"
  });

  if(!replace) {
    return {hasActual:true,spec:null};
  }

  return {
    hasActual:true,
    spec:{
      mappingName:mapping?.name || "",
      date,
      methodHint,
      signature:actualSignatureForDate(
        mapping,
        date,
        methodHint
      )
    }
  };
}

function actualDataForDate(mapping,date,methodHint="") {
  const method=
    methodHint ||
    mapping?.method ||
    mapping?.writerKind ||
    "";

  if(!mapping || !date) {
    return {hasActual:false,value:null,states:null};
  }

  if(
    planningActualSuppression &&
    planningActualSuppression.mappingName===mapping?.name &&
    planningActualSuppression.date===date &&
    (
      !planningActualSuppression.methodHint ||
      planningActualSuppression.methodHint===method
    )
  ) {
    return {hasActual:false,value:null,states:null};
  }

  if(
    method==="frequency" ||
    method==="count"
  ) {
    const recorded=Boolean(mapping.dailyRecorded?.[date]);
    const raw=mapping.dailyCounts?.[date];
    const value=raw==null ? null : Number(raw);

    return {
      hasActual:
        recorded ||
        (Number.isFinite(value) && value>0),
      value:Number.isFinite(value) ? value : null,
      states:null
    };
  }

  if(
    method==="partial_interval" ||
    method==="percentage_opportunities" ||
    method==="replacement"
  ) {
    const rawAverage=mapping.dailyAverages?.[date];
    const average=
      rawAverage==null
        ? null
        : Number(rawAverage);

    const states=Array.isArray(mapping.dailyStates?.[date])
      ? mapping.dailyStates[date]
      : (
          mapping.selectedDate===date &&
          Array.isArray(mapping.currentStates)
            ? mapping.currentStates
            : null
        );

    const populatedStates=
      Array.isArray(states) &&
      states.some(state=>state==="+" || state==="-");

    return {
      hasActual:
        Number.isFinite(average) ||
        populatedStates,
      value:Number.isFinite(average) ? average : null,
      states:states || null
    };
  }

  return {hasActual:false,value:null,states:null};
}

function actualFingerprintForWeek(mapping,dateForDay,methodHint="") {
  return DAYS
    .map(day=>{
      const date=dateForDay(day.key);
      const actual=actualDataForDate(mapping,date,methodHint);
      return `${day.key}:${actual.hasActual ? actual.value ?? "recorded" : ""}`;
    })
    .join("|");
}

function selectedMapping() {
  const name=BEHAVIORS[selectedBehaviorIndex];
  return behaviorMappings.find(x=>x.name===name) || {
    name,
    found:false,
    selectedDate:null,
    currentCount:null,
    maxOccurrences:null,
    tableSelector:null,
    dailyCounts:{}
  };
}

function mondayOf(date) {
  const d=new Date(date);
  const day=d.getDay();
  const diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff);
  d.setHours(0,0,0,0);
  return d;
}

function isoDate(d) {
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}

function addDaysISODate(dateISO,days) {
  const d=new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate()+Number(days||0));
  return isoDate(d);
}

function localTodayISODate() {
  return isoDate(new Date());
}

async function refreshForLocalDateRollover({force=false}={}) {
  const today=localTodayISODate();

  if(!force && lastObservedLocalDay===today) return false;

  const previousDay=lastObservedLocalDay;
  lastObservedLocalDay=today;

  try {
    let fresh=await sendTab({type:"GET_CONTEXT"});
    if(!fresh?.ok) return false;

    const available=(fresh.availableDates || []).filter(validISODate);

    // If today became writable, explicitly retarget the content script. This
    // also stamps a fresh same-day override so subsequent UI actions remain on
    // today unless the user deliberately chooses another date.
    if(available.includes(today) && fresh.selectedDate!==today) {
      const selected=await sendTab({type:"SET_SELECTED_DATE",targetDate:today});
      if(selected?.ok) {
        const reread=await sendTab({type:"GET_CONTEXT"});
        if(reread?.ok) fresh=reread;
      }
    }

    batchContextKey="";
    lastPassiveContextSignature="";
    context=fresh;
    clientKey=cleanClientKey(fresh.clientLabel);

    await refreshContext(fresh);

    // Force one CURRENT-TABLE mapping reread. This does not unlock the full
    // inventory scanner; it only refreshes writable dates/actuals/planningDates
    // so saved plans rebalance when a new date becomes available overnight.
    await refreshCurrentMappingsForSelectedTableDate(fresh.pageType);

    if(fresh.pageType==="maladaptive") {
      await loadBehaviorPlan({preserveInput:true});
    } else if(fresh.pageType==="replacement") {
      await loadReplacementPlan({preserveInput:true});
    } else if(fresh.pageType==="challenging") {
      await loadChallengingPlan({preserveInput:true});
    } else if(fresh.pageType==="client2replacement") {
      await loadClient2ReplacementPlan({preserveInput:true});
    }

    updateAllWeekNavigators();

    if(previousDay && previousDay!==today) {
      toast(`New day: ${friendlyDateLabel(today)}. Available dates refreshed.`,3200);
    }

    return true;
  } catch(_) {
    return false;
  }
}

function maxISODate(a,b) {
  if(!a) return b || null;
  if(!b) return a || null;
  return a>b ? a : b;
}

function minISODate(a,b) {
  if(!a) return b || null;
  if(!b) return a || null;
  return a<b ? a : b;
}

function formatShortDate(dateISO) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateISO||""))) return "";
  const d=new Date(`${dateISO}T12:00:00`);
  return d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
}

function refreshDateNavigationStateFromContext(r=context,{forceDates=false}={}) {
  const nextClientKey=cleanClientKey(
    r?.clientLabel || context?.clientLabel || "client"
  );
  const today=localTodayISODate();
  const sameClient=dateNavigationState.clientKey===nextClientKey;
  const datesAlreadyVerifiedForClient=
    dateNavigationState.verifiedClientKey===nextClientKey &&
    dateNavigationState.verifiedDay===today &&
    (dateNavigationState.availableDates || []).length>0;

  const freshlyReadDates=Array.isArray(r?.availableDates)
    ? [...new Set(r.availableDates)]
        .filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(String(date||"")))
        .sort()
    : [];

  // Once writable dates have been verified for THIS CLIENT today, ordinary
  // page changes (Behavior -> Replacement -> Partial Interval, etc.) are not
  // allowed to replace them. Those pages share the same availability in Office
  // Puzzle. Only a client change, midnight rollover, or explicit refresh calls
  // this function with forceDates=true.
  let dates;
  if(datesAlreadyVerifiedForClient && !forceDates) {
    dates=[...(dateNavigationState.availableDates || [])];
  } else if(freshlyReadDates.length) {
    dates=freshlyReadDates;
  } else if(sameClient) {
    // During inventory scrolling the virtualized Days row can disappear for a
    // moment. Never erase a valid same-client set because of that transient read.
    dates=[...(dateNavigationState.availableDates || [])];
  } else {
    dates=[];
  }

  const previousSelected=sameClient ? dateNavigationState.selectedDate : "";
  const dayRolledOver=Boolean(
    lastObservedLocalDay &&
    lastObservedLocalDay!==today
  );
  const todayIsAvailable=dates.includes(today);
  const requestedSelected=validISODate(r?.selectedDate) ? r.selectedDate : "";

  dateNavigationState.clientKey=nextClientKey;
  dateNavigationState.availableDates=dates;
  dateNavigationState.selectedDate=
    (dayRolledOver && todayIsAvailable ? today : "") ||
    (requestedSelected && dates.includes(requestedSelected) ? requestedSelected : "") ||
    (previousSelected && dates.includes(previousSelected) ? previousSelected : "") ||
    (todayIsAvailable ? today : "") ||
    dates[0] ||
    today;

  dateNavigationState.minDate=dates[0] || null;
  dateNavigationState.maxDate=dates[dates.length-1] || null;
  dateNavigationState.supported=dates.length>0;

  if(forceDates && freshlyReadDates.length) {
    dateNavigationState.verifiedClientKey=nextClientKey;
    dateNavigationState.verifiedDay=today;
  }

  updateAllWeekNavigators();
}

function currentPageSelectedMapping() {
  if(context?.pageType==="maladaptive") return selectedMapping();
  if(context?.pageType==="replacement") return selectedReplacementMapping();
  if(context?.pageType==="challenging") return challengingMapping;
  if(context?.pageType==="client2replacement") return client2ReplacementMapping;
  return selectedMapping();
}

function effectiveNavigatorDates() {
  const direct=(dateNavigationState.availableDates || []).filter(validISODate);
  if(direct.length) return [...new Set(direct)].sort();

  // Calendar availability should survive a transient virtualized/hidden Days
  // row. Use the selected mapping for the CURRENT page type, not a hard-coded
  // behavior mapping, so every workflow keeps its writable dates correctly.
  const mapping=currentPageSelectedMapping();
  const learned=(mapping?.planningDates || []).filter(validISODate);
  if(learned.length) return [...new Set(learned)].sort();

  const candidates=[
    ...Object.keys(mapping?.dailyCounts || {}),
    ...Object.keys(mapping?.dailyAverages || {}),
    ...Object.keys(mapping?.dailyStates || {})
  ].filter(validISODate);

  return [...new Set(candidates)].sort();
}

function dateAllowedByNavigator(dateISO) {
  if(!validISODate(dateISO)) return false;
  return effectiveNavigatorDates().includes(dateISO);
}

function selectedDateObject() {
  const raw=
    dateNavigationState.selectedDate ||
    context?.selectedDate ||
    selectedMapping()?.selectedDate ||
    localTodayISODate();
  return new Date(`${raw}T12:00:00`);
}

function weekKey() {
  const selected=isoDate(selectedDateObject());
  return planningPeriodKey(selectedMapping(),selected,dateForWeekday);
}

function planStorageKey(behaviorName) {
  return `weeklyPlan::${clientKey}::${weekKey()}::${behaviorName}`;
}

function dateForWeekday(dayKey) {
  const mon=mondayOf(selectedDateObject());
  const d=new Date(mon);
  d.setDate(mon.getDate() + (dayKey - 1));
  return isoDate(d);
}

function selectedDayKey() {
  return isoWeekdayKey(selectedDateObject());
}

function previousActualInfo() {
  const mapping=selectedMapping();
  const selected=isoDate(selectedDateObject());
  const dates=planningDatesForMapping(mapping,selected,dateForWeekday);

  let total=0;
  const perDate={};
  const actualDates=[];

  for(const date of dates) {
    const actual=actualDataForDate(mapping,date,"frequency");
    perDate[date]=actual.hasActual ? (actual.value ?? 0) : null;
    if(actual.hasActual) {
      total+=actual.value ?? 0;
      actualDates.push(date);
    }
  }

  return {
    total,
    dates,
    perDate,
    actualDates,
    actualDayKeys:actualDates.map(isoWeekdayKey),
    actualFingerprint:actualFingerprintForDates(mapping,dates,"frequency")
  };
}

function dailyFrequencyIncidentCap(mapping) {
  const cap=Math.floor(Number(mapping?.maxOccurrences));
  return Number.isFinite(cap) && cap>0 ? cap : null;
}

function allocateRemaining(totalRemaining, dayKeys, perDayCap=null) {
  totalRemaining=Number(totalRemaining);
  if(!Number.isInteger(totalRemaining)||totalRemaining<0||!dayKeys.length) return [];

  if(totalRemaining===0) return dayKeys.map(dayKey=>({dayKey,value:0}));

  const n=dayKeys.length;
  const cap=Number.isFinite(Number(perDayCap)) && Number(perDayCap)>0
    ? Math.floor(Number(perDayCap))
    : null;

  // Smooth weekly planning: planned days should stay as even as possible.
  // Randomness only decides WHICH equally-valid day receives the extra +1.
  // Existing Office Puzzle actuals are never changed; if an actual day is
  // extreme, the remaining days may need to compensate, but the planned days
  // themselves still remain maximally balanced.
  const capacities=cap
    ? Array(n).fill(cap)
    : Array(n).fill(Math.max(1,totalRemaining));
  const safeTotal=cap
    ? Math.min(totalRemaining,n*cap)
    : totalRemaining;
  const vals=allocateCappedRandom(safeTotal,capacities);

  return dayKeys.map((dayKey,i)=>({dayKey,value:vals[i]}));
}

function buildPlanFromHistory(weeklyTarget) {
  const mapping=selectedMapping();
  const selected=isoDate(selectedDateObject());
  const hist=previousActualInfo();
  const actualDates=new Set(hist.actualDates || []);
  const allocations=[];

  for(const date of hist.dates || []) {
    if(actualDates.has(date)) {
      allocations.push({
        date,
        dayKey:isoWeekdayKey(date),
        value:hist.perDate[date] ?? 0,
        source:"actual"
      });
    }
  }

  const remaining=Math.max(0,weeklyTarget-hist.total);
  const futureDates=(hist.dates || []).filter(
    date=>!actualDates.has(date)
  );
  const dailyCap=dailyFrequencyIncidentCap(mapping);
  const future=allocateRemainingDates(remaining,futureDates,dailyCap)
    .map(item=>({...item,source:"plan"}));
  const plannedFutureTotal=future.reduce((sum,item)=>sum+Number(item.value||0),0);

  return {
    planningDates:[...(hist.dates || [])],
    planningDatesSignature:planningDatesSignature(hist.dates || []),
    allocations:[...allocations,...future].sort((a,b)=>String(a.date).localeCompare(String(b.date))),
    previousActualTotal:hist.total,
    actualFingerprint:hist.actualFingerprint,
    remainingWeekly:remaining,
    dailyIncidentCap:dailyCap,
    capacityLimited:plannedFutureTotal<remaining,
    unallocatedBecauseOfCapacity:Math.max(0,remaining-plannedFutureTotal)
  };
}

function updateProgramProgress(positionId,barId,current,total) {
  const safeTotal=Math.max(1,Number(total)||1);
  const safeCurrent=Math.min(
    safeTotal,
    Math.max(1,Number(current)||1)
  );

  const count=$(positionId);
  const bar=$(barId);

  if(count) {
    const currentText=String(safeCurrent).padStart(2,"0");
    const totalText=String(safeTotal).padStart(2,"0");
    count.textContent=`${currentText} / ${totalText}`;
    count.setAttribute(
      "aria-label",
      `Program ${safeCurrent} of ${safeTotal}`
    );
  }

  if(bar) {
    const percent=(safeCurrent/safeTotal)*100;
    bar.style.width=`${Math.max(4,percent)}%`;
  }
}

function populateBehaviorSelect() {
  const select=$("behaviorSelect");
  select.innerHTML="";

  BEHAVIORS.forEach((name,index)=>{
    const option=document.createElement("option");
    option.value=String(index);
    option.textContent=`${index+1}. ${name}`;
    select.appendChild(option);
  });

  select.value=String(selectedBehaviorIndex);

  syncCustomSelect("behaviorSelect");
}

async function loadBehaviorPlan({preserveInput=false}={}) {
  const name=BEHAVIORS[selectedBehaviorIndex];
  const key=planStorageKey(name);
  const saved=await storageGet([key]);
  const plan=saved[key]||null;

  if(!preserveInput) {
    $("weeklyTarget").value=plan?.weeklyTarget ?? "";
  }

  if(plan?.weeklyTarget != null) {
    const mapping=selectedMapping();
    const suppression=validPlanReplacement(
      plan,
      mapping,
      "frequency"
    );

    let live=await withPlanningSuppression(
      suppression,
      ()=>buildPlanFromHistory(
        Number(plan.weeklyTarget)
      )
    );

    live=addReplacementMeta(live,suppression);

    if(
      String(plan.actualFingerprint || "")!==
        String(live.actualFingerprint || "") ||
      String(plan.planningDatesSignature || planningDatesSignature(plan.planningDates || []))!==
        String(live.planningDatesSignature || planningDatesSignature(live.planningDates || [])) ||
      String(plan.replaceDate || "")!==
        String(live.replaceDate || "")
    ) {
      const refreshed={
        weeklyTarget:Number(plan.weeklyTarget),
        ...live,
        updatedAt:new Date().toISOString()
      };

      await storageSet({[key]:refreshed});
      renderWeek(refreshed);
      return;
    }
  }

  renderWeek(plan);
}

function installWeekNavigators() {
  for(const hostId of [
    "weekPlan",
    "challengingWeekPlan",
    "client2ReplacementWeekPlan",
    "replacementWeekPlan"
  ]) {
    const host=$(hostId);
    if(!host || host.closest(".weekNavigatorShell")) continue;

    const shell=document.createElement("div");
    shell.className="weekNavigatorShell";
    shell.dataset.weekHost=hostId;

    const header=document.createElement("div");
    header.className="weekNavigatorHeader";

    const range=document.createElement("div");
    range.className="weekNavigatorRange";
    range.textContent="Week";

    header.append(range);

    const row=document.createElement("div");
    row.className="weekNavigatorRow";

    const prev=document.createElement("button");
    prev.type="button";
    prev.className="weekNavArrow weekNavPrev";
    prev.textContent="";
    prev.title="Previous week";
    prev.setAttribute("aria-label","Previous week");

    const viewport=document.createElement("div");
    viewport.className="weekNavigatorViewport";

    const next=document.createElement("button");
    next.type="button";
    next.className="weekNavArrow weekNavNext";
    next.textContent="";
    next.title="Next week";
    next.setAttribute("aria-label","Next week");

    host.parentNode.insertBefore(shell,host);
    viewport.appendChild(host);
    row.append(prev,viewport,next);
    shell.append(header,row);

    prev.addEventListener("click",()=>shiftSelectedWeek(-1,hostId));
    next.addEventListener("click",()=>shiftSelectedWeek(1,hostId));

    host.addEventListener("click",event=>{
      const card=event.target.closest(".weekDayCard[data-date]");
      if(!card || card.classList.contains("dateDisabled")) return;
      navigateOfficePuzzleDate(card.dataset.date,0,hostId);
    });

    host.addEventListener("keydown",event=>{
      if(
        event.key!=="Enter" &&
        event.key!==" "
      ) return;

      const card=event.target.closest(".weekDayCard[data-date]");

      if(
        !card ||
        card.classList.contains("dateDisabled")
      ) return;

      event.preventDefault();

      navigateOfficePuzzleDate(
        card.dataset.date,
        0,
        hostId
      );
    });
  }
  updateAllWeekNavigators();
}

function currentWeekHostIdForPageType(pageType=context?.pageType) {
  if(pageType==="maladaptive") return "weekPlan";
  if(pageType==="challenging") return "challengingWeekPlan";
  if(pageType==="client2replacement") return "client2ReplacementWeekPlan";
  if(pageType==="replacement") return "replacementWeekPlan";
  return null;
}

function mondayISODate(dateISO) {
  const d=new Date(`${dateISO}T12:00:00`);
  const day=d.getDay();
  const diff=day===0 ? -6 : 1-day;
  d.setDate(d.getDate()+diff);
  return isoDate(d);
}

function availableWeekdayDatesForWeek(dateISO) {
  const monday=mondayISODate(dateISO);
  const dates=[];

  for(let offset=0; offset<7; offset++) {
    const date=addDaysISODate(monday,offset);
    if(dateAllowedByNavigator(date)) dates.push(date);
  }

  return dates;
}

function targetDateForAdjacentWeek(selected,direction,hostId=null) {
  const all=effectiveNavigatorDates();
  if(!all.length) return null;

  const host=$(hostId || currentWeekHostIdForPageType());
  const shown=[...host?.querySelectorAll?.(".weekDayCard[data-date]") || []]
    .map(card=>card.dataset.date)
    .filter(validISODate)
    .sort();

  const first=shown[0] || selected;
  const last=shown[shown.length-1] || selected;

  if(Number(direction)<0) {
    const earlier=all.filter(date=>date<first);
    return earlier[earlier.length-1] || null;
  }

  return all.find(date=>date>last) || null;
}

function updateWeekNavigatorForHost(hostId) {
  const host=$(hostId);
  const shell=host?.closest(".weekNavigatorShell");
  if(!host || !shell) return;

  const cards=[...host.querySelectorAll(".weekDayCard[data-date]")];
  const selected=dateNavigationState.selectedDate || context?.selectedDate || localTodayISODate();
  const first=cards[0]?.dataset.date || "";
  const last=cards[cards.length-1]?.dataset.date || "";

  const range=shell.querySelector(".weekNavigatorRange");
  if(range) range.textContent=first&&last ? `${formatShortDate(first)} – ${formatShortDate(last)}` : "Week";

  const hasKnownDates=effectiveNavigatorDates().length>0;
  const controlsDisabled=
    !hasKnownDates ||
    autoBatchState.armed ||
    autoBatchState.busy ||
    !!batchRunningKind ||
    activeWriteUiState.busy;

  cards.forEach(card=>{
    const date=card.dataset.date;
    const allowed=dateAllowedByNavigator(date);
    const selectedCard=date===selected;

    card.classList.toggle(
      "dateDisabled",
      !allowed
    );

    card.classList.toggle(
      "selectedDateCard",
      selectedCard
    );

    card.setAttribute(
      "role",
      "button"
    );

    card.setAttribute(
      "aria-disabled",
      String(!allowed)
    );

    card.setAttribute(
      "aria-pressed",
      String(selectedCard)
    );

    card.tabIndex=
      allowed ? 0 : -1;

    card.title=
      allowed
        ? `Select ${formatShortDate(date)}`
        : `${formatShortDate(date)} is not available`;
  });

  const prev=shell.querySelector(".weekNavPrev");
  const next=shell.querySelector(".weekNavNext");

  const previousTarget=targetDateForAdjacentWeek(selected,-1,hostId);
  const nextTarget=targetDateForAdjacentWeek(selected,1,hostId);

  if(prev) {
    prev.disabled=controlsDisabled || !previousTarget;
    prev.dataset.targetDate=previousTarget || "";
  }

  if(next) {
    next.disabled=controlsDisabled || !nextTarget;
    next.dataset.targetDate=nextTarget || "";
  }
}

function updateAllWeekNavigators() {
  for(const hostId of ["weekPlan","challengingWeekPlan","client2ReplacementWeekPlan","replacementWeekPlan"]) {
    updateWeekNavigatorForHost(hostId);
  }
}

function animateWeekPlanOut(host,direction) {
  if(!host) return Promise.resolve();
  host.classList.remove("weekSlideOutLeft","weekSlideOutRight","weekSlideInLeft","weekSlideInRight");
  void host.offsetWidth;
  host.classList.add(direction>=0 ? "weekSlideOutLeft" : "weekSlideOutRight");
  return new Promise(resolve=>setTimeout(resolve,155));
}

function animateWeekPlanIn(host,direction) {
  if(!host) return;
  host.classList.remove("weekSlideOutLeft","weekSlideOutRight");
  host.classList.add(direction>=0 ? "weekSlideInRight" : "weekSlideInLeft");
  requestAnimationFrame(()=>requestAnimationFrame(()=>host.classList.remove("weekSlideInRight","weekSlideInLeft")));
}

async function waitForOfficePuzzleSelectedDate(targetDate,timeoutMs=9000) {
  const started=Date.now();
  let lastError=null;
  while(Date.now()-started<timeoutMs) {
    try {
      const r=await sendTab({type:"GET_CONTEXT"});
      if(r?.ok && r.selectedDate===targetDate) return r;
    } catch(err) {
      lastError=err;
    }
    await batchDelay(260);
  }
  throw new Error(lastError?.message || `Office Puzzle did not switch to ${targetDate}.`);
}

async function refreshCurrentMappingsForSelectedTableDate(pageType) {
  const result=await sendTab({type:"DISCOVER_CLIENT_PROGRAMS"});

  if(!result?.ok) {
    throw new Error(result?.error || "Could not re-read program tables for this date.");
  }

  context.selectedDate=result.selectedDate || context.selectedDate;
  const profile=await mergeAndSaveAutoClientProfile(result);

  applyLiveProgramLists(result);
  applyLiveDiscoveryMappings(result);

  const liveSupported=liveSupportedPrograms(result);
  const found=liveSupported.length;

  autoScanContextStatus[autoScanContextKey()]={
    found,
    total:found,
    complete:Boolean(profile?.pageDiscovery?.[pageType]?.complete)
  };

  if(pageType==="maladaptive") {
    renderSelectedBehavior(false);
  } else if(pageType==="replacement") {
    renderSelectedReplacement(false);
  } else if(pageType==="challenging") {
    await loadTodayChallengingHours();
    await renderChallengingMapping(false);
  } else if(pageType==="client2replacement") {
    await renderClient2Replacement(false);
  }
}

function retargetMappingForDate(mapping,targetDate) {
  if(!mapping || !targetDate) return mapping;
  mapping.selectedDate=targetDate;

  if(mapping.dailyCounts) {
    mapping.currentCount=Number(mapping.dailyCounts[targetDate] ?? 0);
  }

  if(mapping.dailyAverages) {
    const avg=mapping.dailyAverages[targetDate];
    mapping.currentAverage=avg==null ? null : Number(avg);
  }

  if(mapping.dailyStates) {
    const states=mapping.dailyStates[targetDate];
    const fallbackLength=Math.max(
      1,
      Number(mapping.currentStates?.length || mapping.maxIntervals || 10)
    );
    mapping.currentStates=Array.isArray(states)
      ? [...states]
      : Array(fallbackLength).fill("");
  }

  return mapping;
}

function retargetCachedMappingsForDate(pageType,targetDate) {
  if(pageType==="maladaptive") {
    behaviorMappings.forEach(mapping=>retargetMappingForDate(mapping,targetDate));
    return;
  }

  if(pageType==="replacement") {
    replacementMappings.forEach(mapping=>retargetMappingForDate(mapping,targetDate));
    return;
  }

  if(pageType==="challenging") {
    Object.values(challengingMappingsByName).forEach(mapping=>retargetMappingForDate(mapping,targetDate));
    challengingMapping=retargetMappingForDate(
      challengingMappingsByName[selectedChallengingName()] || challengingMapping,
      targetDate
    );
    return;
  }

  if(pageType==="client2replacement") {
    Object.values(client2ReplacementMappingsByName).forEach(mapping=>retargetMappingForDate(mapping,targetDate));
    client2ReplacementMapping=retargetMappingForDate(
      client2ReplacementMappingsByName[selectedClient2ReplacementName()] || client2ReplacementMapping,
      targetDate
    );
  }
}

function normalizedPlanPreviewValue(value) {
  const raw=String(value ?? "").trim();
  if(!raw || raw==="—") return null;
  const numeric=Number(raw.replace(/%$/,""));
  return Number.isFinite(numeric) ? numeric : raw;
}

function renderPlanChangePreview(hostId,date,currentValue,nextValue) {
  const host=$(hostId);
  if(!host) return;

  const current=normalizedPlanPreviewValue(currentValue);
  const next=normalizedPlanPreviewValue(nextValue);
  const same=
    current==null || next==null ||
    (typeof current==="number" && typeof next==="number"
      ? Math.abs(current-next)<1e-9
      : String(current)===String(next));

  if(!validISODate(date) || same) {
    host.hidden=true;
    host.replaceChildren();
    return;
  }

  const dateLabel=document.createElement("div");
  dateLabel.className="planChangeDate";
  dateLabel.textContent=`${weekdayLabelForDate(date)} ${new Date(`${date}T12:00:00`).getDate()}`;

  const values=document.createElement("div");
  values.className="planChangeValues";

  const from=document.createElement("span");
  from.textContent=String(currentValue);

  const arrow=document.createElement("span");
  arrow.className="planChangeArrow";
  arrow.setAttribute("aria-hidden","true");
  arrow.textContent="→";

  const to=document.createElement("strong");
  to.textContent=String(nextValue);

  values.append(from,arrow,to);
  host.replaceChildren(dateLabel,values);
  host.hidden=false;
}

function hidePlanChangePreview(hostId) {
  const host=$(hostId);
  if(!host) return;
  host.hidden=true;
  host.replaceChildren();
}

function updateSelectedDayPlanFromVisibleCard(targetDate) {
  const host=$(currentWeekHostIdForPageType());
  if(!host) return;

  const cards=[...host.querySelectorAll(".weekDayCard[data-date]")];
  for(const card of cards) {
    const selected=card.dataset.date===targetDate;
    card.classList.toggle("today",selected);
    card.classList.toggle("selectedDateCard",selected);
    card.setAttribute("aria-current",selected ? "date" : "false");
  }

  const card=cards.find(item=>item.dataset.date===targetDate);
  if(!card) return;

  const value=String(card.querySelector(".num")?.textContent || "—").trim();

  if(context?.pageType==="maladaptive") {
    const actual=actualDataForDate(selectedMapping(),targetDate,"frequency");
    renderPlanChangePreview(
      "behaviorChangePreview",
      targetDate,
      actual.hasActual ? String(actual.value ?? 0) : null,
      value
    );
  } else if(context?.pageType==="replacement") {
    const actual=actualDataForDate(selectedReplacementMapping(),targetDate,"percentage_opportunities");
    renderPlanChangePreview(
      "replacementChangePreview",
      targetDate,
      actual.hasActual ? `${Math.round(Number(actual.value ?? 0))}%` : null,
      value
    );
  } else if(context?.pageType==="challenging") {
    const actual=actualDataForDate(challengingMapping,targetDate,challengingMapping?.method || "");
    const formattedCurrent=actual.hasActual
      ? (challengingMapping?.method==="frequency"
          ? String(actual.value ?? 0)
          : `${Math.round(Number(actual.value ?? 0))}%`)
      : null;
    renderPlanChangePreview(
      "challengingChangePreview",
      targetDate,
      formattedCurrent,
      value
    );
  } else if(context?.pageType==="client2replacement") {
    const actual=actualDataForDate(client2ReplacementMapping,targetDate,"percentage_opportunities");
    renderPlanChangePreview(
      "client2ReplacementChangePreview",
      targetDate,
      actual.hasActual ? `${Math.round(Number(actual.value ?? 0))}%` : null,
      value
    );
  }
}

async function applyOptimisticDateSelection(targetDate) {
  const previousDate=
    dateNavigationState.selectedDate ||
    context?.selectedDate ||
    localTodayISODate();
  const changedWeek=
    mondayISODate(previousDate)!==mondayISODate(targetDate);

  context.selectedDate=targetDate;
  dateNavigationState.selectedDate=targetDate;
  retargetCachedMappingsForDate(context?.pageType,targetDate);

  // When a calendar pick crosses into another week, rebuild only the small
  // seven-day plan strip from cached Office Puzzle data. No full discovery is
  // needed, and the exact selected date remains authoritative.
  if(changedWeek) {
    if(context?.pageType==="maladaptive") {
      renderSelectedBehavior(true);
      await loadBehaviorPlan({preserveInput:true});
    } else if(context?.pageType==="replacement") {
      renderSelectedReplacement(true);
      await loadReplacementPlan({preserveInput:true});
    } else if(context?.pageType==="challenging") {
      await loadTodayChallengingHours();
      await renderChallengingMapping(true);
      await loadChallengingPlan({preserveInput:true});
    } else if(context?.pageType==="client2replacement") {
      await renderClient2Replacement(true);
      await loadClient2ReplacementPlan({preserveInput:true});
    }
  } else {
    updateSelectedDayPlanFromVisibleCard(targetDate);

    if(context?.pageType==="maladaptive") {
      renderSelectedBehavior(true);
    } else if(context?.pageType==="replacement") {
      renderSelectedReplacement(true);
    } else if(context?.pageType==="challenging") {
      await loadTodayChallengingHours();
      await renderChallengingMapping(true);
    } else if(context?.pageType==="client2replacement") {
      await renderClient2Replacement(true);
    }
  }

  updateAllWeekNavigators();

  // Prevent the passive heartbeat from treating a local day-column choice as
  // a whole-page navigation that needs a visible rebuild.
  lastPassiveContextSignature=contextSignature(context);
}

async function navigateOfficePuzzleDate(targetDate,direction=0,hostId=null) {
  const directRequest=Number(direction)===0;

  if(dateNavigationState.busy && !directRequest) return;

  if(
    autoBatchState.armed ||
    autoBatchState.busy ||
    batchRunningKind ||
    activeWriteUiState.busy
  ) {
    toast("Finish or stop the current task before changing the date.",5000);
    return;
  }

  if(!(dateNavigationState.availableDates || []).length) {
    toast("No Office Puzzle dates are available yet.",5000);
    return;
  }

  if(!dateAllowedByNavigator(targetDate)) {
    toast("That date is not available in the visible Office Puzzle table.",5000);
    return;
  }

  const active=await getActiveTab();
  if(!active?.id || !isOfficePuzzleUrl(active.url)) {
    toast("Open the Office Puzzle tab before changing dates.",5000);
    return;
  }

  const current=dateNavigationState.selectedDate || context?.selectedDate || localTodayISODate();
  if(targetDate===current) return;

  const directDaySelection=directRequest;
  // Calendar/day picks update instantly without slide-out choreography. The
  // arrows may still animate when intentionally moving week-to-week.
  const weekTransition=
    !directRequest &&
    mondayISODate(targetDate)!==mondayISODate(current);
  const inferredDirection=direction || (targetDate>current ? 1 : -1);
  const effectiveHost=$(hostId || currentWeekHostIdForPageType());
  const originalSelectedDate=dateNavigationState.selectedDate;
  const requestSerial=++dateSelectionRequestSerial;

  dateNavigationTabId=active.id;
  dateNavigationState.busy=true;

  // Same-week day changes are extension-side column retargets, not page
  // navigation. Update the UI immediately and do not rebuild the calendar.
  if(directDaySelection) {
    await applyOptimisticDateSelection(targetDate);
  } else {
    updateAllWeekNavigators();
  }

  try {
    if(weekTransition) await animateWeekPlanOut(effectiveHost,inferredDirection);

    const result=await sendTab({type:"SET_SELECTED_DATE",targetDate});
    if(!result?.ok) {
      throw new Error(result?.error || "Could not select that Office Puzzle date.");
    }

    if(requestSerial!==dateSelectionRequestSerial) return;

    if(directDaySelection) {
      // If this exact date belongs to a different Office Puzzle planning group,
      // refresh only the current table mappings so the horizontal strip and
      // randomizer inherit that group's real writable dates. Same-period taps
      // remain purely optimistic/instant.
      const currentMapping=(
        context?.pageType==="maladaptive" ? selectedMapping() :
        context?.pageType==="replacement" ? selectedReplacementMapping() :
        context?.pageType==="challenging" ? challengingMapping :
        context?.pageType==="client2replacement" ? client2ReplacementMapping : null
      );

      if(!mappingKnowsPlanningPeriod(currentMapping,targetDate)) {
        await refreshCurrentMappingsForSelectedTableDate(context?.pageType);
      }

      batchContextKey="";
      await loadBatchesForContext();
      lastPassiveContextSignature=contextSignature(context);
      updateAllWeekNavigators();
      return;
    }

    const freshContext=await sendTab({type:"GET_CONTEXT"});
    if(!freshContext?.ok || freshContext.selectedDate!==targetDate) {
      throw new Error("The assistant could not verify the selected Office Puzzle date.");
    }

    batchContextKey="";
    lastPassiveContextSignature="";
    autoScanContextStatus={};
    context=freshContext;
    clientKey=cleanClientKey(freshContext.clientLabel);
    refreshDateNavigationStateFromContext(freshContext);
    await loadBatchesForContext();
    await refreshCurrentMappingsForSelectedTableDate(freshContext.pageType);

    animateWeekPlanIn(
      $(hostId || currentWeekHostIdForPageType(freshContext.pageType)),
      inferredDirection
    );
  } catch(err) {
    if(requestSerial!==dateSelectionRequestSerial) return;

    dateNavigationState.selectedDate=originalSelectedDate || current;
    context.selectedDate=originalSelectedDate || current;
    retargetCachedMappingsForDate(context?.pageType,context.selectedDate);
    updateSelectedDayPlanFromVisibleCard(context.selectedDate);

    effectiveHost?.classList.remove(
      "weekSlideOutLeft","weekSlideOutRight","weekSlideInLeft","weekSlideInRight"
    );

    toast(String(err?.message || err),6000);
  } finally {
    if(requestSerial===dateSelectionRequestSerial) {
      dateNavigationState.busy=false;
      dateNavigationTabId=null;
      updateAllWeekNavigators();
    }
  }
}

function shiftSelectedWeek(direction,hostId=null) {
  const selected=
    dateNavigationState.selectedDate ||
    context?.selectedDate ||
    localTodayISODate();

  const target=targetDateForAdjacentWeek(selected,direction,hostId);

  if(!target) {
    toast("No available Office Puzzle table dates in that week.");
    return;
  }

  // Adjacent-week arrows use the same instant column-retarget path as direct
  // day taps. Office Puzzle already renders the month table, so a week arrow
  // should never trigger a discovery/context refresh or slide-out animation.
  navigateOfficePuzzleDate(target,0,hostId);
}

function renderWeek(plan) {
  const host=$("weekPlan");
  host.innerHTML="";

  const mapping=selectedMapping();
  const hist=previousActualInfo();
  const dayKey=selectedDayKey();
  const allocations=plan?.allocations || [];

  $("previousActualTotal").textContent=
    plan?.previousActualTotal ?? hist.total;

  $("remainingWeekly").textContent=
    plan?.remainingWeekly ?? "—";

  const selectedDate=isoDate(selectedDateObject());
  const stripDates=visiblePlanningDates(mapping,selectedDate,dateForWeekday,plan);
  configurePlanningDateStrip(host,stripDates);

  stripDates.forEach(date=>{
    const entry=allocationForDate(allocations,date);
    const actual=actualDataForDate(
      mapping,
      date,
      "frequency"
    );
    const replacing=plan?.replaceDate===date;

    const card=document.createElement("div");
    card.className=
      "weekDayCard"+(date===selectedDate?" today":"");
    card.dataset.date=date;

    const value=
      replacing && entry
        ? entry.value
        : actual.hasActual
          ? (actual.value ?? 0)
          : (entry?.value ?? "—");

    card.innerHTML=`
      <div class="day">${weekdayLabelForDate(date)}<span class="dayDate">${new Date(`${date}T12:00:00`).getDate()}</span></div>
      <div class="num">${value}</div>
    `;
    host.appendChild(card);
  });

  updateWeekNavigatorForHost("weekPlan");

  const date=isoDate(selectedDateObject());
  const entry=allocationForDate(allocations,date);
  const actual=actualDataForDate(
    mapping,
    date,
    "frequency"
  );

  $("todayPlanned").textContent=
    plan?.replaceDate===date && entry
      ? entry.value
      : actual.hasActual
        ? "—"
        : (entry?.value ?? "—");

  renderPlanChangePreview(
    "behaviorChangePreview",
    date,
    plan?.replaceDate===date && actual.hasActual ? String(actual.value ?? 0) : null,
    plan?.replaceDate===date && entry ? String(entry.value) : null
  );
}

async function saveGeneratedPlan() {
  lastPlanActionSucceeded=false;
  const raw=$("weeklyTarget").value;
  const target=Number(raw);

  if(raw==="") {
    validationError(
      "Enter a weekly target to continue.",
      "weeklyTarget"
    );
    return;
  }

  if(!Number.isInteger(target)||target<0) {
    validationError(
      "Enter a whole number of 0 or more.",
      "weeklyTarget"
    );
    return;
  }

  const date=isoDate(selectedDateObject());
  let mapping=await refreshPlanningPeriodIfNeeded(selectedMapping,date);

  if(!mapping?.found) {
    validationError(
      "This behavior is still loading from Office Puzzle. Try again in a moment."
    );
    return;
  }

  if(!selectedDateIsPlannable(mapping,date,dateForWeekday)) {
    validationError(unavailablePlanningDateMessage(date));
    return;
  }

  const choice=await chooseExistingDataPlan({
    mapping,
    date,
    methodHint:"frequency",
    programName:mapping.name
  });

  let built=await withPlanningSuppression(
    choice.spec,
    ()=>buildPlanFromHistory(target)
  );

  let plan={
    weeklyTarget:target,
    ...built,
    updatedAt:new Date().toISOString()
  };

  plan=addReplacementMeta(plan,choice.spec);

  await storageSet({
    [planStorageKey(mapping.name)]:plan
  });

  renderWeek(plan);

  if(!quickQueueMode) {
  if(plan.capacityLimited) {
    toast(
      `Plan capped safely at ${plan.dailyIncidentCap} incidents per day because that is the Office Puzzle row limit.`,
      5600
    );
  } else if(choice.spec) {
    toast(
      `Replacement plan ready for ${friendlyDateLabel(date)}. Nothing changes in Office Puzzle until you Apply or Run.`,
      5200
    );
  } else if(choice.hasActual) {
    toast(
      `Kept the current entry for ${friendlyDateLabel(date)} and planned the remaining days.`,
      4700
    );
  } else {
    toast("Plan ready.");
  }

    }

lastPlanActionSucceeded=true;
}

function renderSelectedBehavior(preserveDraft=false) {
  const name=BEHAVIORS[selectedBehaviorIndex];
  const mapping=selectedMapping();

  $("behaviorName").textContent=name;
  updateProgramProgress(
    "behaviorPosition",
    "behaviorPositionBar",
    selectedBehaviorIndex+1,
    BEHAVIORS.length
  );
  $("behaviorSelect").value=String(selectedBehaviorIndex);
  syncCustomSelect("behaviorSelect");
  $("selectedDate").textContent=
    dateNavigationState.selectedDate || context?.selectedDate || mapping.selectedDate || "—";

  if(mapping.found) {
$("behaviorStatus").textContent=
      `Current-day column found · Existing count: ${mapping.currentCount ?? 0} · Grid max: ${mapping.maxOccurrences ?? "—"}`;
    $("behaviorStatus").style.background="#eaf8f2";
    $("behaviorStatus").style.color="#126849";

    $("applyCount").disabled=false;
  } else {
$("behaviorStatus").textContent=
      `Could not map the ${name} graph/table on the current page.`;
    $("behaviorStatus").style.background="#fff0f0";
    $("behaviorStatus").style.color="#8b3434";

    $("applyCount").disabled=true;
  }

  if(!preserveDraft) {
    loadBehaviorPlan();
  }
}

function selectBehavior(index) {
  selectedBehaviorIndex=(index+BEHAVIORS.length)%BEHAVIORS.length;
  renderSelectedBehavior();
}

let scanInProgress=false;
let lastScanAt=0;

async function scanAllBehaviors() {
  if(scanInProgress) {
    toast("A scan is already running.");
    return;
  }

  scanInProgress=true;

  try {
    if($("rescanAll")) $("rescanAll").disabled=true;
    $("scanSummary").textContent="Discovering this client's behavior programs…";
    await discoverAndApplyClientPrograms({preserveDraft:true,manual:true});
  } finally {
    scanInProgress=false;
    if($("rescanAll")) $("rescanAll").disabled=false;
  }
}


let rbtConfirmResolver=null;
let rbtConfirmKeepOpenOnConfirm=false;
let rbtActionMode=false;
let rbtActionBusy=false;
let rbtActionStopRequested=false;
let rbtActionRetryHandler=null;
let rbtActionNeedsTruthRefresh=false;

function closeRbtConfirm(result=false) {
  const backdrop=$("rbtConfirmModal");

  const keepOpen=
    Boolean(
      result &&
      rbtConfirmKeepOpenOnConfirm
    );

  const resolver=rbtConfirmResolver;

  rbtConfirmResolver=null;
  rbtConfirmKeepOpenOnConfirm=false;

  if(resolver) {
    resolver(!!result);
  }

  if(keepOpen) {
    return;
  }

  if(backdrop) {
    backdrop.hidden=true;
  }

  resetRbtActionModal();

  restoreFocus(
    rbtConfirmReturnFocus
  );

  rbtConfirmReturnFocus=null;
}


function resetRbtActionModal() {
  const panel=$("rbtConfirmModal")?.querySelector(".rbtModal");
  const eyebrow=$("rbtModalEyebrow");
  const indicator=$("rbtActionIndicator");
  const okBtn=$("rbtConfirmOk");
  const cancelBtn=$("rbtConfirmCancel");
  const actions=panel?.querySelector(".rbtModalActions");

  rbtActionMode=false;
  rbtActionBusy=false;
  rbtActionStopRequested=false;
  rbtActionRetryHandler=null;
  rbtActionNeedsTruthRefresh=false;

  panel?.classList.remove(
    "actionBusy",
    "actionSuccess",
    "actionError",
    "actionStopped"
  );

  panel?.removeAttribute("aria-busy");

  if(eyebrow) eyebrow.textContent="CONFIRM";

  if(indicator) {
    indicator.hidden=true;
    indicator.textContent="";
    indicator.className="rbtActionIndicator";
  }

  if(actions) actions.hidden=false;

  if(cancelBtn) {
    cancelBtn.hidden=false;
    cancelBtn.disabled=false;
    cancelBtn.textContent="Cancel";
    cancelBtn.classList.remove("dangerSoft");
  }

  if(okBtn) {
    okBtn.hidden=false;
    okBtn.disabled=false;
    okBtn.textContent="Continue";
  }
}

function showRbtActionProgress({
  title="Applying plan…",
  message=""
}={}) {
  const backdrop=$("rbtConfirmModal");
  const panel=backdrop?.querySelector(".rbtModal");
  const eyebrow=$("rbtModalEyebrow");
  const indicator=$("rbtActionIndicator");
  const titleEl=$("rbtConfirmTitle");
  const messageEl=$("rbtConfirmMessage");
  const okBtn=$("rbtConfirmOk");
  const cancelBtn=$("rbtConfirmCancel");
  const actions=panel?.querySelector(".rbtModalActions");

  if(!backdrop || !panel || !titleEl || !messageEl) return;

  rbtActionMode=true;
  rbtActionBusy=true;
  rbtActionStopRequested=false;
  rbtActionNeedsTruthRefresh=false;

  backdrop.hidden=false;

  panel.classList.remove(
    "actionSuccess",
    "actionError",
    "actionStopped"
  );
  panel.classList.add("actionBusy");
  panel.setAttribute("aria-busy","true");

  if(eyebrow) eyebrow.textContent="APPLYING";

  if(indicator) {
    indicator.hidden=false;
    indicator.textContent="•";
    indicator.className="rbtActionIndicator loading";
  }

  titleEl.textContent=title;
  messageEl.textContent=message;

  if(actions) actions.hidden=false;

  // During Apply, the secondary button becomes a real Stop control.
  if(cancelBtn) {
    cancelBtn.hidden=false;
    cancelBtn.disabled=false;
    cancelBtn.textContent="Stop";
    cancelBtn.classList.add("dangerSoft");
  }

  if(okBtn) {
    okBtn.hidden=true;
    okBtn.disabled=true;
  }

  setTimeout(()=>cancelBtn?.focus(),0);
}


async function requestRbtActionStop() {
  if(!rbtActionMode || !rbtActionBusy || rbtActionStopRequested) return;

  rbtActionStopRequested=true;

  const eyebrow=$("rbtModalEyebrow");
  const titleEl=$("rbtConfirmTitle");
  const messageEl=$("rbtConfirmMessage");
  const stopBtn=$("rbtConfirmCancel");

  if(eyebrow) eyebrow.textContent="STOPPING";
  if(titleEl) titleEl.textContent="Stopping…";
  if(messageEl) {
    messageEl.textContent=
      "The current click may finish, but no additional Office Puzzle data clicks will be sent.";
  }

  if(stopBtn) {
    stopBtn.disabled=true;
    stopBtn.textContent="Stopping…";
  }

  if(
    activeWriteUiState.busy &&
    Number.isInteger(activeWriteUiState.tabId)
  ) {
    try {
      await sendMessageToTab(
        activeWriteUiState.tabId,
        {type:"ABORT_ACTIVE_WRITE"}
      );
    } catch(err) {
      showRbtActionResult({
        success:false,
        title:"Couldn’t stop cleanly",
        message:String(err?.message || err)
      });
    }
  }
}

function showRbtApplyProblem(result,fallbackMessage,{retry=null}={}) {
  if(result?.aborted || result?.cancelled) {
    showRbtActionResult({
      stopped:true,
      title:"Stopped",
      message:
        "Apply was stopped. The current click may have finished, but no additional data clicks were sent."
    });
    return;
  }

  showRbtActionResult({
    success:false,
    title:"Couldn’t apply plan",
    message:
      result?.error ||
      fallbackMessage ||
      "Office Puzzle could not verify the planned entry.",
    retry
  });
}

function showRbtActionResult({
  success=true,
  stopped=false,
  title,
  message="",
  retry=null
}={}) {
  const backdrop=$("rbtConfirmModal");
  const panel=backdrop?.querySelector(".rbtModal");
  const eyebrow=$("rbtModalEyebrow");
  const indicator=$("rbtActionIndicator");
  const titleEl=$("rbtConfirmTitle");
  const messageEl=$("rbtConfirmMessage");
  const okBtn=$("rbtConfirmOk");
  const cancelBtn=$("rbtConfirmCancel");
  const actions=panel?.querySelector(".rbtModalActions");

  if(!backdrop || !panel || !titleEl || !messageEl || !okBtn) return;

  rbtActionMode=true;
  rbtActionBusy=false;
  rbtActionStopRequested=false;
  rbtActionNeedsTruthRefresh=!success || stopped;
  rbtActionRetryHandler=
    !success && !stopped && typeof retry==="function"
      ? retry
      : null;

  backdrop.hidden=false;

  panel.classList.remove(
    "actionBusy",
    "actionSuccess",
    "actionError",
    "actionStopped"
  );

  panel.classList.add(
    stopped
      ? "actionStopped"
      : success
        ? "actionSuccess"
        : "actionError"
  );

  panel.removeAttribute("aria-busy");

  if(eyebrow) {
    eyebrow.textContent=
      stopped
        ? "STOPPED"
        : success
          ? "SUCCESS"
          : "NEEDS ATTENTION";
  }

  if(indicator) {
    indicator.hidden=false;
    indicator.textContent=stopped ? "■" : success ? "✓" : "!";
    indicator.className=
      `rbtActionIndicator ${stopped ? "stopped" : success ? "success" : "error"}`;
  }

  titleEl.textContent=
    title ||
    (stopped ? "Stopped" : success ? "Applied successfully" : "Couldn’t apply plan");

  messageEl.textContent=message;

  if(actions) actions.hidden=false;

  if(cancelBtn) {
    cancelBtn.hidden=!rbtActionRetryHandler;
    cancelBtn.disabled=false;
    cancelBtn.textContent=rbtActionRetryHandler ? "Done" : "Cancel";
    cancelBtn.classList.remove("dangerSoft");
  }

  okBtn.hidden=false;
  okBtn.disabled=false;
  okBtn.textContent=rbtActionRetryHandler ? "Retry" : "Done";

  setTimeout(()=>okBtn.focus(),0);
}

function closeRbtActionStatus() {
  if(rbtActionBusy) return;

  const backdrop=$("rbtConfirmModal");
  const needsTruthRefresh=rbtActionNeedsTruthRefresh;

  if(backdrop) {
    backdrop.hidden=true;
  }

  resetRbtActionModal();
  rbtActionNeedsTruthRefresh=false;

  restoreFocus(
    rbtConfirmReturnFocus
  );

  rbtConfirmReturnFocus=null;

  // If a write stopped/failed, reconcile once more when the status closes.
  // This catches manual Office Puzzle corrections made while the dialog was
  // open even if the page framework did not emit a useful mutation signal.
  if(needsTruthRefresh) scheduleLiveTruthSync({force:true});
}

function applyActionStatusMessage(
  programName,
  selectedDate
) {
  const dateText=
    friendlyDateLabel(selectedDate);

  return programName
    ? `${programName} • ${dateText}`
    : dateText;
}

function rbtConfirm({
  title="Confirm action",
  message="",
  confirmText="Continue",
  cancelText="Cancel",
  keepOpenOnConfirm=false
}={}) {
  if(rbtConfirmResolver) {
    return Promise.resolve(false);
  }

  const backdrop=$("rbtConfirmModal");
  const panel=backdrop?.querySelector(".rbtModal");
  const eyebrow=$("rbtModalEyebrow");
  const indicator=$("rbtActionIndicator");
  const titleEl=$("rbtConfirmTitle");
  const messageEl=$("rbtConfirmMessage");
  const okBtn=$("rbtConfirmOk");
  const cancelBtn=$("rbtConfirmCancel");
  const actions=panel?.querySelector(".rbtModalActions");

  if(
    !backdrop ||
    !panel ||
    !titleEl ||
    !messageEl ||
    !okBtn ||
    !cancelBtn
  ) {
    return Promise.resolve(false);
  }

  // Preserve the original Apply button as the final return-focus target,
  // even if this dialog temporarily switches back from progress to another
  // confirmation state.
  if(!rbtConfirmReturnFocus) {
    rbtConfirmReturnFocus=
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }

  rbtActionMode=false;
  rbtActionBusy=false;
  rbtActionStopRequested=false;
  rbtConfirmKeepOpenOnConfirm=
    Boolean(keepOpenOnConfirm);

  panel.classList.remove(
    "actionBusy",
    "actionSuccess",
    "actionError"
  );
  panel.removeAttribute("aria-busy");

  if(eyebrow) {
    eyebrow.textContent="CONFIRM";
  }

  if(indicator) {
    indicator.hidden=true;
    indicator.textContent="";
    indicator.className="rbtActionIndicator";
  }

  if(actions) {
    actions.hidden=false;
  }

  titleEl.textContent=title;
  messageEl.textContent=message;

  cancelBtn.hidden=false;
  cancelBtn.disabled=false;
  cancelBtn.textContent=cancelText;

  okBtn.hidden=false;
  okBtn.disabled=false;
  okBtn.textContent=confirmText;

  backdrop.hidden=false;

  setTimeout(()=>{
    okBtn.focus();
  },0);

  return new Promise(resolve=>{
    rbtConfirmResolver=resolve;
  });
}

async function selectedBehaviorPlannedCount() {
  const mapping=selectedMapping();

  if(!mapping?.found) {
    return {
      ok:false,
      error:
        "This behavior is still loading from Office Puzzle. Try again in a moment."
    };
  }

  const date=isoDate(selectedDateObject());
  const key=planStorageKey(mapping.name);
  const saved=await storageGet([key]);
  const plan=saved[key] || null;

  const actual=actualDataForDate(
    mapping,
    date,
    "frequency"
  );

  const replacingExisting=
    actual.hasActual &&
    plan?.replaceDate===date &&
    Boolean(validPlanReplacement(
      plan,
      mapping,
      "frequency"
    ));

  if(actual.hasActual && !replacingExisting) {
    return {
      ok:false,
      error:
        "This date already has Office Puzzle data, so it is protected from duplicate entry."
    };
  }

  const entry=allocationForDate(plan?.allocations,date);
  if(entry?.source==="actual") {
    return {ok:false,error:"This date already has Office Puzzle data, so it is protected from duplicate entry."};
  }
  const target=Number(entry?.value);

  if(!Number.isInteger(target)||target<0) {
    return {
      ok:false,
      error:
        "No plan for this day yet. Press Add + Next to create one."
    };
  }

  const dailyCap=dailyFrequencyIncidentCap(mapping);
  if(dailyCap && target>dailyCap) {
    return {
      ok:false,
      error:`This day is planned for ${target}, but Office Puzzle only exposes ${dailyCap} incident rows. Press Add + Next to rebalance it safely.`
    };
  }

  return {
    ok:true,
    target,
    mapping,
    selectedDate:date,
    replacingExisting
  };
}

async function selectedChallengingPlannedCount() {
  const mapping=challengingMapping;

  if(!mapping?.found || mapping.method!=="frequency") {
    return {
      ok:false,
      error:
        "Scroll until this Frequency behavior is loaded in Office Puzzle, then try again."
    };
  }

  const date=challengingSelectedDate();

  const key=challengingPlanKey(mapping.name);
  const saved=await storageGet([key]);
  const plan=saved[key] || null;

  const actual=actualDataForDate(
    mapping,
    date,
    "frequency"
  );

  const replacingExisting=
    actual.hasActual &&
    plan?.replaceDate===date &&
    Boolean(validPlanReplacement(
      plan,
      mapping,
      "frequency"
    ));

  if(actual.hasActual && !replacingExisting) {
    return {
      ok:false,
      error:
        "This date already has Office Puzzle data, so it is protected from duplicate entry."
    };
  }

  const entry=allocationForDate(plan?.allocations,date);
  if(entry?.source==="actual") {
    return {ok:false,error:"This date already has Office Puzzle data, so it is protected from duplicate entry."};
  }
  const target=Number(entry?.value);

  if(!Number.isInteger(target)||target<0) {
    return {
      ok:false,
      error:
        "No plan for this day yet. Press Add + Next to create one."
    };
  }

  const dailyCap=dailyFrequencyIncidentCap(mapping);
  if(dailyCap && target>dailyCap) {
    return {
      ok:false,
      error:`This day is planned for ${target}, but Office Puzzle only exposes ${dailyCap} incident rows. Press Add + Next to rebalance it safely.`
    };
  }

  return {
    ok:true,
    target,
    mapping,
    selectedDate:date,
    replacingExisting
  };
}

async function confirmOneOffOverwrite({replacingExisting,name,selectedDate}) {
  // One-off entries should be genuinely quick. Writing into an empty date goes
  // immediately; only an overwrite interrupts the RBT for confirmation.
  if(!replacingExisting) return true;

  return await rbtConfirm({
    title:"Replace existing entry?",
    message:`Office Puzzle already has data for ${name} on ${friendlyDateLabel(selectedDate)}. Replace it with the new entry?`,
    confirmText:"Replace",
    keepOpenOnConfirm:true
  });
}

async function applyCount() {
  const planned=await selectedBehaviorPlannedCount();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  const {
    mapping,
    target,
    selectedDate,
    replacingExisting
  }=planned;

  const proceed=await confirmOneOffOverwrite({
    replacingExisting,
    name:mapping.name,
    selectedDate
  });

  if(!proceed) return;

  showRbtActionProgress({
    title:
      replacingExisting
        ? "Replacing…"
        : "Writing…",
    message:
      applyActionStatusMessage(
        mapping.name,
        selectedDate
      )
  });

  let writeToken=await armOneWrite();

  let result=await sendTab({
    type:"SET_BEHAVIOR_COUNT",
    mapping,
    target,
    replaceExisting:
      Boolean(replacingExisting),
    writeToken
  });

  if(result?.requiresReplace) {
    const ok=await rbtConfirm({
      title:"Entry changed",
      message:
        "Office Puzzle now has different data for this date. Replace the current entry with the plan?",
      confirmText:"Confirm",
      keepOpenOnConfirm:true
    });

    if(!ok) return;

    showRbtActionProgress({
      title:"Replacing entry…",
      message:
        applyActionStatusMessage(
          mapping.name,
          selectedDate
        )
    });

    writeToken=await armOneWrite();

    result=await sendTab({
      type:"SET_BEHAVIOR_COUNT",
      mapping,
      target,
      replaceExisting:true,
      writeToken
    });
  }

  if(!result?.ok) {
    showRbtApplyProblem(
      result,
      "Office Puzzle could not be updated."
    );
    return;
  }

  const idx=behaviorMappings.findIndex(
    item=>item.name===mapping.name
  );

  if(idx>=0) {
    behaviorMappings[idx]={
      ...behaviorMappings[idx],
      currentCount:target
    };
  }

  renderSelectedBehavior();

  showRbtActionResult({
    success:true,
    title:"Applied successfully",
    message:
      `${applyActionStatusMessage(
        mapping.name,
        selectedDate
      )}\nOffice Puzzle was updated and verified.`
  });
}


function populateClient2ReplacementSelect() {
  const select=$("client2ReplacementSelect");
  select.innerHTML="";

  CLIENT2_REPLACEMENTS.forEach((name,index)=>{
    const option=document.createElement("option");
    option.value=String(index);
    option.textContent=`${index+1}. ${name}`;
    select.appendChild(option);
  });

  syncCustomSelect("client2ReplacementSelect");
}

function selectedClient2ReplacementName() {
  return CLIENT2_REPLACEMENTS[selectedClient2ReplacementIndex] || CLIENT2_REPLACEMENTS[0];
}

function client2ReplacementPlaceholder(name) {
  return {
    name,
    method:"percentage_opportunities",
    selectedDate:context.selectedDate || null,
    found:false,
    currentStates:Array(10).fill(""),
    currentAverage:null,
    dailyAverages:{},
    errorHint:
      `Open "${name}" in Office Puzzle and press “Scan replacement currently open in Office Puzzle”.`
  };
}

function selectedClient2ReplacementMapping() {
  const name=selectedClient2ReplacementName();
  return client2ReplacementMappingsByName[name] || client2ReplacementPlaceholder(name);
}

async function selectClient2Replacement(index) {
  selectedClient2ReplacementIndex=
    (index + CLIENT2_REPLACEMENTS.length) % CLIENT2_REPLACEMENTS.length;

  closeClient2ReplacementReview();

  client2ReplacementMapping=selectedClient2ReplacementMapping();
  $("client2ReplacementSelect").value=String(selectedClient2ReplacementIndex);

  await renderClient2Replacement();
}

function client2ReplacementDateObject() {
  const selected=
    dateNavigationState.selectedDate ||
    context?.selectedDate ||
    client2ReplacementMapping?.selectedDate ||
    localTodayISODate();

  return new Date(`${selected}T12:00:00`);
}

function client2ReplacementWeekKey() {
  const selected=isoDate(client2ReplacementDateObject());
  return planningPeriodKey(client2ReplacementMapping,selected,client2ReplacementDateForDay);
}

function client2ReplacementDayKey() {
  return isoWeekdayKey(client2ReplacementDateObject());
}

function client2ReplacementDateForDay(dayKey) {
  const mon=mondayOf(client2ReplacementDateObject());
  const d=new Date(mon);
  d.setDate(mon.getDate()+dayKey-1);
  return isoDate(d);
}

function client2ReplacementPlanKey(name) {
  return `client2ReplacementPlan::${clientKey}::${client2ReplacementWeekKey()}::${name}`;
}

async function buildClient2ReplacementPlan(targetPercent,forcedTargetSuccesses=null) {
  const mapping=client2ReplacementMapping;
  const selected=isoDate(client2ReplacementDateObject());
  const dates=planningDatesForMapping(mapping,selected,client2ReplacementDateForDay);
  const allocations=[];
  const actualDates=[];
  let previousSuccesses=0;
  let previousTrials=0;

  for(const date of dates) {
    const actual=actualDataForDate(mapping,date,"percentage_opportunities");
    const avg=actual.hasActual && Number.isFinite(Number(actual.value))
      ? Number(actual.value) : null;
    if(Number.isFinite(avg)) {
      const successes=Math.max(0,Math.min(10,Math.round(avg/10)));
      previousSuccesses+=successes;
      previousTrials+=10;
      actualDates.push(date);
      allocations.push({date,dayKey:isoWeekdayKey(date),successes,percent:avg,source:"actual"});
    }
  }

  const totalWeeklyTrials=Math.max(10,dates.length*10);
  const rawTargetSuccesses=(targetPercent/100)*totalWeeklyTrials;
  let targetSuccesses;
  if(forcedTargetSuccesses!=null && Number.isFinite(Number(forcedTargetSuccesses))) {
    targetSuccesses=Math.round(Number(forcedTargetSuccesses));
  } else if(Number.isInteger(rawTargetSuccesses)) {
    targetSuccesses=rawTargetSuccesses;
  } else {
    const lower=Math.floor(rawTargetSuccesses);
    const upper=Math.ceil(rawTargetSuccesses);
    targetSuccesses=Math.random()<0.5 ? lower : upper;
  }
  targetSuccesses=Math.max(0,Math.min(totalWeeklyTrials,targetSuccesses));
  const achievablePercent=(targetSuccesses/totalWeeklyTrials)*100;
  const actualSet=new Set(actualDates);
  const futureDates=dates.filter(date=>!actualSet.has(date));
  const remainingCapacity=futureDates.length*10;
  const remainingSuccesses=Math.max(0,Math.min(remainingCapacity,targetSuccesses-previousSuccesses));
  const counts=allocateCappedRandom(remainingSuccesses,futureDates.map(()=>10));

  futureDates.forEach((date,index)=>{
    const successes=counts[index];
    allocations.push({
      date,dayKey:isoWeekdayKey(date),successes,percent:successes*10,
      pattern:randomPattern(10,successes),source:"plan"
    });
  });

  return {
    planningDates:[...dates],
    planningDatesSignature:planningDatesSignature(dates),
    requestedPercent:targetPercent,targetSuccesses,achievablePercent,
    previousSuccesses,previousTrials,
    actualFingerprint:actualFingerprintForDates(mapping,dates,"percentage_opportunities"),
    remainingSuccesses,remainingCapacity,
    allocations:allocations.sort((a,b)=>String(a.date).localeCompare(String(b.date))),
    updatedAt:new Date().toISOString()
  };
}

async function renderClient2ReplacementPlan(plan) {
  const host=$("client2ReplacementWeekPlan");
  host.innerHTML="";

  const selectedDate=isoDate(client2ReplacementDateObject());
  const stripDates=visiblePlanningDates(
    client2ReplacementMapping,
    selectedDate,
    client2ReplacementDateForDay,
    plan
  );
  configurePlanningDateStrip(host,stripDates);

  stripDates.forEach(date=>{
    const entry=allocationForDate(plan?.allocations,date);
    const actual=actualDataForDate(
      client2ReplacementMapping,
      date,
      "percentage_opportunities"
    );
    const replacing=
      plan?.replaceDate===date &&
      entry?.source==="plan" &&
      Array.isArray(entry?.pattern);

    const card=document.createElement("div");
    card.className=
      "weekDayCard"+(date===selectedDate?" today":"");
    card.dataset.date=date;

    const value=
      replacing && entry
        ? `${Math.round(Number(entry.percent))}%`
        : actual.hasActual
          ? `${Math.round(Number(actual.value ?? 0))}%`
          : entry
            ? `${Math.round(Number(entry.percent))}%`
            : "—";

    card.innerHTML=`
      <div class="day">${weekdayLabelForDate(date)}<span class="dayDate">${new Date(`${date}T12:00:00`).getDate()}</span></div>
      <div class="num">${value}</div>
    `;
    host.appendChild(card);
  });

  updateWeekNavigatorForHost(
    "client2ReplacementWeekPlan"
  );

  $("client2ReplacementPrevious").textContent=
    plan ? `${plan.previousSuccesses}/${plan.previousTrials}` : "—";

  $("client2ReplacementRemaining").textContent=
    plan ? `${plan.remainingSuccesses}/${plan.remainingCapacity}` : "—";

  const date=isoDate(client2ReplacementDateObject());
  const actual=actualDataForDate(
    client2ReplacementMapping,
    date,
    "percentage_opportunities"
  );
  const entry=allocationForDate(plan?.allocations,date);
  const replacing=
    plan?.replaceDate===date &&
    entry?.source==="plan" &&
    Array.isArray(entry?.pattern);

  $("client2ReplacementTodayPlanned").textContent=
    replacing && entry
      ? `${Math.round(entry.percent)}%`
      : actual.hasActual
        ? "—"
        : entry
          ? `${Math.round(entry.percent)}%`
          : "—";

  renderPlanChangePreview(
    "client2ReplacementChangePreview",
    date,
    replacing && actual.hasActual ? `${Math.round(Number(actual.value ?? 0))}%` : null,
    replacing && entry ? `${Math.round(Number(entry.percent))}%` : null
  );

  renderChallengingPattern(
    $("client2ReplacementPlannedPattern"),
    replacing && entry
      ? (entry.pattern || [])
      : actual.hasActual
        ? (actual.states || [])
        : (entry?.pattern || []),
    false
  );
}

async function loadClient2ReplacementPlan({preserveInput=false}={}) {
  const name=
    client2ReplacementMapping?.name ||
    selectedClient2ReplacementName();

  const key=client2ReplacementPlanKey(name);
  const saved=await storageGet([key]);
  const plan=saved[key] || null;

  if(!preserveInput) {
    $("client2ReplacementWeeklyTarget").value=
      plan?.requestedPercent ?? "";
  }

  if(plan?.requestedPercent != null) {
    const suppression=validPlanReplacement(
      plan,
      client2ReplacementMapping,
      "percentage_opportunities"
    );

    const liveDates=planningDatesForMapping(
      client2ReplacementMapping,
      isoDate(client2ReplacementDateObject()),
      client2ReplacementDateForDay
    );
    const availabilityChanged=
      planningDatesSignature(plan.planningDates || [])!==
      planningDatesSignature(liveDates);

    let refreshed=await withPlanningSuppression(
      suppression,
      ()=>buildClient2ReplacementPlan(
        Number(plan.requestedPercent),
        availabilityChanged ? null : Number(plan.targetSuccesses)
      )
    );

    refreshed=addReplacementMeta(
      refreshed,
      suppression
    );

    if(
      String(plan.actualFingerprint || "")!==
        String(refreshed.actualFingerprint || "") ||
      String(plan.planningDatesSignature || planningDatesSignature(plan.planningDates || []))!==
        String(refreshed.planningDatesSignature || planningDatesSignature(refreshed.planningDates || [])) ||
      String(plan.replaceDate || "")!==
        String(refreshed.replaceDate || "")
    ) {
      await storageSet({[key]:refreshed});
      await renderClient2ReplacementPlan(refreshed);
      return;
    }
  }

  await renderClient2ReplacementPlan(plan);
}

async function saveClient2ReplacementPlan() {
  lastPlanActionSucceeded=false;
  const raw=$("client2ReplacementWeeklyTarget").value;
  const target=Number(raw);

  if(raw==="") {
    validationError(
      "Enter a weekly target to continue.",
      "client2ReplacementWeeklyTarget"
    );
    return;
  }

  if(!Number.isFinite(target)||target<0||target>100) {
    validationError(
      "Enter a percentage from 0 to 100.",
      "client2ReplacementWeeklyTarget"
    );
    return;
  }

  const date=isoDate(client2ReplacementDateObject());
  let mapping=await refreshPlanningPeriodIfNeeded(
    ()=>client2ReplacementMapping,
    date
  );

  if(!mapping?.found) {
    validationError(
      "This program is still loading from Office Puzzle. Try again in a moment."
    );
    return;
  }

  if(!selectedDateIsPlannable(mapping,date,client2ReplacementDateForDay)) {
    validationError(unavailablePlanningDateMessage(date));
    return;
  }

  const choice=await chooseExistingDataPlan({
    mapping,
    date,
    methodHint:"percentage_opportunities",
    programName:mapping.name
  });

  let plan=await withPlanningSuppression(
    choice.spec,
    ()=>buildClient2ReplacementPlan(target)
  );

  plan=addReplacementMeta(plan,choice.spec);

  await storageSet({
    [client2ReplacementPlanKey(
      selectedClient2ReplacementName()
    )]:plan
  });

  closeClient2ReplacementReview();
  await renderClient2ReplacementPlan(plan);

  if(!quickQueueMode) {
  if(plan.capacityLimited) {
    toast(
      `Plan capped safely at ${plan.dailyIncidentCap} incidents per day because that is the Office Puzzle row limit.`,
      5600
    );
  } else if(choice.spec) {
    toast(
      `Replacement plan ready for ${friendlyDateLabel(date)}. Nothing changes in Office Puzzle until you Apply or Run.`,
      5200
    );
  } else if(choice.hasActual) {
    toast(
      `Kept the current entry for ${friendlyDateLabel(date)} and planned the remaining days.`,
      4700
    );
  } else {
    toast("Plan ready.");
  }

    }

lastPlanActionSucceeded=true;
}

async function currentClient2ReplacementTodayPlan() {
  const key=client2ReplacementPlanKey(selectedClient2ReplacementName());
  const saved=await storageGet([key]);
  const plan=saved[key] || null;

  const date=isoDate(client2ReplacementDateObject());
  return allocationForDate(plan?.allocations,date) || null;
}

function updateReviewWriteButtons() {
  const replacementApply=$("confirmReplacementApply");
  if(replacementApply) {
    replacementApply.disabled=!replacementReviewConfirmed;
    replacementApply.title=replacementReviewConfirmed
      ? "Apply confirmed reviewed outcomes"
      : "Confirm review first";
  }

  const client2Apply=$("confirmClient2ReplacementApply");
  if(client2Apply) {
    client2Apply.disabled=!client2ReplacementReviewConfirmed;
    client2Apply.title=client2ReplacementReviewConfirmed
      ? "Apply confirmed reviewed outcomes"
      : "Confirm review first";
  }

  const intervalApply=$("confirmChallengingApply");
  if(intervalApply) {
    intervalApply.disabled=!challengingReviewConfirmed;
    intervalApply.title=challengingReviewConfirmed
      ? "Apply confirmed reviewed outcomes"
      : "Confirm review first";
  }
}

function updateReviewActionButton(kind) {
  const config={
    client1Replacement:{
      buttonId:"applyReplacementTrials",
      panelId:"replacementReviewPanel",
      confirmed:replacementReviewConfirmed,
      initial:"Apply now"
    },
    client2Replacement:{
      buttonId:"reviewClient2Replacement",
      panelId:"client2ReplacementReviewPanel",
      confirmed:client2ReplacementReviewConfirmed,
      initial:"Apply now"
    },
    challenging:{
      buttonId:"reviewChallengingIntervals",
      panelId:"challengingReviewPanel",
      confirmed:challengingReviewConfirmed,
      initial:"Apply now"
    }
  }[kind];

  if(!config) return;

  const button=$(config.buttonId);
  const panel=$(config.panelId);
  if(!button || !panel) return;

  if(panel.hidden) {
    button.textContent=config.initial;
    button.classList.remove("reviewConfirmedAction");
  } else if(config.confirmed) {
    button.textContent="✓ Review confirmed";
    button.classList.add("reviewConfirmedAction");
  } else {
    button.textContent="Confirm review";
    button.classList.remove("reviewConfirmedAction");
  }

  updateReviewWriteButtons();
  updateStickyActionBar();
}

function markReplacementReviewEdited() {
  replacementReviewConfirmed=false;
  updateReviewActionButton("client1Replacement");
}

function markClient2ReplacementReviewEdited() {
  client2ReplacementReviewConfirmed=false;
  updateReviewActionButton("client2Replacement");
}

function markChallengingReviewEdited() {
  challengingReviewConfirmed=false;
  updateReviewActionButton("challenging");
}

function confirmReplacementReview() {
  if(reviewedTrialStates.length!==10 ||
     reviewedTrialStates.some(state=>state!=="+" && state!=="-")) {
    toast("This plan isn't ready yet. Press Add + Next and try again.");
    return false;
  }

  replacementReviewConfirmed=true;
  updateReviewActionButton("client1Replacement");
  toast("Review confirmed. Use Add to batch or Apply now.");
  return true;
}

function confirmClient2ReplacementReview() {
  if(reviewedClient2ReplacementStates.length!==10 ||
     reviewedClient2ReplacementStates.some(state=>state!=="+" && state!=="-")) {
    toast("This plan isn't ready yet. Press Add + Next and try again.");
    return false;
  }

  client2ReplacementReviewConfirmed=true;
  updateReviewActionButton("client2Replacement");
  toast("Review confirmed. Use Add to batch or Apply now.");
  return true;
}

function confirmChallengingReview() {
  const activeIntervals=intervalsForHours($("challengingHours").value);

  if(reviewedChallengingStates.length!==activeIntervals ||
     reviewedChallengingStates.some(state=>state!=="+" && state!=="-")) {
    toast("This plan isn't ready yet. Press Add + Next and try again.");
    return false;
  }

  challengingReviewConfirmed=true;
  updateReviewActionButton("challenging");
  toast("Review confirmed. Use Add to batch or Apply now.");
  return true;
}

function renderClient2ReplacementReviewedGrid() {
  const host=$("client2ReplacementReviewedGrid");
  if(!host) return;

  renderChallengingPattern(
    host,
    reviewedClient2ReplacementStates,
    true
  );

  for(const button of host.querySelectorAll("button")) {
    button.addEventListener("click",()=>{
      const index=Number(button.dataset.index);

      reviewedClient2ReplacementStates[index]=
        reviewedClient2ReplacementStates[index]==="+" ? "-" : "+";

      markClient2ReplacementReviewEdited();
      renderClient2ReplacementReviewedGrid();
    });
  }
}

async function openClient2ReplacementReview() {
  if(!$("client2ReplacementReviewPanel").hidden) {
    confirmClient2ReplacementReview();
    return;
  }

  const today=await currentClient2ReplacementTodayPlan();

  if(!today?.pattern?.length) {
    toast("No plan for this day yet. Press Add + Next to create one.");
    return;
  }

  reviewedClient2ReplacementStates=[...today.pattern];
  client2ReplacementReviewConfirmed=false;
  renderClient2ReplacementReviewedGrid();

  $("client2ReplacementReviewPanel").hidden=false;
  updateReviewActionButton("client2Replacement");
}

function closeClient2ReplacementReview() {
  $("client2ReplacementReviewPanel").hidden=true;
  client2ReplacementReviewConfirmed=false;
  updateReviewActionButton("client2Replacement");
}

async function applyClient2Replacement() {
  const planned=await plannedClient2ReplacementStates();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  let {
    mapping,
    states,
    selectedDate,
    replacingExisting
  }=planned;

  const proceed=await confirmOneOffOverwrite({
    replacingExisting,
    name:mapping.name,
    selectedDate
  });

  if(!proceed) return;

  showRbtActionProgress({
    title:
      replacingExisting
        ? "Replacing…"
        : "Writing…",
    message:
      applyActionStatusMessage(
        mapping.name,
        selectedDate
      )
  });

  const prepared=await prepareDirectReplacementWrite({
    mapping,
    writerKind:"replacement",
    replacingExisting
  });

  if(!prepared.ok) {
    showRbtApplyProblem(
      prepared,
      "Office Puzzle could not prepare the replacement."
    );
    return;
  }

  mapping=prepared.mapping;

  reviewedClient2ReplacementStates=[...states];
  client2ReplacementReviewConfirmed=true;

  const writeToken=await armOneWrite();

  const result=await sendTab({
    type:"SET_CLIENT2_REPLACEMENT_TRIALS",
    mapping,
    desiredStates:[...states],
    writeToken
  });

  if(!result?.ok || !result?.verified) {
    showRbtApplyProblem(
      result,
      "Office Puzzle did not verify the planned entry."
    );
    return;
  }

  client2ReplacementMapping={
    ...mapping,
    currentStates:[...result.finalStates],
    currentAverage:result.finalAverage,
    dailyAverages:{
      ...(mapping.dailyAverages||{}),
      [mapping.selectedDate]:
        result.finalAverage
    },
    dailyStates:{
      ...(mapping.dailyStates||{}),
      [mapping.selectedDate]:
        [...result.finalStates]
    }
  };

  client2ReplacementMappingsByName[
    mapping.name
  ]=client2ReplacementMapping;

  client2ReplacementReviewConfirmed=false;

  await renderClient2Replacement();

  showRbtActionResult({
    success:true,
    title:"Applied successfully",
    message:
      `${applyActionStatusMessage(
        mapping.name,
        selectedDate
      )}\nOffice Puzzle was updated and verified.`
  });
}

async function scanCurrentClient2Replacement() {
  if(client2ReplacementScanInProgress) {
    toast("A scan is already running.");
    return;
  }

  client2ReplacementScanInProgress=true;

  try {
    if($("scanClient2Replacement")) $("scanClient2Replacement").disabled=true;
    $("client2ReplacementScanSummary").textContent=
      "Discovering replacement/skill program tables…";
    await discoverAndApplyClientPrograms({preserveDraft:true,manual:true});
  } finally {
    client2ReplacementScanInProgress=false;
    if($("scanClient2Replacement")) $("scanClient2Replacement").disabled=false;
  }
}

async function renderClient2Replacement(preserveDraft=false) {
  const name=
    client2ReplacementMapping?.name ||
    selectedClient2ReplacementName();

  const index=CLIENT2_REPLACEMENTS.findIndex(item=>item===name);

  if(index>=0) {
    selectedClient2ReplacementIndex=index;
  }

  $("client2ReplacementSelect").value=
    String(selectedClient2ReplacementIndex);
  syncCustomSelect("client2ReplacementSelect");

  updateProgramProgress(
    "client2ReplacementPosition",
    "client2ReplacementPositionBar",
    selectedClient2ReplacementIndex+1,
    CLIENT2_REPLACEMENTS.length
  );

  $("client2ReplacementName").textContent=name;

  $("client2ReplacementDetected").textContent=
    client2ReplacementMapping?.found ? "Mapped" : "Not scanned";

  $("client2ReplacementCurrentAverage").textContent=
    client2ReplacementMapping?.currentAverage==null
      ? "—"
      : `${Math.round(Number(client2ReplacementMapping.currentAverage))}%`;

  if(client2ReplacementMapping?.found) {
    const states=client2ReplacementMapping.currentStates || [];
    const populated=states.filter(Boolean).length;
    const pluses=states.filter(state=>state==="+").length;

    $("client2ReplacementStatus").textContent=
      `Current table mapped · ${populated}/10 trials populated · ${pluses} successful.`;

    $("client2ReplacementStatus").style.background="#eaf8f2";
    $("client2ReplacementStatus").style.color="#126849";
  } else {
    $("client2ReplacementStatus").textContent=
      client2ReplacementMapping?.errorHint ||
      `Open "${name}" in Office Puzzle and scan it.`;

    $("client2ReplacementStatus").style.background="#fff0f0";
    $("client2ReplacementStatus").style.color="#8b3434";
  }

  if(!preserveDraft) {
    await loadClient2ReplacementPlan();
  }
}

function populateChallengingSelect() {
  const select=$("challengingSelect");
  select.innerHTML="";

  CHALLENGING.forEach((item,index)=>{
    const option=document.createElement("option");
    option.value=String(index);
    option.textContent=`${index+1}. ${item.name}`;
    select.appendChild(option);
  });

  syncCustomSelect("challengingSelect");
}

function selectedChallengingName() {
  return CHALLENGING[selectedChallengingIndex]?.name || CHALLENGING[0]?.name || "";
}

function challengingPlaceholder(name) {
  const config=challengingConfig(name);

  return {
    name,
    method:config?.method || "",
    selectedDate:context.selectedDate || null,
    found:false,
    errorHint:
      `Open "${name}" in Office Puzzle and press “Scan behavior currently open in Office Puzzle”.`
  };
}

function selectedChallengingMapping() {
  const name=selectedChallengingName();
  return challengingMappingsByName[name] || challengingPlaceholder(name);
}

async function selectChallenging(index) {
  if(!CHALLENGING.length) return;

  selectedChallengingIndex=
    (index + CHALLENGING.length) % CHALLENGING.length;

  closeChallengingReview();

  challengingMapping=selectedChallengingMapping();

  $("challengingSelect").value=String(selectedChallengingIndex);
  syncCustomSelect("challengingSelect");

  // Reuses the one shared hours value for this Client 2/date.
  await loadTodayChallengingHours();
  await renderChallengingMapping();
}

function challengingConfig(name) {
  return CHALLENGING.find(item=>item.name===name) || null;
}

function challengingSelectedDate() {
  return (
    dateNavigationState.selectedDate ||
    context?.selectedDate ||
    challengingMapping?.selectedDate ||
    localTodayISODate()
  );
}

function challengingDateObject() {
  return new Date(`${challengingSelectedDate()}T12:00:00`);
}

function challengingWeekKey() {
  const selected=challengingSelectedDate();
  return planningPeriodKey(challengingMapping,selected,challengingDateForWeekday);
}

function challengingDateForWeekday(dayKey) {
  const mon=mondayOf(challengingDateObject());
  const d=new Date(mon);
  d.setDate(mon.getDate()+dayKey-1);
  return isoDate(d);
}

function challengingSelectedDayKey() {
  return isoWeekdayKey(challengingDateObject());
}

function challengingPlanKey(name) {
  return `challengingWeeklyPlan::${clientKey}::${challengingWeekKey()}::${name}`;
}

let client2DayHoursValue=CLIENT2_DEFAULT_HOURS;
let client2DayHoursDate="";

function challengingHoursKey(date) {
  return `client2Hours::${clientKey}::${date}`;
}

function validHours(raw) {
  const n=Number(raw);
  return Number.isFinite(n) && n>=0.5 && n<=CLIENT2_MAX_HOURS && Math.abs(n*2-Math.round(n*2))<1e-9;
}


function partialIntervalCapacity(mapping=challengingMapping) {
  const reported=Number(mapping?.maxIntervals);

  if(
    Number.isInteger(reported) &&
    reported>0
  ) {
    return Math.min(
      CLIENT2_MAX_INTERVALS,
      reported
    );
  }

  return CLIENT2_MAX_INTERVALS;
}

function requestedIntervalsForHours(hours) {
  if(!validHours(hours)) return 0;
  return Math.round(Number(hours)*2);
}

function partialIntervalHoursSupported(
  hours,
  mapping=challengingMapping
) {
  if(!validHours(hours)) {
    return {
      ok:false,
      error:
        `Hours must be 0.5 to ${CLIENT2_MAX_HOURS} hours in 30-minute increments.`
    };
  }

  const requested=
    requestedIntervalsForHours(hours);

  const available=
    partialIntervalCapacity(mapping);

  if(requested>available) {
    return {
      ok:false,
      requestedIntervals:requested,
      availableIntervals:available,
      availableHours:available/2,
      error:
        `This Office Puzzle table currently provides ${available} interval${available===1 ? "" : "s"} ` +
        `(${available/2} hours). Choose ${available/2} hours or less for this program.`
    };
  }

  return {
    ok:true,
    requestedIntervals:requested,
    availableIntervals:available,
    availableHours:available/2
  };
}

function intervalsForHours(hours) {
  if(!validHours(hours)) {
    return Math.min(
      CLIENT2_MAX_INTERVALS,
      CLIENT2_DEFAULT_HOURS*2
    );
  }

  return Math.max(
    1,
    Math.min(
      CLIENT2_MAX_INTERVALS,
      requestedIntervalsForHours(hours)
    )
  );
}

function syncClientHoursControl(hours,{partial=true}={}) {
  const wrap=$("clientHoursControl");
  const input=$("clientHoursInput");
  const minus=$("clientHoursMinus");
  const plus=$("clientHoursPlus");
  if(!wrap || !input) return;

  wrap.hidden=!(context?.pageType==="challenging" && partial);
  input.disabled=!partial;
  if(minus) minus.disabled=!partial;
  if(plus) plus.disabled=!partial;

  if(validHours(hours) && document.activeElement!==input) {
    input.value=`${Number(hours)}h`;
  }
}

function clientHoursNumericValue() {
  const raw=String($("clientHoursInput")?.value || "")
    .toLowerCase()
    .replace(/hours?|hrs?|h/g,"")
    .trim();
  return Number(raw);
}

async function commitClientHoursInput({render=true}={}) {
  const input=$("clientHoursInput");
  if(!input) return false;

  const value=clientHoursNumericValue();
  if(!validHours(value)) {
    validationError(
      `Choose 0.5 to ${CLIENT2_MAX_HOURS} hours in 30-minute steps.`,
      "clientHoursInput"
    );
    syncClientHoursControl(client2DayHoursValue,{partial:true});
    return false;
  }

  $("challengingHours").value=String(value);
  closeChallengingReview();

  const saved=await saveTodayChallengingHours({showToast:false});
  if(!saved) {
    syncClientHoursControl(client2DayHoursValue,{partial:true});
    return false;
  }

  syncClientHoursControl(value,{partial:true});
  if(render && challengingMapping) await renderChallengingMapping(true);
  return true;
}

async function stepClientHours(delta) {
  const current=validHours(clientHoursNumericValue())
    ? clientHoursNumericValue()
    : (validHours(client2DayHoursValue) ? client2DayHoursValue : CLIENT2_DEFAULT_HOURS);

  let next=Math.round((current + Number(delta||0))*2)/2;
  next=Math.max(.5,Math.min(CLIENT2_MAX_HOURS,next));

  const available=partialIntervalCapacity(challengingMapping)/2;
  if(challengingMapping?.found) next=Math.min(next,available);

  $("clientHoursInput").value=`${next}h`;
  return await commitClientHoursInput();
}

async function loadTodayChallengingHours() {
  const date=challengingSelectedDate();
  const key=challengingHoursKey(date);

  // Hours are a day-level Client 2 setting, not a behavior-level setting.
  // Reuse the already-loaded value while switching between behaviors on the
  // same client/date so the UI never feels like it resets per behavior.
  if(client2DayHoursDate===date && validHours(client2DayHoursValue)) {
    $("challengingHours").value=String(client2DayHoursValue);
    syncClientHoursControl(client2DayHoursValue,{partial:true});
    updateChallengingHoursHint();
    return client2DayHoursValue;
  }

  const saved=await storageGet([key]);
  const hours=validHours(saved[key]) ? Number(saved[key]) : CLIENT2_DEFAULT_HOURS;

  client2DayHoursValue=hours;
  client2DayHoursDate=date;

  $("challengingHours").value=String(hours);
  syncClientHoursControl(hours,{partial:true});
  updateChallengingHoursHint();
  return hours;
}

async function saveTodayChallengingHours({showToast=false}={}) {
  const raw=$("challengingHours").value;

  if(!validHours(raw)) {
    toast(`Hours must be 0.5 to ${CLIENT2_MAX_HOURS} hours in 30-minute increments.`);
    return false;
  }

  const hours=Number(raw);

  const method=
    challengingMapping?.method ||
    challengingConfig(
      challengingMapping?.name
    )?.method;

  if(
    method==="partial_interval" &&
    challengingMapping?.found
  ) {
    const supported=
      partialIntervalHoursSupported(
        hours,
        challengingMapping
      );

    if(!supported.ok) {
      validationError(
        supported.error,
        "clientHoursInput"
      );
      return false;
    }
  }
  const date=challengingSelectedDate();

  client2DayHoursValue=hours;
  client2DayHoursDate=date;

  await storageSet({[challengingHoursKey(date)]:hours});

  syncClientHoursControl(hours,{partial:true});
  updateChallengingHoursHint();

  if(showToast) {
    toast(`${hours}h set for ${friendlyDateLabel(date)}.`);
  }

  return true;
}

function updateChallengingHoursHint() {
  const hours=Number(
    $("challengingHours").value ||
    CLIENT2_DEFAULT_HOURS
  );

  const method=
    challengingMapping?.method ||
    challengingConfig(
      challengingMapping?.name
    )?.method;

  const safeHours=
    validHours(hours)
      ? hours
      : client2DayHoursValue;

  if(method!=="partial_interval") {
    $("challengingHoursHint").textContent=
      `${safeHours}h is saved for today. Frequency behaviors do not use hours for their count.`;

    $("challengingTodayHours").textContent=
      `${safeHours}h`;

    return;
  }

  if(!validHours(hours)) {
    $("challengingTodayHours").textContent="—";

    $("challengingHoursHint").textContent=
      `Choose 0.5–${CLIENT2_MAX_HOURS} hours in 30-minute increments.`;

    return;
  }

  const intervals=intervalsForHours(hours);
  const capacity=partialIntervalCapacity(
    challengingMapping
  );

  $("challengingTodayHours").textContent=
    `${hours}h`;

  if(intervals>capacity) {
    $("challengingHoursHint").textContent=
      `${hours} hours needs ${intervals} intervals. ` +
      `This Office Puzzle table currently exposes ${capacity} ` +
      `(${capacity/2} hours).`;

    return;
  }

  if(intervals<8) {
    const firstUnused=intervals+1;

    const range=
      firstUnused===8
        ? "Interval 8"
        : `Intervals ${firstUnused}–8`;

    $("challengingHoursHint").textContent=
      `${hours} hours = ${intervals} active 30-minute intervals. ` +
      `Office Puzzle may auto-fill through Interval 8; unused ${range} ` +
      `will be cleared before completion.`;

    return;
  }

  if(intervals===8) {
    const extra=
      capacity>8
        ? ` Intervals 9–${capacity} remain unused.`
        : "";

    $("challengingHoursHint").textContent=
      `${hours} hours = 8 active 30-minute intervals.${extra}`;

    return;
  }

  if(intervals<capacity) {
    $("challengingHoursHint").textContent=
      `${hours} hours = ${intervals} active 30-minute intervals. ` +
      `Intervals ${intervals+1}–${capacity} remain unused.`;

    return;
  }

  $("challengingHoursHint").textContent=
    `${hours} hours = all ${intervals} available 30-minute intervals active.`;
}

async function challengingHoursMap() {
  const selected=challengingSelectedDate();
  const dates=planningDatesForMapping(challengingMapping,selected,challengingDateForWeekday);
  const keys=dates.map(challengingHoursKey);
  const saved=await storageGet(keys);
  const result={};

  dates.forEach(date=>{
    const raw=saved[challengingHoursKey(date)];
    result[date]=validHours(raw) ? Number(raw) : CLIENT2_DEFAULT_HOURS;
  });

  const today=challengingSelectedDate();
  if(validHours($("challengingHours").value)) {
    result[today]=Number($("challengingHours").value);
  }

  return result;
}

function allocateCappedRandom(total, capacities) {
  const caps=(capacities || []).map(cap=>
    Math.max(0,Math.floor(Number(cap)||0))
  );
  const values=caps.map(()=>0);
  const totalCapacity=caps.reduce((sum,cap)=>sum+cap,0);
  const safeTotal=Math.max(
    0,
    Math.min(totalCapacity,Math.floor(Number(total)||0))
  );

  if(!safeTotal || !totalCapacity) return values;

  // Balanced largest-remainder allocation. With equal capacities this makes
  // daily values differ by at most 1. With different interval capacities it
  // keeps the RATE/PERCENTAGE as even as the integer interval grid permits.
  // Random tie-breaking preserves harmless variation without creating spikes.
  const rate=safeTotal/totalCapacity;
  const raw=caps.map(cap=>cap*rate);

  raw.forEach((value,index)=>{
    values[index]=Math.min(caps[index],Math.floor(value));
  });

  let remaining=safeTotal-values.reduce((sum,value)=>sum+value,0);

  while(remaining>0) {
    const order=raw
      .map((value,index)=>({
        index,
        frac:value-Math.floor(value),
        tie:Math.random()
      }))
      .filter(item=>values[item.index]<caps[item.index])
      .sort((a,b)=>(b.frac-a.frac)||(b.tie-a.tie));

    if(!order.length) break;

    let added=0;
    for(const item of order) {
      if(remaining<=0) break;
      if(values[item.index]>=caps[item.index]) continue;
      values[item.index]++;
      remaining--;
      added++;
    }

    if(!added) break;
  }

  return values;
}

function randomPattern(length, pluses) {
  length=Math.max(0,Number(length)||0);
  pluses=Math.max(0,Math.min(length,Number(pluses)||0));

  const states=Array(length).fill("-");
  const indices=Array.from({length},(_,i)=>i);

  for(let i=indices.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [indices[i],indices[j]]=[indices[j],indices[i]];
  }

  indices.slice(0,pluses).forEach(i=>states[i]="+");
  return states;
}

function chooseTargetOccurrences(rawOccurrences) {
  const floor=Math.floor(rawOccurrences);
  const ceil=Math.ceil(rawOccurrences);

  if(floor===ceil) return floor;

  const frac=rawOccurrences-floor;

  if(Math.abs(frac-0.5)<1e-9) {
    return Math.random()<0.5 ? floor : ceil;
  }

  return frac<0.5 ? floor : ceil;
}

async function buildChallengingFrequencyPlan(target) {
  const mapping=challengingMapping;
  const selected=challengingSelectedDate();
  const dates=planningDatesForMapping(mapping,selected,challengingDateForWeekday);
  const allocations=[];
  const actualDates=[];
  let previous=0;

  for(const date of dates) {
    const actual=actualDataForDate(mapping,date,"frequency");
    if(actual.hasActual) {
      previous+=actual.value ?? 0;
      actualDates.push(date);
      allocations.push({date,dayKey:isoWeekdayKey(date),value:actual.value ?? 0,source:"actual"});
    }
  }

  const actualSet=new Set(actualDates);
  const remaining=Math.max(0,target-previous);
  const futureDates=dates.filter(date=>!actualSet.has(date));
  const dailyCap=dailyFrequencyIncidentCap(mapping);
  const future=allocateRemainingDates(remaining,futureDates,dailyCap);
  const plannedFutureTotal=future.reduce((sum,item)=>sum+Number(item.value||0),0);
  future.forEach(item=>allocations.push({...item,source:"plan"}));

  return {
    type:"frequency",planningDates:[...dates],planningDatesSignature:planningDatesSignature(dates),weeklyTarget:target,previous,
    actualFingerprint:actualFingerprintForDates(mapping,dates,"frequency"),
    remaining,dailyIncidentCap:dailyCap,capacityLimited:plannedFutureTotal<remaining,
    unallocatedBecauseOfCapacity:Math.max(0,remaining-plannedFutureTotal),
    allocations:allocations.sort((a,b)=>String(a.date).localeCompare(String(b.date))),
    updatedAt:new Date().toISOString()
  };
}

async function buildChallengingIntervalPlan(targetPercent) {
  const mapping=challengingMapping;
  const selected=challengingSelectedDate();
  const planningDates=planningDatesForMapping(mapping,selected,challengingDateForWeekday);
  const hoursMap=await challengingHoursMap();
  const days=planningDates.map(date=>{
    const hours=hoursMap[date] ?? CLIENT2_DEFAULT_HOURS;
    const intervals=intervalsForHours(hours);
    const actualAverage=mapping?.dailyAverages?.[date];
    return {date,dayKey:isoWeekdayKey(date),hours,intervals,actualAverage:actualAverage==null?null:Number(actualAverage)};
  });

  const totalIntervals=days.reduce((sum,day)=>sum+day.intervals,0);
  const targetOccurrences=chooseTargetOccurrences((targetPercent/100)*totalIntervals);
  const achievablePercent=totalIntervals ? (targetOccurrences/totalIntervals)*100 : 0;
  let previousOccurrences=0;
  let previousCapacity=0;
  const allocations=[];
  const actualDates=[];

  for(const day of days) {
    const actual=actualDataForDate(mapping,day.date,"partial_interval");
    if(actual.hasActual) {
      previousCapacity+=day.intervals;
      const actualPercent=actual.value==null ? 0 : Number(actual.value);
      const occurrences=Math.max(0,Math.min(day.intervals,Math.round((actualPercent/100)*day.intervals)));
      previousOccurrences+=occurrences;
      actualDates.push(day.date);
      allocations.push({
        dayKey:day.dayKey,date:day.date,hours:day.hours,intervals:day.intervals,
        occurrences,percent:actualPercent,pattern:actual.states || null,source:"actual"
      });
    }
  }

  const actualSet=new Set(actualDates);
  const future=days.filter(day=>!actualSet.has(day.date));
  const remainingCapacity=future.reduce((sum,day)=>sum+day.intervals,0);
  const desiredRemaining=Math.max(0,Math.min(remainingCapacity,targetOccurrences-previousOccurrences));
  const counts=allocateCappedRandom(desiredRemaining,future.map(day=>day.intervals));
  future.forEach((day,index)=>{
    const occurrences=counts[index];
    const percent=day.intervals ? (occurrences/day.intervals)*100 : 0;
    allocations.push({
      dayKey:day.dayKey,date:day.date,hours:day.hours,intervals:day.intervals,
      occurrences,percent,pattern:randomPattern(day.intervals,occurrences),source:"plan"
    });
  });
  const projectedOccurrences=previousOccurrences+counts.reduce((a,b)=>a+b,0);
  return {
    type:"partial_interval",planningDates:[...planningDates],planningDatesSignature:planningDatesSignature(planningDates),requestedPercent:targetPercent,
    targetOccurrences,achievablePercent,projectedPercent:totalIntervals?(projectedOccurrences/totalIntervals)*100:0,
    previousOccurrences,previousCapacity,
    actualFingerprint:actualFingerprintForDates(mapping,planningDates,"partial_interval"),
    remainingOccurrences:desiredRemaining,remainingCapacity,totalIntervals,
    allocations:allocations.sort((a,b)=>String(a.date).localeCompare(String(b.date))),
    updatedAt:new Date().toISOString()
  };
}

function renderChallengingPattern(host,states,editable=false) {
  host.innerHTML="";

  (states||[]).forEach((state,index)=>{
    const el=document.createElement(editable ? "button" : "span");
    el.className=
      "trialChip " +
      (state==="+" ? "plus" : state==="-" ? "minus" : "blank");

    const number=document.createElement("span");
    number.className="trialIndex";
    number.textContent=String(index+1).padStart(2,"0");

    const symbol=document.createElement("span");
    symbol.className="trialState";
    symbol.textContent=state || "·";

    el.append(number,symbol);

    if(editable) {
      el.type="button";
      el.dataset.index=String(index);
      el.title=`Interval ${index+1}: ${state || "blank"}`;
    }

    host.appendChild(el);
  });
}

function renderReviewedChallengingGrid() {
  // The compact review flow intentionally reuses the planned interval grid
  // instead of rendering a second duplicate review grid. If an optional
  // review grid is not present in the DOM, simply continue with the review
  // confirmation controls rather than throwing.
  const host=$("reviewedChallengingGrid");
  if(!host) return;

  renderChallengingPattern(
    host,
    reviewedChallengingStates,
    true
  );

  for(const button of host.querySelectorAll("button")) {
    button.addEventListener("click",()=>{
      const i=Number(button.dataset.index);
      reviewedChallengingStates[i]=
        reviewedChallengingStates[i]==="+" ? "-" : "+";
      markChallengingReviewEdited();
      renderReviewedChallengingGrid();
    });
  }
}

async function renderChallengingPlan(plan) {
  const host=$("challengingWeekPlan");
  host.innerHTML="";

  const mapping=challengingMapping;
  const selectedStripDate=challengingSelectedDate();
  const allocations=plan?.allocations || [];
  const stripDates=visiblePlanningDates(
    mapping,
    selectedStripDate,
    challengingDateForWeekday,
    plan
  );
  configurePlanningDateStrip(host,stripDates);

  if(mapping?.method==="frequency") {
    $("challengingPreviousLabel").textContent="Recorded this week";
    $("challengingPreviousValue").textContent=plan?.previous ?? "—";
    $("challengingRemainingLabel").textContent="Still to plan";
    $("challengingRemainingValue").textContent=plan?.remaining ?? "—";
    $("challengingTodayLabel").textContent="Plan for selected day";
  } else {
    $("challengingPreviousLabel").textContent="Recorded this week";
    $("challengingPreviousValue").textContent=
      plan ? `${plan.previousOccurrences}/${plan.previousCapacity}` : "—";
    $("challengingRemainingLabel").textContent="Still to plan";
    $("challengingRemainingValue").textContent=
      plan ? `${plan.remainingOccurrences}/${plan.remainingCapacity}` : "—";
    $("challengingTodayLabel").textContent="Plan for selected day";
  }

  stripDates.forEach(date=>{
    const entry=allocationForDate(allocations,date);
    const card=document.createElement("div");
    card.className="weekDayCard"+(date===selectedStripDate?" today":"");
    card.dataset.date=date;

    let value="—";
    let source="plan";
    let hours="";

    const actual=actualDataForDate(
      mapping,
      date,
      mapping?.method || ""
    );

    const replacing=plan?.replaceDate===date;
    const truthOnly=isWriteTruthOnlyDate(
      "challenging",
      mapping?.name,
      date
    );

    // After an incomplete/failed write, never fall back to a saved plan for
    // this date. Show only Office Puzzle's live truth until the user creates a
    // fresh plan or a later write verifies successfully.
    if(replacing && entry && !truthOnly) {
      source="new plan";

      if(mapping?.method==="frequency") {
        value=String(entry.value);
      } else {
        value=entry.percent==null
          ? "—"
          : `${Math.round(Number(entry.percent))}%`;
        hours=` · ${entry.hours}h`;
      }
    } else if(actual.hasActual) {
      source="recorded";

      if(mapping?.method==="frequency") {
        value=String(actual.value ?? 0);
      } else {
        value=actual.value==null
          ? "actual"
          : `${Math.round(Number(actual.value))}%`;

        const actualHours=entry?.hours;
        if(actualHours) hours=` · ${actualHours}h`;
      }
    } else if(entry && !truthOnly) {
      source=entry.source || "plan";

      if(plan?.type==="frequency") {
        value=String(entry.value);
      } else {
        value=entry.percent==null
          ? "—"
          : `${Math.round(Number(entry.percent))}%`;
        hours=` · ${entry.hours}h`;
      }
    }

    card.innerHTML=`
      <div class="day">${weekdayLabelForDate(date)}<span class="dayDate">${new Date(`${date}T12:00:00`).getDate()}</span></div>
      <div class="num">${value}</div>
      ${hours ? `<div class="actualMini">${hours.replace(/^\s*·\s*/,"")}</div>` : ""}
    `;

    host.appendChild(card);
  });

  updateWeekNavigatorForHost("challengingWeekPlan");

  const selectedDate=challengingSelectedDate();
  const today=allocationForDate(allocations,selectedDate);
  const selectedActual=actualDataForDate(
    mapping,
    selectedDate,
    mapping?.method || ""
  );
  const selectedTruthOnly=isWriteTruthOnlyDate(
    "challenging",
    mapping?.name,
    selectedDate
  );

  if(mapping?.method==="frequency") {
    $("challengingTodayPlanned").textContent=
      plan?.replaceDate===selectedDate && today && !selectedTruthOnly
        ? (today.value ?? "—")
        : selectedActual.hasActual
          ? "—"
          : selectedTruthOnly
            ? "—"
            : (today?.value ?? "—");

    renderChallengingPattern(
      $("challengingPlannedPattern"),
      [],
      false
    );
  } else {
    $("challengingTodayPlanned").textContent=
      plan?.replaceDate===selectedDate && today && !selectedTruthOnly
        ? `${Math.round(today.percent)}%`
        : selectedActual.hasActual
          ? "—"
          : selectedTruthOnly
            ? "—"
            : today
              ? `${Math.round(today.percent)}%`
              : "—";

    renderChallengingPattern(
      $("challengingPlannedPattern"),
      plan?.replaceDate===selectedDate && today && !selectedTruthOnly
        ? (today.pattern || [])
        : selectedActual.hasActual
          ? (selectedActual.states || [])
          : selectedTruthOnly
            ? []
            : (today?.pattern || []),
      false
    );
  }

  const challengingReplacing=plan?.replaceDate===selectedDate && Boolean(today);
  renderPlanChangePreview(
    "challengingChangePreview",
    selectedDate,
    challengingReplacing && selectedActual.hasActual
      ? (mapping?.method==="frequency"
          ? String(selectedActual.value ?? 0)
          : `${Math.round(Number(selectedActual.value ?? 0))}%`)
      : null,
    challengingReplacing
      ? (mapping?.method==="frequency"
          ? String(today?.value ?? 0)
          : `${Math.round(Number(today?.percent ?? 0))}%`)
      : null
  );
}

async function loadChallengingPlan({preserveInput=false}={}) {
  const name=
    challengingMapping?.name ||
    context.currentName;

  if(!name) return;

  const key=challengingPlanKey(name);
  const saved=await storageGet([key]);
  const plan=saved[key] || null;

  if(plan?.type==="frequency") {
    if(!preserveInput) {
      $("challengingWeeklyTarget").value=
        plan.weeklyTarget ?? "";
    }

    const suppression=validPlanReplacement(
      plan,
      challengingMapping,
      "frequency"
    );

    let refreshed=await withPlanningSuppression(
      suppression,
      ()=>buildChallengingFrequencyPlan(
        Number(plan.weeklyTarget)
      )
    );

    refreshed=addReplacementMeta(
      refreshed,
      suppression
    );

    if(
      String(plan.actualFingerprint || "")!==
        String(refreshed.actualFingerprint || "") ||
      String(plan.planningDatesSignature || planningDatesSignature(plan.planningDates || []))!==
        String(refreshed.planningDatesSignature || planningDatesSignature(refreshed.planningDates || [])) ||
      String(plan.replaceDate || "")!==
        String(refreshed.replaceDate || "")
    ) {
      await storageSet({[key]:refreshed});
      await renderChallengingPlan(refreshed);
      return;
    }
  } else if(plan?.type==="partial_interval") {
    if(!preserveInput) {
      $("challengingWeeklyTarget").value=
        plan.requestedPercent ?? "";
    }

    const suppression=validPlanReplacement(
      plan,
      challengingMapping,
      "partial_interval"
    );

    let refreshed=await withPlanningSuppression(
      suppression,
      ()=>buildChallengingIntervalPlan(
        Number(plan.requestedPercent)
      )
    );

    refreshed=addReplacementMeta(
      refreshed,
      suppression
    );

    if(
      String(plan.actualFingerprint || "")!==
        String(refreshed.actualFingerprint || "") ||
      String(plan.planningDatesSignature || planningDatesSignature(plan.planningDates || []))!==
        String(refreshed.planningDatesSignature || planningDatesSignature(refreshed.planningDates || [])) ||
      String(plan.replaceDate || "")!==
        String(refreshed.replaceDate || "")
    ) {
      await storageSet({[key]:refreshed});
      await renderChallengingPlan(refreshed);
      return;
    }
  } else if(!preserveInput) {
    $("challengingWeeklyTarget").value="";
  }

  await renderChallengingPlan(plan);
}

async function saveChallengingPlan() {
  lastPlanActionSucceeded=false;
  const selectedDate=challengingSelectedDate();
  challengingMapping=await refreshPlanningPeriodIfNeeded(
    ()=>challengingMapping,
    selectedDate
  ) || challengingMapping;

  if(!challengingMapping?.found) {
    validationError(
      "This behavior is still loading from Office Puzzle. Try again in a moment."
    );
    return;
  }

  if(
    challengingMapping.method==="partial_interval" &&
    !(await saveTodayChallengingHours())
  ) return;

  const raw=$("challengingWeeklyTarget").value;
  const target=Number(raw);

  if(raw==="") {
    validationError(
      "Enter a weekly target to continue.",
      "challengingWeeklyTarget"
    );
    return;
  }

  if(
    challengingMapping.method==="frequency" &&
    (!Number.isInteger(target) || target<0)
  ) {
    validationError(
      "Enter a whole number of 0 or more.",
      "challengingWeeklyTarget"
    );
    return;
  }

  if(
    challengingMapping.method!=="frequency" &&
    (!Number.isFinite(target) || target<0 || target>100)
  ) {
    validationError(
      "Enter a percentage from 0 to 100.",
      "challengingWeeklyTarget"
    );
    return;
  }

  const date=challengingSelectedDate();

  const methodHint=
    challengingMapping.method==="frequency"
      ? "frequency"
      : "partial_interval";

  if(!selectedDateIsPlannable(challengingMapping,date,challengingDateForWeekday)) {
    validationError(unavailablePlanningDateMessage(date));
    return;
  }

  const choice=await chooseExistingDataPlan({
    mapping:challengingMapping,
    date,
    methodHint,
    programName:challengingMapping.name
  });

  let plan=await withPlanningSuppression(
    choice.spec,
    ()=>(
      challengingMapping.method==="frequency"
        ? buildChallengingFrequencyPlan(target)
        : buildChallengingIntervalPlan(target)
    )
  );

  plan=addReplacementMeta(plan,choice.spec);

  await storageSet({
    [challengingPlanKey(challengingMapping.name)]:plan
  });

  // A deliberate new plan makes the planned value relevant again. Until this
  // point, a previously failed date remains live-truth-only.
  clearWriteTruthOnlyMapping(
    "challenging",
    challengingMapping,
    date
  );

  closeChallengingReview();
  await renderChallengingPlan(plan);

  if(!quickQueueMode) {
  if(choice.spec) {
    toast(
      `Replacement plan ready for ${friendlyDateLabel(date)}. Nothing changes in Office Puzzle until you Apply or Run.`,
      5200
    );
  } else if(choice.hasActual) {
    toast(
      `Kept the current entry for ${friendlyDateLabel(date)} and planned the remaining days.`,
      4700
    );
  } else {
    toast("Plan ready.");
  }

    }

lastPlanActionSucceeded=true;
}

async function getTodayChallengingPlanEntry() {
  const name=challengingMapping?.name;
  if(!name) return null;

  const key=challengingPlanKey(name);
  const saved=await storageGet([key]);
  const plan=saved[key] || null;

  const date=challengingSelectedDate();
  return allocationForDate(plan?.allocations,date) || null;
}

async function openChallengingReview() {
  if(!$("challengingReviewPanel").hidden) {
    confirmChallengingReview();
    return;
  }

  if(!challengingMapping?.found || challengingMapping.method!=="partial_interval") {
    toast("This behavior is still loading from Office Puzzle. Try again in a moment.");
    return;
  }

  const today=await getTodayChallengingPlanEntry();

  if(!today?.pattern?.length) {
    toast("No plan for this day yet. Press Add + Next to create one.");
    return;
  }

  const currentIntervals=intervalsForHours($("challengingHours").value);

  if(today.pattern.length!==currentIntervals) {
    toast("Hours changed. Regenerate the week before reviewing intervals.");
    return;
  }

  reviewedChallengingStates=[...today.pattern];
  challengingReviewConfirmed=false;
  renderReviewedChallengingGrid();

  $("challengingReviewPanel").hidden=false;
  updateReviewActionButton("challenging");
}

function closeChallengingReview() {
  $("challengingReviewPanel").hidden=true;
  challengingReviewConfirmed=false;
  updateReviewActionButton("challenging");
}


async function refreshChallengingActualFromOfficePuzzle({render=true,attempts=3}={}) {
  const expectedName=normalizeProgramSearch(challengingMapping?.name);

  for(let attempt=1; attempt<=Math.max(1,attempts); attempt++) {
    try {
      const fresh=await sendTab({type:"SCAN_CURRENT_CHALLENGING"});

      if(
        fresh?.ok &&
        fresh?.found &&
        normalizeProgramSearch(fresh.name)===expectedName
      ) {
        challengingMapping={...fresh};
        challengingMappingsByName[challengingMapping.name]=challengingMapping;

        if(render) {
          await renderChallengingMapping(true);
          // Rebuild the strip from verified Office Puzzle truth. Failed dates
          // stay truth-only, so a saved plan cannot masquerade as recorded data.
          await loadChallengingPlan({preserveInput:true});
        }

        return true;
      }
    } catch (_) {}

    if(attempt<attempts) await batchDelay(90+attempt*70);
  }

  return false;
}

function partialIntervalFailureIsRetryable(result) {
  if(!result || result.ok || result.aborted || result.cancelled) return false;

  const message=String(result.error || "").toLowerCase();

  // Deterministic validation / eligibility failures should be surfaced
  // immediately. Everything else is safe to re-read and retry because the
  // writer begins from the cell's CURRENT observed state.
  return !(
    message.includes("unavailable for recording") ||
    message.includes("does not have a valid exact-name") ||
    message.includes("active interval count") ||
    message.includes("reviewed interval outcomes") ||
    message.includes("requested") && message.includes("hours was not written") ||
    message.includes("selected office puzzle date changed") ||
    // Programmer/runtime failures are not transient Office Puzzle conditions.
    // Retrying the same broken code three times only wastes time and can leave
    // a partially written column harder to reason about.
    message.includes("assignment to constant variable") ||
    message.includes(" is not defined") ||
    message.includes(" is not a function")
  );
}

async function runPartialIntervalWriteWithRecovery({
  mapping,
  states,
  activeIntervals,
  selectedDate,
  maxAttempts=3
}) {
  let liveMapping=mapping;
  let lastResult=null;
  let attempts=0;

  for(let attempt=1; attempt<=maxAttempts; attempt++) {
    attempts=attempt;

    try {
      const writeToken=await armOneWrite();

      lastResult=await sendTab({
        type:"SET_CHALLENGING_INTERVALS",
        mapping:liveMapping,
        desiredStates:[...states],
        activeIntervals,
        writeToken
      });
    } catch(err) {
      lastResult={
        ok:false,
        verified:false,
        error:String(err?.message || err || "Office Puzzle write attempt failed.")
      };
    }

    if(lastResult?.ok && lastResult?.verified) {
      return {
        ok:true,
        result:lastResult,
        mapping:liveMapping,
        attempts
      };
    }

    if(lastResult?.aborted || lastResult?.cancelled) {
      return {
        ok:false,
        result:lastResult,
        mapping:liveMapping,
        attempts
      };
    }

    if(
      attempt>=maxAttempts ||
      !partialIntervalFailureIsRetryable(lastResult)
    ) {
      break;
    }

    // Never assume the prior click failed. Give Office Puzzle a short settle
    // window, then re-read the real current table and continue from whatever
    // + / blank / - state it actually contains.
    await batchDelay(140 + (attempt-1)*120);

    try {
      const refreshed=await refreshChallengingActualFromOfficePuzzle({
        render:false,
        attempts:1
      });

      if(refreshed && challengingMapping?.found) {
        liveMapping={...challengingMapping};
      }
    } catch(_) {
      // Keep the last verified mapping and let the next writer attempt rebind
      // against the live Office Puzzle table. A failed refresh must not abort
      // the silent recovery cycle.
    }
  }

  return {
    ok:false,
    result:lastResult || {ok:false,error:"Office Puzzle did not verify the planned entry."},
    mapping:liveMapping,
    attempts
  };
}

function finishSuccessfulChallengingIntervalWrite({
  mapping,
  result,
  selectedDate
}) {
  const finalStates=Array(CLIENT2_MAX_INTERVALS).fill("");

  (result.finalStates || []).forEach(
    (state,index)=>{
      finalStates[index]=state;
    }
  );

  challengingMapping={
    ...mapping,
    currentStates:finalStates,
    currentAverage:result.finalAverage,
    dailyAverages:{
      ...(mapping.dailyAverages||{}),
      [selectedDate]:result.finalAverage
    },
    dailyStates:{
      ...(mapping.dailyStates||{}),
      [selectedDate]:[...finalStates]
    }
  };

  clearWriteTruthOnlyMapping(
    "challenging",
    mapping,
    selectedDate
  );

  challengingMappingsByName[
    mapping.name
  ]=challengingMapping;

  challengingReviewConfirmed=false;
  renderChallengingMapping();

  showRbtActionResult({
    success:true,
    title:"Applied successfully",
    message:
      `${applyActionStatusMessage(
        mapping.name,
        selectedDate
      )}\nOffice Puzzle was updated and verified.`
  });
}

async function retryChallengingIntervalOneOff({
  mapping,
  states,
  activeIntervals,
  selectedDate
}) {
  showRbtActionProgress({
    title:"Retrying safely…",
    message:applyActionStatusMessage(mapping?.name,selectedDate)
  });

  await batchDelay(180);
  await refreshChallengingActualFromOfficePuzzle({render:false});

  const liveMapping=
    challengingMapping?.found
      ? {...challengingMapping}
      : mapping;

  const recovered=await runPartialIntervalWriteWithRecovery({
    mapping:liveMapping,
    states,
    activeIntervals,
    selectedDate,
    maxAttempts:3
  });

  if(recovered.ok) {
    finishSuccessfulChallengingIntervalWrite({
      mapping:recovered.mapping,
      result:recovered.result,
      selectedDate
    });
    return;
  }

  markWriteTruthOnlyMapping(
    "challenging",
    recovered.mapping || mapping,
    selectedDate
  );
  await refreshChallengingActualFromOfficePuzzle();

  const baseError=
    recovered.result?.error ||
    "Office Puzzle did not verify the planned entry.";

  showRbtApplyProblem(
    {
      ...recovered.result,
      error:
        `${baseError} Automatic recovery tried ${recovered.attempts} times.`
    },
    "Office Puzzle did not verify the planned entry.",
    {
      retry:()=>retryChallengingIntervalOneOff({
        mapping:recovered.mapping,
        states:[...states],
        activeIntervals,
        selectedDate
      })
    }
  );
}

async function applyChallengingIntervals() {
  const planned=await plannedChallengingIntervalStates();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  let {
    mapping,
    states,
    activeIntervals,
    selectedDate,
    replacingExisting
  }=planned;

  const proceed=await confirmOneOffOverwrite({
    replacingExisting,
    name:mapping.name,
    selectedDate
  });

  if(!proceed) return;

  showRbtActionProgress({
    title:
      replacingExisting
        ? "Replacing…"
        : "Writing…",
    message:
      applyActionStatusMessage(
        mapping.name,
        selectedDate
      )
  });

  const prepared=await prepareDirectReplacementWrite({
    mapping,
    writerKind:"partial_interval",
    replacingExisting
  });

  if(!prepared.ok) {
    showRbtApplyProblem(
      prepared,
      "Office Puzzle could not prepare the replacement."
    );
    return;
  }

  mapping=prepared.mapping;

  reviewedChallengingStates=[...states];
  challengingReviewConfirmed=true;

  const recovered=await runPartialIntervalWriteWithRecovery({
    mapping,
    states,
    activeIntervals,
    selectedDate,
    maxAttempts:3
  });

  if(!recovered.ok) {
    markWriteTruthOnlyMapping(
      "challenging",
      recovered.mapping || mapping,
      selectedDate
    );
    await refreshChallengingActualFromOfficePuzzle();

    if(recovered.result?.aborted || recovered.result?.cancelled) {
      showRbtApplyProblem(
        recovered.result,
        "Office Puzzle did not verify the planned entry."
      );
      return;
    }

    const baseError=
      recovered.result?.error ||
      "Office Puzzle did not verify the planned entry.";

    showRbtApplyProblem(
      {
        ...recovered.result,
        error:
          `${baseError} Automatic recovery tried ${recovered.attempts} times.`
      },
      "Office Puzzle did not verify the planned entry.",
      {
        retry:()=>retryChallengingIntervalOneOff({
          mapping:recovered.mapping,
          states:[...states],
          activeIntervals,
          selectedDate
        })
      }
    );
    return;
  }

  finishSuccessfulChallengingIntervalWrite({
    mapping:recovered.mapping,
    result:recovered.result,
    selectedDate
  });
}

async function applyChallengingFrequencyCount() {
  const planned=await selectedChallengingPlannedCount();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  const {
    mapping:plannedMapping,
    target,
    selectedDate,
    replacingExisting
  }=planned;

  challengingMapping=plannedMapping;

  const proceed=await confirmOneOffOverwrite({
    replacingExisting,
    name:challengingMapping.name,
    selectedDate
  });

  if(!proceed) return;

  showRbtActionProgress({
    title:
      replacingExisting
        ? "Replacing…"
        : "Writing…",
    message:
      applyActionStatusMessage(
        challengingMapping.name,
        selectedDate
      )
  });

  let writeToken=await armOneWrite();

  let result=await sendTab({
    type:"SET_BEHAVIOR_COUNT",
    mapping:challengingMapping,
    target,
    replaceExisting:
      Boolean(replacingExisting),
    writeToken
  });

  if(result?.requiresReplace) {
    const ok=await rbtConfirm({
      title:"Entry changed",
      message:
        "Office Puzzle now has different data for this date. Replace the current entry with the plan?",
      confirmText:"Confirm",
      keepOpenOnConfirm:true
    });

    if(!ok) return;

    showRbtActionProgress({
      title:"Replacing entry…",
      message:
        applyActionStatusMessage(
          challengingMapping.name,
          selectedDate
        )
    });

    writeToken=await armOneWrite();

    result=await sendTab({
      type:"SET_BEHAVIOR_COUNT",
      mapping:challengingMapping,
      target,
      replaceExisting:true,
      writeToken
    });
  }

  if(!result?.ok) {
    showRbtApplyProblem(
      result,
      "Office Puzzle could not be updated."
    );
    return;
  }

  challengingMapping={
    ...challengingMapping,
    currentCount:target,
    dailyCounts:{
      ...(challengingMapping.dailyCounts||{}),
      [challengingMapping.selectedDate]:
        target
    }
  };

  challengingMappingsByName[
    challengingMapping.name
  ]=challengingMapping;

  renderChallengingMapping();

  showRbtActionResult({
    success:true,
    title:"Applied successfully",
    message:
      `${applyActionStatusMessage(
        challengingMapping.name,
        selectedDate
      )}\nOffice Puzzle was updated and verified.`
  });
}

async function renderChallengingMapping(preserveDraft=false) {
  const rawName=challengingMapping?.name || selectedChallengingName();
  const config=challengingConfig(rawName);
  const method=challengingMapping?.method || config?.method || "";

  const configuredIndex=CHALLENGING.findIndex(item=>item.name===rawName);
  if(configuredIndex>=0) {
    selectedChallengingIndex=configuredIndex;
  }

  $("challengingSelect").value=String(selectedChallengingIndex);
  syncCustomSelect("challengingSelect");
  updateProgramProgress(
    "challengingPosition",
    "challengingPositionBar",
    selectedChallengingIndex+1,
    CHALLENGING.length
  );
  $("challengingName").textContent=rawName;
  $("challengingSelectedDate").textContent=challengingSelectedDate();

  const partial=method==="partial_interval";
  const frequency=method==="frequency";

  $("challengingMethodBadge").textContent=
    partial ? "Partial Interval" :
    frequency ? "Frequency" : "—";

  $("challengingWeeklyTargetLabel").textContent=
    partial ? "Weekly target percentage" : "Weekly total for this behavior";

  $("challengingWeeklyTarget").max=partial ? "100" : "";
  $("challengingWeeklyTarget").step=partial ? "1" : "1";

  $("challengingFrequencyApply").hidden=!frequency;
  $("challengingIntervalApply").hidden=!partial;

  // Hours live in the compact client header now. Keep the legacy input only
  // as the internal value used by planning/writing code.
  $("challengingHoursField").hidden=true;
  $("challengingTodayHoursWrap").hidden=true;
  $("challengingHours").disabled=false;

  const savedHours=Number($("challengingHours").value || client2DayHoursValue || CLIENT2_DEFAULT_HOURS);
  syncClientHoursControl(savedHours,{partial});

  if(!partial) {
    $("challengingTodayHours").textContent=`${savedHours}h`;
  }

  if(challengingMapping?.found) {
    if(frequency) {
      $("challengingCurrentValue").textContent=
        challengingMapping.currentCount ?? 0;

      $("challengingStatus").textContent=
        `Current Frequency table mapped · Existing count today: ${challengingMapping.currentCount ?? 0} · ` +
        `Grid max: ${challengingMapping.maxOccurrences ?? "—"}`;
    } else {
      const hours=Number($("challengingHours").value || CLIENT2_DEFAULT_HOURS);
      const active=intervalsForHours(hours);
      const states=(challengingMapping.currentStates||[]).slice(0,active);
      const populated=states.filter(Boolean).length;
      const pluses=states.filter(state=>state==="+").length;

      $("challengingCurrentValue").textContent=
        challengingMapping.currentAverage == null
          ? "—"
          : `${Math.round(Number(challengingMapping.currentAverage))}%`;

      $("challengingStatus").textContent=
        `Current Partial Interval table mapped · ${populated}/${active} active intervals populated · ` +
        `${pluses} occurrence intervals.`;
    }

    $("challengingStatus").style.background="#eaf8f2";
    $("challengingStatus").style.color="#126849";
  } else {
    $("challengingCurrentValue").textContent="—";
    $("challengingStatus").textContent=
      challengingMapping?.errorHint ||
      "Scan the current challenging behavior table.";
    $("challengingStatus").style.background="#fff0f0";
    $("challengingStatus").style.color="#8b3434";
  }

  updateChallengingHoursHint();

  if(!preserveDraft) {
    await loadChallengingPlan();
  }
}

async function scanCurrentChallenging() {
  if(challengingScanInProgress) {
    toast("A scan is already running.");
    return;
  }

  challengingScanInProgress=true;

  try {
    if($("scanChallenging")) $("scanChallenging").disabled=true;
    $("challengingScanSummary").textContent=
      "Discovering behavior names, methods, and table structures…";
    await discoverAndApplyClientPrograms({preserveDraft:true,manual:true});
  } finally {
    challengingScanInProgress=false;
    if($("scanChallenging")) $("scanChallenging").disabled=false;
  }
}

async function clearCurrentClientExtensionWork() {
  const planKeys=new Set();

  for(const name of BEHAVIORS) {
    planKeys.add(planStorageKey(name));
  }

  for(const name of REPLACEMENTS) {
    planKeys.add(replacementPlanStorageKey(name));
  }

  for(const item of CHALLENGING) {
    const name=typeof item==="string" ? item : item?.name;
    if(name) planKeys.add(challengingPlanKey(name));
  }

  for(const name of CLIENT2_REPLACEMENTS) {
    planKeys.add(client2ReplacementPlanKey(name));
  }

  // Hours are extension-side planning inputs, so reset the selected week too.
  for(const day of DAYS) {
    planKeys.add(
      challengingHoursKey(
        challengingDateForWeekday(day.key)
      )
    );
  }

  if(planKeys.size) {
    await storageRemove([...planKeys]);
  }

  // Clear every batch type for the current client/date context, including
  // ready, stopped, failed and completed rows.
  const batchKeys=Object.keys(batchState).map(batchStorageKey);
  await storageRemove(batchKeys);

  for(const kind of Object.keys(batchState)) {
    batchState[kind]=[];
  }

  batchContextKey=currentBatchContextKey();

  autoBatchState.armed=false;
  autoBatchState.busy=false;
  autoBatchState.stoppedOnError=false;
  autoBatchState.completed=false;
  autoBatchState.lastContextSignature="";
  autoBatchState.lockedTabId=null;

  await persistAutoBatchRunnerState();

  client2DayHoursValue=CLIENT2_DEFAULT_HOURS;
  client2DayHoursDate="";

  renderAllBatches();
  updateAutoProgress();

  // Remove generated/planned values from the visible workflow while still
  // allowing already-recorded Office Puzzle actual data to remain untouched.
  if(context?.pageType==="maladaptive") {
    renderWeek(null);
  } else if(context?.pageType==="replacement") {
    renderReplacementPlan(null);
    renderPatternInto(
      $("plannedTrialPattern"),
      Array(10).fill(""),
      true
    );
  } else if(context?.pageType==="challenging") {
    await renderChallengingPlan(null);
    renderChallengingPattern(
      $("challengingPlannedPattern"),
      [],
      false
    );
  } else if(context?.pageType==="client2replacement") {
    await renderClient2ReplacementPlan(null);
    renderChallengingPattern(
      $("client2ReplacementPlannedPattern"),
      [],
      false
    );
  }
}

function clearUserEnteredFormState() {
  const inputIds=[
    "weeklyTarget",
    "replacementWeeklyTarget",
    "challengingWeeklyTarget",
    "client2ReplacementWeeklyTarget",
    "challengingHours"
  ];

  for(const id of inputIds) {
    const field=$(id);
    if(!field) continue;

    field.value="";
    field.classList.remove("validationFieldError");
  }

  // Clear temporary review edits / confirmations. These are extension-side
  // working values only and are not Office Puzzle data.
  reviewedTrialStates=Array(10).fill("");
  reviewedClient2ReplacementStates=[];
  reviewedChallengingStates=[];

  closeReplacementReview();
  closeClient2ReplacementReview();
  closeChallengingReview();

  renderReviewedTrialGrid();

  const toastEl=$("toast");
  if(toastEl) {
    toastEl.hidden=true;
    toastEl.textContent="";
    toastEl.classList.remove("validationToast");
  }

  updateStickyActionBar();
}

async function clearInputsAndRefreshContext() {
  if(
    activeWriteUiState.busy ||
    autoBatchState.busy ||
    batchRunningKind
  ) {
    toast("Stop the active write or batch before refreshing.");
    return;
  }

  // Explicit Refresh is the one user action that invalidates BOTH the learned
  // program inventory for the current page and the client-level writable-date
  // lock. Clear those first, then let refreshContext perform the normal ordered
  // pipeline: inventory scan -> restore -> one fresh client date read.
  await forgetRememberedFullInventory(context?.clientLabel,context?.pageType);
  fullInventoryWarmCache={key:"",at:0,result:null};
  dateNavigationState.verifiedClientKey="";
  dateNavigationState.verifiedDay="";
  await refreshContext(null,{forceClientDates:true});
  await clearCurrentClientExtensionWork();
  clearUserEnteredFormState();

  toast("Refreshed. Program list relearned; Office Puzzle data was not changed.");
}

async function readContextAfterInventoryScan(fallbackContext,{needWritableDates=true}={}) {
  // The full inventory sweep temporarily moves/virtualizes the Office Puzzle
  // page. Date availability must be sampled only AFTER that sweep has restored
  // the user's exact position and the selected program/date table has remounted.
  // A few short reads are cheaper and much safer than accepting a stale/empty
  // Days row captured mid-scan.
  let best=fallbackContext?.ok ? fallbackContext : null;

  const maxAttempts=needWritableDates ? 5 : 2;

  for(let attempt=0; attempt<maxAttempts; attempt++) {
    if(attempt>0) await new Promise(resolve=>setTimeout(resolve,75));

    let fresh=null;
    try {
      fresh=await sendTab({type:"GET_CONTEXT"});
    } catch(_) {
      fresh=null;
    }

    if(!fresh?.ok) continue;

    const sameClient=
      cleanClientKey(fresh.clientLabel || "client")===
      cleanClientKey(fallbackContext?.clientLabel || fresh.clientLabel || "client");
    const samePage=
      String(fresh.pageType || "")===
      String(fallbackContext?.pageType || fresh.pageType || "");

    if(!sameClient || !samePage) {
      // The user actually changed client/page while the scan was running.
      // Return the new live context so refreshContext can naturally switch to it.
      return fresh;
    }

    best=fresh;

    // Same-client page changes reuse the already verified client-level date
    // set, so one settled live page sample is enough. Do not spend extra
    // retries waiting for a date row we intentionally are not relearning.
    if(!needWritableDates) return fresh;

    // Non-empty writable dates are the preferred settled result when a new
    // client/day actually requires date learning.
    if(Array.isArray(fresh.availableDates) && fresh.availableDates.length) {
      return fresh;
    }
  }

  return best || fallbackContext;
}

let contextRefreshPromise=null;
let pendingContextRefresh=null;
let activeContextRefreshRequest=null;

function mergePendingContextRefresh(prefetchedContext,options={}) {
  const next={
    prefetchedContext:prefetchedContext?.ok ? prefetchedContext : null,
    options:{
      forceClientDates:!!options.forceClientDates,
      forcePageInventory:!!options.forcePageInventory
    }
  };

  if(!pendingContextRefresh) {
    pendingContextRefresh=next;
    return;
  }

  if(next.prefetchedContext) pendingContextRefresh.prefetchedContext=next.prefetchedContext;
  pendingContextRefresh.options.forceClientDates ||= next.options.forceClientDates;
  pendingContextRefresh.options.forcePageInventory ||= next.options.forcePageInventory;
}

async function refreshContext(prefetchedContext=null,options={}) {
  if(contextRefreshPromise) {
    const incoming={
      prefetchedContext:prefetchedContext?.ok ? prefetchedContext : null,
      options:{
        forceClientDates:!!options.forceClientDates,
        forcePageInventory:!!options.forcePageInventory
      }
    };
    const active=activeContextRefreshRequest;
    const incomingSignature=incoming.prefetchedContext
      ? contextSignature(incoming.prefetchedContext)
      : "";
    const activeSignature=active?.prefetchedContext
      ? contextSignature(active.prefetchedContext)
      : "";
    const sameRequestContext=
      incomingSignature && activeSignature && incomingSignature===activeSignature;
    const activeAlreadyCovers=Boolean(
      sameRequestContext &&
      (!incoming.options.forceClientDates || active?.options?.forceClientDates) &&
      (!incoming.options.forcePageInventory || active?.options?.forcePageInventory)
    );

    // Route, DOM and heartbeat signals often describe the exact same SPA
    // transition. If the active refresh already includes the requested work,
    // simply share its promise instead of queueing a second forced scan.
    if(!activeAlreadyCovers) {
      mergePendingContextRefresh(prefetchedContext,options);
    }
    return contextRefreshPromise;
  }

  const first={
    prefetchedContext:prefetchedContext?.ok ? prefetchedContext : null,
    options:{
      forceClientDates:!!options.forceClientDates,
      forcePageInventory:!!options.forcePageInventory
    }
  };

  contextRefreshPromise=(async()=>{
    let request=first;
    let result=null;

    while(request) {
      activeContextRefreshRequest=request;
      result=await performRefreshContext(
        request.prefetchedContext,
        request.options
      );

      request=pendingContextRefresh;
      pendingContextRefresh=null;

      if(request) {
        // If the queued signal still describes the context we just finished,
        // and it does not ask for a stronger refresh, do not run the pipeline
        // again. This is the common route+mutation duplicate case.
        const live=request.prefetchedContext;
        const sameSignature=
          live?.ok &&
          contextSignature(live)===contextSignature(context);
        const stronger=
          request.options.forceClientDates ||
          request.options.forcePageInventory;

        if(sameSignature && !stronger) request=null;
      }
    }

    return result;
  })();

  try {
    return await contextRefreshPromise;
  } finally {
    contextRefreshPromise=null;
    activeContextRefreshRequest=null;
    // A signal can arrive in the tiny completion window after the loop's last
    // pending check. Preserve it rather than losing the refresh request.
    if(pendingContextRefresh) {
      const queued=pendingContextRefresh;
      pendingContextRefresh=null;
      queueMicrotask(()=>refreshContext(queued.prefetchedContext,queued.options));
    }
  }
}

async function performRefreshContext(prefetchedContext=null,{forceClientDates=false,forcePageInventory=false}={}) {
  try {
    const previousClientKey=credibleClientLabel(context?.clientLabel)
      ? cleanClientKey(context.clientLabel)
      : "";
    const previousPageType=String(context?.pageType || "");

    const initial=prefetchedContext?.ok
      ? prefetchedContext
      : await sendTab({type:"GET_CONTEXT"});

    if(!initial?.ok) throw new Error("Unable to read Office Puzzle.");

    if(!isDataSheetsRoute(initial)) {
      await stopActiveWorkForMissingClient();
      cancelSameClientPageHandoff();
      showClientSelectionGate();
      hideStartupSkeleton();
      $("clientLabel").textContent="No client selected";
      $("pageType").textContent="Select a client in Office Puzzle";
      if($("connectionBadge")) $("connectionBadge").hidden=true;
      return;
    }

    if(!hasUsableDataContext(initial)) {
      // Still on /data/sheets: this is a mount/transition state, not "no
      // client". Keep the existing UI stable and let route/DOM discovery call
      // us again when the new table is ready.
      hideClientSelectionGate();
      const key=cleanClientKey(context?.clientLabel || "");
      if(key) scheduleSameClientPageHandoffCheck(key);
      return;
    }

    await stopForClientContextChange(initial);
    hideClientSelectionGate();

    const incomingClientKey=cleanClientKey(initial.clientLabel || "client");
    const clientChanged=Boolean(previousClientKey && previousClientKey!==incomingClientKey);
    const pageChanged=Boolean(
      previousPageType &&
      previousPageType!==String(initial.pageType || "")
    );
    const forcePageInventoryScan=Boolean(forcePageInventory || clientChanged || pageChanged);
    const todayForDateInventory=localTodayISODate();
    const mustLearnClientDates=Boolean(
      forceClientDates ||
      dateNavigationState.verifiedClientKey!==incomingClientKey ||
      dateNavigationState.verifiedDay!==todayForDateInventory ||
      !(dateNavigationState.availableDates || []).length
    );

    // Establish only the client/page identity first. DO NOT commit writable
    // dates yet: the inventory scanner may still need to lazy-load/restore the
    // real Office Puzzle page, and a date read during that movement can be
    // incomplete or stale.
    context=initial;
    clientKey=cleanClientKey(initial.clientLabel);

    if(Number.isFinite(Number(initial.domRevision))) {
      lastSeenDomRevision=Number(initial.domRevision);
    }

    const statusKey=autoScanContextKey(initial);
    if(!autoScanContextStatus[statusKey]) {
      autoScanContextStatus[statusKey]={
        complete:false,
        lastScanAt:0
      };
      lastAutoScanAt=0;
      autoProfileLastScanAt=0;
    }

    await loadAutoClientProfile(initial.clientLabel);
    await seedRememberedInventoryFromLearnedProfile(initial.clientLabel,initial.pageType);
    await applyRememberedFullInventory(initial.clientLabel,initial.pageType);
    renderAutoProfileStatus();

    $("clientLabel").textContent=initial.clientLabel||"Client";
    $("pageType").textContent =
      initial.pageType==="maladaptive" ? "Maladaptive Behaviors" :
      initial.pageType==="challenging" ? "Challenging Behaviors" :
      initial.pageType==="client2replacement" ? "Replacement Behaviors / Skill Acquisitions" :
      initial.pageType==="replacement" ? "Replacement / Acquisition" :
      "Office Puzzle";

    if($("connectionBadge")) $("connectionBadge").hidden=true;
    showOnlyContextSection(initial.pageType);
    hideStartupSkeleton();

    // ORDER MATTERS:
    // 1) finish/reuse the complete Behavior/Replacement inventory
    // 2) let the real Office Puzzle page restore/remount
    // 3) freshly read writable dates
    // 4) only then load batches/plans/render the date strip
    //
    // Previously warmFullProgramInventory() was fire-and-forget and dates were
    // committed BEFORE the scan, which is how stale 28-30 style strips survived
    // even after Office Puzzle had exposed newer writable columns.
    try {
      // Office Puzzle resets/lazy-loads the program page whenever the client or
      // Behaviors/Replacements page changes. Re-run the REAL scroll inventory
      // sweep for that page even if we already remember its names. Writable
      // dates remain client-scoped and are intentionally NOT relearned merely
      // because the page type changed.
      await warmFullProgramInventory({force:forcePageInventoryScan});
    } catch(_) {
      // Inventory errors should not make the entire side panel unusable. We still
      // perform the post-scan live date read below.
    }

    const settled=await readContextAfterInventoryScan(initial,{needWritableDates:mustLearnClientDates});
    if(settled?.ok) {
      context=settled;
      clientKey=cleanClientKey(settled.clientLabel);
    }

    lastPassiveContextSignature=contextSignature(context);

    if(Number.isFinite(Number(context.domRevision))) {
      lastSeenDomRevision=Number(context.domRevision);
    }

    // Writable dates are learned ONCE per client/day, after the inventory scan
    // has fully restored the Office Puzzle page. Once learned, switching among
    // this client's Behaviors/Replacements pages reuses the exact same set.
    refreshDateNavigationStateFromContext(context,{forceDates:mustLearnClientDates});
    await loadBatchesForContext();

    // The scan can discover a different current page/client if the user changed
    // Office Puzzle while it was running. Keep visible labels in sync with the
    // final post-scan context rather than the provisional one.
    $("clientLabel").textContent=context.clientLabel||"Client";
    $("pageType").textContent =
      context.pageType==="maladaptive" ? "Maladaptive Behaviors" :
      context.pageType==="challenging" ? "Challenging Behaviors" :
      context.pageType==="client2replacement" ? "Replacement Behaviors / Skill Acquisitions" :
      context.pageType==="replacement" ? "Replacement / Acquisition" :
      "Office Puzzle";
    showOnlyContextSection(context.pageType);

    if(context.pageType==="maladaptive") {
      renderSelectedBehavior();
      $("scanSummary").textContent="Auto-scan ready…";
    }

    if(context.pageType==="challenging") {
      const selectedName=selectedChallengingName();
      challengingMapping=
        challengingMappingsByName[selectedName] ||
        {
          name:selectedName,
          method:challengingConfig(selectedName)?.method || "",
          selectedDate:context.selectedDate || null,
          found:false,
          errorHint:`Open "${selectedName}" in Office Puzzle and scan it to read actual data.`
        };

      await loadTodayChallengingHours();
      await renderChallengingMapping();
    }

    if(context.pageType==="client2replacement") {
      const selectedName=selectedClient2ReplacementName();
      client2ReplacementMapping=
        client2ReplacementMappingsByName[selectedName] ||
        client2ReplacementPlaceholder(selectedName);
      client2ReplacementMapping.selectedDate=
        client2ReplacementMapping.selectedDate || context.selectedDate || null;
      await renderClient2Replacement();
    }

    if(context.pageType==="replacement") {
      renderSelectedReplacement();
      $("replacementScanSummary").textContent="Auto-scan ready…";
    }

    await saveBootSnapshot(context,null);

    // Read-only current-DOM mapping discovery happens AFTER the post-inventory
    // date commit. It may enrich program mappings but cannot overwrite the date
    // strip with a pre-scan snapshot.
    await discoverAndApplyClientPrograms({
      preserveDraft:true,
      manual:false
    });

    // Discovery can mount the selected program table more completely. Take one
    // final cheap context sample so newly writable columns exposed by that mount
    // appear immediately without waiting for the passive heartbeat.
    try {
      const finalContext=await sendTab({type:"GET_CONTEXT"});
      if(finalContext?.ok) {
        const sameClient=
          cleanClientKey(finalContext.clientLabel || "client")===
          cleanClientKey(context.clientLabel || "client");
        const samePage=String(finalContext.pageType || "")===String(context.pageType || "");

        if(sameClient && samePage) {
          context={...context,...finalContext};
          refreshDateNavigationStateFromContext(context);
          lastPassiveContextSignature=contextSignature(context);
          if(Number.isFinite(Number(context.domRevision))) {
            lastSeenDomRevision=Number(context.domRevision);
          }
        }
      }
    } catch(_) {}

    updateStickyActionBar();
  } catch(err) {
    hideStartupSkeleton();

    // Error handling must follow the same URL-first gate rule. A transient DOM
    // or scanner error while still on /data/sheets should not masquerade as
    // "no client selected".
    let live=null;
    try { live=await sendTab({type:"GET_CONTEXT"}); } catch(_) {}

    if(!live?.ok || isDataSheetsRoute(live)) {
      hideClientSelectionGate();
      if(live?.ok && $("pageType") && !hasUsableDataContext(live)) {
        $("pageType").textContent="Loading client data…";
      }
      return;
    }

    showClientSelectionGate();
    $("clientLabel").textContent="No client selected";
    $("pageType").textContent=String(err?.message || "Select a client in Office Puzzle");
    if($("connectionBadge")) $("connectionBadge").hidden=true;
  }
}

function selectedReplacementMapping() {
  const name=REPLACEMENTS[selectedReplacementIndex];

  return replacementMappings.find(x=>x.name===name) || {
    name,
    found:false,
    selectedDate:null,
    currentStates:Array(10).fill(""),
    currentAverage:null,
    tableId:null,
    dailyAverages:{}
  };
}

function replacementSelectedDateObject() {
  const raw=
    dateNavigationState.selectedDate ||
    context?.selectedDate ||
    selectedReplacementMapping()?.selectedDate ||
    localTodayISODate();
  return new Date(`${raw}T12:00:00`);
}

function replacementWeekKey() {
  const selected=isoDate(replacementSelectedDateObject());
  return planningPeriodKey(selectedReplacementMapping(),selected,replacementDateForWeekday);
}

function replacementPlanStorageKey(programName) {
  return `replacementWeeklyPlan::${clientKey}::${replacementWeekKey()}::${programName}`;
}

function replacementDateForWeekday(dayKey) {
  const mon=mondayOf(replacementSelectedDateObject());
  const d=new Date(mon);
  d.setDate(mon.getDate() + (dayKey - 1));
  return isoDate(d);
}

function replacementSelectedDayKey() {
  return isoWeekdayKey(replacementSelectedDateObject());
}

function replacementHistoryInfo() {
  const mapping=selectedReplacementMapping();
  const selected=isoDate(replacementSelectedDateObject());
  const dates=planningDatesForMapping(mapping,selected,replacementDateForWeekday);
  let totalSuccesses=0;
  let completedActualDays=0;
  const perDate={};
  const actualDates=[];

  for(const date of dates) {
    const actual=actualDataForDate(mapping,date,"percentage_opportunities");
    const average=actual.hasActual && Number.isFinite(Number(actual.value)) ? Number(actual.value) : null;
    perDate[date]=average;
    if(Number.isFinite(average)) {
      totalSuccesses+=Math.max(0,Math.min(10,Math.round(average/10)));
      completedActualDays++;
      actualDates.push(date);
    }
  }
  return {
    dates,totalSuccesses,completedPastDays:completedActualDays,completedActualDays,
    actualDates,actualDayKeys:actualDates.map(isoWeekdayKey),
    actualFingerprint:actualFingerprintForDates(mapping,dates,"percentage_opportunities"),
    perDate
  };
}

function chooseWeeklySuccessTarget(requestedPercent,totalTrials=50) {
  const requested=Math.max(0,Math.min(100,Number(requestedPercent)));
  const safeTrials=Math.max(10,Math.round(Number(totalTrials)||50));
  const exact=(requested/100)*safeTrials;
  let successes;
  if(Number.isInteger(exact)) successes=exact;
  else {
    const lower=Math.floor(exact);
    const upper=Math.ceil(exact);
    const frac=exact-lower;
    successes=Math.abs(frac-0.5)<1e-9
      ? (Math.random()<0.5 ? lower : upper)
      : (frac<0.5 ? lower : upper);
  }
  return {
    requestedPercent:requested,
    targetSuccesses:successes,
    achievablePercent:(successes/safeTrials)*100,
    totalTrials:safeTrials
  };
}

function allocateReplacementSuccesses(totalSuccesses, dayKeys) {
  const keys=[...dayKeys];
  const safeTotal=Math.max(
    0,
    Math.min(keys.length*10,Math.round(Number(totalSuccesses)||0))
  );

  // Ten trials per day means one success = 10 percentage points. Keep all
  // unrecorded days within one success (10 points) of each other whenever the
  // requested weekly total allows it. The chosen +1 days are randomized so
  // repeated plans do not always put the higher value on the same weekday.
  const values=allocateCappedRandom(
    safeTotal,
    keys.map(()=>10)
  );

  return keys.map((dayKey,index)=>({
    dayKey,
    successes:values[index]
  }));
}

function shuffledTrialPattern(successes) {
  const n=Math.max(0, Math.min(10, Math.round(successes)));
  const states=[
    ...Array(n).fill("+"),
    ...Array(10-n).fill("-")
  ];

  for(let i=states.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [states[i],states[j]]=[states[j],states[i]];
  }

  return states;
}

function buildReplacementPlan(requestedPercent, forcedTargetSuccesses=null) {
  const mapping=selectedReplacementMapping();
  const selected=isoDate(replacementSelectedDateObject());
  const hist=replacementHistoryInfo();
  const actualDates=new Set(hist.actualDates || []);
  const remainingDates=(hist.dates || []).filter(date=>!actualDates.has(date));
  const totalTrials=Math.max(10,(hist.dates || []).length*10);
  const chosen=forcedTargetSuccesses==null
    ? chooseWeeklySuccessTarget(requestedPercent,totalTrials)
    : {
        requestedPercent:Number(requestedPercent),
        targetSuccesses:Number(forcedTargetSuccesses),
        achievablePercent:(Number(forcedTargetSuccesses)/totalTrials)*100,
        totalTrials
      };
  const desiredRemaining=chosen.targetSuccesses-hist.totalSuccesses;
  const capacity=remainingDates.length*10;
  const plannedRemaining=Math.max(0,Math.min(capacity,desiredRemaining));
  const allocations=[];

  for(const date of hist.dates || []) {
    const average=hist.perDate[date];
    if(Number.isFinite(average)) {
      allocations.push({
        date,dayKey:isoWeekdayKey(date),source:"actual",percent:average,
        successes:Math.round(average/10),pattern:null
      });
    }
  }

  const values=allocateCappedRandom(plannedRemaining,remainingDates.map(()=>10));
  remainingDates.forEach((date,index)=>{
    const successes=values[index];
    allocations.push({
      date,dayKey:isoWeekdayKey(date),source:"plan",successes,percent:successes*10,
      pattern:shuffledTrialPattern(successes)
    });
  });
  allocations.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const projectedSuccesses=hist.totalSuccesses+plannedRemaining;
  return {
    planningDates:[...(hist.dates || [])],planningDatesSignature:planningDatesSignature(hist.dates || []),requestedPercent:Number(requestedPercent),
    targetSuccesses:chosen.targetSuccesses,achievableTargetPercent:chosen.achievablePercent,
    projectedWeeklyPercent:(projectedSuccesses/totalTrials)*100,
    previousSuccesses:hist.totalSuccesses,completedPastDays:hist.completedPastDays,
    actualFingerprint:hist.actualFingerprint,remainingSuccesses:plannedRemaining,remainingCapacity:capacity,
    totalTrials,allocations,updatedAt:new Date().toISOString()
  };
}

function populateReplacementSelect() {
  const select=$("replacementSelect");
  select.innerHTML="";

  REPLACEMENTS.forEach((name,index)=>{
    const option=document.createElement("option");
    option.value=String(index);
    option.textContent=`${index+1}. ${name}`;
    select.appendChild(option);
  });

  select.value=String(selectedReplacementIndex);

  syncCustomSelect("replacementSelect");
}

async function loadReplacementPlan({preserveInput=false}={}) {
  const name=REPLACEMENTS[selectedReplacementIndex];
  const key=replacementPlanStorageKey(name);
  const saved=await storageGet([key]);
  const plan=saved[key]||null;

  if(!preserveInput) {
    $("replacementWeeklyTarget").value=
      plan?.requestedPercent ?? "";
  }

  if(plan?.requestedPercent != null) {
    const mapping=selectedReplacementMapping();
    const suppression=validPlanReplacement(
      plan,
      mapping,
      "percentage_opportunities"
    );

    const liveDates=planningDatesForMapping(
      mapping,
      isoDate(replacementSelectedDateObject()),
      replacementDateForWeekday
    );
    const availabilityChanged=
      planningDatesSignature(plan.planningDates || [])!==
      planningDatesSignature(liveDates);

    let refreshed=await withPlanningSuppression(
      suppression,
      ()=>buildReplacementPlan(
        Number(plan.requestedPercent),
        availabilityChanged ? null : Number(plan.targetSuccesses)
      )
    );

    refreshed=addReplacementMeta(
      refreshed,
      suppression
    );

    if(
      String(plan.actualFingerprint || "")!==
        String(refreshed.actualFingerprint || "") ||
      String(plan.planningDatesSignature || planningDatesSignature(plan.planningDates || []))!==
        String(refreshed.planningDatesSignature || planningDatesSignature(refreshed.planningDates || [])) ||
      String(plan.replaceDate || "")!==
        String(refreshed.replaceDate || "")
    ) {
      await storageSet({[key]:refreshed});
      renderReplacementPlan(refreshed);
      return;
    }
  }

  renderReplacementPlan(plan);
}

function renderPatternInto(host, states, planned=false) {
  host.innerHTML="";

  for(let i=0;i<10;i++) {
    const state=states?.[i] || "";
    const el=document.createElement(planned ? "span" : "button");

    el.className=
      "trialChip " +
      (state==="+" ? "plus" : state==="-" ? "minus" : "blank");

    const index=document.createElement("span");
    index.className="trialIndex";
    index.textContent=String(i+1).padStart(2,"0");

    const symbol=document.createElement("span");
    symbol.className="trialState";
    symbol.textContent=state || "·";

    el.append(index,symbol);

    if(!planned) {
      el.type="button";
      el.dataset.index=String(i);
      el.title=`Trial ${i+1}: ${state || "blank"}`;
    }

    host.appendChild(el);
  }
}

function renderReviewedTrialGrid() {
  const host=$("reviewedTrialGrid");
  if(!host) return;
  renderPatternInto($("reviewedTrialGrid"), reviewedTrialStates, false);

  for(const button of $("reviewedTrialGrid").querySelectorAll("button")) {
    button.addEventListener("click",()=>{
      const i=Number(button.dataset.index);
      const current=reviewedTrialStates[i] || "";

      reviewedTrialStates[i] =
        current==="" ? "-" :
        current==="-" ? "+" : "";

      markReplacementReviewEdited();
      renderReviewedTrialGrid();
    });
  }
}

function renderReplacementPlan(plan) {
  const host=$("replacementWeekPlan");
  host.innerHTML="";

  const mapping=selectedReplacementMapping();
  const hist=replacementHistoryInfo();
  const selectedStripDate=isoDate(replacementSelectedDateObject());
  const allocations=plan?.allocations || [];
  const stripDates=visiblePlanningDates(
    mapping,
    selectedStripDate,
    replacementDateForWeekday,
    plan
  );
  configurePlanningDateStrip(host,stripDates);

  $("replacementAchievableTarget").textContent=
    plan ? `${plan.achievableTargetPercent}%` : "—";

  $("replacementPreviousSuccesses").textContent=
    `${hist.totalSuccesses}/${hist.completedPastDays*10}`;

  $("replacementRemainingSuccesses").textContent=
    plan ? `${plan.remainingSuccesses}/${plan.remainingCapacity}` : "—";

  stripDates.forEach(date=>{
    const actual=actualDataForDate(
      mapping,
      date,
      "percentage_opportunities"
    );
    const entry=allocationForDate(allocations,date);
    const replacing=
      plan?.replaceDate===date &&
      entry?.source==="plan" &&
      Array.isArray(entry?.pattern);

    const card=document.createElement("div");
    card.className=
      "weekDayCard"+(date===selectedStripDate?" today":"");
    card.dataset.date=date;

    let value="—";

    if(replacing && entry) {
      value=`${entry.percent}%`;
    } else if(
      actual.hasActual &&
      Number.isFinite(Number(actual.value))
    ) {
      value=`${Number(actual.value)}%`;
    } else if(entry) {
      value=`${entry.percent}%`;
    }

    card.innerHTML=`
      <div class="day">${weekdayLabelForDate(date)}<span class="dayDate">${new Date(`${date}T12:00:00`).getDate()}</span></div>
      <div class="num">${value}</div>
    `;
    host.appendChild(card);
  });

  updateWeekNavigatorForHost("replacementWeekPlan");

  const date=isoDate(replacementSelectedDateObject());
  const actual=actualDataForDate(
    mapping,
    date,
    "percentage_opportunities"
  );
  const entry=allocationForDate(allocations,date);
  const replacing=
    plan?.replaceDate===date &&
    entry?.source==="plan" &&
    Array.isArray(entry?.pattern);

  $("replacementTodayPlanned").textContent=
    replacing && entry
      ? `${entry.percent}%`
      : actual.hasActual
        ? "—"
        : entry
          ? `${entry.percent}%`
          : "—";

  renderPlanChangePreview(
    "replacementChangePreview",
    date,
    replacing && actual.hasActual ? `${Math.round(Number(actual.value ?? 0))}%` : null,
    replacing && entry ? `${Math.round(Number(entry.percent))}%` : null
  );

  renderPatternInto(
    $("plannedTrialPattern"),
    replacing && entry
      ? (entry.pattern || Array(10).fill(""))
      : actual.hasActual
        ? (actual.states || Array(10).fill(""))
        : (entry?.pattern || Array(10).fill("")),
    true
  );
}

async function saveReplacementPlan() {
  lastPlanActionSucceeded=false;
  closeReplacementReview();

  const raw=$("replacementWeeklyTarget").value;
  const requested=Number(raw);

  if(raw==="") {
    validationError(
      "Enter a weekly target to continue.",
      "replacementWeeklyTarget"
    );
    return;
  }

  if(!Number.isFinite(requested)||requested<0||requested>100) {
    validationError(
      "Enter a percentage from 0 to 100.",
      "replacementWeeklyTarget"
    );
    return;
  }

  const date=isoDate(replacementSelectedDateObject());
  let mapping=await refreshPlanningPeriodIfNeeded(
    selectedReplacementMapping,
    date
  );

  if(!mapping?.found) {
    validationError(
      "This program is still loading from Office Puzzle. Try again in a moment."
    );
    return;
  }

  if(!selectedDateIsPlannable(mapping,date,replacementDateForWeekday)) {
    validationError(unavailablePlanningDateMessage(date));
    return;
  }

  const choice=await chooseExistingDataPlan({
    mapping,
    date,
    methodHint:"percentage_opportunities",
    programName:mapping.name
  });

  let plan=await withPlanningSuppression(
    choice.spec,
    ()=>buildReplacementPlan(requested)
  );

  plan=addReplacementMeta(plan,choice.spec);

  await storageSet({
    [replacementPlanStorageKey(mapping.name)]:plan
  });

  renderReplacementPlan(plan);

  if(!quickQueueMode) {
  if(choice.spec) {
    toast(
      `Replacement plan ready for ${friendlyDateLabel(date)}. Nothing changes in Office Puzzle until you Apply or Run.`,
      5200
    );
  } else if(choice.hasActual) {
    toast(
      `Kept the current entry for ${friendlyDateLabel(date)} and planned the remaining days.`,
      4700
    );
  } else {
    toast("Plan ready.");
  }

    }

lastPlanActionSucceeded=true;
}

function syncReviewedTrialsFromMapping() {
  const mapping=selectedReplacementMapping();
  const states=Array.isArray(mapping.currentStates)
    ? mapping.currentStates.slice(0,10)
    : [];

  reviewedTrialStates=Array.from({length:10},(_,i)=>
    states[i]==="+" || states[i]==="-" ? states[i] : ""
  );

  renderReviewedTrialGrid();
}


function getTodayPlannedReplacementPattern() {
  const name=REPLACEMENTS[selectedReplacementIndex];
  const key=replacementPlanStorageKey(name);

  return storageGet([key]).then(saved=>{
    const plan=saved[key]||null;
    const date=isoDate(replacementSelectedDateObject());
    const todayEntry=allocationForDate(plan?.allocations,date);

    if(!todayEntry?.pattern || todayEntry.pattern.length!==10) {
      return null;
    }

    return [...todayEntry.pattern];
  });
}

async function plannedClient1ReplacementStates() {
  const mapping=selectedReplacementMapping();

  if(!mapping?.found) {
    return {
      ok:false,
      error:
        "This program is still loading from Office Puzzle. Try again in a moment."
    };
  }

  const date=isoDate(replacementSelectedDateObject());
  const key=replacementPlanStorageKey(mapping.name);
  const saved=await storageGet([key]);
  const plan=saved[key] || null;
  const entry=allocationForDate(plan?.allocations,date);
  const states=entry?.pattern;

  const actual=actualDataForDate(
    mapping,
    date,
    "percentage_opportunities"
  );

  const replacingExisting=
    actual.hasActual &&
    plan?.replaceDate===date &&
    Boolean(validPlanReplacement(
      plan,
      mapping,
      "percentage_opportunities"
    ));

  if(actual.hasActual && !replacingExisting) {
    return {
      ok:false,
      error:
        "This date already has Office Puzzle data, so it is protected from duplicate entry."
    };
  }

  if(
    !Array.isArray(states) ||
    states.length!==10 ||
    states.some(state=>state!=="+" && state!=="-")
  ) {
    return {
      ok:false,
      error:
        plan?.replaceDate===date
          ? "The plan is not ready yet. Press Add + Next again."
          : "No plan for this day yet. Press Add + Next to create one."
    };
  }

  return {
    ok:true,
    mapping,
    states:[...states],
    selectedDate:date,
    replacingExisting
  };
}

async function plannedClient2ReplacementStates() {
  const mapping=client2ReplacementMapping;

  if(!mapping?.found) {
    return {
      ok:false,
      error:
        "This program is still loading from Office Puzzle. Try again in a moment."
    };
  }

  const date=isoDate(client2ReplacementDateObject());
  const key=client2ReplacementPlanKey(
    selectedClient2ReplacementName()
  );
  const saved=await storageGet([key]);
  const plan=saved[key] || null;
  const entry=allocationForDate(plan?.allocations,date);
  const states=entry?.pattern;

  const actual=actualDataForDate(
    mapping,
    date,
    "percentage_opportunities"
  );

  const replacingExisting=
    actual.hasActual &&
    plan?.replaceDate===date &&
    Boolean(validPlanReplacement(
      plan,
      mapping,
      "percentage_opportunities"
    ));

  if(actual.hasActual && !replacingExisting) {
    return {
      ok:false,
      error:
        "This date already has Office Puzzle data, so it is protected from duplicate entry."
    };
  }

  if(
    !Array.isArray(states) ||
    states.length!==10 ||
    states.some(state=>state!=="+" && state!=="-")
  ) {
    return {
      ok:false,
      error:
        plan?.replaceDate===date
          ? "The plan is not ready yet. Press Add + Next again."
          : "No plan for this day yet. Press Add + Next to create one."
    };
  }

  return {
    ok:true,
    mapping,
    states:[...states],
    selectedDate:date,
    replacingExisting
  };
}

async function plannedChallengingIntervalStates() {
  const mapping=challengingMapping;

  if(!mapping?.found || mapping.method!=="partial_interval") {
    return {
      ok:false,
      error:
        "Scroll until this Partial Interval behavior is loaded in Office Puzzle, then try again."
    };
  }

  const hours=Number($("challengingHours").value);

  const supported=
    partialIntervalHoursSupported(
      hours,
      mapping
    );

  if(!supported.ok) {
    return {
      ok:false,
      error:supported.error
    };
  }

  const activeIntervals=
    supported.requestedIntervals;

  const date=challengingSelectedDate();

  const key=challengingPlanKey(mapping.name);
  const saved=await storageGet([key]);
  const plan=saved[key] || null;
  const entry=allocationForDate(plan?.allocations,date);
  const states=entry?.pattern;

  const actual=actualDataForDate(
    mapping,
    date,
    "partial_interval"
  );

  const replacingExisting=
    actual.hasActual &&
    plan?.replaceDate===date &&
    Boolean(validPlanReplacement(
      plan,
      mapping,
      "partial_interval"
    ));

  if(actual.hasActual && !replacingExisting) {
    return {
      ok:false,
      error:
        "This date already has Office Puzzle data, so it is protected from duplicate entry."
    };
  }

  if(
    !Array.isArray(states) ||
    states.length!==activeIntervals ||
    states.some(state=>state!=="+" && state!=="-")
  ) {
    return {
      ok:false,
      error:
        "No plan for this day yet. Press Add + Next to create one."
    };
  }

  return {
    ok:true,
    mapping,
    hours,
    activeIntervals,
    states:[...states],
    selectedDate:date,
    replacingExisting
  };
}

async function openReplacementReview() {
  if(!$("replacementReviewPanel").hidden) {
    confirmReplacementReview();
    return;
  }

  const mapping=selectedReplacementMapping();

  if(!mapping.found) {
    toast(`The ${mapping.name} table is not mapped.`);
    return;
  }

  const planned=await getTodayPlannedReplacementPattern();

  if(!planned) {
    toast("No plan for this day yet. Press Add + Next to create one.");
    return;
  }

  // Copy the planning pattern into a temporary editable review buffer.
  reviewedTrialStates=[...planned];
  replacementReviewConfirmed=false;
  renderReviewedTrialGrid();

  $("replacementReviewPanel").hidden=false;
  updateReviewActionButton("client1Replacement");
}

function closeReplacementReview() {
  $("replacementReviewPanel").hidden=true;
  replacementReviewConfirmed=false;
  updateReviewActionButton("client1Replacement");
}

function renderSelectedReplacement(preserveDraft=false) {
  const name=REPLACEMENTS[selectedReplacementIndex];
  const mapping=selectedReplacementMapping();

  $("replacementName").textContent=name;
  updateProgramProgress(
    "replacementPosition",
    "replacementPositionBar",
    selectedReplacementIndex+1,
    REPLACEMENTS.length
  );
  $("replacementSelect").value=String(selectedReplacementIndex);
  syncCustomSelect("replacementSelect");
  $("replacementSelectedDate").textContent=mapping.selectedDate || "—";
  $("replacementCurrentAverage").textContent=
    mapping.currentAverage == null ? "—" : `${mapping.currentAverage}%`;

  if(mapping.found) {
const populated=(mapping.currentStates||[]).filter(Boolean).length;
    const pluses=(mapping.currentStates||[]).filter(state=>state==="+").length;

    $("replacementStatus").textContent=
      `Today's Office Puzzle column · ${populated}/10 populated · ${pluses} successful`;

    $("replacementStatus").style.background="#eaf8f2";
    $("replacementStatus").style.color="#126849";
    $("applyReplacementTrials").disabled=false;
  } else {
$("replacementStatus").textContent=
      `Could not map the ${name} table on the current page.`;

    $("replacementStatus").style.background="#fff0f0";
    $("replacementStatus").style.color="#8b3434";
    $("applyReplacementTrials").disabled=true;
  }

  if(!preserveDraft) {
    syncReviewedTrialsFromMapping();
    loadReplacementPlan();
  }
}

function selectReplacement(index) {
  closeReplacementReview();
  selectedReplacementIndex=
    (index+REPLACEMENTS.length)%REPLACEMENTS.length;
  renderSelectedReplacement();
}

let replacementScanInProgress=false;
let lastReplacementScanAt=0;

async function scanAllReplacements() {
  if(replacementScanInProgress) {
    toast("A scan is already running.");
    return;
  }

  replacementScanInProgress=true;

  try {
    if($("scanReplacements")) $("scanReplacements").disabled=true;
    $("replacementScanSummary").textContent=
      "Discovering this client's replacement/skill programs…";
    await discoverAndApplyClientPrograms({preserveDraft:true,manual:true});
  } finally {
    replacementScanInProgress=false;
    if($("scanReplacements")) $("scanReplacements").disabled=false;
  }
}

async function applyReviewedReplacementTrials() {
  const planned=await plannedClient1ReplacementStates();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  let {
    mapping,
    states,
    selectedDate,
    replacingExisting
  }=planned;

  const proceed=await confirmOneOffOverwrite({
    replacingExisting,
    name:mapping.name,
    selectedDate
  });

  if(!proceed) return;

  showRbtActionProgress({
    title:
      replacingExisting
        ? "Replacing…"
        : "Writing…",
    message:
      applyActionStatusMessage(
        mapping.name,
        selectedDate
      )
  });

  const prepared=await prepareDirectReplacementWrite({
    mapping,
    writerKind:"replacement",
    replacingExisting
  });

  if(!prepared.ok) {
    showRbtApplyProblem(
      prepared,
      "Office Puzzle could not prepare the replacement."
    );
    return;
  }

  mapping=prepared.mapping;

  reviewedTrialStates=[...states];
  replacementReviewConfirmed=true;

  const writeToken=await armOneWrite();

  const result=await sendTab({
    type:"SET_REPLACEMENT_TRIALS",
    mapping,
    desiredStates:[...states],
    writeToken
  });

  if(!result?.ok || !result?.verified) {
    showRbtApplyProblem(
      result,
      "Office Puzzle did not verify the planned entry."
    );
    return;
  }

  const idx=replacementMappings.findIndex(
    item=>item.name===mapping.name
  );

  if(idx>=0) {
    const date=mapping.selectedDate;

    const dailyAverages={
      ...(replacementMappings[idx].dailyAverages||{})
    };

    const dailyStates={
      ...(replacementMappings[idx].dailyStates||{})
    };

    if(date) {
      dailyAverages[date]=result.finalAverage;
      dailyStates[date]=[...result.finalStates];
    }

    replacementMappings[idx]={
      ...replacementMappings[idx],
      currentStates:[...result.finalStates],
      currentAverage:result.finalAverage,
      dailyAverages,
      dailyStates
    };
  }

  replacementReviewConfirmed=false;
  renderSelectedReplacement();

  showRbtActionResult({
    success:true,
    title:"Applied successfully",
    message:
      `${applyActionStatusMessage(
        mapping.name,
        selectedDate
      )}\nOffice Puzzle was updated and verified.`
  });
}


async function loadTheme() {
  const saved=await storageGet(["rbtTheme"]);
  themeIsExplicit=
    saved.rbtTheme==="light" ||
    saved.rbtTheme==="dark";

  applyTheme(
    themeIsExplicit
      ? saved.rbtTheme
      : preferredSystemTheme()
  );
}


function batchDateKey() {
  return (
    context.selectedDate ||
    challengingMapping?.selectedDate ||
    client2ReplacementMapping?.selectedDate ||
    selectedMapping()?.selectedDate ||
    selectedReplacementMapping()?.selectedDate ||
    isoDate(new Date())
  );
}

function currentBatchContextKey() {
  return `${clientKey}::${batchDateKey()}`;
}

function batchStorageKey(kind) {
  return `reviewedBatch::${currentBatchContextKey()}::${kind}`;
}

function batchDefinition(kind) {
  const defs={
    client1Behaviors:{
      listId:"batchBehaviorList",
      countId:"batchBehaviorCount",
      progressId:"batchBehaviorProgress",
      applyId:"batchApplyBehaviors",
      clearId:"batchClearBehaviors",
      total:BEHAVIORS.length,
      label:"Behavior page"
    },
    client1Replacements:{
      listId:"batchReplacementList",
      countId:"batchReplacementCount",
      progressId:"batchReplacementProgress",
      applyId:"batchApplyReplacement",
      clearId:"batchClearReplacement",
      total:REPLACEMENTS.length,
      label:"Replacement / Skill page"
    },
    client2Challenging:{
      listId:"batchChallengingList",
      countId:"batchChallengingCount",
      progressId:"batchChallengingProgress",
      applyId:"batchApplyChallenging",
      clearId:"batchClearChallenging",
      total:CHALLENGING.length,
      label:"Behavior page"
    },
    client2Replacements:{
      listId:"batchClient2ReplacementList",
      countId:"batchClient2ReplacementCount",
      progressId:"batchClient2ReplacementProgress",
      applyId:"batchApplyClient2Replacement",
      clearId:"batchClearClient2Replacement",
      total:CLIENT2_REPLACEMENTS.length,
      label:"Replacement / Skill page"
    }
  };
  return defs[kind];
}

async function loadBatchesForContext() {
  const key=currentBatchContextKey();

  if(batchContextKey===key) {
    renderAllBatches();
    return;
  }

  batchContextKey=key;
  oneOffSuppressedKinds.clear();

  for(const kind of Object.keys(batchState)) {
    const storageKey=batchStorageKey(kind);
    const saved=await storageGet([storageKey]);
    batchState[kind]=Array.isArray(saved[storageKey])
      ? saved[storageKey]
      : [];
  }

  renderAllBatches();
}

async function saveBatchKind(kind) {
  await storageSet({
    [batchStorageKey(kind)]:batchState[kind]
  });

  renderBatch(kind);

  // v1.0.19: a newly-added item must immediately enable Run Batch.
  // Previously the row rendered but the sticky/card controls could keep the
  // disabled state they had when the batch was empty until Sync/refresh ran.
  updateStickyActionBar();
  updateAutoProgress();
}

function batchItemKey(item) {
  return `${item.name}::${item.type}`;
}

async function prepareBatchForNewReviewedItem(kind) {
  const list=batchState[kind] || [];

  // "Completed" describes the previous run only. It must never permanently
  // lock this client/date from being reviewed and written again.
  const previousBatchCompleted=
    list.length>0 &&
    list.every(item=>item.status==="verified");

  if(!previousBatchCompleted) return true;

  // Add + Next is intentionally interruption-free. A fully completed batch is
  // historical UI state, so clear that old extension-only list automatically
  // before starting the next review cycle. Office Puzzle data is untouched.
  if(quickQueueMode) {
    batchState[kind]=[];
    autoBatchState.completed=false;
    autoBatchState.stoppedOnError=false;
    await saveBatchKind(kind);
    return true;
  }

  const proceed=await rbtConfirm({
    title:"Start fresh?",
    message:
      "The previous batch on this page is already completed.\n\n" +
      "Clear that completed batch and start a fresh reviewed batch? " +
      "This only clears the extension's old batch list; it does not change Office Puzzle data.",
    confirmText:"Clear & start new"
  });

  if(!proceed) return false;

  batchState[kind]=[];

  // Completion is history for the old run, not a lock for the next batch.
  autoBatchState.completed=false;
  autoBatchState.stoppedOnError=false;

  await saveBatchKind(kind);
  setAutoBatchMessage("Previous completed batch cleared. Add the new reviewed item and run it normally.");
  return true;
}

async function upsertBatchItem(kind,item) {
  if(!(await prepareBatchForNewReviewedItem(kind))) {
    return {
      ok:false,
      cancelled:true
    };
  }

  const list=batchState[kind];
  const key=batchItemKey(item);

  const index=list.findIndex(
    existing=>
      batchItemKey(existing)===key
  );

  const normalized={
    ...item,
    status:"ready",
    error:"",
    reviewedAt:new Date().toISOString()
  };

  if(index>=0) {
    list[index]=normalized;
  } else {
    list.push(normalized);
  }

  if(
    !autoBatchState.armed &&
    !autoBatchState.busy
  ) {
    autoBatchState.stoppedOnError=false;
    autoBatchState.completed=false;
    autoBatchState.lockedTabId=null;

    await persistAutoBatchRunnerState();
  }

  await saveBatchKind(kind);

  if(currentPageBatchKind()===kind) {
    setAutoBatchMessage(
      `${list.length} queued.`
    );
  }

  return {ok:true};
}

function batchStatusA11yLabel(item) {
  const status=String(item?.status || "ready");

  if(status==="applying") return "Running";
  if(status==="verified") return "Completed";
  if(status==="failed") return "Needs attention";

  return "Queued";
}

function batchMeta(item) {
  // Secondary copy is deliberately short. The task name is the primary
  // information; this line only answers “what target did I queue?”
  if(item.type==="count") {
    return `Target ${item.target}`;
  }

  if(item.type==="replacement") {
    const pluses=(item.desiredStates||[])
      .filter(state=>state==="+").length;

    return `${pluses*10}%`;
  }

  if(item.type==="partial_interval") {
    const pluses=(item.desiredStates||[])
      .filter(state=>state==="+").length;

    const intervals=item.activeIntervals||0;
    const percent=intervals
      ? (pluses/intervals)*100
      : 0;

    return `${percent.toFixed(0)}% · ${item.hours}h`;
  }

  return "";
}

function renderBatch(kind) {
  const def=batchDefinition(kind);
  if(!def) return;

  const host=$(def.listId);
  const count=$(def.countId);
  const progress=$(def.progressId);
  const apply=$(def.applyId);
  const clear=def.clearId ? $(def.clearId) : null;

  if(!host || !count || !progress || !apply) return;

  const list=batchState[kind] || [];
  count.textContent=`${list.length}/${def.total}`;
  host.innerHTML="";

  if(!list.length) {
    host.hidden=true;
  } else {
    host.hidden=false;
    list.forEach((item,index)=>{
      const row=document.createElement("div");
      row.className="batchItem";
      row.dataset.batchIndex=String(index);
      row.dataset.batchStatus=item.status || "ready";

      const left=document.createElement("div");
      left.className="batchItemMain";

      const nameRow=document.createElement("div");
      nameRow.className="batchItemNameRow";

      const status=document.createElement("span");
      status.className=`batchStatus ${item.status || "ready"}`;
      status.setAttribute("role","img");
      status.setAttribute("aria-label",batchStatusA11yLabel(item));
      status.title=batchStatusA11yLabel(item);

      if(item.status==="verified") {
        const animationKey=`${kind}::${batchItemKey(item)}`;
        const shouldDraw=!animatedVerifiedBatchKeys.has(animationKey);
        if(shouldDraw) animatedVerifiedBatchKeys.add(animationKey);

        status.innerHTML=`
          <svg class="paperCheck${shouldDraw ? " drawNow" : ""}" viewBox="0 0 18 14" aria-hidden="true">
            <path d="M2 7.3 6.1 11 16 2" />
          </svg>
        `;
      }

      const name=document.createElement("div");
      name.className="batchItemName";
      name.textContent=item.name;

      nameRow.append(status,name);
      left.append(nameRow);

      if(item.error) {
        const error=document.createElement("div");
        error.className="batchItemError";
        error.textContent="Check Office Puzzle";
        error.title=item.error;
        left.append(error);
        row.title=item.error;
      }

      const actions=document.createElement("div");
      actions.className="batchItemActions";

      const remove=document.createElement("button");
      remove.type="button";
      remove.className="batchDeleteButton";
      remove.dataset.batchKind=kind;
      remove.dataset.batchIndex=String(index);
      remove.title=`Remove ${item.name}`;
      remove.setAttribute(
        "aria-label",
        `Remove ${item.name}`
      );

      // Inline SVG keeps the bin crisp and consistent with the app palette.
      remove.innerHTML=`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 10.1A2 2 0 0 1 14.3 21H9.7a2 2 0 0 1-2-1.9L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/>
        </svg>
      `;

      remove.disabled=writeOrBatchIsActive();

      remove.addEventListener("click",()=>{
        removeBatchItem(kind,index);
      });

      actions.append(remove);
      row.append(left,actions);
      host.appendChild(row);
    });
  }

  const verified=list.filter(item=>item.status==="verified").length;
  const failed=list.filter(item=>item.status==="failed").length;

  if(batchRunningKind===kind) {
    const applying=list.findIndex(item=>item.status==="applying");
    progress.textContent=
      applying>=0
        ? `Running ${applying+1} of ${list.length}: ${list[applying].name}`
        : "Running tasks…";
  } else if(failed) {
    const item=list.find(
      entry=>entry.status==="failed"
    );

    progress.textContent=
      `Stopped on ${item?.name || "a task"}. Check Office Puzzle, then press Retry. Completed tasks will be skipped.`;
  } else if(list.length && verified===list.length) {
    progress.textContent=`All ${list.length} task${list.length===1 ? "" : "s"} completed.`;
  } else if(list.length) {
    progress.textContent=
      `${list.length} task${list.length===1 ? "" : "s"} added · ${verified} completed.`;
  } else {
    progress.textContent="No tasks yet.";
  }

  progress.classList.toggle(
    "emptyTaskNotice",
    !list.length
  );

  if(clear) {
    clear.hidden=!list.length;
  }

  // Auto-follow the active batch so the user can always see what is
  // happening next without manually scrolling the side panel.
  if(batchRunningKind===kind) {
    requestAnimationFrame(()=>{
      const rows=[...host.querySelectorAll(".batchItem")];
      const applyingIndex=list.findIndex(item=>item.status==="applying");

      // While a write is active, keep that row visible.
      if(applyingIndex>=0) {
        const applyingRow=rows[applyingIndex];
        applyingRow?.scrollIntoView({
          behavior:motionSafeScrollBehavior(),
          block:"nearest"
        });
        return;
      }

      // Between completed items, move directly to the next item that still
      // needs to run. This is the important "follow the batch" behavior.
      const nextIndex=list.findIndex(item=>item.status!=="verified");

      if(nextIndex>=0) {
        const nextRow=rows[nextIndex];
        nextRow?.scrollIntoView({
          behavior:motionSafeScrollBehavior(),
          block:"nearest"
        });
        return;
      }

      // Final item completed: bring the completion summary into view.
      progress?.scrollIntoView({
        behavior:motionSafeScrollBehavior(),
        block:"nearest"
      });
    });
  }

  apply.disabled=!!batchRunningKind || !list.length;
  updateOneOffActionVisibility();
}

function renderAllBatches() {
  Object.keys(batchState).forEach(renderBatch);

  updateStickyActionBar();
}

async function removeBatchItem(kind,index) {
  if(writeOrBatchIsActive()) {
    toast("Stop or finish the current task before removing an item.");
    return;
  }

  const list=batchState[kind] || [];
  const safeIndex=Number(index);

  if(
    !Number.isInteger(safeIndex) ||
    safeIndex<0 ||
    safeIndex>=list.length
  ) return;

  list.splice(safeIndex,1);

  // Editing the batch means any old completed/stopped runner badge is now
  // historical. Reset only the runner UI state; Office Puzzle data is untouched.
  autoBatchState.completed=false;

  if(!list.some(item=>item.status==="failed")) {
    autoBatchState.stoppedOnError=false;
  }

  await persistAutoBatchRunnerState();
  await saveBatchKind(kind);
  restoreOneOffIfQueueEmpty(kind);

  // Removing a row is self-evident. Do not add a toast/status narration for an
  // action the user just performed; the task list itself is the feedback.
}

async function clearBatch(kind) {
  if(writeOrBatchIsActive()) {
    toast(
      "Stop the current run before clearing Tasks.",
      5000
    );
    return;
  }

  if(!batchState[kind]?.length) return;

  const proceed=await rbtConfirm({
    title:"Clear all tasks?",
    message:
      "Clear all tasks on this page? Nothing in Office Puzzle will be changed.",
    confirmText:"Clear"
  });

  if(!proceed) return;

  batchState[kind]=[];

  autoBatchState.stoppedOnError=false;
  autoBatchState.completed=false;
  autoBatchState.lockedTabId=null;

  await persistAutoBatchRunnerState();
  await saveBatchKind(kind);
  oneOffSuppressedKinds.delete(kind);
  updateOneOffActionVisibility();

  if(currentPageBatchKind()===kind) {
    setAutoBatchMessage(
      "Ready when you are."
    );
  }
}

async function addClient1BehaviorToBatch() {
  const planned=await selectedBehaviorPlannedCount();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  const {
    mapping,
    target,
    replacingExisting
  }=planned;

  const added=await upsertBatchItem(
    "client1Behaviors",
    {
      type:"count",
      name:mapping.name,
      mapping:{...mapping},
      target,
      replacingExisting
    }
  );

  if(!added?.ok) return;

  if(!quickQueueMode) toast(`Added ${mapping.name}.`,1500);
  return true;
}

async function addClient1ReplacementToBatch() {
  const planned=await plannedClient1ReplacementStates();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  const {
    mapping,
    states,
    replacingExisting
  }=planned;

  reviewedTrialStates=[...states];
  replacementReviewConfirmed=true;

  const added=await upsertBatchItem(
    "client1Replacements",
    {
      type:"replacement",
      name:mapping.name,
      mapping:{...mapping},
      desiredStates:[...states],
      replacingExisting
    }
  );

  replacementReviewConfirmed=false;

  if(!added?.ok) return;

  if(!quickQueueMode) toast(`Added ${mapping.name}.`,1500);
  return true;
}

async function addClient2ChallengingCountToBatch() {
  const planned=await selectedChallengingPlannedCount();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  const {
    mapping,
    target,
    replacingExisting
  }=planned;

  const added=await upsertBatchItem(
    "client2Challenging",
    {
      type:"count",
      name:mapping.name,
      mapping:{...mapping},
      target,
      replacingExisting
    }
  );

  if(!added?.ok) return;

  if(!quickQueueMode) toast(`Added ${mapping.name}.`,1500);
  return true;
}

async function addClient2ChallengingIntervalsToBatch() {
  const planned=await plannedChallengingIntervalStates();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  const {
    mapping,
    states,
    activeIntervals,
    hours,
    replacingExisting
  }=planned;

  reviewedChallengingStates=[...states];
  challengingReviewConfirmed=true;

  await saveTodayChallengingHours();

  const added=await upsertBatchItem(
    "client2Challenging",
    {
      type:"partial_interval",
      name:mapping.name,
      mapping:{...mapping},
      desiredStates:[...states],
      activeIntervals,
      hours,
      replacingExisting
    }
  );

  challengingReviewConfirmed=false;

  if(!added?.ok) return;

  if(!quickQueueMode) toast(`Added ${mapping.name}.`,1500);
  return true;
}

async function addClient2ReplacementToBatch() {
  const planned=await plannedClient2ReplacementStates();

  if(!planned.ok) {
    validationError(planned.error);
    return;
  }

  const {
    mapping,
    states,
    replacingExisting
  }=planned;

  reviewedClient2ReplacementStates=[...states];
  client2ReplacementReviewConfirmed=true;

  const added=await upsertBatchItem(
    "client2Replacements",
    {
      type:"replacement",
      name:mapping.name,
      mapping:{...mapping},
      desiredStates:[...states],
      replacingExisting
    }
  );

  client2ReplacementReviewConfirmed=false;

  if(!added?.ok) return;

  if(!quickQueueMode) toast(`Added ${mapping.name}.`,1500);
  return true;
}


function batchDelay(ms) {
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function refreshBatchMappingsAfterCountWrite(kind) {
  const scan=await sendTab({type:"DISCOVER_CLIENT_PROGRAMS"});

  if(!scan?.ok) {
    return {
      ok:false,
      error:scan?.error || "Could not re-read Office Puzzle program tables."
    };
  }

  const byName={};

  for(const mapping of scan.programs || []) {
    if(mapping?.found) byName[mapping.name]=mapping;
  }

  for(const queued of batchState[kind] || []) {
    const fresh=byName[queued.name];
    if(fresh?.found) queued.mapping={...fresh};
  }

  applyLiveDiscoveryMappings(scan);
  return {ok:true,byName};
}

async function settleVerifyBatchCount(item,kind,initialResult) {
  // The stable writer may correctly fill the column and then read 0 during
  // Office Puzzle's DOM re-render. Never click again here. This helper is
  // READ-ONLY: wait, rescan, and accept the write only if the exact mapped
  // behavior now reports the reviewed target.
  const delays=[60,120,220,420];
  let lastDetected=initialResult?.finalCount;
  let lastError=initialResult?.error || "Count verification did not settle.";

  for(const delay of delays) {
    await batchDelay(delay);

    const refreshed=await refreshBatchMappingsAfterCountWrite(kind);

    if(!refreshed.ok) {
      lastError=refreshed.error;
      continue;
    }

    const fresh=refreshed.byName?.[item.name];

    if(!fresh?.found) {
      lastError=`Could not re-map ${item.name} while verifying the batch write.`;
      continue;
    }

    // Keep this batch item's mapping current for later retries/status updates.
    item.mapping={...fresh};
    lastDetected=fresh.currentCount;

    if(Number(fresh.currentCount)===Number(item.target)) {
      return {
        ok:true,
        result:{
          ...(initialResult || {}),
          ok:true,
          behaviorName:item.name,
          selectedDate:fresh.selectedDate || item.mapping.selectedDate,
          target:item.target,
          finalCount:item.target,
          postWriteRescanVerified:true
        }
      };
    }

    lastError=
      `Office Puzzle still reports ${fresh.currentCount} instead of ${item.target} ` +
      `after settling.`;
  }

  return {
    ok:false,
    error:
      `${lastError} No retry click was sent; later batch items were not touched.`,
    finalCount:lastDetected
  };
}


function replacementWriterKind(kind,item) {
  if(item?.type==="partial_interval") return "partial_interval";

  if(
    kind==="client1Replacements" ||
    kind==="client2Replacements" ||
    item?.type==="replacement"
  ) {
    return "replacement";
  }

  return null;
}

async function rediscoverBatchMapping(kind,item) {
  const scan=await sendTab({
    type:"DISCOVER_CLIENT_PROGRAMS"
  });

  if(!scan?.ok) {
    return {
      ok:false,
      error:
        scan?.error ||
        "Could not re-read Office Puzzle after clearing the existing entry."
    };
  }

  const wanted=String(item?.name || "")
    .trim()
    .toLowerCase();

  const fresh=(scan.programs || []).find(mapping=>
    mapping?.found &&
    String(mapping.name || "")
      .trim()
      .toLowerCase()===wanted
  );

  if(!fresh?.found) {
    return {
      ok:false,
      error:
        `The ${item?.name || "program"} table did not reload after clearing the existing entry.`
    };
  }

  const expectedDate=String(
    item?.mapping?.selectedDate || ""
  );

  const freshDate=String(
    fresh.selectedDate || ""
  );

  if(
    expectedDate &&
    freshDate &&
    expectedDate!==freshDate
  ) {
    return {
      ok:false,
      error:
        "The selected Office Puzzle date changed while replacing the entry. The new plan was not written."
    };
  }

  item.mapping={...fresh};

  // Keep the live side-panel mapping synchronized too.
  applyLiveDiscoveryMappings(scan);

  return {
    ok:true,
    mapping:item.mapping
  };
}

async function prepareReplacementBatchItem(item,kind) {
  if(!item?.replacingExisting) {
    return {
      ok:true,
      mapping:item?.mapping
    };
  }

  // If a prior attempt already cleared successfully, never clear twice.
  // Retry/resume should continue with the planned write.
  if(item.replacementStage==="cleared") {
    const refreshed=await rediscoverBatchMapping(
      kind,
      item
    );

    return refreshed.ok
      ? {
          ok:true,
          mapping:item.mapping,
          alreadyCleared:true
        }
      : refreshed;
  }

  const writerKind=
    replacementWriterKind(kind,item);

  if(!writerKind) {
    return {
      ok:false,
      error:
        "This replacement task does not have a supported Office Puzzle writer."
    };
  }

  setAutoBatchMessage(
    `Replacing existing entry: ${item.name}…`
  );

  const writeToken=await armOneWrite();

  const cleared=await sendTab({
    type:"CLEAR_SELECTED_COLUMN",
    mapping:item.mapping,
    writerKind,
    writeToken
  });

  if(!cleared?.ok || !cleared?.verified) {
    return {
      ok:false,
      cancelled:!!cleared?.cancelled,
      aborted:!!cleared?.aborted,
      error:
        cleared?.error ||
        "Office Puzzle could not clear the existing entry."
    };
  }

  // Persist this BEFORE the new write. If Office Puzzle rerenders or the run
  // is stopped here, the next Run resumes from the write stage instead of
  // attempting to delete an already-blank column again.
  item.replacementStage="cleared";
  await saveBatchKind(kind);

  await batchDelay(160);

  const refreshed=await rediscoverBatchMapping(
    kind,
    item
  );

  if(!refreshed.ok) {
    return refreshed;
  }

  setAutoBatchMessage(
    `Applying new plan: ${item.name}…`
  );

  return {
    ok:true,
    mapping:item.mapping,
    cleared:true
  };
}

function finishReplacementBatchItem(item) {
  if(!item) return;

  item.replacementStage="";
  item.replacingExisting=false;
}

async function prepareDirectReplacementWrite({
  mapping,
  writerKind,
  replacingExisting
}) {
  if(!replacingExisting) {
    return {
      ok:true,
      mapping
    };
  }

  const writeToken=await armOneWrite();

  const cleared=await sendTab({
    type:"CLEAR_SELECTED_COLUMN",
    mapping,
    writerKind,
    writeToken
  });

  if(!cleared?.ok || !cleared?.verified) {
    return {
      ok:false,
      cancelled:!!cleared?.cancelled,
      aborted:!!cleared?.aborted,
      error:
        cleared?.error ||
        "Office Puzzle could not clear the existing entry."
    };
  }

  await batchDelay(160);

  const scan=await sendTab({
    type:"DISCOVER_CLIENT_PROGRAMS"
  });

  if(!scan?.ok) {
    return {
      ok:false,
      error:
        scan?.error ||
        "The entry was cleared, but Office Puzzle could not be re-read before applying the new plan."
    };
  }

  const wanted=String(mapping?.name || "")
    .trim()
    .toLowerCase();

  const fresh=(scan.programs || []).find(item=>
    item?.found &&
    String(item.name || "")
      .trim()
      .toLowerCase()===wanted
  );

  if(!fresh?.found) {
    return {
      ok:false,
      error:
        "The entry was cleared, but the program table did not reload. Press Apply again to finish the planned entry."
    };
  }

  const expectedDate=String(
    mapping?.selectedDate || ""
  );

  if(
    expectedDate &&
    fresh.selectedDate &&
    String(fresh.selectedDate)!==expectedDate
  ) {
    return {
      ok:false,
      error:
        "The selected Office Puzzle date changed after clearing. The new plan was not written."
    };
  }

  applyLiveDiscoveryMappings(scan);

  return {
    ok:true,
    mapping:{...fresh},
    cleared:true
  };
}

async function executeCountBatchItem(item,kind) {
  let writeToken=await armOneWrite();

  let result=await sendTab({
    type:"SET_BEHAVIOR_COUNT",
    mapping:item.mapping,
    target:item.target,
    replaceExisting:false,
    writeToken
  });

  if(result?.requiresReplace) {
    writeToken=await armOneWrite();

    result=await sendTab({
      type:"SET_BEHAVIOR_COUNT",
      mapping:item.mapping,
      target:item.target,
      replaceExisting:true,
      writeToken
    });
  }

  if(result?.ok) {
    return {ok:true,result};
  }

  if(result?.cancelled || result?.aborted) {
    return {
      ok:false,
      cancelled:true,
      aborted:true,
      error:result?.error || "Stopped by user."
    };
  }

  // Do NOT immediately fail a batch on Office Puzzle's transient post-click
  // count read. The visible column may already be correct while the DOM is
  // briefly reporting 0. Re-read the exact mapped table without sending any
  // additional write click.
  const canSettleVerify=
    Number.isInteger(Number(item.target)) &&
    (kind==="client1Behaviors" || kind==="client2Challenging");

  if(canSettleVerify) {
    return await settleVerifyBatchCount(item,kind,result);
  }

  return {
    ok:false,
    error:result?.error || "Office Puzzle did not verify the reviewed count."
  };
}

async function executeClient1ReplacementBatchItem(item) {
  const prepared=await prepareReplacementBatchItem(
    item,
    "client1Replacements"
  );

  if(!prepared.ok) {
    return prepared;
  }

  const writeToken=await armOneWrite();

  const result=await sendTab({
    type:"SET_REPLACEMENT_TRIALS",
    mapping:item.mapping,
    desiredStates:[...item.desiredStates],
    writeToken
  });

  if(!result?.ok || !result?.verified) {
    return {
      ok:false,
      cancelled:!!result?.cancelled,
      aborted:!!result?.aborted,
      error:
        result?.error ||
        "Office Puzzle did not verify the planned entry."
    };
  }

  finishReplacementBatchItem(item);

  return {ok:true,result};
}

async function executeClient2IntervalBatchItem(item) {
  const prepared=await prepareReplacementBatchItem(
    item,
    "client2Challenging"
  );

  if(!prepared.ok) {
    return prepared;
  }

  const writeToken=await armOneWrite();

  const result=await sendTab({
    type:"SET_CHALLENGING_INTERVALS",
    mapping:item.mapping,
    desiredStates:[...item.desiredStates],
    activeIntervals:item.activeIntervals,
    writeToken
  });

  if(!result?.ok || !result?.verified) {
    return {
      ok:false,
      cancelled:!!result?.cancelled,
      aborted:!!result?.aborted,
      error:
        result?.error ||
        "Office Puzzle did not verify the planned entry."
    };
  }

  finishReplacementBatchItem(item);

  return {ok:true,result};
}

async function executeClient2ReplacementBatchItem(item) {
  const prepared=await prepareReplacementBatchItem(
    item,
    "client2Replacements"
  );

  if(!prepared.ok) {
    return prepared;
  }

  const writeToken=await armOneWrite();

  const result=await sendTab({
    type:"SET_CLIENT2_REPLACEMENT_TRIALS",
    mapping:item.mapping,
    desiredStates:[...item.desiredStates],
    writeToken
  });

  if(!result?.ok || !result?.verified) {
    return {
      ok:false,
      cancelled:!!result?.cancelled,
      aborted:!!result?.aborted,
      error:
        result?.error ||
        "Office Puzzle did not verify the planned entry."
    };
  }

  finishReplacementBatchItem(item);

  return {ok:true,result};
}

function updateLocalMappingAfterBatch(kind,item,result) {
  if(kind==="client1Behaviors") {
    const index=behaviorMappings.findIndex(x=>x.name===item.name);
    if(index>=0) {
      behaviorMappings[index]={
        ...behaviorMappings[index],
        currentCount:item.target
      };
    }
    return;
  }

  if(kind==="client1Replacements") {
    const index=replacementMappings.findIndex(x=>x.name===item.name);
    if(index>=0) {
      const date=item.mapping.selectedDate;
      const dailyAverages={
        ...(replacementMappings[index].dailyAverages||{})
      };
      if(date) dailyAverages[date]=result.finalAverage;

      replacementMappings[index]={
        ...replacementMappings[index],
        currentStates:[...result.finalStates],
        currentAverage:result.finalAverage,
        dailyAverages
      };
    }
    return;
  }

  if(kind==="client2Challenging") {
    const previous=challengingMappingsByName[item.name] || item.mapping;

    if(item.type==="count") {
      challengingMappingsByName[item.name]={
        ...previous,
        currentCount:item.target,
        dailyCounts:{
          ...(previous.dailyCounts||{}),
          [item.mapping.selectedDate]:item.target
        }
      };
    } else {
      const states=Array(CLIENT2_MAX_INTERVALS).fill("");
      result.finalStates.forEach((state,index)=>{
        states[index]=state;
      });

      challengingMappingsByName[item.name]={
        ...previous,
        currentStates:states,
        currentAverage:result.finalAverage,
        dailyAverages:{
          ...(previous.dailyAverages||{}),
          [item.mapping.selectedDate]:result.finalAverage
        }
      };
    }
    return;
  }

  if(kind==="client2Replacements") {
    const previous=client2ReplacementMappingsByName[item.name] || item.mapping;

    client2ReplacementMappingsByName[item.name]={
      ...previous,
      currentStates:[...result.finalStates],
      currentAverage:result.finalAverage,
      dailyAverages:{
        ...(previous.dailyAverages||{}),
        [item.mapping.selectedDate]:result.finalAverage
      }
    };
  }
}


function kindForPageType(pageType) {
  if(pageType==="maladaptive") return "client1Behaviors";
  if(pageType==="replacement") return "client1Replacements";
  if(pageType==="challenging") return "client2Challenging";
  if(pageType==="client2replacement") return "client2Replacements";
  return null;
}

function pageBatchReady(kind) {
  const def=batchDefinition(kind);
  const list=batchState[kind] || [];

  if(!def) {
    return {
      ready:false,
      reason:"Unsupported Office Puzzle page."
    };
  }

  if(!list.length) {
    return {
      ready:false,
      reason:"No tasks added yet."
    };
  }

  const failed=list.find(item=>item.status==="failed");
  if(failed) {
    return {
      ready:false,
      reason:`Stopped on ${failed.name}. Check that task, then try again.`
    };
  }

  const pending=list.filter(item=>item.status!=="verified");

  if(!pending.length) {
    return {
      ready:false,
      complete:true,
      reason:`All ${list.length} task${list.length===1 ? "" : "s"} completed.`
    };
  }

  const invalid=pending.find(item=>{
    if(!item?.mapping?.found) return true;

    if(item.type==="replacement") {
      return (
        !Array.isArray(item.desiredStates) ||
        item.desiredStates.length!==10 ||
        item.desiredStates.some(state=>state!=="+" && state!=="-")
      );
    }

    if(item.type==="partial_interval") {
      return (
        !Array.isArray(item.desiredStates) ||
        item.desiredStates.length!==item.activeIntervals ||
        item.desiredStates.some(state=>state!=="+" && state!=="-")
      );
    }

    if(item.type==="count") {
      return !Number.isInteger(Number(item.target)) || Number(item.target)<0;
    }

    return true;
  });

  if(invalid) {
    return {
      ready:false,
      reason:`Check ${invalid.name} before running.`
    };
  }

  return {
    ready:true,
    reason:
      `${pending.length} task${pending.length===1 ? "" : "s"} ready.`
  };
}



function currentPageBatchKind() {
  return kindForPageType(context?.pageType);
}

function currentPageBatchList() {
  const kind=currentPageBatchKind();
  return kind ? (batchState[kind] || []) : [];
}

function updateAutoProgress() {
  const list=currentPageBatchList();
  const completed=list.filter(item=>item.status==="verified").length;
  const total=list.length;
  const pct=total ? Math.round((completed/total)*100) : 0;

  const label=$("autoProgressLabel");
  const percent=$("autoProgressPercent");
  const bar=$("autoProgressBar");

  if(label) label.textContent=`${completed} / ${total} completed`;
  if(percent) percent.textContent=`${pct}%`;
  if(bar) bar.style.width=`${pct}%`;
}

function selectedMappingForClear() {
  if(context?.pageType==="maladaptive") {
    return {
      mapping:selectedMapping(),
      writerKind:"frequency",
      batchKind:"client1Behaviors"
    };
  }

  if(context?.pageType==="replacement") {
    return {
      mapping:selectedReplacementMapping(),
      writerKind:"replacement",
      batchKind:"client1Replacements"
    };
  }

  if(context?.pageType==="challenging") {
    const mapping=challengingMapping || selectedChallengingMapping();
    return {
      mapping,
      writerKind:mapping?.method==="partial_interval"
        ? "partial_interval"
        : "frequency",
      batchKind:"client2Challenging"
    };
  }

  if(context?.pageType==="client2replacement") {
    return {
      mapping:client2ReplacementMapping || selectedClient2ReplacementMapping(),
      writerKind:"replacement",
      batchKind:"client2Replacements"
    };
  }

  return null;
}

function removeProgramFromCurrentBatch(batchKind,name) {
  const list=batchState[batchKind] || [];
  batchState[batchKind]=list.filter(item=>item.name!==name);
}

async function clearSelectedOfficePuzzleColumn() {
  if(writeOrBatchIsActive()) {
    toast("Stop the current task before clearing this date.",5000);
    return;
  }

  const target=selectedMappingForClear();
  const mapping=target?.mapping;

  if(!target || !mapping?.found || !mapping?.name) {
    toast(
      "This program is still loading from Office Puzzle. Try again in a moment.",
      5000
    );
    return;
  }

  const date=mapping.selectedDate || context?.selectedDate || "";

  const proceed=await rbtConfirm({
    title:"Clear this date?",
    message:
      `Remove the recorded Office Puzzle entry for ${mapping.name} on ${friendlyDateLabel(date)}?\\n\\n` +
      "This cannot be undone from the assistant.",
    confirmText:"Clear"
  });
  if(!proceed) return;

  try {
    const writeToken=await armOneWrite();

    const result=await sendTab({
      type:"CLEAR_SELECTED_COLUMN",
      mapping:{...mapping},
      writerKind:target.writerKind,
      writeToken
    });

    if(!result?.ok || !result?.verified) {
      toast(
        result?.error ||
        "Office Puzzle could not verify that the entry was cleared.",
        7000
      );
      return;
    }

    removeProgramFromCurrentBatch(target.batchKind,mapping.name);
    autoBatchState.completed=false;
    autoBatchState.stoppedOnError=false;
    await saveBatchKind(target.batchKind);

    await batchDelay(500);

    batchContextKey="";
    lastPassiveContextSignature="";
    await refreshContext();

    toast(
      `Cleared ${mapping.name} for ${friendlyDateLabel(date)}.`,
      6000
    );
  } catch(err) {
    toast(
      `Could not clear this date: ${String(err?.message || err)}`,
      7000
    );
  }
}

function canStickyAddCurrent() {
  if(writeOrBatchIsActive()) return false;

  if(context?.pageType==="maladaptive") {
    return !!selectedMapping()?.found;
  }

  if(context?.pageType==="replacement") {
    return !!selectedReplacementMapping()?.found;
  }

  if(context?.pageType==="challenging") {
    const mapping=challengingMapping || selectedChallengingMapping();
    return !!mapping?.found &&
      (
        mapping?.method==="frequency" ||
        mapping?.method==="partial_interval"
      );
  }

  if(context?.pageType==="client2replacement") {
    return !!client2ReplacementMapping?.found;
  }

  return false;
}

async function stickyAddToBatch() {
  if(writeOrBatchIsActive()) {
    validationError("Finish or stop the current task first.");
    return;
  }

  let added=false;

  if(context?.pageType==="maladaptive") {
    added=Boolean(await addClient1BehaviorToBatch());
  } else if(context?.pageType==="replacement") {
    added=Boolean(await addClient1ReplacementToBatch());
  } else if(context?.pageType==="challenging") {
    const method=
      challengingMapping?.method ||
      challengingConfig(selectedChallengingName())?.method;

    added=Boolean(
      method==="partial_interval"
        ? await addClient2ChallengingIntervalsToBatch()
        : await addClient2ChallengingCountToBatch()
    );
  } else if(context?.pageType==="client2replacement") {
    added=Boolean(await addClient2ReplacementToBatch());
  }

  // High-volume workflow: once the current program is safely queued, move to
  // the next program automatically. This saves a tap on every reviewed item.
  if(added && stickyNextAvailable()) {
    await stickyNextItem();
  }

  return added;
}

function currentProgramAlreadyRecorded() {
  try {
    if(context?.pageType==="maladaptive") {
      const mapping=selectedMapping();
      return actualDataForDate(
        mapping,
        isoDate(selectedDateObject()),
        "frequency"
      ).hasActual;
    }

    if(context?.pageType==="replacement") {
      const mapping=selectedReplacementMapping();
      return actualDataForDate(
        mapping,
        isoDate(replacementSelectedDateObject()),
        "percentage_opportunities"
      ).hasActual;
    }

    if(context?.pageType==="challenging") {
      const mapping=challengingMapping || selectedChallengingMapping();
      const methodHint=mapping?.method==="frequency"
        ? "frequency"
        : "partial_interval";
      return actualDataForDate(
        mapping,
        challengingSelectedDate(),
        methodHint
      ).hasActual;
    }

    if(context?.pageType==="client2replacement") {
      const mapping=client2ReplacementMapping || selectedClient2ReplacementMapping();
      return actualDataForDate(
        mapping,
        isoDate(client2ReplacementDateObject()),
        "percentage_opportunities"
      ).hasActual;
    }
  } catch(_) {}

  return false;
}

async function quickWriteOnce(savePlan,writeNow) {
  if(writeOrBatchIsActive()) {
    validationError("Finish or stop the current task first.");
    return;
  }

  quickQueueMode=true;      // suppress planning-only toasts
  quickOneOffMode=true;     // prepare overwrite metadata without a first prompt
  lastPlanActionSucceeded=false;

  try {
    await savePlan();
    if(!lastPlanActionSucceeded) return;
  } finally {
    quickOneOffMode=false;
    quickQueueMode=false;
  }

  await writeNow();
}

async function quickPlanAddNext(savePlan) {
  if(writeOrBatchIsActive()) {
    validationError("Finish or stop the current task first.");
    return;
  }

  // Choosing Add + Next explicitly enters multi-task mode. Hide the one-off
  // alternative immediately so the primary path becomes a single full-width
  // action with no competing choice.
  suppressOneOffForCurrentBatch();

  quickQueueMode=true;
  lastPlanActionSucceeded=false;

  try {
    await savePlan();

    if(!lastPlanActionSucceeded) return;

    // Existing recorded data is protected automatically. No prompt, no
    // duplicate task: just move to the next program.
    if(currentProgramAlreadyRecorded()) {
      if(stickyNextAvailable()) {
        await stickyNextItem();
      }
      return;
    }

    await stickyAddToBatch();
  } finally {
    quickQueueMode=false;
  }
}

function stickyPreviousAvailable() {
  if(writeOrBatchIsActive()) return false;

  if(context?.pageType==="maladaptive") {
    return selectedBehaviorIndex > 0;
  }

  if(context?.pageType==="replacement") {
    return selectedReplacementIndex > 0;
  }

  if(context?.pageType==="challenging") {
    return selectedChallengingIndex > 0;
  }

  if(context?.pageType==="client2replacement") {
    return selectedClient2ReplacementIndex > 0;
  }

  return false;
}

async function stickyPreviousItem() {
  if(!stickyPreviousAvailable()) {
    toast("You are already on the first item.");
    return;
  }

  if(context?.pageType==="maladaptive") {
    selectBehavior(selectedBehaviorIndex-1);
    updateStickyActionBar();
    return;
  }

  if(context?.pageType==="replacement") {
    selectReplacement(selectedReplacementIndex-1);
    updateStickyActionBar();
    return;
  }

  if(context?.pageType==="challenging") {
    await selectChallenging(selectedChallengingIndex-1);
    updateStickyActionBar();
    return;
  }

  if(context?.pageType==="client2replacement") {
    await selectClient2Replacement(selectedClient2ReplacementIndex-1);
    updateStickyActionBar();
  }
}

function stickyNextAvailable() {
  if(writeOrBatchIsActive()) return false;

  if(context?.pageType==="maladaptive") {
    return selectedBehaviorIndex < BEHAVIORS.length-1;
  }

  if(context?.pageType==="replacement") {
    return selectedReplacementIndex < REPLACEMENTS.length-1;
  }

  if(context?.pageType==="challenging") {
    return selectedChallengingIndex < CHALLENGING.length-1;
  }

  if(context?.pageType==="client2replacement") {
    return selectedClient2ReplacementIndex < CLIENT2_REPLACEMENTS.length-1;
  }

  return false;
}

async function stickyNextItem() {
  if(!stickyNextAvailable()) {
    toast("You are already on the last item.");
    return;
  }

  if(context?.pageType==="maladaptive") {
    selectBehavior(selectedBehaviorIndex+1);
    updateStickyActionBar();
    return;
  }

  if(context?.pageType==="replacement") {
    selectReplacement(selectedReplacementIndex+1);
    updateStickyActionBar();
    return;
  }

  if(context?.pageType==="challenging") {
    await selectChallenging(selectedChallengingIndex+1);
    updateStickyActionBar();
    return;
  }

  if(context?.pageType==="client2replacement") {
    await selectClient2Replacement(selectedClient2ReplacementIndex+1);
    updateStickyActionBar();
  }
}


function stickyAutoRun() {
  const btn=$("autoBatchStart");

  if(!btn || btn.disabled) {
    if(autoBatchState.armed) {
      toast("Tasks are already running.");
    }
    return;
  }

  btn.click();
}

function writeOrBatchIsActive() {
  return !!(
    activeWriteUiState.busy ||
    autoBatchState.armed ||
    autoBatchState.busy ||
    batchRunningKind
  );
}

function updateStopControls() {
  const active=writeOrBatchIsActive();
  const supported=!!kindForPageType(context?.pageType);

  const stickyStop=$("stickyStop");
  if(stickyStop) {
    stickyStop.disabled=!supported || !active;
    stickyStop.hidden=!active;
    stickyStop.setAttribute("aria-hidden",active ? "false" : "true");
  }

  const cardStop=$("autoBatchStop");
  if(cardStop) cardStop.disabled=!active;
}

async function abortDirectActiveWrite() {
  if(!activeWriteUiState.busy || !Number.isInteger(activeWriteUiState.tabId)) {
    toast("Nothing is currently filling data.");
    return;
  }

  const tabId=activeWriteUiState.tabId;

  try {
    await sendMessageToTab(tabId,{type:"ABORT_ACTIVE_WRITE"});
    toast("Stopping… the current click may finish, but no additional data clicks will be sent.",5000);
  } catch(err) {
    toast(`Could not send Stop to the active Office Puzzle write: ${String(err?.message || err)}`,6000);
  }
}

async function stopAnyActiveWrite() {
  if(autoBatchState.armed || autoBatchState.busy || batchRunningKind) {
    await stopAutoBatchRunner();
    return;
  }

  if(activeWriteUiState.busy) {
    await abortDirectActiveWrite();
    return;
  }

  toast("Nothing is currently running.");
}

function stickyStopRun() {
  stopAnyActiveWrite();
}


function failedBatchItem(kind=currentPageBatchKind()) {
  const list=
    kind
      ? (batchState[kind] || [])
      : [];

  return (
    list.find(
      item=>item.status==="failed"
    ) || null
  );
}

function retryableBatchState(kind=currentPageBatchKind()) {
  const list=
    kind
      ? (batchState[kind] || [])
      : [];

  const failed=
    list.find(
      item=>item.status==="failed"
    ) || null;

  return {
    kind,
    list,
    failed,
    retryable:
      Boolean(
        failed ||
        (
          autoBatchState.stoppedOnError &&
          list.some(
            item=>item.status!=="verified"
          )
        )
      )
  };
}

async function resetIdleRunnerState({
  stoppedOnError=false,
  completed=false
}={}) {
  autoBatchState.armed=false;
  autoBatchState.busy=false;
  autoBatchState.stoppedOnError=
    Boolean(stoppedOnError);
  autoBatchState.completed=
    Boolean(completed);
  autoBatchState.lockedTabId=null;

  await persistAutoBatchRunnerState();
}

function updateOneOffActionVisibility() {
  for(const cluster of document.querySelectorAll(".primaryActionCluster[data-batch-kind]")) {
    const kind=cluster.dataset.batchKind || "";
    const list=batchState[kind] || [];

    // Run once is a contextual alternative to building a multi-task queue.
    // Hide it only while there is REAL unfinished batch work. A completed
    // historical task list must never permanently suppress the one-off action.
    // This makes visibility derive from current state instead of a sticky flag.
    const hasUnresolvedTasks=
      list.some(item=>item?.status!=="verified");

    if(!hasUnresolvedTasks) {
      oneOffSuppressedKinds.delete(kind);
    }

    const suppressed=
      hasUnresolvedTasks &&
      (
        oneOffSuppressedKinds.has(kind) ||
        list.length>0
      );

    cluster.classList.toggle("multiTaskMode",suppressed);
  }
}

function suppressOneOffForCurrentBatch() {
  const kind=currentPageBatchKind();
  if(!kind) return;
  oneOffSuppressedKinds.add(kind);
  updateOneOffActionVisibility();
}

function restoreOneOffIfQueueEmpty(kind) {
  if(!kind) return;
  if((batchState[kind] || []).length===0) {
    oneOffSuppressedKinds.delete(kind);
  }
  updateOneOffActionVisibility();
}

function reconcileOneOffAfterRun(kind=currentPageBatchKind()) {
  if(kind) {
    const list=batchState[kind] || [];
    const hasUnresolvedTasks=
      list.some(item=>item?.status!=="verified");

    if(!hasUnresolvedTasks) {
      oneOffSuppressedKinds.delete(kind);
    }
  }

  updateOneOffActionVisibility();
}

function updateQuickQueueButtons() {
  const advances=stickyNextAvailable();
  const label=advances ? "Add + Next" : "Add";
  const title=advances
    ? "Plan this program, add it to Tasks, and move to the next program"
    : "Plan this program and add it to Tasks";

  for(const id of [
    "generatePlan",
    "generateChallengingPlan",
    "generateClient2ReplacementPlan",
    "generateReplacementPlan"
  ]) {
    const button=$(id);
    if(!button || button.dataset.actionBusy==="true") continue;
    button.textContent=label;
    button.title=title;
    button.setAttribute("aria-label",title);
  }
}

function updateStickyActionBar() {
  const supported=
    !!kindForPageType(
      context?.pageType
    );

  const bar=$("stickyActionBar");
  if(bar) bar.hidden=!supported;

  const addBtn=$("stickyAddBatch");
  const previousBtn=$("stickyPrevious");
  const nextBtn=$("stickyNext");
  const autoBtn=$("stickyAutoRun");
  const stopBtn=$("stickyStop");

  if(addBtn) {
    addBtn.disabled=
      !supported ||
      !canStickyAddCurrent();

    const advances=
      supported &&
      !writeOrBatchIsActive() &&
      stickyNextAvailable();

    addBtn.textContent=advances ? "Add + Next" : "Add";
    addBtn.title=advances
      ? "Add this item to Tasks and open the next program · Ctrl/Cmd + Enter"
      : "Add this item to Tasks · Ctrl/Cmd + Enter";
    addBtn.setAttribute("aria-label",advances ? "Add item and open next program" : "Add item to Tasks");
  }

  if(previousBtn) {
    previousBtn.disabled=
      !supported ||
      !stickyPreviousAvailable();
  }

  if(nextBtn) {
    nextBtn.disabled=
      !supported ||
      !stickyNextAvailable();
  }

  const recovery=
    retryableBatchState();

  const list=recovery.list;

  const hasRunnable=
    list.some(
      item=>item.status!=="verified"
    );

  const running=
    autoBatchState.armed ||
    autoBatchState.busy;
  const working=
    running ||
    activeWriteUiState.busy ||
    Boolean(batchRunningKind);

  if(bar) bar.classList.toggle("isRunning",working);

  const runLabel=
    working
      ? "Working…"
      : recovery.retryable
        ? "Retry"
        : "Run";

  const runTitle=
    recovery.retryable
      ? "Retry from the stopped task"
      : "Run all tasks";

  if(autoBtn) {
    autoBtn.disabled=
      !supported ||
      working ||
      !hasRunnable;

    autoBtn.textContent=runLabel;
    autoBtn.title=runTitle;
    autoBtn.setAttribute(
      "aria-label",
      runTitle
    );
  }

  const cardRunBtn=$("autoBatchStart");

  if(cardRunBtn) {
    cardRunBtn.disabled=
      !supported ||
      working ||
      !hasRunnable;

    cardRunBtn.textContent=runLabel;
    cardRunBtn.title=runTitle;
    cardRunBtn.setAttribute(
      "aria-label",
      runTitle
    );
  }

  if(stopBtn) {
    const active=writeOrBatchIsActive();
    stopBtn.disabled=!supported || !active;
    stopBtn.hidden=!active;
    stopBtn.setAttribute("aria-hidden",active ? "false" : "true");
  }

  updateQuickQueueButtons();
  updateAutoProgress();
  updateStopControls();
  updateAllWeekNavigators();
}

function shouldIgnoreShortcut(event) {
  const target=event.target;
  if(!target) return false;

  const tag=String(target.tagName || "").toLowerCase();
  return tag==="input" || tag==="textarea" || tag==="select" || target.isContentEditable;
}

function installEnterToCommit() {
  const actionByInput={
    weeklyTarget:"generatePlan",
    replacementWeeklyTarget:"generateReplacementPlan",
    challengingWeeklyTarget:"generateChallengingPlan",
    client2ReplacementWeeklyTarget:"generateClient2ReplacementPlan"
  };

  document.addEventListener("keydown",event=>{
    if(event.defaultPrevented || event.isComposing || event.key!=="Enter") return;

    const input=event.target?.closest?.("input");
    if(!input || input.disabled || input.readOnly) return;
    if(input.classList.contains("customSelectSearch")) return;

    if(input.id==="clientHoursInput") {
      event.preventDefault();
      input.blur();
      return;
    }

    const actionId=actionByInput[input.id];
    if(actionId) {
      event.preventDefault();
      $(actionId)?.click();
      return;
    }

    // Enter should always commit a single-line input, even when there is no
    // explicit primary action attached to it.
    if(input.type!=="button" && input.type!=="submit") {
      event.preventDefault();
      input.dispatchEvent(new Event("change",{bubbles:true}));
      input.blur();
    }
  });
}

function handleKeyboardShortcuts(event) {
  if(event.defaultPrevented) return;

  // Ctrl/Cmd + Enter is allowed even while an input/select is focused.
  if((event.ctrlKey || event.metaKey) && event.key==="Enter") {
    event.preventDefault();

    if(context?.pageType==="maladaptive") quickPlanAddNext(saveGeneratedPlan);
    else if(context?.pageType==="replacement") quickPlanAddNext(saveReplacementPlan);
    else if(context?.pageType==="challenging") quickPlanAddNext(saveChallengingPlan);
    else if(context?.pageType==="client2replacement") quickPlanAddNext(saveClient2ReplacementPlan);

    return;
  }

  if(shouldIgnoreShortcut(event)) return;

  if(event.altKey && event.key.toLowerCase()==="p") {
    event.preventDefault();
    stickyPreviousItem();
    return;
  }

  if(event.altKey && event.key.toLowerCase()==="n") {
    event.preventDefault();
    stickyNextItem();
    return;
  }

  if(event.altKey && event.key.toLowerCase()==="r") {
    event.preventDefault();
    stickyAutoRun();
  }
}

function setAutoBatchMessage(message,mode="normal") {
  const status=$("autoBatchStatus");
  const badge=$("autoBatchBadge");
  const card=document.querySelector(".autoBatchCard");

  if(status) {
    status.textContent=message;
    status.dataset.tone=
      ["good","bad","wait"].includes(mode)
        ? mode
        : "normal";
  }

  if(badge) {
    badge.textContent=
      autoBatchState.stoppedOnError ? "Stopped" :
      autoBatchState.completed ? "Completed" :
      autoBatchState.armed ? "Running" : "Off";
  }

  if(card) {
    card.classList.toggle(
      "running",
      autoBatchState.armed && !autoBatchState.stoppedOnError
    );

    card.classList.toggle(
      "stoppedOnError",
      autoBatchState.stoppedOnError
    );
  }

  if($("autoBatchStart")) {
    $("autoBatchStart").disabled=
      autoBatchState.armed || autoBatchState.busy;
  }

  updateStopControls();
  updateStickyActionBar();
}

async function startAutoBatchRunner() {
  if(
    autoBatchState.armed ||
    autoBatchState.busy ||
    autoBatchTickRunning ||
    batchRunningKind
  ) return;

  const kind=currentPageBatchKind();
  const recovery=retryableBatchState(kind);
  const list=recovery.list;

  if(!kind || !list.length) {
    await resetIdleRunnerState();

    renderAllBatches();

    setAutoBatchMessage(
      "No tasks queued."
    );

    return;
  }

  const retrying=
    recovery.retryable;

  if(!retrying) {
    const proceed=await rbtConfirm({
      title:"Run these tasks?",
      message:
        "Run all tasks on this page?\n\n" +
        "Tasks run one at a time. If one cannot be completed, the run stops so you can check it.",
      confirmText:"Run"
    });

    if(
      !proceed ||
      autoBatchState.armed ||
      autoBatchState.busy ||
      autoBatchTickRunning ||
      batchRunningKind
    ) return;
  } else {
    for(const item of list) {
      if(item.status==="failed") {
        item.status="ready";
        item.error="";
      }
    }

    // Do not touch replacementStage here.
    // A replacement that already completed its clear stage must resume
    // with the planned write instead of clearing the Office Puzzle date twice.
    autoBatchState.stoppedOnError=false;
    autoBatchState.completed=false;

    await saveBatchKind(kind);

    setAutoBatchMessage(
      recovery.failed?.name
        ? `Retrying ${recovery.failed.name}. Completed tasks will be skipped.`
        : "Retrying the stopped run. Completed tasks will be skipped.",
      "wait"
    );
  }

  const startTab=await getActiveTab();

  if(
    !startTab?.id ||
    !isOfficePuzzleUrl(startTab.url)
  ) {
    await resetIdleRunnerState({
      stoppedOnError:true
    });

    renderAllBatches();

    setAutoBatchMessage(
      "Open the Office Puzzle tab, then press Retry.",
      "bad"
    );

    return;
  }

  try {
    await ensureTabConnection(
      startTab
    );

    const lockedContext=
      await sendMessageToTab(
        startTab.id,
        {type:"GET_CONTEXT"}
      );

    if(!lockedContext?.ok) {
      throw new Error(
        "Office Puzzle context was unavailable."
      );
    }
  } catch(err) {
    await resetIdleRunnerState({
      stoppedOnError:true
    });

    renderAllBatches();

    setAutoBatchMessage(
      `Could not start: ${String(
        err?.message || err
      )}. Press Retry when Office Puzzle is ready.`,
      "bad"
    );

    return;
  }

  if(
    autoBatchState.armed ||
    autoBatchState.busy ||
    autoBatchTickRunning ||
    batchRunningKind
  ) return;

  autoBatchState.lockedTabId=
    startTab.id;

  autoBatchState.armed=true;
  autoBatchState.busy=false;
  autoBatchState.stoppedOnError=false;
  autoBatchState.completed=false;
  autoBatchState.lastContextSignature="";

  await persistAutoBatchRunnerState();

  setAutoBatchMessage(
    retrying
      ? "Retrying from the stopped task…"
      : "Running tasks on this Office Puzzle tab. You can switch to other tabs while it works.",
    "wait"
  );

  await autoBatchTick();
}

async function stopAutoBatchRunner() {
  autoBatchState.armed=false;
  autoBatchState.completed=false;

  // Stop the active content-side writer on the LOCKED Office Puzzle tab
  // before its NEXT data click. A click already in flight may finish its
  // verification, but no later trial/interval/count transition should be sent.
  try {
    await sendTab({type:"ABORT_ACTIVE_WRITE"});
  } catch(_) {}

  await persistAutoBatchRunnerState();

  if(autoBatchState.busy || batchRunningKind) {
    setAutoBatchMessage(
      "Stopping… current click may finish, but no additional data clicks will be sent.",
      "wait"
    );
  } else {
    autoBatchState.stoppedOnError=false;
    setAutoBatchMessage("Stopped by user.");
  }
}



async function refreshAutoBatchMappingsBeforeWrite(kind) {
  const scan=await sendTab({type:"DISCOVER_CLIENT_PROGRAMS"});

  if(!scan?.ok) {
    return {
      ok:false,
      error:scan?.error || "Could not refresh Office Puzzle program mappings."
    };
  }

  const programs=scan.programs || [];
  const byName={};

  for(const mapping of programs) {
    if(mapping?.found) byName[mapping.name]=mapping;
  }

  const list=batchState[kind] || [];

  for(const queued of list) {
    const fresh=byName[queued.name];
    if(fresh?.found) queued.mapping={...fresh};
  }

  applyLiveDiscoveryMappings(scan);
  await saveBatchKind(kind);

  return {ok:true,byName};
}

async function executeAutoBatchItem(kind,item) {
  // Office Puzzle can re-render while Auto Run is waiting for the prior save
  // window to clear. Refresh the exact-name mappings immediately before every
  // write so the writer never receives a stale table registry id/reference.
  const refreshed=await refreshAutoBatchMappingsBeforeWrite(kind);

  if(!refreshed?.ok) {
    return {
      ok:false,
      failedItem:item.name,
      error:refreshed?.error || "Could not refresh the current table mapping."
    };
  }

  const fresh=refreshed.byName?.[item.name];

  if(!fresh?.found) {
    return {
      ok:false,
      failedItem:item.name,
      error:`Could not freshly map ${item.name} immediately before Run Batch. No write was sent.`
    };
  }

  item.mapping={...fresh};

  // Auto Run owns its own serialization through autoBatchState.busy.
  item.status="applying";
  item.error="";
  await saveBatchKind(kind);

  let execution;

  try {
    if(kind==="client1Behaviors") {
      execution=await executeCountBatchItem(item,kind);
    } else if(kind==="client1Replacements") {
      execution=await executeClient1ReplacementBatchItem(item);
    } else if(kind==="client2Challenging") {
      execution=
        item.type==="count"
          ? await executeCountBatchItem(item,kind)
          : await executeClient2IntervalBatchItem(item);
    } else if(kind==="client2Replacements") {
      execution=await executeClient2ReplacementBatchItem(item);
    } else {
      execution={
        ok:false,
        error:"Unknown task type."
      };
    }
  } catch(err) {
    execution={
      ok:false,
      error:String(err?.message || err)
    };
  }

  if(!execution?.ok) {
    item.status="failed";
    item.error=execution?.error || "Verification failed.";
    await saveBatchKind(kind);

    return {
      ok:false,
      failedItem:item.name,
      error:item.error
    };
  }

  item.status="verified";
  item.error="";
  updateLocalMappingAfterBatch(kind,item,execution.result);
  await saveBatchKind(kind);

  return {
    ok:true,
    completedItem:item.name,
    result:execution.result
  };
}


const AUTO_RUN_FIRST_ITEM_SETTLE_MS=120;
const AUTO_RUN_BETWEEN_ITEMS_SETTLE_MS=180;

async function waitForOfficePuzzleBatchSettle({
  firstItem=false,
  itemName=""
}={}) {
  const ms=firstItem
    ? AUTO_RUN_FIRST_ITEM_SETTLE_MS
    : AUTO_RUN_BETWEEN_ITEMS_SETTLE_MS;

  if(autoBatchState.armed) {
    setAutoBatchMessage(
      firstItem
        ? "Ready. Waiting briefly for Office Puzzle before the first task…"
        : `${itemName || "Item"} completed. Waiting for Office Puzzle to finish saving before the next write…`,
      "wait"
    );
  }

  await batchDelay(ms);
}

async function runAutoBatchSerial(kind) {
  const def=batchDefinition(kind);
  const list=batchState[kind] || [];

  // Give Office Puzzle a short quiet window before the first Auto Run write.
  // This prevents a just-finished page request from colliding with the batch.
  await waitForOfficePuzzleBatchSettle({firstItem:true});

  // This function is entered only after autoBatchTick has set busy=true.
  // It owns the entire reviewed list until complete/failure/stop.
  for(let index=0; index<list.length; index++) {
    const item=list[index];

    // Completed items from an earlier attempt are never rewritten.
    if(item.status==="verified") continue;

    if(!autoBatchState.armed) {
      return {
        ok:false,
        cancelled:true,
        error:"Stopped."
      };
    }

    if(item.status==="failed") {
      return {
        ok:false,
        failedItem:item.name,
        error:item.error || `Stopped on ${item.name}.`
      };
    }

    setAutoBatchMessage(
      `${def.label}: refreshing ${item.name} mapping, then applying (${index+1}/${list.length})…`,
      "wait"
    );

    const execution=await executeAutoBatchItem(kind,item);

    if(!execution?.ok) {
      return execution;
    }

    // Keep the runner armed/resumable after every completed item.
    await persistAutoBatchRunnerState();

    const remaining=list.filter(entry=>entry.status!=="verified").length;

    setAutoBatchMessage(
      `${execution.completedItem} completed. ` +
      `${remaining} task${remaining===1 ? "" : "s"} remaining — moving to the next one…`,
      "good"
    );

    // IMPORTANT: table verification can finish before Office Puzzle's backend
    // save request has fully cleared. Do not begin another batch item until a
    // global save-settle window has passed. This applies to ALL clients/types.
    if(remaining>0) {
      await waitForOfficePuzzleBatchSettle({
        firstItem:false,
        itemName:execution.completedItem
      });
    }
  }

  return {
    ok:true,
    complete:true,
    verifiedCount:list.filter(item=>item.status==="verified").length
  };
}

let autoBatchTickRunning=false;

async function autoBatchTick() {
  // Manual page-batch actions keep their own batchRunningKind lock.
  // Auto Run only waits if a REAL manual batch is active when this tick begins.
  if(autoBatchTickRunning || !autoBatchState.armed || autoBatchState.busy) return;

  if(batchRunningKind) {
    setAutoBatchMessage(
      "Finishing the current task…",
      "wait"
    );
    return;
  }

  // Own the entire tick before the first await, including context refresh.
  autoBatchTickRunning=true;
  try {
    const r=await sendTab({type:"GET_CONTEXT"});
    if(!r?.ok) return;

    const signature=
      `${cleanClientKey(r.clientLabel)}::${r.selectedDate || ""}::${r.pageType}`;

    if(signature!==autoBatchState.lastContextSignature) {
      autoBatchState.lastContextSignature=signature;
      await refreshContext();
    }

    if(!autoBatchState.armed) return;

    const kind=kindForPageType(r.pageType);

    if(!kind) {
      setAutoBatchMessage(
        "Open a Behavior or Replacement page to continue.",
        "wait"
      );
      return;
    }

    const def=batchDefinition(kind);
    const readiness=pageBatchReady(kind);

    if(readiness.complete) {
      autoBatchState.armed=false;
      autoBatchState.busy=false;
      autoBatchState.stoppedOnError=false;
      autoBatchState.completed=true;
      await persistAutoBatchRunnerState();

      renderAllBatches();

      setAutoBatchMessage(
        `${def.label}: all ${batchState[kind]?.length || 0} tasks completed.`,
        "good"
      );
      return;
    }

    if(!readiness.ready) {
      const list=
        batchState[kind] || [];

      const failed=
        list.find(
          item=>item.status==="failed"
        );

      if(!list.length) {
        await resetIdleRunnerState();

        renderAllBatches();

        setAutoBatchMessage(
          "No tasks queued."
        );

        return;
      }

      if(failed) {
        await resetIdleRunnerState({
          stoppedOnError:true
        });

        renderAllBatches();

        setAutoBatchMessage(
          `Stopped on ${failed.name}. ${failed.error || "Office Puzzle could not complete the task."} ` +
          "Check Office Puzzle, then press Retry. Completed tasks will be skipped.",
          "bad"
        );

        return;
      }

      if(!readiness.complete) {
        await resetIdleRunnerState({
          stoppedOnError:true
        });

        renderAllBatches();

        setAutoBatchMessage(
          `${readiness.reason} Fix the task or add it again, then press Retry.`,
          "bad"
        );

        return;
      }

      setAutoBatchMessage(
        `${def.label}: ${readiness.reason}`,
        "wait"
      );

      return;
    }

    // Auto Run uses the exact same batch executor as the manual
    // "Apply batch" button. One implementation, one behavior.
    autoBatchState.busy=true;
    autoBatchState.completed=false;
    autoBatchState.stoppedOnError=false;
    await persistAutoBatchRunnerState();

    setAutoBatchMessage(
      `${def.label}: running tasks…`,
      "wait"
    );

    const result=await applyBatch(kind,{
      skipConfirm:true,
      source:"auto"
    });

    autoBatchState.busy=false;

    if(!result?.ok) {
      if(result?.cancelled) {
        autoBatchState.stoppedOnError=false;
        autoBatchState.completed=false;
        await persistAutoBatchRunnerState();
        setAutoBatchMessage(
          result?.aborted ? "Stopped. No additional changes were sent." : "Ready when you are.",
          "wait"
        );
        return;
      }

      autoBatchState.armed=false;
      autoBatchState.completed=false;
      autoBatchState.stoppedOnError=true;
      await persistAutoBatchRunnerState();

      renderAllBatches();

      setAutoBatchMessage(
        `Stopped on ${result?.failedItem || "a task"}. ` +
        `${result?.error || "Office Puzzle could not complete the task."} ` +
        "Check Office Puzzle, then press Retry. Completed tasks will be skipped.",
        "bad"
      );
      return;
    }

    // At this point applyBatch() has verified every reviewed item.
    // That is the authoritative completion condition.
    autoBatchState.armed=false;
    autoBatchState.busy=false;
    autoBatchState.stoppedOnError=false;
    autoBatchState.completed=true;

    await persistAutoBatchRunnerState();

    renderAllBatches();

    const completedCount=(batchState[kind] || [])
      .filter(item=>item.status==="verified").length;
    const totalCount=(batchState[kind] || []).length;

    setAutoBatchMessage(
      `${def.label}: ${completedCount}/${totalCount} tasks completed.`,
      "good"
    );
  } catch(err) {
    if(autoBatchState.armed && isRecoverableBatchConnectionError(err)) {
      autoBatchState.busy=false;
      autoBatchState.completed=false;
      autoBatchState.stoppedOnError=false;
      await persistAutoBatchRunnerState();

      try { renderAllBatches(); } catch(_) {}

      setAutoBatchMessage(
        "Office Puzzle is reconnecting after a tab/app switch. Holding your place and retrying automatically…",
        "wait"
      );
      return;
    }

    // Defensive completion check: if every reviewed item on the current page
    // is already verified, a late UI/context exception must not relabel the
    // completed clinical batch as a failure.
    const currentKind=kindForPageType(context?.pageType);
    const currentList=currentKind ? (batchState[currentKind] || []) : [];
    const allVerified=
      currentList.length>0 &&
      currentList.every(item=>item.status==="verified");

    if(allVerified) {
      autoBatchState.busy=false;
      autoBatchState.armed=false;
      autoBatchState.stoppedOnError=false;
      autoBatchState.completed=true;
      await persistAutoBatchRunnerState();

      try { renderAllBatches(); } catch(_) {}

      setAutoBatchMessage(
        `All ${currentList.length} tasks completed.`,
        "good"
      );
      return;
    }

    autoBatchState.busy=false;
    autoBatchState.armed=false;
    autoBatchState.completed=false;
    autoBatchState.stoppedOnError=true;
    await persistAutoBatchRunnerState();

    renderAllBatches();

    setAutoBatchMessage(
      `Run stopped: ${String(err?.message || err)} ` +
      "Check Office Puzzle, then press Retry. Completed tasks will be skipped.",
      "bad"
    );
  } finally {
    autoBatchTickRunning=false;
  }
}


async function executeBatchItemOnce(kind,item) {
  try {
    if(kind==="client1Behaviors") {
      return await executeCountBatchItem(item,kind);
    }

    if(kind==="client1Replacements") {
      return await executeClient1ReplacementBatchItem(item);
    }

    if(kind==="client2Challenging") {
      return item.type==="count"
        ? await executeCountBatchItem(item,kind)
        : await executeClient2IntervalBatchItem(item);
    }

    if(kind==="client2Replacements") {
      return await executeClient2ReplacementBatchItem(item);
    }

    return {ok:false,error:"Unknown task type."};
  } catch(err) {
    return {ok:false,error:String(err?.message || err)};
  }
}

function autoRetryDelayMs(attempt) {
  // Keep retries responsive, but give Office Puzzle enough time to finish a
  // save / DOM repaint before we re-read the exact same task. There is NO
  // retry limit; this delay only prevents a tight retry loop.
  return Math.min(900,180 + Math.max(0,Number(attempt || 1)-1)*120);
}

async function refreshMappingForAutoRetry(kind,item) {
  const refreshed=await refreshAutoBatchMappingsBeforeWrite(kind);

  if(!refreshed?.ok) {
    return {
      ok:false,
      error:refreshed?.error || "Could not re-read Office Puzzle before retrying."
    };
  }

  const fresh=refreshed.byName?.[item.name];

  if(!fresh?.found) {
    return {
      ok:false,
      error:`Could not freshly map ${item.name} before retrying. No click was sent.`
    };
  }

  item.mapping={...fresh};
  return {ok:true};
}

async function applyBatch(kind,{skipConfirm=false,source="manual"}={}) {
  if(batchRunningKind) {
    if(!skipConfirm) toast("Tasks are already running.");
    return {ok:false,error:"Tasks are already running."};
  }

  const def=batchDefinition(kind);
  const list=batchState[kind] || [];
  const pending=list.filter(item=>item.status!=="verified");

  if(!pending.length) {
    if(!skipConfirm) {
      toast(list.length ? "All tasks are already completed." : "No tasks added yet.");
    }
    return {ok:!!list.length,alreadyComplete:!!list.length};
  }

  if(!skipConfirm) {
    const proceed=await rbtConfirm({
      title:"Run these tasks?",
      message:
        `Run ${pending.length} task${pending.length===1 ? "" : "s"} on the ${def.label}?\n\n` +
        `They will run one at a time. ` +
        `If a task cannot be completed, the run stops so you can check it.`,
      confirmText:"Run"
    });

    if(!proceed) return {ok:false,cancelled:true,error:"Cancelled."};
  }

  // Confirmation can yield; recheck before acquiring execution ownership.
  if(batchRunningKind) {
    return {ok:false,error:"Tasks are already running."};
  }

  batchRunningKind=kind;

  try {
    if(source!=="auto") {
      const startTab=await getActiveTab();

      if(!startTab?.id || !isOfficePuzzleUrl(startTab.url)) {
        return {ok:false,error:"Open the Office Puzzle tab before running tasks."};
      }

      await ensureTabConnection(startTab);
      batchTargetTabId=startTab.id;
    }

    updateStickyActionBar();
    updateStopControls();

    for(const item of list) {
      if(item.status==="failed") {
        item.status="ready";
        item.error="";
      }
    }

    await saveBatchKind(kind);

    for(let index=0; index<list.length; index++) {
      const item=list[index];
      if(item.status==="verified") continue;

      let retryAttempt=0;
      let execution=null;

      // Auto Run is self-healing: a verification miss never advances to the
      // next task and never blindly sends another click. It waits, freshly
      // re-maps the Office Puzzle table, and runs the SAME safe writer again.
      // The writer itself begins by reading the cell's CURRENT + / blank / -
      // state, so a retry continues from what Office Puzzle actually shows.
      while(true) {
        if(source==="auto" && !autoBatchState.armed) {
          item.status="ready";
          item.error="";
          updateStickyActionBar();
          updateStopControls();
          await saveBatchKind(kind);

          return {
            ok:false,
            cancelled:true,
            aborted:true,
            failedItem:item.name,
            error:"Stopped by user."
          };
        }

        // After a failed attempt, never trust the old table mapping. Re-scan
        // first. If Office Puzzle itself is still rerendering, keep waiting and
        // rescanning without sending a data click.
        if(source==="auto" && retryAttempt>0) {
          const refreshed=await refreshMappingForAutoRetry(kind,item);

          if(!refreshed.ok) {
            item.status="applying";
            item.error=refreshed.error;
            await saveBatchKind(kind);

            setAutoBatchMessage(
              `${def.label}: ${item.name} is still settling. ` +
              `Auto retry ${retryAttempt} — rescanning until the table is readable…`,
              "wait"
            );

            await batchDelay(autoRetryDelayMs(retryAttempt));
            retryAttempt++;
            continue;
          }
        }

        item.status="applying";
        // Keep the latest retry reason visible in storage while it is retrying,
        // but clear it on the very first attempt.
        if(retryAttempt===0) item.error="";
        await saveBatchKind(kind);

        execution=await executeBatchItemOnce(kind,item);

        if(execution?.ok) break;

        if(execution?.cancelled || execution?.aborted) {
          item.status="ready";
          item.error="";
          updateStickyActionBar();
          updateStopControls();
          await saveBatchKind(kind);

          return {
            ok:false,
            cancelled:true,
            aborted:true,
            failedItem:item.name,
            error:execution?.error || "Stopped by user."
          };
        }

        // Manual Apply keeps the original conservative behavior. Auto Run is
        // the mode that retries forever until verified or the user presses Stop.
        if(source!=="auto") {
          item.status="failed";
          item.error=execution?.error || "Verification failed.";
          updateStickyActionBar();
          updateStopControls();
          await saveBatchKind(kind);

          if(!skipConfirm) {
            toast(`Batch stopped at ${item.name} only after the post-write re-read still did not match. Nothing after this item was written.`,7000);
          }

          return {ok:false,failedItem:item.name,error:item.error};
        }

        retryAttempt++;
        item.status="applying";
        item.error=execution?.error || "Verification failed; auto-retrying.";
        await saveBatchKind(kind);
        await persistAutoBatchRunnerState();

        setAutoBatchMessage(
          `${def.label}: ${item.name} was not verified yet. ` +
          `Auto retry ${retryAttempt} — waiting, rescanning, then continuing from the observed cell state…`,
          "wait"
        );

        // Do not immediately click again. Office Puzzle must get a quiet
        // window, then the next loop freshly re-reads the table before writing.
        await batchDelay(autoRetryDelayMs(retryAttempt));
      }

      item.status="verified";
      item.error="";
      updateLocalMappingAfterBatch(kind,item,execution.result);
      await saveBatchKind(kind);

      if(source==="auto" && autoBatchState.armed) {
        await persistAutoBatchRunnerState();
      }

      // Give Office Puzzle a short settle window, then continue directly to
      // the next Verified item in this same for-loop.
      if(index<list.length-1) {
        await batchDelay(35);
      }
    }

    updateStickyActionBar();
    updateStopControls();
    await saveBatchKind(kind);

    // All clinical writes have already completed and every item is verified.
    // Any side-panel redraw problem after this point is a UI issue, not a batch
    // failure. Never turn a successfully verified batch into "Stopped".
    let uiWarning="";

    try {
      if(kind==="client1Behaviors") {
        renderSelectedBehavior();
      } else if(kind==="client1Replacements") {
        renderSelectedReplacement();
      } else if(kind==="client2Challenging") {
        challengingMapping=
          challengingMappingsByName[selectedChallengingName()] ||
          challengingMapping;
        await renderChallengingMapping();
      } else if(kind==="client2Replacements") {
        client2ReplacementMapping=
          client2ReplacementMappingsByName[selectedClient2ReplacementName()] ||
          client2ReplacementMapping;
        await renderClient2Replacement();
      }
    } catch(err) {
      uiWarning=String(err?.message || err);
    }

    // Render batch/progress from the already-saved verified statuses.
    try {
      renderAllBatches();
    } catch(_) {}

    if(!skipConfirm) toast(`All ${list.length} task${list.length===1 ? "" : "s"} completed.`);

    return {
      ok:true,
      complete:true,
      verifiedCount:list.filter(item=>item.status==="verified").length,
      uiWarning
    };
  } finally {
    // Always release ownership, including unexpected storage/render failures.
    batchRunningKind=null;
    batchTargetTabId=null;

    // Re-render AFTER releasing the Run lock.
    try {
      renderBatch(kind);
      updateStickyActionBar();
      updateStopControls();
      reconcileOneOffAfterRun(kind);
    } catch(_) {}
  }
}



const UI_PREF_STORAGE_KEY="rbtUiPreferencesV2";

const DEFAULT_UI_PREFERENCES=Object.freeze({
  preset:"focus",
  density:"tight",
  accent:"standard",
  stickyHeader:true,
  animations:true,
  showClientCard:true,
  showProgramProgress:true,
  showProgramTitle:false,
  showProgramSelector:true,
  showPlanningInputs:true,
  showGenerate:true,
  showWeekOverview:true,
  showSelectedDay:true,
  // User requested the large planned +/- pane removed from the normal view.
  // It remains fully functional and can be restored instantly in Customize.
  showClearColumn:true,
  showBatchReview:true,
  showBatchControl:true,
  showStickyBar:true,
  showHelperText:false
});

const UI_PRESETS={
  focus:{
    ...DEFAULT_UI_PREFERENCES
  },
  balanced:{...DEFAULT_UI_PREFERENCES},
  full:{
    preset:"full",
    density:"roomy",
    accent:"standard",
    stickyHeader:true,
    animations:true,
    showClientCard:true,
    showProgramProgress:true,
    showProgramTitle:true,
    showProgramSelector:true,
    showPlanningInputs:true,
    showGenerate:true,
    showWeekOverview:true,
    showSelectedDay:true,
    showClearColumn:true,
    showBatchReview:true,
    showBatchControl:true,
    showStickyBar:true,
    showHelperText:true
  }
};

let uiPreferences={...DEFAULT_UI_PREFERENCES};

function normalizeUiPreferences(raw={}) {
  const next={...DEFAULT_UI_PREFERENCES};

  for(const key of Object.keys(next)) {
    if(Object.prototype.hasOwnProperty.call(raw,key)) {
      next[key]=raw[key];
    }
  }

  if(!["tight","compact","roomy"].includes(next.density)) {
    next.density=DEFAULT_UI_PREFERENCES.density;
  }

  if(!["standard","deep","soft"].includes(next.accent)) {
    next.accent=DEFAULT_UI_PREFERENCES.accent;
  }

  return next;
}

function markCustomizableRegions() {
  for(const id of [
    "behaviorSelect",
    "challengingSelect",
    "replacementSelect",
    "client2ReplacementSelect"
  ]) {
    $(id)?.closest(".field")?.classList.add("uiRegionProgramSelector");
  }

  for(const id of [
    "weeklyTarget",
    "challengingWeeklyTarget",
    "challengingHours",
    "replacementWeeklyTarget",
    "client2ReplacementWeeklyTarget"
  ]) {
    $(id)?.closest(".field")?.classList.add("uiRegionPlanningInput");
  }

  for(const id of [
    "generatePlan",
    "generateChallengingPlan",
    "generateReplacementPlan",
    "generateClient2ReplacementPlan"
  ]) {
    $(id)?.closest(".buttonRow")?.classList.add("uiRegionGenerate");
  }

  for(const id of [
    "clearBehaviorColumn",
    "clearChallengingColumn",
    "clearReplacementColumn",
    "clearClient2ReplacementColumn"
  ]) {
    const button=$(id);
    const region=button?.closest(".moreActions") || button;
    region?.classList.add("uiRegionClearColumn");
  }

  for(const id of [
    "challengingHoursSaved",
    "challengingHoursHint"
  ]) {
    $(id)?.classList.add("uiRegionHelperText");
  }

  for(const panel of document.querySelectorAll(".batchPanel .bindingText")) {
    panel.classList.add("uiRegionHelperText");
  }
}

function toggleUiClass(className,enabled) {
  document.body.classList.toggle(className,Boolean(enabled));
}

function applyUiPreferences(prefs=uiPreferences,{syncControls=true}={}) {
  uiPreferences=normalizeUiPreferences(prefs);

  document.body.dataset.uiDensity=uiPreferences.density;
  document.body.dataset.uiAccent=uiPreferences.accent;

  toggleUiClass("ui-hide-client-card",!uiPreferences.showClientCard);
  toggleUiClass("ui-hide-program-progress",!uiPreferences.showProgramProgress);
  toggleUiClass("ui-hide-program-title",!uiPreferences.showProgramTitle);
  toggleUiClass("ui-hide-program-selector",!uiPreferences.showProgramSelector);
  toggleUiClass("ui-hide-planning-inputs",!uiPreferences.showPlanningInputs);
  toggleUiClass("ui-hide-generate",!uiPreferences.showGenerate);
  toggleUiClass("ui-hide-week-overview",!uiPreferences.showWeekOverview);
  toggleUiClass("ui-hide-selected-day",!uiPreferences.showSelectedDay);
  toggleUiClass("ui-hide-clear-column",!uiPreferences.showClearColumn);
  toggleUiClass("ui-hide-batch-review",!uiPreferences.showBatchReview);
  toggleUiClass("ui-hide-batch-control",!uiPreferences.showBatchControl);
  toggleUiClass("ui-hide-sticky-bar",!uiPreferences.showStickyBar);
  toggleUiClass("ui-hide-helper-text",!uiPreferences.showHelperText);
  toggleUiClass("ui-static-header",!uiPreferences.stickyHeader);
  toggleUiClass("ui-no-motion",!uiPreferences.animations);

  if(syncControls) syncCustomizationControls();

  // Reposition transient UI if the bottom bar was just hidden/shown.
  positionToastAboveControls();
}

function syncCustomizationControls() {
  const drawer=$("customizeDrawer");
  if(!drawer) return;

  for(const input of drawer.querySelectorAll("[data-ui-pref]")) {
    const key=input.dataset.uiPref;
    input.checked=Boolean(uiPreferences[key]);
  }

  if($("uiDensity")) $("uiDensity").value=uiPreferences.density;
  if($("uiAccent")) $("uiAccent").value=uiPreferences.accent;

  for(const button of drawer.querySelectorAll("[data-ui-preset]")) {
    button.classList.toggle(
      "active",
      button.dataset.uiPreset===uiPreferences.preset
    );
  }
}

async function saveUiPreferences() {
  await storageSet({
    [UI_PREF_STORAGE_KEY]:uiPreferences
  });
}

async function loadUiPreferences() {
  // v1.1.68: one permanent, low-friction Focus layout. Customization is gone.
  uiPreferences={...DEFAULT_UI_PREFERENCES};
  applyUiPreferences(uiPreferences,{syncControls:false});
  await storageRemove([UI_PREF_STORAGE_KEY]);
}


function focusableElements(container) {
  if(!container) return [];

  return [
    ...container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), ' +
      'select:not([disabled]), textarea:not([disabled]), ' +
      '[tabindex]:not([tabindex="-1"])'
    )
  ].filter(element=>
    !element.hidden &&
    element.getAttribute("aria-hidden")!=="true" &&
    element.getClientRects().length>0
  );
}

function trapFocus(container,event) {
  if(event.key!=="Tab" || !container) return;

  const items=focusableElements(container);

  if(!items.length) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first=items[0];
  const last=items[items.length-1];

  if(
    event.shiftKey &&
    document.activeElement===first
  ) {
    event.preventDefault();
    last.focus();
  } else if(
    !event.shiftKey &&
    document.activeElement===last
  ) {
    event.preventDefault();
    first.focus();
  }
}

function restoreFocus(element,fallbackId=null) {
  const target=
    element?.isConnected
      ? element
      : fallbackId
        ? $(fallbackId)
        : null;

  setTimeout(()=>{
    target?.focus?.({
      preventScroll:true
    });
  },0);
}

function installSystemThemeListener() {
  if(!window.matchMedia) return;

  systemThemeMedia=window.matchMedia(
    "(prefers-color-scheme: dark)"
  );

  systemThemeMedia.addEventListener?.(
    "change",
    ()=>{
      if(!themeIsExplicit) {
        applyTheme(
          preferredSystemTheme()
        );
      }
    }
  );
}

function setWelcomeOpen(open,{
  markSeen=false
}={}) {
  const backdrop=$("welcomeBackdrop");
  const dialog=$("welcomeDialog");

  if(!backdrop || !dialog) return;

  if(open) {
    welcomeReturnFocus=
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    backdrop.hidden=false;
    document.body.classList.add(
      "welcomeOpen"
    );

    setTimeout(()=>{
      $("welcomeStart")?.focus();
    },0);

    return;
  }

  backdrop.hidden=true;
  document.body.classList.remove(
    "welcomeOpen"
  );

  if(markSeen) {
    welcomeSeenAtBoot=true;

    storageSet({
      [WELCOME_SEEN_STORAGE_KEY]:
        Date.now()
    }).catch(()=>{});
  }

  restoreFocus(
    welcomeReturnFocus,
    "customizeToggle"
  );

  welcomeReturnFocus=null;
}

function showWelcomeIfNeeded() {
  if(welcomeSeenAtBoot) return;
  setWelcomeOpen(true);
}

function installWelcomeControls() {
  $("welcomeStart")?.addEventListener(
    "click",
    ()=>setWelcomeOpen(
      false,
      {markSeen:true}
    )
  );

  $("welcomeSkip")?.addEventListener(
    "click",
    ()=>setWelcomeOpen(
      false,
      {markSeen:true}
    )
  );

  $("customizeWelcome")?.addEventListener(
    "click",
    ()=>{
      setCustomizeOpen(false);
      setWelcomeOpen(true);
    }
  );

  $("welcomeBackdrop")?.addEventListener(
    "click",
    event=>{
      if(
        event.target===
        $("welcomeBackdrop")
      ) {
        setWelcomeOpen(
          false,
          {markSeen:true}
        );
      }
    }
  );
}

function installOverlayKeyboardAccessibility() {
  document.addEventListener(
    "keydown",
    event=>{
      const welcome=$("welcomeBackdrop");
      const confirm=$("rbtConfirmModal");
      const customize=$("customizeBackdrop");

      if(
        welcome &&
        !welcome.hidden
      ) {
        if(event.key==="Escape") {
          event.preventDefault();
          setWelcomeOpen(
            false,
            {markSeen:true}
          );
          return;
        }

        trapFocus(
          $("welcomeDialog"),
          event
        );
        return;
      }

      if(
        confirm &&
        !confirm.hidden
      ) {
        trapFocus(
          confirm.querySelector(
            ".rbtModal"
          ),
          event
        );
        return;
      }

      if(
        customize &&
        !customize.hidden
      ) {
        trapFocus(
          $("customizeDrawer"),
          event
        );
      }
    }
  );
}


async function runUiAction(buttonId,busyText,action) {
  const button=$(buttonId);

  if(!button || button.dataset.actionBusy==="true") {
    return;
  }

  const originalText=button.textContent;

  button.dataset.actionBusy="true";
  button.classList.add("isActionBusy");
  button.setAttribute("aria-busy","true");

  if(busyText) {
    button.textContent=busyText;
  }

  try {
    await action();
  } catch(err) {
    const message=String(
      err?.message ||
      err ||
      "Something went wrong. Try again."
    );

    if(
      rbtActionMode &&
      !$("rbtConfirmModal")?.hidden
    ) {
      showRbtActionResult({
        success:false,
        title:"Couldn’t apply plan",
        message
      });
    } else {
      toast(
        message,
        6000
      );
    }
  } finally {
    button.dataset.actionBusy="false";
    button.classList.remove("isActionBusy");
    button.removeAttribute("aria-busy");
    button.textContent=originalText;
    updateStickyActionBar();

    // Every completed one-off action returns the UI to its current state.
    // If there is no unfinished queue, Run once must be visible again.
    if(button.classList.contains("oneOffAction")) {
      reconcileOneOffAfterRun();
    } else {
      updateOneOffActionVisibility();
    }
  }
}

function motionSafeScrollBehavior() {
  return window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches
    ? "auto"
    : "smooth";
}

function installImmediateButtonFeedback() {
  document.addEventListener(
    "pointerdown",
    event=>{
      const button=
        event.target.closest("button");

      if(!button || button.disabled) return;

      button.classList.add(
        "interactionPressed"
      );
    }
  );

  const clearPressed=event=>{
    const button=
      event.target.closest?.("button");

    if(button) {
      button.classList.remove(
        "interactionPressed"
      );
    }
  };

  document.addEventListener(
    "pointerup",
    clearPressed
  );

  document.addEventListener(
    "pointercancel",
    clearPressed
  );
}

function setCustomizeOpen(open) {
  const backdrop=$("customizeBackdrop");
  const drawer=$("customizeDrawer");

  if(!backdrop || !drawer) return;

  backdrop.hidden=!open;

  document.body.classList.toggle(
    "customizeOpen",
    open
  );

  if(open) {
    customizeReturnFocus=
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    syncCustomizationControls();

    setTimeout(()=>{
      $("customizeClose")?.focus();
    },0);
  } else {
    restoreFocus(
      customizeReturnFocus,
      "customizeToggle"
    );

    customizeReturnFocus=null;
  }
}

async function applyUiPreset(name) {
  const preset=UI_PRESETS[name];
  if(!preset) return;

  uiPreferences=normalizeUiPreferences({...preset,preset:name});
  applyUiPreferences(uiPreferences);
  await saveUiPreferences();
}

async function updateUiPreference(key,value) {
  if(!Object.prototype.hasOwnProperty.call(DEFAULT_UI_PREFERENCES,key)) return;

  uiPreferences={
    ...uiPreferences,
    [key]:value,
    preset:"custom"
  };

  applyUiPreferences(uiPreferences);
  await saveUiPreferences();
}

async function resetUiPreferences() {
  uiPreferences={...DEFAULT_UI_PREFERENCES};
  applyUiPreferences(uiPreferences);
  await saveUiPreferences();
  toast("Layout reset to Balanced.");
}

function installCustomizationControls() {
  const drawer=$("customizeDrawer");
  const backdrop=$("customizeBackdrop");
  if(!drawer || !backdrop) return;

  $("customizeToggle")?.addEventListener("click",()=>setCustomizeOpen(true));
  $("customizeClose")?.addEventListener("click",()=>setCustomizeOpen(false));
  $("customizeDone")?.addEventListener("click",()=>setCustomizeOpen(false));
  $("customizeReset")?.addEventListener("click",resetUiPreferences);

  backdrop.addEventListener("click",event=>{
    if(event.target===backdrop) setCustomizeOpen(false);
  });

  drawer.addEventListener("change",event=>{
    const input=event.target.closest("[data-ui-pref]");
    if(input) {
      updateUiPreference(input.dataset.uiPref,input.checked);
      return;
    }

    if(event.target===$("uiDensity")) {
      updateUiPreference("density",event.target.value);
      return;
    }

    if(event.target===$("uiAccent")) {
      updateUiPreference("accent",event.target.value);
    }
  });

  drawer.addEventListener("click",event=>{
    const button=event.target.closest("[data-ui-preset]");
    if(button) applyUiPreset(button.dataset.uiPreset);
  });

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && !backdrop.hidden) {
      event.preventDefault();
      setCustomizeOpen(false);
    }
  });
}


function preferredSystemTheme() {
  return window.matchMedia?.(
    "(prefers-color-scheme: dark)"
  )?.matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  const dark=theme==="dark";

  document.body.classList.toggle(
    "dark",
    dark
  );

  document.documentElement.style.colorScheme=
    dark ? "dark" : "light";

  const btn=$("themeToggle");

  if(btn) {
    btn.textContent=dark ? "☀" : "☾";
    btn.title=
      dark
        ? "Switch to light mode"
        : "Switch to dark mode";

    btn.setAttribute(
      "aria-label",
      btn.title
    );
  }
}

async function toggleTheme() {
  const next=
    document.body.classList.contains("dark")
      ? "light"
      : "dark";

  themeIsExplicit=true;
  applyTheme(next);

  await storageSet({
    rbtTheme:next
  });
}

document.addEventListener("DOMContentLoaded",async()=>{
  installToastPositioning();
  markCustomizableRegions();
  populateBehaviorSelect();
  populateReplacementSelect();
  populateChallengingSelect();
  populateClient2ReplacementSelect();
  installCustomProgramSelects();
  installEnterToCommit();
  renderReviewedTrialGrid();
  installWeekNavigators();
  installCustomizationControls();
  await loadStartupUiState();
  installSystemThemeListener();
  installWelcomeControls();
  installOverlayKeyboardAccessibility();
  installImmediateButtonFeedback();
  showWelcomeIfNeeded();

  $("themeToggle").addEventListener("click",toggleTheme);

  $("rbtConfirmCancel").addEventListener("click",async ()=>{
    if(rbtActionMode && rbtActionBusy) {
      await requestRbtActionStop();
      return;
    }

    if(rbtActionMode) {
      closeRbtActionStatus();
      return;
    }

    closeRbtConfirm(false);
  });

  $("rbtConfirmOk").addEventListener("click",async ()=>{
    if(rbtActionMode) {
      if(rbtActionRetryHandler) {
        const retry=rbtActionRetryHandler;
        rbtActionRetryHandler=null;
        closeRbtActionStatus();
        await retry();
        return;
      }

      closeRbtActionStatus();
      return;
    }

    closeRbtConfirm(true);
  });

  $("rbtConfirmModal").addEventListener("click",event=>{
    if(event.target!==$("rbtConfirmModal")) return;

    if(rbtActionMode) {
      closeRbtActionStatus();
      return;
    }

    closeRbtConfirm(false);
  });

  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape") return;

    if(rbtActionMode) {
      if(rbtActionBusy) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      closeRbtActionStatus();
      return;
    }

    if(rbtConfirmResolver) {
      event.preventDefault();
      closeRbtConfirm(false);
    }
  });

  $("autoBatchStart").addEventListener("click",startAutoBatchRunner);
  $("autoBatchStop").addEventListener("click",stopAnyActiveWrite);

  updateReviewWriteButtons();

  $("stickyAddBatch").addEventListener("click",stickyAddToBatch);
  $("stickyPrevious").addEventListener("click",stickyPreviousItem);
  $("stickyNext").addEventListener("click",stickyNextItem);
  $("stickyAutoRun").addEventListener("click",stickyAutoRun);
  $("stickyStop").addEventListener("click",stickyStopRun);
  document.addEventListener("keydown",handleKeyboardShortcuts);
  $("behaviorSelect").addEventListener("change",e=>selectBehavior(Number(e.target.value)));

  $("generatePlan").addEventListener("click",()=>runUiAction(
    "generatePlan",
    "Adding…",
    ()=>quickPlanAddNext(saveGeneratedPlan)
  ));
  $("batchApplyBehaviors").addEventListener("click",()=>applyBatch("client1Behaviors"));
  $("batchClearBehaviors").addEventListener("click",()=>clearBatch("client1Behaviors"));

  $("batchApplyReplacement").addEventListener("click",()=>applyBatch("client1Replacements"));
  $("batchClearReplacement").addEventListener("click",()=>clearBatch("client1Replacements"));

  $("batchApplyChallenging").addEventListener("click",()=>applyBatch("client2Challenging"));
  $("batchClearChallenging").addEventListener("click",()=>clearBatch("client2Challenging"));

  $("batchApplyClient2Replacement").addEventListener("click",()=>applyBatch("client2Replacements"));
  $("batchClearClient2Replacement").addEventListener("click",()=>clearBatch("client2Replacements"));

  $("clearBehaviorColumn").addEventListener("click",()=>runUiAction("clearBehaviorColumn","Clearing…",clearSelectedOfficePuzzleColumn));
  $("clearChallengingColumn").addEventListener("click",()=>runUiAction("clearChallengingColumn","Clearing…",clearSelectedOfficePuzzleColumn));
  $("clearClient2ReplacementColumn").addEventListener("click",()=>runUiAction("clearClient2ReplacementColumn","Clearing…",clearSelectedOfficePuzzleColumn));
  $("clearReplacementColumn").addEventListener("click",()=>runUiAction("clearReplacementColumn","Clearing…",clearSelectedOfficePuzzleColumn));

  $("applyCount").addEventListener("click",()=>runUiAction(
    "applyCount",
    "Writing…",
    ()=>quickWriteOnce(saveGeneratedPlan,applyCount)
  ));
  $("replacementSelect").addEventListener("change",e=>selectReplacement(Number(e.target.value)));

  $("generateReplacementPlan").addEventListener("click",()=>runUiAction(
    "generateReplacementPlan",
    "Adding…",
    ()=>quickPlanAddNext(saveReplacementPlan)
  ));
  $("applyReplacementTrials").addEventListener("click",()=>runUiAction(
    "applyReplacementTrials",
    "Writing…",
    ()=>quickWriteOnce(saveReplacementPlan,applyReviewedReplacementTrials)
  ));
  $("client2ReplacementSelect").addEventListener("change",e=>selectClient2Replacement(Number(e.target.value)));

  $("generateClient2ReplacementPlan").addEventListener("click",()=>runUiAction(
    "generateClient2ReplacementPlan",
    "Adding…",
    ()=>quickPlanAddNext(saveClient2ReplacementPlan)
  ));
  $("reviewClient2Replacement").addEventListener("click",()=>runUiAction(
    "reviewClient2Replacement",
    "Writing…",
    ()=>quickWriteOnce(saveClient2ReplacementPlan,applyClient2Replacement)
  ));
  $("challengingSelect").addEventListener("change",e=>selectChallenging(Number(e.target.value)));

  $("generateChallengingPlan").addEventListener("click",()=>runUiAction(
    "generateChallengingPlan",
    "Adding…",
    ()=>quickPlanAddNext(saveChallengingPlan)
  ));
  $("clientHoursMinus")?.addEventListener("click",()=>stepClientHours(-0.5));
  $("clientHoursPlus")?.addEventListener("click",()=>stepClientHours(0.5));
  $("clientHoursInput")?.addEventListener("focus",event=>{
    const value=clientHoursNumericValue();
    event.target.value=validHours(value) ? String(value) : String(client2DayHoursValue);
    event.target.select();
  });
  $("clientHoursInput")?.addEventListener("blur",()=>commitClientHoursInput());

  $("challengingHours").addEventListener("change",async()=>{
    closeChallengingReview();
    const saved=await saveTodayChallengingHours({showToast:false});
    if(!saved) return;
    if(challengingMapping) await renderChallengingMapping(true);
  });
  $("reviewChallengingIntervals").addEventListener("click",()=>runUiAction(
    "reviewChallengingIntervals",
    "Writing…",
    ()=>quickWriteOnce(saveChallengingPlan,applyChallengingIntervals)
  ));
  $("applyChallengingCount").addEventListener("click",()=>runUiAction(
    "applyChallengingCount",
    "Writing…",
    ()=>quickWriteOnce(saveChallengingPlan,applyChallengingFrequencyCount)
  ));

  $("refreshContext").addEventListener("click",clearInputsAndRefreshContext);


  // Date-sensitive state must start from the CURRENT local day, never from a
  // boot snapshot created before midnight.
  lastObservedLocalDay=localTodayISODate();

  // Restore the saved Office Puzzle tab target before reading context.
  // This allows a resumable Run Batch to survive even if another Chrome tab
  // happens to be active when the side panel reloads.
  await primeRunBatchTabLockFromStorage();
  await refreshContext();

  const restoredAutoRun=await restoreAutoBatchRunnerState();
  updateStickyActionBar();
  updateStopControls();

  syncAutoBatchTicker();

  if(passiveSyncTimer) clearInterval(passiveSyncTimer);
  passiveSyncTimer=setInterval(()=>{
    // Safety heartbeat only. DOM/route hints are the primary discovery path.
    // A slower fallback avoids waking the side panel repeatedly while idle.
    passiveContextSync();
  },20000);

  // Dedicated midnight guard without a permanent 5-second polling interval.
  // Schedule one wake just after the next local midnight, then reschedule.
  if(localDateRolloverTimer) clearTimeout(localDateRolloverTimer);
  const scheduleNextLocalDateRollover=()=>{
    const now=new Date();
    const next=new Date(now);
    next.setHours(24,0,1,0);
    const delay=Math.max(1000,next.getTime()-now.getTime());
    localDateRolloverTimer=setTimeout(async()=>{
      localDateRolloverTimer=null;
      if(lastObservedLocalDay!==localTodayISODate()) {
        await refreshForLocalDateRollover();
      }
      scheduleNextLocalDateRollover();
    },delay);
  };
  scheduleNextLocalDateRollover();

  // The initial live refresh already reads context + discovery. A later quiet
  // heartbeat catches SPA transitions without immediately repeating the work.
  setTimeout(()=>{
    passiveContextSync();
  },2200);

  if(restoredAutoRun) {
    setTimeout(()=>{
      autoBatchTick();
    },500);
  }
});
