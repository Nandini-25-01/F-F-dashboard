// ==========================================================================
// CORE STATE MANAGEMENT
// ==========================================================================
// Register Datalabels plugin globally if available
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

const state = {
    ffData: [],
    attritionData: [],
    activeTab: 'ff', // 'ff' or 'attrition'
    filters: {
        employeeTypes: ['Onroll', 'Consultant', 'Intern'],
        hrbpLead: ['All'],
        plName: ['All'],
        month: [new Date().toLocaleString('default', { month: 'long' })],
        gender: 'All',
        year: [new Date().getFullYear().toString()],
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
    activeSubTab: 'Voluntary', // 'Voluntary' or 'Involuntary'
    activeReasonsTab: 'voluntary',
    activeEmpExitsTab: 'combined',
    googleSheets: {
        enabled: false,
        method: 'published', // 'published' or 'api'
        apiKey: '',
        spreadsheetId: '',
        range: 'Sheet1',
        publishedUrl: '',
        refreshInterval: 1, // in minutes
        lastRefreshed: null
    }
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
    attritionTenure: null,
    attritionRegion: null,
    attritionGender: null
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
    setupModalTabs();
    loadGoogleSheetsConfig();
    loadData();
    setupGoogleSheetsAutoRefresh();
});

// Load data from localStorage or fetch Excel
async function loadData() {
    loadGoogleSheetsConfig();

    if (state.googleSheets.enabled) {
        updateSyncStatus('Syncing Google Sheet...');
        const success = await syncGoogleSheetsData();
        if (success) {
            removeStartupOverlay();
            return;
        } else {
            console.warn('Google Sheets sync failed at startup, falling back to local storage/demo...');
        }
    }

    const localFF = localStorage.getItem('dash_ff_data');
    const localAttr = localStorage.getItem('dash_attrition_data');
    const localHeadcount = localStorage.getItem('dash_active_headcount');
    const localStatus = localStorage.getItem('dash_sync_status');

    if (localFF && localAttr && localHeadcount) {
        try {
            state.ffData = JSON.parse(localFF);
            state.attritionData = JSON.parse(localAttr);
            state.activeHeadcount = JSON.parse(localHeadcount);

            // Force refresh from Excel if cached data doesn't have the new 'region' field
            const hasRegion = state.attritionData.length > 0 && state.attritionData[0].hasOwnProperty('region') && state.attritionData[0].region;
            if (!hasRegion) {
                console.log("Cached data is outdated (missing region/grade), refreshing from Excel...");
                localStorage.removeItem('dash_ff_data');
                localStorage.removeItem('dash_attrition_data');
                localStorage.removeItem('dash_active_headcount');
                await fetchExcelData();
                return;
            }

            updateSyncStatus(localStatus || 'Loaded from local storage');
            populateDropdownFilters();
            updateUI();
            removeStartupOverlay();
        } catch (e) {
            console.error("Error loading cached data, clearing...", e);
            localStorage.clear();
            await fetchExcelData();
        }
    } else {
        await fetchExcelData();
    }
}

// Fetch Excel Spreadsheet directly
async function fetchExcelData() {
    updateSyncStatus('Fetching spreadsheet...');
    try {
        const response = await fetch('Dashboard data.xlsx');
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.statusText} (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        processExcelBuffer(arrayBuffer, 'Dashboard data.xlsx');
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
        setDefaultFiltersToLatest();
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

function normalizeGrade(g) {
    if (!g) return 'Grade 1';
    const clean = String(g).trim().toUpperCase();
    if (clean.startsWith('1') || clean === '1') return 'Grade 1';
    if (clean.startsWith('2') || clean === '2') return 'Grade 2';
    if (clean.startsWith('3') || clean === '3') return 'Grade 3';
    if (clean.startsWith('4') || clean === '4') return 'Grade 4';
    if (clean.startsWith('5') || clean === '5') return 'Grade 5';
    if (clean.startsWith('6') || clean.startsWith('7') || clean.startsWith('8')) return 'Grade 6+';
    if (clean.includes('CONSULTANT')) return 'Consultant';
    if (clean.includes('INTERN')) return 'Intern';
    return g; // fallback
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
        const gender = String(row['Gender'] || '').trim() || generateGender(empCode);

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
        if (hrbpLead === 'nan' || hrbpLead === '') {
            hrbpLead = 'Unassigned';
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

        const monthName = dol ? dol.toLocaleString('default', { month: 'long' }) : '';

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

        // Parse Separation Reason
        let reason = String(row['Separation Reason'] || '').trim();
        if (!reason || reason.toLowerCase() === 'nan') {
            if (exitType === 'Involuntary') {
                const reasons = ['Performance', 'Restructuring', 'Policy Violation'];
                reason = reasons[getHashValue(empCode + "_invol_reason", reasons.length)];
            } else {
                const reasons = ['Better Opportunity', 'Career Growth', 'Personal Reasons', 'Higher Studies', 'Compensation', 'Contract Completion'];
                reason = reasons[getHashValue(empCode + "_vol_reason", reasons.length)];
            }
        }

        const isRegrettable = (empType === 'Onroll') && (tenureMonths > 12) && (exitType === 'Voluntary');
        const isDropout = tenureMonths < 3; // less than 90 days tenure

        // Parse Region and Grade
        const rawRegion = String(row['Region'] || row['Zone'] || '').trim();
        const region = rawRegion || ['North', 'South', 'East', 'West'][getHashValue(empCode + "_region", 4)];

        const rawGrade = String(row['Grade'] || '').trim();
        let grade = rawGrade;
        if (!grade || grade.toLowerCase() === 'nan') {
            grade = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'][getHashValue(empCode + "_grade", 5)];
        }
        grade = normalizeGrade(grade);

        ffArr.push({
            employeeId: empCode,
            name: name,
            gender: gender,
            employeeType: empType,
            hrbpLead: hrbpLead,
            plName: plName,
            month: monthName,
            lastWorkingDay: dol ? formatDateString(dol) : '',
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
            },
            region: region,
            grade: grade
        });

        attritionArr.push({
            employeeId: empCode,
            name: name,
            gender: gender,
            employeeType: empType,
            hrbpLead: hrbpLead,
            plName: plName,
            month: monthName,
            exitDate: dol ? formatDateString(dol) : '',
            exitType: exitType,
            reasonForLeaving: reason,
            tenureMonths: tenureMonths,
            isRegrettable: isRegrettable,
            isDropout: isDropout,
            region: region,
            grade: grade
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
                The browser blocked loading <code>Dashboard data.xlsx</code> automatically (due to CORS policy on local files). Please drag & drop or select the file from your local disk to start.
            </p>
            <div id="startup-drop-zone" class="startup-drop-zone">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span class="startup-drop-zone-text">Drag and drop 'Dashboard data.xlsx' here</span>
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
    // Setup custom dropdowns open/close toggles
    const dropdowns = [
        { id: 'dropdown-employee-type', btnId: 'btn-filter-type' },
        { id: 'dropdown-hrbp-lead', btnId: 'btn-filter-hrbp' },
        { id: 'dropdown-pl-name', btnId: 'btn-filter-pl' },
        { id: 'dropdown-month', btnId: 'btn-filter-month' },
        { id: 'dropdown-year', btnId: 'btn-filter-year' }
    ];

    dropdowns.forEach(dd => {
        const wrapper = document.getElementById(dd.id);
        const trigger = document.getElementById(dd.btnId);
        if (!wrapper || !trigger) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other dropdowns
            dropdowns.forEach(other => {
                if (other.id !== dd.id) {
                    const el = document.getElementById(other.id);
                    if (el) el.classList.remove('open');
                }
            });
            wrapper.classList.toggle('open');
        });

        const content = wrapper.querySelector('.dropdown-content');
        if (content) {
            content.addEventListener('click', (e) => e.stopPropagation());
        }
    });

    document.addEventListener('click', () => {
        dropdowns.forEach(dd => {
            const el = document.getElementById(dd.id);
            if (el) el.classList.remove('open');
        });
    });

    // Employee Type checkboxes change handler
    const customDropdown = document.getElementById('dropdown-employee-type');
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

    // HRBP Lead filter change listener is now handled by checkbox change events

    // Gender change handler
    document.getElementById('select-gender').addEventListener('change', (e) => {
        state.filters.gender = e.target.value;
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
        state.filters.hrbpLead = ['All'];
        state.filters.plName = ['All'];
        state.filters.month = ['All'];
        state.filters.gender = 'All';
        state.filters.year = ['All'];
        state.filters.momMonth = 'All';
        state.filters.momYear = 'All';

        checkboxes.forEach(c => c.checked = true);
        updateEmployeeTypeTriggerLabel();

        // Repopulate dynamically
        populateDropdownFilters();

        document.getElementById('select-gender').value = 'All';
        if (selectMoMMonthEl) selectMoMMonthEl.value = 'All';
        if (selectMoMYearEl) selectMoMYearEl.value = 'All';

        btnReset.classList.add('hidden');
        resetPagination();
        updateUI();
    });

    // Table Searches
    const searchMomEl = document.getElementById('search-mom-table');
    if (searchMomEl) {
        searchMomEl.addEventListener('input', (e) => {
            state.search.mom = e.target.value.toLowerCase().trim();
            state.pagination.mom.page = 1;
            renderMoMDepartmentTable();
        });
    }

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
    
    const btnDownloadPivot = document.getElementById('btn-download-pivot-excel');
    if (btnDownloadPivot) {
        btnDownloadPivot.addEventListener('click', downloadPivotExcel);
    }

    // Pivot dropdown change listeners
    document.getElementById('pivot-row-field').addEventListener('change', rebuildPivotTable);
    document.getElementById('pivot-value-metric').addEventListener('change', rebuildPivotTable);

    // Top exit reasons P&L dropdown change listener
    document.getElementById('reasons-pl-select').addEventListener('change', (e) => {
        renderTopExitReasonsList(e.target.value);
    });

    // Exit reasons tab listeners
    const reasonsTabBtns = document.querySelectorAll('.reasons-tab-btn');
    reasonsTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            reasonsTabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--color-text-muted)';
                b.style.fontWeight = '500';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--color-blue-light)';
            btn.style.color = 'var(--color-blue-accent)';
            btn.style.fontWeight = '600';
            state.activeReasonsTab = btn.getAttribute('data-tab');
            renderTopExitReasonsList(document.getElementById('reasons-pl-select').value);
        });
    });

    // Employee Exits tab listeners (Combined, Voluntary Only, Involuntary Only)
    const empExitsTabBtns = document.querySelectorAll('.emp-exits-tab-btn');
    empExitsTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            empExitsTabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--color-text-muted)';
                b.style.fontWeight = '500';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--color-blue-light)';
            btn.style.color = 'var(--color-blue-accent)';
            btn.style.fontWeight = '600';
            state.activeEmpExitsTab = btn.getAttribute('data-type');
            renderEmployeeTypeMonthlyTable();
        });
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

    // Populate Google Sheets UI when opening Sync Modal
    btnSync.addEventListener('click', () => {
        populateSheetsConfigUI();
    });

    // Google Sheets Method Toggle listener
    document.getElementById('sheet-sync-method').addEventListener('change', (e) => {
        toggleSheetMethodFields(e.target.value);
    });

    // Save & Sync Config button listener
    document.getElementById('btn-save-sheets-config').addEventListener('click', () => {
        saveAndSyncSheetsConfig();
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
        const hrbpMatch = state.filters.hrbpLead.includes('All') || state.filters.hrbpLead.includes(item.hrbpLead);
        const plMatch = state.filters.plName.includes('All') || state.filters.plName.includes(item.plName);
        const monthMatch = state.filters.month.includes('All') || state.filters.month.includes(item.month);
        const genderMatch = state.filters.gender === 'All' || item.gender === state.filters.gender;
        const yearMatch = state.filters.year.includes('All') || (item.lastWorkingDay && state.filters.year.some(y => item.lastWorkingDay.startsWith(y)));
        return typeMatch && hrbpMatch && plMatch && monthMatch && genderMatch && yearMatch;
    });
}

