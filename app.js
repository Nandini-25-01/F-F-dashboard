// F&F Dashboard Full-Stack App Controller
const state = {
    activeTab: 'ff', // 'ff' or 'attrition'
    activeSubTab: 'Voluntary', // 'Voluntary' or 'Involuntary'
    activeReasonsTab: 'voluntary',
    activeEmpExitsTab: 'combined',
    filters: {
        employeeType: ['All'],
        hrbpLead: ['All'],
        plName: ['All'],
        gender: ['All'],
        year: ['All'],
        month: ['All'],
        reasons_tab: 'voluntary',
        reasons_pl: 'All'
    },
    widgets: {},
    rawExits: [],
    pagination: {
        registry: { page: 1, size: 10 }
    },
    search: {
        registry: ''
    },
    sort: {
        registry: { column: 'lastWorkingDay', order: 'desc' }
    }
};

// Global chart references for resetting on reload
const charts = {
    ffStatus: null,
    ffBuckets: null,
    ndcRadar: null,
    ffPl: null,
    attritionPl: null,
    attritionVoluntary: null,
    attritionTenure: null
};

// Shared chart config options
const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: { boxWidth: 10, padding: 12, font: { family: 'Figtree', size: 9, weight: '500' }, color: '#475569' }
        },
        tooltip: {
            backgroundColor: '#1e293b',
            titleFont: { family: 'Figtree', size: 10, weight: '600' },
            bodyFont: { family: 'Figtree', size: 9 },
            padding: 8,
            cornerRadius: 6
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupModalTabs();
    loadData();
});

// Load filters on startup, then load UI
async function loadData() {
    updateSyncStatus('Loading database config...');
    await apiLoadFilters();
    await updateUI();
    await updateSyncHistoryLogs();
}

async function updateUI() {
    updateSyncStatus('Updating charts and tables...');
    await Promise.all([
        loadDashboardMetrics(),
        loadRawExits()
    ]);
    updateSyncStatus('Synced & Connected');
}

