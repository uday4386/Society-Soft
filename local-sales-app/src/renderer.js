let currentCandidate = null;
let allCandidates = {};
let globalSettings = { halfLitreCost: 100, litreCost: 200 };

// Custom Alert & Confirm Modals
window.customAlert = (msg) => {
  document.getElementById('custom-alert-message').innerText = msg;
  document.getElementById('custom-alert-modal').classList.add('active');
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
  settings: document.getElementById('settings-view')
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
  
  allCandidates = await window.electronAPI.getCandidates();
  
  // Set current month as default for analytics
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  globalMonthFilter.value = ym;
  syncMonthPickers(ym);
  
  renderDashboard();
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
}
window.switchView = switchView;

window.showNewMemberModal = () => {
  newNameInput.value = '';
  newMobileNoInput.value = '';
  newSampleNoInput.value = '';
  createModal.classList.add('active');
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
      litreMax: lMax
    };
    await window.electronAPI.saveSettings(globalSettings);
    settingsMsg.innerText = "Settings Saved!";
    setTimeout(() => { settingsMsg.innerText = ''; }, 3000);
  } else {
    alert("Please enter valid numbers for all pricing and range fields.");
  }
});

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
        ${c.sampleNo ? `<span style="color: var(--text-secondary); font-size: 0.85rem;">#${c.sampleNo}</span>` : ''}
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
          ${c.sampleNo ? `<span style="color: var(--text-secondary); font-size: 0.85rem;">#${c.sampleNo}</span>` : ''}
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

if (allMembersSearch) {
  allMembersSearch.addEventListener('input', (e) => {
    renderAllMembers(e.target.value);
  });
}

function renderAllMembers(searchQuery = '') {
  allMembersList.innerHTML = '';
  let cands = Object.values(allCandidates);
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    cands = cands.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.sampleNo && c.sampleNo.toLowerCase().includes(q))
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
    allMembersList.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No members found.</p>';
    return;
  }
  
  cands.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card-item';
    div.style.cursor = 'pointer';
    div.innerHTML = `
      <div class="card-info">
        <span class="card-number">${c.name}</span>
        <span class="card-cost">Sample No: ${c.sampleNo || 'N/A'} | Cards: ${c.cards.length}</span>
      </div>
      <button class="btn-primary" onclick="window.loadCandidateById('${c.id}')">View</button>
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

document.getElementById('save-candidate-btn').addEventListener('click', async () => {
  const name = newNameInput.value.trim();
  const mobileNo = newMobileNoInput.value.trim();
  const sampleNo = newSampleNoInput.value.trim();
  
  if (!name) {
    alert("Candidate Name is mandatory.");
    return;
  }

  if (sampleNo) {
    const isDuplicate = Object.values(allCandidates).some(c => c.sampleNo === sampleNo);
    if (isDuplicate) {
      alert("This Sample Number is already assigned to another member. Please use a different one.");
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

  profileName.innerText = candidate.name;
  profileSampleNo.innerText = candidate.sampleNo ? `#${candidate.sampleNo}` : '';
  profileSampleNo.style.display = candidate.sampleNo ? 'inline-block' : 'none';
  profileMobileNo.innerText = candidate.mobileNo ? `📱 ${candidate.mobileNo}` : '';
  profileMobileNo.style.display = candidate.mobileNo ? 'inline-block' : 'none';
  
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
editProfileBtn.addEventListener('click', () => {
  editMemberName.value = currentCandidate.name;
  editMemberMobileNo.value = currentCandidate.mobileNo || '';
  editMemberSampleNo.value = currentCandidate.sampleNo || '';
  editModal.classList.add('active');
});

cancelEditMemberBtn.addEventListener('click', () => {
  editModal.classList.remove('active');
});

saveEditMemberBtn.addEventListener('click', async () => {
  const newName = editMemberName.value.trim();
  const newMobileNo = editMemberMobileNo.value.trim();
  const newSampleNo = editMemberSampleNo.value.trim();
  
  if (!newName) {
    alert("Candidate Name is mandatory.");
    return;
  }
  
  if (newSampleNo) {
    const isDuplicate = Object.values(allCandidates).some(c => c.id !== currentCandidate.id && c.sampleNo === newSampleNo);
    if (isDuplicate) {
      alert("This Sample Number is already assigned to another member. Please use a different one.");
      return;
    }
  }
  
  currentCandidate.name = newName;
  currentCandidate.mobileNo = newMobileNo;
  currentCandidate.sampleNo = newSampleNo;
  
  await window.electronAPI.saveCandidate(currentCandidate);
  
  profileName.innerText = currentCandidate.name;
  profileSampleNo.innerText = currentCandidate.sampleNo ? `#${currentCandidate.sampleNo}` : '';
  profileSampleNo.style.display = currentCandidate.sampleNo ? 'inline-block' : 'none';
  profileMobileNo.innerText = currentCandidate.mobileNo ? `📱 ${currentCandidate.mobileNo}` : '';
  profileMobileNo.style.display = currentCandidate.mobileNo ? 'inline-block' : 'none';
  
  editModal.classList.remove('active');
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
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${c.sampleNo ? `Sample: #${c.sampleNo}` : 'N/A'}</span>
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

// Start
init();