function getFilteredFFIgnoringMonth() {
    return state.ffData.filter(item => {
        if (item.clearanceStatus === 'Admin Hold' || item.clearanceStatus === 'Disputed') return false;
        const typeMatch = state.filters.employeeTypes.includes(item.employeeType);
        const hrbpMatch = state.filters.hrbpLead.includes('All') || state.filters.hrbpLead.includes(item.hrbpLead);
        const plMatch = state.filters.plName.includes('All') || state.filters.plName.includes(item.plName);
        const genderMatch = state.filters.gender === 'All' || item.gender === state.filters.gender;
        const yearMatch = state.filters.year.includes('All') || (item.lastWorkingDay && state.filters.year.some(y => item.lastWorkingDay.startsWith(y)));
        return typeMatch && hrbpMatch && plMatch && genderMatch && yearMatch;
    });
}

function getFilteredAttrition() {
    return state.attritionData.filter(item => {
        const typeMatch = state.filters.employeeTypes.includes(item.employeeType);
        const hrbpMatch = state.filters.hrbpLead.includes('All') || state.filters.hrbpLead.includes(item.hrbpLead);
        const plMatch = state.filters.plName.includes('All') || state.filters.plName.includes(item.plName);
        const monthMatch = state.filters.month.includes('All') || state.filters.month.includes(item.month);
        const genderMatch = state.filters.gender === 'All' || item.gender === state.filters.gender;
        const yearMatch = state.filters.year.includes('All') || (item.exitDate && state.filters.year.some(y => item.exitDate.startsWith(y)));
        return typeMatch && hrbpMatch && plMatch && monthMatch && genderMatch && yearMatch;
    });
}

function getFilteredAttritionIgnoringMonth() {
    return state.attritionData.filter(item => {
        const typeMatch = state.filters.employeeTypes.includes(item.employeeType);
        const hrbpMatch = state.filters.hrbpLead.includes('All') || state.filters.hrbpLead.includes(item.hrbpLead);
        const plMatch = state.filters.plName.includes('All') || state.filters.plName.includes(item.plName);
        const genderMatch = state.filters.gender === 'All' || item.gender === state.filters.gender;
        const yearMatch = state.filters.year.includes('All') || (item.exitDate && state.filters.year.some(y => item.exitDate.startsWith(y)));
        return typeMatch && hrbpMatch && plMatch && genderMatch && yearMatch;
    });
}

// ==========================================================================
// FILTER DROPDOWNS POPULATION
// ==========================================================================
// Helper to default filters to the latest year and month present in the dataset
function setDefaultFiltersToLatest() {
    const years = new Set();
    state.ffData.forEach(item => {
        if (item.lastWorkingDay) {
            const yr = item.lastWorkingDay.substring(0, 4);
            if (yr && /^\d{4}$/.test(yr)) years.add(yr);
        }
    });
    state.attritionData.forEach(item => {
        if (item.exitDate) {
            const yr = item.exitDate.substring(0, 4);
            if (yr && /^\d{4}$/.test(yr)) years.add(yr);
        }
    });

    if (years.size === 0) return;

    // Find latest year
    const sortedYears = Array.from(years).sort();
    const latestYear = sortedYears[sortedYears.length - 1];

    // Find latest month in that year
    const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthsInLatestYear = new Set();

    state.ffData.forEach(item => {
        if (item.lastWorkingDay && item.lastWorkingDay.startsWith(latestYear) && item.month) {
            monthsInLatestYear.add(item.month);
        }
    });
    state.attritionData.forEach(item => {
        if (item.exitDate && item.exitDate.startsWith(latestYear) && item.month) {
            monthsInLatestYear.add(item.month);
        }
    });

    let latestMonth = 'All';
    if (monthsInLatestYear.size > 0) {
        const sortedMonths = Array.from(monthsInLatestYear).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
        latestMonth = sortedMonths[sortedMonths.length - 1];
    }

    state.filters.year = [latestYear];
    state.filters.month = [latestMonth];
}

