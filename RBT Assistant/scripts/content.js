(() => {
  const KNOWN_BEHAVIORS = [];

  const KNOWN_REPLACEMENTS = [];


  const KNOWN_CHALLENGING = [];


  const CLIENT2_REPLACEMENTS = [];

  const CHALLENGING_NAMES = KNOWN_CHALLENGING.map(item=>item.name);
  const MAX_CHALLENGING_INTERVALS = 24;

  const HIGHLIGHT_ATTR = "data-rbt-picker-highlight";

  // In-memory table registry: avoids generating/querying huge CSS selectors.
  const tableRegistry = new Map();
  let registryCounter = 0;

  // Safe write gate: scanning never arms this.
  let armedWriteToken = null;
  let armedWriteExpiresAt = 0;

  // Active writer cancellation. A Stop request never sends another click.
  // Long-running writers check this flag before beginning the next
  // trial/interval transition.
  let activeWriteAbortRequested = false;
  let clinicalWriteBusy = false;
  // Performance guard: clinical writes cause many legitimate table mutations.
  // Inventory discovery must stay asleep during those mutations and briefly
  // after the writer settles; the writer refreshes read caches once at the end.
  let discoverySuppressedUntil = 0;

  // Read-only DOM cache. GET_CONTEXT is called by the side panel heartbeat and
  // should be nearly free while Office Puzzle is unchanged.
  let contextSnapshotCache=null;
  let contextSnapshotCacheRevision=-1;
  let contextSnapshotCacheAt=0;
  let cachedBodyTextValue="";
  let cachedBodyTextRevision=-1;
  const CONTEXT_CACHE_TTL_MS=1500;

  function resetActiveWriteAbort() {
    activeWriteAbortRequested = false;
  }

  function requestActiveWriteAbort() {
    activeWriteAbortRequested = true;
  }

  function activeWriteWasAborted() {
    return activeWriteAbortRequested === true;
  }

  function abortedWriteResult(label="Data write") {
    return {
      ok:false,
      verified:false,
      cancelled:true,
      aborted:true,
      error:`${label} stopped by user. No additional data clicks were sent.`
    };
  }

  function armWrite(token) {
    armedWriteToken = String(token || "");
    armedWriteExpiresAt = Date.now() + 15000;
  }

  function consumeWriteToken(token) {
    const ok =
      armedWriteToken &&
      String(token || "") === armedWriteToken &&
      Date.now() <= armedWriteExpiresAt;

    armedWriteToken = null;
    armedWriteExpiresAt = 0;
    return !!ok;
  }

  function sleep(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function sendClinicalWriteResult(promise,sendResponse) {
    clinicalWriteBusy=true;
    discoverySuppressedUntil=Number.POSITIVE_INFINITY;

    Promise.resolve(promise)
      .then(sendResponse)
      .catch(err=>sendResponse({
        ok:false,
        verified:false,
        error:String(err?.message || err)
      }))
      .finally(()=>{
        clinicalWriteBusy=false;
        discoverySuppressedUntil=Date.now()+320;
        // Coalesce the many clinical DOM mutations into one cache revision.
        // This keeps the next context read fresh without waking inventory
        // discovery for every + / - / count transition.
        programStructureRevision++;
        invalidateReadCaches();
        maybeRunPendingSilentFullScan();
      });
  }

  // Turbo settle: do not pay a fixed multi-second delay after every Office
  // Puzzle click. Once the verified DOM change has landed, wait only until
  // the page has been quiet for a short window. If Office Puzzle is slower
  // on a particular update, this automatically waits longer up to maxMs.
  function quietRootForMapping(mapping) {
    const table=mapping?.tableId ? tableRegistry.get(mapping.tableId) : null;
    return table?.isConnected ? table : (document.body || document.documentElement);
  }

  function waitForOfficePuzzleQuiet({quietMs=90,minMs=45,maxMs=650,root=null}={}) {
    return new Promise(resolve=>{
      const started=Date.now();
      let lastMutation=started;
      let done=false;
      let observer=null;
      let timer=null;

      const finish=()=>{
        if(done) return;
        done=true;
        try { observer?.disconnect(); } catch(_) {}
        if(timer) clearTimeout(timer);
        resolve();
      };

      try {
        observer=new MutationObserver(()=>{
          lastMutation=Date.now();
        });
        const observedRoot=(root?.isConnected ? root : null) || document.body || document.documentElement;
        observer.observe(observedRoot,{
          subtree:true,
          childList:true,
          attributes:true,
          characterData:true
        });
      } catch(_) {}

      const check=()=>{
        if(done) return;
        const now=Date.now();
        const elapsed=now-started;
        const quietFor=now-lastMutation;

        if(elapsed>=minMs && quietFor>=quietMs) {
          finish();
          return;
        }

        if(elapsed>=maxMs) {
          finish();
          return;
        }

        timer=setTimeout(check,Math.min(45,Math.max(20,quietMs-quietFor)));
      };

      timer=setTimeout(check,Math.min(45,minMs));
    });
  }

  function idleYield() {
    return new Promise(resolve => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => resolve(), { timeout: 80 });
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function textOf(el) {
    return (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cachedBodyText() {
    if(cachedBodyTextRevision===programStructureRevision && cachedBodyTextValue) {
      return cachedBodyTextValue;
    }

    cachedBodyTextValue=textOf(document.body);
    cachedBodyTextRevision=programStructureRevision;
    return cachedBodyTextValue;
  }

  function invalidateReadCaches() {
    contextSnapshotCache=null;
    contextSnapshotCacheRevision=-1;
    contextSnapshotCacheAt=0;
    cachedBodyTextRevision=-1;
  }

  function detectPageType(raw = cachedBodyText()) {
    const bodyText = raw.toLowerCase();

    if (/category:\s*challenging behaviors?/i.test(raw)) {
      return "challenging";
    }

    if (/category:\s*replacement behaviors?\s*\/\s*skill acquisitions/i.test(raw)) {
      return "client2replacement";
    }

    if (
      /category:\s*replacement\s*\/?\s*acquisition skill programs/i.test(raw) ||
      /collection method:\s*percentage of opportunities/i.test(raw)
    ) {
      // Client 2 is already caught by its explicit category above.
      return "replacement";
    }

    if (/category:\s*maladaptive behaviors?/i.test(raw)) {
      return "maladaptive";
    }

    if (bodyText.includes("rbt appointment note") || bodyText.includes("appointment note")) {
      return "note";
    }

    return "officepuzzle";
  }

  function supportedDataCollectionPageType(pageType) {
    return (
      pageType === "maladaptive" ||
      pageType === "replacement" ||
      pageType === "challenging" ||
      pageType === "client2replacement"
    );
  }

  function hasLiveDataCollectionGrid(pageType = detectPageType()) {
    if(!supportedDataCollectionPageType(pageType)) return false;

    // Do not decide that a client is still "active" from stale Client/Category
    // text alone. Office Puzzle can retain that metadata briefly after the user
    // has left the actual data-entry screen. A supported data page must still
    // contain a VISIBLE collection grid: a Days row plus real Trial / Interval /
    // Frequency rows (or the Initials row used by the same grid).
    for(const table of document.querySelectorAll("table")) {
      if(!isVisible(table)) continue;

      const daysRow=findDaysRow(table);
      if(!daysRow) continue;

      const rows=table.rows ? [...table.rows] : [...table.querySelectorAll("tr")];
      const hasEntryRows=rows.some(dataEntryRowForDateAvailability);
      const hasInitialsRow=Boolean(findNamedRow(table,"Initials"));

      if(hasEntryRows || hasInitialsRow) return true;
    }

    return false;
  }

  function detectClientLabel(full = cachedBodyText()) {
    const m = full.match(/Client:\s*([^\n]{2,100}?)(?=\s+(?:Name:|Month\/Year:|Category:))/i);
    if (m) return m[1].trim();

    const candidates = document.querySelectorAll("h1,h2,h3,[class*='client'],[id*='client']");
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const t = textOf(el);
      if (t && t.length >= 2 && t.length <= 100 && !/maladaptive|replacement|acquisition/i.test(t)) {
        return t;
      }
    }
    // Never use document.title as a client identity fallback. During Office
    // Puzzle SPA navigation the title can remain populated while the actual
    // client header/table is temporarily gone, which can look like a fake
    // client change to the side panel. An empty value is safer and lets the
    // side panel preserve the last verified client only for its short
    // same-client page-transition handoff.
    return "";
  }

  function detectCurrentName() {
    const rows=[...document.querySelectorAll("tr")].filter(isVisible);

    for (const row of rows) {
      const cells=cellsOfRow(row);
      if (cells.length < 2) continue;
      if (normalize(textOf(cells[0])) !== "name") continue;

      const raw=textOf(cells[1]).trim();
      if (raw) return raw;
    }

    const body=textOf(document.body);
    const m=body.match(/Name:\s*(.+?)(?=\s+(?:Category:|Collection Method:|Description:))/i);
    return m ? m[1].trim() : null;
  }

  function detectCollectionMethod(body=cachedBodyText()) {
    const m=body.match(/Collection Method:\s*([A-Za-z ]+?)(?=\s+(?:Description:|Baselines:|Objective:|Start date:|End date:)|$)/i);
    const raw=(m?.[1] || "").trim();

    if (/partial interval/i.test(raw)) return "partial_interval";
    if (/frequency/i.test(raw)) return "frequency";
    if (/percentage of opportunities/i.test(raw)) return "percentage_opportunities";

    return "";
  }

  function canonicalChallengingName(rawName) {
    const candidate=normalize(rawName);

    for (const item of KNOWN_CHALLENGING) {
      const target=normalize(item.name);

      if (
        candidate === target ||
        candidate.startsWith(target + " ") ||
        target.startsWith(candidate + " ")
      ) {
        return item.name;
      }
    }

    return null;
  }

  function canonicalClient2ReplacementName(rawName) {
    const candidate=normalize(rawName);

    for (const name of CLIENT2_REPLACEMENTS) {
      const target=normalize(name);

      if (
        candidate===target ||
        candidate.startsWith(target + " ") ||
        target.startsWith(candidate + " ")
      ) {
        return name;
      }
    }

    return null;
  }

  function selectedDateFromUrl() {
    try {
      const raw = new URL(location.href).searchParams.get("selectedDate");
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw || "")) return raw;
    } catch (_) {}
    return null;
  }

  function selectedDateFromVisibleField() {
    const candidates = [
      ...document.querySelectorAll('input[type="date"]'),
      ...document.querySelectorAll('input[aria-label*="date" i], input[name*="date" i]')
    ];

    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const raw = String(el.value || el.getAttribute("value") || "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    }

    return null;
  }

  function localTodayISO() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,10);
  }

  let selectedTableDateOverride=null;
  let selectedTableDateOverrideSetDay=null;

  function visibleTableDates(monthYearOverride=null) {
    const monthYear=monthYearOverride || displayedMonthYear();
    if(!monthYear) return [];

    const dates=[];

    for(const table of document.querySelectorAll("table")) {
      if(!isVisible(table)) continue;

      const daysRow=findDaysRow(table);
      if(!daysRow) continue;

      for(const date of mapDaysRowDates(daysRow,monthYear)) {
        if(/^\d{4}-\d{2}-\d{2}$/.test(String(date||""))) {
          dates.push(date);
        }
      }
    }

    return [...new Set(dates)].sort();
  }

  function dateCellExplicitlyDisabled(cell) {
    if(!cell) return false;

    const cls=normalize(cell.getAttribute?.("class") || "");
    const state=normalize([
      cell.getAttribute?.("aria-disabled"),
      cell.getAttribute?.("data-disabled"),
      cell.getAttribute?.("data-readonly"),
      cell.getAttribute?.("data-read-only")
    ].filter(Boolean).join(" "));

    if(
      cell.disabled===true ||
      cell.hasAttribute?.("disabled") ||
      /(?:^|\s)(?:disabled|inactive|locked|readonly|read\s+only|unavailable|future)(?:\s|$)/.test(cls) ||
      /^(?:true|disabled|locked|readonly|unavailable)$/.test(state)
    ) return true;

    try {
      const style=getComputedStyle(cell);
      if(style.pointerEvents==="none") return true;
      const opacity=Number(style.opacity);
      if(Number.isFinite(opacity) && opacity>0 && opacity<0.28) return true;
    } catch(_) {}

    return false;
  }

  function cellHasEnabledDateControl(cell,{strong=false}={}) {
    if(!cell || dateCellExplicitlyDisabled(cell)) return false;

    const nodes=[
      ...cell.querySelectorAll?.(
        'button,a,[role="button"],[onclick],[tabindex],i,svg,span'
      ) || []
    ];

    // Include the TD itself only for the fallback path. A pointer cursor on a
    // generic table cell is not strong enough evidence to declare a future
    // greyed-out date writable.
    if(!strong) nodes.push(cell);

    for(const node of nodes) {
      if(!node || !isVisible(node) || dateCellExplicitlyDisabled(node)) continue;

      const target=clickableFromIconElement(node);
      if(!target || !isVisible(target) || dateCellExplicitlyDisabled(target)) continue;

      const nodeHint=gearHintScore(node);
      const targetHint=gearHintScore(target);
      const semanticGear=Math.max(nodeHint,targetHint)>=20;
      const explicitControl=target.matches?.('button,a,[role="button"],[onclick]');

      if(strong ? (semanticGear || explicitControl) : Math.max(nodeHint,targetHint)>0) {
        return true;
      }
    }

    return false;
  }

  function rgbParts(value) {
    const match=String(value || "").match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if(!match) return null;
    return {
      r:Number(match[1]),
      g:Number(match[2]),
      b:Number(match[3]),
      a:match[4]==null ? 1 : Number(match[4])
    };
  }

  function relativeLuminance(rgb) {
    if(!rgb) return null;
    const channel=value=>{
      const c=Math.max(0,Math.min(255,Number(value || 0)))/255;
      return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4);
    };
    return 0.2126*channel(rgb.r)+0.7152*channel(rgb.g)+0.0722*channel(rgb.b);
  }

  function contrastRatio(foreground,background) {
    const fg=relativeLuminance(rgbParts(foreground));
    const bg=relativeLuminance(rgbParts(background));
    if(fg==null || bg==null) return null;
    const hi=Math.max(fg,bg);
    const lo=Math.min(fg,bg);
    return (hi+0.05)/(lo+0.05);
  }

  function dataEntryRowForDateAvailability(row) {
    const cells=cellsOfRow(row);
    if(!cells.length) return false;
    const first=textOf(cells[0]).trim();
    const normalized=normalize(first);
    return (
      /^trial\s*(?:10|[1-9])$/.test(normalized) ||
      /^interval\s*\d{1,2}$/.test(normalized) ||
      /^\d{1,3}$/.test(first)
    );
  }

  function editableCellEvidence(cell) {
    if(!cell || dateCellExplicitlyDisabled(cell)) {
      return {editable:false,disabled:true,score:-100};
    }

    let score=0;
    const nodes=[
      cell,
      ...cell.querySelectorAll?.('*') || []
    ].slice(0,80);

    for(const node of nodes) {
      if(!node || dateCellExplicitlyDisabled(node)) continue;

      try {
        if(
          node.matches?.('button:not(:disabled),a[href],[role="button"][aria-disabled!="true"],input:not(:disabled),[onclick],[ng-click],[data-ng-click],[data-action],[data-click],[contenteditable="true"]')
        ) score+=10;
      } catch(_) {}

      const tabindex=Number(node.getAttribute?.('tabindex'));
      if(Number.isFinite(tabindex) && tabindex>=0) score+=4;

      const cls=normalize(node.getAttribute?.('class') || '');
      if(/(?:^|\s)(?:clickable|editable|selectable|enabled|active-cell|data-cell)(?:\s|$)/.test(cls)) {
        score+=5;
      }

      if(typeof node.onclick==='function') score+=8;

      try {
        const style=getComputedStyle(node);
        if(style.pointerEvents==='none') continue;
        if(style.cursor==='pointer') score+=6;
        if(style.cursor==='not-allowed') score-=8;
      } catch(_) {}

      if(score>=8) break;
    }

    return {editable:score>=6,disabled:false,score};
  }

  function columnDateEvidence(table,daysRow,dates,dayIndex) {
    const dayCells=cellsOfRow(daysRow);
    const rows=table.rows ? [...table.rows] : [...table.querySelectorAll('tr')];
    const header=dayCells[dayIndex+1] || null;
    const initialsRow=findNamedRow(table,'Initials');
    const initialsCells=initialsRow ? cellsOfRow(initialsRow) : [];
    const initialsCell=initialsCells.length
      ? cellForDayIndex(initialsCells,dayCells,dayIndex)
      : null;

    let disabledSignals=0;
    let editableSignals=0;
    let recordedSignals=0;
    let sampled=0;
    const backgrounds=[];
    const opacities=[];

    for(const row of rows) {
      if(!dataEntryRowForDateAvailability(row)) continue;
      const cell=cellForDayIndex(cellsOfRow(row),dayCells,dayIndex);
      if(!cell) continue;
      sampled++;

      const evidence=editableCellEvidence(cell);
      if(evidence.disabled) disabledSignals++;
      if(evidence.editable) editableSignals++;

      const raw=textOf(cell).trim();
      if(raw && raw!=='—') recordedSignals++;

      try {
        const style=getComputedStyle(cell);
        backgrounds.push(style.backgroundColor || '');
        const opacity=Number(style.opacity);
        if(Number.isFinite(opacity)) opacities.push(opacity);
      } catch(_) {}
    }

    if(textOf(initialsCell).trim()) recordedSignals+=3;

    let headerDisabled=dateCellExplicitlyDisabled(header);
    let headerContrast=null;
    let headerBackground='';
    let headerColor='';
    let headerOpacity=1;

    if(header) {
      try {
        const style=getComputedStyle(header);
        headerBackground=style.backgroundColor || '';
        headerColor=style.color || '';
        headerOpacity=Number(style.opacity);
        if(!Number.isFinite(headerOpacity)) headerOpacity=1;
        headerContrast=contrastRatio(headerColor,headerBackground);
      } catch(_) {}
    }

    const avgOpacity=opacities.length
      ? opacities.reduce((a,b)=>a+b,0)/opacities.length
      : 1;

    return {
      date:dates[dayIndex],
      dayIndex,
      header,
      headerDisabled,
      headerContrast,
      headerBackground,
      headerColor,
      headerOpacity,
      sampled,
      disabledSignals,
      editableSignals,
      recordedSignals,
      avgOpacity,
      backgrounds
    };
  }

  function colorDistance(a,b) {
    const ca=rgbParts(a);
    const cb=rgbParts(b);
    if(!ca || !cb) return null;
    return Math.sqrt(
      Math.pow(ca.r-cb.r,2)+
      Math.pow(ca.g-cb.g,2)+
      Math.pow(ca.b-cb.b,2)
    );
  }

  function dominantBackground(evidence) {
    const counts=new Map();
    for(const value of evidence?.backgrounds || []) {
      if(!value) continue;
      counts.set(value,(counts.get(value)||0)+1);
    }
    let best='';
    let bestCount=0;
    for(const [value,count] of counts) {
      if(count>bestCount) {
        best=value;
        bestCount=count;
      }
    }
    return best;
  }

  function writableDatesForTable(table,daysRow,dates) {
    if(!table || !daysRow || !Array.isArray(dates) || !dates.length) return [];

    // IMPORTANT: the gear row is NOT date availability. In Office Puzzle it is
    // primarily an affordance for already-recorded data (delete/manage). Blank
    // but writable dates often have no gear yet. Availability must therefore be
    // inferred from the real Trial / Interval / Frequency entry cells.
    const evidence=dates.map((_,index)=>columnDateEvidence(table,daysRow,dates,index));

    const selectedHint=
      selectedTableDateOverride ||
      selectedDateFromUrl() ||
      selectedDateFromVisibleField() ||
      localTodayISO();

    const selectedIndex=dates.indexOf(selectedHint);

    // Strong active anchors are columns that already contain recorded data or
    // whose actual data-entry cells expose an edit/click affordance.
    const anchorIndexes=[];
    evidence.forEach((ev,index)=>{
      if(ev.headerDisabled) return;
      if(ev.recordedSignals>0 || ev.editableSignals>0) anchorIndexes.push(index);
    });

    if(selectedIndex>=0 && !evidence[selectedIndex]?.headerDisabled) {
      anchorIndexes.push(selectedIndex);
    }

    const uniqueAnchors=[...new Set(anchorIndexes)];
    const anchorContrasts=uniqueAnchors
      .map(index=>evidence[index]?.headerContrast)
      .filter(value=>Number.isFinite(value) && value>0);
    const referenceContrast=anchorContrasts.length
      ? Math.max(...anchorContrasts)
      : null;

    const anchorBackgrounds=uniqueAnchors
      .map(index=>dominantBackground(evidence[index]))
      .filter(Boolean);
    const referenceBackground=anchorBackgrounds[0] || '';

    function looksVisuallyDisabled(ev) {
      if(!ev) return true;
      if(ev.headerDisabled) return true;
      if(ev.headerOpacity<0.5 || ev.avgOpacity<0.5) return true;
      if(ev.sampled && ev.disabledSignals>=Math.max(1,Math.ceil(ev.sampled*0.6))) return true;

      if(
        referenceContrast!=null &&
        Number.isFinite(ev.headerContrast) &&
        ev.headerContrast>0 &&
        ev.headerContrast < referenceContrast*0.62
      ) return true;

      if(referenceBackground) {
        const bg=dominantBackground(ev);
        const distance=colorDistance(referenceBackground,bg);
        // A pronounced column-fill change is a common Office Puzzle signal for
        // future/locked cells. Keep this threshold conservative so theme noise
        // does not hide legitimate dates.
        if(distance!=null && distance>42 && ev.editableSignals===0 && ev.recordedSignals===0) {
          return true;
        }
      }

      return false;
    }

    // If Office Puzzle exposes direct editability, trust that first. Recorded
    // dates remain visible so the user can intentionally replace/correct them.
    const strongWritable=new Set();
    evidence.forEach((ev,index)=>{
      if(looksVisuallyDisabled(ev)) return;
      if(ev.editableSignals>0 || ev.recordedSignals>0) strongWritable.add(index);
    });

    // Availability is a contiguous run in Office Puzzle. Expand out from the
    // known active columns while neighboring columns keep the same enabled
    // visual/interaction state. This includes newly-opened BLANK dates that do
    // not have gears yet, and stops when the table turns grey/disabled.
    if(strongWritable.size || uniqueAnchors.length) {
      const seed=[...new Set([...strongWritable,...uniqueAnchors])].sort((a,b)=>a-b);
      let left=seed[0];
      let right=seed[seed.length-1];

      while(left>0 && !looksVisuallyDisabled(evidence[left-1])) left--;
      while(right<evidence.length-1 && !looksVisuallyDisabled(evidence[right+1])) right++;

      const out=[];
      for(let index=left; index<=right; index++) {
        if(!dates[index] || looksVisuallyDisabled(evidence[index])) continue;
        out.push(dates[index]);
      }
      if(out.length) return out;
    }

    // Last-resort compatibility for table variants that expose no usable
    // interaction/style metadata. This is deliberately conservative: never
    // invent future writable dates.
    const today=localTodayISO();
    return dates.filter((date,index)=>{
      if(!date) return false;
      const ev=evidence[index];
      if(looksVisuallyDisabled(ev)) return false;
      return date<=today;
    });
  }

  function writableTableDates(monthYearOverride=null) {
    const monthYear=monthYearOverride || displayedMonthYear();
    if(!monthYear) return [];

    const dates=[];

    for(const table of document.querySelectorAll("table")) {
      if(!isVisible(table)) continue;

      const daysRow=findDaysRow(table);
      if(!daysRow) continue;

      const tableDates=mapDaysRowDates(daysRow,monthYear);
      for(const date of writableDatesForTable(table,daysRow,tableDates)) {
        if(validISODateLike(date)) dates.push(date);
      }
    }

    return [...new Set(dates)].sort();
  }

  function validISODateLike(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value||""));
  }

  function dateNavigationInfo() {
    const monthYear=displayedMonthYear();
    const writable=writableTableDates(monthYear);
    const visible=visibleTableDates(monthYear);
    const availableDates=writable.length ? writable : visible.filter(date=>date<=localTodayISO());
    const selected=resolveSelectedDate(availableDates).date;

    return {
      selectedDate:selected,
      minDate:availableDates[0] || null,
      maxDate:availableDates[availableDates.length-1] || null,
      availableDates,
      supported:availableDates.length>0
    };
  }

  async function setSelectedDateOnPage(targetDate) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(targetDate||""))) {
      return {ok:false,error:"Invalid date."};
    }

    const writable=writableTableDates();
    const visible=visibleTableDates();
    const availableDates=writable.length ? writable : visible.filter(date=>date<=localTodayISO());

    if(!availableDates.includes(targetDate)) {
      return {
        ok:false,
        error:
          `That date is not a visible Office Puzzle table column. ` +
          `Available table dates run from ${availableDates[0] || "unknown"} ` +
          `through ${availableDates[availableDates.length-1] || "unknown"}.`
      };
    }

    // IMPORTANT: changing the selected date does NOT navigate Office Puzzle.
    // The entire month is already rendered in the table. We simply retarget
    // the extension to the requested date column.
    selectedTableDateOverride=targetDate;
    // A manual table-date choice is valid for the CURRENT local day only.
    // If the extension stays open across midnight, yesterday's override must
    // not keep winning over the newly writable current date.
    selectedTableDateOverrideSetDay=localTodayISO();
    invalidateReadCaches();

    return {
      ok:true,
      targetDate,
      mode:"table-column",
      navigating:false,
      availableDates
    };
  }

  function resolveSelectedDate(availableDatesOverride=null) {
    const defaultWritable=writableTableDates();
    const defaultVisible=visibleTableDates();
    const today=localTodayISO();
    const availableDates=Array.isArray(availableDatesOverride)
      ? availableDatesOverride
      : (defaultWritable.length ? defaultWritable : defaultVisible.filter(date=>date<=today));

    // Midnight rollover: an override chosen yesterday must never pin the
    // assistant to yesterday after a new local day begins. A user can still
    // intentionally select any available past date AFTER midnight; that choice
    // receives today's stamp and remains respected for the rest of the day.
    if(
      selectedTableDateOverride &&
      selectedTableDateOverrideSetDay &&
      selectedTableDateOverrideSetDay!==today
    ) {
      selectedTableDateOverride=null;
      selectedTableDateOverrideSetDay=null;
      invalidateReadCaches();
    }

    if(
      selectedTableDateOverride &&
      availableDates.includes(selectedTableDateOverride)
    ) {
      return {
        date:selectedTableDateOverride,
        source:"table-column"
      };
    }

    // If the page itself changes month/client and the old override no longer
    // exists in the visible Days row, discard the stale override.
    if(
      selectedTableDateOverride &&
      availableDates.length &&
      !availableDates.includes(selectedTableDateOverride)
    ) {
      selectedTableDateOverride=null;
      selectedTableDateOverrideSetDay=null;
    }

    // Today is the normal startup/rollover anchor. Office Puzzle may retain a
    // stale date field or URL from before midnight, so those page-level hints
    // must not beat a currently writable local today.
    if(!availableDates.length || availableDates.includes(today)) {
      return {date:today,source:"today"};
    }

    const fromUrl=selectedDateFromUrl();
    if(fromUrl && (!availableDates.length || availableDates.includes(fromUrl))) {
      return {date:fromUrl,source:"url"};
    }

    const fromField=selectedDateFromVisibleField();
    if(fromField && (!availableDates.length || availableDates.includes(fromField))) {
      return {date:fromField,source:"page"};
    }

    // Older/future monthly sheets may not contain today. Use the closest
    // visible table date instead of forcing a page navigation.
    const pastOrToday=availableDates.filter(date=>date<=today);
    const fallback=
      pastOrToday[pastOrToday.length-1] ||
      availableDates[0];

    return {
      date:fallback,
      source:"table-fallback"
    };
  }

  const MONTHS = {
    january:0, february:1, march:2, april:3, may:4, june:5,
    july:6, august:7, september:8, october:9, november:10, december:11
  };

  function displayedMonthYear(t=cachedBodyText()) {
    const m = t.match(/Month\/Year:\s*([A-Za-z]+)\s+(\d{4})/i);
    if (!m) return null;
    const month = MONTHS[m[1].toLowerCase()];
    if (month == null) return null;
    return { month, year:Number(m[2]) };
  }

  function cellsOfRow(row) {
    // Faster than repeated :scope selectors in large tables.
    return [...row.children].filter(el => el.tagName === "TD" || el.tagName === "TH");
  }

  function findDaysRow(table) {
    const rows = table.rows ? [...table.rows] : [...table.querySelectorAll("tr")];
    for (const row of rows) {
      const cells = cellsOfRow(row);
      if (cells.length && normalize(textOf(cells[0])) === "days") return row;
    }
    return null;
  }

  function mapDaysRowDates(daysRow, monthYear = null) {
    const my = monthYear || displayedMonthYear();
    if (!my) return [];

    const cells = cellsOfRow(daysRow);
    const nums = cells.slice(1).map(c => {
      const raw = textOf(c).trim();
      if (!/^\d{1,2}$/.test(raw)) return null;
      const n = Number(raw);
      return n >= 1 && n <= 31 ? n : null;
    });

    const firstOne = nums.indexOf(1);
    const prev = new Date(my.year, my.month, 0);
    const prevMonth = prev.getMonth();
    const prevYear = prev.getFullYear();

    return nums.map((day, i) => {
      if (!day) return null;
      let month = my.month;
      let year = my.year;

      if (firstOne > 0 && i < firstOne) {
        month = prevMonth;
        year = prevYear;
      }

      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    });
  }

  function planningDatesForSelectedPeriod(table,daysRow,dates,selectedDate) {
    if(!table || !daysRow || !Array.isArray(dates) || !selectedDate) return [];

    const selectedIndex=dates.indexOf(selectedDate);
    if(selectedIndex<0) return [];

    // Office Puzzle itself defines the current planning/weekly group through
    // the merged cells in the "Weekly average" row. Do not assume Mon-Fri,
    // Sun-Sat, or any other fixed weekday boundary.
    const weeklyRow=findNamedRow(table,"Weekly average");
    if(!weeklyRow) return [];

    const dayCells=cellsOfRow(daysRow);
    const weeklyCells=cellsOfRow(weeklyRow);
    const selectedWeeklyCell=cellForDayIndex(weeklyCells,dayCells,selectedIndex);
    if(!selectedWeeklyCell) return [];

    const grouped=[];
    dates.forEach((date,dayIndex)=>{
      if(!date) return;
      const cell=cellForDayIndex(weeklyCells,dayCells,dayIndex);
      if(cell===selectedWeeklyCell) grouped.push(date);
    });

    const writable=new Set(writableDatesForTable(table,daysRow,dates));
    return grouped.filter(date=>writable.has(date));
  }

  function isMarked(cell) {
    if (!cell) return false;

    // Only direct evidence counts as a marked occurrence.
    // Generic "active"/"selected" classes may simply indicate the current date.
    const raw = textOf(cell).trim().toLowerCase();

    if (raw === "x" || raw === "×") return true;

    if (
      cell.getAttribute("aria-checked") === "true" ||
      cell.getAttribute("data-checked") === "true"
    ) return true;

    const checked = cell.querySelector?.(
      'input[type="checkbox"]:checked, [role="checkbox"][aria-checked="true"]'
    );
    return !!checked;
  }

  function getOccurrenceRows(table) {
    const out = [];
    const rows = table.rows ? [...table.rows] : [...table.querySelectorAll("tr")];

    for (const row of rows) {
      const cells = cellsOfRow(row);
      if (!cells.length) continue;

      const first = textOf(cells[0]).trim();
      if (!/^\d+$/.test(first)) continue;

      const level = Number(first);
      if (!Number.isInteger(level) || level < 1 || level > 500) continue;

      out.push({ row, cells, level });
    }

    return out;
  }

  function countColumn(occurrenceRows, columnIndex) {
    let count = 0;
    for (const r of occurrenceRows) {
      if (columnIndex < r.cells.length && isMarked(r.cells[columnIndex])) count++;
    }
    return count;
  }

  function countDayColumn(occurrenceRows,dayCells,dayIndex) {
    let count=0;

    for(const row of occurrenceRows) {
      const cell=cellForDayIndex(row.cells,dayCells,dayIndex);
      if(isMarked(cell)) count++;
    }

    return count;
  }

  function mondayISO(dateISO) {
    const d = new Date(`${dateISO}T12:00:00`);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0,10);
  }

  function addDaysISO(dateISO, days) {
    const d = new Date(`${dateISO}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }

  function inspectBehaviorTable(table, selectedDate, monthYear = null) {
    const daysRow = findDaysRow(table);
    if (!daysRow) return null;

    const dates = mapDaysRowDates(daysRow, monthYear);
    if (!dates.length) return null;

    const selectedIndex = dates.indexOf(selectedDate);
    if (selectedIndex < 0) return null;

    const occurrenceRows = getOccurrenceRows(table);
    if (occurrenceRows.length < 2) return null;

    const dayCells=cellsOfRow(daysRow);
    const selectedColumnIndex = selectedIndex + 1;
    const dailyCounts = {};
    const dailyRecorded = {};

    const initialsRow=findNamedRow(table,"Initials");
    const initialsCells=initialsRow ? cellsOfRow(initialsRow) : [];

    dates.forEach((date,dayIndex)=>{
      if(!date) return;

      const count=countDayColumn(
        occurrenceRows,
        dayCells,
        dayIndex
      );

      dailyCounts[date]=count;

      const initialsCell=initialsCells.length
        ? cellForDayIndex(initialsCells,dayCells,dayIndex)
        : null;

      const initialsText=textOf(initialsCell).trim();

      // A positive count is unambiguously actual. For a recorded zero,
      // Office Puzzle initials are the durable signal that the day was
      // intentionally documented rather than simply blank.
      dailyRecorded[date]=
        count>0 ||
        !!initialsText;
    });

    return {
      selectedDate,
      columnIndex:selectedColumnIndex,
      occurrenceRows,
      currentCount:countDayColumn(
        occurrenceRows,
        dayCells,
        selectedIndex
      ),
      maxOccurrences:occurrenceRows.length,
      dailyCounts,
      dailyRecorded,
      planningDates:planningDatesForSelectedPeriod(
        table,daysRow,dates,selectedDate
      )
    };
  }

  function collectGraphTables(selectedDate, monthYear) {
    const graphs = [];

    for (const table of document.querySelectorAll("table")) {
      const inspected = inspectBehaviorTable(table, selectedDate, monthYear);
      if (!inspected) continue;

      const rect = table.getBoundingClientRect();
      graphs.push({
        table,
        top:rect.top + window.scrollY,
        inspected
      });
    }

    graphs.sort((a,b) => a.top - b.top);
    return graphs;
  }


  function getIntervalRows(table) {
    const out=[];
    const rows=table.rows ? [...table.rows] : [...table.querySelectorAll("tr")];

    for (const row of rows) {
      const cells=cellsOfRow(row);
      if (!cells.length) continue;

      const first=normalize(textOf(cells[0]));
      const m=first.match(/^interval\s*(\d{1,2})$/);
      if (!m) continue;

      out.push({
        row,
        cells,
        interval:Number(m[1])
      });
    }

    out.sort((a,b)=>a.interval-b.interval);
    return out;
  }

  function getTrialRows(table) {
    const out = [];
    const rows = table.rows ? [...table.rows] : [...table.querySelectorAll("tr")];

    for (const row of rows) {
      const cells = cellsOfRow(row);
      if (!cells.length) continue;

      const first = normalize(textOf(cells[0]));
      const m = first.match(/^trial\s*(10|[1-9])$/);
      if (!m) continue;

      out.push({
        row,
        cells,
        trial:Number(m[1])
      });
    }

    out.sort((a,b) => a.trial - b.trial);
    return out;
  }

function trialCellState(cell) {
    if (!cell) return "";

    function clean(value) {
      return String(value ?? "")
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g,"")
        .replace(/\u00A0/g," ")
        .trim();
    }

    function symbol(value) {
      const raw=clean(value);
      if (!raw) return "";

      const compact=raw
        .replace(/\s+/g,"")
        .replace(/^["']|["']$/g,"");

      if (compact === "+") return "+";

      if (
        compact === "-" ||
        compact === "−" ||
        compact === "–" ||
        compact === "—"
      ) return "-";

      const lower=raw.toLowerCase();

      if (
        lower === "plus" ||
        lower === "add" ||
        lower === "positive" ||
        /\bplus\b/.test(lower) ||
        /\bfa-plus\b/.test(lower) ||
        /\bglyphicon-plus\b/.test(lower) ||
        /\bmdi-plus\b/.test(lower) ||
        /(?:^|[#/_-])plus(?:$|[/_-])/.test(lower)
      ) return "+";

      if (
        lower === "minus" ||
        lower === "remove" ||
        lower === "negative" ||
        /\bminus\b/.test(lower) ||
        /\bfa-minus\b/.test(lower) ||
        /\bglyphicon-minus\b/.test(lower) ||
        /\bmdi-minus\b/.test(lower) ||
        /(?:^|[#/_-])minus(?:$|[/_-])/.test(lower)
      ) return "-";

      for (const ch of raw) {
        const cp=ch.codePointAt(0);

        if (
          cp===0x2b ||
          cp===0xf067 ||
          cp===0xe145
        ) return "+";

        if (
          cp===0x2d ||
          cp===0x2212 ||
          cp===0x2013 ||
          cp===0x2014 ||
          cp===0xf068 ||
          cp===0xe15b
        ) return "-";
      }

      return "";
    }

    let state=symbol(cell.innerText);
    if (state) return state;

    state=symbol(cell.textContent);
    if (state) return state;

    const nodes=[
      cell,
      ...cell.querySelectorAll(
        'input,textarea,button,a,span,i,svg,use,path,[role="button"],[role="textbox"],' +
        '[contenteditable="true"],[data-value],[data-state],[data-status],' +
        '[data-response],[data-icon],[data-content],[aria-label],[title]'
      )
    ].slice(0,80);

    for (const node of nodes) {
      if ("value" in node) {
        state=symbol(node.value);
        if (state) return state;
      }

      state=symbol(node.innerText);
      if (state) return state;

      state=symbol(node.textContent);
      if (state) return state;

      for (const attr of [
        "value",
        "data-value",
        "data-state",
        "data-status",
        "data-response",
        "data-icon",
        "data-content",
        "aria-label",
        "aria-valuetext",
        "title",
        "href",
        "xlink:href",
        "class"
      ]) {
        state=symbol(node.getAttribute?.(attr));
        if (state) return state;
      }

      try {
        for (const pseudo of ["::before","::after"]) {
          const cssContent=getComputedStyle(node,pseudo).content;

          if (
            !cssContent ||
            cssContent==="none" ||
            cssContent==="normal" ||
            cssContent==='""' ||
            cssContent==="''"
          ) continue;

          state=symbol(cssContent);
          if (state) return state;
        }
      } catch (_) {}
    }

    return "";
  }

  function parseAverageCell(cell) {
    if (!cell) return null;
    const raw = textOf(cell).trim();
    const m = raw.match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;

    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  function findNamedRow(table, rowName) {
    const target = normalize(rowName);
    const rows = table.rows ? [...table.rows] : [...table.querySelectorAll("tr")];

    for (const row of rows) {
      const cells = cellsOfRow(row);
      if (cells.length && normalize(textOf(cells[0])) === target) return row;
    }

    return null;
  }

  function logicalCellAt(rowCells,logicalIndex) {
    if(!Array.isArray(rowCells) || logicalIndex<0) return null;

    let cursor=0;

    for(const cell of rowCells) {
      const span=Math.max(1,Number(cell.colSpan || 1));

      if(logicalIndex>=cursor && logicalIndex<cursor+span) {
        return cell;
      }

      cursor+=span;
    }

    return null;
  }

  function cellForDayIndex(rowCells,dayCells,dayIndex) {
    if(!Array.isArray(rowCells) || !Array.isArray(dayCells)) return null;

    const headerLogicalIndex=dayIndex+1;
    const headerCell=dayCells[headerLogicalIndex];

    if(headerCell && isVisible(headerCell)) {
      const aligned=cellAlignedWithHeader(rowCells,headerCell);
      if(aligned) return aligned;
    }

    // Hidden/collapsed tables have no useful geometry. Read their HTML column
    // structure directly, respecting colspan.
    return (
      logicalCellAt(rowCells,headerLogicalIndex) ||
      rowCells[headerLogicalIndex] ||
      null
    );
  }

  function horizontalCenter(cell) {
    const rect=cell?.getBoundingClientRect();
    if (!rect) return null;
    return rect.left + rect.width / 2;
  }

  function cellAlignedWithHeader(rowCells, headerCell) {
    const targetX=horizontalCenter(headerCell);
    if (targetX == null) return null;

    let best=null;
    let bestDistance=Infinity;

    for (const cell of rowCells.slice(1)) {
      const rect=cell.getBoundingClientRect();

      // Exact geometric overlap with the selected date header is preferred.
      if (targetX >= rect.left && targetX <= rect.right) {
        return cell;
      }

      const center=rect.left + rect.width / 2;
      const distance=Math.abs(center-targetX);

      if (distance < bestDistance) {
        best=cell;
        bestDistance=distance;
      }
    }

    // Only accept the nearest fallback if it is reasonably close to one cell width.
    if (best) {
      const rect=best.getBoundingClientRect();
      if (bestDistance <= Math.max(8, rect.width * 0.75)) return best;
    }

    return null;
  }

  function inspectPartialIntervalTable(table, selectedDate, monthYear=null) {
    const daysRow=findDaysRow(table);
    if (!daysRow) return null;

    const dates=mapDaysRowDates(daysRow,monthYear);
    if (!dates.length) return null;

    const selectedIndex=dates.indexOf(selectedDate);
    if (selectedIndex < 0) return null;

    const dayCells=cellsOfRow(daysRow);
    const selectedHeaderCell=dayCells[selectedIndex+1];
    if (!selectedHeaderCell) return null;

    const intervalRows=getIntervalRows(table)
      .filter(item=>item.interval>=1 && item.interval<=MAX_CHALLENGING_INTERVALS);

    if (intervalRows.length < 10) return null;

    for (const item of intervalRows) {
      item.selectedCell=cellForDayIndex(item.cells,dayCells,selectedIndex);
      if (!item.selectedCell) return null;
    }

    const currentStates=intervalRows.map(item=>trialCellState(item.selectedCell));

    const dailyAverages={};
    const dailyStates={};
    const averageRow=findNamedRow(table,"Daily average");
    const averageCells=averageRow ? cellsOfRow(averageRow) : [];

    dates.forEach((date,dayIndex)=>{
      if(!date) return;

      const headerCell=dayCells[dayIndex+1];
      if(!headerCell) return;

      const states=intervalRows.map(item=>{
        const cell=cellForDayIndex(item.cells,dayCells,dayIndex);
        return trialCellState(cell);
      });

      dailyStates[date]=states;

      let average=null;

      if(averageCells.length) {
        const averageCell=cellForDayIndex(averageCells,dayCells,dayIndex);
        average=parseAverageCell(averageCell);
      }

      if(average==null) {
        const populated=states.filter(Boolean).length;

        if(populated>0) {
          average=(states.filter(state=>state==="+").length / populated) * 100;
        }
      }

      dailyAverages[date]=average;
    });

    return {
      selectedDate,
      selectedHeaderText:textOf(selectedHeaderCell),
      selectedHeaderX:horizontalCenter(selectedHeaderCell),
      intervalRows,
      currentStates,
      currentAverage:dailyAverages[selectedDate] ?? null,
      dailyAverages,
      dailyStates,
      planningDates:planningDatesForSelectedPeriod(
        table,daysRow,dates,selectedDate
      )
    };
  }

  // Writer hot path: inspect only the currently selected date column.
  // The full inspectors intentionally build history for every visible date,
  // which is useful for planning but far too expensive to repeat after every
  // +/- click. This compact inspector keeps the same table/date alignment and
  // Daily average verification while touching only the active column.
  function inspectPartialIntervalTableSelectedDateFast(table, selectedDate, monthYear=null) {
    const daysRow=findDaysRow(table);
    if (!daysRow) return null;

    const dates=mapDaysRowDates(daysRow,monthYear);
    if (!dates.length) return null;

    const selectedIndex=dates.indexOf(selectedDate);
    if (selectedIndex<0) return null;

    const dayCells=cellsOfRow(daysRow);
    const selectedHeaderCell=dayCells[selectedIndex+1];
    if (!selectedHeaderCell) return null;

    const intervalRows=getIntervalRows(table)
      .filter(item=>item.interval>=1 && item.interval<=MAX_CHALLENGING_INTERVALS);

    if (intervalRows.length<10) return null;

    for (const item of intervalRows) {
      item.selectedCell=cellForDayIndex(item.cells,dayCells,selectedIndex);
      if (!item.selectedCell) return null;
    }

    const currentStates=intervalRows.map(item=>trialCellState(item.selectedCell));
    const averageRow=findNamedRow(table,"Daily average");
    const averageCells=averageRow ? cellsOfRow(averageRow) : [];
    const averageCell=averageCells.length
      ? cellForDayIndex(averageCells,dayCells,selectedIndex)
      : null;

    let currentAverage=parseAverageCell(averageCell);

    if (currentAverage==null) {
      const populated=currentStates.filter(Boolean).length;
      if (populated>0) {
        currentAverage=(currentStates.filter(state=>state==="+").length/populated)*100;
      }
    }

    return {
      selectedDate,
      selectedHeaderText:textOf(selectedHeaderCell),
      selectedHeaderX:horizontalCenter(selectedHeaderCell),
      intervalRows,
      currentStates,
      currentAverage,
      dailyAverages:{[selectedDate]:currentAverage},
      dailyStates:{[selectedDate]:currentStates},
      planningDates:[]
    };
  }

  function collectPartialIntervalTables(selectedDate,monthYear) {
    const tables=[];

    for (const table of document.querySelectorAll("table")) {
      const inspected=inspectPartialIntervalTable(table,selectedDate,monthYear);
      if (!inspected) continue;

      const rect=table.getBoundingClientRect();
      tables.push({
        table,
        top:rect.top + window.scrollY,
        inspected
      });
    }

    tables.sort((a,b)=>a.top-b.top);
    return tables;
  }

  function inspectReplacementTable(table, selectedDate, monthYear = null) {
    const daysRow=findDaysRow(table);
    if (!daysRow) return null;

    const dates=mapDaysRowDates(daysRow,monthYear);
    if (!dates.length) return null;

    const selectedIndex=dates.indexOf(selectedDate);
    if (selectedIndex < 0) return null;

    const dayCells=cellsOfRow(daysRow);
    const selectedHeaderCell=dayCells[selectedIndex + 1];
    if (!selectedHeaderCell) return null;

    const trialRows=getTrialRows(table);
    if (trialRows.length !== 10) return null;

    // Resolve the current date cell independently for every Trial row by its
    // horizontal alignment with the actual selected-date header cell.
    for (const item of trialRows) {
      item.selectedCell=cellForDayIndex(item.cells,dayCells,selectedIndex);
      if (!item.selectedCell) return null;
    }

    const currentStates=trialRows.map(item =>
      trialCellState(item.selectedCell)
    );

    const dailyAverages={};
    const dailyStates={};
    const averageRow=findNamedRow(table,"Daily average");
    const averageCells=averageRow ? cellsOfRow(averageRow) : [];

    dates.forEach((date,dayIndex)=>{
      if(!date) return;

      const headerCell=dayCells[dayIndex+1];
      if(!headerCell) return;

      const states=trialRows.map(item=>{
        const cell=cellForDayIndex(item.cells,dayCells,dayIndex);
        return trialCellState(cell);
      });

      dailyStates[date]=states;

      let average=null;

      if(averageCells.length) {
        const averageCell=cellForDayIndex(averageCells,dayCells,dayIndex);
        average=parseAverageCell(averageCell);
      }

      if(average==null) {
        const populated=states.filter(Boolean).length;

        if(populated===10) {
          average=states.filter(state=>state==="+").length * 10;
        }
      }

      dailyAverages[date]=average;
    });

    const currentAverage=
      dailyAverages[selectedDate] ??
      (
        currentStates.filter(Boolean).length === 10
          ? currentStates.filter(state => state === "+").length * 10
          : null
      );

    return {
      selectedDate,
      selectedHeaderText:textOf(selectedHeaderCell),
      selectedHeaderX:horizontalCenter(selectedHeaderCell),
      trialRows,
      currentStates,
      currentAverage,
      dailyAverages,
      dailyStates,
      planningDates:planningDatesForSelectedPeriod(
        table,daysRow,dates,selectedDate
      )
    };
  }

  // Writer hot path counterpart for 10-trial Replacement / Skill tables.
  // It deliberately avoids rebuilding dailyStates/dailyAverages for every date
  // while a clinical write is in progress.
  function inspectReplacementTableSelectedDateFast(table, selectedDate, monthYear=null) {
    const daysRow=findDaysRow(table);
    if (!daysRow) return null;

    const dates=mapDaysRowDates(daysRow,monthYear);
    if (!dates.length) return null;

    const selectedIndex=dates.indexOf(selectedDate);
    if (selectedIndex<0) return null;

    const dayCells=cellsOfRow(daysRow);
    const selectedHeaderCell=dayCells[selectedIndex+1];
    if (!selectedHeaderCell) return null;

    const trialRows=getTrialRows(table);
    if (trialRows.length!==10) return null;

    for (const item of trialRows) {
      item.selectedCell=cellForDayIndex(item.cells,dayCells,selectedIndex);
      if (!item.selectedCell) return null;
    }

    const currentStates=trialRows.map(item=>trialCellState(item.selectedCell));
    const averageRow=findNamedRow(table,"Daily average");
    const averageCells=averageRow ? cellsOfRow(averageRow) : [];
    const averageCell=averageCells.length
      ? cellForDayIndex(averageCells,dayCells,selectedIndex)
      : null;

    let currentAverage=parseAverageCell(averageCell);

    if (currentAverage==null && currentStates.filter(Boolean).length===10) {
      currentAverage=currentStates.filter(state=>state==="+").length*10;
    }

    return {
      selectedDate,
      selectedHeaderText:textOf(selectedHeaderCell),
      selectedHeaderX:horizontalCenter(selectedHeaderCell),
      trialRows,
      currentStates,
      currentAverage,
      dailyAverages:{[selectedDate]:currentAverage},
      dailyStates:{[selectedDate]:currentStates},
      planningDates:[]
    };
  }

  function collectReplacementTables(selectedDate, monthYear) {
    const tables = [];

    for (const table of document.querySelectorAll("table")) {
      const inspected = inspectReplacementTable(table, selectedDate, monthYear);
      if (!inspected) continue;

      const rect = table.getBoundingClientRect();

      tables.push({
        table,
        top:rect.top + window.scrollY,
        inspected
      });
    }

    tables.sort((a,b) => a.top - b.top);
    return tables;
  }


  function supportedTableShape(table) {
    const rows=table.rows ? [...table.rows] : [...table.querySelectorAll("tr")];

    let hasDays=false;
    let trialCount=0;
    let intervalCount=0;
    let occurrenceCount=0;

    for(const row of rows) {
      const cells=cellsOfRow(row);
      if(!cells.length) continue;

      const firstRaw=textOf(cells[0]).trim();
      const first=normalize(firstRaw);

      if(first==="days") {
        hasDays=true;
        continue;
      }

      if(/^trial\s*(10|[1-9])$/.test(first)) {
        trialCount++;
        continue;
      }

      if(/^interval\s*(\d{1,2})$/.test(first)) {
        intervalCount++;
        continue;
      }

      if(/^\d+$/.test(firstRaw)) {
        const level=Number(firstRaw);
        if(Number.isInteger(level) && level>=1 && level<=500) {
          occurrenceCount++;
        }
      }
    }

    if(!hasDays) return "";

    if(trialCount===10) return "percentage_opportunities";
    if(intervalCount>=10) return "partial_interval";
    if(occurrenceCount>=2) return "frequency";

    return "";
  }

  function collectSupportedTablePools(selectedDate,monthYear) {
    const pools={
      frequency:[],
      partial_interval:[],
      percentage_opportunities:[]
    };

    for(const table of document.querySelectorAll("table")) {
      const method=supportedTableShape(table);
      if(!method) continue;

      let inspected=null;

      if(method==="frequency") {
        inspected=inspectBehaviorTable(table,selectedDate,monthYear);
      } else if(method==="partial_interval") {
        inspected=inspectPartialIntervalTable(table,selectedDate,monthYear);
      } else if(method==="percentage_opportunities") {
        inspected=inspectReplacementTable(table,selectedDate,monthYear);
      }

      if(!inspected) continue;

      const rect=table.getBoundingClientRect();

      pools[method].push({
        table,
        top:rect.top + window.scrollY,
        inspected
      });
    }

    for(const pool of Object.values(pools)) {
      pool.sort((a,b)=>a.top-b.top);
    }

    return pools;
  }

  function registerTable(table) {
    for (const [id, registered] of tableRegistry.entries()) {
      if (registered === table) return id;
    }
    const id = `rbt-table-${++registryCounter}`;
    tableRegistry.set(id, table);
    return id;
  }

  function findBehaviorLabel(behaviorName) {
    const target = normalize(behaviorName);
    const nodes = document.querySelectorAll("td,th,div,span,p,label,strong,b");
    let best = null;
    let bestScore = Infinity;

    for (const el of nodes) {
      if (!isVisible(el)) continue;

      const txt = textOf(el);
      if (!txt || txt.length > 180) continue;

      const n = normalize(txt);

      // Support either the raw name or Office Puzzle text such as "Name: Elopement".
      const exact = n === target;
      const prefixed = n === `name ${target}`;

      if (!exact && !prefixed) continue;

      // Prefer the shortest/smallest exact label.
      const score = txt.length + (prefixed ? 20 : 0);
      if (score < bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return best;
  }

  function graphForBehavior(behaviorName, graphs) {
    const label = findBehaviorLabel(behaviorName);
    if (!label) return null;

    // First try a local shared container, same strategy as the previously
    // working detector, but against the already-collected graph list.
    let ancestor = label.parentElement;

    for (let depth = 0; ancestor && depth < 8; depth++, ancestor = ancestor.parentElement) {
      const contained = graphs.filter(g => ancestor.contains(g.table));

      if (contained.length === 1) return contained[0];

      if (contained.length > 1) {
        const labelY = label.getBoundingClientRect().top + window.scrollY;
        const below = contained
          .map(g => ({ g, delta:g.top - labelY }))
          .filter(x => x.delta >= -40)
          .sort((a,b) => a.delta - b.delta);

        if (below.length) return below[0].g;
      }
    }

    // Fallback: closest graph below the behavior label.
    const labelY = label.getBoundingClientRect().top + window.scrollY;
    const below = graphs
      .map(g => ({ g, delta:g.top - labelY }))
      .filter(x => x.delta >= -40)
      .sort((a,b) => a.delta - b.delta);

    if (below.length) return below[0].g;

    // Last resort: nearest graph vertically.
    return graphs
      .map(g => ({ g, delta:Math.abs(g.top - labelY) }))
      .sort((a,b) => a.delta - b.delta)[0]?.g || null;
  }


  function collectionMethodFromRaw(raw) {
    const value=String(raw || "").trim();

    if (/partial\s*interval/i.test(value)) return "partial_interval";
    if (/frequency/i.test(value)) return "frequency";
    if (/percentage\s+of\s+opportunit/i.test(value)) {
      return "percentage_opportunities";
    }

    return "";
  }

  function categoryFromRaw(raw) {
    return String(raw || "").replace(/\s+/g," ").trim();
  }

  function metadataValueFromTable(table,label) {
    if(!table) return "";

    const target=normalize(label);
    const rows=table.rows ? [...table.rows] : [...table.querySelectorAll("tr")];

    for(const row of rows) {
      const cells=cellsOfRow(row);
      if(cells.length<2) continue;

      const first=normalize(textOf(cells[0]));
      if(first!==target) continue;

      return textOf(cells[1]).trim();
    }

    return "";
  }

  function metadataValueNearLabel(labelEl,label) {
    if(!labelEl) return "";

    // Most Office Puzzle program metadata is a small table containing
    // Name / Category / Collection Method. Prefer that exact local table.
    const closestTable=labelEl.closest?.("table");
    const local=metadataValueFromTable(closestTable,label);
    if(local) return local;

    // Fallback: walk through small local containers only. Never use the whole
    // document here because multi-program pages can contain different methods.
    let ancestor=labelEl.parentElement;

    for(let depth=0; ancestor && depth<6; depth++,ancestor=ancestor.parentElement) {
      const raw=textOf(ancestor);
      if(!raw || raw.length>6000) continue;

      const escaped=String(label).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      const re=new RegExp(
        `${escaped}:\\s*(.+?)(?=\\s+(?:Name:|Category:|Collection Method:|Description:|Baselines:|Objective:|Start date:|End date:)|$)`,
        "i"
      );
      const m=raw.match(re);
      if(m?.[1]) return m[1].trim();
    }

    return "";
  }

  function nodeBefore(a,b) {
    if(!a || !b || a===b) return false;
    return !!(
      a.compareDocumentPosition(b) &
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  }

  function programDescriptorsFromDom() {
    const descriptors=[];
    const seen=new Set();

    // Intentionally includes hidden rows. Office Puzzle can keep non-selected
    // program sections in the live DOM with display:none.
    for(const row of document.querySelectorAll("tr")) {
      const cells=cellsOfRow(row);
      if(cells.length<2) continue;
      if(normalize(textOf(cells[0]))!=="name") continue;

      const label=cells[1];
      const name=textOf(label).replace(/\s+/g," ").trim();

      if(!name || name.length>260) continue;

      const key=normalize(name);
      if(!key || seen.has(key)) continue;

      seen.add(key);
      descriptors.push({
        name,
        key,
        row,
        label,
        metadataTable:row.closest("table")
      });
    }

    if(!descriptors.length) {
      const current=detectCurrentName();
      const label=current
        ? (findBehaviorLabel(current) || findReplacementLabel(current))
        : null;

      if(current && label) {
        descriptors.push({
          name:current,
          key:normalize(current),
          row:label.closest("tr") || label,
          label,
          metadataTable:label.closest("table")
        });
      }
    }

    descriptors.sort((a,b)=>{
      if(a.row===b.row) return 0;
      return nodeBefore(a.row,b.row) ? -1 : 1;
    });

    return descriptors;
  }

  function descriptorMetadataValue(descriptor,label) {
    if(!descriptor) return "";

    const direct=metadataValueFromTable(
      descriptor.metadataTable,
      label
    );
    if(direct) return direct;

    return metadataValueNearLabel(descriptor.label,label);
  }

  function unifiedSupportedTables(pools) {
    const byTable=new Map();

    for(const [method,pool] of Object.entries(pools)) {
      for(const entry of pool || []) {
        if(!entry?.table || byTable.has(entry.table)) continue;
        byTable.set(entry.table,{method,entry});
      }
    }

    const list=[...byTable.values()];

    list.sort((a,b)=>{
      if(a.entry.table===b.entry.table) return 0;
      return nodeBefore(a.entry.table,b.entry.table) ? -1 : 1;
    });

    return list;
  }

  function tableCandidateFromDomBlock(
    descriptor,
    nextDescriptor,
    supportedTables,
    usedTables,
    requiredMethod=""
  ) {
    const candidates=(supportedTables || []).filter(item=>
      item?.entry?.table &&
      !usedTables.has(item.entry.table) &&
      (!requiredMethod || item.method===requiredMethod)
    );

    if(!candidates.length) return null;

    const containing=candidates.find(item=>
      item.entry.table.contains(descriptor.row)
    );
    if(containing) return containing;

    const inBlock=candidates.find(item=>{
      const table=item.entry.table;
      const afterName=nodeBefore(descriptor.row,table);
      const beforeNext=
        !nextDescriptor ||
        nodeBefore(table,nextDescriptor.row);

      return afterName && beforeNext;
    });

    if(inBlock) return inBlock;

    // Single-program fallback.
    return candidates.find(item=>
      nodeBefore(descriptor.row,item.entry.table)
    ) || null;
  }

  function cleanProgramCandidate(raw) {
    let value=String(raw || "")
      .replace(/\s+/g," ")
      .replace(/^(?:name|program|behavior|behaviour|skill)\s*:\s*/i,"")
      .trim();

    if(!value || value.length<2 || value.length>240) return "";

    const n=normalize(value);

    if(
      !n ||
      /^(?:select|choose|all|none|program|programs|behavior|behaviors|behaviour|behaviours|replacement|replacements|skill|skills|maladaptive behaviors?|challenging behaviors?|days?|daily average|weekly average|monthly average|initials?)$/.test(n) ||
      /^(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?$/.test(n) ||
      /^\d+(?:\.\d+)?%?$/.test(n)
    ) return "";

    if(
      /^(?:category|collection method|description|baselines?|objective|start date|end date|month\/year)\b/i.test(value)
    ) return "";

    return value;
  }

  function pushUniqueProgramCandidate(list,seen,raw,source="") {
    const name=cleanProgramCandidate(raw);
    if(!name) return;

    const key=normalize(name);
    if(!key || seen.has(key)) return;

    seen.add(key);
    list.push({name,key,source});
  }

  function programNamesFromFullDomMetadata() {
    const list=[];
    const seen=new Set();

    // textContent includes collapsed/hidden Office Puzzle sections.
    const raw=String(document.body?.textContent || "")
      .replace(/\u00a0/g," ");

    const patterns=[
      /(?:^|\s)Name\s*:\s*(.+?)(?=\s+(?:Category|Collection Method|Description|Baselines?|Objective|Start date|End date|Month\/Year)\s*:|$)/gi,
      /(?:^|\s)Program\s*Name\s*:\s*(.+?)(?=\s+(?:Category|Collection Method|Description|Baselines?|Objective|Start date|End date)\s*:|$)/gi
    ];

    for(const pattern of patterns) {
      let match;
      while((match=pattern.exec(raw))) {
        pushUniqueProgramCandidate(
          list,
          seen,
          match[1],
          "metadata_text"
        );
      }
    }

    return list;
  }

  function selectContextText(select) {
    const parts=[
      select?.id,
      select?.name,
      select?.getAttribute?.("aria-label"),
      select?.getAttribute?.("title"),
      select?.getAttribute?.("data-name"),
      select?.getAttribute?.("data-field")
    ].filter(Boolean);

    const labelId=select?.id
      ? document.querySelector(`label[for="${CSS.escape(select.id)}"]`)
      : null;

    if(labelId) parts.push(textOf(labelId));

    let node=select?.parentElement;
    for(let depth=0; node && depth<3; depth++,node=node.parentElement) {
      const txt=String(node.textContent || "").replace(/\s+/g," ").trim();
      if(txt && txt.length<=700) parts.push(txt);
    }

    return parts.join(" ");
  }

  function programNamesFromNativeControls(currentName="") {
    const list=[];
    const seen=new Set();
    const currentKey=normalize(currentName);

    for(const select of document.querySelectorAll("select")) {
      const options=[...select.options];
      if(options.length<2) continue;

      const optionKeys=options.map(option=>normalize(option.textContent));
      const containsCurrent=
        !!currentKey &&
        optionKeys.some(key=>
          key===currentKey ||
          key.startsWith(currentKey+" ") ||
          currentKey.startsWith(key+" ")
        );

      const context=normalize(selectContextText(select));
      const programLikeContext=
        /\b(?:behavior|behaviour|replacement|skill|acquisition|program|target|goal|maladaptive|challenging)\b/.test(context);

      if(!containsCurrent && !programLikeContext) continue;

      for(const option of options) {
        pushUniqueProgramCandidate(
          list,
          seen,
          option.textContent,
          "native_select"
        );
      }
    }

    return list;
  }

  function shortLocalProgramText(raw) {
    const value=String(raw || "").replace(/\s+/g," ").trim();
    if(!value || value.length>260) return "";

    const directName=value.match(
      /(?:^|\s)Name\s*:\s*(.+?)(?=\s+(?:Category|Collection Method|Description|Baselines?|Objective|Start date|End date)\s*:|$)/i
    );
    if(directName?.[1]) return cleanProgramCandidate(directName[1]);

    return cleanProgramCandidate(value);
  }

  function programNameNearTable(table) {
    if(!table) return "";

    // 1) Data/ARIA attributes on the table or nearby program card.
    let node=table;
    for(let depth=0; node && depth<7; depth++,node=node.parentElement) {
      for(const attr of [
        "data-name",
        "data-program",
        "data-program-name",
        "data-behavior",
        "data-behaviour",
        "data-skill",
        "data-target",
        "aria-label",
        "title"
      ]) {
        const candidate=shortLocalProgramText(node.getAttribute?.(attr));
        if(candidate) return candidate;
      }

      const raw=String(node.textContent || "")
        .replace(/\s+/g," ")
        .trim();

      if(raw && raw.length<=9000) {
        const m=raw.match(
          /(?:^|\s)Name\s*:\s*(.+?)(?=\s+(?:Category|Collection Method|Description|Baselines?|Objective|Start date|End date)\s*:|$)/i
        );
        const candidate=cleanProgramCandidate(m?.[1]);
        if(candidate) return candidate;
      }
    }

    // 2) Nearby preceding headings/labels. This catches Office Puzzle layouts
    // where a program title is a heading directly above the data table.
    let cursor=table;
    let checked=0;

    while(cursor && checked<18) {
      let prev=cursor.previousElementSibling;

      while(prev && checked<18) {
        checked++;

        const heading=prev.matches?.("h1,h2,h3,h4,h5,h6,strong,b,label")
          ? prev
          : prev.querySelector?.("h1,h2,h3,h4,h5,h6,strong,b,label");

        const candidate=shortLocalProgramText(
          heading ? textOf(heading) : ""
        );

        if(candidate) return candidate;

        const raw=String(prev.textContent || "")
          .replace(/\s+/g," ")
          .trim();

        const nameMatch=raw.match(
          /(?:^|\s)Name\s*:\s*(.+?)(?=\s+(?:Category|Collection Method|Description|Baselines?|Objective|Start date|End date)\s*:|$)/i
        );

        const nameCandidate=cleanProgramCandidate(nameMatch?.[1]);
        if(nameCandidate) return nameCandidate;

        prev=prev.previousElementSibling;
      }

      cursor=cursor.parentElement;
    }

    return "";
  }

  
  let programNameBaseCache=null;
  let programNameBaseRevision=-1;
  let programStructureRevision=0;

  function baseProgramNameCandidates() {
    if(
      programNameBaseCache &&
      programNameBaseRevision===programStructureRevision
    ) {
      return programNameBaseCache.map(item=>({...item}));
    }

    const list=[];
    const seen=new Set();

    for(const item of programNamesFromFullDomMetadata()) {
      pushUniqueProgramCandidate(
        list,
        seen,
        item.name,
        item.source
      );
    }

    for(const item of programNamesFromNativeControls("")) {
      pushUniqueProgramCandidate(
        list,
        seen,
        item.name,
        item.source
      );
    }

    for(const descriptor of programDescriptorsFromDom()) {
      pushUniqueProgramCandidate(
        list,
        seen,
        descriptor.name,
        "name_row"
      );
    }

    programNameBaseCache=list.map(item=>({...item}));
    programNameBaseRevision=programStructureRevision;

    return list;
  }

function programNameInventory(supportedTables) {
    const currentName=detectCurrentName() || "";
    const highConfidence=[];
    const seen=new Set();

    for(const item of baseProgramNameCandidates()) {
      pushUniqueProgramCandidate(
        highConfidence,
        seen,
        item.name,
        item.source
      );
    }

    // If the current program changed without changing page structure,
    // include it immediately without throwing away the cached full list.
    if(currentName) {
      for(const item of programNamesFromNativeControls(currentName)) {
        pushUniqueProgramCandidate(
          highConfidence,
          seen,
          item.name,
          item.source
        );
      }
    }

    // Table-local association must stay fresh because Office Puzzle can append
    // newly loaded tables while scrolling.
    const tableLocalNames=(supportedTables || []).map(item=>
      programNameNearTable(item.entry?.table)
    );

    for(const name of tableLocalNames) {
      pushUniqueProgramCandidate(
        highConfidence,
        seen,
        name,
        "table_context"
      );
    }

    if(currentName) {
      pushUniqueProgramCandidate(
        highConfidence,
        seen,
        currentName,
        "current_name"
      );
    }

    return {
      candidates:highConfidence,
      tableLocalNames,
      candidateCount:highConfidence.length
    };
  }

  function mapInventoryTablesToNames(
    supportedTables,
    nameInventory
  ) {
    const resolved=[];
    const usedNames=new Set();

    const candidates=nameInventory?.candidates || [];
    const localNames=nameInventory?.tableLocalNames || [];

    const takeName=raw=>{
      const name=cleanProgramCandidate(raw);
      const key=normalize(name);

      if(!name || !key || usedNames.has(key)) return "";
      usedNames.add(key);
      return name;
    };

    for(let index=0; index<supportedTables.length; index++) {
      const supported=supportedTables[index];
      let name=takeName(localNames[index]);

      // If Office Puzzle exposes a full ordered program list, pair it to the
      // ordered table inventory. This is much safer than pretending the one
      // currently visible Name row is the entire client.
      if(!name && candidates.length>=supportedTables.length) {
        name=takeName(candidates[index]?.name);
      }

      if(!name) {
        const nextCandidate=candidates.find(item=>
          !usedNames.has(normalize(item.name))
        );
        name=takeName(nextCandidate?.name);
      }

      resolved.push({
        ...supported,
        inventoryIndex:index,
        resolvedName:name || ""
      });
    }

    return resolved;
  }

  function categoryLabelForPageType(pageType) {
    if(pageType==="maladaptive") return "Maladaptive Behaviors";
    if(pageType==="challenging") return "Challenging Behaviors";
    if(pageType==="replacement") return "Replacement / Acquisition Skill Programs";
    if(pageType==="client2replacement") {
      return "Replacement Behaviors / Skill Acquisitions";
    }
    return "";
  }

  function writerKindForMethod(method) {
    if(method==="frequency") return "count";
    if(method==="partial_interval") return "partial_interval";
    if(method==="percentage_opportunities") return "replacement";
    return "unsupported";
  }

  function mappingFromDiscoveredTable({
    name,
    method,
    rawMethod="",
    category="",
    pageType="",
    selectedDate,
    matched
  }) {
    const base={
      name,
      method,
      rawMethod,
      category,
      pageType,
      writerKind:writerKindForMethod(method),
      selectedDate,
      found:!!matched,
      tableId:matched?.table ? registerTable(matched.table) : null
    };

    if(!matched) {
      return {
        ...base,
        currentCount:null,
        maxOccurrences:null,
        dailyCounts:{},
        currentStates:[],
        currentAverage:null,
        dailyAverages:{},
        errorHint:
          method
            ? `Detected ${rawMethod || method}, but its data table is not currently mapped.`
            : "Collection method/table structure is not supported yet."
      };
    }

    if(method==="frequency") {
      return {
        ...base,
        currentCount:matched.inspected.currentCount,
        maxOccurrences:matched.inspected.maxOccurrences,
        dailyCounts:matched.inspected.dailyCounts || {},
        dailyRecorded:matched.inspected.dailyRecorded || {},
        planningDates:[...(matched.inspected.planningDates || [])]
      };
    }

    if(method==="partial_interval") {
      return {
        ...base,
        currentStates:[...(matched.inspected.currentStates || [])],
        currentAverage:matched.inspected.currentAverage,
        dailyAverages:matched.inspected.dailyAverages || {},
        dailyStates:matched.inspected.dailyStates || {},
        maxIntervals:matched.inspected.intervalRows?.length || 0,
        planningDates:[...(matched.inspected.planningDates || [])]
      };
    }

    if(method==="percentage_opportunities") {
      return {
        ...base,
        currentStates:[...(matched.inspected.currentStates || [])],
        currentAverage:matched.inspected.currentAverage,
        dailyAverages:matched.inspected.dailyAverages || {},
        dailyStates:matched.inspected.dailyStates || {},
        trials:matched.inspected.trialRows?.length || 10,
        planningDates:[...(matched.inspected.planningDates || [])]
      };
    }

    return {
      ...base,
      found:false,
      errorHint:"Unsupported collection method."
    };
  }

  async function discoverClientPrograms() {
    const resolved=resolveSelectedDate();
    const selectedDate=resolved.date;
    const monthYear=displayedMonthYear();
    const pageType=detectPageType();
    const clientLabel=detectClientLabel();

    tableRegistry.clear();
    registryCounter=0;

    if(!monthYear) {
      return {
        clientLabel,
        pageType,
        selectedDate,
        dateSource:resolved.source,
        programs:[],
        inventoryExpected:0,
        resolvedNameCount:0,
        errorHint:"Could not detect Month/Year."
      };
    }

    // One structural DOM pass classifies each supported table first.
    // Only the matching inspector runs for that table, instead of running
    // all three inspectors across every Office Puzzle table.
    const pools=collectSupportedTablePools(selectedDate,monthYear);

    // IMPORTANT: the supported table inventory is authoritative for "how many
    // programs exist on this Office Puzzle page". We never use the currently
    // learned profile length as the expected total.
    const supportedTables=unifiedSupportedTables(pools);
    const nameInventory=programNameInventory(supportedTables);
    const tableInventory=mapInventoryTablesToNames(
      supportedTables,
      nameInventory
    );

    const programs=[];
    let resolvedNameCount=0;

    for(const item of tableInventory) {
      if(!item.resolvedName) continue;

      resolvedNameCount++;

      const table=item.entry.table;
      const localRaw=String(
        table?.closest?.("section,article,.card,.panel,.box,div")?.textContent ||
        ""
      ).replace(/\s+/g," ");

      const methodMatch=localRaw.match(
        /Collection Method\s*:\s*(.+?)(?=\s+(?:Description|Baselines?|Objective|Start date|End date|Name|Category)\s*:|$)/i
      );
      const categoryMatch=localRaw.match(
        /Category\s*:\s*(.+?)(?=\s+(?:Collection Method|Description|Baselines?|Objective|Start date|End date|Name)\s*:|$)/i
      );

      const rawMethod=String(methodMatch?.[1] || "").trim();
      const explicitMethod=collectionMethodFromRaw(rawMethod);
      const method=explicitMethod || item.method;

      // If Office Puzzle explicitly exposes a different unsupported method,
      // leave it unsupported rather than guessing from table shape.
      const effectiveMatched=
        rawMethod && !explicitMethod
          ? null
          : item.entry;

      const mapping=mappingFromDiscoveredTable({
        name:item.resolvedName,
        method,
        rawMethod,
        category:
          categoryFromRaw(categoryMatch?.[1]) ||
          categoryLabelForPageType(pageType),
        pageType,
        selectedDate,
        matched:effectiveMatched
      });

      mapping.methodSource=
        explicitMethod
          ? "metadata"
          : "table_structure";

      mapping.programBlockIndex=item.inventoryIndex;
      programs.push(mapping);
      await idleYield();
    }

    // Include explicit Name metadata entries with unsupported methods even if
    // they do not have one of the three supported table shapes.
    const knownKeys=new Set(programs.map(item=>normalize(item.name)));

    for(const descriptor of programDescriptorsFromDom()) {
      const key=normalize(descriptor.name);
      if(!key || knownKeys.has(key)) continue;

      const rawMethod=descriptorMetadataValue(
        descriptor,
        "Collection Method"
      );

      if(!rawMethod) continue;

      const method=collectionMethodFromRaw(rawMethod);

      if(method) continue; // supported entries are table-inventory driven.

      programs.push(
        mappingFromDiscoveredTable({
          name:descriptor.name,
          method:"",
          rawMethod,
          category:
            categoryFromRaw(
              descriptorMetadataValue(descriptor,"Category")
            ) ||
            categoryLabelForPageType(pageType),
          pageType,
          selectedDate,
          matched:null
        })
      );

      knownKeys.add(key);
    }

    const inventoryExpected=Math.max(
      supportedTables.length,
      nameInventory.candidateCount,
      programs.length
    );

    const mappedSupported=programs.filter(item=>
      item.found &&
      item.writerKind!=="unsupported"
    ).length;

    return {
      clientLabel,
      pageType,
      selectedDate,
      dateSource:resolved.source,
      category:categoryLabelForPageType(pageType),
      programs,

      // Diagnostics/side-panel completion logic.
      inventoryExpected,
      supportedTableCount:supportedTables.length,
      resolvedNameCount,
      nameCandidateCount:nameInventory.candidateCount,
      mappedTableCount:mappedSupported,
      unresolvedTableCount:Math.max(
        0,
        supportedTables.length-mappedSupported
      ),
      inventoryComplete:
        inventoryExpected>0 &&
        mappedSupported>=inventoryExpected &&
        resolvedNameCount>=supportedTables.length,

      tableCounts:{
        frequency:pools.frequency.length,
        partial_interval:pools.partial_interval.length,
        percentage_opportunities:pools.percentage_opportunities.length
      }
    };
  }


  async function scanAllClient2Challenging() {
    const resolved=resolveSelectedDate();
    const selectedDate=resolved.date;
    const monthYear=displayedMonthYear();

    // Same explicit-scan behavior as Client 1.
    tableRegistry.clear();
    registryCounter=0;

    if (!monthYear) {
      return {
        selectedDate,
        dateSource:resolved.source,
        tableCount:0,
        challenging:KNOWN_CHALLENGING.map(item=>({
          name:item.name,
          method:item.method,
          found:false,
          selectedDate,
          tableId:null,
          currentCount:null,
          maxOccurrences:null,
          dailyCounts:{},
          currentStates:Array(MAX_CHALLENGING_INTERVALS).fill(""),
          currentAverage:null,
          dailyAverages:{}
        })),
        errorHint:"Could not detect Month/Year on the Office Puzzle page."
      };
    }

    const frequencyTables=collectGraphTables(selectedDate,monthYear);
    const intervalTables=collectPartialIntervalTables(selectedDate,monthYear);
    const challenging=[];

    for (const item of KNOWN_CHALLENGING) {
      const tables=
        item.method==="frequency"
          ? frequencyTables
          : intervalTables;

      // Use the same label -> table mapper as Client 1.
      const matched=graphForBehavior(item.name,tables);

      if (!matched) {
        challenging.push({
          name:item.name,
          method:item.method,
          found:false,
          selectedDate,
          tableId:null,
          currentCount:null,
          maxOccurrences:null,
          dailyCounts:{},
          currentStates:Array(MAX_CHALLENGING_INTERVALS).fill(""),
          currentAverage:null,
          dailyAverages:{}
        });
      } else if (item.method==="frequency") {
        challenging.push({
          name:item.name,
          method:item.method,
          found:true,
          selectedDate,
          tableId:registerTable(matched.table),
          currentCount:matched.inspected.currentCount,
          maxOccurrences:matched.inspected.maxOccurrences,
          dailyCounts:matched.inspected.dailyCounts,
          planningDates:[...(matched.inspected.planningDates || [])]
        });
      } else {
        challenging.push({
          name:item.name,
          method:item.method,
          found:true,
          selectedDate,
          tableId:registerTable(matched.table),
          currentStates:matched.inspected.currentStates,
          currentAverage:matched.inspected.currentAverage,
          dailyAverages:matched.inspected.dailyAverages,
          maxIntervals:matched.inspected.intervalRows.length,
          planningDates:[...(matched.inspected.planningDates || [])]
        });
      }

      await idleYield();
    }

    return {
      selectedDate,
      dateSource:resolved.source,
      frequencyTableCount:frequencyTables.length,
      intervalTableCount:intervalTables.length,
      challenging
    };
  }

  async function scanAllClient2Replacements() {
    const resolved=resolveSelectedDate();
    const selectedDate=resolved.date;
    const monthYear=displayedMonthYear();

    // Same explicit-scan behavior as Client 1 Replacement.
    tableRegistry.clear();
    registryCounter=0;

    if (!monthYear) {
      return {
        selectedDate,
        dateSource:resolved.source,
        tableCount:0,
        replacements:CLIENT2_REPLACEMENTS.map(name=>({
          name,
          method:"percentage_opportunities",
          found:false,
          selectedDate,
          tableId:null,
          currentStates:Array(10).fill(""),
          currentAverage:null,
          dailyAverages:{}
        })),
        errorHint:"Could not detect Month/Year on the Office Puzzle page."
      };
    }

    const tables=collectReplacementTables(selectedDate,monthYear);
    const replacements=[];

    for (const name of CLIENT2_REPLACEMENTS) {
      // Literal same mapper used by Client 1 Replacement scan-all.
      const matched=tableForReplacement(name,tables);

      if (!matched) {
        replacements.push({
          name,
          method:"percentage_opportunities",
          found:false,
          selectedDate,
          tableId:null,
          currentStates:Array(10).fill(""),
          currentAverage:null,
          dailyAverages:{}
        });
      } else {
        replacements.push({
          name,
          method:"percentage_opportunities",
          found:true,
          selectedDate,
          tableId:registerTable(matched.table),
          currentStates:matched.inspected.currentStates,
          currentAverage:matched.inspected.currentAverage,
          dailyAverages:matched.inspected.dailyAverages
        });
      }

      await idleYield();
    }

    return {
      selectedDate,
      dateSource:resolved.source,
      tableCount:tables.length,
      replacements
    };
  }

  async function scanCurrentChallenging() {
    const resolved=resolveSelectedDate();
    const selectedDate=resolved.date;
    const monthYear=displayedMonthYear();
    const rawName=detectCurrentName();
    const name=canonicalChallengingName(rawName);
    const method=detectCollectionMethod();

    if (!name) {
      return {
        selectedDate,
        dateSource:resolved.source,
        found:false,
        name:rawName || "Unknown challenging behavior",
        method,
        errorHint:"The current Office Puzzle Name does not match the configured Client 2 challenging-behavior list."
      };
    }

    if (!monthYear) {
      return {
        selectedDate,
        dateSource:resolved.source,
        found:false,
        name,
        method,
        errorHint:"Could not detect Month/Year."
      };
    }

    if (method==="frequency") {
      const graphs=collectGraphTables(selectedDate,monthYear);
      const graph=graphForBehavior(name,graphs);

      if (!graph) {
        return {
          selectedDate,
          dateSource:resolved.source,
          found:false,
          name,
          method,
          tableCount:graphs.length,
          errorHint:"Could not map the current Frequency table."
        };
      }

      return {
        selectedDate,
        dateSource:resolved.source,
        found:true,
        name,
        method,
        tableId:registerTable(graph.table),
        currentCount:graph.inspected.currentCount,
        maxOccurrences:graph.inspected.maxOccurrences,
        dailyCounts:graph.inspected.dailyCounts,
        planningDates:[...(graph.inspected.planningDates || [])]
      };
    }

    if (method==="partial_interval") {
      const tables=collectPartialIntervalTables(selectedDate,monthYear);
      const matched=graphForBehavior(name,tables);

      if (!matched) {
        return {
          selectedDate,
          dateSource:resolved.source,
          found:false,
          name,
          method,
          tableCount:tables.length,
          errorHint:"Could not map the current Partial Interval table."
        };
      }

      return {
        selectedDate,
        dateSource:resolved.source,
        found:true,
        name,
        method,
        tableId:registerTable(matched.table),
        currentStates:matched.inspected.currentStates,
        currentAverage:matched.inspected.currentAverage,
        dailyAverages:matched.inspected.dailyAverages,
        dailyStates:matched.inspected.dailyStates,
        maxIntervals:matched.inspected.intervalRows.length,
        planningDates:[...(matched.inspected.planningDates || [])]
      };
    }

    return {
      selectedDate,
      dateSource:resolved.source,
      found:false,
      name,
      method,
      errorHint:"Unsupported Collection Method for this Client 2 section."
    };
  }

  function currentChallengingNameMatches(mapping) {
    // Dynamic-client mode: any non-empty exact Office Puzzle program name is
    // allowed. Safety is still table-centric: mapping.tableId identifies the
    // scanned table and graphForBehavior(mapping.name, ...) rebinds that exact
    // visible label after a DOM re-render.
    return !!normalize(mapping?.name);
  }

  function challengingIntervalFromMapping(mapping,forceFresh=false) {
    const selectedDate=mapping?.selectedDate || resolveSelectedDate().date;
    const monthYear=displayedMonthYear();

    if (!selectedDate || !monthYear || !currentChallengingNameMatches(mapping)) {
      return null;
    }

    // Even for a forceFresh writer read, prefer the already-verified table
    // element while it remains connected. "Fresh" means reread the live DOM,
    // not rescan every table on the page. Fall back to a full rebind only if
    // Office Puzzle actually replaced/lost this table.
    let table=mapping?.tableId
      ? tableRegistry.get(mapping.tableId)
      : null;

    if (table && table.isConnected) {
      const inspected=forceFresh
        ? inspectPartialIntervalTableSelectedDateFast(table,selectedDate,monthYear)
        : inspectPartialIntervalTable(table,selectedDate,monthYear);
      if (inspected) return inspected;
    }

    const tables=collectPartialIntervalTables(selectedDate,monthYear);
    const rebound=graphForBehavior(mapping.name,tables);

    if (!rebound?.table || !rebound?.inspected) return null;

    if (mapping.tableId) tableRegistry.set(mapping.tableId,rebound.table);
    else mapping.tableId=registerTable(rebound.table);

    return rebound.inspected;
  }

  function findChallengingIntervalCell(inspected,intervalNumber) {
    const row=inspected?.intervalRows?.find(item=>item.interval===intervalNumber);
    return row?.selectedCell || null;
  }


  async function scanCurrentClient2Replacement() {
    const resolved=resolveSelectedDate();
    const selectedDate=resolved.date;
    const monthYear=displayedMonthYear();
    const rawName=detectCurrentName();
    const name=canonicalClient2ReplacementName(rawName);
    const method=detectCollectionMethod();

    if (!name) {
      return {
        selectedDate,
        dateSource:resolved.source,
        found:false,
        name:rawName || "Unknown replacement",
        method,
        errorHint:"The current Office Puzzle Name does not match the configured Client 2 replacement list."
      };
    }

    if (!monthYear) {
      return {
        selectedDate,
        dateSource:resolved.source,
        found:false,
        name,
        method,
        errorHint:"Could not detect Month/Year."
      };
    }

    const tables=collectReplacementTables(selectedDate,monthYear);
    const matched=tableForReplacement(name,tables);

    if (!matched) {
      return {
        selectedDate,
        dateSource:resolved.source,
        found:false,
        name,
        method:"percentage_opportunities",
        tableCount:tables.length,
        errorHint:"Could not map the current Client 2 Replacement/Skill Acquisition table."
      };
    }

    return {
      selectedDate,
      dateSource:resolved.source,
      found:true,
      name,
      method:"percentage_opportunities",
      tableId:registerTable(matched.table),
      currentStates:matched.inspected.currentStates,
      currentAverage:matched.inspected.currentAverage,
      dailyAverages:matched.inspected.dailyAverages,
      dailyStates:matched.inspected.dailyStates,
      planningDates:[...(matched.inspected.planningDates || [])]
    };
  }

  function currentClient2ReplacementMatches(mapping) {
    // Dynamic-client mode: the program does not need to appear in a compiled
    // list. A non-empty exact Office Puzzle name plus its scanned table mapping
    // is sufficient; tableForReplacement() performs exact-name rebinding.
    return !!normalize(mapping?.name);
  }

  function client2ReplacementFromMapping(mapping,forceFresh=false) {
    const selectedDate=mapping?.selectedDate || resolveSelectedDate().date;
    if (!selectedDate) return null;

    if (!currentClient2ReplacementMatches(mapping)) return null;

    const monthYear=displayedMonthYear();
    if (!monthYear) return null;

    let table=mapping?.tableId
      ? tableRegistry.get(mapping.tableId)
      : null;

    if (table && table.isConnected) {
      const inspected=forceFresh
        ? inspectReplacementTableSelectedDateFast(table,selectedDate,monthYear)
        : inspectReplacementTable(table,selectedDate,monthYear);
      if (inspected) return inspected;
    }

    const tables=collectReplacementTables(selectedDate,monthYear);
    const rebound=tableForReplacement(mapping?.name,tables);

    if (!rebound?.table || !rebound?.inspected) return null;

    if (mapping.tableId) {
      tableRegistry.set(mapping.tableId,rebound.table);
    } else {
      mapping.tableId=registerTable(rebound.table);
    }

    return rebound.inspected;
  }

  function detectCurrentReplacementProgramName() {
    const rows=[...document.querySelectorAll("tr")].filter(isVisible);

    for (const row of rows) {
      const cells=cellsOfRow(row);
      if (cells.length < 2) continue;

      if (normalize(textOf(cells[0])) !== "name") continue;

      const candidate=normalize(textOf(cells[1]));

      for (const name of KNOWN_REPLACEMENTS) {
        const target=normalize(name);

        if (
          candidate === target ||
          candidate.startsWith(target + " ") ||
          candidate.includes(target)
        ) {
          return name;
        }
      }
    }

    return null;
  }

  function findReplacementLabel(programName) {
    const target = normalize(programName);
    const nodes = document.querySelectorAll("td,th,div,span,p,label,strong,b");
    let best = null;
    let bestScore = Infinity;

    for (const el of nodes) {
      if (!isVisible(el)) continue;

      const txt = textOf(el);
      if (!txt || txt.length > 260) continue;

      const n = normalize(txt);
      const exact = n === target;
      const prefixed = n === `name ${target}`;

      if (!exact && !prefixed) continue;

      const score = txt.length + (prefixed ? 20 : 0);

      if (score < bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return best;
  }

  function tableForReplacement(programName, tables) {
    const label = findReplacementLabel(programName);
    if (!label) return null;

    let ancestor = label.parentElement;

    for (let depth = 0; ancestor && depth < 8; depth++, ancestor = ancestor.parentElement) {
      const contained = tables.filter(item => ancestor.contains(item.table));

      if (contained.length === 1) return contained[0];

      if (contained.length > 1) {
        const labelY = label.getBoundingClientRect().top + window.scrollY;

        const below = contained
          .map(item => ({ item, delta:item.top - labelY }))
          .filter(x => x.delta >= -40)
          .sort((a,b) => a.delta - b.delta);

        if (below.length) return below[0].item;
      }
    }

    const labelY = label.getBoundingClientRect().top + window.scrollY;

    const below = tables
      .map(item => ({ item, delta:item.top - labelY }))
      .filter(x => x.delta >= -40)
      .sort((a,b) => a.delta - b.delta);

    if (below.length) return below[0].item;

    return tables
      .map(item => ({ item, delta:Math.abs(item.top - labelY) }))
      .sort((a,b) => a.delta - b.delta)[0]?.item || null;
  }

  async function scanAllBehaviorsLite() {
    const resolved = resolveSelectedDate();
    const selectedDate = resolved.date;
    const monthYear = displayedMonthYear();

    // Reset stale table refs every explicit scan.
    tableRegistry.clear();
    registryCounter = 0;

    if (!monthYear) {
      return {
        selectedDate,
        dateSource:resolved.source,
        graphCount:0,
        errorHint:"Could not detect Month/Year on the Office Puzzle page.",
        behaviors:KNOWN_BEHAVIORS.map(name => ({
          name, found:false, selectedDate, currentCount:null,
          maxOccurrences:null, tableId:null, dailyCounts:{}
        }))
      };
    }

    // One table pass only.
    const graphs = collectGraphTables(selectedDate, monthYear);
    const behaviors = [];

    for (const name of KNOWN_BEHAVIORS) {
      const graph = graphForBehavior(name, graphs);

      if (!graph) {
        behaviors.push({
          name,
          found:false,
          selectedDate,
          currentCount:null,
          maxOccurrences:null,
          tableId:null,
          dailyCounts:{}
        });
      } else {
        behaviors.push({
          name,
          found:true,
          selectedDate,
          currentCount:graph.inspected.currentCount,
          maxOccurrences:graph.inspected.maxOccurrences,
          tableId:registerTable(graph.table),
          dailyCounts:graph.inspected.dailyCounts
        });
      }

      // Keep the page responsive.
      await idleYield();
    }

    return {
      selectedDate,
      dateSource:resolved.source,
      graphCount:graphs.length,
      behaviors
    };
  }

  function graphFromMapping(mapping) {
    const selectedDate = mapping?.selectedDate || resolveSelectedDate().date;
    if (!selectedDate) return null;

    const monthYear = displayedMonthYear();
    if (!monthYear) return null;

    // Fast path: use the previously registered table if Office Puzzle
    // has not replaced it.
    let table = mapping?.tableId ? tableRegistry.get(mapping.tableId) : null;

    if (table && table.isConnected) {
      const inspected = inspectBehaviorTable(table, selectedDate, monthYear);
      if (inspected) return inspected;
    }

    // Office Puzzle commonly re-renders a behavior table after a value is
    // changed. That invalidates the old DOM/table reference. Instead of
    // forcing a full 12-behavior rescan, re-find only this behavior.
    if (!mapping?.name) return null;

    const graphs = collectGraphTables(selectedDate, monthYear);
    const rebound = graphForBehavior(mapping.name, graphs);

    if (!rebound?.table || !rebound?.inspected) return null;

    // Refresh the registry entry. If the old id exists, keep the same id so
    // the side panel's mapping remains valid across Office Puzzle re-renders.
    if (mapping.tableId) {
      tableRegistry.set(mapping.tableId, rebound.table);
    } else {
      mapping.tableId = registerTable(rebound.table);
    }

    return rebound.inspected;
  }


  async function scanAllReplacementsLite() {
    const resolved = resolveSelectedDate();
    const selectedDate = resolved.date;
    const monthYear = displayedMonthYear();

    tableRegistry.clear();
    registryCounter = 0;

    if (!monthYear) {
      return {
        selectedDate,
        dateSource:resolved.source,
        tableCount:0,
        errorHint:"Could not detect Month/Year on the Office Puzzle page.",
        replacements:KNOWN_REPLACEMENTS.map(name => ({
          name,
          found:false,
          selectedDate,
          currentStates:Array(10).fill(""),
          currentAverage:null,
          tableId:null,
          dailyAverages:{}
        }))
      };
    }

    const tables = collectReplacementTables(selectedDate, monthYear);
    const replacements = [];

    for (const name of KNOWN_REPLACEMENTS) {
      const matched = tableForReplacement(name, tables);

      if (!matched) {
        replacements.push({
          name,
          found:false,
          selectedDate,
          currentStates:Array(10).fill(""),
          currentAverage:null,
          tableId:null,
          dailyAverages:{}
        });
      } else {
        replacements.push({
          name,
          found:true,
          selectedDate,
          currentStates:matched.inspected.currentStates,
          currentAverage:matched.inspected.currentAverage,
          tableId:registerTable(matched.table),
          dailyAverages:matched.inspected.dailyAverages
        });
      }

      await idleYield();
    }

    return {
      selectedDate,
      dateSource:resolved.source,
      tableCount:tables.length,
      replacements
    };
  }

  function replacementFromMapping(mapping, forceFresh=false) {
    const selectedDate=mapping?.selectedDate || resolveSelectedDate().date;
    if (!selectedDate) return null;

    const monthYear=displayedMonthYear();
    if (!monthYear) return null;

    // If Office Puzzle exposes exactly one active program in the Name header,
    // never allow a mapping for a different program to write to that table.
    const currentProgram=detectCurrentReplacementProgramName();

    if (
      currentProgram &&
      mapping?.name &&
      normalize(currentProgram) !== normalize(mapping.name)
    ) {
      return null;
    }

    let table=mapping?.tableId
      ? tableRegistry.get(mapping.tableId)
      : null;

    if (table && table.isConnected) {
      const inspected=forceFresh
        ? inspectReplacementTableSelectedDateFast(table,selectedDate,monthYear)
        : inspectReplacementTable(table,selectedDate,monthYear);
      if (inspected) return inspected;
    }

    if (!mapping?.name) return null;

    // Fresh lookup of visible replacement tables. This handles Office Puzzle
    // replacing the table after a click or after navigating to another program.
    const tables=collectReplacementTables(selectedDate,monthYear);
    const rebound=tableForReplacement(mapping.name,tables);

    if (!rebound?.table || !rebound?.inspected) return null;

    if (mapping.tableId) {
      tableRegistry.set(mapping.tableId,rebound.table);
    } else {
      mapping.tableId=registerTable(rebound.table);
    }

    return rebound.inspected;
  }


  function clickReplacementTrialCellSingleRequest(cell) {
    if (!cell || !cell.isConnected) {
      throw new Error("Trial cell is no longer attached to the page.");
    }

    cell.scrollIntoView({
      block:"center",
      inline:"center",
      behavior:"auto"
    });

    const rect=cell.getBoundingClientRect();
    const clientX=rect.left + rect.width / 2;
    const clientY=rect.top + rect.height / 2;

    const hit=document.elementFromPoint(
      clientX,
      clientY
    );

    const target=
      (hit && cell.contains(hit))
        ? hit
        : cell;

    // Native blank-day initialization is a single Office Puzzle save request.
    // Do not synthesize pointerdown/mousedown/pointerup/mouseup here: Office
    // Puzzle can attach save behavior to more than one event path and reject
    // the result as a duplicate request. One click event = one initializer.
    target.dispatchEvent(
      new MouseEvent("click",{
        bubbles:true,
        cancelable:true,
        composed:true,
        view:window,
        clientX,
        clientY,
        screenX:window.screenX + clientX,
        screenY:window.screenY + clientY,
        button:0,
        buttons:0,
        detail:1
      })
    );
  }

  function officePuzzleDuplicateRequestVisible() {
    const selectors=[
      '[role="alert"]',
      '.alert',
      '.toast',
      '.notification',
      '.swal2-popup',
      '.modal',
      '.modal-content'
    ];

    const nodes=[
      ...document.querySelectorAll(
        selectors.join(",")
      )
    ];

    return nodes.some(node=>
      /duplicate\s+request/i.test(
        String(node.textContent || "")
      )
    );
  }

  function clickReplacementTrialCell(cell) {
    if (!cell || !cell.isConnected) {
      throw new Error("Trial cell is no longer attached to the page.");
    }

    cell.scrollIntoView({
      block:"center",
      inline:"center",
      behavior:"auto"
    });

    const rect=cell.getBoundingClientRect();
    const clientX=rect.left + rect.width / 2;
    const clientY=rect.top + rect.height / 2;

    // Target the element actually under the center of the TD. If Office Puzzle
    // places a clickable child inside the cell, this avoids dispatching only to
    // the outer TD.
    const hit=document.elementFromPoint(clientX,clientY);
    const target=(hit && cell.contains(hit)) ? hit : cell;

    const common={
      bubbles:true,
      cancelable:true,
      composed:true,
      view:window,
      clientX,
      clientY,
      screenX:window.screenX + clientX,
      screenY:window.screenY + clientY,
      button:0,
      buttons:1
    };

    // One complete user-style interaction. This is ONE logical click/transition.
    try {
      target.dispatchEvent(new PointerEvent("pointerdown",{
        ...common,
        pointerId:1,
        pointerType:"mouse",
        isPrimary:true
      }));
    } catch (_) {}

    target.dispatchEvent(new MouseEvent("mousedown",common));

    try {
      target.dispatchEvent(new PointerEvent("pointerup",{
        ...common,
        buttons:0,
        pointerId:1,
        pointerType:"mouse",
        isPrimary:true
      }));
    } catch (_) {}

    target.dispatchEvent(new MouseEvent("mouseup",{
      ...common,
      buttons:0
    }));

    target.dispatchEvent(new MouseEvent("click",{
      ...common,
      buttons:0,
      detail:1
    }));
  }

  function replacementCellOutcomeSignature(cell) {
    if (!cell) return "";

    const parts=[];

    function safeAttr(node,name) {
      try { return node.getAttribute?.(name) || ""; }
      catch (_) { return ""; }
    }

    function addNode(node,prefix) {
      if (!node) return;

      parts.push([
        prefix,
        node.tagName || "",
        node.innerHTML || "",
        node.textContent || "",
        safeAttr(node,"class"),
        safeAttr(node,"value"),
        safeAttr(node,"data-value"),
        safeAttr(node,"data-state"),
        safeAttr(node,"data-status"),
        safeAttr(node,"data-response"),
        safeAttr(node,"data-icon"),
        safeAttr(node,"aria-label"),
        safeAttr(node,"title"),
        safeAttr(node,"href"),
        safeAttr(node,"xlink:href")
      ].join("~"));

      try {
        for (const pseudo of ["::before","::after"]) {
          const ps=getComputedStyle(node,pseudo);

          parts.push([
            prefix+pseudo,
            ps.content || "",
            ps.backgroundImage || "",
            ps.display || "",
            ps.visibility || ""
          ].join("~"));
        }
      } catch (_) {}
    }

    addNode(cell,"cell");

    [...cell.querySelectorAll("*")]
      .slice(0,30)
      .forEach((node,index)=>addNode(node,`child${index}`));

    return parts.join("|||");
  }

  function replacementCellVisualSignature(cell) {
    if (!cell) return "";

    const parts=[];

    function addNode(node,prefix) {
      if (!node) return;

      const style=getComputedStyle(node);

      parts.push([
        prefix,
        node.tagName || "",
        node.innerHTML || "",
        node.textContent || "",
        node.getAttribute?.("class") || "",
        node.getAttribute?.("style") || "",
        node.getAttribute?.("value") || "",
        node.getAttribute?.("data-value") || "",
        node.getAttribute?.("data-state") || "",
        node.getAttribute?.("data-status") || "",
        node.getAttribute?.("aria-label") || "",
        node.getAttribute?.("title") || "",
        style.color || "",
        style.backgroundColor || "",
        style.backgroundImage || "",
        style.borderColor || "",
        style.opacity || "",
        style.visibility || ""
      ].join("~"));

      try {
        for (const pseudo of ["::before","::after"]) {
          const ps=getComputedStyle(node,pseudo);

          parts.push([
            prefix+pseudo,
            ps.content || "",
            ps.color || "",
            ps.backgroundColor || "",
            ps.backgroundImage || "",
            ps.display || "",
            ps.opacity || ""
          ].join("~"));
        }
      } catch (_) {}
    }

    addNode(cell,"cell");

    const descendants=[...cell.querySelectorAll("*")].slice(0,20);
    descendants.forEach((node,index)=>addNode(node,`child${index}`));

    return parts.join("|||");
  }

  function findReplacementTrialCell(inspected, trialNumber) {
    if (!inspected) return null;

    const row=inspected.trialRows.find(item => item.trial === trialNumber);
    return row?.selectedCell || null;
  }

  async function waitForReplacementFinal(mapping, desiredStates, expectedAverage, timeoutMs=6000) {
    const started=Date.now();
    let last=null;

    while (Date.now() - started < timeoutMs) {
      const inspected=replacementFromMapping(mapping,true);

      if (inspected) {
        last=inspected;

        const states=inspected.currentStates || [];
        const statesMatch=
          states.length === 10 &&
          states.every((state,index) => state === desiredStates[index]);

        const avgMatch=
          inspected.currentAverage != null &&
          Number(inspected.currentAverage) === Number(expectedAverage);

        if (statesMatch && avgMatch) {
          return {
            ok:true,
            inspected
          };
        }
      }

      await sleep(60);
    }

    return {
      ok:false,
      inspected:last
    };
  }


  function numericOfficePuzzleAverage(inspected) {
    if (
      !inspected ||
      inspected.currentAverage==null ||
      inspected.currentAverage===""
    ) return null;

    const value=Number(inspected.currentAverage);
    return Number.isFinite(value) ? value : null;
  }


  function adaptiveStateFingerprint(cell) {
    if (!cell) return "";

    const parts=[];

    function normalizedClass(value) {
      return String(value || "")
        .split(/\s+/)
        .filter(Boolean)
        .map(token=>token.replace(/\d{2,}/g,"#"))
        .sort()
        .join(".");
    }

    function addNode(node,prefix) {
      if (!node) return;

      let style=null;
      try { style=getComputedStyle(node); }
      catch (_) {}

      const rect=node.getBoundingClientRect?.();

      parts.push([
        prefix,
        node.tagName || "",
        normalizedClass(node.getAttribute?.("class")),
        String(node.getAttribute?.("data-value") || ""),
        String(node.getAttribute?.("data-state") || ""),
        String(node.getAttribute?.("data-status") || ""),
        String(node.getAttribute?.("data-response") || ""),
        String(node.getAttribute?.("data-icon") || ""),
        String(node.getAttribute?.("aria-label") || ""),
        String(node.getAttribute?.("title") || ""),
        style?.color || "",
        style?.backgroundColor || "",
        style?.backgroundImage || "",
        style?.fontFamily || "",
        style?.fontWeight || "",
        rect ? Math.round(rect.width*10)/10 : "",
        rect ? Math.round(rect.height*10)/10 : ""
      ].join("~"));

      try {
        for (const pseudo of ["::before","::after"]) {
          const ps=getComputedStyle(node,pseudo);

          parts.push([
            prefix+pseudo,
            ps.content || "",
            ps.color || "",
            ps.backgroundColor || "",
            ps.backgroundImage || "",
            ps.fontFamily || "",
            ps.display || "",
            ps.visibility || ""
          ].join("~"));
        }
      } catch (_) {}
    }

    addNode(cell,"cell");

    [...cell.querySelectorAll("*")]
      .slice(0,20)
      .forEach((node,index)=>addNode(node,`child${index}`));

    return parts.join("|||");
  }

  function learnAdaptiveStateFingerprint(model,fingerprint,state) {
    if (
      !model ||
      !fingerprint ||
      !["+", "-", ""].includes(state)
    ) return;

    const existing=model.fingerprintStates[fingerprint];

    if (existing==null || existing===state) {
      model.fingerprintStates[fingerprint]=state;
      return;
    }

    delete model.fingerprintStates[fingerprint];
    model.ambiguousFingerprints.add(fingerprint);
  }

  function inferAdaptiveReplacementColumn(inspected,count,cellFinder) {
    const model={
      states:Array(count).fill(null),
      fingerprints:Array(count).fill(""),
      fingerprintStates:{},
      ambiguousFingerprints:new Set(),
      average:numericOfficePuzzleAverage(inspected),
      inferredFromAverage:false,
      unresolvedIndexes:[]
    };

    for (let index=0; index<count; index++) {
      const cell=cellFinder(inspected,index+1);
      const fingerprint=adaptiveStateFingerprint(cell);

      model.fingerprints[index]=fingerprint;

      const direct=trialCellState(cell);
      let state=null;

      if (direct==="+" || direct==="-") {
        state=direct;
      } else if (adaptiveCellLooksBlank(cell)) {
        state="";
      }

      if (state!==null) {
        model.states[index]=state;
        learnAdaptiveStateFingerprint(model,fingerprint,state);
      }
    }

    for (let index=0; index<count; index++) {
      if (model.states[index]!==null) continue;

      const modeled=model.fingerprintStates[model.fingerprints[index]];
      if (modeled!=null) model.states[index]=modeled;
    }

    const unresolved=model.states
      .map((state,index)=>state===null ? index : -1)
      .filter(index=>index>=0);

    const average=Number(model.average);
    const expectedPlus=Number.isFinite(average)
      ? Math.round(average/10)
      : null;

    const validAverage=
      expectedPlus!=null &&
      expectedPlus>=0 &&
      expectedPlus<=count &&
      Math.abs(average-(expectedPlus*10))<0.01;

    if (unresolved.length && validAverage) {
      const knownBlank=model.states.filter(state=>state==="").length;

      if (knownBlank===0) {
        const knownPlus=model.states.filter(state=>state==="+").length;
        const neededPlus=expectedPlus-knownPlus;

        const groups=new Map();

        unresolved.forEach(index=>{
          const fingerprint=model.fingerprints[index];
          if (!groups.has(fingerprint)) groups.set(fingerprint,[]);
          groups.get(fingerprint).push(index);
        });

        const entries=[...groups.entries()];
        const solutions=[];

        if (neededPlus>=0 && entries.length<=10) {
          const totalMasks=1<<entries.length;

          for (let mask=0; mask<totalMasks; mask++) {
            let size=0;
            const plusFingerprints=[];

            for (let bit=0; bit<entries.length; bit++) {
              if (mask & (1<<bit)) {
                size+=entries[bit][1].length;
                plusFingerprints.push(entries[bit][0]);
              }
            }

            if (size===neededPlus) {
              solutions.push(new Set(plusFingerprints));
            }
          }
        }

        if (solutions.length===1) {
          const plusSet=solutions[0];

          for (const [fingerprint,indexes] of entries) {
            const state=plusSet.has(fingerprint) ? "+" : "-";

            indexes.forEach(index=>{
              model.states[index]=state;
            });

            learnAdaptiveStateFingerprint(
              model,
              fingerprint,
              state
            );
          }

          model.inferredFromAverage=true;
        }
      }
    }

    model.unresolvedIndexes=model.states
      .map((state,index)=>state===null ? index : -1)
      .filter(index=>index>=0);

    return model;
  }


  function inferAdaptivePartialIntervalColumn(inspected,count,cellFinder) {
    const model={
      states:Array(count).fill(null),
      fingerprints:Array(count).fill(""),
      fingerprintStates:{},
      ambiguousFingerprints:new Set(),
      average:numericOfficePuzzleAverage(inspected),
      inferredFromAverage:false,
      unresolvedIndexes:[]
    };

    for (let index=0; index<count; index++) {
      const cell=cellFinder(inspected,index+1);
      const fingerprint=adaptiveStateFingerprint(cell);
      model.fingerprints[index]=fingerprint;

      const direct=trialCellState(cell);
      let state=null;

      if (direct==="+" || direct==="-") state=direct;
      else if (adaptiveCellLooksBlank(cell)) state="";

      if (state!==null) {
        model.states[index]=state;
        learnAdaptiveStateFingerprint(model,fingerprint,state);
      }
    }

    // Reuse visual fingerprints learned from the same live column. Office
    // Puzzle sometimes renders the symbol through CSS/framework markup rather
    // than literal text, but + / - / blank cells still share stable visual
    // fingerprints with their neighbors.
    for (let index=0; index<count; index++) {
      if (model.states[index]!==null) continue;
      const fingerprint=model.fingerprints[index];
      const modeled=
        fingerprint && !model.ambiguousFingerprints.has(fingerprint)
          ? model.fingerprintStates[fingerprint]
          : null;
      if (modeled==="+" || modeled==="-" || modeled==="") {
        model.states[index]=modeled;
      }
    }

    // If a few cells remain visually ambiguous, use Office Puzzle's own Daily
    // average only as a constrained tie-breaker. Blank rows already identified
    // above are excluded from the denominator; unresolved rows are treated as
    // populated because a truly blank visual fingerprint would have been
    // learned from another blank row in the same column. We only accept an
    // assignment when there is exactly one fingerprint-group solution.
    const unresolved=model.states
      .map((state,index)=>state===null ? index : -1)
      .filter(index=>index>=0);

    const average=Number(model.average);
    const knownBlank=model.states.filter(state=>state==="").length;
    const populatedCount=count-knownBlank;
    const expectedPlus=
      Number.isFinite(average) && populatedCount>0
        ? Math.round((average/100)*populatedCount)
        : null;

    const impliedAverage=
      expectedPlus!=null && populatedCount>0
        ? (expectedPlus/populatedCount)*100
        : null;

    const validAverage=
      expectedPlus!=null &&
      expectedPlus>=0 &&
      expectedPlus<=populatedCount &&
      impliedAverage!=null &&
      Math.abs(impliedAverage-average)<=0.12;

    if (unresolved.length && validAverage) {
      const knownPlus=model.states.filter(state=>state==="+").length;
      const neededPlus=expectedPlus-knownPlus;
      const groups=new Map();

      unresolved.forEach(index=>{
        const fingerprint=model.fingerprints[index] || `index:${index}`;
        if (!groups.has(fingerprint)) groups.set(fingerprint,[]);
        groups.get(fingerprint).push(index);
      });

      const entries=[...groups.entries()];
      const solutions=[];

      if (neededPlus>=0 && entries.length<=12) {
        const totalMasks=1<<entries.length;
        for (let mask=0; mask<totalMasks; mask++) {
          let size=0;
          const plusFingerprints=[];
          for (let bit=0; bit<entries.length; bit++) {
            if (mask & (1<<bit)) {
              size+=entries[bit][1].length;
              plusFingerprints.push(entries[bit][0]);
            }
          }
          if (size===neededPlus) solutions.push(new Set(plusFingerprints));
          if (solutions.length>1) break;
        }
      }

      if (solutions.length===1) {
        const plusSet=solutions[0];
        for (const [fingerprint,indexes] of entries) {
          const state=plusSet.has(fingerprint) ? "+" : "-";
          indexes.forEach(index=>{ model.states[index]=state; });
          learnAdaptiveStateFingerprint(model,fingerprint,state);
        }
        model.inferredFromAverage=true;
      }
    }

    model.unresolvedIndexes=model.states
      .map((state,index)=>state===null ? index : -1)
      .filter(index=>index>=0);

    return model;
  }

function adaptiveCellSnapshot(inspected,count,cellFinder) {
    const states=[];
    const visualSignatures=[];
    const outcomeSignatures=[];
    const stateFingerprints=[];

    for (let index=0; index<count; index++) {
      const cell=cellFinder(inspected,index+1);

      states.push(trialCellState(cell) || "");
      visualSignatures.push(replacementCellVisualSignature(cell));
      outcomeSignatures.push(replacementCellOutcomeSignature(cell));
      stateFingerprints.push(adaptiveStateFingerprint(cell));
    }

    return {
      states,
      visualSignatures,
      outcomeSignatures,
      stateFingerprints,
      average:numericOfficePuzzleAverage(inspected)
    };
  }

  function adaptiveSnapshotChanged(before,after) {
    if (!before || !after) return false;

    if (before.average!==after.average) return true;

    const count=Math.max(
      before.outcomeSignatures?.length || 0,
      after.outcomeSignatures?.length || 0
    );

    for (let index=0; index<count; index++) {
      if (before.states?.[index]!==after.states?.[index]) return true;
      if (before.outcomeSignatures?.[index]!==after.outcomeSignatures?.[index]) return true;
      if (before.visualSignatures?.[index]!==after.visualSignatures?.[index]) return true;
    }

    return false;
  }

function adaptiveKnownState({
    cell=null,
    readable=null,
    outcomeSignature=null,
    blankBaseline=null,
    beforeState=null,
    beforeOutcomeSignature="",
    mode="",
    stateModel=null,
    stateFingerprint=null
  }) {
    const direct=readable ?? trialCellState(cell);

    if (direct==="+" || direct==="-") return direct;

    const fingerprint=
      stateFingerprint ||
      (cell ? adaptiveStateFingerprint(cell) : "");

    const modeled=
      fingerprint &&
      stateModel &&
      !stateModel.ambiguousFingerprints?.has(fingerprint)
        ? stateModel.fingerprintStates?.[fingerprint]
        : null;

    if (
      modeled==="+" ||
      modeled==="-" ||
      modeled===""
    ) return modeled;

    if (
      blankBaseline!=null &&
      outcomeSignature===blankBaseline
    ) {
      return "";
    }

    if (cell && adaptiveCellLooksBlank(cell)) {
      return "";
    }

    // Office Puzzle's +/- cells cycle + -> blank -> - -> +. During the
    // + -> blank transition the blank cell can briefly retain decorative DOM
    // that makes adaptiveCellLooksBlank() inconclusive even though the click
    // definitely changed the cell. Replacements already relied on this
    // signature-backed blank inference; Partial Interval uses the same cell
    // control/cycle, so apply the identical rule there too. We only infer
    // blank after a known + state AND a confirmed outcome-signature change;
    // this never turns an unchanged/unknown cell into a blind second click.
    if (
      (mode==="replacement" || mode==="partial_interval") &&
      beforeState==="+" &&
      beforeOutcomeSignature &&
      outcomeSignature &&
      outcomeSignature!==beforeOutcomeSignature &&
      !direct
    ) {
      return "";
    }

    return null;
  }

  function adaptiveCellLooksBlank(cell) {
    if (!cell) return false;
    if (trialCellState(cell)) return false;

    const visibleText=String(cell.innerText || "")
      .replace(/\s+/g,"")
      .trim();

    const rawText=String(cell.textContent || "")
      .replace(/\s+/g,"")
      .trim();

    if (visibleText || rawText) return false;

    const nodes=[cell,...cell.querySelectorAll("*")].slice(0,50);

    for (const node of nodes) {
      if ("value" in node && String(node.value ?? "").trim()) {
        return false;
      }

      for (const attr of [
        "value",
        "data-value",
        "data-state",
        "data-status",
        "data-response",
        "data-icon"
      ]) {
        if (String(node.getAttribute?.(attr) || "").trim()) {
          return false;
        }
      }

      try {
        const style=getComputedStyle(node);
        if (
          style.backgroundImage &&
          style.backgroundImage!=="none"
        ) {
          return false;
        }

        for (const pseudo of ["::before","::after"]) {
          const raw=String(getComputedStyle(node,pseudo).content || "")
            .replace(/^[\"']|[\"']$/g,"")
            .trim();

          if (raw && raw!=="none") {
            return false;
          }
        }
      } catch (_) {}
    }

    return true;
  }

  function nextReplacementCellState(state) {
    if (state==="+") return "";
    if (state==="") return "-";
    if (state==="-") return "+";
    return null;
  }

  function adaptiveStateLabel(state) {
    if (state==="") return "blank";
    if (state==="+" || state==="-") return state;
    return "unknown";
  }

function classifyAdaptiveTransition({
    mode,
    cell,
    readable,
    beforeState,
    beforeOutcomeSignature,
    afterOutcomeSignature,
    blankBaseline=null,
    stateModel=null,
    stateFingerprint=null
  }) {
    const state=adaptiveKnownState({
      cell,
      readable,
      outcomeSignature:afterOutcomeSignature,
      blankBaseline,
      beforeState,
      beforeOutcomeSignature,
      mode,
      stateModel,
      stateFingerprint
    });

    const expected=
      (mode==="replacement" || mode==="partial_interval")
        ? nextReplacementCellState(beforeState)
        : null;

    return {
      state,
      expected,
      matchesExpected:
        expected==null ||
        state==null ||
        state===expected
    };
  }

  async function waitForAdaptiveColumnChange({
    mapping,
    inspect,
    count,
    cellFinder,
    beforeSnapshot,
    timeoutMs=5000
  }) {
    const started=Date.now();
    let lastFingerprint="";
    let stablePasses=0;
    let lastInspected=null;
    let lastSnapshot=null;

    while (Date.now()-started<timeoutMs) {
      if (activeWriteWasAborted()) {
        return {ok:false,aborted:true};
      }

      const inspected=inspect(mapping,true);

      if (inspected) {
        const snapshot=adaptiveCellSnapshot(inspected,count,cellFinder);
        lastInspected=inspected;
        lastSnapshot=snapshot;

        if (adaptiveSnapshotChanged(beforeSnapshot,snapshot)) {
          const fingerprint=JSON.stringify({
            states:snapshot.states,
            outcomes:snapshot.outcomeSignatures,
            average:snapshot.average
          });

          if (fingerprint===lastFingerprint) stablePasses++;
          else {
            lastFingerprint=fingerprint;
            stablePasses=1;
          }

          if (stablePasses>=2) {
            return {ok:true,inspected,snapshot};
          }
        }
      }

      await sleep(60);
    }

    return {ok:false,inspected:lastInspected,snapshot:lastSnapshot};
  }

async function waitForAdaptiveCellTransition({
    mapping,
    inspect,
    cellFinder,
    index,
    mode,
    beforeState=null,
    beforeVisualSignature="",
    beforeOutcomeSignature="",
    blankBaseline=null,
    stateModel=null,
    timeoutMs=5000
  }) {
    const number=index+1;
    const started=Date.now();
    let candidateKey="";
    let candidatePasses=0;
    let last=null;

    while (Date.now()-started<timeoutMs) {
      if (activeWriteWasAborted()) {
        return {ok:false,aborted:true};
      }

      const inspected=inspect(mapping,true);

      if (inspected) {
        const cell=cellFinder(inspected,number);

        if (cell) {
          const readable=trialCellState(cell) || "";
          const visualSignature=replacementCellVisualSignature(cell);
          const outcomeSignature=replacementCellOutcomeSignature(cell);
          const stateFingerprint=adaptiveStateFingerprint(cell);

          const changed=
            visualSignature!==beforeVisualSignature ||
            outcomeSignature!==beforeOutcomeSignature;

          if (changed) {
            const classified=classifyAdaptiveTransition({
              mode,
              cell,
              readable,
              beforeState,
              beforeOutcomeSignature,
              afterOutcomeSignature:outcomeSignature,
              blankBaseline,
              stateModel,
              stateFingerprint
            });

            last={
              inspected,
              state:classified.state,
              expected:classified.expected,
              readable,
              visualSignature,
              outcomeSignature,
              stateFingerprint,
              average:numericOfficePuzzleAverage(inspected)
            };

            if (classified.state!==null) {
              const key=JSON.stringify({
                state:classified.state,
                stateFingerprint,
                outcomeSignature
              });

              if (key===candidateKey) candidatePasses++;
              else {
                candidateKey=key;
                candidatePasses=1;
              }

              if (candidatePasses>=2) {
                const cycleMode=
                  mode==="replacement" ||
                  mode==="partial_interval";

                // During an Office Puzzle re-render we can briefly observe the
                // old state with a new framework signature. For the known
                // + -> blank -> - -> + controls, keep waiting rather than
                // turning that transient frame into a hard failure.
                if (
                  cycleMode &&
                  beforeState!==null &&
                  classified.state===beforeState
                ) {
                  candidateKey="";
                  candidatePasses=0;
                  await sleep(45);
                  continue;
                }

                if (!classified.matchesExpected) {
                  return {ok:false,unexpected:true,...last};
                }

                if (
                  !cycleMode &&
                  beforeState!==null &&
                  classified.state===beforeState
                ) {
                  return {ok:false,unchangedState:true,...last};
                }

                learnAdaptiveStateFingerprint(
                  stateModel,
                  stateFingerprint,
                  classified.state
                );

                return {ok:true,...last};
              }
            }
          }
        }
      }

      await sleep(60);
    }

    return {ok:false,...(last || {})};
  }

function selectedMappingDateIsWritable(mapping) {
    const selectedDate=String(mapping?.selectedDate || "");
    if(!validISODateLike(selectedDate)) return false;

    const table=mapping?.tableId ? tableRegistry.get(mapping.tableId) : null;
    if(!table?.isConnected) return false;

    const daysRow=findDaysRow(table);
    if(!daysRow) return false;

    const dates=mapDaysRowDates(daysRow,displayedMonthYear());
    return writableDatesForTable(table,daysRow,dates).includes(selectedDate);
  }

  function unavailableDateWriteResult(mapping) {
    return {
      ok:false,
      verified:false,
      unavailableDate:true,
      error:
        `Office Puzzle shows ${mapping?.selectedDate || "this date"} as unavailable for recording. ` +
        "No data was written. Choose an enabled date column."
    };
  }

async function runAdaptiveReplacementTrials(mapping,desiredStates,config) {
    const {
      label,
      inspect,
      nativeInitSaveSettleMs,
      transitionSaveSettleMs,
      nextTrialSettleMs
    }=config;

    let inspected=inspect(mapping,true);

    if (!inspected) {
      return {
        ok:false,
        error:`Could not locate the ${mapping?.name || label} table.`
      };
    }

    if(!selectedMappingDateIsWritable(mapping)) {
      return unavailableDateWriteResult(mapping);
    }

    let snapshot=adaptiveCellSnapshot(
      inspected,
      10,
      findReplacementTrialCell
    );

    let clicksMade=0;

    const freshBlank=
      snapshot.average==null &&
      snapshot.states.every(state=>state==="");

    const blankBaselines=freshBlank
      ? [...snapshot.outcomeSignatures]
      : null;

    if (
      snapshot.states.every(state=>state==="") &&
      snapshot.average==null
    ) {
      const initCell=findReplacementTrialCell(inspected,1);

      if (!initCell) {
        return {
          ok:false,
          error:`Could not locate Trial 1 to start today's ${label} column.`,
          clicksMade
        };
      }

      try {
        clickReplacementTrialCellSingleRequest(initCell);
      } catch (err) {
        return {
          ok:false,
          error:String(err?.message || err),
          clicksMade
        };
      }

      clicksMade++;

      const initialized=await waitForAdaptiveColumnChange({
        mapping,
        inspect,
        count:10,
        cellFinder:findReplacementTrialCell,
        beforeSnapshot:snapshot,
        timeoutMs:5000
      });

      if (initialized.aborted) return abortedWriteResult(label);

      if (!initialized.ok) {
        const duplicate=officePuzzleDuplicateRequestVisible();

        return {
          ok:false,
          error:duplicate
            ? "Office Puzzle reported a duplicate request while starting this date. Only one initialization click was sent. Refresh Office Puzzle, then press Retry."
            : "Office Puzzle did not confirm a column change after the first click. No later trials were touched. Refresh Office Puzzle, then press Retry.",
          clicksMade
        };
      }

      await waitForOfficePuzzleQuiet({
        quietMs:100,
        minMs:55,
        maxMs:nativeInitSaveSettleMs,
        root:quietRootForMapping(mapping)
      });

      inspected=inspect(mapping,true) || initialized.inspected;
      snapshot=adaptiveCellSnapshot(
        inspected,
        10,
        findReplacementTrialCell
      );
    }

    let stateModel=inferAdaptiveReplacementColumn(
      inspected,
      10,
      findReplacementTrialCell
    );

    const logicalStates=Array(10).fill(null);
    const logicalOutcomeSignatures=Array(10).fill("");

    for (let index=0; index<10; index++) {
      const cell=findReplacementTrialCell(inspected,index+1);
      const outcomeSignature=replacementCellOutcomeSignature(cell);
      const stateFingerprint=adaptiveStateFingerprint(cell);

      const state=
        stateModel.states[index] ??
        adaptiveKnownState({
          cell,
          readable:trialCellState(cell) || "",
          outcomeSignature,
          blankBaseline:blankBaselines?.[index] ?? null,
          mode:"replacement",
          stateModel,
          stateFingerprint
        });

      if (state!==null) {
        logicalStates[index]=state;
        logicalOutcomeSignatures[index]=outcomeSignature;

        learnAdaptiveStateFingerprint(
          stateModel,
          stateFingerprint,
          state
        );
      }
    }

    for (let index=0; index<10; index++) {
      const trialNumber=index+1;
      const desired=desiredStates[index];
      let clickAttempts=0;

      while (clickAttempts<2) {
        if (activeWriteWasAborted()) {
          return abortedWriteResult(label);
        }

        inspected=inspect(mapping,true);

        if (!inspected) {
          return {
            ok:false,
            error:`Lost the ${mapping.name} table before Trial ${trialNumber}.`,
            clicksMade
          };
        }

        const cell=findReplacementTrialCell(inspected,trialNumber);

        if (!cell) {
          return {
            ok:false,
            error:`Could not locate Trial ${trialNumber} in today's date column.`,
            clicksMade
          };
        }

        const readable=trialCellState(cell) || "";
        const outcomeSignature=replacementCellOutcomeSignature(cell);
        const stateFingerprint=adaptiveStateFingerprint(cell);

        let observed=adaptiveKnownState({
          cell,
          readable,
          outcomeSignature,
          blankBaseline:blankBaselines?.[index] ?? null,
          beforeState:logicalStates[index],
          beforeOutcomeSignature:logicalOutcomeSignatures[index],
          mode:"replacement",
          stateModel,
          stateFingerprint
        });

        if (observed===null) {
          stateModel=inferAdaptiveReplacementColumn(
            inspected,
            10,
            findReplacementTrialCell
          );

          observed=stateModel.states[index];
        }

        if (observed!==null) {
          logicalStates[index]=observed;
          logicalOutcomeSignatures[index]=outcomeSignature;

          learnAdaptiveStateFingerprint(
            stateModel,
            stateFingerprint,
            observed
          );
        } else {
          const average=numericOfficePuzzleAverage(inspected);

          return {
            ok:false,
            error:
              `Stopped before Trial ${trialNumber}: Office Puzzle is showing the column, but this cell's visual state is still ambiguous` +
              `${average==null ? "" : ` (Daily average ${average}%)`}. ` +
              "No click was sent. Refresh Office Puzzle, then press Retry.",
            clicksMade
          };
        }

        if (logicalStates[index]===desired) break;

        const beforeState=logicalStates[index];
        const expected=nextReplacementCellState(beforeState);

        if (expected===null) {
          return {
            ok:false,
            error:`Stopped before Trial ${trialNumber}: the current cell state is unknown. No click was sent.`,
            clicksMade
          };
        }

        const beforeVisualSignature=replacementCellVisualSignature(cell);
        const beforeOutcomeSignature=outcomeSignature;

        try {
          clickReplacementTrialCell(cell);
        } catch (err) {
          return {
            ok:false,
            error:String(err?.message || err),
            clicksMade
          };
        }

        clicksMade++;
        clickAttempts++;

        const transition=await waitForAdaptiveCellTransition({
          mapping,
          inspect,
          cellFinder:findReplacementTrialCell,
          index,
          mode:"replacement",
          beforeState,
          beforeVisualSignature,
          beforeOutcomeSignature,
          blankBaseline:blankBaselines?.[index] ?? null,
          stateModel,
          timeoutMs:5000
        });

        if (transition.aborted) return abortedWriteResult(label);

        if (transition.unexpected) {
          return {
            ok:false,
            error:
              `Stopped at Trial ${trialNumber}: after one click, Office Puzzle should have moved ${adaptiveStateLabel(beforeState)} → ${adaptiveStateLabel(expected)}, but the observed cell became ${adaptiveStateLabel(transition.state)}. No second click was sent. Check Office Puzzle, then press Retry.`,
            clicksMade
          };
        }

        if (!transition.ok || transition.state===null) {
          return {
            ok:false,
            error:
              `Stopped at Trial ${trialNumber}: the target cell changed, but its new state could not be verified. No second click was sent. Check Office Puzzle, then press Retry.`,
            clicksMade
          };
        }

        logicalStates[index]=transition.state;
        logicalOutcomeSignatures[index]=transition.outcomeSignature;

        await waitForOfficePuzzleQuiet({
          quietMs:85,
          minMs:45,
          maxMs:transitionSaveSettleMs,
          root:quietRootForMapping(mapping)
        });
      }

      if (logicalStates[index]!==desired) {
        return {
          ok:false,
          error:
            `Stopped at Trial ${trialNumber}: the reviewed ${desired} state was not reached after the maximum two observed transitions. No later trials were touched.`,
          clicksMade
        };
      }

      await sleep(nextTrialSettleMs);
    }

    const expectedAverage=
      desiredStates.filter(state=>state==="+").length*10;

    const finalStarted=Date.now();
    let finalInspected=null;

    while (Date.now()-finalStarted<6000) {
      if (activeWriteWasAborted()) {
        return abortedWriteResult(label);
      }

      finalInspected=inspect(mapping,true);

      if (
        finalInspected?.currentAverage!=null &&
        Number(finalInspected.currentAverage)===Number(expectedAverage)
      ) {
        return {
          ok:true,
          verified:true,
          name:mapping.name,
          selectedDate:finalInspected.selectedDate,
          finalStates:[...logicalStates],
          finalAverage:Number(finalInspected.currentAverage),
          clicksMade,
          adaptive:true,
          reader:"literal + visual fingerprint + Daily average",
          observedCycle:"+ -> blank -> - -> +"
        };
      }

      await sleep(60);
    }

    return {
      ok:false,
      verified:false,
      error:
        `The cell updates completed, but Office Puzzle's Daily average did not verify as ${expectedAverage}%. No extra clicks were sent.`,
      finalStates:[...logicalStates],
      finalAverage:finalInspected?.currentAverage ?? null,
      expectedAverage,
      clicksMade
    };
  }

  async function adaptiveClearUnusedPartialIntervals({
    mapping,
    activeIntervals,
    availableIntervals,
    blankBaselines,
    clicksMade
  }) {
    const cleanupEnd=Math.min(availableIntervals,MAX_CHALLENGING_INTERVALS);

    if (activeIntervals>=cleanupEnd) {
      return {ok:true,clicksMade,cleared:[]};
    }

    const cleared=[];
    const count=cleanupEnd;

    for (let intervalNumber=activeIntervals+1; intervalNumber<=cleanupEnd; intervalNumber++) {
      const index=intervalNumber-1;
      let clickAttempts=0;

      while (clickAttempts<2) {
        if (activeWriteWasAborted()) {
          return abortedWriteResult("Client 2 Partial Interval cleanup");
        }

        let inspected=challengingIntervalFromMapping(mapping,true);
        if (!inspected) {
          return {ok:false,clicksMade,cleared,error:`Lost the interval table while clearing unused Interval ${intervalNumber}.`};
        }

        let stateModel=inferAdaptivePartialIntervalColumn(
          inspected,
          count,
          findChallengingIntervalCell
        );
        let cell=findChallengingIntervalCell(inspected,intervalNumber);
        if (!cell) {
          return {ok:false,clicksMade,cleared,error:`Could not locate unused Interval ${intervalNumber}.`};
        }

        let outcomeSignature=replacementCellOutcomeSignature(cell);
        let stateFingerprint=adaptiveStateFingerprint(cell);
        let observed=
          stateModel.states[index] ??
          adaptiveKnownState({
            cell,
            readable:trialCellState(cell) || "",
            outcomeSignature,
            blankBaseline:blankBaselines?.[index] ?? null,
            mode:"partial_interval",
            stateModel,
            stateFingerprint
          });

        if (observed===null) {
          // Give a framework-rendered symbol a short read-only settle window.
          const readStarted=Date.now();
          while (Date.now()-readStarted<900 && observed===null) {
            await sleep(60);
            inspected=challengingIntervalFromMapping(mapping,true);
            if (!inspected) continue;
            stateModel=inferAdaptivePartialIntervalColumn(
              inspected,
              count,
              findChallengingIntervalCell
            );
            cell=findChallengingIntervalCell(inspected,intervalNumber);
            if (!cell) continue;
            outcomeSignature=replacementCellOutcomeSignature(cell);
            stateFingerprint=adaptiveStateFingerprint(cell);
            observed=
              stateModel.states[index] ??
              adaptiveKnownState({
                cell,
                readable:trialCellState(cell) || "",
                outcomeSignature,
                blankBaseline:blankBaselines?.[index] ?? null,
                mode:"partial_interval",
                stateModel,
                stateFingerprint
              });
          }
        }

        if (observed===null) {
          return {ok:false,clicksMade,cleared,error:`Could not confidently read unused Interval ${intervalNumber} before cleanup. No cleanup click was sent.`};
        }

        if (observed==="") {
          cleared.push(intervalNumber);
          break;
        }

        const beforeState=observed;
        const expected=nextReplacementCellState(beforeState);
        const beforeVisualSignature=replacementCellVisualSignature(cell);
        const beforeOutcomeSignature=outcomeSignature;

        try { clickReplacementTrialCell(cell); }
        catch (err) {
          return {ok:false,clicksMade,cleared,error:String(err?.message || err)};
        }

        clicksMade++;
        clickAttempts++;

        let transition=await waitForAdaptiveCellTransition({
          mapping,
          inspect:challengingIntervalFromMapping,
          cellFinder:findChallengingIntervalCell,
          index,
          mode:"partial_interval",
          beforeState,
          beforeVisualSignature,
          beforeOutcomeSignature,
          blankBaseline:blankBaselines?.[index] ?? null,
          stateModel,
          timeoutMs:3500
        });

        if (transition.aborted) {
          return abortedWriteResult("Client 2 Partial Interval cleanup");
        }

        // If the fast transition reader missed a framework rerender, reconcile
        // read-only from the live column before declaring the cleanup failed.
        if (!transition.ok || transition.state===null) {
          const reconcileStarted=Date.now();
          while (Date.now()-reconcileStarted<1100) {
            await sleep(65);
            const fresh=challengingIntervalFromMapping(mapping,true);
            if (!fresh) continue;
            const freshModel=inferAdaptivePartialIntervalColumn(
              fresh,
              count,
              findChallengingIntervalCell
            );
            const freshState=freshModel.states[index];
            if (freshState===expected) {
              transition={ok:true,state:freshState};
              break;
            }
          }
        }

        if (!transition.ok || transition.state===null) {
          return {ok:false,clicksMade,cleared,error:`Stopped while clearing unused Interval ${intervalNumber}: Office Puzzle changed the cell but its new state could not be verified.`};
        }

        await waitForOfficePuzzleQuiet({
          quietMs:70,
          minMs:35,
          maxMs:420,
          root:quietRootForMapping(mapping)
        });
      }

      if (!cleared.includes(intervalNumber)) {
        const final=challengingIntervalFromMapping(mapping,true);
        const finalModel=final
          ? inferAdaptivePartialIntervalColumn(final,count,findChallengingIntervalCell)
          : null;
        if (finalModel?.states?.[index]==="") {
          cleared.push(intervalNumber);
        } else {
          return {ok:false,clicksMade,cleared,error:`Unused Interval ${intervalNumber} did not return to blank after two verified transitions.`};
        }
      }
    }

    return {ok:true,clicksMade,cleared};
  }

  async function setReplacementTrials(mapping,desiredStates) {
    if (!Array.isArray(desiredStates) || desiredStates.length!==10) {
      return {ok:false,error:"Exactly 10 reviewed trial states are required."};
    }
    if (desiredStates.some(state=>state!=="+" && state!=="-")) {
      return {ok:false,error:"Every reviewed trial must be either + or - before filling."};
    }
    const currentProgram=detectCurrentReplacementProgramName();
    if (currentProgram && mapping?.name && normalize(currentProgram)!==normalize(mapping.name)) {
      return {ok:false,error:`Safety stop: Office Puzzle is currently showing "${currentProgram}", but the extension is set to "${mapping.name}".`};
    }
    return runAdaptiveReplacementTrials(mapping,desiredStates,{
      label:"Client 1 replacement",
      inspect:replacementFromMapping,
      nativeInitSaveSettleMs:650,
      transitionSaveSettleMs:500,
      nextTrialSettleMs:25
    });
  }
  function dispatchCellClick(cell) {
    cell.scrollIntoView({ block:"nearest", inline:"nearest" });

    const opts = { bubbles:true, cancelable:true, view:window };
    try { cell.dispatchEvent(new PointerEvent("pointerdown", opts)); } catch (_) {}
    cell.dispatchEvent(new MouseEvent("mousedown", opts));
    try { cell.dispatchEvent(new PointerEvent("pointerup", opts)); } catch (_) {}
    cell.dispatchEvent(new MouseEvent("mouseup", opts));
    cell.dispatchEvent(new MouseEvent("click", opts));
  }

  function readChallengingActiveStates(inspected,activeIntervals) {
    const states=[];

    for (let index=0; index<activeIntervals; index++) {
      const cell=findChallengingIntervalCell(inspected,index+1);
      states.push(trialCellState(cell));
    }

    return states;
  }

  async function setClient2ReplacementTrials(mapping,desiredStates) {
    if (!Array.isArray(desiredStates) || desiredStates.length!==10) {
      return {ok:false,error:"Exactly 10 reviewed trial states are required."};
    }
    if (desiredStates.some(state=>state!=="+" && state!=="-")) {
      return {ok:false,error:"Every reviewed trial must be either + or - before filling."};
    }
    if (!currentClient2ReplacementMatches(mapping)) {
      return {ok:false,error:"Safety stop: the selected Client 2 replacement does not have a valid exact-name table mapping."};
    }
    return runAdaptiveReplacementTrials(mapping,desiredStates,{
      label:"Client 2 replacement",
      inspect:client2ReplacementFromMapping,
      nativeInitSaveSettleMs:650,
      transitionSaveSettleMs:550,
      nextTrialSettleMs:25
    });
  }