// Fetch metrics and charts data from backend
async function loadDashboardMetrics() {
    try {
        const response = await fetch('/api/widgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_type: state.filters.employeeType,
                hrbp_lead: state.filters.hrbpLead,
                pl_name: state.filters.plName,
                gender: state.filters.gender,
                year: state.filters.year,
                month: state.filters.month,
                reasons_tab: state.filters.reasons_tab,
                reasons_pl: state.filters.reasons_pl
            })
        });
        if (!response.ok) throw new Error('Failed to retrieve dashboard metrics');
        const data = await response.json();
        state.widgets = data;
        
        // 1. Render F&F KPIs
        if (data.total_ff_cases) {
            document.getElementById('kpi-ff-total').textContent = data.total_ff_cases.value.toLocaleString();
        }
        if (data.average_tat) {
            document.getElementById('kpi-ff-avg-tat').textContent = `${data.average_tat.value.toFixed(1)} days`;
        }
        if (data.total_ff_payout_by_pnl) {
            const totalPayout = data.total_ff_payout_by_pnl.reduce((sum, item) => sum + item.totalPayout, 0);
            document.getElementById('kpi-ff-payout').textContent = `₹${totalPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        }
        
        // 2. Render Attrition KPIs
        if (data.attrition_total) {
            document.getElementById('kpi-attrition-total').textContent = data.attrition_total.value.toLocaleString();
        }
        if (data.attrition_rate) {
            document.getElementById('kpi-attrition-rate').textContent = `${data.attrition_rate.value.toFixed(1)}%`;
        }
        if (data.attrition_regret) {
            document.getElementById('kpi-attrition-regret').textContent = `${data.attrition_regret.value.toFixed(1)}%`;
        }
        if (data.attrition_tenure) {
            document.getElementById('kpi-attrition-tenure').textContent = `${data.attrition_tenure.value} mo`;
        }
        if (data.attrition_dropout) {
            document.getElementById('kpi-attrition-dropout').textContent = `${data.attrition_dropout.count} (${data.attrition_dropout.rate.toFixed(1)}%)`;
        }
        
        // 3. Render charts and tables
        renderFFCharts(data);
        renderAttritionCharts(data);
        
        if (data.recovery_settlement_analysis) {
            renderFFRecoveryAnalysisTable(data.recovery_settlement_analysis);
        }
        if (data.attrition_monthly_rate) {
            renderMonthlyAttritionRateTable(data.attrition_monthly_rate);
        }
        if (data.top_exit_reasons_component) {
            renderTopExitReasonsList(data.top_exit_reasons_component);
        }
        
    } catch (err) {
        console.error('Error loading dashboard widgets:', err);
        showToast('Failed to load metric widgets.', 'error');
    }
}

// Fetch raw exits list for the main table registry at the bottom of the page
async function loadRawExits() {
    try {
        const response = await fetch('/api/raw-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_type: state.filters.employeeType,
                hrbp_lead: state.filters.hrbpLead,
                pl_name: state.filters.plName,
                gender: state.filters.gender,
                year: state.filters.year,
                month: state.filters.month
            })
        });
        if (!response.ok) throw new Error('Failed to load raw exits registry');
        state.rawExits = await response.json();
        
        // Re-render tabular registry and pivot builders
        renderRegistryTable();
        
    } catch (err) {
        console.error('Error loading exits registry:', err);
    }
}

// Fetch dynamic filter options from database
async function apiLoadFilters() {
    try {
        const response = await fetch('/api/filters');
        if (!response.ok) throw new Error('Failed to fetch database filter schema');
        const filters = await response.json();
        
        // 1. HRBP leads dropdown checkboxes
        const hrbpContent = document.getElementById('dropdown-hrbp-content');
        if (hrbpContent && filters.hrbp_leads) {
            hrbpContent.innerHTML = `
                <label class="dropdown-option">
                    <input type="checkbox" id="chk-hrbp-all" value="All" checked> <em>All Leads</em>
                </label>
            `;
            filters.hrbp_leads.forEach(l => {
                hrbpContent.innerHTML += `
                    <label class="dropdown-option">
                        <input type="checkbox" name="chk-hrbp" value="${l}" checked> ${l}
                    </label>
                `;
            });
            setupCheckboxGroup('chk-hrbp-all', 'chk-hrbp', 'hrbpLead', updateHRBPTriggerLabel);
        }
        
        // 2. P&L department checkboxes
        const plContent = document.getElementById('dropdown-pl-content');
        if (plContent && filters.pl_names) {
            plContent.innerHTML = `
                <label class="dropdown-option">
                    <input type="checkbox" id="chk-pl-all" value="All" checked> <em>All P&Ls</em>
                </label>
            `;
            filters.pl_names.forEach(p => {
                plContent.innerHTML += `
                    <label class="dropdown-option">
                        <input type="checkbox" name="chk-pl" value="${p}" checked> ${p}
                    </label>
                `;
            });
            setupCheckboxGroup('chk-pl-all', 'chk-pl', 'plName', updatePLTriggerLabel);
        }
        
        // 3. Month checkboxes
        const monthContent = document.getElementById('dropdown-month-content');
        if (monthContent && filters.months) {
            monthContent.innerHTML = `
                <label class="dropdown-option">
                    <input type="checkbox" id="chk-month-all" value="All" checked> <em>All Months</em>
                </label>
            `;
            filters.months.forEach(m => {
                monthContent.innerHTML += `
                    <label class="dropdown-option">
                        <input type="checkbox" name="chk-month" value="${m}" checked> ${m}
                    </label>
                `;
            });
            setupCheckboxGroup('chk-month-all', 'chk-month', 'month', updateMonthTriggerLabel);
        }
        
        // 4. Year checkboxes
        const yearContent = document.getElementById('dropdown-year-content');
        if (yearContent && filters.years) {
            yearContent.innerHTML = `
                <label class="dropdown-option">
                    <input type="checkbox" id="chk-year-all" value="All" checked> <em>All Years</em>
                </label>
            `;
            filters.years.forEach(y => {
                yearContent.innerHTML += `
                    <label class="dropdown-option">
                        <input type="checkbox" name="chk-year" value="${y}" checked> ${y}
                    </label>
                `;
            });
            setupCheckboxGroup('chk-year-all', 'chk-year', 'year', updateYearTriggerLabel);
        }
        
        // 5. Reasons pl select dropdown
        const reasonsSelect = document.getElementById('reasons-pl-select');
        if (reasonsSelect && filters.pl_names) {
            reasonsSelect.innerHTML = '<option value="All">All Departments</option>';
            filters.pl_names.forEach(p => {
                reasonsSelect.innerHTML += `<option value="${p}">${p}</option>`;
            });
            reasonsSelect.value = 'All';
        }
        
        // Set triggers default texts
        updateHRBPTriggerLabel();
        updatePLTriggerLabel();
        updateMonthTriggerLabel();
        updateYearTriggerLabel();
        updateEmployeeTypeTriggerLabel();
        
    } catch (err) {
        console.error('Error generating filters:', err);
    }
}

// Checkbox multi-select controller
function setupCheckboxGroup(allId, name, stateKey, labelFn) {
    const allCb = document.getElementById(allId);
    const container = allCb.closest('.dropdown-content');
    
    const getItems = () => container.querySelectorAll(`input[name="${name}"]`);
    
    allCb.addEventListener('change', () => {
        const itemCbs = getItems();
        if (allCb.checked) {
            itemCbs.forEach(cb => cb.checked = true);
            state.filters[stateKey] = ['All'];
        } else {
            itemCbs.forEach(cb => cb.checked = false);
            state.filters[stateKey] = [];
        }
        labelFn();
        updateUI();
    });
    
    container.addEventListener('change', (e) => {
        if (e.target.name === name) {
            const itemCbs = getItems();
            if (!e.target.checked) {
                allCb.checked = false;
            }
            const active = [];
            itemCbs.forEach(c => {
                if (c.checked) active.push(c.value);
            });
            if (active.length === itemCbs.length) {
                allCb.checked = true;
                state.filters[stateKey] = ['All'];
            } else {
                state.filters[stateKey] = active;
            }
            labelFn();
            updateUI();
        }
    });
}

// Fetch database logs to populate synchronizer list
async function updateSyncHistoryLogs() {
    try {
        const response = await fetch('/api/sync/history');
        if (!response.ok) return;
        const data = await response.json();
        
        const textEl = document.getElementById('sync-status-text');
        if (textEl) {
            textEl.textContent = `DB Last Synced: ${data.last_success}`;
        }
        
        const urlEl = document.getElementById('sheet-published-url');
        if (urlEl && data.spreadsheet_id && !urlEl.value) {
            urlEl.value = `https://docs.google.com/spreadsheets/d/${data.spreadsheet_id}/edit`;
        }
        
        // Populate synchronizer logs table
        const tbody = document.getElementById('tbody-sync-history');
        if (tbody) {
            tbody.innerHTML = '';
            if (data.history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="align-center">No logs recorded yet.</td></tr>';
                return;
            }
            data.history.forEach(log => {
                const tr = document.createElement('tr');
                const statusBadge = log.status === 'SUCCESS' 
                    ? '<span class="badge badge-success">Success</span>' 
                    : `<span class="badge badge-danger" title="${log.error_message || ''}">Failed</span>`;
                tr.innerHTML = `
                    <td>${log.sync_time}</td>
                    <td>${statusBadge}</td>
                    <td class="align-right">${log.rows_read}</td>
                    <td class="align-right">${log.rows_inserted}</td>
                    <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.error_message || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// Trigger backend synchronization on-demand
async function triggerImmediateSync() {
    const feedback = document.getElementById('sheets-sync-feedback');
    const text = document.getElementById('sheets-feedback-text');
    if (feedback && text) {
        feedback.className = 'feedback-alert info';
        feedback.style.display = 'block';
        text.textContent = 'Contacting server to synchronize Google Sheets...';
    }
    
    const urlInput = document.getElementById('sheet-published-url');
    const sheetUrl = urlInput ? urlInput.value.trim() : '';
    
    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: sheetUrl })
        });
        const result = await response.json();
        
        if (response.ok && result.success) {
            if (feedback && text) {
                feedback.className = 'feedback-alert success';
                text.textContent = 'Sync successful! PostgreSQL Database refreshed.';
            }
            showToast('Google Sheets synchronized successfully!', 'success');
            await loadData();
            setTimeout(() => {
                const modal = document.getElementById('sync-modal');
                if (modal) modal.setAttribute('aria-hidden', 'true');
            }, 1000);
        } else {
            throw new Error(result.error || 'Server returned an error');
        }
    } catch (err) {
        console.error(err);
        if (feedback && text) {
            feedback.className = 'feedback-alert danger';
            text.textContent = `Sync Failed: ${err.message}`;
        }
        showToast('Google Sheets sync failed.', 'error');
    }
}

// --- Dynamic Filter Label Helpers ---
function updatePLTriggerLabel() {
    const label = document.getElementById('lbl-filter-pl');
    if (!label) return;
    const active = state.filters.plName;
    label.textContent = active.includes('All') ? 'All P&L / COEs' : (active.length === 1 ? active[0] : `${active.length} Selected`);
}

function updateHRBPTriggerLabel() {
    const label = document.getElementById('lbl-filter-hrbp');
    if (!label) return;
    const active = state.filters.hrbpLead;
    label.textContent = active.includes('All') ? 'All HRBP Leads' : (active.length === 1 ? active[0] : `${active.length} Selected`);
}

function updateMonthTriggerLabel() {
    const label = document.getElementById('lbl-filter-month');
    if (!label) return;
    const active = state.filters.month;
    label.textContent = active.includes('All') ? 'All Months' : (active.length === 1 ? active[0] : `${active.length} Selected`);
}

function updateYearTriggerLabel() {
    const label = document.getElementById('lbl-filter-year');
    if (!label) return;
    const active = state.filters.year;
    label.textContent = active.includes('All') ? 'All Years' : (active.length === 1 ? active[0] : `${active.length} Selected`);
}

function updateEmployeeTypeTriggerLabel() {
    const label = document.getElementById('lbl-filter-type');
    if (!label) return;
    const active = state.filters.employeeType;
    label.textContent = active.includes('All') ? 'All Employee Types' : (active.length === 1 ? active[0] : `${active.length} Selected`);
}

function updateSyncStatus(msg) {
    console.log(`[Status] ${msg}`);
}

// --- Charts Renderer Functions ---
function renderFFCharts(data) {
    if (typeof Chart === 'undefined') return;
    
    // 1. Doughnut: Payable vs Recovery
    const ctxStatus = document.getElementById('chart-ff-status').getContext('2d');
    if (charts.ffStatus) charts.ffStatus.destroy();
    
    const payable = data.payable_vs_recovery.Payable || 0;
    const recovery = data.payable_vs_recovery.Recovery || 0;
    const total = (payable + recovery) || 1;
    
    charts.ffStatus = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: [
                `Payable: ${payable} (${((payable/total)*100).toFixed(1)}%)`,
                `Recovery: ${recovery} (${((recovery/total)*100).toFixed(1)}%)`
            ],
            datasets: [{
                data: [payable, recovery],
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

    // 2. Bar: Payout by P&L
    const ctxPl = document.getElementById('chart-ff-pl').getContext('2d');
    if (charts.ffPl) charts.ffPl.destroy();
    
    const plLabels = data.total_ff_payout_by_pnl.map(item => item.plName);
    const plValues = data.total_ff_payout_by_pnl.map(item => item.totalPayout);
    
    charts.ffPl = new Chart(ctxPl, {
        type: 'bar',
        data: {
            labels: plLabels,
            datasets: [{
                label: 'Payout Amount (₹)',
                data: plValues,
                backgroundColor: 'rgba(255, 111, 97, 0.85)',
                borderRadius: 4
            }]
        },
        options: {
            ...commonChartOptions,
            indexAxis: 'y',
            scales: {
                x: { grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Figtree', size: 9 } } },
                y: { grid: { display: false }, ticks: { font: { family: 'Figtree', size: 9 } } }
            },
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'right',
                    color: '#475569',
                    formatter: (value) => value > 0 ? '₹' + (value/1000).toFixed(0) + 'k' : ''
                }
            }
        }
    });

    // 3. Stacked Bar: Monthly Ageing Breakdown
    const ctxBuckets = document.getElementById('chart-ff-buckets').getContext('2d');
    if (charts.ffBuckets) charts.ffBuckets.destroy();
    
    const months = data.ageing_bucket_breakdown.map(item => item.month);
    const b1_2 = data.ageing_bucket_breakdown.map(item => item.bucket1_2);
    const b2_plus = data.ageing_bucket_breakdown.map(item => item.bucket2_plus);
    
    charts.ffBuckets = new Chart(ctxBuckets, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                { label: '1-2 days', data: b1_2, backgroundColor: 'rgba(255, 111, 97, 0.85)', borderRadius: 4 },
                { label: '2+ days', data: b2_plus, backgroundColor: 'rgba(26, 26, 26, 0.85)', borderRadius: 4 }
            ]
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Figtree', size: 9 } } },
                y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Figtree', size: 9 } } }
            },
            plugins: {
                ...commonChartOptions.plugins,
                datalabels: {
                    display: true,
                    anchor: 'center',
                    align: 'center',
                    color: '#ffffff',
                    formatter: (value) => value > 0 ? value : ''
                }
            }
        }
    });

    // 4. Radar Chart: Clearance SLA Radar
    const ctxRadar = document.getElementById('chart-ff-ndc-clearance').getContext('2d');
    if (charts.ndcRadar) charts.ndcRadar.destroy();
    
    const depts = data.ndc_clearance.map(item => item.dept);
    const ontimes = data.ndc_clearance.map(item => item.ontime);
    const delays = data.ndc_clearance.map(item => item.delay);
    
    charts.ndcRadar = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: depts,
            datasets: [
                {
                    label: 'Ontime',
                    data: ontimes,
                    backgroundColor: 'rgba(255, 111, 97, 0.2)',
                    borderColor: '#FF6F61',
                    pointBackgroundColor: '#FF6F61',
                    borderWidth: 2
                },
                {
                    label: 'Delay',
                    data: delays,
                    backgroundColor: 'rgba(26, 26, 26, 0.1)',
                    borderColor: '#1a1a1a',
                    pointBackgroundColor: '#1a1a1a',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { display: true, color: '#e2e8f0' },
                    grid: { color: '#e2e8f0' },
                    pointLabels: { font: { family: 'Figtree', size: 10, weight: '600' } },
                    ticks: { backdropColor: 'transparent', font: { family: 'Figtree', size: 8 } }
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { family: 'Figtree', size: 9, weight: '500' } } }
            }
        }
    });
}

function renderAttritionCharts(data) {
    if (typeof Chart === 'undefined') return;
    
    // 1. Grouped Bar: HRBP Lead voluntary/involuntary splits
    const ctxPl = document.getElementById('chart-attrition-pl').getContext('2d');
    if (charts.attritionPl) charts.attritionPl.destroy();
    
    charts.attritionPl = new Chart(ctxPl, {
        type: 'bar',
        data: {
            labels: data.attrition_by_hrbp.labels,
            datasets: [
                { label: 'Voluntary', data: data.attrition_by_hrbp.voluntary, backgroundColor: 'rgba(255, 111, 97, 0.85)', borderRadius: 4 },
                { label: 'Involuntary', data: data.attrition_by_hrbp.involuntary, backgroundColor: 'rgba(26, 26, 26, 0.85)', borderRadius: 4 }
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

    // 2. Doughnut: Voluntary vs Involuntary ratio
    const ctxVol = document.getElementById('chart-attrition-voluntary').getContext('2d');
    if (charts.attritionVoluntary) charts.attritionVoluntary.destroy();
    
    const vol = data.attrition_voluntary_vs_involuntary.Voluntary || 0;
    const invol = data.attrition_voluntary_vs_involuntary.Involuntary || 0;
    const tot = (vol + invol) || 1;
    
    charts.attritionVoluntary = new Chart(ctxVol, {
        type: 'doughnut',
        data: {
            labels: [
                `Voluntary: ${vol} (${((vol/tot)*100).toFixed(1)}%)`,
                `Involuntary: ${invol} (${((invol/tot)*100).toFixed(1)}%)`
            ],
            datasets: [{
                data: [vol, invol],
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

    // 3. Doughnut: Tenure Buckets distribution
    const ctxTenure = document.getElementById('chart-attrition-tenure').getContext('2d');
    if (charts.attritionTenure) charts.attritionTenure.destroy();
    
    const buckets = data.attrition_tenure_distribution;
    const tenureLabels = Object.keys(buckets);
    const tenureValues = Object.values(buckets);
    const totalTenure = tenureValues.reduce((sum, c) => sum + c, 0) || 1;
    
    const displayLabels = tenureLabels.map((lbl, idx) => {
        const count = tenureValues[idx];
        const pct = ((count / totalTenure) * 100).toFixed(1);
        return `${lbl}: ${count} (${pct}%)`;
    });
    
    charts.attritionTenure = new Chart(ctxTenure, {
        type: 'doughnut',
        data: {
            labels: displayLabels,
            datasets: [{
                data: tenureValues,
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
    
    // Update employee type table
    const tbodyType = document.getElementById('tbody-attrition-type');
    if (tbodyType && data.attrition_type_breakdown) {
        tbodyType.innerHTML = '';
        const types = Object.keys(data.attrition_type_breakdown);
        types.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${t}</strong></td>
                <td class="align-right">${data.attrition_type_breakdown[t].toLocaleString()}</td>
            `;
            tbodyType.appendChild(tr);
        });
    }
}

