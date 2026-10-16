let currentCandidate = null;
let allCandidates = {};
let globalSettings = { halfLitreCost: 100, litreCost: 200, zoomFactor: 1.0 };

// --- Zoom & Screen Scaling State & Engine ---
let currentZoom = parseFloat(localStorage.getItem('app_zoom_factor')) || 1.0;

function setAppZoom(factor, save = true) {
  // Clamp between 50% and 150% (0.50 to 1.50)
  factor = Math.max(0.5, Math.min(1.5, Math.round(factor * 100) / 100));
  currentZoom = factor;

  // 1. Native Electron webFrame zoom
  if (window.electronAPI && typeof window.electronAPI.setZoomFactor === 'function') {
    try {
      window.electronAPI.setZoomFactor(factor);
    } catch (err) {
      document.body.style.zoom = factor;
    }
  } else {
    // 2. Fallback CSS zoom
    document.body.style.zoom = factor;
  }

  const pct = Math.round(factor * 100) + '%';
  const navBtn = document.getElementById('zoom-reset-btn');
  if (navBtn) navBtn.innerText = pct;

  const popoverSlider = document.getElementById('zoom-popover-slider');
  if (popoverSlider) popoverSlider.value = Math.round(factor * 100);

  const badge = document.getElementById('zoom-badge');
  if (badge) {
    if (Math.abs(factor - 1.0) > 0.01) {
      badge.innerText = pct;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  const slider = document.getElementById('settings-zoom-slider');
  if (slider) slider.value = Math.round(factor * 100);

  const sliderVal = document.getElementById('settings-zoom-val');
  if (sliderVal) sliderVal.innerText = pct;

  document.querySelectorAll('.zoom-preset-btn, .zoom-chip').forEach(btn => {
    const bz = parseFloat(btn.dataset.zoom);
    if (Math.abs(bz - factor) < 0.02) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (save) {
    localStorage.setItem('app_zoom_factor', factor.toString());
    if (globalSettings) {
      globalSettings.zoomFactor = factor;
      if (window.electronAPI && window.electronAPI.saveSettings) {
        window.electronAPI.saveSettings(globalSettings).catch(() => {});
      }
    }
  }
}

// Apply saved zoom immediately on script load
try {
  setAppZoom(currentZoom, false);
} catch (e) {}

// Custom Alert & Confirm Modals
window.customAlert = (msg, type = 'auto', customTitle = null) => {
  const modal = document.getElementById('custom-alert-modal');
  const titleEl = document.getElementById('custom-alert-title');
  const msgEl = document.getElementById('custom-alert-message');
  const okBtn = document.getElementById('custom-alert-ok-btn');
  const cardEl = modal ? modal.querySelector('.modal-content') : null;

  if (msgEl) {
    msgEl.innerText = msg;
    msgEl.style.whiteSpace = 'pre-line';
  }

  // Determine if this is a warning/danger/duplicate notification
  const isDanger = (type === 'danger' || type === 'error' || type === 'warning') || 
                   (type === 'auto' && (/already exists|duplicate|mandatory|failed|cannot|error|wipe|delete/i.test(msg)));
  const isSuccess = (type === 'success') || (type === 'auto' && (/success/i.test(msg)));

  if (titleEl) {
    if (isDanger) {
      titleEl.innerText = customTitle || '⚠️ Notification';
      titleEl.style.color = 'var(--danger)';
    } else if (isSuccess) {
      titleEl.innerText = customTitle || '✅ Notification';
      titleEl.style.color = 'var(--success)';
    } else {
      titleEl.innerText = customTitle || 'Notification';
      titleEl.style.color = 'var(--primary)';
    }
  }

  if (okBtn) {
    if (isDanger) {
      okBtn.style.background = 'var(--danger)';
      okBtn.style.borderColor = 'var(--danger)';
    } else if (isSuccess) {
      okBtn.style.background = 'var(--success)';
      okBtn.style.borderColor = 'var(--success)';
    } else {
      okBtn.style.background = 'var(--primary)';
      okBtn.style.borderColor = 'var(--primary)';
    }
  }

  if (cardEl) {
    if (isDanger) {
      cardEl.style.borderTop = '5px solid var(--danger)';
    } else if (isSuccess) {
      cardEl.style.borderTop = '5px solid var(--success)';
    } else {
      cardEl.style.borderTop = '5px solid var(--primary)';
    }
  }

  if (modal) {
    modal.classList.add('active');
  }
  setTimeout(() => {
    if (okBtn) okBtn.focus();
  }, 100);
};

document.getElementById('custom-alert-ok-btn').addEventListener('click', () => {
  document.getElementById('custom-alert-modal').classList.remove('active');
});

window.customConfirm = (msg) => {
  return new Promise((resolve) => {
    document.getElementById('custom-confirm-message').innerText = msg;
    document.getElementById('custom-confirm-modal').classList.add('active');
    
    const yesBtn = document.getElementById('custom-confirm-yes-btn');
    const noBtn = document.getElementById('custom-confirm-no-btn');
    
    const cleanup = () => {
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      document.getElementById('custom-confirm-modal').classList.remove('active');
    };
    
    const onYes = () => { cleanup(); resolve(true); };
    const onNo = () => { cleanup(); resolve(false); };
    
    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
  });
};

window.alert = window.customAlert;
window.confirm = window.customConfirm;

// DOM Elements
const views = {
  dashboard: document.getElementById('dashboard-view'),
  profile: document.getElementById('profile-view'),
  membersList: document.getElementById('members-list-view'),
  analysis: document.getElementById('analysis-view'),
  export: document.getElementById('export-view'),
  purchases: document.getElementById('purchases-view'),
  settings: document.getElementById('settings-view'),
  bulkUpload: document.getElementById('bulk-upload-view')
};

let financeChartInstance = null;
let cardsChartInstance = null;

const backToDashBtns = document.querySelectorAll('.back-to-dash');
const profileBackBtn = document.getElementById('profile-back-btn');

// Dashboard Elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchError = document.getElementById('search-error');
const settingHalfLitre = document.getElementById('setting-half-litre');
const settingLitre = document.getElementById('setting-litre');
const settingHalfMin = document.getElementById('setting-half-min');
const settingHalfMax = document.getElementById('setting-half-max');
const settingLitreMin = document.getElementById('setting-litre-min');
const settingLitreMax = document.getElementById('setting-litre-max');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingsMsg = document.getElementById('settings-msg');

// Zoom Elements
const zoomToggleBtn = document.getElementById('zoom-toggle-btn');
const zoomPopover = document.getElementById('zoom-popover');
const zoomPopoverClose = document.getElementById('zoom-popover-close');
const zoomPopoverSlider = document.getElementById('zoom-popover-slider');
const zoomBadge = document.getElementById('zoom-badge');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const settingsZoomSlider = document.getElementById('settings-zoom-slider');
const settingsZoomVal = document.getElementById('settings-zoom-val');
const zoomPresetBtns = document.querySelectorAll('.zoom-preset-btn, .zoom-chip');

// Members List Elements
const allMembersList = document.getElementById('all-members-list');
const allMembersSearch = document.getElementById('all-members-search');

// Create Modal
const createModal = document.getElementById('create-modal');
const newNameInput = document.getElementById('new-name');
const newMobileNoInput = document.getElementById('new-mobile-no');
const newSampleNoInput = document.getElementById('new-sample-no');

// Profile Elements
const profileName = document.getElementById('profile-name');
const profileSampleNo = document.getElementById('profile-sample-no');
const profileMobileNo = document.getElementById('profile-mobile-no');
const totalPaidEl = document.getElementById('total-paid');
const totalDueEl = document.getElementById('total-due');
const notesInput = document.getElementById('notes-input');
const notesCard = document.getElementById('notes-card');
const editProfileBtn = document.getElementById('edit-profile-btn');
const deleteProfileBtn = document.getElementById('delete-profile-btn');
const editModal = document.getElementById('edit-modal');
const editMemberName = document.getElementById('edit-member-name');
const editMemberMobileNo = document.getElementById('edit-member-mobile-no');
const editMemberSampleNo = document.getElementById('edit-member-sample-no');
const saveEditMemberBtn = document.getElementById('save-edit-member-btn');
const cancelEditMemberBtn = document.getElementById('cancel-edit-member-btn');

// Analytics Elements
const globalMonthFilter = document.getElementById('global-month-filter');
const analyticsCardCount = document.getElementById('analytics-card-count');

// Dashboard V4 Elements
const dashboardMonthFilter = document.getElementById('dashboard-month-filter');
const dashTotalMembers = document.getElementById('dash-total-members');
const dashActiveMembers = document.getElementById('dash-active-members');
const dashTotalDue = document.getElementById('dash-total-due');
const dashTotalPaid = document.getElementById('dash-total-paid');
const dashLitreCards = document.getElementById('dash-litre-cards');
const dashHalfCards = document.getElementById('dash-half-cards');
const dashboardTableBody = document.getElementById('dashboard-table-body');
const exportMemberInput = document.getElementById('export-member-input');

// Cards Elements
const cardsList = document.getElementById('cards-list');
const addCardBtn = document.getElementById('add-card-btn');
const addCardForm = document.getElementById('add-card-form');
const saveCardBtn = document.getElementById('save-card-btn');
const cancelCardBtn = document.getElementById('cancel-card-btn');
const newCardNumber = document.getElementById('new-card-number');
const newCardCost = document.getElementById('new-card-cost');

// Utility: Generate unique ID
function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

// Format Currency
function formatINR(amount) {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCardType(num) {
  const n = parseInt(num);
  if (n >= (globalSettings.halfMin || 1) && n <= (globalSettings.halfMax || 500)) return 'Half-Litre';
  if (n >= (globalSettings.litreMin || 501) && n <= (globalSettings.litreMax || 1500)) return 'Litre';
  return 'Other';
}

// Initialization
async function init() {
  globalSettings = await window.electronAPI.getSettings();
  settingHalfLitre.value = globalSettings.halfLitreCost || 100;
  settingLitre.value = globalSettings.litreCost || 200;
  settingHalfMin.value = globalSettings.halfMin || 1;
  settingHalfMax.value = globalSettings.halfMax || 500;
  settingLitreMin.value = globalSettings.litreMin || 501;
  settingLitreMax.value = globalSettings.litreMax || 1500;

  // Initialize Zoom setting
  if (globalSettings.zoomFactor && !localStorage.getItem('app_zoom_factor')) {
    setAppZoom(globalSettings.zoomFactor, false);
  } else {
    setAppZoom(currentZoom, false);
  }
  
  allCandidates = await window.electronAPI.getCandidates();
  
  // Set current month as default for analytics
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  globalMonthFilter.value = ym;
  syncMonthPickers(ym);
  
  renderDashboard();
  initBulkUploadEvents();
}

// Month Filters Sync Logic
const analysisMonthFilter = document.getElementById('analysis-month');
const exportMonthFilter = document.getElementById('export-month');
const purchasesMonthFilter = document.getElementById('purchases-month');
const allMembersMonthFilter = document.getElementById('all-members-month');

const monthPickers = [dashboardMonthFilter, analysisMonthFilter, exportMonthFilter, purchasesMonthFilter, allMembersMonthFilter];

function syncMonthPickers(val) {
  monthPickers.forEach(p => {
    if (p && p.value !== val) {
      p.value = val;
    }
  });
}

globalMonthFilter.addEventListener('change', () => {
  renderCards();
  if (currentCandidate) {
    const m = globalMonthFilter.value;
    notesInput.value = (currentCandidate.monthlyNotes && currentCandidate.monthlyNotes[m]) || '';
    updateHighlights();
  }
});

monthPickers.forEach(p => {
  if (p) {
    p.addEventListener('change', (e) => {
      syncMonthPickers(e.target.value);
      renderDashboard();
      if (views.membersList && views.membersList.classList.contains('active')) {
        renderAllMembers(allMembersSearch ? allMembersSearch.value : '');
      }
    });
  }
});

// Live Clock
const liveClock = document.getElementById('live-clock');
setInterval(() => {
  if (liveClock) {
    const now = new Date();
    liveClock.innerHTML = `${now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}<br/><span style="font-size:0.9rem; color:var(--text-secondary);">${now.toLocaleTimeString('en-IN')}</span>`;
  }
}, 1000);

// Navigation
function switchView(viewName) {
  Object.values(views).forEach(v => {
    if (v) v.classList.remove('active');
  });
  if (views[viewName]) {
    views[viewName].classList.add('active');
  }
  if (viewName === 'dashboard' || viewName === 'analysis' || viewName === 'purchases') {
    renderDashboard();
  }
  if (viewName === 'membersList') {
    window.electronAPI.getCandidates().then(cands => {
      allCandidates = cands;
      if (allMembersSearch) allMembersSearch.value = '';
      renderAllMembers();
    });
  }
  if (viewName === 'bulkUpload') {
    window.electronAPI.getCandidates().then(cands => {
      allCandidates = cands;
      if (bulkUploadedData && bulkUploadedData.length > 0) {
        validateBulkData();
        renderBulkPreview();
      }
    });
  }
}
window.switchView = switchView;

window.showNewMemberModal = () => {
  newNameInput.value = '';
  newMobileNoInput.value = '';
  newSampleNoInput.value = '';
  const warnEl = document.getElementById('new-name-warn');
  const labelEl = document.getElementById('new-sample-no-label');
  const errEl = document.getElementById('new-sample-error');
  if (warnEl) warnEl.style.display = 'none';
  if (labelEl) labelEl.innerHTML = 'Sample No (Optional)';
  if (newSampleNoInput) {
    newSampleNoInput.style.borderColor = '';
    newSampleNoInput.placeholder = 'Leave blank to auto-generate';
  }
  if (errEl) errEl.style.display = 'none';
  createModal.classList.add('active');
  setTimeout(() => {
    if (newNameInput) newNameInput.focus();
  }, 100);
};

backToDashBtns.forEach(btn => btn.addEventListener('click', async () => {
  await saveNotesImmediate();
  currentCandidate = null;
  searchInput.value = '';
  searchError.innerText = '';
  switchView('dashboard');
}));

if (profileBackBtn) {
  profileBackBtn.addEventListener('click', async () => {
    await saveNotesImmediate();
    currentCandidate = null;
    searchInput.value = '';
    searchError.innerText = '';
    switchView('membersList');
  });
}

// Save Settings
saveSettingsBtn.addEventListener('click', async () => {
  const half = parseFloat(settingHalfLitre.value);
  const litre = parseFloat(settingLitre.value);
  const hMin = parseInt(settingHalfMin.value);
  const hMax = parseInt(settingHalfMax.value);
  const lMin = parseInt(settingLitreMin.value);
  const lMax = parseInt(settingLitreMax.value);
  
  if (!isNaN(half) && !isNaN(litre) && !isNaN(hMin) && !isNaN(hMax) && !isNaN(lMin) && !isNaN(lMax)) {
    globalSettings = { 
      halfLitreCost: half, 
      litreCost: litre,
      halfMin: hMin,
      halfMax: hMax,
      litreMin: lMin,
      litreMax: lMax,
      zoomFactor: currentZoom
    };
    await window.electronAPI.saveSettings(globalSettings);
    settingsMsg.innerText = "Settings Saved!";
    setTimeout(() => { settingsMsg.innerText = ''; }, 3000);
  } else {
    alert("Please enter valid numbers for all pricing and range fields.");
  }
});

// Zoom Event Handlers
if (zoomToggleBtn && zoomPopover) {
  zoomToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = zoomPopover.style.display !== 'none';
    zoomPopover.style.display = isVisible ? 'none' : 'block';
  });
}

if (zoomPopoverClose && zoomPopover) {
  zoomPopoverClose.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomPopover.style.display = 'none';
  });
}

if (zoomPopover) {
  zoomPopover.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent clicks inside popover from closing it
  });
}

