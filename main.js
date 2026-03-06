/* ─────────────────────────────────────────────────────────────
   DataTracker — main.js
───────────────────────────────────────────────────────────── */

let records = [];

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
const statsBar       = document.getElementById('statsBar');
const statsText      = document.getElementById('statsText');
const reloadBtn      = document.getElementById('reloadBtn');

// Topbar dynamic elements
const topbarStats      = document.getElementById('topbarStats');
const totalRecordsLabel= document.getElementById('totalRecordsLabel');
const matchStat        = document.getElementById('matchStat');
const matchLabel       = document.getElementById('matchLabel');

/* ── Column definitions ────────────────────────────────────── */
const COLUMN_DEFS = [
  { key: 'name',       fileCol: 'Name',                            label: 'Name',                   section: null,           valueClass: ''         },
  { key: 'gender',     fileCol: 'Gender',                          label: 'Gender',                 section: null,           valueClass: ''         },
  { key: 'chcode',     fileCol: 'chcode',                          label: 'CH Code',                section: 'identity',     valueClass: 'v-chcode' },
  { key: 'accountKey', fileCol: 'Account Key',                     label: 'Account Key',            section: 'identity',     valueClass: 'v-acckey' },
  { key: 'birthday',   fileCol: 'Birthdate',                       label: 'Birthday',               section: 'identity',     valueClass: 'v-birthday'},
  { key: 'cycle',      fileCol: 'Repaymen Cycle',                 label: 'Cycle',                  section: 'identity',     valueClass: 'v-cycle'  },
  { key: 'delayDays',  fileCol: 'Delay Days',                      label: 'Delay Days',             section: 'status',       valueClass: 'v-delay'  },
  { key: 'totalOB',    fileCol: 'Total Outstanding',               label: 'Total OB',               section: 'status',       valueClass: 'v-ob'     },
  { key: 'stmtMinPay', fileCol: 'Statement Minum Payment',         label: 'Statement Min. Payment', section: 'status',       valueClass: 'v-min'    },
  { key: 'pastDue',    fileCol: 'Past Due Amount (Base Currency)', label: 'Past Due',               section: 'status',       valueClass: 'v-pastdue'},
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
  if (name.endsWith('.csv'))              readCSV(file);
  else if (name.endsWith('.xlsx') || name.endsWith('.xls')) readXLSX(file);
  else showError('Unsupported format. Please upload .xlsx or .csv.');
}

function readXLSX(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      processData(json, file.name);
    } catch { showError('Could not parse XLSX. Please check the file.'); }
  };
  reader.readAsArrayBuffer(file);
}

function readCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try { processData(csvToJson(e.target.result), file.name); }
    catch { showError('Could not parse CSV. Please check the file.'); }
  };
  reader.readAsText(file);
}

function csvToJson(text) {
  const lines   = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

/* ── Process data ──────────────────────────────────────────── */
function processData(json, fileName) {
  if (!json.length) { showError('File is empty.'); return; }

  const norm       = s => s.toLowerCase().replace(/[\s_\-()"']/g, '');
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
  const countStr = records.length.toLocaleString();
  totalRecordsLabel.textContent  = `${countStr} records loaded`;
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
  performSearch(q);
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  clearResults();
  searchInput.focus();
});

function performSearch(query) {
  if (!query) { clearResults(); return; }

  const q       = query.toLowerCase();
  const matched = records.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.chcode.toLowerCase().includes(q) ||
    r.accountKey.toLowerCase().includes(q)
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

  // Build section HTML
  const sectionsHTML = Object.entries(SECTIONS).map(([key, meta]) => {
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
      const highlight = !empty && (def.key === 'chcode' || def.key === 'accountKey');
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
      <div class="rc-name-row">
        ${genderIcon(record.gender)}
        <div class="rc-name">${highlightMatch(record.name, query)}</div>
      </div>
      <div class="rc-index">
        <span class="rc-badge">#${index}</span>
      </div>
    </div>
    <div class="rc-body">
      ${sectionsHTML}
    </div>
  `;

  return card;
}

/* ── Helpers ───────────────────────────────────────────────── */
function clearResults() {
  resultsList.innerHTML    = '';
  emptyState.style.display = 'flex';
  noResults.style.display  = 'none';
  statsBar.style.display   = 'none';
  matchStat.style.display  = 'none';
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
const AMOUNT_KEYS = new Set(['totalOB', 'stmtMinPay', 'pastDue', 'install01', 'install02', 'install03', 'install04']);

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