function populateDropdownFilters() {
    // HRBP Leads select dropdown is replaced by checkbox custom dropdown

    const selectMoMMonth = document.getElementById('select-mom-month');
    const selectMoMYear = document.getElementById('select-mom-year');

    const prevMoMMonth = selectMoMMonth ? selectMoMMonth.value : 'All';
    const prevMoMYear = selectMoMYear ? selectMoMYear.value : 'All';

    const leads = new Set();
    const pls = new Set();
    const months = new Set();
    const years = new Set();

    state.ffData.forEach(item => {
        if (item.hrbpLead) leads.add(item.hrbpLead);
        if (item.plName) pls.add(item.plName);
        if (item.month) months.add(item.month);
        if (item.lastWorkingDay) {
            const yr = item.lastWorkingDay.substring(0, 4);
            if (yr && /^\d{4}$/.test(yr)) years.add(yr);
        }
    });

    state.attritionData.forEach(item => {
        if (item.hrbpLead) leads.add(item.hrbpLead);
        if (item.plName) pls.add(item.plName);
        if (item.month) months.add(item.month);
        if (item.exitDate) {
            const yr = item.exitDate.substring(0, 4);
            if (yr && /^\d{4}$/.test(yr)) years.add(yr);
        }
    });

    if (years.size === 0) {
        years.add('2025');
        years.add('2026');
    }

    // --- Dynamic Checkbox lists ---

    // 0. HRBP Lead dropdown
    const hrbpContent = document.getElementById('dropdown-hrbp-content');
    if (hrbpContent) {
        hrbpContent.innerHTML = '';
        const allChecked = state.filters.hrbpLead.includes('All') ? 'checked' : '';
        hrbpContent.innerHTML += `
            <label class="dropdown-option">
                <input type="checkbox" id="chk-hrbp-all" value="All" ${allChecked}> <em>All Leads</em>
            </label>
        `;

        // Only include actual hrbp leads (filtering out Unassigned if not needed, but keep sorted unique leads)
        const sortedLeads = Array.from(leads).filter(l => l !== 'Unassigned').sort();

        sortedLeads.forEach(lead => {
            const checked = (state.filters.hrbpLead.includes('All') || state.filters.hrbpLead.includes(lead)) ? 'checked' : '';
            hrbpContent.innerHTML += `
                <label class="dropdown-option">
                    <input type="checkbox" name="chk-hrbp" value="${lead}" ${checked}> ${lead}
                </label>
            `;
        });

        const allCb = document.getElementById('chk-hrbp-all');
        const itemCbs = hrbpContent.querySelectorAll('input[name="chk-hrbp"]');

        allCb.addEventListener('change', () => {
            if (allCb.checked) {
                itemCbs.forEach(cb => cb.checked = true);
                state.filters.hrbpLead = ['All'];
            } else {
                itemCbs.forEach(cb => cb.checked = false);
                state.filters.hrbpLead = [];
            }
            updateHRBPTriggerLabel();
            checkFilterState();
            resetPagination();
            updateUI();
        });

        itemCbs.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!cb.checked) {
                    allCb.checked = false;
                }
                const active = [];
                itemCbs.forEach(c => {
                    if (c.checked) active.push(c.value);
                });
                if (active.length === itemCbs.length) {
                    allCb.checked = true;
                    state.filters.hrbpLead = ['All'];
                } else {
                    state.filters.hrbpLead = active;
                }
                updateHRBPTriggerLabel();
                checkFilterState();
                resetPagination();
                updateUI();
            });
        });
        updateHRBPTriggerLabel();
    }

    // 1. P&L Name (Departments)
    const plContent = document.getElementById('dropdown-pl-content');
    if (plContent) {
        plContent.innerHTML = '';
        const allChecked = state.filters.plName.includes('All') ? 'checked' : '';
        plContent.innerHTML += `
            <label class="dropdown-option">
                <input type="checkbox" id="chk-pl-all" value="All" ${allChecked}> <em>All P&L</em>
            </label>
        `;
        Array.from(pls).sort().forEach(pl => {
            const checked = (state.filters.plName.includes('All') || state.filters.plName.includes(pl)) ? 'checked' : '';
            plContent.innerHTML += `
                <label class="dropdown-option">
                    <input type="checkbox" name="chk-pl" value="${pl}" ${checked}> ${pl}
                </label>
            `;
        });

        const allCb = document.getElementById('chk-pl-all');
        const itemCbs = plContent.querySelectorAll('input[name="chk-pl"]');

        allCb.addEventListener('change', () => {
            if (allCb.checked) {
                itemCbs.forEach(cb => cb.checked = true);
                state.filters.plName = ['All'];
            } else {
                itemCbs.forEach(cb => cb.checked = false);
                state.filters.plName = [];
            }
            updatePLTriggerLabel();
            checkFilterState();
            resetPagination();
            updateUI();
        });

        itemCbs.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!cb.checked) {
                    allCb.checked = false;
                }
                const active = [];
                itemCbs.forEach(c => {
                    if (c.checked) active.push(c.value);
                });
                if (active.length === itemCbs.length) {
                    allCb.checked = true;
                    state.filters.plName = ['All'];
                } else {
                    state.filters.plName = active;
                }
                updatePLTriggerLabel();
                checkFilterState();
                resetPagination();
                updateUI();
            });
        });
        updatePLTriggerLabel();
    }

    // 2. Year dropdown
    const yearContent = document.getElementById('dropdown-year-content');
    const sortedYears = Array.from(years).sort();
    if (yearContent) {
        yearContent.innerHTML = '';
        const allChecked = state.filters.year.includes('All') ? 'checked' : '';
        yearContent.innerHTML += `
            <label class="dropdown-option">
                <input type="checkbox" id="chk-year-all" value="All" ${allChecked}> <em>All Years</em>
            </label>
        `;
        sortedYears.forEach(y => {
            const checked = (state.filters.year.includes('All') || state.filters.year.includes(y)) ? 'checked' : '';
            yearContent.innerHTML += `
                <label class="dropdown-option">
                    <input type="checkbox" name="chk-year" value="${y}" ${checked}> ${y}
                </label>
            `;
        });

        const allCb = document.getElementById('chk-year-all');
        const itemCbs = yearContent.querySelectorAll('input[name="chk-year"]');

        allCb.addEventListener('change', () => {
            if (allCb.checked) {
                itemCbs.forEach(cb => cb.checked = true);
                state.filters.year = ['All'];
            } else {
                itemCbs.forEach(cb => cb.checked = false);
                state.filters.year = [];
            }
            populateDropdownFilters(); // dynamically filters month dropdown list!
            updateYearTriggerLabel();
            checkFilterState();
            resetPagination();
            updateUI();
        });

        itemCbs.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!cb.checked) {
                    allCb.checked = false;
                }
                const active = [];
                itemCbs.forEach(c => {
                    if (c.checked) active.push(c.value);
                });
                if (active.length === itemCbs.length) {
                    allCb.checked = true;
                    state.filters.year = ['All'];
                } else {
                    state.filters.year = active;
                }
                populateDropdownFilters(); // dynamically filters month dropdown list!
                updateYearTriggerLabel();
                checkFilterState();
                resetPagination();
                updateUI();
            });
        });
        updateYearTriggerLabel();
    }

    // 3. Month dropdown (filtered by selected year)
    const monthContent = document.getElementById('dropdown-month-content');
    const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    if (monthContent) {
        monthContent.innerHTML = '';

        // Hide months after June if ONLY 2026 is selected
        const is2026OnlySelected = state.filters.year.length === 1 && state.filters.year.includes(String(new Date().getFullYear()));
        let displayMonths = Array.from(months);
        if (is2026OnlySelected) {
            const maxMonthIdx = new Date().getMonth(); // 5 for June
            displayMonths = displayMonths.filter(m => {
                const idx = monthOrder.indexOf(m);
                return idx !== -1 && idx <= maxMonthIdx;
            });
        }

        const sortedMonths = displayMonths.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
        const allChecked = state.filters.month.includes('All') ? 'checked' : '';
        monthContent.innerHTML += `
            <label class="dropdown-option">
                <input type="checkbox" id="chk-month-all" value="All" ${allChecked}> <em>All Months</em>
            </label>
        `;
        sortedMonths.forEach(m => {
            const checked = (state.filters.month.includes('All') || state.filters.month.includes(m)) ? 'checked' : '';
            monthContent.innerHTML += `
                <label class="dropdown-option">
                    <input type="checkbox" name="chk-month" value="${m}" ${checked}> ${m}
                </label>
            `;
        });

        const allCb = document.getElementById('chk-month-all');
        const itemCbs = monthContent.querySelectorAll('input[name="chk-month"]');

        allCb.addEventListener('change', () => {
            if (allCb.checked) {
                itemCbs.forEach(cb => cb.checked = true);
                state.filters.month = ['All'];
            } else {
                itemCbs.forEach(cb => cb.checked = false);
                state.filters.month = [];
            }
            updateMonthTriggerLabel();
            checkFilterState();
            resetPagination();
            updateUI();
        });

        itemCbs.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!cb.checked) {
                    allCb.checked = false;
                }
                const active = [];
                itemCbs.forEach(c => {
                    if (c.checked) active.push(c.value);
                });
                if (active.length === itemCbs.length) {
                    allCb.checked = true;
                    state.filters.month = ['All'];
                } else {
                    state.filters.month = active;
                }
                updateMonthTriggerLabel();
                checkFilterState();
                resetPagination();
                updateUI();
            });
        });
        updateMonthTriggerLabel();
    }

    // MoM select options
    if (selectMoMMonth) {
        const sortedMonthsAll = Array.from(months).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
        selectMoMMonth.innerHTML = '<option value="All">All Months</option>';
        sortedMonthsAll.forEach(m => {
            selectMoMMonth.innerHTML += `<option value="${m}">${m}</option>`;
        });
        if (sortedMonthsAll.includes(prevMoMMonth)) selectMoMMonth.value = prevMoMMonth;
    }

    if (selectMoMYear) {
        selectMoMYear.innerHTML = '<option value="All">All Years</option>';
        sortedYears.forEach(y => {
            selectMoMYear.innerHTML += `<option value="${y}">${y}</option>`;
        });
        if (sortedYears.includes(prevMoMYear)) selectMoMYear.value = prevMoMYear;
    }
}