// Close popover when clicking anywhere else
document.addEventListener('click', () => {
  if (zoomPopover && zoomPopover.style.display !== 'none') {
    zoomPopover.style.display = 'none';
  }
});

if (zoomInBtn) {
  zoomInBtn.addEventListener('click', () => setAppZoom(currentZoom + 0.05));
}
if (zoomOutBtn) {
  zoomOutBtn.addEventListener('click', () => setAppZoom(currentZoom - 0.05));
}
if (zoomResetBtn) {
  zoomResetBtn.addEventListener('click', () => setAppZoom(1.0));
}
if (zoomPopoverSlider) {
  zoomPopoverSlider.addEventListener('input', (e) => {
    setAppZoom(parseInt(e.target.value, 10) / 100);
  });
}
if (settingsZoomSlider) {
  settingsZoomSlider.addEventListener('input', (e) => {
    setAppZoom(parseInt(e.target.value, 10) / 100);
  });
}
zoomPresetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseFloat(btn.dataset.zoom);
    if (!isNaN(val)) setAppZoom(val);
  });
});

// Global Keyboard Shortcuts (Ctrl + / Ctrl - / Ctrl 0)
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
      e.preventDefault();
      setAppZoom(currentZoom + 0.05);
    } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      setAppZoom(currentZoom - 0.05);
    } else if (e.key === '0' || e.code === 'Numpad0') {
      e.preventDefault();
      setAppZoom(1.0);
    }
  }
});

// Global Mouse Wheel Zoom (Ctrl + Mouse Wheel)
window.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      setAppZoom(currentZoom + 0.05);
    } else if (e.deltaY > 0) {
      setAppZoom(currentZoom - 0.05);
    }
  }
}, { passive: false });

// Search Elements
const searchDropdown = document.getElementById('search-dropdown');

// Search Logic
function handleSearch(query) {
  query = query.trim().toLowerCase();
  searchError.innerText = '';
  
  if (!query) {
    searchDropdown.style.display = 'none';
    return;
  }
  
  const cands = Object.values(allCandidates);
  
  // Partial matches on name or sample number
  const matches = cands.filter(c => 
    c.name.toLowerCase().includes(query) || 
    (c.sampleNo && c.sampleNo.toLowerCase().includes(query))
  );
  
  if (matches.length > 0) {
    searchDropdown.innerHTML = '';
    matches.forEach(c => {
      const div = document.createElement('div');
      div.className = 'dropdown-item';
      div.innerHTML = `
        <span style="font-weight: 500;">${c.name}</span>
        ${c.sampleNo ? `<span style="color: var(--text-secondary); font-size: 0.85rem;">${c.sampleNo}</span>` : ''}
      `;
      div.addEventListener('click', () => {
        searchInput.value = '';
        searchDropdown.style.display = 'none';
        loadProfile(c);
      });
      searchDropdown.appendChild(div);
    });
    searchDropdown.style.display = 'block';
  } else {
    searchDropdown.innerHTML = '<div style="padding: 0.75rem 1rem; color: var(--text-secondary);">No results found</div>';
    searchDropdown.style.display = 'block';
  }
}

searchInput.addEventListener('input', (e) => {
  handleSearch(e.target.value);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchBtn.click();
  }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (searchDropdown && !searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
    searchDropdown.style.display = 'none';
  }
});

searchBtn.addEventListener('click', async () => {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return;

  allCandidates = await window.electronAPI.getCandidates();
  
  // Find exactly
  let found = null;
  for (const id in allCandidates) {
    const c = allCandidates[id];
    if ((c.sampleNo && c.sampleNo.toLowerCase() === query) || (c.name.toLowerCase() === query)) {
      found = c;
      break;
    }
  }
  
  if (found) {
    searchInput.value = '';
    searchDropdown.style.display = 'none';
    searchError.innerText = '';
    loadProfile(found);
  } else {
    searchError.innerText = 'Candidate not found.';
  }
});

// Export Search Dropdown Logic
const exportMemberDropdown = document.getElementById('export-member-dropdown');

if (exportMemberInput) {
  exportMemberInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    exportMemberInput.dataset.selectedId = ''; // clear selected ID on manual type
    
    if (!query) {
      exportMemberDropdown.style.display = 'none';
      return;
    }
    
    const cands = Object.values(allCandidates);
    const matches = cands.filter(c => 
      c.name.toLowerCase().includes(query) || 
      (c.sampleNo && c.sampleNo.toLowerCase().includes(query))
    );
    
    if (matches.length > 0) {
      exportMemberDropdown.innerHTML = '';
      matches.forEach(c => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.innerHTML = `
          <span style="font-weight: 500;">${c.name}</span>
          ${c.sampleNo ? `<span style="color: var(--text-secondary); font-size: 0.85rem;">${c.sampleNo}</span>` : ''}
        `;
        div.addEventListener('click', () => {
          exportMemberInput.value = c.name; 
          exportMemberInput.dataset.selectedId = c.id;
          exportMemberDropdown.style.display = 'none';
        });
        exportMemberDropdown.appendChild(div);
      });
      exportMemberDropdown.style.display = 'block';
    } else {
      exportMemberDropdown.innerHTML = '<div style="padding: 0.75rem 1rem; color: var(--text-secondary);">No results found</div>';
      exportMemberDropdown.style.display = 'block';
    }
  });

  document.addEventListener('click', (e) => {
    if (exportMemberDropdown && !exportMemberInput.contains(e.target) && !exportMemberDropdown.contains(e.target)) {
      exportMemberDropdown.style.display = 'none';
    }
  });
}

// Members List Logic
let membersFilterMode = 'all'; // 'all', 'due', 'active'
let globalTargetPeriodType = 'month'; // 'month' or 'year'

// Ctrl+R shortcut to refresh
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'r') {
    window.location.reload();
  }
});

const clearFilterBtn = document.getElementById('clear-filter-btn');
const boxTotalMembers = document.getElementById('box-total-members');
const boxTotalDue = document.getElementById('box-total-due');
const boxActiveMembers = document.getElementById('box-active-members');
const activeMonthsPopover = document.getElementById('active-months-popover');
const allMembersYearFilter = document.getElementById('all-members-year');
const periodRadios = document.querySelectorAll('input[name="period-type"]');

if (allMembersYearFilter && !allMembersYearFilter.value) {
  allMembersYearFilter.value = new Date().getFullYear();
}

periodRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    globalTargetPeriodType = e.target.value;
    if (globalTargetPeriodType === 'month') {
      if (allMembersMonthFilter) allMembersMonthFilter.style.display = 'block';
      if (allMembersYearFilter) allMembersYearFilter.style.display = 'none';
    } else {
      if (allMembersMonthFilter) allMembersMonthFilter.style.display = 'none';
      if (allMembersYearFilter) allMembersYearFilter.style.display = 'block';
    }
    renderAllMembers(allMembersSearch ? allMembersSearch.value : '');
  });
});

if (allMembersYearFilter) {
  allMembersYearFilter.addEventListener('change', () => {
    renderAllMembers(allMembersSearch ? allMembersSearch.value : '');
  });
}

function clearFilters() {
  membersFilterMode = 'all';
  if (allMembersSearch) allMembersSearch.value = '';
  const searchClear = document.getElementById('all-members-search-clear');
  if (searchClear) searchClear.style.display = 'none';
  if (clearFilterBtn) clearFilterBtn.style.display = 'none';
  renderAllMembers('');
}

if (clearFilterBtn) {
  clearFilterBtn.addEventListener('click', clearFilters);
}

if (boxTotalMembers) {
  boxTotalMembers.addEventListener('click', clearFilters);
}

if (boxTotalDue) {
  boxTotalDue.addEventListener('click', () => {
    membersFilterMode = 'due';
    if (clearFilterBtn) clearFilterBtn.style.display = 'inline-block';
    renderAllMembers(allMembersSearch ? allMembersSearch.value : '');
  });
}

if (boxActiveMembers) {
  boxActiveMembers.addEventListener('click', () => {
    membersFilterMode = 'active';
    if (clearFilterBtn) clearFilterBtn.style.display = 'inline-block';
    renderAllMembers(allMembersSearch ? allMembersSearch.value : '');
  });
}

