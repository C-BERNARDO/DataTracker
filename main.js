/* ─────────────────────────────────────────────────────────────
   DataTracker — main.js
───────────────────────────────────────────────────────────── */

let records = [];
let otpWaiverMap = {}; // normalized ACCOUNT NUMBER -> { penalty, interest }
let lssWaiverMap = {}; // normalized ACCOUNT NUMBER -> LSS sheet fields
let otpSheetFound = false; // whether the "PENALTY & INTEREST" sheet was present in the uploaded file
let lssSheetFound = false; // whether the "LSS" sheet was present in the uploaded file

/* ── DOM refs ──────────────────────────────────────────────── */
const fileInput      = document.getElementById('fileInput');
const uploadZone     = document.getElementById('uploadZone');
const uploadSection  = document.getElementById('uploadSection');
const trackerSection = document.getElementById('trackerSection');
const searchInput    = document.getElementById('searchInput');
const clearBtn       = document.getElementById('clearBtn');
const resultsList    = document.getElementById('resultsList');
const emptyState     = document.getElementById('emptyState');
const noResults      = document.getElementById('noResults');
const statsBar       = { style: { display: '' } }; // stub — footer removed
const statsText      = { textContent: '' };          // stub — footer removed
const reloadBtn      = document.getElementById('reloadBtn');

// Topbar dynamic elements
const topbarStats      = document.getElementById('topbarStats');
const matchStat        = document.getElementById('matchStat');
const matchLabel       = document.getElementById('matchLabel');
const fileLoadingOverlay = document.getElementById('fileLoadingOverlay');
const flFilename         = document.getElementById('flFilename');

// OTP Waiver modal elements
const otpModalOverlay = document.getElementById('otpModalOverlay');
const otpModalBody    = document.getElementById('otpModalBody');
const otpModalAccount = document.getElementById('otpModalAccount');
const otpModalClose   = document.getElementById('otpModalClose');

let searchTimer = null;