async function setChallengingIntervals(mapping,desiredStates,activeIntervals) {
    activeIntervals=Number(activeIntervals);
    if (!Number.isInteger(activeIntervals) || activeIntervals<1 || activeIntervals>MAX_CHALLENGING_INTERVALS) {
      return {ok:false,error:`Active interval count must be between 1 and ${MAX_CHALLENGING_INTERVALS}.`};
    }
    if (!Array.isArray(desiredStates) || desiredStates.length!==activeIntervals) {
      return {ok:false,error:`Exactly ${activeIntervals} reviewed interval outcomes are required.`};
    }
    if (desiredStates.some(state=>state!=="+" && state!=="-")) {
      return {ok:false,error:"Every reviewed interval must be either + or - before filling."};
    }
    if (!currentChallengingNameMatches(mapping)) {
      return {ok:false,error:"Safety stop: the selected Client 2 behavior does not have a valid exact-name table mapping."};
    }

    let inspected=challengingIntervalFromMapping(mapping,true);
    if (!inspected) {
      return {ok:false,error:`Could not locate the ${mapping?.name || "challenging behavior"} interval table.`};
    }

    if(!selectedMappingDateIsWritable(mapping)) {
      return unavailableDateWriteResult(mapping);
    }

    const availableIntervals=inspected.intervalRows?.length || 0;
    if (activeIntervals>availableIntervals) {
      return {ok:false,error:`This Office Puzzle table currently provides ${availableIntervals} 30-minute interval${availableIntervals===1 ? "" : "s"} (${availableIntervals/2} hours). The requested ${activeIntervals/2} hours was not written.`};
    }

    const scanCount=Math.min(availableIntervals,MAX_CHALLENGING_INTERVALS);
    let snapshot=adaptiveCellSnapshot(inspected,scanCount,findChallengingIntervalCell);
    let clicksMade=0;
    const freshBlank=snapshot.average==null && snapshot.states.every(state=>state==="");
    const blankBaselines=freshBlank ? [...snapshot.outcomeSignatures] : null;
    let initializedRows=0;

    if (freshBlank) {
      const initCell=findChallengingIntervalCell(inspected,1);
      if (!initCell) return {ok:false,error:"Could not locate Interval 1 to start today's Partial Interval column.",clicksMade};
      try { clickReplacementTrialCellSingleRequest(initCell); }
      catch (err) { return {ok:false,error:String(err?.message || err),clicksMade}; }
      clicksMade++;

      const initialized=await waitForAdaptiveColumnChange({
        mapping,
        inspect:challengingIntervalFromMapping,
        count:scanCount,
        cellFinder:findChallengingIntervalCell,
        beforeSnapshot:snapshot,
        timeoutMs:5000
      });
      if (initialized.aborted) return abortedWriteResult("Client 2 Partial Interval");
      if (!initialized.ok) {
        const duplicate=officePuzzleDuplicateRequestVisible();
        return {
          ok:false,
          error:duplicate
            ? "Office Puzzle reported a duplicate request while starting this Partial Interval date. Only one initialization click was sent. Refresh Office Puzzle, then press Retry."
            : "Office Puzzle did not confirm an interval-column change after the first click. No later intervals were touched. Refresh Office Puzzle, then press Retry.",
          clicksMade
        };
      }
      initializedRows=initialized.snapshot.outcomeSignatures.reduce((total,signature,index)=>total+(signature!==blankBaselines[index] ? 1 : 0),0);
      await waitForOfficePuzzleQuiet({quietMs:100,minMs:55,maxMs:700,root:quietRootForMapping(mapping)});
      inspected=challengingIntervalFromMapping(mapping,true) || initialized.inspected;
      snapshot=adaptiveCellSnapshot(inspected,scanCount,findChallengingIntervalCell);
    }

    let stateModel=inferAdaptivePartialIntervalColumn(
      inspected,
      scanCount,
      findChallengingIntervalCell
    );

    const logicalStates=Array(activeIntervals).fill(null);
    const logicalOutcomeSignatures=Array(activeIntervals).fill("");

    for (let index=0; index<activeIntervals; index++) {
      const cell=findChallengingIntervalCell(inspected,index+1);
      const outcomeSignature=snapshot.outcomeSignatures[index] || "";
      const stateFingerprint=adaptiveStateFingerprint(cell);
      const state=
        stateModel.states[index] ??
        adaptiveKnownState({
          cell,
          readable:snapshot.states[index],
          outcomeSignature,
          blankBaseline:blankBaselines?.[index] ?? null,
          mode:"partial_interval",
          stateModel,
          stateFingerprint
        });

      if (state!==null) {
        logicalStates[index]=state;
        logicalOutcomeSignatures[index]=outcomeSignature;
        learnAdaptiveStateFingerprint(stateModel,stateFingerprint,state);
      }
    }

    const transitionSaveSettleMs=550;
    const nextIntervalSettleMs=25;

    for (let index=0; index<activeIntervals; index++) {
      const intervalNumber=index+1;
      const desired=desiredStates[index];
      let guard=0;
      while (guard<5) {
        guard++;
        if (activeWriteWasAborted()) return abortedWriteResult("Client 2 Partial Interval");
        inspected=challengingIntervalFromMapping(mapping,true);
        if (!inspected) return {ok:false,error:`Lost the ${mapping.name} table at Interval ${intervalNumber}.`,clicksMade};
        let cell=findChallengingIntervalCell(inspected,intervalNumber);
        if (!cell) return {ok:false,error:`Could not locate Interval ${intervalNumber} in today's column.`,clicksMade};
        let readable=trialCellState(cell) || "";
        let outcomeSignature=replacementCellOutcomeSignature(cell);
        let stateFingerprint=adaptiveStateFingerprint(cell);
        let knownNow=adaptiveKnownState({
          cell,
          readable,
          outcomeSignature,
          blankBaseline:blankBaselines?.[index] ?? null,
          beforeState:logicalStates[index],
          beforeOutcomeSignature:logicalOutcomeSignatures[index],
          mode:"partial_interval",
          stateModel,
          stateFingerprint
        });

        if (knownNow===null) {
          stateModel=inferAdaptivePartialIntervalColumn(
            inspected,
            scanCount,
            findChallengingIntervalCell
          );
          knownNow=stateModel.states[index];
        }

        if (knownNow===null) {
          // Read-only settle/reconcile. Do not click an ambiguous cell.
          const readStarted=Date.now();
          while (Date.now()-readStarted<900 && knownNow===null) {
            await sleep(60);
            inspected=challengingIntervalFromMapping(mapping,true);
            if (!inspected) continue;
            stateModel=inferAdaptivePartialIntervalColumn(
              inspected,
              scanCount,
              findChallengingIntervalCell
            );
            cell=findChallengingIntervalCell(inspected,intervalNumber);
            if (!cell) continue;
            readable=trialCellState(cell) || "";
            outcomeSignature=replacementCellOutcomeSignature(cell);
            stateFingerprint=adaptiveStateFingerprint(cell);
            knownNow=
              stateModel.states[index] ??
              adaptiveKnownState({
                cell,
                readable,
                outcomeSignature,
                blankBaseline:blankBaselines?.[index] ?? null,
                beforeState:logicalStates[index],
                beforeOutcomeSignature:logicalOutcomeSignatures[index],
                mode:"partial_interval",
                stateModel,
                stateFingerprint
              });
          }
        }

        if (knownNow!==null) {
          logicalStates[index]=knownNow;
          logicalOutcomeSignatures[index]=outcomeSignature;
          learnAdaptiveStateFingerprint(stateModel,stateFingerprint,knownNow);
        } else if (
          logicalStates[index]===null ||
          logicalOutcomeSignatures[index]!==outcomeSignature
        ) {
          return {
            ok:false,
            error:`Stopped before Interval ${intervalNumber}: Office Puzzle kept this cell visually ambiguous after a safe read-only settle. No click was sent.`,
            clicksMade
          };
        }

        if (logicalStates[index]===desired) break;

        const beforeState=logicalStates[index];
        const expected=nextReplacementCellState(beforeState);
        const beforeVisualSignature=replacementCellVisualSignature(cell);
        const beforeOutcomeSignature=outcomeSignature;

        if (expected===null) {
          return {ok:false,error:`Stopped before Interval ${intervalNumber}: the current state is unknown. No click was sent.`,clicksMade};
        }

        try { clickReplacementTrialCell(cell); }
        catch (err) { return {ok:false,error:String(err?.message || err),clicksMade}; }
        clicksMade++;

        let transition=await waitForAdaptiveCellTransition({
          mapping,
          inspect:challengingIntervalFromMapping,
          cellFinder:findChallengingIntervalCell,
          index,
          mode:"partial_interval",
          beforeState,
          beforeVisualSignature,
          beforeOutcomeSignature,
          blankBaseline:blankBaselines?.[index] ?? null,
          stateModel,
          timeoutMs:4000
        });
        if (transition.aborted) return abortedWriteResult("Client 2 Partial Interval");

        // A framework re-render can briefly make the visual classifier report
        // the wrong state even though the single click advanced correctly.
        // Reconcile read-only against the expected next state before treating
        // an apparent mismatch as a real writer failure. Never click again
        // during this reconciliation window.
        if (!transition.ok || transition.state===null || transition.unexpected) {
          // Office Puzzle can replace the cell DOM after the click. Reconcile
          // read-only from the live column before deciding the transition
          // failed; never send another click until the expected state is read.
          const reconcileStarted=Date.now();
          while (Date.now()-reconcileStarted<1200) {
            await sleep(65);
            const fresh=challengingIntervalFromMapping(mapping,true);
            if (!fresh) continue;
            stateModel=inferAdaptivePartialIntervalColumn(
              fresh,
              scanCount,
              findChallengingIntervalCell
            );
            const reconciled=stateModel.states[index];
            if (reconciled===expected) {
              const freshCell=findChallengingIntervalCell(fresh,intervalNumber);
              transition={
                ok:true,
                state:reconciled,
                outcomeSignature:replacementCellOutcomeSignature(freshCell),
                stateFingerprint:adaptiveStateFingerprint(freshCell)
              };
              break;
            }
          }
        }

        if (!transition.ok || transition.state===null || transition.state!==expected) {
          return {
            ok:false,
            error:`Stopped at Interval ${intervalNumber}: after one click Office Puzzle did not stably verify the expected ${adaptiveStateLabel(expected)} state. No automatic second click was sent.`,
            clicksMade
          };
        }

        logicalStates[index]=transition.state;
        logicalOutcomeSignatures[index]=transition.outcomeSignature || "";
        learnAdaptiveStateFingerprint(
          stateModel,
          transition.stateFingerprint || "",
          transition.state
        );
        await waitForOfficePuzzleQuiet({
          quietMs:85,
          minMs:45,
          maxMs:transitionSaveSettleMs,
          root:quietRootForMapping(mapping)
        });
      }
      if (logicalStates[index]!==desired) {
        return {ok:false,error:`Stopped at Interval ${intervalNumber}: the observed state did not reach the reviewed ${desired} outcome. No later intervals were touched.`,clicksMade};
      }
      await sleep(nextIntervalSettleMs);
    }

    const cleanup=await adaptiveClearUnusedPartialIntervals({mapping,activeIntervals,availableIntervals,blankBaselines,clicksMade});
    clicksMade=cleanup.clicksMade;
    if (!cleanup.ok) return {ok:false,error:cleanup.error,clicksMade};

    const pluses=desiredStates.filter(state=>state==="+").length;
    const expectedAverage=(pluses/activeIntervals)*100;
    const finalStarted=Date.now();
    let finalInspected=null;
    while (Date.now()-finalStarted<6000) {
      if (activeWriteWasAborted()) return abortedWriteResult("Client 2 Partial Interval");
      finalInspected=challengingIntervalFromMapping(mapping,true);
      if (finalInspected) {
        const actualAverage=Number(finalInspected.currentAverage);
        const finalModel=inferAdaptivePartialIntervalColumn(
          finalInspected,
          scanCount,
          findChallengingIntervalCell
        );
        const observedStates=finalModel.states;
        const activeObserved=observedStates.slice(0,activeIntervals);
        const extraObserved=observedStates.slice(
          activeIntervals,
          Math.min(availableIntervals,MAX_CHALLENGING_INTERVALS)
        );
        const activeMatches=
          activeObserved.length===activeIntervals &&
          activeObserved.every((state,index)=>state===desiredStates[index]);
        const extrasBlank=extraObserved.every(state=>!state);

        if (
          activeMatches &&
          extrasBlank &&
          Number.isFinite(actualAverage) &&
          Math.abs(actualAverage-expectedAverage)<=1.1
        ) {
          return {
            ok:true,
            verified:true,
            name:mapping.name,
            selectedDate:finalInspected.selectedDate,
            finalStates:[...activeObserved],
            finalAverage:actualAverage,
            activeIntervals,
            nativeInitializedRows:initializedRows,
            clearedUnusedIntervals:cleanup.cleared,
            clicksMade,
            adaptive:true
          };
        }
      }
      await sleep(60);
    }

    const observedStates=finalInspected
      ? inferAdaptivePartialIntervalColumn(
          finalInspected,
          scanCount,
          findChallengingIntervalCell
        ).states
      : [];
    const extraPopulated=observedStates
      .slice(activeIntervals,Math.min(availableIntervals,MAX_CHALLENGING_INTERVALS))
      .filter(Boolean).length;
    const actualAverage=Number(finalInspected?.currentAverage);
    const actualText=Number.isFinite(actualAverage)
      ? `${actualAverage.toFixed(2).replace(/\.00$/,'')}%`
      : 'unavailable';

    return {
      ok:false,
      verified:false,
      error:
        extraPopulated>0
          ? `Office Puzzle still has ${extraPopulated} populated interval${extraPopulated===1 ? '' : 's'} beyond the selected ${activeIntervals/2} hours, so its Daily average is ${actualText} instead of ${expectedAverage.toFixed(1)}%. No extra clicks were sent.`
          : `The interval updates completed, but Office Puzzle's Daily average is ${actualText} and did not verify near ${expectedAverage.toFixed(1)}%. No extra clicks were sent.`,
      finalStates:observedStates.slice(0,activeIntervals),
      finalAverage:finalInspected?.currentAverage ?? null,
      expectedAverage,
      nativeInitializedRows:initializedRows,
      clearedUnusedIntervals:cleanup.cleared,
      clicksMade
    };
  }

  async function setBehaviorCount(mapping, target, replaceExisting) {
    let graph = graphFromMapping(mapping);

    if (!graph) {
      return {
        ok:false,
        error:`Could not locate the ${mapping?.name || "behavior"} table.`
      };
    }

    if(!selectedMappingDateIsWritable(mapping)) {
      return unavailableDateWriteResult(mapping);
    }

    const max = graph.maxOccurrences;

    if (!Number.isInteger(target) || target < 0 || target > max) {
      return {
        ok:false,
        error:`Value must be between 0 and ${max}.`
      };
    }

    const existing = graph.currentCount;

    if (existing === target) {
      return {
        ok:true,
        behaviorName:mapping.name,
        selectedDate:graph.selectedDate,
        existingBefore:existing,
        target,
        finalCount:existing,
        clicksMade:0,
        max
      };
    }

    // Office Puzzle behavior:
    // - clicking the day cell on numbered row N fills the column through N
    // - clicking row 1 on an already-filled column clears that day
    //
    // We therefore never sweep/click many cells. A normal write is one click.
    // Changing an existing value is clear -> verify -> set desired row -> verify.

    let clicksMade = 0;

    async function waitForCountValue(expectedCount,timeoutMs=1800) {
      const started=Date.now();
      let latest=null;

      while(Date.now()-started<timeoutMs) {
        if(activeWriteWasAborted()) {
          throw new Error("__RBT_USER_ABORT__");
        }

        latest=graphFromMapping(mapping);
        if(latest && Number(latest.currentCount)===Number(expectedCount)) {
          graph=latest;
          return true;
        }

        await sleep(18);
      }

      if(latest) graph=latest;
      return false;
    }

    async function clickLevel(level,expectedCount) {
      if (activeWriteWasAborted()) {
        throw new Error("__RBT_USER_ABORT__");
      }

      graph = graphFromMapping(mapping);
      if (!graph) {
        throw new Error(`Lost the ${mapping.name} table while applying data.`);
      }

      const row = graph.occurrenceRows.find(r => r.level === level);
      const cell = row?.cells?.[graph.columnIndex];

      if (!cell) {
        throw new Error(`Could not find row ${level} for ${mapping.name}.`);
      }

      dispatchCellClick(cell);
      clicksMade++;

      if(Number.isFinite(Number(expectedCount))) {
        await waitForCountValue(Number(expectedCount));
      } else {
        await waitForOfficePuzzleQuiet({quietMs:70,minMs:35,maxMs:350,root:quietRootForMapping(mapping)});
      }
    }

    try {
      // If something is already recorded and we're changing it,
      // clear first with exactly one click at row 1.
      if (existing > 0) {
        await clickLevel(1,0);

        graph = graphFromMapping(mapping);
        if (!graph) {
          return {
            ok:false,
            error:`Could not verify ${mapping.name} after clearing.`
          };
        }

        if (graph.currentCount !== 0) {
          return {
            ok:false,
            error:
              `Safety stop: row 1 did not clear ${mapping.name}. ` +
              `Current detected count is ${graph.currentCount}. No further clicks were made.`,
            existingBefore:existing,
            target,
            finalCount:graph.currentCount,
            clicksMade
          };
        }
      }

      // Target 0 means clearing was the entire requested operation.
      if (target === 0) {
        return {
          ok:true,
          behaviorName:mapping.name,
          selectedDate:graph?.selectedDate || mapping.selectedDate,
          existingBefore:existing,
          target:0,
          finalCount:0,
          clicksMade,
          max
        };
      }

      // Set the desired count with ONE click on the corresponding numbered row.
      await clickLevel(target,target);

      graph = graphFromMapping(mapping);
      if (!graph) {
        return {
          ok:false,
          error:`Could not verify ${mapping.name} after setting row ${target}.`,
          existingBefore:existing,
          target,
          clicksMade
        };
      }

      const finalCount = graph.currentCount;

      if (finalCount !== target) {
        return {
          ok:false,
          error:
            `Safety stop: Office Puzzle registered ${finalCount} instead of ${target}. ` +
            `No automatic retry was attempted. Please verify the column manually.`,
          behaviorName:mapping.name,
          selectedDate:graph.selectedDate,
          existingBefore:existing,
          target,
          finalCount,
          clicksMade,
          max
        };
      }

      return {
        ok:true,
        behaviorName:mapping.name,
        selectedDate:graph.selectedDate,
        existingBefore:existing,
        target,
        finalCount,
        clicksMade,
        max
      };
    } catch (err) {
      if (activeWriteWasAborted() || String(err?.message || err)==="__RBT_USER_ABORT__") {
        return abortedWriteResult("Frequency write");
      }

      return {
        ok:false,
        error:String(err?.message || err),
        existingBefore:existing,
        target,
        clicksMade,
        max
      };
    }
  }

  function setNativeValue(el, value) {
    if (el.isContentEditable) {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles:true, inputType:"insertText", data:value }));
      el.dispatchEvent(new Event("change", { bubbles:true }));
      el.blur();
      return;
    }

    const proto =
      el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype :
      el.tagName === "INPUT" ? HTMLInputElement.prototype : null;

    if (proto) {
      const d = Object.getOwnPropertyDescriptor(proto, "value");
      if (d?.set) d.set.call(el, value);
      else el.value = value;
    } else {
      el.value = value;
    }

    el.focus();
    el.dispatchEvent(new Event("input", { bubbles:true }));
    el.dispatchEvent(new Event("change", { bubbles:true }));
    el.dispatchEvent(new Event("blur", { bubbles:true }));
  }

  function clearPickerHighlight() {
    document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach(el => {
      el.style.outline = el.dataset.rbtOldOutline || "";
      delete el.dataset.rbtOldOutline;
      el.removeAttribute(HIGHLIGHT_ATTR);
    });
  }

  function startPicker(sendResponse) {
    const eligible = "input, textarea, [contenteditable='true'], [role='textbox']";
    let current = null;

    function hover(e) {
      const el = e.target.closest?.(eligible);
      if (!el || !isVisible(el)) return;

      if (current && current !== el) {
        current.style.outline = current.dataset.rbtOldOutline || "";
        current.removeAttribute(HIGHLIGHT_ATTR);
      }

      current = el;

      if (!el.hasAttribute(HIGHLIGHT_ATTR)) {
        el.dataset.rbtOldOutline = el.style.outline || "";
        el.style.outline = "3px solid #6d5dfc";
        el.setAttribute(HIGHLIGHT_ATTR, "1");
      }
    }

    function cleanup() {
      document.removeEventListener("mouseover", hover, true);
      document.removeEventListener("click", choose, true);
      document.removeEventListener("keydown", escape, true);
      clearPickerHighlight();
    }

    function choose(e) {
      const el = e.target.closest?.(eligible);
      if (!el || !isVisible(el)) return;

      e.preventDefault();
      e.stopPropagation();

      const selector = el.id ? `#${CSS.escape(el.id)}` : null;
      if (!selector) {
        cleanup();
        sendResponse({ ok:false, error:"Please choose a note field with a stable id." });
        return;
      }

      cleanup();
      sendResponse({ ok:true, selector });
    }

    function escape(e) {
      if (e.key === "Escape") {
        cleanup();
        sendResponse({ ok:false, cancelled:true });
      }
    }

    document.addEventListener("mouseover", hover, true);
    document.addEventListener("click", choose, true);
    document.addEventListener("keydown", escape, true);
  }

  function clickableFromIconElement(el) {
    if(!el) return null;
    return el.closest?.('button,a,[role="button"],[onclick]') || el;
  }

  function gearHintScore(el) {
    if(!el || !isVisible(el)) return -1;

    const hint=normalize([
      textOf(el),
      el.getAttribute?.("title"),
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("class"),
      el.getAttribute?.("data-original-title")
    ].filter(Boolean).join(" "));

    let score=0;
    if(/\bgear\b|\bcog\b|\bsetting\b|\bmanage\b/.test(hint)) score+=20;
    if(el.matches?.('button,a,[role="button"],[onclick]')) score+=5;

    try {
      if(getComputedStyle(el).cursor==="pointer") score+=3;
    } catch(_) {}

    return score;
  }

  function resolveTableForColumnClear(mapping,writerKind) {
    const pageType=detectPageType();

    let inspected=null;

    if(writerKind==="frequency") {
      inspected=graphFromMapping(mapping);
    } else if(writerKind==="partial_interval") {
      inspected=challengingIntervalFromMapping(mapping,true);
    } else if(writerKind==="replacement") {
      inspected=
        pageType==="client2replacement"
          ? client2ReplacementFromMapping(mapping,true)
          : replacementFromMapping(mapping,true);
    }

    const table=mapping?.tableId
      ? tableRegistry.get(mapping.tableId)
      : null;

    if(!inspected || !table?.isConnected) return null;

    return {table,inspected};
  }

  function selectedHeaderForTable(table,selectedDate) {
    const daysRow=findDaysRow(table);
    if(!daysRow) return null;

    const dates=mapDaysRowDates(daysRow,displayedMonthYear());
    const selectedIndex=dates.indexOf(selectedDate);
    if(selectedIndex<0) return null;

    const dayCells=cellsOfRow(daysRow);
    const headerCell=dayCells[selectedIndex+1];

    return headerCell
      ? {daysRow,dates,selectedIndex,headerCell}
      : null;
  }

  function findSelectedColumnGear(table,selectedDate) {
    const header=selectedHeaderForTable(table,selectedDate);
    if(!header) return null;

    const headerX=horizontalCenter(header.headerCell);
    const rows=table.rows ? [...table.rows] : [...table.querySelectorAll("tr")];
    const initialsRow=findNamedRow(table,"Initials");
    const initialsIndex=initialsRow ? rows.indexOf(initialsRow) : -1;

    const candidates=[];

    const considerCell=(cell,rowIndex)=>{
      if(!cell) return;

      const elements=[
        ...cell.querySelectorAll(
          'button,a,[role="button"],[onclick],i,svg,span'
        )
      ];

      // Occasionally the TD itself is the clickable control.
      elements.push(cell);

      for(const raw of elements) {
        if(!isVisible(raw)) continue;

        const target=clickableFromIconElement(raw);
        if(!target || !isVisible(target)) continue;

        const rect=target.getBoundingClientRect();
        const x=rect.left + rect.width/2;
        const dx=Math.abs(x-headerX);

        if(dx>Math.max(18,header.headerCell.getBoundingClientRect().width*.75)) {
          continue;
        }

        let score=gearHintScore(raw)+gearHintScore(target);

        // The Office Puzzle gear row shown under "Initials" is the strongest
        // structural signal, even if the icon has no accessible label.
        if(initialsIndex>=0 && rowIndex>initialsIndex) score+=18;
        if(dx<10) score+=8;

        if(score>0) {
          candidates.push({target,score,dx});
        }
      }
    };

    rows.forEach((row,rowIndex)=>{
      const cells=cellsOfRow(row);
      if(!cells.length) return;
      const cell=cellAlignedWithHeader(cells,header.headerCell);
      considerCell(cell,rowIndex);
    });

    candidates.sort((a,b)=>(b.score-a.score)||(a.dx-b.dx));
    return candidates[0]?.target || null;
  }

  function deleteLikeElements() {
    const nodes=[
      ...document.querySelectorAll(
        'button,a,[role="button"],[role="menuitem"],li'
      )
    ];

    return nodes.filter(el=>{
      if(!isVisible(el)) return false;
      const txt=normalize(textOf(el));
      return txt==="delete" || txt.startsWith("delete ");
    });
  }

  function confirmationLikeElements(exclude=null) {
    const roots=[
      ...document.querySelectorAll(
        '[role="dialog"],.modal,[class*="modal"],[class*="dialog"],[class*="confirm"]'
      )
    ].filter(isVisible);

    const pool=roots.length
      ? roots.flatMap(root=>[
          ...root.querySelectorAll('button,a,[role="button"]')
        ])
      : [...document.querySelectorAll('button,a,[role="button"]')];

    return pool.filter(el=>{
      if(el===exclude || !isVisible(el)) return false;
      const txt=normalize(textOf(el));
      return (
        txt==="delete" ||
        txt==="confirm" ||
        txt==="yes" ||
        txt==="ok"
      );
    });
  }

  function nearestElementToPoint(elements,x,y) {
    let best=null;
    let bestDistance=Infinity;

    for(const el of elements) {
      const rect=el.getBoundingClientRect();
      const cx=rect.left+rect.width/2;
      const cy=rect.top+rect.height/2;
      const distance=Math.hypot(cx-x,cy-y);

      if(distance<bestDistance) {
        best=el;
        bestDistance=distance;
      }
    }

    return best;
  }

  async function waitForNewDeleteAction(previousVisible,gearRect,timeoutMs=2200) {
    const started=Date.now();

    while(Date.now()-started<timeoutMs) {
      if(activeWriteWasAborted()) return null;

      const current=deleteLikeElements()
        .filter(el=>!previousVisible.has(el));

      if(current.length) {
        return nearestElementToPoint(
          current,
          gearRect.left+gearRect.width/2,
          gearRect.top+gearRect.height/2
        );
      }

      await sleep(80);
    }

    return null;
  }

  async function columnLooksBlank(mapping,writerKind) {
    if(writerKind==="frequency") {
      const inspected=graphFromMapping(mapping);
      return !!inspected && Number(inspected.currentCount||0)===0;
    }

    if(writerKind==="partial_interval") {
      const inspected=challengingIntervalFromMapping(mapping,true);
      return !!inspected &&
        (inspected.currentStates||[]).every(state=>!state);
    }

    if(writerKind==="replacement") {
      const pageType=detectPageType();
      const inspected=
        pageType==="client2replacement"
          ? client2ReplacementFromMapping(mapping,true)
          : replacementFromMapping(mapping,true);

      return !!inspected &&
        (inspected.currentStates||[]).every(state=>!state);
    }

    return false;
  }

  async function clearSelectedColumnViaGear(mapping,writerKind) {
    if(activeWriteWasAborted()) {
      return abortedWriteResult("Clear column");
    }

    const selectedDate=mapping?.selectedDate || resolveSelectedDate().date;

    if(!selectedDate || selectedDate!==resolveSelectedDate().date) {
      return {
        ok:false,
        verified:false,
        error:"Safety stop: the mapped column date does not match the Office Puzzle selected date."
      };
    }

    const resolved=resolveTableForColumnClear(mapping,writerKind);

    if(!resolved?.table) {
      return {
        ok:false,
        verified:false,
        error:`Could not locate the ${mapping?.name || "selected"} Office Puzzle table.`
      };
    }

    const gear=findSelectedColumnGear(resolved.table,selectedDate);

    if(!gear) {
      return {
        ok:false,
        verified:false,
        error:"Could not find the gear control for the selected date column. No data was changed."
      };
    }

    const previousDelete=new Set(deleteLikeElements());
    const gearRect=gear.getBoundingClientRect();

    gear.scrollIntoView({block:"center",inline:"center",behavior:"auto"});

    if(activeWriteWasAborted()) {
      return abortedWriteResult("Clear column");
    }

    gear.click();

    const deleteAction=await waitForNewDeleteAction(
      previousDelete,
      gearRect
    );

    if(activeWriteWasAborted()) {
      return abortedWriteResult("Clear column");
    }

    if(!deleteAction) {
      return {
        ok:false,
        verified:false,
        error:"Office Puzzle gear opened, but a Delete action could not be identified. No delete click was sent."
      };
    }

    deleteAction.click();
    await sleep(180);

    if(activeWriteWasAborted()) {
      return abortedWriteResult("Clear column");
    }

    // Some Office Puzzle builds show a second confirmation dialog.
    const confirmCandidates=confirmationLikeElements(deleteAction);
    const confirmButton=confirmCandidates.find(el=>{
      const txt=normalize(textOf(el));
      return txt==="delete" || txt==="confirm" || txt==="yes";
    });

    if(confirmButton) {
      confirmButton.click();
    }

    // Verify immediately and keep polling only as long as Office Puzzle needs.
    const clearVerifyStarted=Date.now();
    while(Date.now()-clearVerifyStarted<2600) {
      if(activeWriteWasAborted()) {
        return abortedWriteResult("Clear column");
      }

      if(await columnLooksBlank(mapping,writerKind)) {
        return {
          ok:true,
          verified:true,
          selectedDate,
          cleared:true
        };
      }

      await sleep(70);
    }

    return {
      ok:false,
      verified:false,
      error:"Office Puzzle received the delete action, but the selected column did not verify as blank."
    };
  }


  function buildContextSnapshot() {
    const now=Date.now();

    if(
      contextSnapshotCache &&
      contextSnapshotCacheRevision===programStructureRevision &&
      now-contextSnapshotCacheAt<CONTEXT_CACHE_TTL_MS
    ) {
      return {...contextSnapshotCache};
    }

    const bodyText=cachedBodyText();
    const pageType=detectPageType(bodyText);
    const nav=dateNavigationInfo();

    contextSnapshotCache={
      ok:true,
      pageType,
      dataPageReady:hasLiveDataCollectionGrid(pageType),
      clientLabel:detectClientLabel(bodyText),
      title:document.title,
      url:location.href,
      selectedDate:nav.selectedDate,
      dateMin:nav.minDate,
      dateMax:nav.maxDate,
      availableDates:nav.availableDates,
      dateNavigationSupported:nav.supported,
      currentName:detectCurrentName(),
      collectionMethod:detectCollectionMethod(bodyText),
      domRevision:programStructureRevision
    };

    contextSnapshotCacheRevision=programStructureRevision;
    contextSnapshotCacheAt=now;
    return {...contextSnapshotCache};
  }

  let offscreenInventoryScanPromise=null;
  let offscreenInventoryCache={key:"",programNames:[],at:0};

  function offscreenText(node) {
    return String(node?.textContent || node?.innerText || "")
      .replace(/\u00a0/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function collectProgramNamesFromDocument(doc,into=new Map()) {
    if(!doc) return into;

    const add=raw=>{
      const name=cleanProgramCandidate(raw);
      if(!name) return;
      const key=normalize(name);
      if(!key || into.has(key)) return;
      into.set(key,name);
    };

    // Office Puzzle's metadata rows are the highest-confidence inventory.
    for(const row of doc.querySelectorAll("tr")) {
      const cells=[...row.querySelectorAll(":scope > th,:scope > td")];
      if(cells.length<2) continue;
      if(normalize(offscreenText(cells[0]))!=="name") continue;

      // Avoid unrelated patient/account “Name” rows. Program metadata on
      // Office Puzzle sits beside at least one of these clinical labels.
      const local=offscreenText(
        row.closest("table,section,article,.card,.panel,.box,div")
      );
      if(!/\b(?:collection method|objective|category|baseline|start date|end date)\b/i.test(local)) {
        continue;
      }

      add(offscreenText(cells[1]));
    }

    // Catch collapsed/virtualized metadata that exists as text but not as a
    // conventional table row.
    const raw=offscreenText(doc.body);
    const patterns=[
      /(?:^|\s)Name\s*:\s*(.+?)(?=\s+(?:Category|Collection Method|Description|Baselines?|Objective|Start date|End date|Month\/Year)\s*:|$)/gi,
      /(?:^|\s)Program\s*Name\s*:\s*(.+?)(?=\s+(?:Category|Collection Method|Description|Baselines?|Objective|Start date|End date)\s*:|$)/gi
    ];

    for(const pattern of patterns) {
      let match;
      while((match=pattern.exec(raw))) add(match[1]);
    }

    // Some Office Puzzle pages expose the complete program inventory in a
    // native control even when only one table is mounted.
    for(const select of doc.querySelectorAll("select")) {
      const context=normalize([
        select.id,
        select.name,
        select.getAttribute("aria-label"),
        select.getAttribute("title"),
        offscreenText(select.parentElement)
      ].filter(Boolean).join(" "));

      if(!/\b(?:behavior|behaviour|replacement|skill|acquisition|program|target|goal|maladaptive|challenging)\b/.test(context)) {
        continue;
      }

      for(const option of select.options || []) add(offscreenText(option));
    }

    return into;
  }

  function offscreenScrollableTargets(doc,win) {
    const root=doc.scrollingElement || doc.documentElement;
    const targets=[];
    const seen=new Set();

    const add=el=>{
      if(!el || seen.has(el)) return;
      const client=Math.max(0,el.clientHeight || 0);
      const range=Math.max(0,(el.scrollHeight || 0)-client);
      if(range<80) return;
      seen.add(el);
      targets.push({el,range});
    };

    add(root);

    for(const el of doc.querySelectorAll(
      "main,[role='main'],.content,.main-content,.page-content,.scroll-container,.overflow-auto,.overflow-y-auto,[style*='overflow']"
    )) {
      if(el===root) continue;
      const style=win.getComputedStyle(el);
      if(!/(auto|scroll|overlay)/i.test(style.overflowY || "")) continue;
      add(el);
    }

    targets.sort((a,b)=>b.range-a.range);
    return targets.slice(0,8).map(item=>item.el);
  }

  function offscreenGetTop(target,doc,win) {
    const root=doc.scrollingElement || doc.documentElement;
    return target===root ? win.scrollY : target.scrollTop;
  }

  function offscreenSetTop(target,doc,win,value) {
    const root=doc.scrollingElement || doc.documentElement;
    if(target===root) win.scrollTo(0,value);
    else target.scrollTop=value;

    // A few lazy loaders listen for the event rather than the property.
    try { target.dispatchEvent(new Event("scroll",{bubbles:true})); } catch(_) {}
  }

  async function scanOffscreenTarget(target,doc,win,names) {
    const root=doc.scrollingElement || doc.documentElement;
    const original=offscreenGetTop(target,doc,win);
    let steps=0;
    let bottomStable=0;
    let priorExtent=-1;

    try {
      offscreenSetTop(target,doc,win,0);
      await sleep(90);
      collectProgramNamesFromDocument(doc,names);

      while(steps<100 && bottomStable<3) {
        const viewport=Math.max(
          260,
          target===root ? (win.innerHeight || 700) : (target.clientHeight || 700)
        );
        const extent=Math.max(0,(target.scrollHeight || 0)-viewport);
        const current=offscreenGetTop(target,doc,win);
        const next=Math.min(extent,current+Math.max(220,Math.floor(viewport*.78)));

        offscreenSetTop(target,doc,win,next);
        await sleep(85);
        collectProgramNamesFromDocument(doc,names);
        steps++;

        const nextViewport=Math.max(
          260,
          target===root ? (win.innerHeight || 700) : (target.clientHeight || 700)
        );
        const nextExtent=Math.max(0,(target.scrollHeight || 0)-nextViewport);
        const atBottom=offscreenGetTop(target,doc,win)>=nextExtent-6;

        if(atBottom) {
          await sleep(140);
          collectProgramNamesFromDocument(doc,names);
          const afterExtent=Math.max(0,(target.scrollHeight || 0)-nextViewport);
          if(afterExtent===priorExtent || afterExtent===nextExtent) bottomStable++;
          else bottomStable=0;
          priorExtent=afterExtent;
        } else {
          bottomStable=0;
          priorExtent=nextExtent;
        }
      }
    } finally {
      offscreenSetTop(target,doc,win,original);
    }

    return steps;
  }

  async function scanFullProgramInventoryOffscreen({force=false}={}) {
    const key=`${location.origin}${location.pathname}${location.search}::${detectPageType()}`;
    const now=Date.now();

    if(
      !force &&
      offscreenInventoryCache.key===key &&
      offscreenInventoryCache.programNames.length &&
      now-offscreenInventoryCache.at<60000
    ) {
      return {
        ok:true,
        cached:true,
        pageType:detectPageType(),
        programNames:[...offscreenInventoryCache.programNames]
      };
    }

    if(offscreenInventoryScanPromise) return offscreenInventoryScanPromise;

    offscreenInventoryScanPromise=(async()=>{
      const names=collectProgramNamesFromDocument(document,new Map());
      let frame=null;
      let loaded=false;
      let steps=0;

      try {
        frame=document.createElement("iframe");
        frame.setAttribute("aria-hidden","true");
        frame.setAttribute("tabindex","-1");
        frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms");
        frame.style.cssText=[
          "position:fixed",
          "inset:0",
          "width:100vw",
          "height:100vh",
          "opacity:0",
          "pointer-events:none",
          "border:0",
          "z-index:-2147483647",
          "background:transparent"
        ].join(";");
        frame.src=location.href;

        const loadPromise=new Promise(resolve=>{
          const done=()=>{ loaded=true; resolve(); };
          frame.addEventListener("load",done,{once:true});
          setTimeout(resolve,8000);
        });

        (document.body || document.documentElement).appendChild(frame);
        await loadPromise;

        if(!loaded) {
          return {
            ok:true,
            partial:true,
            pageType:detectPageType(),
            programNames:[...names.values()],
            error:"Off-screen inventory frame timed out."
          };
        }

        const doc=frame.contentDocument;
        const win=frame.contentWindow;

        if(!doc || !win) {
          return {
            ok:true,
            partial:true,
            pageType:detectPageType(),
            programNames:[...names.values()],
            error:"Off-screen inventory frame was unavailable."
          };
        }

        // Give Office Puzzle's SPA a short mount window, then walk every real
        // scroll container inside the invisible frame. This triggers the same
        // lazy loading as a human scroll without touching the user's page.
        await sleep(450);
        collectProgramNamesFromDocument(doc,names);

        for(const target of offscreenScrollableTargets(doc,win)) {
          steps+=await scanOffscreenTarget(target,doc,win,names);
        }

        // One final wait catches sections appended after the last bottom event.
        await sleep(220);
        collectProgramNamesFromDocument(doc,names);

        const programNames=[...names.values()];
        offscreenInventoryCache={key,programNames,at:Date.now()};

        const authoritative=
          scanComplete &&
          scannedTargets===targets.length &&
          programNames.length>0;

        if(authoritative) {
          await saveLearnedInventoryEnd(programNames);
        }

        return {
          ok:true,
          scanned:true,
          offscreen:true,
          steps,
          pageType:detectPageType(),
          programNames
        };
      } catch(err) {
        return {
          ok:true,
          partial:true,
          pageType:detectPageType(),
          programNames:[...names.values()],
          error:String(err?.message || err)
        };
      } finally {
        try { frame?.remove(); } catch(_) {}
        offscreenInventoryScanPromise=null;
      }
    })();

    return offscreenInventoryScanPromise;
  }

  function runNoPaintMainPageWarmup() {
    if(clinicalWriteBusy) return {ok:true,skipped:true};

    const target=silentScanScrollTarget();
    if(!target) return {ok:true,skipped:true};

    const root=document.scrollingElement || document.documentElement;
    const original=silentTargetScrollTop(target);
    let steps=0;

    // Do not await/yield anywhere in this function. Browser painting happens
    // after the JS task completes, so the user never sees these temporary
    // positions. This wakes synchronous/virtualized scroll loaders and then
    // restores the exact original position before the next frame.
    try {
      for(let pass=0; pass<2; pass++) {
        const viewport=Math.max(
          300,
          target===root ? (window.innerHeight || 700) : (target.clientHeight || 700)
        );
        const extent=Math.max(0,(target.scrollHeight || 0)-viewport);
        const jump=Math.max(240,Math.floor(viewport*.78));

        for(let top=0; top<=extent; top+=jump) {
          silentSetScrollTop(target,top);
          try { target.dispatchEvent(new Event("scroll",{bubbles:true})); } catch(_) {}
          // Force geometry so synchronous virtualizers finish this position
          // before the next one is sampled.
          void target.scrollHeight;
          steps++;
          if(steps>=120) break;
        }

        silentSetScrollTop(target,extent);
        try { target.dispatchEvent(new Event("scroll",{bubbles:true})); } catch(_) {}
        void target.scrollHeight;

        if(steps>=120) break;
      }
    } finally {
      silentSetScrollTop(target,original);
      try { target.dispatchEvent(new Event("scroll",{bubbles:true})); } catch(_) {}
    }

    programStructureRevision++;
    invalidateReadCaches();
    return {ok:true,warmed:true,steps};
  }

  let silentFullScanPending=false;
  let silentFullScanRunning=false;
  let silentFullScanAbortRequested=false;
  let silentFullScanRestoreTarget=null;
  let silentFullScanRestoreTop=0;

  function silentScanScrollTarget() {
    const root=document.scrollingElement || document.documentElement;
    let best=root;
    let bestRange=Math.max(0,(root?.scrollHeight || 0)-(root?.clientHeight || 0));

    // Office Puzzle can use a nested SPA scroller. Sample likely containers and
    // choose the one with the largest real vertical scroll range.
    const candidates=document.querySelectorAll(
      "main,[role='main'],.content,.main-content,.page-content,.scroll-container,.overflow-auto,.overflow-y-auto"
    );

    for(const el of candidates) {
      const range=Math.max(0,(el.scrollHeight || 0)-(el.clientHeight || 0));
      if(range<=bestRange || el.clientHeight<240) continue;

      const style=getComputedStyle(el);
      if(!/(auto|scroll|overlay)/i.test(style.overflowY || "")) continue;

      best=el;
      bestRange=range;
    }

    return best;
  }

  function silentTargetScrollTop(target) {
    const root=document.scrollingElement || document.documentElement;
    return target===root ? window.scrollY : target.scrollTop;
  }

  function silentSetScrollTop(target,value) {
    const root=document.scrollingElement || document.documentElement;
    if(target===root) {
      window.scrollTo({top:value,left:window.scrollX,behavior:"auto"});
    } else {
      target.scrollTop=value;
    }
  }

  function createLiveScanFreezeOverlay(imageDataUrl="") {
    if(document.visibilityState==="hidden") return null;

    const overlay=document.createElement("div");
    overlay.id="rbt-live-scan-freeze";
    overlay.setAttribute("aria-hidden","true");
    overlay.style.cssText=[
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "overflow:hidden",
      "pointer-events:auto",
      "margin:0",
      "padding:0",
      "border:0"
    ].join(";");

    if(imageDataUrl) {
      const img=document.createElement("img");
      img.alt="";
      img.draggable=false;
      img.src=imageDataUrl;
      img.style.cssText=[
        "display:block",
        "width:100%",
        "height:100%",
        "object-fit:fill",
        "margin:0",
        "padding:0",
        "border:0",
        "user-select:none"
      ].join(";");
      overlay.appendChild(img);
    } else {
      // Caller normally defers visible scans when no screenshot is available.
      // Keep this fallback transparent so a capture failure can never strand
      // the user behind a gray page.
      overlay.style.background="transparent";
      overlay.style.pointerEvents="none";
    }

    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function realScanTargets() {
    const root=document.scrollingElement || document.documentElement;
    const rootViewport=Math.max(0,window.innerHeight || root?.clientHeight || 0);
    const rootRange=Math.max(0,(root?.scrollHeight || 0)-rootViewport);

    // Office Puzzle's behavior/replacement inventory is lazy-loaded by
    // scrolling the SITE itself to the bottom. Prefer the real document
    // scroller whenever it has meaningful range; do not sweep multiple random
    // containers. That was both slower and less reliable.
    if(root && rootRange>=80) return [root];

    // Fallback only for an SPA that truly owns scrolling in one nested pane.
    let best=null;
    let bestRange=0;
    for(const el of document.querySelectorAll(
      "main,[role='main'],.content,.main-content,.page-content,.scroll-container,.overflow-auto,.overflow-y-auto,[style*='overflow']"
    )) {
      if(el.clientHeight<220) continue;
      const style=getComputedStyle(el);
      if(!/(auto|scroll|overlay)/i.test(style.overflowY || "")) continue;
      const range=Math.max(0,(el.scrollHeight || 0)-(el.clientHeight || 0));
      if(range>bestRange) {
        best=el;
        bestRange=range;
      }
    }

    return best && bestRange>=80 ? [best] : (root ? [root] : []);
  }

  function realScanTargetTop(target) {
    const root=document.scrollingElement || document.documentElement;
    return target===root ? window.scrollY : target.scrollTop;
  }

  function realScanSetTop(target,value) {
    const root=document.scrollingElement || document.documentElement;
    if(target===root) {
      window.scrollTo({top:value,left:window.scrollX,behavior:"auto"});
    } else {
      target.scrollTop=value;
      try { target.dispatchEvent(new Event("scroll",{bubbles:true})); } catch(_) {}
    }
  }

  function dispatchRealScrollSignals(target) {
    const root=document.scrollingElement || document.documentElement;

    try { target?.dispatchEvent?.(new Event("scroll",{bubbles:true})); } catch(_) {}

    if(target===root) {
      try { window.dispatchEvent(new Event("scroll")); } catch(_) {}
      try { document.dispatchEvent(new Event("scroll",{bubbles:true})); } catch(_) {}
      try { document.documentElement?.dispatchEvent(new Event("scroll",{bubbles:true})); } catch(_) {}
      try { document.body?.dispatchEvent(new Event("scroll",{bubbles:true})); } catch(_) {}
    }
  }

  function collectLiveScanProgramNames(names) {
    // One revision-cached inventory pass is enough. The old implementation
    // reparsed the same body text through multiple independent collectors on
    // every 38 ms lazy-load poll. baseProgramNameCandidates() combines those
    // sources and is cached until the DOM structure actually changes.
    try {
      for(const item of baseProgramNameCandidates()) {
        const name=cleanProgramCandidate(item?.name);
        const key=normalize(name);
        if(name && key && !names.has(key)) names.set(key,name);
      }
    } catch(_) {}

    const current=cleanProgramCandidate(detectCurrentName());
    const currentKey=normalize(current);
    if(current && currentKey && !names.has(currentKey)) names.set(currentKey,current);

    return names;
  }

  function dispatchHumanLikeScrollSignals(target,deltaY=0) {
    dispatchRealScrollSignals(target);
    const root=document.scrollingElement || document.documentElement;
    const wheelTarget=target===root ? window : target;
    try {
      wheelTarget.dispatchEvent(new WheelEvent("wheel",{
        bubbles:true,
        cancelable:false,
        deltaY:Number(deltaY || 0),
        deltaMode:0
      }));
    } catch(_) {}
  }

  async function waitForLazyBottomProgress(target,{height,revision,nameCount,timeout=1450}={}) {
    const started=Date.now();

    while(Date.now()-started<timeout) {
      await sleep(110);
      collectProgramNamesFromDocument(document,new Map());

      const currentHeight=Math.max(0,target?.scrollHeight || 0);
      const currentRevision=programStructureRevision;

      if(
        currentHeight>height+8 ||
        currentRevision>revision
      ) {
        return {
          changed:true,
          height:currentHeight,
          revision:currentRevision
        };
      }
    }

    return {
      changed:false,
      height:Math.max(0,target?.scrollHeight || 0),
      revision:programStructureRevision
    };
  }

  function learnedInventoryEndStorageKey() {
    const client=normalize(detectClientLabel()) || "client";
    const page=detectPageType() || "officepuzzle";
    return `rbtInventoryEndV2::${location.origin}${location.pathname}::${client}::${page}`;
  }

  function storageLocalGetOne(key) {
    return new Promise(resolve=>{
      try {
        chrome.storage.local.get([key],result=>{
          if(chrome.runtime?.lastError) return resolve(null);
          resolve(result?.[key] || null);
        });
      } catch(_) { resolve(null); }
    });
  }

  function storageLocalSetOne(key,value) {
    return new Promise(resolve=>{
      try {
        chrome.storage.local.set({[key]:value},()=>resolve(true));
      } catch(_) { resolve(false); }
    });
  }

  async function loadLearnedInventoryEnd() {
    const key=learnedInventoryEndStorageKey();
    const value=await storageLocalGetOne(key);
    if(!value || !Number.isFinite(Number(value.count)) || Number(value.count)<1) return null;

    return {
      key,
      count:Number(value.count),
      tail:Array.isArray(value.tail) ? value.tail.map(normalize).filter(Boolean).slice(-3) : [],
      names:Array.isArray(value.names)
        ? value.names.map(name=>String(name || "").trim()).filter(Boolean)
        : [],
      updatedAt:Number(value.updatedAt || 0)
    };
  }

  async function saveLearnedInventoryEnd(programNames) {
    const list=(programNames || []).map(name=>String(name || "").trim()).filter(Boolean);
    if(!list.length) return false;

    const key=learnedInventoryEndStorageKey();
    return await storageLocalSetOne(key,{
      count:list.length,
      tail:list.slice(-3),
      names:[...list],
      updatedAt:Date.now()
    });
  }

  function learnedInventoryMatches(names,learnedEnd) {
    if(!learnedEnd || names.size!==learnedEnd.count) return false;
    if(!learnedEnd.tail?.length) return true;
    return learnedEnd.tail.every(key=>names.has(key));
  }

  async function scanActualLazyTarget(target,names,{maxMs=6500,learnedEnd=null}={}) {
    const root=document.scrollingElement || document.documentElement;
    const original=realScanTargetTop(target);
    const originalX=window.scrollX;
    const started=Date.now();
    let bottomPasses=0;
    let stableBottomPasses=0;
    let steps=0;
    let complete=false;
    let learnedEndConfirmed=false;

    const MAX_BOTTOM_PASSES=24;
    const STABLE_BOTTOM_PASSES_TO_FINISH=2;
    const styleTarget=target===root ? document.documentElement : target;
    const oldScrollBehavior=styleTarget?.style?.scrollBehavior || "";
    const oldScrollSnapType=styleTarget?.style?.scrollSnapType || "";

    const viewport=()=>Math.max(
      300,
      target===root
        ? (window.innerHeight || root?.clientHeight || 700)
        : (target.clientHeight || 700)
    );

    const bottomTop=()=>Math.max(0,(target?.scrollHeight || 0)-viewport());

    try {
      if(styleTarget?.style) {
        styleTarget.style.scrollBehavior="auto";
        styleTarget.style.scrollSnapType="none";
      }

      // Capture what is currently mounted first, then start from the top. The
      // actual Office Puzzle page is the lazy-loader; no clone/tab is involved.
      collectLiveScanProgramNames(names);
      realScanSetTop(target,0);
      dispatchHumanLikeScrollSignals(target,-viewport());
      await sleep(18);
      collectLiveScanProgramNames(names);

      while(
        Date.now()-started<maxMs &&
        bottomPasses<MAX_BOTTOM_PASSES &&
        !complete
      ) {
        const beforeHeight=Math.max(0,target?.scrollHeight || 0);
        const beforeRevision=programStructureRevision;
        const beforeNames=names.size;
        const bottom=bottomTop();

        // This is the important part: hit the REAL current bottom. Office
        // Puzzle appends the next behavior/replacement batch only after this
        // position is reached.
        realScanSetTop(target,bottom);
        dispatchHumanLikeScrollSignals(target,Math.max(viewport(),bottom));
        steps++;
        bottomPasses++;

        // Burst-poll the lazy request. As soon as Office Puzzle appends the next
        // section, chase the NEW bottom immediately instead of sitting in a
        // long fixed wait.
        let grew=false;
        const waitStarted=Date.now();
        while(Date.now()-waitStarted<520 && Date.now()-started<maxMs) {
          await sleep(38);

          const h=Math.max(0,target?.scrollHeight || 0);
          if(
            h>beforeHeight+6 ||
            programStructureRevision>beforeRevision
          ) {
            // Parse names once when the DOM actually changed, not on every
            // polling tick while Office Puzzle is waiting on the network.
            collectLiveScanProgramNames(names);
            grew=true;
            break;
          }
        }

        if(grew) {
          stableBottomPasses=0;
          // Give the appended batch only a tiny paint/mount window, capture it,
          // then chase the new bottom immediately.
          await sleep(24);
          collectLiveScanProgramNames(names);
          continue;
        }

        // One short real nudge re-triggers debounced IntersectionObserver /
        // scroll handlers without sitting at the bottom for seconds.
        const extent=bottomTop();
        if(extent>96) {
          realScanSetTop(target,Math.max(0,extent-96));
          dispatchHumanLikeScrollSignals(target,-96);
          await sleep(24);
          realScanSetTop(target,extent);
          dispatchHumanLikeScrollSignals(target,96);
          await sleep(95);
          collectLiveScanProgramNames(names);
        }

        const afterHeight=Math.max(0,target?.scrollHeight || 0);
        const afterGrew=
          afterHeight>beforeHeight+6 ||
          programStructureRevision>beforeRevision ||
          names.size>beforeNames;

        stableBottomPasses=afterGrew ? 0 : stableBottomPasses+1;

        if(!afterGrew && learnedInventoryMatches(names,learnedEnd)) {
          // We have reached the exact inventory end learned on a previous
          // successful scan for this client/page. Give Office Puzzle one final
          // short chance to append a newly-added program; if nothing changes,
          // stop after ONE stable bottom pass instead of auditing the bottom
          // twice on every visit.
          const confirmHeight=Math.max(0,target?.scrollHeight || 0);
          const confirmRevision=programStructureRevision;
          const confirmCount=names.size;
          await sleep(190);
          collectLiveScanProgramNames(names);

          const learnedStillExact=
            Math.max(0,target?.scrollHeight || 0)<=confirmHeight+6 &&
            programStructureRevision<=confirmRevision &&
            names.size===confirmCount &&
            learnedInventoryMatches(names,learnedEnd);

          if(learnedStillExact) {
            learnedEndConfirmed=true;
            complete=true;
            break;
          }

          stableBottomPasses=0;
          continue;
        }

        if(stableBottomPasses>=STABLE_BOTTOM_PASSES_TO_FINISH) {
          complete=true;
        }
      }
    } finally {
      // Snap back before the freeze image is removed. If no freeze image was
      // available, this still restores the exact user position immediately.
      if(target===root) {
        window.scrollTo({top:original,left:originalX,behavior:"auto"});
      } else {
        realScanSetTop(target,original);
      }
      dispatchHumanLikeScrollSignals(target,0);

      if(styleTarget?.style) {
        styleTarget.style.scrollBehavior=oldScrollBehavior;
        styleTarget.style.scrollSnapType=oldScrollSnapType;
      }
    }

    return {
      steps,
      bottomPasses,
      stableBottomPasses,
      programCount:names.size,
      durationMs:Date.now()-started,
      finalHeight:Math.max(0,target?.scrollHeight || 0),
      finalRevision:programStructureRevision,
      complete,
      learnedEndConfirmed
    };
  }

  let liveFullInventoryScanPromise=null;

  async function scanFullProgramInventoryOnActualPage({freezeImage="",force=false}={}) {
    if(liveFullInventoryScanPromise) return liveFullInventoryScanPromise;

    liveFullInventoryScanPromise=(async()=>{
      if(clinicalWriteBusy) {
        return {ok:true,pending:true,programNames:[...collectProgramNamesFromDocument(document,new Map()).values()]};
      }

      const key=`${location.origin}${location.pathname}${location.search}::${detectPageType()}`;
      const names=collectLiveScanProgramNames(new Map());
      const learnedEnd=await loadLearnedInventoryEnd();

      // Once a complete inventory was learned for this client/page, normal UI
      // activity should never move the Office Puzzle page again. Return the
      // persisted full list immediately. Only an explicit force refresh relearns.
      if(!force && learnedEnd?.names?.length) {
        return {
          ok:true,
          scanned:false,
          remembered:true,
          actualPage:true,
          authoritative:true,
          pageType:detectPageType(),
          steps:0,
          durationMs:0,
          programNames:[...learnedEnd.names]
        };
      }

      const targets=realScanTargets();
      const positions=targets.map(target=>({target,top:realScanTargetTop(target)}));

      const overlay=createLiveScanFreezeOverlay(freezeImage);
      let steps=0;
      let scannedTargets=0;
      let scanComplete=targets.length>0;
      const started=Date.now();

      try {
        // Scan the REAL Office Puzzle DOM progressively. This intentionally
        // walks through every lazy-loaded segment instead of jumping to bottom.
        for(const target of targets) {
          const remaining=Math.max(1400,6500-(Date.now()-started));
          const result=await scanActualLazyTarget(target,names,{
            maxMs:remaining,
            learnedEnd
          });
          steps+=result.steps;
          scannedTargets++;
          scanComplete=scanComplete && !!result.complete;
          if(Date.now()-started>=6500) {
            scanComplete=false;
            break;
          }
        }

        // Give the final bottom-triggered request one last mount window.
        await sleep(120);
        collectLiveScanProgramNames(names);

        programStructureRevision++;
        invalidateReadCaches();
        emitDiscoveryHint("real-full-page");

        const programNames=[...names.values()];
        offscreenInventoryCache={key,programNames,at:Date.now()};

        const authoritative=
          scanComplete &&
          scannedTargets===targets.length &&
          programNames.length>0;

        if(authoritative) {
          await saveLearnedInventoryEnd(programNames);
        }

        return {
          ok:true,
          scanned:true,
          actualPage:true,
          authoritative,
          pageType:detectPageType(),
          steps,
          durationMs:Date.now()-started,
          programNames
        };
      } finally {
        // Restore every sampled scroll container before revealing the page.
        for(const {target,top} of positions) {
          try { realScanSetTop(target,top); } catch(_) {}
        }

        // Restoring the virtualized Office Puzzle viewport can remount the
        // selected program/date table on the next few animation frames. Ensure
        // the side panel's post-scan GET_CONTEXT cannot reuse a bottom-of-page
        // cache or sample the table before that restore has settled.
        invalidateReadCaches();
        await sleep(90);
        invalidateReadCaches();

        try { overlay?.remove(); } catch(_) {}
        liveFullInventoryScanPromise=null;
      }
    })();

    return liveFullInventoryScanPromise;
  }

  async function runSilentFullPageScan() {
    if(silentFullScanRunning) return {ok:true,running:true};

    // Never move a page the user can currently see. The scan is queued and
    // starts automatically the moment Chrome backgrounds the Office Puzzle tab.
    if(document.visibilityState!=="hidden" || clinicalWriteBusy) {
      silentFullScanPending=true;
      return {ok:true,pending:true};
    }

    silentFullScanPending=false;
    silentFullScanRunning=true;
    silentFullScanAbortRequested=false;

    const target=silentScanScrollTarget();
    const original=silentTargetScrollTop(target);
    silentFullScanRestoreTarget=target;
    silentFullScanRestoreTop=original;
    let steps=0;
    let stableBottomPasses=0;
    let previousExtent=-1;

    try {
      // Start at the top and walk the lazy page in viewport-sized jumps. New
      // content may extend the page while we scan, so the extent is re-read on
      // every pass instead of being captured once.
      silentSetScrollTop(target,0);
      await sleep(80);

      while(steps<90 && stableBottomPasses<2) {
        if(
          silentFullScanAbortRequested ||
          document.visibilityState!=="hidden"
        ) {
          silentFullScanPending=true;
          break;
        }

        const viewport=Math.max(320,target.clientHeight || window.innerHeight || 700);
        const extent=Math.max(0,(target.scrollHeight || 0)-viewport);
        const current=silentTargetScrollTop(target);
        const next=Math.min(extent,current + Math.max(260,Math.floor(viewport*.82)));

        silentSetScrollTop(target,next);
        await sleep(95);
        steps++;

        const newViewport=Math.max(320,target.clientHeight || window.innerHeight || 700);
        const newExtent=Math.max(0,(target.scrollHeight || 0)-newViewport);
        const atBottom=silentTargetScrollTop(target)>=newExtent-8;

        if(atBottom) {
          await sleep(180);
          const afterExtent=Math.max(0,(target.scrollHeight || 0)-newViewport);
          if(afterExtent===previousExtent || afterExtent===newExtent) {
            stableBottomPasses++;
          } else {
            stableBottomPasses=0;
          }
          previousExtent=afterExtent;
        } else {
          stableBottomPasses=0;
          previousExtent=newExtent;
        }
      }

      // Restore the exact user position before the tab can become visible again.
      silentSetScrollTop(target,original);
      await sleep(90);

      if(
        silentFullScanAbortRequested ||
        document.visibilityState!=="hidden"
      ) {
        silentFullScanPending=true;
        return {ok:true,pending:true,abortedForVisibility:true,steps};
      }

      programStructureRevision++;
      invalidateReadCaches();
      emitDiscoveryHint("silent-full-page");

      return {ok:true,scanned:true,steps};
    } finally {
      silentSetScrollTop(target,original);
      silentFullScanRunning=false;
      silentFullScanAbortRequested=false;
      silentFullScanRestoreTarget=null;
      silentFullScanRestoreTop=0;
    }
  }

  function maybeRunPendingSilentFullScan() {
    if(
      silentFullScanPending &&
      !silentFullScanRunning &&
      !clinicalWriteBusy &&
      document.visibilityState==="hidden"
    ) {
      setTimeout(()=>{
        runSilentFullPageScan().catch(()=>{});
      },120);
    }
  }

  document.addEventListener("visibilitychange",()=>{
    if(
      document.visibilityState!=="hidden" &&
      silentFullScanRunning &&
      silentFullScanRestoreTarget
    ) {
      // Restore synchronously before the foreground tab can paint the hidden
      // scan position. The unfinished scan remains queued for the next time
      // the tab is backgrounded.
      silentFullScanAbortRequested=true;
      silentFullScanPending=true;
      silentSetScrollTop(
        silentFullScanRestoreTarget,
        silentFullScanRestoreTop
      );
      return;
    }

    maybeRunPendingSilentFullScan();
  });

  let discoveryHintTimer=null;
  let lastDiscoveryHintAt=0;
  let lastScrollHintBottom=0;

  function emitDiscoveryHint(reason) {
    const urgent=reason==="route" || reason==="data-page-change";
    if(!urgent && (clinicalWriteBusy || Date.now()<discoverySuppressedUntil)) return;

    clearTimeout(discoveryHintTimer);
    const minimumGap=reason==="data" ? 180 : 450;
    const delay=urgent ? 20 : (reason==="data" ? 140 : 220);

    discoveryHintTimer=setTimeout(()=>{
      const now=Date.now();
      if(!urgent && now-lastDiscoveryHintAt<minimumGap) return;
      lastDiscoveryHintAt=now;

      try {
        const response=chrome.runtime.sendMessage({
          type:"RBT_DISCOVERY_HINT",
          reason,
          domRevision:programStructureRevision
        });
        if(response?.catch) response.catch(()=>{});
      } catch(_) {
        // Side panel may be closed; normal scanning resumes when reopened.
      }
    },delay);
  }

  // Office Puzzle is a SPA. URL changes can happen before its old client table
  // has finished unmounting, so invalidate the cached context immediately and
  // ask the side panel to re-check the data-page gate. This makes "Select a
  // client" appear when the user leaves the actual collection screen instead
  // of waiting for the 8-second heartbeat.
  let lastObservedHref=location.href;

  function noteRouteChange() {
    if(location.href===lastObservedHref) return;
    lastObservedHref=location.href;
    programStructureRevision++;
    invalidateReadCaches();
    emitDiscoveryHint("route");
  }

  for(const method of ["pushState","replaceState"]) {
    try {
      const original=history[method];
      if(typeof original!=="function") continue;
      history[method]=function(...args) {
        const result=original.apply(this,args);
        queueMicrotask(noteRouteChange);
        return result;
      };
    } catch(_) {}
  }

  window.addEventListener("popstate",()=>queueMicrotask(noteRouteChange));
  window.addEventListener("hashchange",()=>queueMicrotask(noteRouteChange));

  // pushState/replaceState can be invoked from Office Puzzle's page world,
  // while this extension runs in an isolated world. Keep a lightweight href
  // fallback, but do not wake the tab four times per second forever. DOM/route
  // hints remain the primary path; this timer is only a safety net.
  let routeFallbackTimer=null;
  function scheduleRouteFallbackWatch() {
    if(routeFallbackTimer) clearTimeout(routeFallbackTimer);
    const delay=document.visibilityState==="visible" ? 1500 : 5000;
    routeFallbackTimer=setTimeout(()=>{
      routeFallbackTimer=null;
      noteRouteChange();
      scheduleRouteFallbackWatch();
    },delay);
  }
  document.addEventListener("visibilitychange",scheduleRouteFallbackWatch);
  scheduleRouteFallbackWatch();

  window.addEventListener(
    "scroll",
    ()=>{
      // Scrolling over the same content should not wake the extension over and
      // over. Only crossing meaningful new page depth sends the fallback hint.
      const bottom=Math.round(window.scrollY+window.innerHeight);
      if(bottom<=lastScrollHintBottom+240) return;
      lastScrollHintBottom=bottom;
      emitDiscoveryHint("scroll");
    },
    {passive:true}
  );

  function discoveryRelevantNode(node) {
    if(!node || node.nodeType!==Node.ELEMENT_NODE) return false;

    const element=node;

    if(
      element.matches?.(
        "table,tr,select,option,[data-program],[data-program-name]," +
        "[data-behavior],[data-behaviour],[data-skill],[data-target]"
      )
    ) {
      return true;
    }

    if(
      element.querySelector?.(
        "table,tr,select,option,[data-program],[data-program-name]," +
        "[data-behavior],[data-behaviour],[data-skill],[data-target]"
      )
    ) {
      return true;
    }

    const shortText=String(element.textContent || "")
      .replace(/\s+/g," ")
      .trim()
      .slice(0,1200);

    return /\b(?:Name|Collection Method|Behavior|Behaviour|Replacement|Acquisition Skill|Program)\s*:/i.test(
      shortText
    );
  }

  function mutationTargetInsideTable(mutation) {
    const target=mutation?.target;
    const element=
      target?.nodeType===Node.ELEMENT_NODE
        ? target
        : target?.parentElement;

    return !!element?.closest?.("table");
  }

  const discoveryMutationObserver=new MutationObserver(mutations=>{
    // Clinical cell writes can generate a burst of table mutations. They are
    // verified by the writer itself and cannot change the page inventory, so
    // skip normal discovery work until the write/cooldown completes. Preserve
    // one cheap safety signal if the actual data table is removed mid-write.
    if(clinicalWriteBusy || Date.now()<discoverySuppressedUntil) {
      const removedDataTable=mutations.some(mutation=>
        mutation.type==="childList" &&
        [...(mutation.removedNodes || [])].some(node=>
          node?.nodeType===Node.ELEMENT_NODE &&
          (node.matches?.("table") || node.querySelector?.("table"))
        )
      );
      if(removedDataTable) emitDiscoveryHint("data-page-change");
      return;
    }

    let removedRelevant=false;
    const relevant=mutations.some(mutation=>{
      if(mutation.type!=="childList") return false;

      const added=[...(mutation.addedNodes || [])];
      const removed=[...(mutation.removedNodes || [])];
      const addedRelevant=added.some(discoveryRelevantNode);
      const thisRemovedRelevant=removed.some(discoveryRelevantNode);
      if(thisRemovedRelevant) removedRelevant=true;
      return addedRelevant || thisRemovedRelevant;
    });

    // A value/symbol changing inside an existing table is clinical data, not a
    // new program inventory. Emit a separate cheap hint so the side panel can
    // reread the mounted table without waking the full scroll scanner.
    const dataChanged=!relevant && mutations.some(mutation=>
      (mutation.type==="childList" || mutation.type==="characterData") &&
      mutationTargetInsideTable(mutation)
    );

    if(relevant || dataChanged) {
      programStructureRevision++;
      invalidateReadCaches();

      if(relevant) {
        // Removing the live data table is more urgent than ordinary lazy-loading:
        // it usually means the user just left a client's collection page.
        emitDiscoveryHint(removedRelevant ? "data-page-change" : "dom");
      } else {
        emitDiscoveryHint("data");
      }
    }
  });

  if(document.documentElement) {
    discoveryMutationObserver.observe(document.documentElement,{
      childList:true,
      characterData:true,
      subtree:true
    });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;

    if (msg.type === "GET_CONTEXT") {
      sendResponse(buildContextSnapshot());
      return;
    }

    if (msg.type === "SET_SELECTED_DATE") {
      setSelectedDateOnPage(msg.targetDate)
        .then(sendResponse)
        .catch(err=>sendResponse({ok:false,error:String(err?.message || err)}));
      return true;
    }

    if (msg.type === "PREPARE_SILENT_FULL_SCAN") {
      // v1.1.71: scan the ACTUAL Office Puzzle page because its behavior / skill
      // inventory is appended only when the real page reaches the true bottom.
      // A frozen viewport hides the automated scroll and the exact scroll
      // position is restored before control returns to the user.
      scanFullProgramInventoryOnActualPage({
        freezeImage:String(msg.freezeImage || ""),
        force:!!msg.force
      })
        .then(sendResponse)
        .catch(err=>sendResponse({
          ok:false,
          error:String(err?.message || err),
          programNames:[...collectProgramNamesFromDocument(document,new Map()).values()]
        }));
      return true;
    }

    if (msg.type === "DISCOVER_CLIENT_PROGRAMS") {
      discoverClientPrograms()
        .then(result=>sendResponse({
          ok:true,
          ...result,
          domRevision:programStructureRevision
        }))
        .catch(err=>sendResponse({
          ok:false,
          error:String(err?.message || err),
          programs:[]
        }));
      return true;
    }

    if (msg.type === "SCAN_ALL_CLIENT2_CHALLENGING") {
      scanAllClient2Challenging()
        .then(result=>sendResponse({ok:true,...result}))
        .catch(err=>sendResponse({
          ok:false,
          error:String(err?.message || err),
          challenging:[]
        }));
      return true;
    }

    if (msg.type === "SCAN_ALL_CLIENT2_REPLACEMENTS") {
      scanAllClient2Replacements()
        .then(result=>sendResponse({ok:true,...result}))
        .catch(err=>sendResponse({
          ok:false,
          error:String(err?.message || err),
          replacements:[]
        }));
      return true;
    }

    if (msg.type === "SCAN_CURRENT_CLIENT2_REPLACEMENT") {
      scanCurrentClient2Replacement()
        .then(result=>sendResponse({ok:true,...result}))
        .catch(err=>sendResponse({ok:false,error:String(err?.message || err)}));
      return true;
    }

    if (msg.type === "SCAN_CURRENT_CHALLENGING") {
      scanCurrentChallenging()
        .then(result=>sendResponse({ok:true,...result}))
        .catch(err=>sendResponse({ok:false,error:String(err?.message || err)}));
      return true;
    }

    if (msg.type === "SCAN_ALL_BEHAVIORS") {
      scanAllBehaviorsLite()
        .then(result => sendResponse({ ok:true, ...result }))
        .catch(err => sendResponse({ ok:false, error:String(err?.message || err), behaviors:[] }));
      return true;
    }

    if (msg.type === "SCAN_ALL_REPLACEMENTS") {
      scanAllReplacementsLite()
        .then(result => sendResponse({ ok:true, ...result }))
        .catch(err => sendResponse({ ok:false, error:String(err?.message || err), replacements:[] }));
      return true;
    }

    if (msg.type === "ABORT_ACTIVE_WRITE") {
      requestActiveWriteAbort();
      sendResponse({ ok:true, aborted:true });
      return;
    }

    if (msg.type === "ARM_WRITE") {
      armWrite(msg.token);
      sendResponse({ ok:true, armed:true });
      return;
    }

    if (msg.type === "CLEAR_SELECTED_COLUMN") {
      if (!consumeWriteToken(msg.writeToken)) {
        sendResponse({
          ok:false,
          error:"Write blocked by safe mode. Use Clear selected column in RBT Assistant."
        });
        return;
      }

      resetActiveWriteAbort();
      sendClinicalWriteResult(
        clearSelectedColumnViaGear(
          msg.mapping,
          msg.writerKind
        ),
        sendResponse
      );

      return true;
    }

    if (msg.type === "SET_BEHAVIOR_COUNT") {
      if (!consumeWriteToken(msg.writeToken)) {
        sendResponse({
          ok:false,
          error:"Write blocked by safe mode. Use the Apply button in RBT Assistant."
        });
        return;
      }

      const target = Number(msg.target);
      resetActiveWriteAbort();
      sendClinicalWriteResult(
        setBehaviorCount(msg.mapping, target, !!msg.replaceExisting),
        sendResponse
      );

      return true;
    }

    if (msg.type === "SET_CLIENT2_REPLACEMENT_TRIALS") {
      if (!consumeWriteToken(msg.writeToken)) {
        sendResponse({
          ok:false,
          error:"Write blocked by safe mode. Use the Review & apply button."
        });
        return;
      }

      resetActiveWriteAbort();
      sendClinicalWriteResult(
        setClient2ReplacementTrials(
          msg.mapping,
          msg.desiredStates
        ),
        sendResponse
      );

      return true;
    }

    if (msg.type === "SET_CHALLENGING_INTERVALS") {
      if (!consumeWriteToken(msg.writeToken)) {
        sendResponse({
          ok:false,
          error:"Write blocked by safe mode. Use the Review & apply button."
        });
        return;
      }

      resetActiveWriteAbort();
      sendClinicalWriteResult(
        setChallengingIntervals(
          msg.mapping,
          msg.desiredStates,
          msg.activeIntervals
        ),
        sendResponse
      );

      return true;
    }

    if (msg.type === "SET_REPLACEMENT_TRIALS") {
      if (!consumeWriteToken(msg.writeToken)) {
        sendResponse({
          ok:false,
          error:"Write blocked by safe mode. Use the Apply reviewed trials button."
        });
        return;
      }

      resetActiveWriteAbort();
      sendClinicalWriteResult(
        setReplacementTrials(msg.mapping, msg.desiredStates),
        sendResponse
      );

      return true;
    }

    if (msg.type === "START_PICKER") {
      startPicker(sendResponse);
      return true;
    }

    if (msg.type === "FILL_FIELD") {
      if (!consumeWriteToken(msg.writeToken)) {
        sendResponse({
          ok:false,
          error:"Write blocked by safe mode. Use the explicit fill action in RBT Assistant."
        });
        return;
      }

      try {
        const el = document.querySelector(msg.selector);
        if (!el) {
          sendResponse({ ok:false, error:"Saved field was not found on this page." });
          return;
        }

        setNativeValue(el, String(msg.value ?? ""));
        sendResponse({ ok:true });
      } catch (err) {
        sendResponse({ ok:false, error:String(err?.message || err) });
      }
    }
  });
})();