const allMembersSort = document.getElementById('all-members-sort');
if (allMembersSort) {
  allMembersSort.addEventListener('change', () => {
    renderAllMembers(allMembersSearch ? allMembersSearch.value : '');
  });
}

const allMembersSearchClear = document.getElementById('all-members-search-clear');
if (allMembersSearch) {
  allMembersSearch.addEventListener('input', (e) => {
    if (allMembersSearchClear) {
      allMembersSearchClear.style.display = e.target.value ? 'flex' : 'none';
    }
    renderAllMembers(e.target.value);
  });
}

if (allMembersSearchClear) {
  allMembersSearchClear.addEventListener('click', () => {
    allMembersSearch.value = '';
    allMembersSearchClear.style.display = 'none';
    allMembersSearch.focus();
    renderAllMembers('');
  });
}

function renderAllMembers(searchQuery = '') {
  allMembersList.innerHTML = '';
  let cands = Object.values(allCandidates);
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    cands = cands.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.sampleNo && c.sampleNo.toLowerCase().includes(q)) ||
      (c.mobileNo && c.mobileNo.toLowerCase().includes(q))
    );
  }

  // Sort logic
  const sortVal = allMembersSort ? allMembersSort.value : 'name-asc';
  cands.sort((a, b) => {
    if (sortVal === 'name-asc') return a.name.localeCompare(b.name);
    if (sortVal === 'name-desc') return b.name.localeCompare(a.name);
    if (sortVal === 'sample-asc') {
      const numA = parseInt(a.sampleNo) || 0;
      const numB = parseInt(b.sampleNo) || 0;
      return numA - numB;
    }
    if (sortVal === 'sample-desc') {
      const numA = parseInt(a.sampleNo) || 0;
      const numB = parseInt(b.sampleNo) || 0;
      return numB - numA;
    }
    return 0;
  });

  // Stats logic
  let selYear = null;
  let selMonth = null;
  
  if (globalTargetPeriodType === 'month') {
    const monthVal = allMembersMonthFilter ? allMembersMonthFilter.value : '';
    if (monthVal) [selYear, selMonth] = monthVal.split('-');
  } else {
    selYear = allMembersYearFilter ? allMembersYearFilter.value : null;
  }

  let totalMembers = cands.length;
  let activeCount = 0;
  let totalDue = 0;

  cands.forEach(c => {
    let isActiveThisPeriod = false;
    c.cards.forEach(card => {
      if (!selYear || !card.dateAdded) return;
      const d = new Date(card.dateAdded);
      
      let matchesPeriod = false;
      if (globalTargetPeriodType === 'month') {
        matchesPeriod = (d.getFullYear().toString() === selYear && (d.getMonth() + 1).toString().padStart(2, '0') === selMonth);
      } else {
        matchesPeriod = (d.getFullYear().toString() === selYear);
      }
      
      if (matchesPeriod) {
        isActiveThisPeriod = true;
        if (!card.paid) {
          totalDue += card.cost;
        }
      }
    });
    if (isActiveThisPeriod) activeCount++;
  });

  const countEl = document.getElementById('all-members-total-count');
  if (countEl) countEl.innerText = totalMembers;

  const membersBadge = document.getElementById('members-count-badge');
  if (membersBadge) {
    membersBadge.innerText = `${totalMembers} Member${totalMembers === 1 ? '' : 's'}`;
  }
  
  const activeEl = document.getElementById('all-members-active-count');
  if (activeEl) activeEl.innerText = activeCount;

  const dueEl = document.getElementById('all-members-total-due');
  if (dueEl) dueEl.innerText = formatINR(totalDue);

  // Apply visual feedback for selected box
  if (boxTotalMembers) {
    boxTotalMembers.style.borderWidth = membersFilterMode === 'all' ? '6px' : '4px';
    boxTotalMembers.style.boxShadow = membersFilterMode === 'all' ? 'var(--shadow-md)' : 'none';
    boxTotalMembers.style.transform = membersFilterMode === 'all' ? 'translateY(-2px)' : 'none';
  }
  if (boxTotalDue) {
    boxTotalDue.style.borderWidth = membersFilterMode === 'due' ? '6px' : '4px';
    boxTotalDue.style.boxShadow = membersFilterMode === 'due' ? 'var(--shadow-md)' : 'none';
    boxTotalDue.style.transform = membersFilterMode === 'due' ? 'translateY(-2px)' : 'none';
  }
  if (boxActiveMembers) {
    boxActiveMembers.style.borderWidth = membersFilterMode === 'active' ? '6px' : '4px';
    boxActiveMembers.style.boxShadow = membersFilterMode === 'active' ? 'var(--shadow-md)' : 'none';
    boxActiveMembers.style.transform = membersFilterMode === 'active' ? 'translateY(-2px)' : 'none';
  }

  // Apply list filter
  if (membersFilterMode === 'due' || membersFilterMode === 'active') {
    cands = cands.filter(c => {
      return c.cards.some(card => {
        if (!selYear || !card.dateAdded) return false;
        
        const d = new Date(card.dateAdded);
        let matchesPeriod = false;
        if (globalTargetPeriodType === 'month') {
          matchesPeriod = (d.getFullYear().toString() === selYear && (d.getMonth() + 1).toString().padStart(2, '0') === selMonth);
        } else {
          matchesPeriod = (d.getFullYear().toString() === selYear);
        }
        
        if (!matchesPeriod) return false;
        if (membersFilterMode === 'due' && card.paid) return false;
        return true;
      });
    });
  }

  if (cands.length === 0) {
    allMembersList.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1.5rem; color: var(--text-secondary);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">👥</div>
        <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-primary);">No members found</p>
        <p style="font-size: 0.9rem; margin-bottom: 1.25rem;">Would you like to register a new member?</p>
        <button class="btn-primary" onclick="window.showNewMemberModal()" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.25rem; font-size: 0.95rem; font-weight: 600; border-radius: 8px;">
          <span>➕</span> Register Member
        </button>
      </div>
    `;
    return;
  }
  
  cands.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card-item';
    div.style.cursor = 'pointer';
    
    const sampleTag = (c.sampleNo && c.sampleNo.trim())
      ? `<span class="member-sample-tag">Sample No: <b>${c.sampleNo.trim()}</b></span>`
      : `<span class="member-sample-tag unassigned">Sample No: <b>Not Assigned</b></span>`;

    const mobileTag = (c.mobileNo && c.mobileNo.trim())
      ? `<span class="member-mobile-tag">📱 ${c.mobileNo.trim()}</span>`
      : '';

    div.innerHTML = `
      <div class="card-info" style="gap: 0.45rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.25rem;">👤</span>
          <span class="card-number" style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${c.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
          ${sampleTag}
          ${mobileTag}
          <span class="member-cards-tag">📦 Cards: <b>${c.cards.length}</b></span>
        </div>
      </div>
      <button class="btn-primary" onclick="window.loadCandidateById('${c.id}')" style="padding: 0.6rem 1.25rem; font-weight: 600;">View Profile</button>
    `;
    div.addEventListener('click', (e) => {
      if(e.target.tagName !== 'BUTTON') {
         window.loadCandidateById(c.id);
      }
    });
    allMembersList.appendChild(div);
  });
}

window.loadCandidateById = (id) => {
  if (allCandidates[id]) {
    loadProfile(allCandidates[id]);
  }
};

// Create Candidate Modal
document.getElementById('cancel-candidate-btn').addEventListener('click', () => {
  createModal.classList.remove('active');
});

function checkNewMemberNameDuplicate() {
  const val = newNameInput.value.trim().toLowerCase();
  const warnEl = document.getElementById('new-name-warn');
  const labelEl = document.getElementById('new-sample-no-label');
  const sampleInp = document.getElementById('new-sample-no');
  const errEl = document.getElementById('new-sample-error');
  if (errEl) errEl.style.display = 'none';

  if (!val) {
    if (warnEl) warnEl.style.display = 'none';
    if (labelEl) labelEl.innerHTML = 'Sample No (Optional)';
    if (sampleInp) {
      sampleInp.style.borderColor = '';
      sampleInp.placeholder = 'Leave blank to auto-generate';
    }
    return false;
  }

  const hasDuplicate = Object.values(allCandidates).some(
    c => c.name && c.name.trim().toLowerCase() === val
  );

  if (hasDuplicate) {
    if (warnEl) warnEl.style.display = 'block';
    if (labelEl) labelEl.innerHTML = 'Sample No <span style="color: var(--danger); font-weight: 700;">(Mandatory - Duplicate Name)</span>';
    if (sampleInp) {
      sampleInp.style.borderColor = 'var(--danger)';
      sampleInp.placeholder = 'Mandatory: Enter unique Sample Number';
    }
    return true;
  } else {
    if (warnEl) warnEl.style.display = 'none';
    if (labelEl) labelEl.innerHTML = 'Sample No (Optional)';
    if (sampleInp) {
      sampleInp.style.borderColor = '';
      sampleInp.placeholder = 'Leave blank to auto-generate';
    }
    return false;
  }
}

if (newNameInput) {
  newNameInput.addEventListener('input', checkNewMemberNameDuplicate);
  newNameInput.addEventListener('change', checkNewMemberNameDuplicate);
}

document.getElementById('save-candidate-btn').addEventListener('click', async () => {
  const name = newNameInput.value.trim();
  const mobileNo = newMobileNoInput.value.trim();
  const sampleNo = newSampleNoInput.value.trim();
  const sampleErrEl = document.getElementById('new-sample-error');
  if (sampleErrEl) sampleErrEl.style.display = 'none';
  
  if (!name) {
    alert("Candidate Name is mandatory.");
    newNameInput.focus();
    return;
  }

  // Check if duplicate name exists in allCandidates
  const duplicateNameCandidate = Object.values(allCandidates).find(
    c => c.name && c.name.trim().toLowerCase() === name.toLowerCase()
  );

  if (duplicateNameCandidate) {
    if (!sampleNo) {
      const msg = `A member with the name "${name}" already exists in the system!\n\nTo register another member with the exact same name, entering a unique Sample Number is MANDATORY to distinguish them.`;
      alert(msg, 'danger', '⚠️ Duplicate Name Warning');
      if (sampleErrEl) {
        sampleErrEl.innerText = "Sample Number is mandatory because a member with this name already exists!";
        sampleErrEl.style.display = 'block';
      }
      newSampleNoInput.focus();
      return;
    }
  }

  if (sampleNo) {
    const isDuplicateSample = Object.values(allCandidates).some(
      c => c.sampleNo && c.sampleNo.trim().toLowerCase() === sampleNo.toLowerCase()
    );
    if (isDuplicateSample) {
      alert(`This Sample Number (${sampleNo}) is already assigned to another member. Please use a different one.`, 'danger', '⚠️ Duplicate Sample Number');
      if (sampleErrEl) {
        sampleErrEl.innerText = `Sample Number "${sampleNo}" is already in use. Please enter a different number.`;
        sampleErrEl.style.display = 'block';
      }
      newSampleNoInput.focus();
      return;
    }
  }

  const newCandidate = {
    id: generateId(),
    sampleNo: sampleNo || '',
    mobileNo: mobileNo || '',
    name,
    notes: '',
    monthlyNotes: {},
    cards: []
  };

  await window.electronAPI.saveCandidate(newCandidate);
  allCandidates[newCandidate.id] = newCandidate;
  createModal.classList.remove('active');
  loadProfile(newCandidate);
});

[newNameInput, newMobileNoInput, newSampleNoInput].forEach(inp => {
  if (inp) {
    inp.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const saveBtn = document.getElementById('save-candidate-btn');
        if (saveBtn) saveBtn.click();
      }
    });
  }
});

// Load Profile
function loadProfile(candidate) {
  currentCandidate = candidate;
  
  // Legacy migration for notes
  if (candidate.notes && typeof candidate.notes === 'string' && !candidate.monthlyNotes) {
    candidate.monthlyNotes = {};
    const ym = globalMonthFilter.value;
    candidate.monthlyNotes[ym] = candidate.notes;
    candidate.notes = ''; // Clear legacy string
    // Save to persist migration
    window.electronAPI.saveCandidate(candidate);
  }

  profileName.innerText = candidate.name || 'Unnamed Member';
  
  const sampleEl = document.getElementById('profile-sample-no');
  const sampleContainer = document.getElementById('profile-sample-container');
  if (sampleEl) {
    if (candidate.sampleNo && candidate.sampleNo.trim()) {
      sampleEl.innerText = candidate.sampleNo.trim();
      if (sampleContainer) {
        sampleContainer.style.background = '#e0f2fe';
        sampleContainer.style.color = '#00509e';
        sampleContainer.style.borderColor = '#00509e';
      }
    } else {
      sampleEl.innerText = 'Not Assigned';
      if (sampleContainer) {
        sampleContainer.style.background = '#fee2e2';
        sampleContainer.style.color = '#dc2626';
        sampleContainer.style.borderColor = '#fca5a5';
      }
    }
  }

  const mobileEl = document.getElementById('profile-mobile-no');
  const mobileContainer = document.getElementById('profile-mobile-container');
  if (mobileEl) {
    if (candidate.mobileNo && candidate.mobileNo.trim()) {
      mobileEl.innerText = candidate.mobileNo.trim();
      if (mobileContainer) mobileContainer.style.display = 'inline-flex';
    } else {
      mobileEl.innerText = 'Not Provided';
      if (mobileContainer) mobileContainer.style.display = 'inline-flex';
    }
  }
  
  const m = globalMonthFilter.value;
  notesInput.value = (candidate.monthlyNotes && candidate.monthlyNotes[m]) || '';
  
  renderCards();
  switchView('profile');
}

// Notes Logic
async function saveNotesImmediate() {
  if (currentCandidate) {
    const m = globalMonthFilter.value;
    if (!currentCandidate.monthlyNotes) {
      currentCandidate.monthlyNotes = {};
    }
    if (currentCandidate.monthlyNotes[m] !== notesInput.value) {
      currentCandidate.monthlyNotes[m] = notesInput.value;
      await window.electronAPI.saveCandidate(currentCandidate);
      updateHighlights();
    }
  }
}

notesInput.addEventListener('blur', saveNotesImmediate);
notesInput.addEventListener('change', saveNotesImmediate);

let noteTimeout;
notesInput.addEventListener('input', () => {
  clearTimeout(noteTimeout);
  noteTimeout = setTimeout(saveNotesImmediate, 500);
});

function updateHighlights() {
  if (!currentCandidate) return;
  
  notesCard.className = 'card highlightable'; // reset
  
  const hasUnpaid = currentCandidate.cards.some(c => !c.paid);
  
  const m = globalMonthFilter.value;
  const notesText = ((currentCandidate.monthlyNotes && currentCandidate.monthlyNotes[m]) || '').toLowerCase();
  const alertKeywords = ['alert', 'urgent', 'important'];
  
  const hasAlertWord = alertKeywords.some(w => notesText.includes(w));

  if (hasUnpaid) {
    notesCard.classList.add('danger');
  } else if (hasAlertWord) {
    notesCard.classList.add('alert');
  }
}

// Profile Management Logic
function checkEditMemberNameDuplicate() {
  const val = editMemberName.value.trim().toLowerCase();
  const warnEl = document.getElementById('edit-name-warn');
  const labelEl = document.getElementById('edit-sample-no-label');
  const sampleInp = document.getElementById('edit-member-sample-no');
  const errEl = document.getElementById('edit-sample-error');
  if (errEl) errEl.style.display = 'none';

  if (!val) {
    if (warnEl) warnEl.style.display = 'none';
    if (labelEl) labelEl.innerHTML = 'Sample Number (Optional)';
    if (sampleInp) sampleInp.style.borderColor = '';
    return false;
  }

  const hasDuplicate = Object.values(allCandidates).some(
    c => c.id !== currentCandidate?.id && c.name && c.name.trim().toLowerCase() === val
  );

  if (hasDuplicate) {
    if (warnEl) warnEl.style.display = 'block';
    if (labelEl) labelEl.innerHTML = 'Sample Number <span style="color: var(--danger); font-weight: 700;">(Mandatory - Same Name Exists)</span>';
    if (sampleInp) sampleInp.style.borderColor = 'var(--danger)';
    return true;
  } else {
    if (warnEl) warnEl.style.display = 'none';
    if (labelEl) labelEl.innerHTML = 'Sample Number (Optional)';
    if (sampleInp) sampleInp.style.borderColor = '';
    return false;
  }
}

if (editMemberName) {
  editMemberName.addEventListener('input', checkEditMemberNameDuplicate);
  editMemberName.addEventListener('change', checkEditMemberNameDuplicate);
}

editProfileBtn.addEventListener('click', () => {
  editMemberName.value = currentCandidate.name;
  editMemberMobileNo.value = currentCandidate.mobileNo || '';
  editMemberSampleNo.value = currentCandidate.sampleNo || '';
  checkEditMemberNameDuplicate();
  editModal.classList.add('active');
  setTimeout(() => {
    if (editMemberName) editMemberName.focus();
  }, 100);
});

cancelEditMemberBtn.addEventListener('click', () => {
  editModal.classList.remove('active');
});

saveEditMemberBtn.addEventListener('click', async () => {
  const newName = editMemberName.value.trim();
  const newMobileNo = editMemberMobileNo.value.trim();
  const newSampleNo = editMemberSampleNo.value.trim();
  const sampleErrEl = document.getElementById('edit-sample-error');
  if (sampleErrEl) sampleErrEl.style.display = 'none';
  
  if (!newName) {
    alert("Candidate Name is mandatory.");
    editMemberName.focus();
    return;
  }

  // Check if duplicate name exists on another member
  const duplicateNameCandidate = Object.values(allCandidates).find(
    c => c.id !== currentCandidate.id && c.name && c.name.trim().toLowerCase() === newName.toLowerCase()
  );

  if (duplicateNameCandidate) {
    if (!newSampleNo) {
      const msg = `A member with the name "${newName}" already exists in the system!\n\nTo keep this name, a unique Sample Number is MANDATORY to distinguish them.`;
      alert(msg, 'danger', '⚠️ Duplicate Name Warning');
      if (sampleErrEl) {
        sampleErrEl.innerText = "Sample Number is mandatory because another member has this name!";
        sampleErrEl.style.display = 'block';
      }
      editMemberSampleNo.focus();
      return;
    }
  }
  
  if (newSampleNo) {
    const isDuplicateSample = Object.values(allCandidates).some(
      c => c.id !== currentCandidate.id && c.sampleNo && c.sampleNo.trim().toLowerCase() === newSampleNo.toLowerCase()
    );
    if (isDuplicateSample) {
      alert(`This Sample Number (${newSampleNo}) is already assigned to another member. Please use a different one.`, 'danger', '⚠️ Duplicate Sample Number');
      if (sampleErrEl) {
        sampleErrEl.innerText = `Sample Number "${newSampleNo}" is already in use.`;
        sampleErrEl.style.display = 'block';
      }
      editMemberSampleNo.focus();
      return;
    }
  }
  
  currentCandidate.name = newName;
  currentCandidate.mobileNo = newMobileNo;
  currentCandidate.sampleNo = newSampleNo;
  allCandidates[currentCandidate.id] = currentCandidate;
  
  await window.electronAPI.saveCandidate(currentCandidate);
  
  loadProfile(currentCandidate);
  editModal.classList.remove('active');
});

[editMemberName, editMemberMobileNo, editMemberSampleNo].forEach(inp => {
  if (inp) {
    inp.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveEditMemberBtn.click();
      }
    });
  }
});

deleteProfileBtn.addEventListener('click', async () => {
  if (await confirm(`Are you sure you want to permanently delete ${currentCandidate.name} and ALL their cards? This action cannot be undone.`)) {
    await window.electronAPI.deleteCandidate(currentCandidate.id);
    delete allCandidates[currentCandidate.id];
    
    currentCandidate = null;
    searchInput.value = '';
    searchError.innerText = '';
    if (searchDropdown) searchDropdown.style.display = 'none';
    switchView('dashboard');
  }
});

// Auto-fill Card Cost based on Number
newCardNumber.addEventListener('input', () => {
  const num = parseInt(newCardNumber.value);
  if (!isNaN(num)) {
    if (num >= (globalSettings.halfMin || 1) && num <= (globalSettings.halfMax || 500)) {
      newCardCost.value = globalSettings.halfLitreCost;
    } else if (num >= (globalSettings.litreMin || 501) && num <= (globalSettings.litreMax || 1500)) {
      newCardCost.value = globalSettings.litreCost;
    } else {
      newCardCost.value = '';
    }
  } else {
    newCardCost.value = '';
  }
});

// Cards Logic
addCardBtn.addEventListener('click', () => {
  addCardForm.style.display = 'flex';
  addCardBtn.style.display = 'none';
});

cancelCardBtn.addEventListener('click', () => {
  addCardForm.style.display = 'none';
  addCardBtn.style.display = 'inline-flex';
  newCardNumber.value = '';
  newCardCost.value = '';
});

saveCardBtn.addEventListener('click', async () => {
  const num = newCardNumber.value.trim();
  const cost = parseFloat(newCardCost.value);
  
  if (!num || isNaN(cost)) {
    alert("Please enter valid card details.");
    return;
  }

  let dateAdded = new Date();
  const selectedMonthVal = globalMonthFilter.value;
  if (selectedMonthVal) {
    const [selYear, selMonth] = selectedMonthVal.split('-');
    if (dateAdded.getFullYear().toString() !== selYear || (dateAdded.getMonth() + 1).toString().padStart(2, '0') !== selMonth) {
      dateAdded = new Date(selYear, parseInt(selMonth) - 1, 1, 12, 0, 0);
    }
  }

  const newCard = {
    id: generateId(),
    cardNumber: num,
    cost: cost,
    paid: false,
    paidDate: null,
    dateAdded: dateAdded.toISOString()
  };

  currentCandidate.cards.push(newCard);
  await window.electronAPI.saveCandidate(currentCandidate);
  
  cancelCardBtn.click(); // Reset form
  renderCards();
});

window.markPaid = async (cardId) => {
  const card = currentCandidate.cards.find(c => c.id === cardId);
  if (card && !card.paid) {
    card.paid = true;
    card.paidDate = new Date().toLocaleDateString('en-IN');
    await window.electronAPI.saveCandidate(currentCandidate);
    renderCards();
  }
};

window.undoPaid = async (cardId) => {
  const card = currentCandidate.cards.find(c => c.id === cardId);
  if (card && card.paid) {
    card.paid = false;
    card.paidDate = null;
    await window.electronAPI.saveCandidate(currentCandidate);
    renderCards();
  }
};

window.deleteCard = async (cardId) => {
  if (await confirm("Are you sure you want to delete this card?")) {
    currentCandidate.cards = currentCandidate.cards.filter(c => c.id !== cardId);
    await window.electronAPI.saveCandidate(currentCandidate);
    renderCards();
  }
};

window.editCard = (cardId) => {
  const card = currentCandidate.cards.find(c => c.id === cardId);
  if (!card) return;
  
  const cardDiv = document.getElementById(`card-${cardId}`);
  cardDiv.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
      <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">Edit Card / Add Extra Cost:</label>
      <div style="display: flex; gap: 0.5rem; width: 100%;">
        <input type="number" id="edit-num-${cardId}" value="${card.cardNumber}" placeholder="Card No" style="flex: 1; padding: 0.4rem; font-size: 0.9rem;" />
        <input type="number" id="edit-cost-${cardId}" value="${card.cost}" step="0.01" placeholder="Base Cost" style="flex: 1; padding: 0.4rem; font-size: 0.9rem;" />
        <input type="number" id="edit-add-${cardId}" value="0" step="0.01" placeholder="+ Add Cost" style="flex: 1; padding: 0.4rem; font-size: 0.9rem; border-color: var(--primary);" />
      </div>
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
        <button class="btn-success" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="window.saveEditCard('${cardId}')">Save</button>
        <button class="btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="renderCards()">Cancel</button>
      </div>
    </div>
  `;
};