/* ── Column definitions ────────────────────────────────────── */
const COLUMN_DEFS = [
  { key: 'name',       fileCol: 'Name',                            label: 'Name',                   section: null,           valueClass: ''         },
  { key: 'gender',     fileCol: 'Gender',                          label: 'Gender',                 section: null,           valueClass: ''         },
  { key: 'chcode',      fileCol: 'chcode',          label: 'CH Code',     section: 'identity', valueClass: 'v-chcode'  },
  { key: 'accountKey',  fileCol: 'Account Key',     label: 'Account Key', section: 'identity', valueClass: 'v-acckey'  },
  { key: 'cardNumber',  fileCol: 'Contract Number', label: 'Card Number', section: 'identity', valueClass: 'v-card'    },
  { key: 'birthday',   fileCol: 'Birthdate',                       label: 'Birthday',               section: 'identity',     valueClass: 'v-birthday'},
  { key: 'cycle',      fileCol: 'Repaymen Cycle',                 label: 'Cycle',                  section: 'identity',     valueClass: 'v-cycle'  },
  { key: 'productDesc', fileCol: 'Product Description',           label: 'Product Description',    section: 'identity',     valueClass: 'v-product' },
  { key: 'delayDays',     fileCol: 'Delay Days',                        label: 'Delay Days',              section: 'status',       valueClass: 'v-delay'   },
  { key: 'accountLimit',  fileCol: 'Account Limit',                     label: 'Account Limit',           section: 'status',       valueClass: 'v-limit'   },
  { key: 'totalOB',       fileCol: 'Total Outstanding',                 label: 'Total OB',                section: 'status',       valueClass: 'v-ob'      },
  { key: 'stmtMinPay',    fileCol: 'Statement Minum Payment',           label: 'Statement Min. Payment',  section: 'status',       valueClass: 'v-min'     },
  { key: 'stmtBalance',   fileCol: 'Statement Balance',                 label: 'Statement Balance',       section: 'status',       valueClass: 'v-ob'      },
  { key: 'stmtOverdue',   fileCol: 'Statement Overdue Amount',          label: 'Statement Overdue Amount',section: 'status',       valueClass: 'v-pastdue' },
  { key: 'pastDue',       fileCol: 'Past Due Amount (Base Currency)',   label: 'Past Due',                section: 'status',       valueClass: 'v-pastdue' },
  { key: 'install01',     fileCol: 'Installment Amount (01)', label: 'Installment (01)', section: 'installments', valueClass: 'v-install'},
  { key: 'installDate01', fileCol: 'Installment Date (01)',   label: 'Date (01)',        section: 'installments', valueClass: 'v-idate'  },
  { key: 'install02',     fileCol: 'Installment Amount (02)', label: 'Installment (02)', section: 'installments', valueClass: 'v-install'},
  { key: 'installDate02', fileCol: 'Installment Date (02)',   label: 'Date (02)',        section: 'installments', valueClass: 'v-idate'  },
  { key: 'install03',     fileCol: 'Installment Amount (03)', label: 'Installment (03)', section: 'installments', valueClass: 'v-install'},
  { key: 'installDate03', fileCol: 'Installment Date (03)',   label: 'Date (03)',        section: 'installments', valueClass: 'v-idate'  },
  { key: 'install04',     fileCol: 'Installment Amount (04)', label: 'Installment (04)', section: 'installments', valueClass: 'v-install'},
  { key: 'installDate04', fileCol: 'Installment Date (04)',   label: 'Date (04)',        section: 'installments', valueClass: 'v-idate'  },
  { key: 'email',      fileCol: 'Email (01)',    label: 'Email 1',   section: 'contact', valueClass: 'v-contact'},
  { key: 'address',   fileCol: 'Address (01)',  label: 'Address 1', section: 'contact', valueClass: 'v-contact', combined: true },
  { key: 'zipCode',   fileCol: 'Zip Code (01)', label: 'Zip Code',  section: null,      valueClass: '' },
  { key: 'county',    fileCol: 'County (01)',   label: 'County',    section: null,      valueClass: '' },
];

const SECTIONS = {
  identity:     { title: 'Account Identity',  icon: iconIdentity()  },
  status:       { title: 'Account Status',    icon: iconStatus()    },
  installments: { title: 'Installments',      icon: iconInstall()   },
  contact:      { title: 'Contact Info',      icon: iconContact()   },
};

/* ── File input ────────────────────────────────────────────── */
fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) handleFile(f);
});

/* ── Drag & Drop ───────────────────────────────────────────── */
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});

/* ── Reload button ─────────────────────────────────────────── */
reloadBtn.addEventListener('click', () => {
  records = [];
  otpWaiverMap = {};
  lssWaiverMap = {};
  otpSheetFound = false;
  lssSheetFound = false;
  fileInput.value = '';
  searchInput.value = '';
  uploadSection.style.display  = 'flex';
  trackerSection.style.display = 'none';
  topbarStats.style.display    = 'none';
  clearResults();
});

/* ── File handler ──────────────────────────────────────────── */
function handleFile(file) {
  const name = file.name.toLowerCase();
  // Show loading overlay
  flFilename.textContent          = file.name;
  fileLoadingOverlay.style.display = 'flex';

  // Reset waiver lookup state for every new file — CSVs have no sheets to
  // check, and a fresh XLSX may or may not include the optional sheets.
  otpWaiverMap  = {};
  lssWaiverMap  = {};
  otpSheetFound = false;
  lssSheetFound = false;

  if (name.endsWith('.csv'))                            readCSV(file);
  else if (name.endsWith('.xlsx') || name.endsWith('.xls')) readXLSX(file);
  else {
    fileLoadingOverlay.style.display = 'none';
    showError('Unsupported format. Please upload .xlsx or .csv.');
  }
}