// Bind F&F Recovery analysis table values
function renderFFRecoveryAnalysisTable(rows) {
    const tbody = document.getElementById('tbody-ff-recovery-analysis');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="align-center">No recovery cases found.</td></tr>';
        return;
    }
    
    let totalRecHc = 0, totalUnrecHc = 0, sumRecovered = 0, sumUnrecovered = 0;
    
    rows.forEach(item => {
        totalRecHc += item.recoveredHeadcount;
        totalUnrecHc += item.unrecoveredHeadcount;
        sumRecovered += item.totalRecovered;
        sumUnrecovered += item.totalUnrecovered;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.plName}</strong></td>
            <td class="align-right">${item.recoveredHeadcount}</td>
            <td class="align-right">₹${item.totalRecovered.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            <td class="align-right">${item.unrecoveredHeadcount}</td>
            <td class="align-right">₹${item.totalUnrecovered.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // Add Totals row
    const trTotals = document.createElement('tr');
    trTotals.style.background = 'var(--color-bg-alt)';
    trTotals.style.fontWeight = 'bold';
    trTotals.innerHTML = `
        <td>Total Summary</td>
        <td class="align-right">${totalRecHc}</td>
        <td class="align-right">₹${sumRecovered.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
        <td class="align-right">${totalUnrecHc}</td>
        <td class="align-right">₹${sumUnrecovered.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
    `;
    tbody.appendChild(trTotals);
}

// Bind Monthly Attrition Rate table
function renderMonthlyAttritionRateTable(rows) {
    const tbody = document.getElementById('tbody-attrition-monthly-rate');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="align-center">No historical months found.</td></tr>';
        return;
    }
    
    rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${row.monthLabel}</strong></td>
            <td class="align-right">${row.startHeadcount.toLocaleString()}</td>
            <td class="align-right">${row.exitCount.toLocaleString()}</td>
            <td class="align-right" style="font-weight: 600; color: var(--color-blue-primary);">${row.rate.toFixed(1)}%</td>
        `;
        tbody.appendChild(tr);
    });
}

// Bind Top Exit Reasons list items
function renderTopExitReasonsList(reasons) {
    const container = document.getElementById('reasons-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    if (reasons.length === 0) {
        container.innerHTML = `<p style="font-size:0.813rem;color:var(--color-text-muted); padding: 0.5rem 0;">No exit reasons recorded.</p>`;
        return;
    }
    
    const maxVal = Math.max(...reasons.map(r => r.count)) || 1;
    
    reasons.forEach(item => {
        const pct = ((item.count / maxVal) * 100).toFixed(0);
        const div = document.createElement('div');
        div.className = 'reason-item';
        div.innerHTML = `
            <div class="reason-info-row">
                <span>${item.reason}</span>
                <span class="reason-count">${item.count} Exits</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
        `;
        container.appendChild(div);
    });
}

// Bind the tabular registry list at the bottom of the page (Client-side search/sort/pagination on raw API response)
function renderRegistryTable() {
    const tbody = document.getElementById('tbody-registry');
    if (!tbody) return;
    
    // Apply client-side search text filtering
    const searchVal = state.search.registry.toLowerCase();
    let filtered = state.rawExits.filter(d => {
        return (d.employeeId || '').toLowerCase().includes(searchVal) ||
               (d.name || '').toLowerCase().includes(searchVal) ||
               (d.plName || '').toLowerCase().includes(searchVal) ||
               (d.hrbpLead || '').toLowerCase().includes(searchVal);
    });
    
    // Apply client-side sorting
    const col = state.sort.registry.column;
    const order = state.sort.registry.order;
    if (col) {
        filtered.sort((a, b) => {
            let valA = a[col] || '';
            let valB = b[col] || '';
            if (typeof valA === 'string') {
                return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return order === 'asc' ? valA - valB : valB - valA;
            }
        });
    }
    
    // Apply pagination
    const totalCount = filtered.length;
    const pag = state.pagination.registry;
    const totalPages = Math.max(1, Math.ceil(totalCount / pag.size));
    if (pag.page > totalPages) pag.page = totalPages;
    
    const startIdx = (pag.page - 1) * pag.size;
    const pageSubset = filtered.slice(startIdx, startIdx + pag.size);
    
    tbody.innerHTML = '';
    if (pageSubset.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="align-center">No exits records found.</td></tr>';
        return;
    }
    
    pageSubset.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${row.employeeId}</strong></td>
            <td>${row.name}</td>
            <td>${row.gender}</td>
            <td>${row.employeeType}</td>
            <td>${row.hrbpLead}</td>
            <td>${row.plName}</td>
            <td>${row.lastWorkingDay}</td>
            <td><span class="badge ${row.ffStatus === 'Payable' ? 'badge-success' : 'badge-danger'}">${row.ffStatus}</span></td>
            <td class="align-right">${row.ageing || 0}</td>
            <td><span class="badge ${row.clearanceStatus === 'Settled' ? 'badge-success' : 'badge-warning'}">${row.clearanceStatus}</span></td>
            <td class="align-right">₹${(row.settlementAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // Populate pagination footer text and bind buttons
    const countInfo = document.getElementById('registry-count-info');
    if (countInfo) {
        const endRange = Math.min(startIdx + pag.size, totalCount);
        countInfo.textContent = totalCount > 0 ? `Showing ${startIdx + 1}-${endRange} of ${totalCount} records` : '0 records found';
    }
    
    // Bind buttons
    const btnPrev = document.getElementById('btn-prev-registry');
    const btnNext = document.getElementById('btn-next-registry');
    
    if (btnPrev) {
        btnPrev.disabled = pag.page <= 1;
        btnPrev.onclick = () => {
            if (pag.page > 1) {
                pag.page--;
                renderRegistryTable();
            }
        };
    }
    
    if (btnNext) {
        btnNext.disabled = pag.page >= totalPages;
        btnNext.onclick = () => {
            if (pag.page < totalPages) {
                pag.page++;
                renderRegistryTable();
            }
        };
    }
}

// Setup static and dynamic action event listeners
function setupEventListeners() {
    // 1. Tab switches
    document.getElementById('tab-ff').addEventListener('click', () => switchTab('ff'));
    document.getElementById('tab-attrition').addEventListener('click', () => switchTab('attrition'));
    
    // 2. Filter wrapper clicks
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
            dropdowns.forEach(o => {
                if (o.id !== dd.id) {
                    const el = document.getElementById(o.id);
                    if (el) el.classList.remove('open');
                }
            });
            wrapper.classList.toggle('open');
        });
    });
    document.addEventListener('click', () => {
        dropdowns.forEach(dd => {
            const el = document.getElementById(dd.id);
            if (el) el.classList.remove('open');
        });
    });
    
    // 3. Employee type checkbox trigger listeners
    const customDropdown = document.getElementById('dropdown-employee-type');
    if (customDropdown) {
        const allCb = document.getElementById('chk-type-all');
        const itemCbs = customDropdown.querySelectorAll('input[name="chk-type"]');
        allCb.addEventListener('change', () => {
            if (allCb.checked) {
                itemCbs.forEach(cb => cb.checked = true);
                state.filters.employeeType = ['All'];
            } else {
                itemCbs.forEach(cb => cb.checked = false);
                state.filters.employeeType = [];
            }
            updateEmployeeTypeTriggerLabel();
            updateUI();
        });
        itemCbs.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!cb.checked) allCb.checked = false;
                const active = [];
                itemCbs.forEach(c => {
                    if (c.checked) active.push(c.value);
                });
                if (active.length === itemCbs.length) {
                    allCb.checked = true;
                    state.filters.employeeType = ['All'];
                } else {
                    state.filters.employeeType = active;
                }
                updateEmployeeTypeTriggerLabel();
                updateUI();
            });
        });
    }

    // 4. Gender trigger
    document.getElementById('select-gender').addEventListener('change', (e) => {
        state.filters.gender = [e.target.value];
        updateUI();
    });

    // 5. Search registries input listener
    document.getElementById('search-registry').addEventListener('input', (e) => {
        state.search.registry = e.target.value;
        state.pagination.registry.page = 1;
        renderRegistryTable();
    });

    // 6. Registry table header sorts
    document.querySelectorAll('table#table-registry th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            const currentSort = state.sort.registry;
            if (currentSort.column === column) {
                currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.order = 'asc';
            }
            
            th.closest('tr').querySelectorAll('th').forEach(sib => {
                sib.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(currentSort.order === 'asc' ? 'sort-asc' : 'sort-desc');
            state.pagination.registry.page = 1;
            renderRegistryTable();
        });
    });

    // 7. Sync Modal listeners
    const modal = document.getElementById('sync-modal');
    document.getElementById('btn-sync-data').addEventListener('click', () => {
        modal.setAttribute('aria-hidden', 'false');
    });
    const hideModal = () => modal.setAttribute('aria-hidden', 'true');
    document.getElementById('btn-close-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-modal-overlay').addEventListener('click', hideModal);
    document.getElementById('btn-close-modal-footer').addEventListener('click', hideModal);
    
    // Save/sync button calls FastAPI sync immediately
    document.getElementById('btn-save-sheets-config').addEventListener('click', () => {
        triggerImmediateSync();
    });
    
    // 8. Reasons component dropdown pl name filter
    document.getElementById('reasons-pl-select').addEventListener('change', (e) => {
        state.filters.reasons_pl = e.target.value;
        loadDashboardMetrics();
    });
    
    // Reasons tab switches (Voluntary / Involuntary)
    const reasonsBtns = document.querySelectorAll('.reasons-tab-btn');
    reasonsBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            reasonsBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--color-text-muted)';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--color-blue-light)';
            btn.style.color = 'var(--color-blue-accent)';
            state.filters.reasons_tab = btn.getAttribute('data-tab');
            loadDashboardMetrics();
        });
    });

    // 9. Drilldown Pivot Dialog bindings
    document.getElementById('btn-close-pivot').addEventListener('click', closePivotModal);
    document.getElementById('btn-close-pivot-overlay').addEventListener('click', closePivotModal);
    document.getElementById('btn-close-pivot-footer').addEventListener('click', closePivotModal);
    document.getElementById('btn-download-pivot-excel').addEventListener('click', downloadPivotExcel);
    document.getElementById('pivot-row-field').addEventListener('change', rebuildPivotTable);
    document.getElementById('pivot-value-metric').addEventListener('change', rebuildPivotTable);
    
    // 10. Drawer Close trigger
    document.getElementById('btn-close-drawer').addEventListener('click', closeDrawer);
    document.getElementById('btn-close-drawer-overlay').addEventListener('click', closeDrawer);

    // 11. Chart Clicks (Chart JS integration)
    bindChartDrilldowns();
}

function switchTab(tab) {
    state.activeTab = tab;
    
    const tabFF = document.getElementById('tab-ff');
    const tabAttrition = document.getElementById('tab-attrition');
    const sectionFF = document.getElementById('section-ff');
    const sectionAttrition = document.getElementById('section-attrition');
    
    if (tab === 'ff') {
        tabFF.classList.add('active');
        tabAttrition.classList.remove('active');
        sectionFF.classList.remove('hidden');
        sectionAttrition.classList.add('hidden');
    } else {
        tabFF.classList.remove('active');
        tabAttrition.classList.add('active');
        sectionFF.classList.add('hidden');
        sectionAttrition.classList.remove('hidden');
    }
}

function setupModalTabs() {
    const tabs = document.querySelectorAll('.modal-tab-btn');
    const panels = document.querySelectorAll('.modal-tab-panel');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panelId = tab.getAttribute('data-panel');
            document.getElementById(panelId).classList.add('active');
        });
    });
}

function removeStartupOverlay() {
    const overlay = document.getElementById('startup-overlay');
    if (overlay) overlay.style.display = 'none';
}

function showStartupOverlay(msg) {
    const overlay = document.getElementById('startup-overlay');
    if (overlay) overlay.style.display = 'flex';
}

// --- Chart Drilldowns Integration ---
function bindChartDrilldowns() {
    // Add Click listener to canvases
    const canvases = [
        { id: 'chart-ff-status', isFF: true },
        { id: 'chart-ff-pl', isFF: true },
        { id: 'chart-ff-buckets', isFF: true },
        { id: 'chart-ff-ndc-clearance', isFF: true },
        { id: 'chart-attrition-pl', isFF: false },
        { id: 'chart-attrition-voluntary', isFF: false },
        { id: 'chart-attrition-tenure', isFF: false }
    ];
    
    canvases.forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;
        el.onclick = (evt) => {
            const chartRef = charts[item.id.replace('chart-ff-', 'ff').replace('chart-attrition-', 'attrition').replace('ff-ndc-clearance', 'ndcRadar')];
            if (!chartRef) return;
            const points = chartRef.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (points.length) {
                const element = points[0];
                const label = chartRef.data.labels[element.index];
                const datasetLabel = chartRef.data.datasets[element.datasetIndex].label;
                triggerPivotModal(item.id, label, datasetLabel);
            }
        };
    });
}

// --- Drilldown Pivot Modal Builder ---
function triggerPivotModal(chartId, label, datasetLabel) {
    currentPivotChartId = chartId;
    currentPivotIsFF = chartId.startsWith('chart-ff-');
    
    // Filter raw exits matching the chart element clicked
    let subset = [];
    const cleanLabel = label.includes(':') ? label.split(':')[0].trim() : label.trim();
    
    if (chartId === 'chart-ff-status') {
        subset = state.rawExits.filter(d => d.clearanceStatus === cleanLabel);
    } else if (chartId === 'chart-ff-pl') {
        subset = state.rawExits.filter(d => d.plName === cleanLabel);
    } else if (chartId === 'chart-ff-buckets') {
        subset = state.rawExits.filter(d => {
            const monthMatch = d.month === cleanLabel;
            let bucketMatch = false;
            if (datasetLabel === '1-2 days') {
                bucketMatch = d.ageing <= 2;
            } else if (datasetLabel === '2+ days') {
                bucketMatch = d.ageing > 2;
            }
            return monthMatch && bucketMatch;
        });
    } else if (chartId === 'chart-ff-ndc-clearance') {
        const deptKey = cleanLabel.toLowerCase();
        subset = state.rawExits.filter(d => {
            if (!d.lastWorkingDay) return false;
            const dates = d.clearanceDates || {};
            const matches = dates[deptKey] === d.lastWorkingDay;
            return datasetLabel === 'Ontime' ? matches : !matches;
        });
    } else if (chartId === 'chart-attrition-pl') {
        subset = state.rawExits.filter(d => d.hrbpLead === cleanLabel && d.exitType === datasetLabel);
    } else if (chartId === 'chart-attrition-voluntary') {
        subset = state.rawExits.filter(d => d.exitType === cleanLabel);
    } else if (chartId === 'chart-attrition-tenure') {
        subset = state.rawExits.filter(d => {
            const t = d.tenureMonths || 0;
            const yrs = t / 12;
            if (cleanLabel.startsWith('less')) return yrs < 1;
            if (cleanLabel.startsWith('1-2')) return yrs >= 1 && yrs <= 2;
            if (cleanLabel.startsWith('2-4')) return yrs > 2 && yrs <= 4;
            return yrs > 4;
        });
    }
    
    currentPivotSubset = subset;
    
    // Open modal
    const modal = document.getElementById('pivot-modal');
    modal.setAttribute('aria-hidden', 'false');
    
    // Set headers
    document.getElementById('pivot-modal-title').textContent = `Drilldown Details: ${label} [${datasetLabel || ''}]`;
    document.getElementById('pivot-count-badge').textContent = `${subset.length} records`;
    
    rebuildPivotTable();
}

function closePivotModal() {
    document.getElementById('pivot-modal').setAttribute('aria-hidden', 'true');
}

function rebuildPivotTable() {
    const tbody = document.getElementById('tbody-pivot-registry');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (currentPivotSubset.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="align-center">No drilldown records.</td></tr>';
        return;
    }
    
    currentPivotSubset.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${row.employeeId}</strong></td>
            <td>${row.name}</td>
            <td>${row.employeeType}</td>
            <td>${row.hrbpLead}</td>
            <td>${row.plName}</td>
            <td>${row.lastWorkingDay}</td>
            <td class="align-right">₹${(row.settlementAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
        `;
        // Double click to open details drawer
        tr.ondblclick = () => showDrawer(row.employeeId);
        tbody.appendChild(tr);
    });
}