window.saveEditCard = async (cardId) => {
  const card = currentCandidate.cards.find(c => c.id === cardId);
  const newNum = document.getElementById(`edit-num-${cardId}`).value;
  const baseCost = parseFloat(document.getElementById(`edit-cost-${cardId}`).value);
  const addCost = parseFloat(document.getElementById(`edit-add-${cardId}`).value) || 0;
  
  if (newNum && !isNaN(baseCost)) {
    card.cardNumber = newNum;
    card.cost = baseCost + addCost;
    await window.electronAPI.saveCandidate(currentCandidate);
    renderCards();
  } else {
    alert("Please enter valid card number and base cost.");
  }
};

function renderCards() {
  cardsList.innerHTML = '';
  let totalDue = 0;
  let totalPaid = 0;
  let count = 0;
  
  const selectedMonthVal = globalMonthFilter.value;
  let selYear = null;
  let selMonth = null;
  
  if (selectedMonthVal) {
    [selYear, selMonth] = selectedMonthVal.split('-');
  }

  // Filter cards by month
  const monthCards = currentCandidate.cards.filter(c => {
    if (!selYear || !c.dateAdded) return true; // fallback
    const d = new Date(c.dateAdded);
    return d.getFullYear().toString() === selYear && (d.getMonth() + 1).toString().padStart(2, '0') === selMonth;
  });

  if (monthCards.length === 0) {
    cardsList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 1rem;">No cards found for this month.</div>';
  } else {
    // Sort cards so newest is on top
    const sortedCards = monthCards.sort((a,b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    
    sortedCards.forEach(card => {
      count++;
      if (card.paid) {
        totalPaid += card.cost;
      } else {
        totalDue += card.cost;
      }

      const dateAddedStr = card.dateAdded ? new Date(card.dateAdded).toLocaleDateString('en-IN') : 'Unknown Date';

      const div = document.createElement('div');
      div.className = `card-item ${card.paid ? 'paid' : ''}`;
      div.id = `card-${card.id}`;
      
      div.innerHTML = `
        <div class="card-info">
          <span class="card-number">Card No: ${card.cardNumber}</span>
          <span class="card-cost">${formatINR(card.cost)} ${card.paid ? `(Paid on ${card.paidDate})` : ''}</span>
          <span class="card-date">Added: ${dateAddedStr}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
          ${!card.paid ? `<button class="btn-success" style="padding: 0.4rem 0.8rem; font-size: 0.9rem;" onclick="window.markPaid('${card.id}')">Mark Paid</button>` : ''}
          <div style="display: flex; gap: 0.5rem;">
            ${card.paid ? `<button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; color: var(--warning);" onclick="window.undoPaid('${card.id}')">↩ Undo Paid</button>` : ''}
            ${!card.paid ? `<button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="window.editCard('${card.id}')">✏️ Edit</button>` : ''}
            <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; color: var(--danger);" onclick="window.deleteCard('${card.id}')">🗑️ Delete</button>
          </div>
        </div>
      `;
      cardsList.appendChild(div);
    });
  }

  totalPaidEl.innerText = formatINR(totalPaid);
  totalDueEl.innerText = formatINR(totalDue);
  analyticsCardCount.innerText = count;
  
  // Calculate Overall Dues and Breakdown
  let overallDue = 0;
  const duesByMonth = {};
  const duesByYear = {};

  currentCandidate.cards.forEach(c => {
    if (!c.paid) {
      overallDue += c.cost;
      const d = c.dateAdded ? new Date(c.dateAdded) : new Date();
      const ym = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const y = d.getFullYear().toString();
      if (!duesByMonth[ym]) duesByMonth[ym] = 0;
      duesByMonth[ym] += c.cost;
      if (!duesByYear[y]) duesByYear[y] = 0;
      duesByYear[y] += c.cost;
    }
  });

  const overallTotalDueEl = document.getElementById('overall-total-due');
  const monthlyDuesListEl = document.getElementById('monthly-dues-list');

  if (overallTotalDueEl) overallTotalDueEl.innerText = formatINR(overallDue);
  if (monthlyDuesListEl) {
    monthlyDuesListEl.innerHTML = '';
    
    const sortedYears = Object.keys(duesByYear).sort((a, b) => b - a);
    if (sortedYears.length > 0) {
      const yearHeader = document.createElement('div');
      yearHeader.innerHTML = '<strong style="font-size: 0.9rem; color: var(--text-secondary); display: block; margin-top: 0.5rem; margin-bottom: 0.25rem;">Yearly Summary</strong>';
      monthlyDuesListEl.appendChild(yearHeader);
      
      sortedYears.forEach(y => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.padding = '0.5rem';
        div.style.background = '#e0f2fe';
        div.style.borderRadius = '6px';
        div.style.border = '1px solid var(--card-border)';
        div.style.marginBottom = '0.5rem';
        div.innerHTML = `
          <span style="font-weight: 600; font-size: 0.9rem; color: #0284c7;">Year ${y}</span>
          <span class="text-danger" style="font-weight: 700; font-size: 0.9rem;">${formatINR(duesByYear[y])}</span>
        `;
        monthlyDuesListEl.appendChild(div);
      });
    }

    const sortedMonths = Object.keys(duesByMonth).sort((a, b) => new Date(b) - new Date(a));
    if (sortedMonths.length === 0) {
      monthlyDuesListEl.innerHTML = '<span style="color: var(--success); font-size: 0.9rem;">No pending dues!</span>';
    } else {
      const monthHeader = document.createElement('div');
      monthHeader.innerHTML = '<strong style="font-size: 0.9rem; color: var(--text-secondary); display: block; margin-top: 0.5rem; margin-bottom: 0.25rem;">Monthly Breakdown</strong>';
      monthlyDuesListEl.appendChild(monthHeader);

      sortedMonths.forEach(m => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.padding = '0.5rem';
        div.style.background = '#f8fafc';
        div.style.borderRadius = '6px';
        div.style.border = '1px solid var(--card-border)';
        div.style.marginBottom = '0.25rem';
        div.innerHTML = `
          <span style="font-weight: 500; font-size: 0.9rem;">${m}</span>
          <span class="text-danger" style="font-weight: 600; font-size: 0.9rem;">${formatINR(duesByMonth[m])}</span>
        `;
        monthlyDuesListEl.appendChild(div);
      });
    }
  }

  updateHighlights();
}

// --- DASHBOARD V4 LOGIC ---

function renderDashboard() {
  if(!dashboardMonthFilter) return;
  const selectedMonthVal = dashboardMonthFilter.value;
  let selYear = null;
  let selMonth = null;
  if (selectedMonthVal) {
    [selYear, selMonth] = selectedMonthVal.split('-');
  }

  const cands = Object.values(allCandidates);
  dashTotalMembers.innerText = cands.length;

  let activeCount = 0;
  let totalDue = 0;
  let totalPaid = 0;
  let litreCount = 0;
  let halfCount = 0;
  
  dashboardTableBody.innerHTML = '';

  cands.forEach(c => {
    const monthCards = c.cards.filter(card => {
      if (!selYear || !card.dateAdded) return true;
      const d = new Date(card.dateAdded);
      return d.getFullYear().toString() === selYear && (d.getMonth() + 1).toString().padStart(2, '0') === selMonth;
    });

    const yearCards = c.cards.filter(card => {
      if (!selYear || !card.dateAdded) return true;
      const d = new Date(card.dateAdded);
      return d.getFullYear().toString() === selYear;
    });

    let yearlyDueCards = [];
    let yearlyTotalDue = 0;
    yearCards.forEach(card => {
      if (!card.paid) {
        yearlyTotalDue += card.cost;
        yearlyDueCards.push(`<span style="color: var(--danger); font-weight: 600;">${card.cardNumber}</span>`);
      }
    });

    if (monthCards.length > 0 || yearlyTotalDue > 0) {
      if (monthCards.length > 0) activeCount++;
      let memberPaid = 0;
      let memberDue = 0;
      let cardBadges = [];

      monthCards.forEach(card => {
        if (card.paid) {
          totalPaid += card.cost;
          memberPaid += card.cost;
          cardBadges.push(`<span style="color: var(--success); font-weight: 600;">${card.cardNumber}</span>`);
        } else {
          totalDue += card.cost;
          memberDue += card.cost;
          cardBadges.push(`<span style="color: var(--danger); font-weight: 600;">${card.cardNumber}</span>`);
        }

        const type = getCardType(card.cardNumber);
        if (type === 'Half-Litre') {
          halfCount++;
        } else if (type === 'Litre') {
          litreCount++;
        }
      });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding: 0.75rem; border-bottom: 1px solid var(--card-border);">
          <strong>${c.name}</strong><br/>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${c.sampleNo ? `Sample: ${c.sampleNo}` : 'N/A'}</span>
        </td>
        <td style="padding: 0.75rem; border-bottom: 1px solid var(--card-border);">
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">${cardBadges.length ? cardBadges.join(', ') : '-'}</div>
        </td>
        <td style="padding: 0.75rem; border-bottom: 1px solid var(--card-border); color: var(--success); font-weight: 600;">
          ${memberPaid > 0 ? formatINR(memberPaid) : '-'}
        </td>
        <td style="padding: 0.75rem; border-bottom: 1px solid var(--card-border); color: var(--danger); font-weight: 600;">
          ${memberDue > 0 ? formatINR(memberDue) : '-'}
        </td>
        <td style="padding: 0.75rem; border-bottom: 1px solid var(--card-border);">
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">${yearlyDueCards.length ? yearlyDueCards.join(', ') : '-'}</div>
        </td>
        <td style="padding: 0.75rem; border-bottom: 1px solid var(--card-border); color: var(--danger); font-weight: 600;">
          ${yearlyTotalDue > 0 ? formatINR(yearlyTotalDue) : '-'}
        </td>
      `;
      dashboardTableBody.appendChild(tr);
    }
  });

  if (dashboardTableBody.innerHTML === '') {
    dashboardTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1rem; color: var(--text-secondary);">No purchases or yearly dues found.</td></tr>';
  }

  dashActiveMembers.innerText = activeCount;
  dashTotalDue.innerText = formatINR(totalDue);
  dashTotalPaid.innerText = formatINR(totalPaid);
  dashLitreCards.innerText = litreCount;
  dashHalfCards.innerText = halfCount;

  // Chart Rendering
  const financeCtx = document.getElementById('chartFinance');
  const cardsCtx = document.getElementById('chartCards');

  if (financeCtx && cardsCtx) {
    if (financeChartInstance) financeChartInstance.destroy();
    if (cardsChartInstance) cardsChartInstance.destroy();

    financeChartInstance = new Chart(financeCtx, {
      type: 'doughnut',
      data: {
        labels: ['Amount Paid', 'Amount Due'],
        datasets: [{
          data: [totalPaid, totalDue],
          backgroundColor: ['#10b981', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 } } } }
      }
    });

    cardsChartInstance = new Chart(cardsCtx, {
      type: 'pie',
      data: {
        labels: ['Litre Cards', 'Half-Litre Cards'],
        datasets: [{
          data: [litreCount, halfCount],
          backgroundColor: ['#3b82f6', '#10b981'], // Blue for Litre, Green for Half-Litre
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 } } } }
      }
    });
  }
}

