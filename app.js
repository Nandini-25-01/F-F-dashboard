// ==========================================================================
// CORE STATE MANAGEMENT
// ==========================================================================
const state = {
    ffData: [],
    attritionData: [],
    activeTab: 'ff', // 'ff' or 'attrition'
    filters: {
        employeeTypes: ['Onroll', 'Consultant', 'Intern'],
        hrbpLead: 'All',
        plName: 'All',
        month: 'All',
        gender: 'All',
        year: 'All',
        momMonth: 'All',
        momYear: 'All'
    },
    search: {
        ff: '',
        attrition: '',
        mom: '',
        recovery: ''
    },
    sort: {
        ff: { column: 'lastWorkingDay', order: 'desc' },
        attrition: { column: 'exitDate', order: 'desc' },
        mom: { column: 'count', order: 'desc' },
        recovery: { column: 'totalRecovered', order: 'desc' }
    },
    pagination: {
        ff: { page: 1, size: 50 },
        attrition: { page: 1, size: 50 },
        mom: { page: 1, size: 10 },
        recovery: { page: 1, size: 100 }
    },
    activeHeadcount: {},
    activeSubTab: 'Voluntary' // 'Voluntary' or 'Involuntary'
};

// Global chart references for resetting on reload
const charts = {
    ffStatus: null,
    ffBuckets: null,
    ffNdcClearance: null,
    ffPaymentType: null,
    ffPayoutPl: null,
    ffRecoveryDept: null,
    attritionPl: null,
    attritionType: null,
    attritionVoluntary: null,
    attritionTenure: null
};

// Seed names for deterministic de-anonymization
const firstNames = [
    'Amit', 'Rohan', 'Priya', 'Siddharth', 'Aditya', 'Neha', 'Karan', 'Deepika', 'Rahul', 'Sneha',
    'Vikram', 'Ananya', 'Varun', 'Kriti', 'Arjun', 'Meera', 'Pooja', 'Sanjay', 'Sunita', 'Rajesh',
    'Anil', 'Geeta', 'Vijay', 'Kiran', 'Suresh', 'Anita', 'Ramesh', 'Harish', 'Manish', 'Preeti',
    'Abhishek', 'Aarav', 'Ishaan', 'Kabir', 'Aanya', 'Diya', 'Riya', 'Vihaan', 'Sai', 'Pranav',
    'Dev', 'Tara', 'Maya', 'Nisha', 'Aman', 'Aravind', 'Divya', 'Gaurav', 'Jyoti', 'Kartik'
];
const lastNames = [
    'Sharma', 'Verma', 'Gupta', 'Singh', 'Patel', 'Kumar', 'Joshi', 'Mehta', 'Reddy', 'Nair',
    'Malhotra', 'Sen', 'Dhawan', 'Sanon', 'Rampal', 'Hegde', 'Sharma', 'Das', 'Roy', 'Choudhury',
    'Bose', 'Johar', 'Zinta', 'Kapoor', 'Mishra', 'Trivedi', 'Yadav', 'Rao', 'Dubey', 'Saxena',
    'Pandey', 'Deshmukh', 'Kulkarni', 'Bhat', 'Shetty', 'Pillai', 'Menon', 'Nair', 'Iyer', 'Srinivasan',
    'Subramanian', 'Mukherjee', 'Banerjee', 'Chatterjee', 'Dutta', 'Sinha', 'Prasad', 'Guha', 'Ganguly'
];

function getHashValue(str, maxVal) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % maxVal;
}

function generateName(empId) {
    const fIdx = getHashValue(empId, firstNames.length);
    const lIdx = getHashValue(empId + "_last", lastNames.length);
    return `${firstNames[fIdx]} ${lastNames[lIdx]}`;
}

function generateGender(empId) {
    const gVal = getHashValue(empId + "_gender", 100);
    return gVal < 40 ? "Female" : "Male";
}

// Clean P&L Name mapping to merge duplicate casings
const plMap = {
    'PRODUCT & TECHNOLOGY': 'Product & Technology',
    'Product & Technology': 'Product & Technology',
    'CATEGORY MANAGEMENT': 'Category Management',
    'Category Management': 'Category Management',
    'CUSTOMER EXPERIENCE': 'Customer Experience',
    'Customer Experience': 'Customer Experience',
    'PROJECT MANAGEMENT AND ADMINISTRATIVE OPERATIONS': 'Project Management & Admin',
    'Project Management and Administrative Operations': 'Project Management & Admin',
    'B&M RETAIL': 'B&M Retail',
    'B&M Retail': 'B&M Retail',
    'HOSPITALS': 'Hospitals',
    'Hospitals': 'Hospitals',
    'HEALTHCARE SERVICES & CORPORATE DELIVERY': 'Healthcare Services & Corp',
    'Healthcare Services & Corporate Delivery': 'Healthcare Services & Corp',
    'PHARMACY SUPPLY CHAIN': 'Pharmacy Supply Chain',
    'Pharmacy Supply Chain': 'Pharmacy Supply Chain',
    'PLANNING & PURCHASE': 'Planning & Purchase',
    'Planning & Purchase': 'Planning & Purchase',
    'DIAGNOSTIC SUPPLY CHAIN': 'Diagnostic Supply Chain',
    'Diagnostic Supply Chain': 'Diagnostic Supply Chain',
    'EPHARMACY': 'ePharmacy',
    'ePharmacy': 'ePharmacy',
    'CORPORATE, HEALTH & WELLNESS': 'Corporate Health & Wellness',
    'Corporate, Health & Wellness': 'Corporate Health & Wellness',
    "FOUNDER'S OFFICE": "Founder's Office",
    "Founder's Office": "Founder's Office",
    'HUMAN RESOURCES': 'Human Resources',
    'Human Resources': 'Human Resources',
    'MEDICAL AFFAIRS': 'Medical Affairs',
    'Medical Affairs': 'Medical Affairs',
    'SPECIALITY PHARMA BUSINESS (PSP)': 'Speciality Pharma (PSP)',
    'Speciality Pharma Business (PSP)': 'Speciality Pharma (PSP)',
    'BUSINESS INTELLIGENCE': 'Business Intelligence',
    'Business Intelligence': 'Business Intelligence',
    'FINANCE': 'Finance',
    'Finance': 'Finance',
    'LEGAL': 'Legal',
    'Legal': 'Legal',
    'EDIAGNOSTICS': 'eDiagnostics',
    'eDiagnostics': 'eDiagnostics',
    'ADMIN & IT': 'Admin & IT',
    'Admin & IT': 'Admin & IT',
    'MARKETING': 'Marketing',
    'Marketing': 'Marketing',
    'INSTITUTIONAL QUALITY': 'Institutional Quality',
    'Institutional Quality': 'Institutional Quality',
    'DATAVERSE': 'Dataverse',
    'Dataverse': 'Dataverse',
    'CLINICAL EXCELLENCE': 'Clinical Excellence',
    'Clinical Excellence': 'Clinical Excellence',
    'PHARMACY SUPPLY CHAIN (OLD)': 'Pharmacy Supply Chain (Old)',
    'Pharmacy Supply Chain (Old)': 'Pharmacy Supply Chain (Old)',
    'nan': 'Unassigned'
};

// ==========================================================================
// LIFE CYCLE & INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadData();
});

// Load data from localStorage or fetch Excel
async function loadData() {
    const localFF = localStorage.getItem('dash_ff_data');
    const localAttr = localStorage.getItem('dash_attrition_data');
    const localHeadcount = localStorage.getItem('dash_active_headcount');
    const localStatus = localStorage.getItem('dash_sync_status');

    if (localFF && localAttr && localHeadcount) {
        state.ffData = JSON.parse(localFF);
        state.attritionData = JSON.parse(localAttr);
        state.activeHeadcount = JSON.parse(localHeadcount);
        updateSyncStatus(localStatus || 'Loaded from local storage');
        populateDropdownFilters();
        updateUI();
        removeStartupOverlay();
    } else {
        await fetchExcelData();
    }
}

// Fetch Excel Spreadsheet directly
async function fetchExcelData() {
    updateSyncStatus('Fetching spreadsheet...');
    try {
        const response = await fetch('Sample data for dashborad.xlsx');
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.statusText} (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        processExcelBuffer(arrayBuffer, 'Sample data for dashborad.xlsx');
    } catch (err) {
        console.error('Error fetching Excel file on startup:', err);
        showStartupOverlay(err.message);
    }
}

// Parse excel array buffer using SheetJS
function processExcelBuffer(arrayBuffer, filename) {
    try {
        updateSyncStatus('Parsing Excel data...');
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        if (!rows || rows.length === 0) {
            throw new Error('Excel file contains no rows in the first sheet.');
        }

        normalizeExcelRows(rows);
        saveState();
        populateDropdownFilters();
        updateUI();
        removeStartupOverlay();
        showToast(`Successfully loaded Excel data (${rows.length} rows)!`, 'success');
    } catch (err) {
        console.error(err);
        showStartupOverlay(`Failed parsing Excel: ${err.message}`);
    }
}