function downloadPivotExcel() {
    if (!currentPivotSubset || currentPivotSubset.length === 0) {
        showToast("No data to export", "warning");
        return;
    }
    
    const exportData = currentPivotSubset.map(item => {
        if (currentPivotChartId === 'chart-ff-ndc-clearance') {
            return {
                'Employee Code': item.employeeId || '',
                'Employee Name': item.name || '',
                'Date of Resignation': item.resignationDate || '',
                'Last Working Date': item.lastWorkingDay || '',
                'F&F Closure Date': item.closureDate || '',
                'Last NDC Trigger Date': item.lastNdcTriggeredDate || '',
                'HRBP NDC Date': item.clearanceDates?.hrbp || '',
                'IT Clearance Date': item.clearanceDates?.it || '',
                'Finance Clearance Date': item.clearanceDates?.finance || '',
                'Admin Clearance Date': item.clearanceDates?.admin || ''
            };
        } else if (currentPivotIsFF) {
            return {
                'Employee ID': item.employeeId || '',
                'Employee Name': item.name || '',
                'Gender': item.gender || '',
                'Employee Type': item.employeeType || '',
                'HRBP Lead': item.hrbpLead || '',
                'P&L Name': item.plName || '',
                'Month': item.month || '',
                'Last Working Day': item.lastWorkingDay || '',
                'F&F Closure Date': item.closureDate || '',
                'Payout Type': item.ffStatus || '',
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
    const sheetName = currentPivotChartId === 'chart-ff-ndc-clearance' ? "NDC Clearance Cases" : (currentPivotIsFF ? "F&F Cases" : "Attrition Cases");
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    const filename = `${sheetName.replace(" ", "_")}_Drilldown_${new Date().toISOString().substring(0,10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    showToast(`Successfully downloaded Excel: ${filename}`, 'success');
}

// --- Detail Slide-out Drawer Builder ---
function showDrawer(empId) {
    const row = state.rawExits.find(d => d.employeeId === empId);
    if (!row) return;
    
    document.getElementById('drawer-emp-id').textContent = row.employeeId;
    document.getElementById('drawer-emp-name').textContent = row.name;
    document.getElementById('drawer-gender').textContent = row.gender;
    document.getElementById('drawer-type').textContent = row.employeeType;
    document.getElementById('drawer-hrbp').textContent = row.hrbpLead;
    document.getElementById('drawer-pl').textContent = row.plName;
    document.getElementById('drawer-dol').textContent = row.lastWorkingDay;
    document.getElementById('drawer-doj').textContent = row.exitDate ? 'Available' : 'N/A'; // basic check
    
    document.getElementById('drawer-payout').textContent = row.ffStatus;
    document.getElementById('drawer-ageing').textContent = `${row.ageing || 0} days`;
    document.getElementById('drawer-clearance').textContent = row.clearanceStatus;
    document.getElementById('drawer-amount').textContent = `₹${(row.settlementAmount || 0).toLocaleString()}`;
    
    // NDC Dates
    const dates = row.clearanceDates || {};
    document.getElementById('drawer-ndc-hrbp').textContent = dates.hrbp || 'Pending';
    document.getElementById('drawer-ndc-it').textContent = dates.it || 'Pending';
    document.getElementById('drawer-ndc-finance').textContent = dates.finance || 'Pending';
    document.getElementById('drawer-ndc-admin').textContent = dates.admin || 'Pending';
    
    const drawer = document.getElementById('details-drawer');
    drawer.classList.add('open');
}

function closeDrawer() {
    document.getElementById('details-drawer').classList.remove('open');
}

// --- Toast and Feedback Notifiers ---
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

    toast.innerHTML = `${iconSvg}<span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    
    toast.offsetHeight; // trigger reflow
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}