// --- CALCULATOR LOGIC ---
let calcValue = '0';
let calcOp = null;
let calcPrev = null;
let calcNewNumber = false;

const opSymbols = { 'add': '+', 'sub': '-', 'mul': '×', 'div': '÷' };

function updateCalcDisplay() {
  document.getElementById('calc-display').innerText = calcValue;
  if (calcOp && calcPrev !== null) {
    document.getElementById('calc-history').innerText = `${calcPrev} ${opSymbols[calcOp]}`;
  } else {
    document.getElementById('calc-history').innerText = '';
  }
}

window.showCalculatorModal = () => {
  document.getElementById('calculator-modal').classList.add('active');
  calcValue = '0';
  calcOp = null;
  calcPrev = null;
  calcNewNumber = false;
  updateCalcDisplay();
};

window.calcAction = (type, val) => {
  if (type === 'num') {
    if (calcValue === '0' || calcNewNumber) {
      calcValue = String(val);
      calcNewNumber = false;
    } else {
      calcValue += String(val);
    }
  } else if (type === 'dot') {
    if (calcNewNumber) {
      calcValue = '0.';
      calcNewNumber = false;
    } else if (!calcValue.includes('.')) {
      calcValue += '.';
    }
  } else if (type === 'clear') {
    calcValue = '0';
    calcOp = null;
    calcPrev = null;
    calcNewNumber = false;
  } else if (['add', 'sub', 'mul', 'div'].includes(type)) {
    if (calcOp && !calcNewNumber) {
      calcValue = evaluateCalc(calcPrev, calcValue, calcOp);
    }
    calcOp = type;
    calcPrev = calcValue;
    calcNewNumber = true;
  } else if (type === 'eq') {
    if (calcOp && !calcNewNumber) {
      calcValue = evaluateCalc(calcPrev, calcValue, calcOp);
      calcOp = null;
      calcPrev = null;
      calcNewNumber = true;
    }
  }
  updateCalcDisplay();
};