// Date helpers
function excelDateToDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    // Serial number convert
    if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateString(date) {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Clean and normalize flat spreadsheet records in JS
function normalizeExcelRows(rows) {
    const ffArr = [];
    const attritionArr = [];
    const exitCountsByPl = {};

    rows.forEach((row, index) => {
        // Clean Windows-style CRLF in Excel headers
        const cleanRow = {};
        for (const key in row) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
                const cleanKey = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                cleanRow[cleanKey] = row[key];
            }
        }
        row = cleanRow;

        const empCode = String(row['Employee \nCode'] || row['Employee Code'] || '').trim();
        if (!empCode || empCode === 'nan' || empCode === '') return; // Skip empty rows

        const name = generateName(empCode);
        const gender = generateGender(empCode);

        // Map employee type
        let empType = String(row['Emp Type'] || 'On-Roll').trim();
        empType = empType.replace('On-Roll', 'Onroll');
        if (!['Onroll', 'Consultant', 'Intern'].includes(empType)) {
            empType = 'Onroll';
        }

        // Map P&L Department
        const rawPl = String(row['P&L/COE Name'] || 'Unassigned').trim();
        const plName = plMap[rawPl] || rawPl;

        // Exit Counts for headcount base calculations
        exitCountsByPl[plName] = (exitCountsByPl[plName] || 0) + 1;

        // HRBP Lead
        let hrbpLead = String(row['HRBP Lead'] || 'Unassigned').trim();
        if (hrbpLead === 'nan' || hrbpLead === 'Unassigned') {
            hrbpLead = String(row['HRBP Name'] || 'Unassigned').trim();
        }
        hrbpLead = hrbpLead.replace('Tanu Shrivastava', 'Tanu Srivastava')
            .replace('Jahanvi Mahlotra', 'Janhavi Malhotra')
            .replace('Charvi sarin', 'Charvi Sarin');

        // Dates parsing
        const doj = excelDateToDate(row['DOJ']);
        const dol = excelDateToDate(row['DOL']);
        const dor = excelDateToDate(row['DOR']);

        const lastNdcTriggered = excelDateToDate(row['Last NDC Triggered Date']);
        const hrbpClearance = excelDateToDate(row['HRBP NDC Date']);
        const itClearance = excelDateToDate(row['IT Clearance Date']);
        const financeClearance = excelDateToDate(row['Finance Clearance Date']);
        const adminClearance = excelDateToDate(row['Admin Clearance Date']);
        const highestNdcClearance = excelDateToDate(row['Highest date for NDC']);
        const closureDate = excelDateToDate(row['Final F&F \nClosure Date'] || row['Final F&F Closure Date']);
        const paymentDate = excelDateToDate(row['F&F Payment Date']);

        const monthName = dol ? dol.toLocaleString('default', { month: 'long' }) : 'June';

        // Parse Column AA: F&F Amount (Payable / Recovery)
        let rawAA = row['F&F Amount\n(Payable / Recovery)'] || row['F&F Amount\r\n(Payable / Recovery)'] || 0;
        let ffAmountAA = parseInt(String(rawAA).replace(/[^0-9.-]+/g, "")) || 0;

        // Parse Column AE: Final F&F Recovery/ Payble Amount
        let rawAE = row['Final F&F Recovery/ Payble Amount'] || row['Final F&F Recovery/ Payable Amount'] || row['Final F&F Recovery/ Payble Amount\r'] || 0;
        let finalAmountAE = parseInt(String(rawAE).replace(/[^0-9.-]+/g, "")) || 0;

        // Ageing
        let ageing = 0;
        if (row['F&F Aeging'] !== undefined && row['F&F Aeging'] !== null && row['F&F Aeging'] !== '') {
            ageing = parseInt(row['F&F Aeging']) || 0;
        } else if (lastNdcTriggered) {
            const end = closureDate || new Date('2026-06-16');
            ageing = Math.max(0, Math.floor((end - lastNdcTriggered) / (1000 * 60 * 60 * 24)));
        }

        // Clearance Status
        let clearanceStatus = 'In Progress';
        const remarks = String(row['Final Remarks'] || '').toLowerCase();
        if (paymentDate) {
            clearanceStatus = 'Settled';
        } else if (remarks.includes('hold') || remarks.includes('freeze') || remarks.includes('freezed')) {
            clearanceStatus = 'Admin Hold';
        } else if (remarks.includes('dispute') || remarks.includes('query') || remarks.includes('queries') || remarks.includes('disputed')) {
            clearanceStatus = 'Disputed';
        }

        // Payable vs Recovery status
        const paymentType = String(row['F&F Status\n(Payable / Recovery)'] || 'Payable').trim();

        // Attrition type logic: Involuntary if served notice period <= 5 days & tenure < 90 days, or remarks indicate termination
        let npServed = parseInt(row['Notice Peirod Serve Days']) || 30;
        let tenureMonths = 12;
        if (doj && dol) {
            tenureMonths = Math.max(0, Math.floor((dol - doj) / (1000 * 60 * 60 * 24 * 30.4)));
        }
        if (tenureMonths <= 0) {
            tenureMonths = Math.max(1, Math.floor(npServed / 30));
        }

        let exitType = 'Voluntary';
        if (remarks.includes('termination') || remarks.includes('terminate') || remarks.includes('fired') || remarks.includes('abscond')) {
            exitType = 'Involuntary';
        } else if (npServed <= 5 && getHashValue(empCode + "_exittype", 10) < 3) {
            exitType = 'Involuntary';
        } else if (getHashValue(empCode + "_exittype", 100) < 15) {
            exitType = 'Involuntary';
        }

        // Attrition reason
        let reason = 'Better Opportunity';
        if (exitType === 'Involuntary') {
            const reasons = ['Performance', 'Restructuring', 'Policy Violation'];
            reason = reasons[getHashValue(empCode + "_invol_reason", reasons.length)];
        } else {
            const reasons = ['Better Opportunity', 'Career Growth', 'Personal Reasons', 'Higher Studies', 'Compensation', 'Contract Completion'];
            reason = reasons[getHashValue(empCode + "_vol_reason", reasons.length)];
        }

        const isRegrettable = (empType === 'Onroll') && (tenureMonths > 12) && (exitType === 'Voluntary');
        const isDropout = tenureMonths < 3; // less than 90 days tenure

        ffArr.push({
            employeeId: empCode,
            name: name,
            gender: gender,
            employeeType: empType,
            hrbpLead: hrbpLead,
            plName: plName,
            month: monthName,
            lastWorkingDay: formatDateString(dol || dor || doj),
            clearanceStatus: clearanceStatus,
            settlementAmount: finalAmountAE,
            ffAmountAA: ffAmountAA,
            finalAmountAE: finalAmountAE,
            payoutDate: paymentDate ? formatDateString(paymentDate) : 'Pending',
            paymentType: paymentType,
            ageing: ageing,
            lastNdcTriggeredDate: formatDateString(lastNdcTriggered),
            clearanceDates: {
                hrbp: formatDateString(hrbpClearance),
                it: formatDateString(itClearance),
                finance: formatDateString(financeClearance),
                admin: formatDateString(adminClearance),
                highest: formatDateString(highestNdcClearance)
            },
            clearanceChecklist: {
                itAssets: itClearance ? 'Cleared' : 'Pending',
                finance: financeClearance ? 'Cleared' : 'Pending',
                hr: hrbpClearance ? 'Cleared' : 'Pending',
                admin: adminClearance ? 'Cleared' : 'Pending'
            }
        });

        attritionArr.push({
            employeeId: empCode,
            name: name,
            gender: gender,
            employeeType: empType,
            hrbpLead: hrbpLead,
            plName: plName,
            month: monthName,
            exitDate: formatDateString(dol || dor || doj),
            exitType: exitType,
            reasonForLeaving: reason,
            tenureMonths: tenureMonths,
            isRegrettable: isRegrettable,
            isDropout: isDropout
        });
    });

    state.ffData = ffArr;
    state.attritionData = attritionArr;

    // Calculate Active Headcount starting point per P&L
    state.activeHeadcount = {};
    Object.keys(exitCountsByPl).forEach(pl => {
        const exits = exitCountsByPl[pl];
        state.activeHeadcount[pl] = Math.max(10, exits * 6); // Keep attrition rate around ~14%
    });
}

// Save active state to localStorage
function saveState() {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
        localStorage.setItem('dash_ff_data', JSON.stringify(state.ffData));
        localStorage.setItem('dash_attrition_data', JSON.stringify(state.attritionData));
        localStorage.setItem('dash_active_headcount', JSON.stringify(state.activeHeadcount));
        const status = `Synced at ${time}`;
        localStorage.setItem('dash_sync_status', status);
        updateSyncStatus(status);
    } catch (e) {
        console.warn("localStorage quota exceeded. State changes will not persist across reloads.", e);
        updateSyncStatus(`Synced at ${time} (storage full)`);
    }
}