// Trigger text helpers for multi-select checklists
function updateMultiselectTriggerLabel(triggerId, selectedList, allCount, defaultLabel) {
    const trigger = document.getElementById(triggerId);
    if (!trigger) return;
    if (selectedList.includes('All') || selectedList.length === allCount) {
        trigger.textContent = defaultLabel;
    } else if (selectedList.length === 0) {
        trigger.textContent = 'None selected';
    } else {
        // Show count if list is long, else list names
        if (selectedList.length > 2) {
            trigger.textContent = `${selectedList.length} Selected`;
        } else {
            trigger.textContent = selectedList.join(', ');
        }
    }
}

function updatePLTriggerLabel() {
    const count = document.querySelectorAll('input[name="chk-pl"]').length;
    updateMultiselectTriggerLabel('btn-filter-pl', state.filters.plName, count, 'All P&L');
}

function updateHRBPTriggerLabel() {
    const count = document.querySelectorAll('input[name="chk-hrbp"]').length;
    updateMultiselectTriggerLabel('btn-filter-hrbp', state.filters.hrbpLead, count, 'All Leads');
}

function updateMonthTriggerLabel() {
    const count = document.querySelectorAll('input[name="chk-month"]').length;
    updateMultiselectTriggerLabel('btn-filter-month', state.filters.month, count, 'All Months');
}

function updateYearTriggerLabel() {
    const count = document.querySelectorAll('input[name="chk-year"]').length;
    updateMultiselectTriggerLabel('btn-filter-year', state.filters.year, count, 'All Years');
}

// ==========================================================================
// RENDER UI & DATA PIPELINE
// ==========================================================================
function updateUI() {
    calculateFFMetrics();
    calculateAttritionMetrics();

    renderFFPayoutPLTable();
    renderAttritionTypeTable();
    renderMonthlyAttritionRateTable();
    renderEmployeeTypeMonthlyTable();
    renderDemographicsBreakdown();
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
    const total = data.length;
    const pending = data.filter(d => d.clearanceStatus === 'In Progress').length;
    const settled = data.filter(d => d.clearanceStatus === 'Settled').length;

    // Filtered Payable vs Recovery sums
    const payablePayout = data
        .filter(d => d.paymentType === 'Payable')
        .reduce((sum, item) => sum + (item.settlementAmount || 0), 0);
    const recoveryAmount = data
        .filter(d => d.paymentType === 'Recovery')
        .reduce((sum, item) => sum + (item.settlementAmount || 0), 0);

    // Bind to cards
    const elFfTotal = document.getElementById('kpi-ff-total');
    if (elFfTotal) elFfTotal.textContent = total.toLocaleString();

    const elSummaryTotal = document.getElementById('lbl-summary-total');
    if (elSummaryTotal) elSummaryTotal.textContent = total.toLocaleString();

    const elSummarySettled = document.getElementById('lbl-summary-settled');
    if (elSummarySettled) elSummarySettled.textContent = settled.toLocaleString();

    const elSummaryPending = document.getElementById('lbl-summary-pending');
    if (elSummaryPending) elSummaryPending.textContent = pending.toLocaleString();

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
}