document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('calculator-modal');
  if (modal && modal.classList.contains('active')) {
    const key = e.key;
    if (key >= '0' && key <= '9') {
      window.calcAction('num', parseInt(key));
    } else if (key === '.') {
      window.calcAction('dot');
    } else if (key === '+' || key === '-') {
      window.calcAction(key === '+' ? 'add' : 'sub');
    } else if (key === '*' || key === '/') {
      window.calcAction(key === '*' ? 'mul' : 'div');
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      window.calcAction('eq');
    } else if (key === 'Escape' || key === 'c' || key === 'C') {
      window.calcAction('clear');
    } else if (key === 'Backspace') {
      if (!calcNewNumber && calcValue.length > 0) {
        calcValue = calcValue.slice(0, -1);
        if (calcValue === '' || calcValue === '-') calcValue = '0';
        updateCalcDisplay();
      }
    }
  }
});

function evaluateCalc(a, b, op) {
  const n1 = parseFloat(a);
  const n2 = parseFloat(b);
  let res = 0;
  if (op === 'add') res = n1 + n2;
  if (op === 'sub') res = n1 - n2;
  if (op === 'mul') res = n1 * n2;
  if (op === 'div') res = n2 !== 0 ? n1 / n2 : 0;
  // Format to avoid floating point issues
  return String(Math.round(res * 100000000) / 100000000);
}


window.exportCSV = (type) => {
  let csvContent = "";
  const cands = Object.values(allCandidates);
  
  if (type === 'overall') {
    csvContent += "Sample No,Member Name,Total Cards\n";
    cands.forEach(c => {
      csvContent += `"${c.sampleNo || ''}","${c.name}",${c.cards.length}\n`;
    });
  } else if (type === 'month') {
    const ym = dashboardMonthFilter.value;
    csvContent += `Month: ${ym}\n`;
    csvContent += "Sample No,Member Name,Paid Cards,Due Cards,Total Paid,Total Due\n";
    cands.forEach(c => {
      const monthCards = c.cards.filter(card => {
        if (!ym || !card.dateAdded) return true;
        return card.dateAdded.startsWith(ym);
      });
      if (monthCards.length > 0) {
        let paidCards = [];
        let dueCards = [];
        let totalPaid = 0;
        let totalDue = 0;

        monthCards.forEach(mc => {
          const type = getCardType(mc.cardNumber) === 'Half-Litre' ? 'H' : 'L';
          const cardStr = `${mc.cardNumber} (${type})`;
          if (mc.paid) {
            paidCards.push(cardStr);
            totalPaid += mc.cost;
          } else {
            dueCards.push(cardStr);
            totalDue += mc.cost;
          }
        });

        csvContent += `"${c.sampleNo || ''}","${c.name}","${paidCards.join(', ')}","${dueCards.join(', ')}",${totalPaid},${totalDue}\n`;
      }
    });
  } else if (type === 'member') {
    const q = exportMemberInput.value.trim().toLowerCase();
    let c = null;
    const selectedId = exportMemberInput.dataset.selectedId;
    
    if (selectedId && allCandidates[selectedId]) {
      const cand = allCandidates[selectedId];
      if (q === cand.name.toLowerCase() || (cand.sampleNo && q === cand.sampleNo.toLowerCase())) {
        c = cand;
      }
    }
    
    if (!c) {
      c = cands.find(cand => cand.name.toLowerCase() === q || (cand.sampleNo && cand.sampleNo.toLowerCase() === q));
    }
    
    if (!c) { alert('Member not found!'); return; }
    let totalPaid = 0;
    let totalDue = 0;
    c.cards.forEach(card => {
      if (card.paid) totalPaid += card.cost;
      else totalDue += card.cost;
    });
    csvContent += `Member Name: ${c.name}, Sample No: ${c.sampleNo || 'N/A'}\n`;
    csvContent += `Total Paid: Rs. ${totalPaid}, Total Due: Rs. ${totalDue}\n`;
    csvContent += "Card No,Type,Added Date,Cost,Status\n";
    c.cards.forEach(card => {
      const type = getCardType(card.cardNumber) === 'Half-Litre' ? 'H' : 'L';
      csvContent += `"${card.cardNumber}","${type}","${new Date(card.dateAdded).toLocaleDateString('en-IN')}",${card.cost},"${card.paid ? 'Paid' : 'Due'}"\n`;
    });
  } else if (type === 'year') {
    const y = document.getElementById('export-year-input').value.trim();
    if (!y) { alert("Please enter a year to export."); return; }
    csvContent += `Year: ${y}\n`;
    csvContent += "Sample No,Member Name,Total Cards (Year),Due Cards (L/H),Total Paid (Year),Total Due (Year)\n";
    cands.forEach(c => {
      const yearCards = c.cards.filter(card => card.dateAdded && card.dateAdded.startsWith(y));
      if (yearCards.length > 0) {
        let yPaid = 0, yDue = 0;
        let dueL = 0, dueH = 0;
        yearCards.forEach(mc => {
          if (mc.paid) {
            yPaid += mc.cost;
          } else {
            yDue += mc.cost;
            if (getCardType(mc.cardNumber) === 'Litre') dueL++;
            else dueH++;
          }
        });
        const dueCardsStr = `${dueL} (L), ${dueH} (H)`;
        csvContent += `"${c.sampleNo || ''}","${c.name}",${yearCards.length},"${dueCardsStr}",${yPaid},${yDue}\n`;
      }
    });
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", `export_${type}_${Date.now()}.csv`);
  a.click();
};

window.exportPDF = (type) => {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF generator is still loading, please try again in a moment.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  const cands = Object.values(allCandidates);
  
  if (type === 'overall') {
    doc.text("Overall Members Report", 14, 15);
    const bodyData = cands.map(c => [c.sampleNo || '-', c.name, c.cards.length]);
    doc.autoTable({ startY: 20, head: [['Sample No', 'Member Name', 'Total Cards']], body: bodyData });
  } else if (type === 'month') {
    const ym = dashboardMonthFilter.value;
    doc.text(`Monthly Purchases Report: ${ym}`, 14, 15);
    const bodyData = [];
    cands.forEach(c => {
      const monthCards = c.cards.filter(card => {
        if (!ym || !card.dateAdded) return true;
        return card.dateAdded.startsWith(ym);
      });
      if (monthCards.length > 0) {
        let paidCards = [];
        let dueCards = [];
        let totalPaid = 0;
        let totalDue = 0;

        monthCards.forEach(mc => {
          const type = getCardType(mc.cardNumber) === 'Half-Litre' ? 'H' : 'L';
          const cardStr = `${mc.cardNumber} (${type})`;
          if (mc.paid) {
            paidCards.push(cardStr);
            totalPaid += mc.cost;
          } else {
            dueCards.push(cardStr);
            totalDue += mc.cost;
          }
        });

        bodyData.push([
          c.sampleNo || '-', 
          c.name, 
          paidCards.join(', ') || '-', 
          dueCards.join(', ') || '-', 
          `Rs. ${totalPaid}`,
          `Rs. ${totalDue}`
        ]);
      }
    });
    doc.autoTable({ 
      startY: 20, 
      head: [['Sample No', 'Member Name', 'Paid Cards', 'Due Cards', 'Total Paid', 'Total Due']], 
      body: bodyData,
      didParseCell: function(data) {
        if (data.section === 'body') {
          if (data.column.index === 2) { // Paid Cards
            data.cell.styles.textColor = [0, 128, 0]; // Green
          } else if (data.column.index === 3) { // Due Cards
            data.cell.styles.textColor = [255, 0, 0]; // Red
          } else if (data.column.index === 4) { // Total Paid
            data.cell.styles.textColor = [0, 128, 0]; // Green
          } else if (data.column.index === 5) { // Total Due
            data.cell.styles.textColor = [255, 0, 0]; // Red
          }
        }
      }
    });
  } else if (type === 'member') {
    const q = exportMemberInput.value.trim().toLowerCase();
    let c = null;
    const selectedId = exportMemberInput.dataset.selectedId;
    
    if (selectedId && allCandidates[selectedId]) {
      const cand = allCandidates[selectedId];
      if (q === cand.name.toLowerCase() || (cand.sampleNo && q === cand.sampleNo.toLowerCase())) {
        c = cand;
      }
    }
    
    if (!c) {
      c = cands.find(cand => cand.name.toLowerCase() === q || (cand.sampleNo && cand.sampleNo.toLowerCase() === q));
    }
    
    if (!c) { alert('Member not found!'); return; }
    let totalPaid = 0;
    let totalDue = 0;
    c.cards.forEach(card => {
      if (card.paid) totalPaid += card.cost;
      else totalDue += card.cost;
    });

    doc.text(`Member Report: ${c.name} (Sample: ${c.sampleNo || '-'})`, 14, 15);
    doc.text(`Total Paid: Rs. ${totalPaid}   |   Total Due: Rs. ${totalDue}`, 14, 23);
    const bodyData = c.cards.map(card => {
      const type = getCardType(card.cardNumber) === 'Half-Litre' ? 'H' : 'L';
      return [
        card.cardNumber, 
        type,
        new Date(card.dateAdded).toLocaleDateString('en-IN'), 
        `Rs. ${card.cost}`, 
        card.paid ? 'Paid' : 'Due'
      ];
    });
    doc.autoTable({ 
      startY: 28, 
      head: [['Card No', 'Type', 'Added Date', 'Cost', 'Status']], 
      body: bodyData,
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 4) { // Status column
          if (data.cell.raw === 'Paid') {
            data.cell.styles.textColor = [0, 128, 0]; // Green
          } else if (data.cell.raw === 'Due') {
            data.cell.styles.textColor = [255, 0, 0]; // Red
          }
        }
      }
    });
  } else if (type === 'year') {
    const y = document.getElementById('export-year-input').value.trim();
    if (!y) { alert("Please enter a year to export."); return; }
    doc.text(`Yearly Purchases Report: ${y}`, 14, 15);
    const bodyData = [];
    cands.forEach(c => {
      const yearCards = c.cards.filter(card => card.dateAdded && card.dateAdded.startsWith(y));
      if (yearCards.length > 0) {
        let yPaid = 0, yDue = 0;
        let dueL = 0, dueH = 0;
        yearCards.forEach(mc => {
          if (mc.paid) {
            yPaid += mc.cost;
          } else {
            yDue += mc.cost;
            if (getCardType(mc.cardNumber) === 'Litre') dueL++;
            else dueH++;
          }
        });
        const dueCardsStr = `${dueL} (L), ${dueH} (H)`;
        bodyData.push([
          c.sampleNo || '-', 
          c.name, 
          yearCards.length.toString(), 
          dueCardsStr,
          `Rs. ${yPaid}`,
          `Rs. ${yDue}`
        ]);
      }
    });
    doc.autoTable({ 
      startY: 20, 
      head: [['Sample No', 'Member Name', 'Total Cards (Year)', 'Due Cards (L/H)', 'Total Paid', 'Total Due']], 
      body: bodyData,
      didParseCell: function(data) {
        if (data.section === 'body') {
          if (data.column.index === 4) { // Total Paid
            data.cell.styles.textColor = [0, 128, 0]; // Green
          } else if (data.column.index === 5) { // Total Due
            data.cell.styles.textColor = [255, 0, 0]; // Red
          }
        }
      }
    });
  }

  doc.save(`export_${type}_${Date.now()}.pdf`);
};