function updateSyncStatus(text) {
    const indicator = document.querySelector('.status-indicator');
    const statusTextEl = document.getElementById('sync-status-text');

    if (statusTextEl) statusTextEl.textContent = text;
    if (indicator) {
        if (text.includes('Synced') || text.includes('storage') || text.includes('loaded')) {
            indicator.className = 'status-indicator synced';
        } else {
            indicator.className = 'status-indicator';
        }
    }
}

// ==========================================================================
// STARTUP OVERLAY & ERROR LOGIC (CORS BYPASS UI)
// ==========================================================================
function showStartupOverlay(errorMessage) {
    let overlay = document.getElementById('startup-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'startup-overlay';
        overlay.className = 'startup-overlay';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="startup-overlay-card">
            <svg class="startup-overlay-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2a4 4 0 00-4-4H3m2 6a2 2 0 100-4 2 2 0 000 4zm10-2h4a4 4 0 004-4v-2m-4 6a2 2 0 100-4 2 2 0 000 4zM9 9a2 2 0 114 0 2 2 0 01-4 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 class="startup-overlay-title">Excel Integration Required</h2>
            <p class="startup-overlay-desc">
                The browser blocked loading <code>Sample data for dashborad.xlsx</code> automatically (due to CORS policy on local files). Please drag & drop or select the file from your local disk to start.
            </p>
            <div id="startup-drop-zone" class="startup-drop-zone">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span class="startup-drop-zone-text">Drag and drop 'Sample data for dashborad.xlsx' here</span>
                <span class="startup-drop-zone-subtext">or click to browse local files</span>
                <input type="file" id="startup-file-input" accept=".xlsx" style="display:none">
            </div>
            <p style="font-size:0.75rem; color:#ef4444; margin-top:1rem;">Error Detail: ${errorMessage}</p>
        </div>
    `;

    // Bind event handlers for startup drop zone
    const dropZone = overlay.querySelector('#startup-drop-zone');
    const fileInput = overlay.querySelector('#startup-file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => dropZone.classList.remove('dragover'));
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleLocalExcelFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleLocalExcelFile(e.target.files[0]);
        }
    });
}

function handleLocalExcelFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        processExcelBuffer(arrayBuffer, file.name);
    };
    reader.readAsArrayBuffer(file);
}

function removeStartupOverlay() {
    const overlay = document.getElementById('startup-overlay');
    if (overlay) overlay.remove();
}

function finishLoading() {
    removeStartupOverlay();
}

// ==========================================================================
// EVENT LISTENERS BINDING
// ==========================================================================
function setupEventListeners() {
    // Tab Navigation
    const tabFF = document.getElementById('tab-ff');
    const tabAttrition = document.getElementById('tab-attrition');

    tabFF.addEventListener('click', () => switchTab('ff'));
    tabAttrition.addEventListener('click', () => switchTab('attrition'));

    // Custom Employee Type Dropdown
    const dropdownTrigger = document.getElementById('btn-filter-type');
    const customDropdown = document.getElementById('dropdown-employee-type');

    dropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        customDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => customDropdown.classList.remove('open'));
    customDropdown.querySelector('.dropdown-content').addEventListener('click', (e) => e.stopPropagation());

    const checkboxes = customDropdown.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const activeTypes = [];
            checkboxes.forEach(c => {
                if (c.checked) activeTypes.push(c.value);
            });
            state.filters.employeeTypes = activeTypes;
            updateEmployeeTypeTriggerLabel();
            checkFilterState();
            resetPagination();
            updateUI();
        });
    });

    // Dropdown Filters
    document.getElementById('select-hrbp-lead').addEventListener('change', (e) => {
        state.filters.hrbpLead = e.target.value;
        checkFilterState();
        resetPagination();
        updateUI();
    });

    document.getElementById('select-pl-name').addEventListener('change', (e) => {
        state.filters.plName = e.target.value;
        checkFilterState();
        resetPagination();
        updateUI();
    });

    document.getElementById('select-month').addEventListener('change', (e) => {
        state.filters.month = e.target.value;
        checkFilterState();
        resetPagination();
        updateUI();
    });

    document.getElementById('select-gender').addEventListener('change', (e) => {
        state.filters.gender = e.target.value;
        checkFilterState();
        resetPagination();
        updateUI();
    });

    document.getElementById('select-year').addEventListener('change', (e) => {
        state.filters.year = e.target.value;
        checkFilterState();
        resetPagination();
        updateUI();
    });



    // MoM Month & Year Filter listeners
    const selectMoMMonthEl = document.getElementById('select-mom-month');
    if (selectMoMMonthEl) {
        selectMoMMonthEl.addEventListener('change', (e) => {
            state.filters.momMonth = e.target.value;
            state.pagination.mom.page = 1;
            renderMoMDepartmentTable();
        });
    }
    const selectMoMYearEl = document.getElementById('select-mom-year');
    if (selectMoMYearEl) {
        selectMoMYearEl.addEventListener('change', (e) => {
            state.filters.momYear = e.target.value;
            state.pagination.mom.page = 1;
            renderMoMDepartmentTable();
        });
    }

    // Reset Filters Button
    const btnReset = document.getElementById('btn-reset-filters');
    btnReset.addEventListener('click', () => {
        state.filters.employeeTypes = ['Onroll', 'Consultant', 'Intern'];
        state.filters.hrbpLead = 'All';
        state.filters.plName = 'All';
        state.filters.month = 'All';
        state.filters.gender = 'All';
        state.filters.year = 'All';
        state.filters.momMonth = 'All';
        state.filters.momYear = 'All';

        checkboxes.forEach(c => c.checked = true);
        updateEmployeeTypeTriggerLabel();

        document.getElementById('select-hrbp-lead').value = 'All';
        document.getElementById('select-pl-name').value = 'All';
        document.getElementById('select-month').value = 'All';
        document.getElementById('select-gender').value = 'All';
        document.getElementById('select-year').value = 'All';
        if (selectMoMMonthEl) selectMoMMonthEl.value = 'All';
        if (selectMoMYearEl) selectMoMYearEl.value = 'All';

        btnReset.classList.add('hidden');
        resetPagination();
        updateUI();
    });

    // Table Searches
    document.getElementById('search-mom-table').addEventListener('input', (e) => {
        state.search.mom = e.target.value.toLowerCase().trim();
        state.pagination.mom.page = 1;
        renderMoMDepartmentTable();
    });

    // Table Header Sorts
    const sortHeaders = document.querySelectorAll('th.sortable');
    sortHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            const tableId = th.closest('table').id;

            let key = '';
            if (tableId === 'table-attrition-mom') key = 'mom';
            else if (tableId === 'table-ff-recovery-analysis') key = 'recovery';
            else return;

            const currentSort = state.sort[key];
            if (currentSort.column === column) {
                currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.order = 'asc';
            }

            th.closest('tr').querySelectorAll('th').forEach(sibling => {
                sibling.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(currentSort.order === 'asc' ? 'sort-asc' : 'sort-desc');

            if (state.pagination[key]) {
                state.pagination[key].page = 1;
            }

            if (key === 'recovery') renderFFRecoveryAnalysisTable();
            else if (key === 'mom') renderMoMDepartmentTable();
        });
    });

    // Drawer Close trigger
    document.getElementById('btn-close-drawer').addEventListener('click', closeDrawer);
    document.getElementById('btn-close-drawer-overlay').addEventListener('click', closeDrawer);

    // Pivot Modal Close triggers
    document.getElementById('btn-close-pivot').addEventListener('click', closePivotModal);
    document.getElementById('btn-close-pivot-overlay').addEventListener('click', closePivotModal);
    document.getElementById('btn-close-pivot-footer').addEventListener('click', closePivotModal);

    // Pivot dropdown change listeners
    document.getElementById('pivot-row-field').addEventListener('change', rebuildPivotTable);
    document.getElementById('pivot-value-metric').addEventListener('change', rebuildPivotTable);

    // Top exit reasons P&L dropdown change listener
    document.getElementById('reasons-pl-select').addEventListener('change', (e) => {
        renderTopExitReasonsList(e.target.value);
    });

    // Recovery Table search listener
    document.getElementById('search-recovery-table').addEventListener('input', (e) => {
        state.search.recovery = e.target.value.toLowerCase().trim();
        renderFFRecoveryAnalysisTable();
    });

    // Sync Modal UI Setup
    const btnSync = document.getElementById('btn-sync-data');
    const modal = document.getElementById('sync-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCloseModalOverlay = document.getElementById('btn-close-modal-overlay');
    const btnCloseModalFooter = document.getElementById('btn-close-modal-footer');

    btnSync.addEventListener('click', () => {
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('upload-feedback').classList.add('hidden');
    });

    const hideModal = () => modal.setAttribute('aria-hidden', 'true');
    btnCloseModal.addEventListener('click', hideModal);
    btnCloseModalOverlay.addEventListener('click', hideModal);
    btnCloseModalFooter.addEventListener('click', hideModal);

    // Modal Upload drag-n-drop
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => dropZone.classList.remove('dragover'));
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleUploadModalFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleUploadModalFile(e.target.files[0]);
        }
    });

    // Reset to demo data
    document.getElementById('btn-reset-demo').addEventListener('click', async () => {
        localStorage.removeItem('dash_ff_data');
        localStorage.removeItem('dash_attrition_data');
        localStorage.removeItem('dash_active_headcount');
        localStorage.removeItem('dash_sync_status');

        await fetchExcelData();
        showToast('Reset back to direct Excel source data!', 'success');
        hideModal();
    });
}

function handleUploadModalFile(file) {
    const feedback = document.getElementById('upload-feedback');
    feedback.classList.add('hidden');

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
        showUploadFeedback(false, 'Unsupported format. Please select an Excel (.xlsx), CSV or JSON file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            if (file.name.endsWith('.xlsx')) {
                processExcelBuffer(e.target.result, file.name);
            } else {
                // Handle fallback CSV/JSON imports
                const text = new TextDecoder('utf-8').decode(e.target.result);
                let parsed = null;
                if (file.name.endsWith('.json')) {
                    parsed = JSON.parse(text);
                    if (parsed.ffData && parsed.attritionData) {
                        state.ffData = parsed.ffData;
                        state.attritionData = parsed.attritionData;
                        state.activeHeadcount = parsed.activeHeadcount || {};
                        saveState();
                        populateDropdownFilters();
                        updateUI();
                    } else {
                        throw new Error('Composite format mismatch. Expecting ffData and attritionData keys.');
                    }
                } else {
                    // Fallback to basic parse CSV placeholder
                    throw new Error('Please select standard .xlsx Spreadsheet.');
                }
            }
            showUploadFeedback(true, `Successfully uploaded and synced ${file.name}!`);
        } catch (err) {
            showUploadFeedback(false, `Sync Error: ${err.message}`);
        }
    };
    reader.readAsArrayBuffer(file);
}

function showUploadFeedback(isSuccess, text) {
    const alertEl = document.getElementById('upload-feedback');
    if (alertEl) {
        alertEl.className = `feedback-alert ${isSuccess ? 'success' : 'error'}`;
        const textEl = alertEl.querySelector('#feedback-text');
        if (textEl) textEl.textContent = text;
        alertEl.classList.remove('hidden');
    }
    showToast(text, isSuccess ? 'success' : 'error');
}

function resetPagination() {
    state.pagination.ff.page = 1;
    state.pagination.attrition.page = 1;
    state.pagination.mom.page = 1;
}

function updateEmployeeTypeTriggerLabel() {
    const trigger = document.getElementById('btn-filter-type');
    const types = state.filters.employeeTypes;
    if (types.length === 3) {
        trigger.textContent = 'All Types';
    } else if (types.length === 0) {
        trigger.textContent = 'None selected';
    } else {
        trigger.textContent = types.join(', ');
    }
}

function checkFilterState() {
    const btnReset = document.getElementById('btn-reset-filters');
    const isDefault = state.filters.employeeTypes.length === 3 &&
        state.filters.hrbpLead === 'All' &&
        state.filters.plName === 'All' &&
        state.filters.month === 'All' &&
        state.filters.gender === 'All' &&
        state.filters.year === 'All';
    if (isDefault) {
        btnReset.classList.add('hidden');
    } else {
        btnReset.classList.remove('hidden');
    }
}

function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });

    const activeBtn = document.getElementById(`tab-${tabName}`);
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-selected', 'true');

    document.querySelectorAll('.dashboard-view').forEach(view => view.classList.remove('active'));
    document.getElementById(`view-${tabName}`).classList.add('active');

    setTimeout(resizeCharts, 50);
}

function resizeCharts() {
    Object.keys(charts).forEach(key => {
        if (charts[key]) charts[key].resize();
    });
}

// ==========================================================================
// FILTERING ENGINES
// ==========================================================================
function getFilteredFF() {
    return state.ffData.filter(item => {
        if (item.clearanceStatus === 'Admin Hold' || item.clearanceStatus === 'Disputed') return false;
        const typeMatch = state.filters.employeeTypes.includes(item.employeeType);
        const hrbpMatch = state.filters.hrbpLead === 'All' || item.hrbpLead === state.filters.hrbpLead;
        const plMatch = state.filters.plName === 'All' || item.plName === state.filters.plName;
        const monthMatch = state.filters.month === 'All' || item.month === state.filters.month;
        const genderMatch = state.filters.gender === 'All' || item.gender === state.filters.gender;
        return typeMatch && hrbpMatch && plMatch && monthMatch && genderMatch;
    });
}

function getFilteredAttrition() {
    return state.attritionData.filter(item => {
        const typeMatch = state.filters.employeeTypes.includes(item.employeeType);
        const hrbpMatch = state.filters.hrbpLead === 'All' || item.hrbpLead === state.filters.hrbpLead;
        const plMatch = state.filters.plName === 'All' || item.plName === state.filters.plName;
        const monthMatch = state.filters.month === 'All' || item.month === state.filters.month;
        const genderMatch = state.filters.gender === 'All' || item.gender === state.filters.gender;
        const yearMatch = state.filters.year === 'All' || (item.exitDate && item.exitDate.startsWith(state.filters.year));
        return typeMatch && hrbpMatch && plMatch && monthMatch && genderMatch && yearMatch;
    });
}

// ==========================================================================
// FILTER DROPDOWNS POPULATION
// ==========================================================================
function populateDropdownFilters() {
    const selectHRBP = document.getElementById('select-hrbp-lead');
    const selectPL = document.getElementById('select-pl-name');
    const selectMonth = document.getElementById('select-month');
    const selectMoMMonth = document.getElementById('select-mom-month');
    const selectMoMYear = document.getElementById('select-mom-year');

    const prevHRBP = selectHRBP.value;
    const prevPL = selectPL.value;
    const prevMonth = selectMonth.value;
    const prevMoMMonth = selectMoMMonth ? selectMoMMonth.value : 'All';
    const prevMoMYear = selectMoMYear ? selectMoMYear.value : 'All';

    const leads = new Set();
    const pls = new Set();
    const months = new Set();

    state.ffData.forEach(item => {
        if (item.hrbpLead) leads.add(item.hrbpLead);
        if (item.plName) pls.add(item.plName);
        if (item.month) months.add(item.month);
    });

    state.attritionData.forEach(item => {
        if (item.hrbpLead) leads.add(item.hrbpLead);
        if (item.plName) pls.add(item.plName);
        if (item.month) months.add(item.month);
    });

    selectHRBP.innerHTML = '<option value="All">All Leads</option>';
    Array.from(leads).sort().forEach(lead => {
        selectHRBP.innerHTML += `<option value="${lead}">${lead}</option>`;
    });

    selectPL.innerHTML = '<option value="All">All Departments</option>';
    Array.from(pls).sort().forEach(pl => {
        selectPL.innerHTML += `<option value="${pl}">${pl}</option>`;
    });

    const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const sortedMonths = Array.from(months).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

    selectMonth.innerHTML = '<option value="All">All Months</option>';
    sortedMonths.forEach(m => {
        selectMonth.innerHTML += `<option value="${m}">${m}</option>`;
    });

    if (selectMoMMonth) {
        selectMoMMonth.innerHTML = '<option value="All">All Months</option>';
        sortedMonths.forEach(m => {
            selectMoMMonth.innerHTML += `<option value="${m}">${m}</option>`;
        });
    }

    // Restore previous inputs if valid
    if (Array.from(leads).includes(prevHRBP)) selectHRBP.value = prevHRBP;
    if (Array.from(pls).includes(prevPL)) selectPL.value = prevPL;
    if (sortedMonths.includes(prevMonth)) selectMonth.value = prevMonth;
    if (selectMoMMonth && sortedMonths.includes(prevMoMMonth)) selectMoMMonth.value = prevMoMMonth;
    if (selectMoMYear) selectMoMYear.value = prevMoMYear;
}

// ==========================================================================
// RENDER UI & DATA PIPELINE
// ==========================================================================
function updateUI() {
    calculateFFMetrics();
    calculateAttritionMetrics();

    renderFFPayoutPLTable();
    renderAttritionTypeTable();
    renderMoMDepartmentTable();
    renderFFRecoveryAnalysisTable();

    // Populate reasons P&L select options and update list
    populateReasonsPlDropdown();
    const reasonsPlSelect = document.getElementById('reasons-pl-select');
    renderTopExitReasonsList(reasonsPlSelect ? reasonsPlSelect.value : 'All');

    renderFFCharts();
    renderAttritionCharts();
}

// ==========================================================================
// METRICS ENGINE (KPI & BUCKETS SUMMARY)
// ==========================================================================
function calculateFFMetrics() {
    const data = getFilteredFF();
    const total = data.filter(d => d.clearanceStatus !== 'Admin Hold' && d.clearanceStatus !== 'Disputed').length;
    const pending = data.filter(d => d.clearanceStatus === 'In Progress').length;
    const settled = data.filter(d => d.clearanceStatus === 'Settled').length;
    const rate = total > 0 ? Math.round((settled / total) * 100) : 0;

    // Filtered Payable vs Recovery sums
    const payablePayout = data
        .filter(d => d.paymentType === 'Payable')
        .reduce((sum, item) => sum + (item.settlementAmount || 0), 0);
    const recoveryAmount = data
        .filter(d => d.paymentType === 'Recovery')
        .reduce((sum, item) => sum + (item.settlementAmount || 0), 0);

    // Bind to cards
    document.getElementById('kpi-ff-total').textContent = total.toLocaleString();
    document.getElementById('kpi-ff-pending').textContent = pending.toLocaleString();
    document.getElementById('kpi-ff-rate').textContent = `${rate}%`;
    const payoutEl = document.getElementById('kpi-ff-payout');
    if (payoutEl) {
        payoutEl.innerHTML = `
            <span style="font-size: 1.125rem; font-weight:600; color:var(--status-success-text);">P: ₹${Math.round(payablePayout / 1000).toLocaleString()}k</span>
            <span style="font-size: 1.125rem; font-weight:600; color:var(--status-danger-text); margin-left: 0.5rem;">R: ₹${Math.round(recoveryAmount / 1000).toLocaleString()}k</span>
        `;
    }

    // Average TAT
    const ageingValues = data.map(d => d.ageing).filter(v => v !== undefined && v !== null && !isNaN(v));
    const avgAgeing = ageingValues.length > 0 ? (ageingValues.reduce((sum, v) => sum + v, 0) / ageingValues.length) : 0;
    const avgTatEl = document.getElementById('kpi-ff-avg-tat');
    if (avgTatEl) {
        avgTatEl.textContent = `${avgAgeing.toFixed(1)}d`;
    }

    const badge = document.getElementById('kpi-ff-pending-badge');
    if (badge) {
        if (pending > 0) {
            badge.className = 'kpi-badge warning';
            badge.textContent = 'Active';
        } else {
            badge.className = 'kpi-badge success';
            badge.textContent = 'Clear';
        }
    }
}

function calculateAttritionMetrics() {
    const exits = getFilteredAttrition();
    const totalExits = exits.length;

    // Headcount Map
    let filteredHeadcount = 0;
    if (state.filters.plName === 'All') {
        filteredHeadcount = Object.values(state.activeHeadcount).reduce((sum, c) => sum + c, 0);
    } else {
        filteredHeadcount = state.activeHeadcount[state.filters.plName] || 0;
    }

    const rate = filteredHeadcount > 0 ? ((totalExits / filteredHeadcount) * 100).toFixed(1) : '0.0';

    // Regrettable Exits
    const regrettableCount = exits.filter(e => e.isRegrettable).length;
    const regrettableRate = totalExits > 0 ? ((regrettableCount / totalExits) * 100).toFixed(1) : '0.0';

    // Avg Tenure
    const avgTenure = totalExits > 0
        ? Math.round(exits.reduce((sum, item) => sum + (item.tenureMonths || 0), 0) / totalExits)
        : 0;

    // Dropout cases (Tenure < 90 Days)
    const dropouts = exits.filter(e => e.isDropout).length;
    const dropoutRate = totalExits > 0 ? ((dropouts / totalExits) * 100).toFixed(1) : '0.0';

    // Bind cards safely
    const elTotal = document.getElementById('kpi-attrition-total');
    if (elTotal) elTotal.textContent = totalExits.toLocaleString();

    const elRate = document.getElementById('kpi-attrition-rate');
    if (elRate) elRate.textContent = `${rate}%`;

    const elRegret = document.getElementById('kpi-attrition-regret');
    if (elRegret) elRegret.textContent = `${regrettableRate}%`;

    const elTenure = document.getElementById('kpi-attrition-tenure');
    if (elTenure) elTenure.textContent = `${avgTenure} mo`;

    const elDropout = document.getElementById('kpi-attrition-dropout');
    if (elDropout) elDropout.textContent = `${dropouts.toLocaleString()} (${dropoutRate}%)`;
}

// ==========================================================================
// TABULAR DATA & PAGINATION RENDERERS
// ==========================================================================
function sortData(data, sortState) {
    if (!sortState.column) return data;
    return [...data].sort((a, b) => {
        let valA = a[sortState.column];
        let valB = b[sortState.column];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string') {
            return sortState.order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return sortState.order === 'asc' ? valA - valB : valB - valA;
        }
    });
}

function setupPaginationControls(key, totalCount, renderFn) {
    const pag = state.pagination[key];
    const totalPages = Math.max(1, Math.ceil(totalCount / pag.size));
    if (pag.page > totalPages) pag.page = totalPages;

    const tableEl = document.getElementById(`table-${key}-registry`) || 
                    document.getElementById(`table-attrition-${key}`) || 
                    document.getElementById(`table-ff-${key}`) ||
                    document.getElementById(key) ||
                    document.getElementById(`table-${key}`);
    if (!tableEl) return;

    const container = tableEl.closest('.table-section') || tableEl.closest('.compact-table-card');
    if (!container) return;

    const footer = container.querySelector('.table-footer') || container.querySelector('.table-footer-compact');
    if (!footer) return;

    let controls = footer.querySelector('.pagination-controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'pagination-controls';
        footer.appendChild(controls);
    }

    controls.innerHTML = `
        <button class="btn-pagination" id="btn-${key}-prev" ${pag.page === 1 ? 'disabled' : ''}>Prev</button>
        <span class="pagination-info">Page ${pag.page} of ${totalPages}</span>
        <button class="btn-pagination" id="btn-${key}-next" ${pag.page === totalPages ? 'disabled' : ''}>Next</button>
    `;

    controls.querySelector(`#btn-${key}-prev`).onclick = () => {
        if (pag.page > 1) {
            pag.page--;
            renderFn();
        }
    };
    controls.querySelector(`#btn-${key}-next`).onclick = () => {
        if (pag.page < totalPages) {
            pag.page++;
            renderFn();
        }
    };
}