function calculateAttritionMetrics() {
    const exits = getFilteredAttrition();
    const totalExits = exits.length;

    // Headcount Map
    let filteredHeadcount = 0;
    if (state.filters.plName.includes('All')) {
        filteredHeadcount = Object.values(state.activeHeadcount).reduce((sum, c) => sum + c, 0);
    } else {
        state.filters.plName.forEach(pl => {
            filteredHeadcount += (state.activeHeadcount[pl] || 0);
        });
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
    if (elDropout) elDropout.textContent = `${dropouts} (${dropoutRate}%)`;
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
function renderMonthlyAttritionRateTable() {
    const exits = getFilteredAttritionIgnoringMonth();

    // Group exits by YYYY-MM
    const monthlyExits = {};
    exits.forEach(e => {
        if (!e.exitDate) return;
        const yyyymm = e.exitDate.substring(0, 7); // "YYYY-MM"
        monthlyExits[yyyymm] = (monthlyExits[yyyymm] || 0) + 1;
    });

    // Sort the year-months chronologically
    const sortedYM = Object.keys(monthlyExits).sort();

    // Get current filtered starting headcount (active headcount TODAY)
    let finalHeadcount = 0;
    if (state.filters.plName.includes('All')) {
        finalHeadcount = Object.values(state.activeHeadcount).reduce((sum, c) => sum + c, 0);
    } else {
        state.filters.plName.forEach(pl => {
            finalHeadcount += (state.activeHeadcount[pl] || 0);
        });
    }

    // Reconstruction: calculate starting headcount for each month working backwards
    const tableRows = [];
    let currentHeadcount = finalHeadcount;

    for (let i = sortedYM.length - 1; i >= 0; i--) {
        const ym = sortedYM[i];
        const exitCount = monthlyExits[ym] || 0;
        const startHeadcount = currentHeadcount + exitCount;

        const [year, monthNum] = ym.split('-');
        const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
        const monthLabel = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

        const rate = startHeadcount > 0 ? ((exitCount / startHeadcount) * 100).toFixed(1) : '0.0';

        tableRows.unshift({
            monthLabel,
            startHeadcount,
            exitCount,
            rate
        });

        currentHeadcount = startHeadcount;
    }

    const tbody = document.getElementById('tbody-attrition-monthly-rate');
    if (!tbody) return;
    tbody.innerHTML = '';

    tableRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${row.monthLabel}</strong></td>
            <td class="align-right">${row.startHeadcount.toLocaleString()}</td>
            <td class="align-right">${row.exitCount.toLocaleString()}</td>
            <td class="align-right" style="font-weight: 600; color: var(--color-blue-primary);">${row.rate}%</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderEmployeeTypeMonthlyTable() {
    const exits = getFilteredAttritionIgnoringMonth();

    let filteredExits = exits;
    if (state.activeEmpExitsTab === 'voluntary') {
        filteredExits = exits.filter(e => e.exitType === 'Voluntary');
    } else if (state.activeEmpExitsTab === 'involuntary') {
        filteredExits = exits.filter(e => e.exitType === 'Involuntary');
    }

    const typeMonthCounts = {
        'Onroll': {},
        'Consultant': {},
        'Intern': {}
    };

    const allMonthsSet = new Set();
    filteredExits.forEach(e => {
        if (!e.exitDate) return;
        const ym = e.exitDate.substring(0, 7);
        allMonthsSet.add(ym);
        const type = e.employeeType;
        if (typeMonthCounts[type] !== undefined) {
            typeMonthCounts[type][ym] = (typeMonthCounts[type][ym] || 0) + 1;
        }
    });

    const sortedMonths = Array.from(allMonthsSet).sort();

    const theadRow = document.getElementById('thead-row-emp-type-exits');
    if (theadRow) {
        theadRow.innerHTML = '<th>Employee Type</th>';
        sortedMonths.forEach(ym => {
            const [year, monthNum] = ym.split('-');
            const dateObj = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
            const monthLabel = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
            theadRow.innerHTML += `<th class="align-right">${monthLabel}</th>`;
        });
        theadRow.innerHTML += '<th class="align-right">Total</th>';
    }

    const tbody = document.getElementById('tbody-emp-type-monthly-exits');
    if (!tbody) return;
    tbody.innerHTML = '';

    const types = ['Onroll', 'Consultant', 'Intern'];
    const colTotals = {};
    sortedMonths.forEach(ym => { colTotals[ym] = 0; });
    let grandTotal = 0;

    types.forEach(type => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${type}</strong></td>`;
        let rowTotal = 0;

        sortedMonths.forEach(ym => {
            const count = typeMonthCounts[type][ym] || 0;
            tr.innerHTML += `<td class="align-right">${count.toLocaleString()}</td>`;
            rowTotal += count;
            colTotals[ym] += count;
        });

        tr.innerHTML += `<td class="align-right" style="font-weight:600;">${rowTotal.toLocaleString()}</td>`;
        grandTotal += rowTotal;
        tbody.appendChild(tr);
    });

    const totalTr = document.createElement('tr');
    totalTr.style.borderTop = '2px solid var(--color-border)';
    totalTr.innerHTML = '<td><strong>Total Exits</strong></td>';

    sortedMonths.forEach(ym => {
        totalTr.innerHTML += `<td class="align-right" style="font-weight:600;">${colTotals[ym].toLocaleString()}</td>`;
    });
    totalTr.innerHTML += `<td class="align-right" style="font-weight:700; color:var(--color-blue-primary);">${grandTotal.toLocaleString()}</td>`;
    tbody.appendChild(totalTr);
}

function renderDemographicsBreakdown() {
    const exits = getFilteredAttrition();
    const totalExits = exits.length;

    // 1. Region doughnut
    const regionCounts = { 'North': 0, 'South': 0, 'East': 0, 'West': 0 };
    exits.forEach(e => {
        const reg = e.region || 'Unassigned';
        if (regionCounts[reg] !== undefined) {
            regionCounts[reg]++;
        } else {
            regionCounts[reg] = (regionCounts[reg] || 0) + 1;
        }
    });

    const regionData = Object.values(regionCounts);
    const regionLabels = Object.keys(regionCounts).map(k => {
        const count = regionCounts[k];
        const pct = totalExits > 0 ? ((count / totalExits) * 100).toFixed(1) : '0.0';
        return `${k}: ${count} (${pct}%)`;
    });

    const ctxRegion = document.getElementById('chart-attrition-region').getContext('2d');
    if (charts.attritionRegion) charts.attritionRegion.destroy();
    charts.attritionRegion = new Chart(ctxRegion, {
        type: 'doughnut',
        data: {
            labels: regionLabels,
            datasets: [{
                data: regionData,
                backgroundColor: ['#FF6F61', '#1A1A1A', '#AEAEAE', '#4A90E2'],
                borderWidth: 1.5,
                borderColor: '#ffffff'
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '70%'
        }
    });

    // 2. Gender doughnut
    const genderCounts = {};
    exits.forEach(e => {
        const g = e.gender || 'Unassigned';
        genderCounts[g] = (genderCounts[g] || 0) + 1;
    });

    const genderLabels = Object.keys(genderCounts).map(k => {
        const count = genderCounts[k];
        const pct = totalExits > 0 ? ((count / totalExits) * 100).toFixed(1) : '0.0';
        return `${k}: ${count} (${pct}%)`;
    });

    const ctxGender = document.getElementById('chart-attrition-gender').getContext('2d');
    if (charts.attritionGender) charts.attritionGender.destroy();
    charts.attritionGender = new Chart(ctxGender, {
        type: 'doughnut',
        data: {
            labels: genderLabels,
            datasets: [{
                data: Object.values(genderCounts),
                backgroundColor: ['#FF6F61', '#1A1A1A', '#AEAEAE', '#4A90E2'],
                borderWidth: 1.5,
                borderColor: '#ffffff'
            }]
        },
        options: {
            ...commonChartOptions,
            cutout: '70%'
        }
    });

    // 3. Grade table
    const gradeCounts = {};
    exits.forEach(e => {
        const g = e.grade || 'Unassigned';
        gradeCounts[g] = (gradeCounts[g] || 0) + 1;
    });
    const gradeList = Object.keys(gradeCounts).map(g => ({
        grade: g,
        count: gradeCounts[g],
        pct: totalExits > 0 ? ((gradeCounts[g] / totalExits) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.count - a.count);

    const tbodyGrade = document.getElementById('tbody-attrition-grade');
    if (tbodyGrade) {
        tbodyGrade.innerHTML = '';
        gradeList.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item.grade}</strong></td>
                <td class="align-right">${item.count}</td>
                <td class="align-right">${item.pct}%</td>
            `;
            tbodyGrade.appendChild(row);
        });
    }

    // 4. Top reasons table
    const reasonCounts = {};
    exits.forEach(e => {
        const r = e.reasonForLeaving || 'Unassigned';
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    });
    const reasonList = Object.keys(reasonCounts).map(r => ({
        reason: r,
        count: reasonCounts[r],
        pct: totalExits > 0 ? ((reasonCounts[r] / totalExits) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.count - a.count);

    const tbodyReasons = document.getElementById('tbody-attrition-reasons-total');
    if (tbodyReasons) {
        tbodyReasons.innerHTML = '';
        reasonList.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item.reason}</strong></td>
                <td class="align-right">${item.count}</td>
                <td class="align-right">${item.pct}%</td>
            `;
            tbodyReasons.appendChild(row);
        });
    }
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
        },
        datalabels: {
            display: false // off by default for generic charts
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

    // 2. Ageing Buckets (Double Bar Graph Month-wise)
    const ffIgnoringMonth = getFilteredFFIgnoringMonth();
    const selectedMonths = state.filters.month;
    const isAllMonths = selectedMonths.includes('All');

    // Filter ageing buckets trend to show ONLY the selected month(s)
    const displayItems = ffIgnoringMonth.filter(item => {
        return isAllMonths || selectedMonths.includes(item.month);
    });

    const monthOrder = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthGroups = {};
    displayItems.forEach(item => {
        const m = item.month;
        if (!m) return;
        if (!monthGroups[m]) {
            monthGroups[m] = {
                month: m,
                count1to2: 0,
                count2plus: 0,
                total: 0
            };
        }
        monthGroups[m].total++;
        if (item.ageing <= 2) {
            monthGroups[m].count1to2++;
        } else {
            monthGroups[m].count2plus++;
        }
    });

    const sortedMonths = Object.keys(monthGroups).sort((a, b) => {
        return monthOrder.indexOf(a) - monthOrder.indexOf(b);
    });

    const count1to2Data = sortedMonths.map(m => monthGroups[m].count1to2);
    const count2plusData = sortedMonths.map(m => monthGroups[m].count2plus);

    const ctxBuckets = document.getElementById('chart-ff-buckets').getContext('2d');
    if (charts.ffBuckets) charts.ffBuckets.destroy();

    charts.ffBuckets = new Chart(ctxBuckets, {
        type: 'bar',
        data: {
            labels: sortedMonths,
            datasets: [
                {
                    label: '1-2 days',
                    data: count1to2Data,
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    borderRadius: 4
                },
                {
                    label: '2+ days',
                    data: count2plusData,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: { stacked: false, grid: { display: false } },
                y: { stacked: false, grid: { color: '#f1f5f9' } }
            },
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'top',
                    color: '#1a1a1a',
                    offset: 1,
                    formatter: (value) => value > 0 ? value : ''
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || '';
                            const val = context.raw || 0;
                            const m = context.label;
                            const grp = monthGroups[m];
                            if (!grp) return `${label}: ${val}`;
                            const pct = grp.total > 0 ? ((val / grp.total) * 100).toFixed(1) : '0.0';
                            return `${label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // 3. NDC Clearance stacked bar chart by Department
    const depts = ['HRBP', 'IT', 'Finance', 'Admin'];
    const deptKeys = {
        'HRBP': 'hrbp',
        'IT': 'it',
        'Finance': 'finance',
        'Admin': 'admin'
    };

    const ontimeCounts = [];
    const delayCounts = [];

    depts.forEach(d => {
        const key = deptKeys[d];
        let ontime = 0;
        let delay = 0;

        data.forEach(item => {
            if (!item.lastWorkingDay) {
                delay++;
                return;
            }
            const isOntime = item.clearanceDates[key] && (item.clearanceDates[key] === item.lastWorkingDay);
            if (isOntime) {
                ontime++;
            } else {
                delay++;
            }
        });

        ontimeCounts.push(ontime);
        delayCounts.push(delay);
    });

    const ctxNdc = document.getElementById('chart-ff-ndc-clearance').getContext('2d');
    if (charts.ffNdcClearance) charts.ffNdcClearance.destroy();

    charts.ffNdcClearance = new Chart(ctxNdc, {
        type: 'bar',
        data: {
            labels: depts,
            datasets: [
                {
                    label: 'Ontime',
                    data: ontimeCounts,
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    borderRadius: 4
                },
                {
                    label: 'Delay',
                    data: delayCounts,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, grid: { color: '#f1f5f9' } }
            },
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    display: true,
                    anchor: 'center',
                    align: 'center',
                    color: '#ffffff',
                    formatter: (value) => value > 0 ? value : ''
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || '';
                            const val = context.raw || 0;
                            const idx = context.dataIndex;
                            const total = ontimeCounts[idx] + delayCounts[idx];
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                            return `${label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
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
                backgroundColor: ['#FF6F61', '#1A1A1A'],
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

    // Explicitly define the 4 actual HRBP Leads as requested by the user
    const sortedHrbps = ['Asha Khan', 'Tanu Srivastava', 'Janhavi Malhotra', 'Charvi Sarin'];

    const voluntaryData = sortedHrbps.map(p => hrbpExits[p] ? hrbpExits[p].voluntary : 0);
    const involuntaryData = sortedHrbps.map(p => hrbpExits[p] ? hrbpExits[p].involuntary : 0);

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
                    backgroundColor: 'rgba(255, 111, 97, 0.85)',
                    borderRadius: 4
                },
                {
                    label: 'Involuntary',
                    data: involuntaryData,
                    backgroundColor: 'rgba(26, 26, 26, 0.85)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: { stacked: false, grid: { display: false }, ticks: { font: { family: 'Figtree', size: 9 } } },
                y: { stacked: false, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Figtree', size: 9 } } }
            },
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'top',
                    color: '#1a1a1a',
                    offset: 1,
                    formatter: (value) => value > 0 ? value : ''
                }
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
                backgroundColor: ['#FF6F61', '#1A1A1A'],
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
                backgroundColor: ['#FF6F61', '#1A1A1A', '#757575', '#E0E0E0'],
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

// Export drilldown records to a clean, formatted Excel file using SheetJS
function downloadPivotExcel() {
    if (!currentPivotSubset || currentPivotSubset.length === 0) {
        showToast("No data to export", "warning");
        return;
    }
    
    // Map objects to user-friendly Excel column headers
    const exportData = currentPivotSubset.map(item => {
        if (currentPivotIsFF) {
            return {
                'Employee ID': item.employeeId || '',
                'Employee Name': item.name || '',
                'Gender': item.gender || '',
                'Employee Type': item.employeeType || '',
                'HRBP Lead': item.hrbpLead || '',
                'P&L Name': item.plName || '',
                'Month': item.month || '',
                'Last Working Day': item.lastWorkingDay || '',
                'Clearance Status': item.clearanceStatus || '',
                'Payment Type': item.paymentType || '',
                'Ageing (Days)': item.ageing || 0,
                'F&F Amount (Column AA)': item.ffAmountAA || 0,
                'Final F&F Amount (Column AE)': item.finalAmountAE || 0,
                'Payout Date': item.payoutDate || '',
                'Region': item.region || '',
                'Grade': item.grade || ''
            };
        } else {
            return {
                'Employee ID': item.employeeId || '',
                'Employee Name': item.name || '',
                'Gender': item.gender || '',
                'Employee Type': item.employeeType || '',
                'HRBP Lead': item.hrbpLead || '',
                'P&L Name': item.plName || '',
                'Month': item.month || '',
                'Date of Leaving': item.exitDate || '',
                'Exit Type': item.exitType || '',
                'Reason for Leaving': item.reasonForLeaving || '',
                'Tenure (Months)': Math.round((item.tenureMonths || 0) * 10) / 10,
                'Regrettable Attrition': item.isRegrettable ? 'Yes' : 'No',
                'Dropout (<90 Days)': item.isDropout ? 'Yes' : 'No',
                'Region': item.region || '',
                'Grade': item.grade || ''
            };
        }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    
    const sheetName = currentPivotIsFF ? "F&F Cases" : "Attrition Cases";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Auto-fit columns
    const max_width = exportData.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
    worksheet["!cols"] = Array(max_width).fill({ wch: 15 });

    const filename = `${sheetName.replace(" ", "_")}_Drilldown_${new Date().toISOString().substring(0,10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    showToast(`Successfully downloaded Excel: ${filename}`, 'success');
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
            rawSubset = getFilteredFFIgnoringMonth();
            subsetData = rawSubset.filter(d => {
                const monthMatch = d.month === clickedLabel;
                let bucketMatch = false;
                if (datasetLabel === '1-2 days') {
                    bucketMatch = d.ageing <= 2;
                } else if (datasetLabel === '2+ days') {
                    bucketMatch = d.ageing > 2;
                }
                return monthMatch && bucketMatch;
            });
            titleContext = `Month: ${clickedLabel} | Ageing: ${datasetLabel}`;
        } else if (chartId === 'chart-ff-ndc-clearance') {
            const deptKey = clickedLabel.toLowerCase(); // 'hrbp', 'it', 'finance', 'admin'
            subsetData = rawSubset.filter(d => {
                if (!d.lastWorkingDay) return false;
                const matches = d.clearanceDates[deptKey] === d.lastWorkingDay;
                return datasetLabel === 'Ontime' ? matches : !matches;
            });
            titleContext = `Dept: ${clickedLabel} | NDC Status: ${datasetLabel}`;
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
    const listContainer = document.getElementById('reasons-list-container');
    if (!listContainer) return;

    let exits = state.attritionData.filter(e => selectedPl === 'All' || e.plName === selectedPl);

    const tab = state.activeReasonsTab || 'voluntary';
    if (tab === 'voluntary') {
        exits = exits.filter(e => e.exitType === 'Voluntary' && !e.isDropout);
    } else if (tab === 'involuntary') {
        exits = exits.filter(e => e.exitType === 'Involuntary' && !e.isDropout);
    } else if (tab === 'dropout') {
        exits = exits.filter(e => e.isDropout);
    }

    const counts = {};
    let total = 0;
    exits.forEach(e => {
        const reason = e.reasonForLeaving || 'Unassigned';
        counts[reason] = (counts[reason] || 0) + 1;
        total++;
    });

    const sorted = Object.keys(counts).map(r => ({
        reason: r,
        count: counts[r],
        pct: total > 0 ? Math.round((counts[r] / total) * 100) : 0
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    listContainer.innerHTML = sorted.length > 0 ? '' : `<p style="font-size:0.813rem;color:var(--color-text-muted); padding: 0.5rem 0;">No exit reasons recorded for ${tab}.</p>`;

    sorted.forEach(item => {
        let barClass = 'voluntary';
        if (tab === 'involuntary') barClass = 'involuntary';
        else if (tab === 'dropout') barClass = 'dropout';

        listContainer.innerHTML += `
            <div class="reason-item">
                <div class="reason-info-row">
                    <span>${item.reason}</span>
                    <span>${item.count} (${item.pct}%)</span>
                </div>
                <div class="reason-bar-container">
                    <div class="reason-bar-fill ${barClass}" style="width: ${item.pct}%"></div>
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
    
    let totalRecoveredHC = 0;
    let totalRecoveredAmt = 0;
    let totalUnrecoveredHC = 0;
    let totalUnrecoveredAmt = 0;

    recoveryCases.forEach(item => {
        const pl = item.plName || 'Unassigned';
        if (!plGroups[pl]) {
            plGroups[pl] = {
                plName: pl,
                recoveredHeadcount: 0,
                totalRecovered: 0,
                unrecoveredHeadcount: 0,
                totalUnrecovered: 0
            };
        }
        const g = plGroups[pl];

        const due = Math.abs(item.ffAmountAA || 0);
        const unpaid = Math.abs(item.finalAmountAE || 0);

        g.totalUnrecovered += unpaid;
        totalUnrecoveredAmt += unpaid;
        if (unpaid > 0) {
            g.unrecoveredHeadcount++;
            totalUnrecoveredHC++;
        }

        const recovered = due - unpaid;
        if (recovered !== 0) {
            const recVal = Math.max(0, recovered);
            g.totalRecovered += recVal;
            totalRecoveredAmt += recVal;
            g.recoveredHeadcount++;
            totalRecoveredHC++;
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
            <td class="align-right">${item.recoveredHeadcount}</td>
            <td class="align-right" style="color:var(--status-success-text); font-weight:600;">₹${Math.round(item.totalRecovered).toLocaleString('en-IN')}</td>
            <td class="align-right">${item.unrecoveredHeadcount}</td>
            <td class="align-right" style="color:var(--status-danger-text); font-weight:600;">₹${Math.round(item.totalUnrecovered).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(row);
    });

    // Add sticky totals row at bottom
    if (sorted.length > 0) {
        const totalRow = document.createElement('tr');
        totalRow.className = 'table-total-row';
        totalRow.innerHTML = `
            <td><strong>Total</strong></td>
            <td class="align-right">${totalRecoveredHC.toLocaleString('en-IN')}</td>
            <td class="align-right" style="color:var(--status-success-text);">₹${Math.round(totalRecoveredAmt).toLocaleString('en-IN')}</td>
            <td class="align-right">${totalUnrecoveredHC.toLocaleString('en-IN')}</td>
            <td class="align-right" style="color:var(--status-danger-text);">₹${Math.round(totalUnrecoveredAmt).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(totalRow);
    }

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
    const plHeadcounts = {};
    
    let totalHeadcount = 0;
    let totalPayout = 0;

    data.forEach(d => {
        if (d.paymentType === 'Payable') {
            const pl = d.plName || 'Unassigned';
            plPayouts[pl] = (plPayouts[pl] || 0) + (d.finalAmountAE || 0);
            plHeadcounts[pl] = (plHeadcounts[pl] || 0) + 1;
            
            totalHeadcount += 1;
            totalPayout += (d.finalAmountAE || 0);
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
            <td class="align-right">${plHeadcounts[pl] || 0}</td>
            <td class="align-right" style="font-weight:600; color:var(--status-success-text);">₹${Math.round(plPayouts[pl]).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(row);
    });

    // Add sticky totals row at bottom
    if (sortedPls.length > 0) {
        const totalRow = document.createElement('tr');
        totalRow.className = 'table-total-row';
        totalRow.innerHTML = `
            <td><strong>Total</strong></td>
            <td class="align-right">${totalHeadcount.toLocaleString('en-IN')}</td>
            <td class="align-right" style="color:var(--status-success-text);">₹${Math.round(totalPayout).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(totalRow);
    }
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

// ==========================================================================
// GOOGLE SHEETS API INTEGRATION & SYNC ENGINE
// ==========================================================================

function setupModalTabs() {
    const tabFile = document.getElementById('modal-tab-file');
    const tabSheets = document.getElementById('modal-tab-sheets');
    const panelFile = document.getElementById('modal-panel-file');
    const panelSheets = document.getElementById('modal-panel-sheets');

    if (!tabFile || !tabSheets || !panelFile || !panelSheets) return;

    tabFile.addEventListener('click', () => {
        tabFile.classList.add('active');
        tabSheets.classList.remove('active');
        panelFile.classList.remove('hidden');
        panelSheets.classList.add('hidden');
        tabFile.style.borderBottomColor = 'var(--color-blue-accent)';
        tabFile.style.color = 'var(--color-blue-accent)';
        tabSheets.style.borderBottomColor = 'transparent';
        tabSheets.style.color = 'var(--color-text-muted)';
    });

    tabSheets.addEventListener('click', () => {
        tabSheets.classList.add('active');
        tabFile.classList.remove('active');
        panelSheets.classList.remove('hidden');
        panelFile.classList.add('hidden');
        tabSheets.style.borderBottomColor = 'var(--color-blue-accent)';
        tabSheets.style.color = 'var(--color-blue-accent)';
        tabFile.style.borderBottomColor = 'transparent';
        tabFile.style.color = 'var(--color-text-muted)';
        populateSheetsConfigUI();
    });
}

function loadGoogleSheetsConfig() {
    const saved = localStorage.getItem('dash_google_sheets_config');
    if (saved) {
        try {
            state.googleSheets = { ...state.googleSheets, ...JSON.parse(saved) };
        } catch (e) {
            console.error('Error loading Google Sheets config:', e);
        }
    }
}

function saveGoogleSheetsConfig() {
    localStorage.setItem('dash_google_sheets_config', JSON.stringify(state.googleSheets));
}

function populateSheetsConfigUI() {
    const enabledEl = document.getElementById('sheet-sync-enabled');
    const methodEl = document.getElementById('sheet-sync-method');
    const apiKeyEl = document.getElementById('sheet-api-key');
    const spreadIdEl = document.getElementById('sheet-spreadsheet-id');
    const rangeEl = document.getElementById('sheet-range');
    const pubUrlEl = document.getElementById('sheet-published-url');
    const intervalEl = document.getElementById('sheet-sync-interval');

    if (enabledEl) enabledEl.checked = state.googleSheets.enabled;
    if (methodEl) methodEl.value = state.googleSheets.method;
    if (apiKeyEl) apiKeyEl.value = state.googleSheets.apiKey;
    if (spreadIdEl) spreadIdEl.value = state.googleSheets.spreadsheetId;
    if (rangeEl) rangeEl.value = state.googleSheets.range;
    if (pubUrlEl) pubUrlEl.value = state.googleSheets.publishedUrl;
    if (intervalEl) intervalEl.value = state.googleSheets.refreshInterval;

    toggleSheetMethodFields(state.googleSheets.method);
}

function toggleSheetMethodFields(method) {
    const apiFields = document.getElementById('sheet-api-fields');
    const pubFields = document.getElementById('sheet-published-fields');

    if (!apiFields || !pubFields) return;

    if (method === 'api') {
        apiFields.classList.remove('hidden');
        pubFields.classList.add('hidden');
    } else {
        apiFields.classList.add('hidden');
        pubFields.classList.remove('hidden');
    }
}

async function saveAndSyncSheetsConfig() {
    const feedback = document.getElementById('sheets-sync-feedback');
    const feedbackText = document.getElementById('sheets-feedback-text');
    if (!feedback || !feedbackText) return;

    feedback.className = 'feedback-alert hidden';

    state.googleSheets.enabled = document.getElementById('sheet-sync-enabled').checked;
    state.googleSheets.method = document.getElementById('sheet-sync-method').value;
    state.googleSheets.apiKey = document.getElementById('sheet-api-key').value.trim();
    state.googleSheets.spreadsheetId = document.getElementById('sheet-spreadsheet-id').value.trim();
    state.googleSheets.range = document.getElementById('sheet-range').value.trim() || 'Sheet1';
    state.googleSheets.publishedUrl = document.getElementById('sheet-published-url').value.trim();
    state.googleSheets.refreshInterval = parseInt(document.getElementById('sheet-sync-interval').value) || 1;

    saveGoogleSheetsConfig();
    setupGoogleSheetsAutoRefresh();

    // Trigger immediate sync
    feedback.className = 'feedback-alert success'; // styling neutral container
    feedback.style.backgroundColor = 'var(--status-info-bg)';
    feedback.style.color = 'var(--status-info-text)';
    feedbackText.textContent = 'Connecting to Google Sheets...';
    feedback.classList.remove('hidden');

    const success = await syncGoogleSheetsData();
    if (success) {
        feedback.className = 'feedback-alert success';
        feedback.style.backgroundColor = 'var(--status-success-bg)';
        feedback.style.color = 'var(--status-success-text)';
        feedbackText.textContent = 'Successfully saved and synced Google Sheets data!';
        showToast('Google Sheets sync successful!', 'success');
        setTimeout(() => {
            const modal = document.getElementById('sync-modal');
            if (modal) modal.setAttribute('aria-hidden', 'true');
        }, 1200);
    } else {
        feedback.className = 'feedback-alert error';
        feedback.style.backgroundColor = 'var(--status-danger-bg)';
        feedback.style.color = 'var(--status-danger-text)';
        feedbackText.textContent = 'Connection failed. Please check spreadsheet URL/API settings.';
    }
}

async function syncGoogleSheetsData() {
    try {
        let rows = [];
        if (state.googleSheets.method === 'api') {
            rows = await fetchGoogleSheetsAPI();
        } else {
            rows = await fetchGoogleSheetsPublished();
        }

        if (!rows || rows.length === 0) {
            throw new Error('No data rows retrieved from Google Sheet.');
        }

        normalizeExcelRows(rows);
        saveState();
        setDefaultFiltersToLatest();
        populateDropdownFilters();
        updateUI();
        state.googleSheets.lastRefreshed = new Date();
        const timeStr = state.googleSheets.lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateSyncStatus(`Synced Google Sheet at ${timeStr}`);
        return true;
    } catch (error) {
        console.error('Google Sheets sync error:', error);
        showToast(`Sync failed: ${error.message}`, 'error');
        return false;
    }
}

async function fetchGoogleSheetsAPI() {
    const { spreadsheetId, apiKey, range } = state.googleSheets;
    if (!spreadsheetId || !apiKey) {
        throw new Error('Spreadsheet ID and API Key are required.');
    }
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || response.statusText;
        throw new Error(`Google API Error: ${msg} (${response.status})`);
    }
    const data = await response.json();
    if (!data.values || data.values.length === 0) {
        throw new Error('No values found in the spreadsheet tab/range.');
    }

    // Convert values grid (array of arrays) into array of objects using headers from row 0
    const headers = data.values[0];
    const rows = [];
    for (let i = 1; i < data.values.length; i++) {
        const rowVal = data.values[i];
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = rowVal[index] !== undefined ? rowVal[index] : '';
        });
        rows.push(obj);
    }
    return rows;
}

async function fetchGoogleSheetsPublished() {
    const { publishedUrl } = state.googleSheets;
    if (!publishedUrl) {
        throw new Error('Published Google Sheet URL is required.');
    }

    // We can directly fetch published URLs as they support CORS
    const response = await fetch(publishedUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch published sheet: ${response.statusText} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // Parse XLSX using SheetJS
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    return rows;
}



async function saveAndSyncSheetsConfig() {
    const feedback = document.getElementById('sheets-sync-feedback');
    const feedbackText = document.getElementById('sheets-feedback-text');
    if (!feedback || !feedbackText) return;

    feedback.className = 'feedback-alert hidden';

    state.googleSheets.enabled = document.getElementById('sheet-sync-enabled').checked;
    state.googleSheets.method = document.getElementById('sheet-sync-method').value;
    state.googleSheets.apiKey = document.getElementById('sheet-api-key').value.trim();
    state.googleSheets.spreadsheetId = document.getElementById('sheet-spreadsheet-id').value.trim();
    state.googleSheets.range = document.getElementById('sheet-range').value.trim();
    state.googleSheets.publishedUrl = document.getElementById('sheet-published-url').value.trim();
    state.googleSheets.refreshInterval = parseInt(document.getElementById('sheet-sync-interval').value) || 1;

    localStorage.setItem('dash_sheets_config', JSON.stringify(state.googleSheets));

    const success = await syncGoogleSheetsData();
    if (success) {
        feedback.className = 'feedback-alert success';
        feedbackText.textContent = 'Successfully saved and synced Google Sheets data!';
        showToast('Google Sheets sync successful!', 'success');
        setupGoogleSheetsAutoRefresh();
        setTimeout(() => {
            const modal = document.getElementById('sync-modal');
            if (modal) modal.setAttribute('aria-hidden', 'true');
        }, 1500);
    } else {
        feedback.className = 'feedback-alert error';
        feedbackText.textContent = 'Sync failed. Please check credentials/URL and console logs.';
    }
}

async function syncGoogleSheetsData() {
    if (!state.googleSheets.enabled) return false;
    updateSyncStatus('Syncing Google Sheet...');

    try {
        let rows = [];
        if (state.googleSheets.method === 'api') {
            rows = await fetchGoogleSheetsAPI();
        } else {
            rows = await fetchGoogleSheetsPublished();
        }

        if (!rows || rows.length === 0) {
            throw new Error('No records returned from Google Sheet.');
        }

        normalizeExcelRows(rows);

        try {
            saveState();
        } catch (e) {
            console.warn('LocalStorage full, skipped caching:', e);
        }

        populateDropdownFilters();
        updateUI();

        const timeStr = new Date().toLocaleTimeString();
        updateSyncStatus(`Synced Google Sheet at ${timeStr}`);
        state.googleSheets.lastRefreshed = timeStr;
        return true;
    } catch (error) {
        console.error('Google Sheets sync error:', error);
        showToast(`Sync failed: ${error.message}`, 'error');
        return false;
    }
}

async function fetchGoogleSheetsAPI() {
    const { spreadsheetId, apiKey, range } = state.googleSheets;
    if (!spreadsheetId || !apiKey) {
        throw new Error('Spreadsheet ID and API Key are required for API method.');
    }
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch from Google Sheets API: ${response.statusText} (${response.status})`);
    }
    const data = await response.json();
    if (!data.values || data.values.length === 0) {
        throw new Error('No data found in the specified range.');
    }

    const headers = data.values[0];
    const rows = [];
    for (let i = 1; i < data.values.length; i++) {
        const row = {};
        const vals = data.values[i];
        headers.forEach((header, index) => {
            row[header] = vals[index] !== undefined ? vals[index] : '';
        });
        rows.push(row);
    }
    return rows;
}

async function fetchGoogleSheetsPublished() {
    let { publishedUrl } = state.googleSheets;
    if (!publishedUrl) {
        throw new Error('Published Spreadsheet URL is required for Published method.');
    }

    // Auto-detect standard Google Sheet URL and convert it to export link
    const match = publishedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        const spreadsheetId = match[1];
        publishedUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
        console.log("Auto-converted Google Sheet URL to direct Excel export link:", publishedUrl);
    }

    const response = await fetch(publishedUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch published sheet: ${response.statusText} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();

    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    return rows;
}

let googleSheetsIntervalId = null;
let secondsRemaining = 60;
let countdownIntervalId = null;

function setupGoogleSheetsAutoRefresh() {
    if (googleSheetsIntervalId) clearInterval(googleSheetsIntervalId);
    if (countdownIntervalId) clearInterval(countdownIntervalId);

    const countdownEl = document.getElementById('auto-refresh-countdown');
    if (!countdownEl) return;

    if (!state.googleSheets.enabled) {
        countdownEl.style.display = 'none';
        return;
    }

    countdownEl.style.display = 'inline';
    secondsRemaining = state.googleSheets.refreshInterval * 60;

    countdownEl.textContent = `(Sync in ${secondsRemaining}s)`;

    countdownIntervalId = setInterval(() => {
        if (secondsRemaining > 1) {
            secondsRemaining--;
            countdownEl.textContent = `(Sync in ${secondsRemaining}s)`;
        } else {
            countdownEl.textContent = `(Syncing...)`;
        }
    }, 1000);

    googleSheetsIntervalId = setInterval(async () => {
        const success = await syncGoogleSheetsData();
        secondsRemaining = state.googleSheets.refreshInterval * 60;
        countdownEl.textContent = `(Sync in ${secondsRemaining}s)`;
    }, state.googleSheets.refreshInterval * 60 * 1000);
}