// Backup Logic
window.exportBackup = async () => {
  try {
    const success = await window.electronAPI.exportBackup();
    if (success) {
      alert("Database backed up successfully!");
      document.getElementById('backup-modal').classList.remove('active');
    }
  } catch (err) {
    console.error("Backup failed", err);
    alert("Backup failed or was cancelled.");
  }
};

window.restoreBackup = async () => {
  document.getElementById('confirm-restore-modal').classList.add('active');
};

document.getElementById('proceed-restore-btn').addEventListener('click', async () => {
  document.getElementById('confirm-restore-modal').classList.remove('active');
  try {
    const success = await window.electronAPI.restoreBackup();
    if (!success) {
      alert("Restore was cancelled or failed.");
    }
  } catch (err) {
    console.error("Restore failed", err);
    alert("Restore failed.");
  }
});

// Login Logic
const attemptLogin = () => {
  const user = document.getElementById('login-username').value.trim();
  const pass = document.getElementById('login-password').value.trim();
  if (user === 'PRESIDENT' && pass === 'P') {
    document.getElementById('login-overlay').style.display = 'none';
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
};

document.getElementById('login-btn').addEventListener('click', attemptLogin);
document.getElementById('login-password').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') attemptLogin();
});
document.getElementById('login-username').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('login-password').focus();
});

window.logout = () => {
  document.getElementById('logout-modal').classList.add('active');
};

document.getElementById('confirm-logout-btn').addEventListener('click', () => {
  document.getElementById('logout-modal').classList.remove('active');
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  
  // Force focus to bypass Electron's confirm dialog focus trap
  setTimeout(() => {
    document.getElementById('login-username').focus();
  }, 100);
});

const confirmDbCleanBtn = document.getElementById('confirm-db-clean-btn');
if (confirmDbCleanBtn) {
  confirmDbCleanBtn.addEventListener('click', () => {
    const pass = document.getElementById('db-clean-passcode').value;
    const errEl = document.getElementById('db-clean-error');
    if (pass === 'P@9398375721') {
      errEl.style.display = 'none';
      document.getElementById('db-clean-modal').classList.remove('active');
      document.getElementById('confirm-db-clean-final-modal').classList.add('active');
    } else {
      errEl.style.display = 'block';
    }
  });
}

document.getElementById('proceed-db-clean-btn').addEventListener('click', async () => {
  document.getElementById('confirm-db-clean-final-modal').classList.remove('active');
  await window.electronAPI.clearDatabase();
});

// Backup DB Authentication
window.openBackupAuthModal = () => {
  const passInput = document.getElementById('backup-passcode');
  const errEl = document.getElementById('backup-passcode-error');
  if (passInput) passInput.value = '';
  if (errEl) errEl.style.display = 'none';
  document.getElementById('backup-auth-modal').classList.add('active');
  setTimeout(() => {
    if (passInput) passInput.focus();
  }, 100);
};

window.closeBackupAuthModal = () => {
  document.getElementById('backup-auth-modal').classList.remove('active');
};

const attemptBackupAuth = () => {
  const pass = document.getElementById('backup-passcode').value;
  const errEl = document.getElementById('backup-passcode-error');
  if (pass === 'P@9398375721') {
    if (errEl) errEl.style.display = 'none';
    window.closeBackupAuthModal();
    document.getElementById('backup-modal').classList.add('active');
  } else {
    if (errEl) errEl.style.display = 'block';
  }
};

const confirmBackupAuthBtn = document.getElementById('confirm-backup-auth-btn');
if (confirmBackupAuthBtn) {
  confirmBackupAuthBtn.addEventListener('click', attemptBackupAuth);
}

const backupPasscodeInput = document.getElementById('backup-passcode');
if (backupPasscodeInput) {
  backupPasscodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') attemptBackupAuth();
  });
}

const dbCleanPasscodeInput = document.getElementById('db-clean-passcode');
if (dbCleanPasscodeInput) {
  dbCleanPasscodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && confirmDbCleanBtn) confirmDbCleanBtn.click();
  });
}

// ==========================================
// BULK UPLOAD MEMBERS MODULE
// ==========================================
let bulkUploadedData = [];
let bulkCurrentFilter = 'all'; // 'all' | 'errors' | 'valid'

function escapeBulkHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 1. Download Ready-to-Use Template
window.downloadBulkTemplate = (type = 'xlsx') => {
  const headers = ['Candidate Name', 'Mobile Number', 'Sample No'];
  const sampleRows = [
    ['Ramesh Kumar', '9876543210', '101'],
    ['Suresh Reddy', '9123456780', '102'],
    ['Mahesh Babu', '9988776655', '103']
  ];

  if (type === 'xlsx' && typeof XLSX !== 'undefined') {
    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members Template');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Sangam_Dairy_Members_Template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } else {
    // CSV format
    let csvContent = 'Candidate Name,Mobile Number,Sample No\n';
    sampleRows.forEach(row => {
      csvContent += `"${row[0]}","${row[1]}","${row[2]}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Sangam_Dairy_Members_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
};

// 2. Parse Uploaded File
function parseUploadedFile(file) {
  if (!file) return;
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
    customAlert('Please select a valid Excel (.xlsx, .xls) or CSV (.csv) file.', 'danger', 'Invalid File Type');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      if (typeof XLSX === 'undefined') {
        customAlert('Spreadsheet parser (XLSX) is not ready. Please restart the app.', 'danger', 'Parser Error');
        return;
      }

      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        customAlert('The selected spreadsheet contains no sheets.', 'danger', 'Empty File');
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!rawRows || rawRows.length === 0) {
        customAlert('The uploaded spreadsheet is empty.', 'danger', 'Empty File');
        return;
      }

      // Find header row (first non-empty row)
      let headerRowIndex = -1;
      for (let r = 0; r < rawRows.length; r++) {
        if (rawRows[r].some(cell => String(cell).trim() !== '')) {
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1) {
        customAlert('No data found in the selected file.', 'danger', 'Empty File');
        return;
      }

      const headers = rawRows[headerRowIndex].map(h => String(h || '').trim().toLowerCase());

      // Flexible column detection
      let nameColIdx = headers.findIndex(h => /^(candidate|member)?\s*name$/i.test(h) || h === 'name' || h === 'member' || h === 'candidate');
      let mobileColIdx = headers.findIndex(h => /^(mobile|phone|contact|cell)(\s*(no|num|number))?$/i.test(h));
      let sampleColIdx = headers.findIndex(h => /^(sample)(\s*(no|num|number|id))?$/i.test(h) || h === 'sample#');

      // Sensible defaults if headers weren't matched exactly
      if (nameColIdx === -1 && headers.length > 0) nameColIdx = 0;
      if (mobileColIdx === -1 && headers.length > 1) mobileColIdx = 1;
      if (sampleColIdx === -1 && headers.length > 2) sampleColIdx = 2;

      const parsedData = [];
      let rowNum = 1;
      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.every(c => String(c).trim() === '')) {
          continue; // Skip blank rows
        }

        const name = nameColIdx !== -1 && row[nameColIdx] !== undefined ? String(row[nameColIdx]).trim() : '';
        const mobileNo = mobileColIdx !== -1 && row[mobileColIdx] !== undefined ? String(row[mobileColIdx]).trim() : '';
        const sampleNo = sampleColIdx !== -1 && row[sampleColIdx] !== undefined ? String(row[sampleColIdx]).trim() : '';

        // Skip row if completely empty
        if (!name && !mobileNo && !sampleNo) continue;

        parsedData.push({
          id: generateId() + '_' + rowNum,
          index: rowNum++,
          name: name,
          mobileNo: mobileNo,
          sampleNo: sampleNo,
          errors: [],
          nameError: false,
          sampleError: false,
          isValid: true
        });
      }

      if (parsedData.length === 0) {
        customAlert('No data records found below the header row.', 'warning', 'No Records Found');
        return;
      }

      bulkUploadedData = parsedData;

      // Update file info badge
      const fileInfo = document.getElementById('bulk-selected-file-info');
      const filenameEl = document.getElementById('bulk-selected-filename');
      if (fileInfo) fileInfo.style.display = 'block';
      if (filenameEl) filenameEl.innerText = `${file.name} (${parsedData.length} records)`;

      // Make sure candidate cache is fresh from DB
      allCandidates = await window.electronAPI.getCandidates();

      validateBulkData();
      bulkCurrentFilter = 'all';
      updateFilterButtons();
      renderBulkPreview();

      const previewSection = document.getElementById('bulk-preview-section');
      if (previewSection) {
        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Error parsing bulk upload file:', err);
      customAlert(`Failed to parse file: ${err.message || 'Invalid format'}`, 'danger', 'Parse Error');
    }
  };

  reader.readAsArrayBuffer(file);
}

// 3. Validation Logic
function validateBulkData() {
  const existingCandidatesList = Object.values(allCandidates || {});

  // Maps to check intra-file duplicates
  const sampleMap = new Map(); // sampleNo (lowercase) -> array of row indices
  const nameMap = new Map();   // name (lowercase) -> array of row indices

  bulkUploadedData.forEach((row, i) => {
    if (row.sampleNo) {
      const sLower = row.sampleNo.trim().toLowerCase();
      if (!sampleMap.has(sLower)) sampleMap.set(sLower, []);
      sampleMap.get(sLower).push(i + 1);
    }
    if (row.name) {
      const nLower = row.name.trim().toLowerCase();
      if (!nameMap.has(nLower)) nameMap.set(nLower, []);
      nameMap.get(nLower).push(i + 1);
    }
  });

  bulkUploadedData.forEach((row, i) => {
    const errors = [];
    let nameError = false;
    let sampleError = false;

    const trimmedName = (row.name || '').trim();
    const trimmedSample = (row.sampleNo || '').trim();
    const sLower = trimmedSample.toLowerCase();
    const nLower = trimmedName.toLowerCase();

    // 1. Mandatory Name
    if (!trimmedName) {
      errors.push('Candidate Name is required.');
      nameError = true;
    }

    // 2. Intra-file duplicate sample number
    if (trimmedSample && sampleMap.has(sLower) && sampleMap.get(sLower).length > 1) {
      const otherRows = sampleMap.get(sLower).filter(idx => idx !== (i + 1));
      errors.push(`Duplicate Sample No in file (also on Row ${otherRows.join(', ')}).`);
      sampleError = true;
    }

    // 3. Database duplicate sample number
    if (trimmedSample) {
      const existingWithSample = existingCandidatesList.find(
        c => c.sampleNo && c.sampleNo.trim().toLowerCase() === sLower
      );
      if (existingWithSample) {
        errors.push(`Sample No "${trimmedSample}" already assigned to "${existingWithSample.name}".`);
        sampleError = true;
      }
    }

    // 4. Duplicate name checks
    if (trimmedName) {
      // 4a. Duplicate name with existing DB candidate: requires unique sampleNo!
      const existingWithName = existingCandidatesList.find(
        c => c.name && c.name.trim().toLowerCase() === nLower
      );
      if (existingWithName && !trimmedSample) {
        errors.push(`Member "${trimmedName}" exists in database. A unique Sample No is mandatory.`);
        sampleError = true;
      }

      // 4b. Intra-file duplicate name: both must have unique sampleNo
      if (nameMap.has(nLower) && nameMap.get(nLower).length > 1) {
        if (!trimmedSample) {
          const otherRows = nameMap.get(nLower).filter(idx => idx !== (i + 1));
          errors.push(`Multiple rows in file have name "${trimmedName}" (Row ${otherRows.join(', ')}). A unique Sample No is mandatory.`);
          sampleError = true;
        }
      }
    }

    row.errors = errors;
    row.nameError = nameError;
    row.sampleError = sampleError;
    row.isValid = errors.length === 0;
  });

  // Update summary badges
  const total = bulkUploadedData.length;
  const valid = bulkUploadedData.filter(r => r.isValid).length;
  const issues = total - valid;

  const badgeTotal = document.getElementById('bulk-badge-total');
  const badgeValid = document.getElementById('bulk-badge-valid');
  const badgeErrors = document.getElementById('bulk-badge-errors');
  const hintEl = document.getElementById('bulk-submit-hint');
  const submitBtn = document.getElementById('bulk-submit-btn');

  if (badgeTotal) badgeTotal.innerText = `Total: ${total}`;
  if (badgeValid) badgeValid.innerText = `✅ Valid: ${valid}`;
  if (badgeErrors) badgeErrors.innerText = `⚠️ Issues: ${issues}`;

  if (hintEl) {
    if (issues > 0) {
      hintEl.style.display = 'inline-block';
      hintEl.innerText = `⚠️ Please fix or remove the ${issues} issue(s) before submitting.`;
    } else {
      hintEl.style.display = 'none';
    }
  }

  if (submitBtn) {
    if (issues > 0) {
      submitBtn.style.opacity = '0.65';
      submitBtn.style.cursor = 'not-allowed';
    } else {
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  }
}

// 4. Render Table Rows
function renderBulkPreview() {
  const tbody = document.getElementById('bulk-preview-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const rowsToDisplay = bulkUploadedData.filter(row => {
    if (bulkCurrentFilter === 'errors') return !row.isValid;
    if (bulkCurrentFilter === 'valid') return row.isValid;
    return true; // 'all'
  });

  if (rowsToDisplay.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="padding: 2.5rem; text-align: center; color: var(--text-secondary); font-size: 0.95rem;">
      ${bulkCurrentFilter === 'errors' ? '🎉 Great news! No issues found. All members are valid and ready to import.' : 'No rows match the selected filter.'}
    </td>`;
    tbody.appendChild(tr);
    return;
  }

  rowsToDisplay.forEach((row) => {
    const tr = document.createElement('tr');
    tr.id = `bulk-row-${row.id}`;
    tr.className = row.isValid ? 'bulk-row-valid' : 'bulk-row-error';
    tr.style.borderBottom = '1px solid var(--card-border)';

    tr.innerHTML = `
      <td style="padding: 0.6rem 0.75rem; font-weight: 700; color: var(--text-secondary);">${row.index}</td>
      <td style="padding: 0.6rem 0.75rem;">
        <input type="text" class="bulk-table-input ${row.nameError ? 'input-error' : ''}" 
               value="${escapeBulkHtml(row.name)}" 
               placeholder="Candidate Name *" 
               oninput="window.updateBulkCell('${row.id}', 'name', this.value)" />
      </td>
      <td style="padding: 0.6rem 0.75rem;">
        <input type="text" class="bulk-table-input" 
               value="${escapeBulkHtml(row.mobileNo)}" 
               placeholder="Mobile Number" 
               oninput="window.updateBulkCell('${row.id}', 'mobileNo', this.value)" />
      </td>
      <td style="padding: 0.6rem 0.75rem;">
        <input type="text" class="bulk-table-input ${row.sampleError ? 'input-error' : ''}" 
               value="${escapeBulkHtml(row.sampleNo)}" 
               placeholder="Sample No (Optional)" 
               oninput="window.updateBulkCell('${row.id}', 'sampleNo', this.value)" />
      </td>
      <td style="padding: 0.6rem 0.75rem;">
        ${row.isValid 
          ? '<span style="display: inline-flex; align-items: center; gap: 0.3rem; color: #15803d; font-weight: 700; background: #dcfce7; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.82rem;">✅ Ready</span>' 
          : `<span style="display: block; color: #b91c1c; font-weight: 600; background: #fee2e2; padding: 0.35rem 0.6rem; border-radius: 6px; font-size: 0.8rem; line-height: 1.35;">⚠️ ${row.errors.join('<br/>⚠️ ')}</span>`
        }
      </td>
      <td style="padding: 0.6rem 0.75rem; text-align: center;">
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; color: var(--danger); border-color: #fca5a5; cursor: pointer; font-size: 0.85rem;" 
                title="Remove Row" 
                onclick="window.removeBulkRow('${row.id}')">🗑️</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// 5. In-Place Cell Update (Keeps Focus Smoothly)
window.updateBulkCell = (id, field, value) => {
  const row = bulkUploadedData.find(r => r.id === id);
  if (!row) return;
  row[field] = value;
  validateBulkData();

  // Update UI for the edited row
  const rowEl = document.getElementById(`bulk-row-${id}`);
  if (rowEl) {
    rowEl.className = row.isValid ? 'bulk-row-valid' : 'bulk-row-error';
    const statusCell = rowEl.cells[4];
    if (statusCell) {
      statusCell.innerHTML = row.isValid 
        ? '<span style="display: inline-flex; align-items: center; gap: 0.3rem; color: #15803d; font-weight: 700; background: #dcfce7; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.82rem;">✅ Ready</span>' 
        : `<span style="display: block; color: #b91c1c; font-weight: 600; background: #fee2e2; padding: 0.35rem 0.6rem; border-radius: 6px; font-size: 0.8rem; line-height: 1.35;">⚠️ ${row.errors.join('<br/>⚠️ ')}</span>`;
    }
    const nameInp = rowEl.cells[1].querySelector('input');
    if (nameInp) {
      if (row.nameError) nameInp.classList.add('input-error');
      else nameInp.classList.remove('input-error');
    }
    const sampleInp = rowEl.cells[3].querySelector('input');
    if (sampleInp) {
      if (row.sampleError) sampleInp.classList.add('input-error');
      else sampleInp.classList.remove('input-error');
    }
  }

  // Update other rows whose duplicate state might have been impacted
  bulkUploadedData.forEach(r => {
    if (r.id !== id) {
      const otherRowEl = document.getElementById(`bulk-row-${r.id}`);
      if (otherRowEl) {
        otherRowEl.className = r.isValid ? 'bulk-row-valid' : 'bulk-row-error';
        const otherStatusCell = otherRowEl.cells[4];
        if (otherStatusCell) {
          otherStatusCell.innerHTML = r.isValid 
            ? '<span style="display: inline-flex; align-items: center; gap: 0.3rem; color: #15803d; font-weight: 700; background: #dcfce7; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.82rem;">✅ Ready</span>' 
            : `<span style="display: block; color: #b91c1c; font-weight: 600; background: #fee2e2; padding: 0.35rem 0.6rem; border-radius: 6px; font-size: 0.8rem; line-height: 1.35;">⚠️ ${r.errors.join('<br/>⚠️ ')}</span>`;
        }
        const oNameInp = otherRowEl.cells[1].querySelector('input');
        if (oNameInp) {
          if (r.nameError) oNameInp.classList.add('input-error');
          else oNameInp.classList.remove('input-error');
        }
        const oSampleInp = otherRowEl.cells[3].querySelector('input');
        if (oSampleInp) {
          if (r.sampleError) oSampleInp.classList.add('input-error');
          else oSampleInp.classList.remove('input-error');
        }
      }
    }
  });
};

// 6. Remove Row
window.removeBulkRow = (id) => {
  bulkUploadedData = bulkUploadedData.filter(r => r.id !== id);
  if (bulkUploadedData.length === 0) {
    window.resetBulkUpload();
    return;
  }
  bulkUploadedData.forEach((r, idx) => { r.index = idx + 1; });
  const filenameEl = document.getElementById('bulk-selected-filename');
  if (filenameEl) {
    const origText = filenameEl.innerText.split('(')[0].trim();
    filenameEl.innerText = `${origText} (${bulkUploadedData.length} records)`;
  }
  validateBulkData();
  renderBulkPreview();
};

// 7. Filtering Preview Tabs
window.filterBulkPreview = (filterType) => {
  bulkCurrentFilter = filterType;
  updateFilterButtons();
  renderBulkPreview();
};

function updateFilterButtons() {
  const btnAll = document.getElementById('bulk-filter-all');
  const btnErrors = document.getElementById('bulk-filter-errors');
  const btnValid = document.getElementById('bulk-filter-valid');
  if (btnAll) btnAll.classList.toggle('active', bulkCurrentFilter === 'all');
  if (btnErrors) btnErrors.classList.toggle('active', bulkCurrentFilter === 'errors');
  if (btnValid) btnValid.classList.toggle('active', bulkCurrentFilter === 'valid');
}

// 8. Reset Bulk Upload
window.resetBulkUpload = () => {
  bulkUploadedData = [];
  bulkCurrentFilter = 'all';
  const fileInput = document.getElementById('bulk-upload-file-input');
  if (fileInput) fileInput.value = '';
  const fileInfo = document.getElementById('bulk-selected-file-info');
  if (fileInfo) fileInfo.style.display = 'none';
  const filenameEl = document.getElementById('bulk-selected-filename');
  if (filenameEl) filenameEl.innerText = 'None';
  const previewSection = document.getElementById('bulk-preview-section');
  if (previewSection) previewSection.style.display = 'none';
  const hintEl = document.getElementById('bulk-submit-hint');
  if (hintEl) hintEl.style.display = 'none';
  updateFilterButtons();
  const tbody = document.getElementById('bulk-preview-tbody');
  if (tbody) tbody.innerHTML = '';
};

// 9. Submit & Import Members
window.submitBulkMembers = async () => {
  if (!bulkUploadedData || bulkUploadedData.length === 0) {
    customAlert('Please select and upload an Excel or CSV file first.', 'warning', 'No Data');
    return;
  }

  // Refresh candidate cache from DB to ensure freshest duplicate check
  allCandidates = await window.electronAPI.getCandidates();
  validateBulkData();

  const invalidRows = bulkUploadedData.filter(r => !r.isValid);
  if (invalidRows.length > 0) {
    window.filterBulkPreview('errors');
    customAlert(
      `Cannot import members yet!\n\nThere are ${invalidRows.length} row(s) with errors or duplicate entries.\nPlease review and correct them or click 🗑️ to remove invalid rows before submitting.`,
      'danger',
      '⚠️ Issues Detected'
    );
    return;
  }

  const confirmed = await window.customConfirm(
    `Are you sure you want to import ${bulkUploadedData.length} member(s) into the database?`
  );
  if (!confirmed) return;

  const submitBtn = document.getElementById('bulk-submit-btn');
  const origBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Importing Members...';
  }

  try {
    const candidatesToSave = bulkUploadedData.map(row => ({
      id: generateId(),
      name: row.name.trim(),
      mobileNo: row.mobileNo.trim(),
      sampleNo: row.sampleNo.trim(),
      notes: '',
      monthlyNotes: {},
      cards: []
    }));

    if (window.electronAPI.saveCandidates) {
      await window.electronAPI.saveCandidates(candidatesToSave);
    } else {
      for (const c of candidatesToSave) {
        await window.electronAPI.saveCandidate(c);
      }
    }

    // Refresh candidate cache in renderer
    allCandidates = await window.electronAPI.getCandidates();

    customAlert(
      `🎉 Successfully imported ${candidatesToSave.length} member(s) into Sangam Dairy Local Sales!`,
      'success',
      'Bulk Upload Complete'
    );

    window.resetBulkUpload();
    window.switchView('membersList');
  } catch (err) {
    console.error('Failed to import candidates:', err);
    customAlert(`Import failed: ${err.message || 'Unknown database error'}`, 'danger', 'Import Error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnText;
    }
  }
};

// 10. Initialize Dropzone & File Input Event Listeners
function initBulkUploadEvents() {
  const dropzone = document.getElementById('bulk-upload-dropzone');
  const fileInput = document.getElementById('bulk-upload-file-input');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        parseUploadedFile(e.target.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        parseUploadedFile(e.dataTransfer.files[0]);
      }
    });
  }
}

// Start
init();