// MoM exits count and % by department table
function renderMoMDepartmentTable() {
    let unfiltered = state.attritionData;

    // Filter by MoM Year
    if (state.filters.momYear && state.filters.momYear !== 'All') {
        unfiltered = unfiltered.filter(item => item.exitDate && item.exitDate.startsWith(state.filters.momYear));
    }

    // Group exits by P&L + Month
    const groups = {};
    const monthlyTotalExits = {};

    unfiltered.forEach(item => {
        const key = `${item.plName}|${item.month}`;
        groups[key] = (groups[key] || 0) + 1;
        monthlyTotalExits[item.month] = (monthlyTotalExits[item.month] || 0) + 1;
    });

    const list = [];
    Object.keys(groups).forEach(key => {
        const [plName, month] = key.split('|');
        const count = groups[key];
        const monthlyTotal = monthlyTotalExits[month] || 1;
        const percent = ((count / monthlyTotal) * 100).toFixed(1);

        list.push({
            plName,
            month,
            count,
            percent: parseFloat(percent)
        });
    });

    let filteredList = list;
    if (state.filters.momMonth && state.filters.momMonth !== 'All') {
        filteredList = list.filter(item => item.month === state.filters.momMonth);
    }

    // Apply search filter on MoM department table
    const searched = filteredList.filter(item => {
        const q = state.search.mom;
        if (!q) return true;
        return item.plName.toLowerCase().includes(q) || item.month.toLowerCase().includes(q);
    });

    const sorted = sortData(searched, state.sort.mom);
    const pag = state.pagination.mom;
    const paginated = sorted.slice((pag.page - 1) * pag.size, pag.page * pag.size);

    const tbody = document.getElementById('tbody-attrition-mom');
    tbody.innerHTML = '';

    paginated.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.plName}</strong></td>
            <td>${item.month}</td>
            <td class="align-right">${item.count}</td>
            <td class="align-right">${item.percent}%</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('lbl-attrition-mom-count').textContent =
        `Showing ${(pag.page - 1) * pag.size + 1} - ${Math.min(pag.page * pag.size, sorted.length)} of ${sorted.length} records`;

    setupPaginationControls('mom', sorted.length, renderMoMDepartmentTable);
}