function readXLSX(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      buildOtpWaiverMap(wb);
      buildLssWaiverMap(wb);
      processData(json, file.name);
    } catch {
      fileLoadingOverlay.style.display = 'none';
      showError('Could not parse XLSX. Please check the file.');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ── OTP Waiver lookup (PENALTY & INTEREST sheet) ─────────────
   Reads a second sheet named "PENALTY & INTEREST" from the same
   uploaded workbook and builds a lookup keyed by ACCOUNT NUMBER,
   used to populate the OTP WAIVER modal.                        */
function buildOtpWaiverMap(workbook) {
  otpWaiverMap = {};

  const norm = s => String(s || '').toLowerCase().replace(/[\s_\-()"'\u00a0\ufeff\r]/g, '');

  // Find the sheet regardless of minor spacing/case differences
  const sheetName = workbook.SheetNames.find(n => norm(n) === norm('PENALTY & INTEREST'));
  if (!sheetName) return; // sheet not present — treated as optional; button/section will reflect this
  otpSheetFound = true;

  const ws   = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (!rows.length) return;

  // Map normalized header -> actual header name present in the sheet
  const headerMap = {};
  Object.keys(rows[0]).forEach(h => { headerMap[norm(h)] = h; });

  const acctCol     = headerMap[norm('ACCOUNT NUMBER')];
  const penaltyCol  = headerMap[norm('PENALTY')];
  const interestCol = headerMap[norm('INTEREST')];

  if (!acctCol) return; // can't build a lookup without an account key column

  rows.forEach(row => {
    const acctKey = norm(row[acctCol]);
    if (!acctKey) return;
    otpWaiverMap[acctKey] = {
      penalty:  penaltyCol  ? String(row[penaltyCol]  ?? '').trim() : '',
      interest: interestCol ? String(row[interestCol] ?? '').trim() : '',
    };
  });
}

/* ── LSS Waiver lookup (LSS sheet) ─────────────────────────────
   Reads a sheet named "LSS" from the same uploaded workbook and
   builds a lookup keyed by ACCOUNT NUMBER, used to populate the
   LSS Waiver section of the OTP/LSS Waiver modal.                */
function buildLssWaiverMap(workbook) {
  lssWaiverMap = {};

  const norm = s => String(s || '').toLowerCase().replace(/[\s_\-()"'\u00a0\ufeff\r]/g, '');

  const sheetName = workbook.SheetNames.find(n => norm(n) === norm('LSS'));
  if (!sheetName) return; // sheet not present — treated as optional; button/section will reflect this
  lssSheetFound = true;

  const ws   = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (!rows.length) return;

  const headerMap = {};
  Object.keys(rows[0]).forEach(h => { headerMap[norm(h)] = h; });

  const acctCol = headerMap[norm('ACCOUNT NUMBER')];
  if (!acctCol) return; // can't build a lookup without an account key column

  const colMap = {
    totalUpdatedOB:     headerMap[norm('TOTAL UPDATED OB (UPDATED OB + UNBILLED)')],
    principal:          headerMap[norm('PRINCIPAL')],
    penalty:            headerMap[norm('PENALTY')],
    interest:           headerMap[norm('INTEREST')],
    principalDiscount:  headerMap[norm('Principal_Discount')],
    totalDiscount:      headerMap[norm('TOTAL_DISCOUNT')],
    finalPayment:       headerMap[norm('FINAL PAYMENT TO SETTLE')],
  };

  rows.forEach(row => {
    const acctKey = norm(row[acctCol]);
    if (!acctKey) return;
    const entry = {};
    Object.entries(colMap).forEach(([key, col]) => {
      entry[key] = col ? String(row[col] ?? '').trim() : '';
    });
    lssWaiverMap[acctKey] = entry;
  });
}

function readCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try { processData(csvToJson(e.target.result), file.name); }
    catch {
      fileLoadingOverlay.style.display = 'none';
      showError('Could not parse CSV. Please check the file.');
    }
  };
  reader.readAsText(file);
}

function csvToJson(text) {
  const lines   = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^[\ufeff"]+|["]+$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

/* ── Process data ──────────────────────────────────────────── */
function processData(json, fileName) {
  fileLoadingOverlay.style.display = 'none';
  if (!json.length) { showError('File is empty.'); return; }

  const norm       = s => s.toLowerCase().replace(/[\s_\-()"'\u00a0\ufeff\r]/g, '');
  const headerMap  = {};
  Object.keys(json[0]).forEach(h => { headerMap[norm(h)] = h; });

  const keyMap = {};
  COLUMN_DEFS.forEach(def => {
    const n = norm(def.fileCol);
    if (headerMap[n]) keyMap[def.key] = headerMap[n];
  });

  const required = ['name', 'chcode', 'accountKey'];
  const missing  = required.filter(k => !keyMap[k]);
  if (missing.length) {
    const labels = missing.map(k => COLUMN_DEFS.find(d => d.key === k).fileCol);
    showError(`Missing required column(s): ${labels.join(', ')}`);
    return;
  }

  records = json.map(row => {
    const rec = {};
    COLUMN_DEFS.forEach(def => {
      rec[def.key] = keyMap[def.key] ? String(row[keyMap[def.key]] ?? '').trim() : '';
    });
    return rec;
  }).filter(r => r.name);

  if (!records.length) { showError('No valid rows found.'); return; }

  // Update UI
  topbarStats.style.display      = 'flex';
  uploadSection.style.display    = 'none';
  trackerSection.style.display   = 'flex';

  clearResults();
  searchInput.focus();
}

/* ── Search ────────────────────────────────────────────────── */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearBtn.style.display = q ? 'flex' : 'none';

  if (!q) { clearResults(); return; }

  // Show searching animation immediately
  showSearching(q);

  // Debounce: wait 420ms of idle typing before filtering
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => performSearch(q), 420);
});

clearBtn.addEventListener('click', () => {
  clearTimeout(searchTimer);
  searchInput.value = '';
  clearBtn.style.display = 'none';
  clearResults();
  searchInput.focus();
});

function showSearching(query) {
  resultsList.innerHTML       = '';
  emptyState.style.display    = 'none';
  noResults.style.display     = 'none';
  statsBar.style.display      = 'none';
  matchStat.style.display     = 'none';
  searchingCount.textContent  = records.length.toLocaleString();
  searchingState.style.display = 'flex';
}

function performSearch(query) {
  searchingState.style.display = 'none';

  const q       = query.toLowerCase();
  const safe    = v => (v || '').toLowerCase();
  const matched = records.filter(r =>
    safe(r.name).includes(q) ||
    safe(r.chcode).includes(q) ||
    safe(r.accountKey).includes(q) ||
    safe(r.email).includes(q) ||
    safe(r.cardNumber).includes(q)
  );

  resultsList.innerHTML = '';
  emptyState.style.display = 'none';
  noResults.style.display  = 'none';

  if (!matched.length) {
    noResults.style.display  = 'flex';
    statsBar.style.display   = 'none';
    matchStat.style.display  = 'none';
    return;
  }

  matched.forEach((r, i) => resultsList.appendChild(createCard(r, query, i + 1)));

  const txt = `Showing ${matched.length} result${matched.length !== 1 ? 's' : ''} for "${query}"`;
  statsText.textContent        = txt;
  statsBar.style.display       = 'block';
  matchLabel.textContent       = `${matched.length} match${matched.length !== 1 ? 'es' : ''}`;
  matchStat.style.display      = 'flex';
}

/* ── Create card ───────────────────────────────────────────── */
function createCard(record, query, index) {
  const card = document.createElement('div');
  card.className = 'result-card';
  card.style.animationDelay = `${(index - 1) * 30}ms`;

  const val     = v => escapeHtml(v) || null;
  const display = v => val(v) || '<span class="empty">—</span>';

  // Group fields by section
  const grouped = {};
  COLUMN_DEFS.filter(d => d.section).forEach(def => {
    if (!grouped[def.section]) grouped[def.section] = [];
    grouped[def.section].push(def);
  });

  // Pre-build contact values for header
  const emailVal   = record.email ? escapeHtml(record.email) : '';
  const addrParts  = [record.address, record.zipCode, record.county].filter(v => v && v.trim());
  const addrVal    = addrParts.length ? escapeHtml(addrParts.join(', ')) : '';

  const contactHeaderHTML = (emailVal || addrVal) ? `
    <div class="rc-header-contact">
      ${emailVal ? `
        <div class="rc-contact-item">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="0.75" y="2" width="9.5" height="7" rx="1.25" stroke="currentColor" stroke-width="1.2"/>
            <path d="M0.75 3.5l4.75 3 4.75-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>${emailVal}</span>
        </div>` : ''}
      ${addrVal ? `
        <div class="rc-contact-item">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1C3.567 1 2 2.567 2 4.5c0 2.625 3.5 5.5 3.5 5.5S9 7.125 9 4.5C9 2.567 7.433 1 5.5 1z" stroke="currentColor" stroke-width="1.2"/>
            <circle cx="5.5" cy="4.5" r="1.25" stroke="currentColor" stroke-width="1.1"/>
          </svg>
          <span>${addrVal}</span>
        </div>` : ''}
    </div>` : '';

  // Build sectionsHTML — skip contact section (now in header)
  const sectionsHTML = Object.entries(SECTIONS).filter(([key]) => key !== 'contact').map(([key, meta]) => {
    const fields = grouped[key] || [];
    const isContact      = key === 'contact';
    const isInstallments = key === 'installments';

    let itemsHTML = '';

    if (isInstallments) {
      // Render 4 paired rows: Amount + Date side-by-side
      const pairs = [
        { num: '01', amtKey: 'install01', dateKey: 'installDate01' },
        { num: '02', amtKey: 'install02', dateKey: 'installDate02' },
        { num: '03', amtKey: 'install03', dateKey: 'installDate03' },
        { num: '04', amtKey: 'install04', dateKey: 'installDate04' },
      ];
      itemsHTML = pairs.map(p => {
        const amt      = formatAmount(record[p.amtKey]  || '');
        const dateRaw  = record[p.dateKey] || '';
        const date     = formatDate(dateRaw);
        const emptyAmt  = !amt;
        const emptyDate = !date;
        return `
          <div class="install-row">
            <div class="install-num">${p.num}</div>
            <div class="install-pair">
              <div class="rc-desc-item install-amount">
                <div class="rc-desc-label">Amount</div>
                <div class="rc-desc-value ${emptyAmt ? 'empty' : 'v-install'}">${emptyAmt ? '—' : escapeHtml(amt)}</div>
              </div>
              <div class="install-sep"></div>
              <div class="rc-desc-item install-date">
                <div class="rc-desc-label">Date</div>
                <div class="rc-desc-value ${emptyDate ? 'empty' : 'v-idate'}">${emptyDate ? '—' : escapeHtml(date)}</div>
              </div>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="rc-section">
          <div class="rc-section-title">
            ${meta.icon}
            ${meta.title}
          </div>
          <div class="install-list">
            ${itemsHTML}
          </div>
        </div>`;
    }

    itemsHTML = fields.map(def => {
      let raw = record[def.key];

      // Combine address parts into one value
      if (def.key === 'address') {
        const parts = [record.address, record.zipCode, record.county].filter(v => v && v.trim());
        raw = parts.join(', ');
      }

      // Format date fields
      if (DATE_KEYS.has(def.key)) raw = formatDate(raw);

      // Format amount fields
      if (AMOUNT_KEYS.has(def.key)) raw = formatAmount(raw);

      const empty = !raw;
      // Highlight search query in chcode and accountKey values
      const highlight = !empty && (def.key === 'chcode' || def.key === 'accountKey' || def.key === 'email' || def.key === 'cardNumber');
      const v = empty ? '—' : highlight ? highlightMatch(raw, query) : escapeHtml(raw);
      return `
        <div class="rc-desc-item">
          <div class="rc-desc-label">${def.label}</div>
          <div class="rc-desc-value ${empty ? 'empty' : def.valueClass}">${v}</div>
        </div>`;
    }).join('');

    const gridClass = isContact ? 'cols-full' : '';

    return `
      <div class="rc-section">
        <div class="rc-section-title">
          ${meta.icon}
          ${meta.title}
        </div>
        <div class="rc-desc-list ${gridClass}">
          ${itemsHTML}
        </div>
      </div>`;
  }).join('');

  card.innerHTML = `
    <div class="rc-header">
      <div class="rc-header-left">
        <div class="rc-name-row">
          ${genderIcon(record.gender)}
          <div class="rc-name">${highlightMatch(record.name, query)}</div>
        </div>
        ${contactHeaderHTML}
      </div>
      <div class="rc-index">
        <span class="rc-badge">#${index}</span>
        ${(otpSheetFound || lssSheetFound) ? `
        <button type="button" class="rc-otp-btn" data-account-key="${escapeHtml(record.accountKey)}" data-total-ob="${escapeHtml(record.totalOB)}" title="View OTP/LSS Waiver">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l4.3 1.9v2.8c0 2.7-1.8 5.1-4.3 5.9-2.5-0.8-4.3-3.2-4.3-5.9V2.9L6 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
          OTP/LSS Waiver
        </button>` : ''}
      </div>
    </div>
    <div class="rc-body">
      ${sectionsHTML}
    </div>
  `;

  return card;
}

/* ── OTP/LSS Waiver modal ──────────────────────────────────── */
resultsList.addEventListener('click', e => {
  const btn = e.target.closest('.rc-otp-btn');
  if (!btn) return;
  openOtpModal(btn.getAttribute('data-account-key') || '', btn.getAttribute('data-total-ob') || '');
});

// Parses a raw string amount (possibly with commas/currency symbols) into a number, or null if not a valid number
function parseNumericAmount(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().replace(/[,\s$₱€£¥]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Formats a decimal fraction (e.g. 0.2) as a percentage string (e.g. "20%")
function formatPercent(num) {
  let pct = (num * 100).toFixed(2);
  pct = pct.replace(/\.?0+$/, ''); // strip trailing zeros / trailing dot
  return `${pct}%`;
}

// Renders a single label/value row. rawValue is the source string (empty/undefined -> —).
// opts.percent: true -> render the underlying decimal value as a percentage (numeric value itself is preserved for any calculations elsewhere).
function renderWaiverRow(label, rawValue, opts = {}) {
  const num = parseNumericAmount(rawValue);
  let display;
  if (num !== null) {
    display = opts.percent ? formatPercent(num) : formatAmount(String(num));
  } else {
    display = rawValue ? escapeHtml(rawValue) : '—';
  }
  const highlightClass = opts.highlight ? ' otp-result-highlight' : '';
  return `
    <div class="otp-result-row${highlightClass}">
      <div class="otp-result-label">${escapeHtml(label)}</div>
      <div class="otp-result-value">${display}</div>
    </div>`;
}

function renderEmptyWaiverState(title, hint) {
  return `
    <div class="otp-empty-state">
      <div class="otp-empty-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.6"/>
          <path d="M12 7.5v5.5M12 16.2h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="otp-empty-title">${escapeHtml(title)}</p>
      <p class="otp-empty-hint">${hint}</p>
    </div>`;
}

function openOtpModal(accountKey, totalOBRaw) {
  const norm = s => String(s || '').toLowerCase().replace(/[\s_\-()"'\u00a0\ufeff\r]/g, '');

  otpModalAccount.textContent = '';

  /* ── OTP Waiver section ─────────────────────────────────── */
  const otpMatch = otpWaiverMap[norm(accountKey)];
  let otpSectionHTML;

  if (otpMatch) {
    const totalOBNum  = parseNumericAmount(totalOBRaw);
    const penaltyNum  = parseNumericAmount(otpMatch.penalty);
    const interestNum = parseNumericAmount(otpMatch.interest);

    // Only compute OTP Amount once Total OB, Penalty, and Interest are all successfully retrieved as numbers
    const canCompute    = totalOBNum !== null && penaltyNum !== null && interestNum !== null;
    const otpAmountNum  = canCompute ? (totalOBNum - (penaltyNum + interestNum)) : null;
    const otpAmountDisp = otpAmountNum !== null ? formatAmount(String(otpAmountNum)) : '—';

    otpSectionHTML = `
      <div class="otp-result-list">
        ${renderWaiverRow('Total OB', totalOBRaw)}
        ${renderWaiverRow('Penalty', otpMatch.penalty)}
        ${renderWaiverRow('Interest', otpMatch.interest)}
        <div class="otp-result-row otp-result-highlight">
          <div class="otp-result-label">OTP Amount</div>
          <div class="otp-result-value">${escapeHtml(otpAmountDisp)}</div>
        </div>
      </div>
      ${!canCompute ? `<p class="otp-calc-note">OTP Amount could not be calculated because Total OB, Penalty, or Interest is missing or not a valid number.</p>` : ''}`;
  } else if (otpSheetFound) {
    otpSectionHTML = renderEmptyWaiverState(
      'No OTP Waiver Data Available',
      `No matching record was found in the PENALTY &amp; INTEREST sheet for this account.`
    );
  } else {
    otpSectionHTML = renderEmptyWaiverState(
      'OTP Waiver Data Not Available',
      `The uploaded file does not include a "PENALTY &amp; INTEREST" sheet.`
    );
  }

  /* ── LSS Waiver section ─────────────────────────────────── */
  const lssMatch = lssWaiverMap[norm(accountKey)];
  let lssSectionHTML;

  if (lssMatch) {
    lssSectionHTML = `
      <div class="otp-result-list">
        ${renderWaiverRow('Updated OB', lssMatch.totalUpdatedOB)}
        ${renderWaiverRow('Principal', lssMatch.principal)}
        ${renderWaiverRow('Penalty', lssMatch.penalty)}
        ${renderWaiverRow('Interest', lssMatch.interest)}
        ${renderWaiverRow('Principal Discount', lssMatch.principalDiscount, { percent: true })}
        ${renderWaiverRow('Total Discount', lssMatch.totalDiscount)}
        <div class="otp-result-row otp-result-highlight">
          <div class="otp-result-label">Final Payment to Settle</div>
          <div class="otp-result-value">${lssMatch.finalPayment ? escapeHtml(formatAmount(lssMatch.finalPayment)) : '—'}</div>
        </div>
      </div>`;
  } else if (lssSheetFound) {
    lssSectionHTML = renderEmptyWaiverState(
      'No LSS Waiver Data Available',
      `No matching record was found in the LSS sheet for this account.`
    );
  } else {
    lssSectionHTML = renderEmptyWaiverState(
      'LSS Waiver Data Not Available',
      `The uploaded file does not include an "LSS" sheet.`
    );
  }

  otpModalBody.innerHTML = `
    <div class="otp-section">
      <div class="otp-section-title">OTP Waiver</div>
      ${otpSectionHTML}
    </div>
    <div class="otp-section">
      <div class="otp-section-title">LSS Waiver</div>
      ${lssSectionHTML}
    </div>`;

  otpModalOverlay.style.display = 'flex';
}

function closeOtpModal() {
  otpModalOverlay.style.display = 'none';
}

otpModalClose.addEventListener('click', closeOtpModal);
otpModalOverlay.addEventListener('click', e => {
  if (e.target === otpModalOverlay) closeOtpModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && otpModalOverlay.style.display !== 'none') closeOtpModal();
});

/* ── Helpers ───────────────────────────────────────────────── */
function clearResults() {
  resultsList.innerHTML        = '';
  emptyState.style.display     = 'flex';
  noResults.style.display      = 'none';
  searchingState.style.display = 'none';
  statsBar.style.display       = 'none';
  matchStat.style.display      = 'none';
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  return escapeHtml(text).replace(
    new RegExp(`(${escapeRegex(query)})`, 'gi'),
    '<mark>$1</mark>'
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ── Date formatter ────────────────────────────────────────── */
const DATE_KEYS = new Set(['birthday', 'installDate01', 'installDate02', 'installDate03', 'installDate04']);

function formatDate(raw) {
  if (!raw || !raw.trim()) return '';

  // Excel serial number — pure integer like "32874" or float "32874.0"
  if (/^\d{4,6}(\.\d+)?$/.test(raw.trim())) {
    const serial = parseFloat(raw);
    const d = new Date(Math.round((serial - 25569) * 86400000));
    if (!isNaN(d)) return fmtDate(d);
  }

  // Already "Month DD, YYYY" — pass through
  if (/^[A-Za-z]+ \d{1,2}, \d{4}$/.test(raw.trim())) return raw.trim();

  // Try native parse after normalising separators
  const norm = raw.trim().replace(/\//g, '-');
  const d1 = new Date(norm);
  if (!isNaN(d1) && d1.getFullYear() > 1900) return fmtDate(d1);

  // Explicit DD-MM-YYYY or DD.MM.YYYY
  const dmy = raw.trim().match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})$/);
  if (dmy) {
    const [, dd, mm, yy] = dmy;
    const year = yy.length === 2 ? (parseInt(yy) > 30 ? 1900 + +yy : 2000 + +yy) : +yy;
    const d2 = new Date(year, +mm - 1, +dd);
    if (!isNaN(d2)) return fmtDate(d2);
  }

  return raw; // return as-is if unparseable
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });
}

/* ── Amount formatter ──────────────────────────────────────── */
const AMOUNT_KEYS = new Set(['accountLimit', 'totalOB', 'stmtMinPay', 'stmtBalance', 'stmtOverdue', 'pastDue', 'install01', 'install02', 'install03', 'install04']);

function formatAmount(raw) {
  if (!raw || !raw.trim()) return '';
  // Strip existing commas, currency symbols, whitespace
  const cleaned = raw.trim().replace(/[,\s$₱€£¥]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return raw; // return as-is if not a number
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showError(msg) { alert('⚠ ' + msg); }

/* ── Gender icon ───────────────────────────────────────────── */
function genderIcon(g) {
  const v = (g || '').trim().toUpperCase();
  if (v === 'F') {
    return `<span class="gender-icon female" title="Female">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="6" r="4" stroke="currentColor" stroke-width="1.6"/>
        <path d="M8 10v4M6 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </span>`;
  }
  if (v === 'M') {
    return `<span class="gender-icon male" title="Male">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6.5" cy="9.5" r="4" stroke="currentColor" stroke-width="1.6"/>
        <path d="M10 6l4-4M14 2h-3.5M14 2v3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>`;
  }
  return '';
}

/* ── Section icons ─────────────────────────────────────────── */
function iconIdentity() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/>
    <circle cx="6" cy="5" r="1.5" stroke="currentColor" stroke-width="1.2"/>
    <path d="M3 10c0-1.657 1.343-3 3-3s3 1.343 3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
}

function iconStatus() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.3"/>
    <path d="M6 3.5v3l2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function iconInstall() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="1" y="3" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
    <path d="M4 3V2a2 2 0 0 1 4 0v1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M3.5 7h5M6 5.5v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
}

function iconContact() {
  return `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="1" y="2.5" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
    <path d="M1 4.5l5 3 5-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}