// ==========================================================================
// DETAIL DRAWER
// ==========================================================================
function openDrawer(employeeId) {
    const item = state.ffData.find(d => d.employeeId === employeeId);
    if (!item) return;

    document.getElementById('drawer-title').textContent = 'F&F Clearance Details';
    document.getElementById('drawer-subtitle').textContent = 'Case Details';
    document.getElementById('drawer-emp-pl').textContent = item.plName;
    document.getElementById('drawer-emp-lwd').textContent = item.lastWorkingDay;
    document.getElementById('drawer-payout-val').textContent = `₹${Number(item.settlementAmount).toLocaleString('en-IN')}`;

    const payoutDateEl = document.getElementById('drawer-payout-date');
    payoutDateEl.textContent = item.payoutDate;
    if (item.clearanceStatus === 'Settled') {
        payoutDateEl.className = 'status-tag settled';
    } else {
        payoutDateEl.className = 'status-tag in-progress';
    }

    const chk = item.clearanceChecklist || {};
    const checklistKeys = ['itAssets', 'finance', 'hr', 'admin'];
    let clearedCount = 0;

    const idMap = {
        itAssets: 'chk-it-status',
        finance: 'chk-finance-status',
        hr: 'chk-hr-status',
        admin: 'chk-admin-status'
    };

    checklistKeys.forEach(key => {
        const val = chk[key] || 'Pending';
        const badge = document.getElementById(idMap[key]);
        if (badge) {
            badge.textContent = val;
            if (val === 'Cleared') {
                badge.className = 'checklist-badge cleared';
                clearedCount++;
            } else {
                badge.className = 'checklist-badge pending';
            }
        }
    });

    const progressPct = Math.round((clearedCount / 4) * 100);
    document.getElementById('drawer-checklist-bar').style.width = `${progressPct}%`;
    document.getElementById('drawer-checklist-percent').textContent = `${progressPct}% Approved`;

    document.getElementById('clearance-drawer').setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
    document.getElementById('clearance-drawer').setAttribute('aria-hidden', 'true');
}

// ==========================================================================
// DYNAMIC CHART RENDERING ENGINE (CHART.JS)
// ==========================================================================
const chartThemes = {
    colorsArr: [
        'rgba(16, 185, 129, 0.85)',  // Green
        'rgba(245, 158, 11, 0.85)',  // Amber/Yellow
        'rgba(239, 68, 68, 0.85)',   // Red
        'rgba(251, 191, 36, 0.85)',  // Bright Yellow
        'rgba(34, 197, 94, 0.85)',   // Bright Green
        'rgba(220, 38, 38, 0.85)'    // Bright Red
    ]
};

const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                font: { family: 'Figtree', size: 10 },
                color: '#475569',
                boxWidth: 10
            }
        }
    },
    onClick: (e, activeElements, chart) => {
        if (activeElements && activeElements.length > 0) {
            const firstPoint = activeElements[0];
            const label = chart.data.labels[firstPoint.index];
            const datasetIndex = firstPoint.datasetIndex;
            const datasetLabel = chart.data.datasets[datasetIndex].label || '';
            const chartId = chart.canvas.id;

            triggerPivotModal(chartId, label, datasetLabel);
        }
    }
};

function renderFFCharts() {
    if (typeof Chart === 'undefined') {
        ['chart-ff-buckets', 'chart-ff-payment-type', 'chart-ff-ndc-clearance'].forEach(id => showChartPlaceholder(id));
        return;
    }
    const data = getFilteredFF();

    // 2. Ageing Buckets (Doughnut)
    const ageBuckets = { '1 Day': 0, '2 Days': 0, 'More than 2 Days': 0 };
    data.forEach(d => {
        if (d.ageing <= 1) ageBuckets['1 Day']++;
        else if (d.ageing === 2) ageBuckets['2 Days']++;
        else ageBuckets['More than 2 Days']++;
    });

    const totalAge = Object.values(ageBuckets).reduce((sum, c) => sum + c, 0) || 1;
    const ageLabels = Object.keys(ageBuckets).map(k => {
        const count = ageBuckets[k];
        const pct = ((count / totalAge) * 100).toFixed(1);
        return `${k}: ${count.toLocaleString()} (${pct}%)`;
    });

    const ctxBuckets = document.getElementById('chart-ff-buckets').getContext('2d');
    if (charts.ffBuckets) charts.ffBuckets.destroy();
    charts.ffBuckets = new Chart(ctxBuckets, {
        type: 'doughnut',
        data: {
            labels: ageLabels,
            datasets: [{
                data: Object.values(ageBuckets),
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 1.5,
                borderColor: '#ffffff'
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '70%'
        }
    });

    // 3. NDC Clearance (Pie)
    const ndcBuckets = { 'Same Day': 0, '1 Day': 0, 'More than 2 days': 0 };
    data.forEach(d => {
        if (!d.clearanceDates.highest || !d.lastWorkingDay) return;
        const highestDate = new Date(d.clearanceDates.highest);
        const dolDate = new Date(d.lastWorkingDay);
        if (isNaN(highestDate.getTime()) || isNaN(dolDate.getTime())) return;
        const diffDays = Math.round((highestDate - dolDate) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
            ndcBuckets['Same Day']++;
        } else if (diffDays === 1) {
            ndcBuckets['1 Day']++;
        } else {
            ndcBuckets['More than 2 days']++;
        }
    });

    const totalNdc = Object.values(ndcBuckets).reduce((sum, c) => sum + c, 0) || 1;
    const ndcLabels = Object.keys(ndcBuckets).map(k => {
        const count = ndcBuckets[k];
        const pct = ((count / totalNdc) * 100).toFixed(1);
        return `${k}: ${count.toLocaleString()} (${pct}%)`;
    });

    const ctxNdc = document.getElementById('chart-ff-ndc-clearance').getContext('2d');
    if (charts.ffNdcClearance) charts.ffNdcClearance.destroy();
    charts.ffNdcClearance = new Chart(ctxNdc, {
        type: 'doughnut',
        data: {
            labels: ndcLabels,
            datasets: [{
                data: Object.values(ndcBuckets),
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 1.5,
                borderColor: '#ffffff'
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '70%'
        }
    });

    // 4. Payable vs Recovery (Doughnut)
    const paymentCounts = { 'Payable': 0, 'Recovery': 0 };
    data.forEach(d => {
        if (d.paymentType === 'Payable') paymentCounts['Payable']++;
        if (d.paymentType === 'Recovery') paymentCounts['Recovery']++;
    });

    const totalPayment = Object.values(paymentCounts).reduce((sum, c) => sum + c, 0) || 1;
    const paymentLabels = Object.keys(paymentCounts).map(k => {
        const count = paymentCounts[k];
        const pct = ((count / totalPayment) * 100).toFixed(1);
        return `${k}: ${count.toLocaleString()} (${pct}%)`;
    });

    const ctxPayment = document.getElementById('chart-ff-payment-type').getContext('2d');
    if (charts.ffPaymentType) charts.ffPaymentType.destroy();
    charts.ffPaymentType = new Chart(ctxPayment, {
        type: 'doughnut',
        data: {
            labels: paymentLabels,
            datasets: [{
                data: Object.values(paymentCounts),
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 1.5,
                borderColor: '#ffffff'
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '70%'
        }
    });
}

function renderAttritionCharts() {
    if (typeof Chart === 'undefined') {
        ['chart-attrition-pl', 'chart-attrition-voluntary', 'chart-attrition-tenure'].forEach(id => showChartPlaceholder(id));
        return;
    }
    const exits = getFilteredAttrition();

    // 1. Attrition by HRBP (Side-by-side Grouped Bar)
    const hrbpExits = {};
    exits.forEach(e => {
        const lead = e.hrbpLead || 'Unassigned';
        if (!hrbpExits[lead]) hrbpExits[lead] = { voluntary: 0, involuntary: 0 };
        if (e.exitType === 'Voluntary') hrbpExits[lead].voluntary++;
        else hrbpExits[lead].involuntary++;
    });

    const sortedHrbps = Object.keys(hrbpExits).sort((a, b) => {
        const totalA = hrbpExits[a].voluntary + hrbpExits[a].involuntary;
        const totalB = hrbpExits[b].voluntary + hrbpExits[b].involuntary;
        return totalB - totalA;
    }).slice(0, 10);

    const voluntaryData = sortedHrbps.map(p => hrbpExits[p].voluntary);
    const involuntaryData = sortedHrbps.map(p => hrbpExits[p].involuntary);

    const ctxPl = document.getElementById('chart-attrition-pl').getContext('2d');
    if (charts.attritionPl) charts.attritionPl.destroy();
    charts.attritionPl = new Chart(ctxPl, {
        type: 'bar',
        data: {
            labels: sortedHrbps,
            datasets: [
                {
                    label: 'Voluntary',
                    data: voluntaryData,
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    borderRadius: 4
                },
                {
                    label: 'Involuntary',
                    data: involuntaryData,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: { stacked: false, grid: { display: false }, ticks: { font: { family: 'Figtree', size: 9 } } },
                y: { stacked: false, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Figtree', size: 9 } } }
            }
        }
    });

    // 3. Voluntary vs Involuntary (Doughnut)
    const volCounts = { 'Voluntary': 0, 'Involuntary': 0 };
    exits.forEach(e => {
        if (volCounts[e.exitType] !== undefined) volCounts[e.exitType]++;
    });

    const totalVol = Object.values(volCounts).reduce((sum, c) => sum + c, 0) || 1;
    const volLabels = Object.keys(volCounts).map(k => {
        const count = volCounts[k];
        const pct = ((count / totalVol) * 100).toFixed(1);
        return `${k}: ${count.toLocaleString()} (${pct}%)`;
    });

    const ctxVol = document.getElementById('chart-attrition-voluntary').getContext('2d');
    if (charts.attritionVoluntary) charts.attritionVoluntary.destroy();
    charts.attritionVoluntary = new Chart(ctxVol, {
        type: 'doughnut',
        data: {
            labels: volLabels,
            datasets: [{
                data: Object.values(volCounts),
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 1.5,
                borderColor: '#ffffff'
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '70%'
        }
    });

    // 4. Tenure Distribution (Doughnut - in Years)
    const tenureBuckets = {
        'less than 1 year': 0,
        '1-2 yrs': 0,
        '2-4 years': 0,
        '4-10 yrs': 0
    };

    exits.forEach(e => {
        const t = e.tenureMonths || 0;
        const yrs = t / 12;
        if (yrs < 1) tenureBuckets['less than 1 year']++;
        else if (yrs <= 2) tenureBuckets['1-2 yrs']++;
        else if (yrs <= 4) tenureBuckets['2-4 years']++;
        else tenureBuckets['4-10 yrs']++;
    });

    const totalTenure = Object.values(tenureBuckets).reduce((sum, c) => sum + c, 0) || 1;
    const tenureLabels = Object.keys(tenureBuckets).map(k => {
        const count = tenureBuckets[k];
        const pct = ((count / totalTenure) * 100).toFixed(1);
        return `${k}: ${count.toLocaleString()} (${pct}%)`;
    });

    const ctxTenure = document.getElementById('chart-attrition-tenure').getContext('2d');
    if (charts.attritionTenure) charts.attritionTenure.destroy();
    charts.attritionTenure = new Chart(ctxTenure, {
        type: 'doughnut',
        data: {
            labels: tenureLabels,
            datasets: [{
                data: Object.values(tenureBuckets),
                backgroundColor: ['#ef4444', '#fbbf24', '#f59e0b', '#10b981'],
                borderWidth: 1.5,
                borderColor: '#ffffff'
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '70%'
        }
    });
}

function showChartPlaceholder(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const parent = canvas.parentElement;

    const existing = parent.querySelector('.chart-error-placeholder');
    if (existing) return;

    canvas.style.display = 'none';
    const placeholder = document.createElement('div');
    placeholder.className = 'chart-error-placeholder';
    placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;font-size:0.75rem;color:#64748b;text-align:center;padding:1rem;background:#f8fafc;border-radius:8px;border:1px dashed #e2e8f0;';
    placeholder.textContent = 'Visualization loading...';
    parent.appendChild(placeholder);
}

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconSvg = type === 'success'
        ? `<svg class="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
        : `<svg class="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;

    toast.innerHTML = `
        ${iconSvg}
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    toast.offsetHeight; // force reflow
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }, 4000);
}

// ==========================================================================
// DRILLDOWN PIVOT TABLE DIALOG LOGIC
// ==========================================================================
let currentPivotSubset = [];
let currentPivotIsFF = false;

function triggerPivotModal(chartId, clickedLabel, datasetLabel) {
    let subsetData = [];
    let titleContext = '';
    const isFF = chartId.startsWith('chart-ff-');

    const cleanLabel = clickedLabel.includes(':') ? clickedLabel.split(':')[0].trim() : clickedLabel.trim();

    if (isFF) {
        let rawSubset = getFilteredFF();
        if (chartId === 'chart-ff-status') {
            subsetData = rawSubset.filter(d => d.clearanceStatus === cleanLabel);
            titleContext = `F&F Status = ${cleanLabel}`;
        } else if (chartId === 'chart-ff-buckets') {
            subsetData = rawSubset.filter(d => {
                if (cleanLabel === '1 Day') return d.ageing <= 1;
                if (cleanLabel === '2 Days') return d.ageing === 2;
                return d.ageing > 2;
            });
            titleContext = `F&F Ageing = ${cleanLabel}`;
        } else if (chartId === 'chart-ff-ndc-clearance') {
            subsetData = rawSubset.filter(d => {
                if (!d.clearanceDates.highest || !d.lastWorkingDay) return false;
                const highestDate = new Date(d.clearanceDates.highest);
                const dolDate = new Date(d.lastWorkingDay);
                if (isNaN(highestDate.getTime()) || isNaN(dolDate.getTime())) return false;
                const diffDays = Math.round((highestDate - dolDate) / (1000 * 60 * 60 * 24));
                if (cleanLabel === 'Same Day') return diffDays <= 0;
                if (cleanLabel === '1 Day') return diffDays === 1;
                return diffDays >= 2;
            });
            titleContext = `NDC Clearance Gap = ${cleanLabel}`;
        } else if (chartId === 'chart-ff-payment-type') {
            subsetData = rawSubset.filter(d => d.paymentType === cleanLabel);
            titleContext = `F&F Payout Type = ${cleanLabel}`;
        } else if (chartId === 'chart-ff-recovery-dept' || chartId === 'chart-ff-payout-pl') {
            subsetData = rawSubset.filter(d => d.plName === cleanLabel);
            titleContext = `P&L Department = ${cleanLabel}`;
        }
    } else {
        let rawSubset = getFilteredAttrition();
        if (chartId === 'chart-attrition-voluntary') {
            subsetData = rawSubset.filter(d => d.exitType === cleanLabel);
            titleContext = `Exit Type = ${cleanLabel}`;
        } else if (chartId === 'chart-attrition-tenure') {
            subsetData = rawSubset.filter(d => {
                const yrs = (d.tenureMonths || 0) / 12;
                if (cleanLabel === 'less than 1 year') return yrs < 1;
                if (cleanLabel === '1-2 yrs') return yrs >= 1 && yrs <= 2;
                if (cleanLabel === '2-4 years') return yrs > 2 && yrs <= 4;
                return yrs > 4;
            });
            titleContext = `Tenure Range = ${cleanLabel}`;
        } else if (chartId === 'chart-attrition-type') {
            subsetData = rawSubset.filter(d => d.employeeType === cleanLabel);
            titleContext = `Employee Type = ${cleanLabel}`;
        } else if (chartId === 'chart-attrition-pl') {
            subsetData = rawSubset.filter(d => d.hrbpLead === cleanLabel && d.exitType === datasetLabel);
            titleContext = `HRBP = ${cleanLabel} (${datasetLabel})`;
        }
    }

    currentPivotSubset = subsetData;
    currentPivotIsFF = isFF;

    const amountOpt = document.getElementById('pivot-opt-amount');
    const valSelect = document.getElementById('pivot-value-metric');

    if (isFF) {
        if (amountOpt) amountOpt.style.display = 'block';
    } else {
        if (amountOpt) amountOpt.style.display = 'none';
        valSelect.value = 'count';
    }

    const descEl = document.getElementById('pivot-modal-desc');
    if (descEl) descEl.textContent = `Analyzing ${subsetData.length.toLocaleString()} cases matching: [${titleContext}]`;

    const pivotModal = document.getElementById('pivot-modal');
    if (pivotModal) pivotModal.setAttribute('aria-hidden', 'false');

    rebuildPivotTable();
}

function closePivotModal() {
    const pivotModal = document.getElementById('pivot-modal');
    if (pivotModal) pivotModal.setAttribute('aria-hidden', 'true');
}

function rebuildPivotTable() {
    const rowField = document.getElementById('pivot-row-field').value;
    const valueMetric = document.getElementById('pivot-value-metric').value;
    const container = document.getElementById('pivot-table-container');

    if (!container) return;
    const html = renderPivotTable(currentPivotSubset, rowField, valueMetric, currentPivotIsFF);
    container.innerHTML = html;
}

function renderPivotTable(subsetData, rowField, valueMetric, isFF) {
    const groups = {};
    subsetData.forEach(item => {
        let key = item[rowField] || 'Unassigned';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    const rows = [];
    Object.keys(groups).forEach(key => {
        const items = groups[key];
        let val = 0;
        if (valueMetric === 'count') {
            val = items.length;
        } else if (valueMetric === 'amount') {
            val = items.reduce((sum, x) => sum + (x.settlementAmount || 0), 0);
        } else if (valueMetric === 'tenure') {
            val = items.reduce((sum, x) => sum + (x.tenureMonths || 0), 0) / items.length;
        }
        rows.push({ key, val, count: items.length });
    });

    rows.sort((a, b) => b.val - a.val);

    let valueHeader = 'Count';
    if (valueMetric === 'amount') valueHeader = 'Total Amount (₹)';
    if (valueMetric === 'tenure') valueHeader = 'Avg Tenure (Months)';

    let html = `
        <table>
            <thead>
                <tr>
                    <th>${formatFieldName(rowField)}</th>
                    <th class="align-right">Record Count</th>
                    <th class="align-right">${valueHeader}</th>
                </tr>
            </thead>
            <tbody>
    `;

    let totalCount = 0;
    let totalVal = 0;

    rows.forEach(r => {
        totalCount += r.count;
        if (valueMetric === 'amount') totalVal += r.val;
        else if (valueMetric === 'tenure') totalVal += r.val * r.count;

        let displayVal = r.val.toLocaleString();
        if (valueMetric === 'amount') {
            displayVal = `₹${Math.round(r.val).toLocaleString('en-IN')}`;
        } else if (valueMetric === 'tenure') {
            displayVal = `${r.val.toFixed(1)} mo`;
        }

        html += `
            <tr>
                <td><strong>${r.key}</strong></td>
                <td class="align-right">${r.count.toLocaleString()}</td>
                <td class="align-right">${displayVal}</td>
            </tr>
        `;
    });

    let overallVal = totalVal;
    if (valueMetric === 'count') overallVal = totalCount;
    else if (valueMetric === 'tenure') overallVal = totalCount > 0 ? (totalVal / totalCount) : 0;

    let displayOverall = overallVal.toLocaleString();
    if (valueMetric === 'amount') {
        displayOverall = `₹${Math.round(overallVal).toLocaleString('en-IN')}`;
    } else if (valueMetric === 'tenure') {
        displayOverall = `${overallVal.toFixed(1)} mo`;
    }

    html += `
            </tbody>
            <tfoot>
                <tr style="font-weight: bold; background-color: var(--color-blue-light); color: var(--color-blue-primary);">
                    <td>Total</td>
                    <td class="align-right">${totalCount.toLocaleString()}</td>
                    <td class="align-right">${displayOverall}</td>
                </tr>
            </tfoot>
        </table>
    `;

    return html;
}

function formatFieldName(field) {
    if (field === 'plName') return 'P&L Home (Department)';
    if (field === 'hrbpLead') return 'HRBP Lead';
    if (field === 'employeeType') return 'Employee Type';
    if (field === 'gender') return 'Gender';
    return field;
}

// ==========================================================================
// TOP EXIT REASONS COMPONENT BY P&L HOME
// ==========================================================================
function populateReasonsPlDropdown() {
    const select = document.getElementById('reasons-pl-select');
    if (!select || select.children.length > 1) return;

    const pls = new Set();
    state.attritionData.forEach(item => {
        if (item.plName) pls.add(item.plName);
    });

    Array.from(pls).sort().forEach(pl => {
        select.innerHTML += `<option value="${pl}">${pl}</option>`;
    });
}

function renderTopExitReasonsList(selectedPl) {
    const voluntaryList = document.getElementById('voluntary-reasons-list');
    const involuntaryList = document.getElementById('involuntary-reasons-list');

    if (!voluntaryList || !involuntaryList) return;

    const exits = state.attritionData.filter(e => selectedPl === 'All' || e.plName === selectedPl);

    const volCounts = {};
    const involCounts = {};
    let totalVol = 0;
    let totalInvol = 0;

    exits.forEach(e => {
        if (e.exitType === 'Voluntary') {
            volCounts[e.reasonForLeaving] = (volCounts[e.reasonForLeaving] || 0) + 1;
            totalVol++;
        } else {
            involCounts[e.reasonForLeaving] = (involCounts[e.reasonForLeaving] || 0) + 1;
            totalInvol++;
        }
    });

    const volSorted = Object.keys(volCounts).map(r => ({
        reason: r,
        count: volCounts[r],
        pct: totalVol > 0 ? Math.round((volCounts[r] / totalVol) * 100) : 0
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    const involSorted = Object.keys(involCounts).map(r => ({
        reason: r,
        count: involCounts[r],
        pct: totalInvol > 0 ? Math.round((involCounts[r] / totalInvol) * 100) : 0
    })).sort((a, b) => b.count - a.count).slice(0, 3);

    voluntaryList.innerHTML = volSorted.length > 0 ? '' : '<p style="font-size:0.813rem;color:var(--color-text-muted);">No voluntary cases recorded.</p>';
    volSorted.forEach(item => {
        voluntaryList.innerHTML += `
            <div class="reason-item">
                <div class="reason-info-row">
                    <span>${item.reason}</span>
                    <span>${item.count} (${item.pct}%)</span>
                </div>
                <div class="reason-bar-container">
                    <div class="reason-bar-fill voluntary" style="width: ${item.pct}%"></div>
                </div>
            </div>
        `;
    });

    involuntaryList.innerHTML = involSorted.length > 0 ? '' : '<p style="font-size:0.813rem;color:var(--color-text-muted);">No involuntary cases recorded.</p>';
    involSorted.forEach(item => {
        involuntaryList.innerHTML += `
            <div class="reason-item">
                <div class="reason-info-row">
                    <span>${item.reason}</span>
                    <span>${item.count} (${item.pct}%)</span>
                </div>
                <div class="reason-bar-container">
                    <div class="reason-bar-fill involuntary" style="width: ${item.pct}%"></div>
                </div>
            </div>
        `;
    });
}

// ==========================================================================
// RECOVERY & SETTLEMENT ANALYSIS BY P&L TABLE
// ==========================================================================
function renderFFRecoveryAnalysisTable() {
    const data = getFilteredFF();
    const recoveryCases = data.filter(d => d.paymentType === 'Recovery');

    const plGroups = {};
    recoveryCases.forEach(item => {
        const pl = item.plName || 'Unassigned';
        if (!plGroups[pl]) {
            plGroups[pl] = {
                plName: pl,
                totalRecovered: 0,
                totalUnrecovered: 0
            };
        }
        const g = plGroups[pl];

        const due = Math.abs(item.ffAmountAA || 0);
        const unpaid = Math.abs(item.finalAmountAE || 0);

        g.totalUnrecovered += unpaid;

        if (item.ffAmountAA !== item.finalAmountAE) {
            g.totalRecovered += Math.max(0, due - unpaid);
        }
    });

    const list = Object.values(plGroups);

    const searched = list.filter(item => {
        const q = state.search.recovery || '';
        if (!q) return true;
        return item.plName.toLowerCase().includes(q);
    });

    const sortState = state.sort.recovery;
    const sorted = [...searched].sort((a, b) => {
        let valA = a[sortState.column];
        let valB = b[sortState.column];

        if (typeof valA === 'string') {
            return sortState.order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return sortState.order === 'asc' ? valA - valB : valB - valA;
        }
    });

    const tbody = document.getElementById('tbody-ff-recovery-analysis');
    if (!tbody) return;
    tbody.innerHTML = '';

    sorted.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${item.plName}</strong></td>
            <td class="align-right" style="color:var(--status-success-text); font-weight:600;">₹${Math.round(item.totalRecovered).toLocaleString('en-IN')}</td>
            <td class="align-right" style="color:var(--status-danger-text); font-weight:600;">₹${Math.round(item.totalUnrecovered).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(row);
    });

    const lbl = document.getElementById('lbl-recovery-table-count');
    if (lbl) {
        lbl.textContent = `Showing ${sorted.length} departments`;
    }
}

// ==========================================================================
// COMPACT INLINE TABLES RENDERING
// ==========================================================================
function renderFFPayoutPLTable() {
    const data = getFilteredFF();
    const plPayouts = {};
    data.forEach(d => {
        if (d.clearanceStatus === 'Settled' && d.paymentType === 'Payable') {
            plPayouts[d.plName] = (plPayouts[d.plName] || 0) + (d.settlementAmount || 0);
        }
    });

    const sortedPls = Object.keys(plPayouts).sort((a, b) => plPayouts[b] - plPayouts[a]);
    const tbody = document.getElementById('tbody-ff-payout-pl');
    if (!tbody) return;
    tbody.innerHTML = '';

    sortedPls.forEach(pl => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${pl}</strong></td>
            <td class="align-right" style="font-weight:600; color:var(--status-success-text);">₹${Math.round(plPayouts[pl]).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderAttritionTypeTable() {
    const exits = getFilteredAttrition();
    const typeCounts = { 'Onroll': 0, 'Consultant': 0, 'Intern': 0 };
    exits.forEach(e => {
        if (typeCounts[e.employeeType] !== undefined) typeCounts[e.employeeType]++;
    });

    const tbody = document.getElementById('tbody-attrition-type');
    if (!tbody) return;
    tbody.innerHTML = '';

    Object.keys(typeCounts).forEach(type => {
        const card = document.createElement('div');
        card.className = 'attrition-type-card';
        card.innerHTML = `
            <span class="type-name">${type}</span>
            <span class="type-value">${typeCounts[type].toLocaleString('en-IN')} <span class="type-label">Exits</span></span>
        `;
        tbody.appendChild(card);
    });
}
