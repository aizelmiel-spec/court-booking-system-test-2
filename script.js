/**
 * Boost Basketball - Premium Facility Logic
 */

const COURT_OPTIONS = {
    'Whole Basketball': ['Whole Basketball Court'],
    'Half Basketball': ['Half Court 1', 'Half Court 2', 'Half Court 3'],
    'Pickleball': ['Court 1', 'Court 2', 'Court 3']
};

const RATES = {
    'Whole Basketball': 1000,
    'Half Basketball': 500,
    'Pickleball': 300
};

let allBookingsCache = [];
let localRecords = JSON.parse(localStorage.getItem('boost_booking_records') || '[]');
let lastBookingData = null;
let selectedPaymentMethod = '';
let currentViewDate = new Date();
let currentAdminWeekDate = new Date();
let usageChart = null;
let peakHoursChart = null;

function getEffectiveBookings() {
    // Normalize local records to match the backend structure used in the UI
    const normalizedLocal = localRecords.map(r => ({
        Name: r.name,
        Sport: r.sport,
        Court: r.court,
        Date: r.date,
        StartTime: r.startTime,
        EndTime: r.endTime,
        Status: r.status,
        TotalPrice: r.amount,
        PaymentMethod: r.paymentMethod,
        isLocal: true,
        id: r.id
    }));
    return [...allBookingsCache, ...normalizedLocal];
}

// Core User Flow State
let userFlow = {
    sport: '',
    court: '',
    date: '',
    start: null,
    duration: 1,
    total: 0
};

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    initEventListeners();
});

function checkSession() {
    const role = localStorage.getItem('role');
    if (role === 'admin') {
        showView('admin-view');
        loadAdminData();
    } else {
        showView('role-view');
    }
}

function showView(viewId) {
    const views = [
        'role-view', 'auth-view', 'sport-select-view', 'court-select-view',
        'dateTime-view', 'policy-view', 'details-view', 'payment-view', 'admin-view'
    ];

    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = (id === viewId) ? (['dateTime-view', 'admin-view', 'sport-select-view', 'court-select-view'].includes(id) ? 'block' : 'flex') : 'none';
        }
    });

    if (viewId === 'role-view') {
        localStorage.removeItem('role');
    }

    // Auto-Initializers
    if (viewId === 'dateTime-view') {
        document.getElementById('active-court-name').textContent = userFlow.court;
        renderCalendar('flow-calendar', currentViewDate, false, true);
    }
    if (viewId === 'admin-view') {
        switchAdminTab('dashboard', document.querySelector('.admin-tab'));
        loadAdminData();
    }
    if (viewId === 'payment-view') {
        document.getElementById('summary-court-final').textContent = userFlow.court;
        document.getElementById('summary-date-final').textContent = userFlow.date;
        document.getElementById('payment-amt-text').textContent = `₱${userFlow.total.toLocaleString()}`;
    }
}

function switchAdminTab(tabName, el) {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');

    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById(`admin-tab-${tabName}`);
    if (target) target.style.display = 'block';

    if (tabName === 'reservations') updateAdminManCourts();
}

function selectRole(role) {
    if (role === 'user') {
        localStorage.setItem('role', 'user');
        showView('sport-select-view');
    } else if (role === 'admin-login') {
        showView('auth-view');
    }
}

function initEventListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('final-booking-form').addEventListener('submit', handleFinalBookingSubmit);

    const adminManForm = document.getElementById('admin-manual-form');
    if (adminManForm) adminManForm.addEventListener('submit', handleAdminManualSubmit);
}

/**
 * USER SELECTION LOGIC
 */
function selectSportStep(sport) {
    userFlow.sport = sport;
    if (sport === 'Whole Basketball') {
        userFlow.court = 'Whole Basketball Court';
        showView('dateTime-view');
    } else {
        document.getElementById('selected-sport-label').textContent = sport;
        populateCourtCards();
        showView('court-select-view');
    }
}

function populateCourtCards() {
    const grid = document.getElementById('court-options-grid');
    grid.innerHTML = '';
    const courts = COURT_OPTIONS[userFlow.sport];

    const imgMap = {
        'Half Basketball': 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=600&auto=format&fit=crop',
        'Pickleball': 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop'
    };

    courts.forEach(court => {
        const card = document.createElement('div');
        card.className = 'select-card fade-in';
        card.onclick = () => { userFlow.court = court; showView('dateTime-view'); };
        card.innerHTML = `
            <div class="image" style="background-image: url('${imgMap[userFlow.sport]}');"></div>
            <div class="content" style="text-align: center;">
                <h3 style="margin: 0;">${court}</h3>
                <p>Private section for focused play.</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

function goBackFromDateTime() {
    if (userFlow.sport === 'Whole Basketball') {
        showView('sport-select-view');
    } else {
        showView('court-select-view');
    }
}

/**
 * CALENDAR & AVAILABILITY
 */
function renderCalendar(containerId, date, isAdmin = false, isFlow = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const year = date.getFullYear();
    const month = date.getMonth();
    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
    const labelId = isAdmin ? 'admin-cal-month' : 'flow-cal-month';
    const labelEl = document.getElementById(labelId);
    if (labelEl) labelEl.textContent = monthLabel;

    container.innerHTML = '';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
        const div = document.createElement('div');
        div.className = 'cal-day-label';
        div.textContent = day;
        container.appendChild(div);
    });

    const firstDay = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDay; i++) container.appendChild(document.createElement('div'));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const dayDiv = document.createElement('div');
        dayDiv.className = 'cal-day';
        if (dStr === todayStr) dayDiv.classList.add('today');

        if (d < today) {
            dayDiv.classList.add('past');
        } else {
            const eb = getEffectiveBookings();
            const hasActivity = eb.some(b => b.Date === dStr && (b.Status === 'Confirmed' || b.Status === 'Blocked') && (isAdmin || b.Court === userFlow.court));
            if (hasActivity) {
                const dot = document.createElement('div');
                dot.className = 'slot-dot';
                dayDiv.appendChild(dot);
            }

            dayDiv.onclick = () => {
                document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected'));
                dayDiv.classList.add('selected');
                if (isAdmin) {
                    showAdminDailyDetails(dStr);
                } else {
                    userFlow.date = dStr;
                    userFlow.start = null;
                    showFlowSlots(dStr);
                }
            };
        }
        dayDiv.innerHTML += `<span>${day}</span>`;
        container.appendChild(dayDiv);
    }
}

function changeMonth(dir, isAdmin = false, isFlow = false) {
    currentViewDate.setMonth(currentViewDate.getMonth() + dir);
    renderCalendar(isFlow ? 'flow-calendar' : (isAdmin ? 'admin-calendar' : 'user-calendar'), currentViewDate, isAdmin, isFlow);
}

function showFlowSlots(dateStr) {
    const grid = document.getElementById('flow-slots');
    document.getElementById('flow-date-label').textContent = `Booking for ${dateStr}`;
    grid.innerHTML = '';
    document.getElementById('duration-config').style.display = 'none';

    // Availability Check (Both Confirmed & Blocked)
    const eb = getEffectiveBookings();
    const dayBookings = eb.filter(b => b.Date === dateStr && b.Court === userFlow.court && (b.Status === 'Confirmed' || b.Status === 'Blocked'));

    for (let h = 8; h <= 23; h++) {
        const slot = document.createElement('div');
        slot.className = 'time-btn fade-in';
        slot.textContent = formatH(h);

        const isBooked = dayBookings.some(b => {
            const bStart = parseInt(b.StartTime.split(':')[0]);
            const bEnd = parseInt(b.EndTime.split(':')[0]);
            return h >= bStart && h < bEnd;
        });

        if (isBooked) {
            slot.classList.add('booked');
        } else {
            slot.onclick = () => {
                userFlow.start = h;
                document.querySelectorAll('.time-btn').forEach(s => s.classList.remove('selected'));
                slot.classList.add('selected');
                document.getElementById('duration-config').style.display = 'block';
                updateSummary();
            };
        }
        grid.appendChild(slot);
    }
}

function handleDurationInput() {
    const val = parseInt(document.getElementById('flow-duration-input').value);
    userFlow.duration = (isNaN(val) || val < 1) ? 1 : val;
    updateSummary();
}

function updateSummary() {
    if (userFlow.start === null) return;
    const end = userFlow.start + userFlow.duration;
    const totalLabel = document.getElementById('summary-time');

    // Check overlap
    const eb = getEffectiveBookings();
    const overlap = eb.some(b => {
        if (b.Date !== userFlow.date || b.Court !== userFlow.court || (b.Status !== 'Confirmed' && b.Status !== 'Blocked')) return false;
        const bStart = parseInt(b.StartTime.split(':')[0]);
        const bEnd = parseInt(b.EndTime.split(':')[0]);
        return (userFlow.start < bEnd && end > bStart);
    });

    if (overlap) {
        totalLabel.innerHTML = '<span style="color:var(--error);">Overlap Warning! Schedule Error</span>';
        document.getElementById('booking-summary').style.display = 'block';
        return;
    }

    if (end > 24) {
        totalLabel.innerHTML = '<span style="color:var(--error);">Max: 12:00 AM Midnight</span>';
        document.getElementById('booking-summary').style.display = 'block';
        return;
    }

    userFlow.total = RATES[userFlow.sport] * userFlow.duration;
    totalLabel.textContent = `${formatH(userFlow.start)} - ${formatH(end)}`;
    document.getElementById('summary-total').textContent = `₱${userFlow.total.toLocaleString()}`;
    document.getElementById('booking-summary').style.display = 'block';
}

function formatH(h) {
    if (h === 24 || h === 0) return "12:00 AM";
    if (h === 12) return "12:00 PM";
    return h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`;
}

/**
 * FINAL CHECKOUT LOGIC
 */
function goToDetailsStep() {
    if (userFlow.start === null) return alert('Select a start time.');
    showView('details-view');
}

function handleFinalBookingSubmit(e) {
    e.preventDefault();
    const end = userFlow.start + userFlow.duration;
    lastBookingData = {
        name: document.getElementById('cust-name').value,
        contact: document.getElementById('cust-contact').value,
        email: document.getElementById('cust-email').value,
        sport: userFlow.sport,
        court: userFlow.court,
        date: userFlow.date,
        startTime: `${String(userFlow.start).padStart(2, '0')}:00`,
        endTime: `${String(end).padStart(2, '0')}:00`,
        totalPrice: userFlow.total,
        downpayment: userFlow.total * 0.5
    };
    showView('payment-view');
}

function selectPayment(method, el) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');

    const amt = (method === 'GCash Full') ? lastBookingData.totalPrice : lastBookingData.downpayment;
    document.getElementById('active-pay-label').textContent = `₱${amt.toLocaleString()}`;
    document.getElementById('payment-details-area').style.display = 'block';

    // Smooth scroll to action zone
    document.getElementById('payment-details-area').scrollIntoView({ behavior: 'smooth' });
}

function finalizeBooking() {
    if (!selectedPaymentMethod) return alert('Please select a payment method.');

    const fileInput = document.getElementById('receipt-upload');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Action Blocked: Please upload your GCash receipt screenshot to verify and confirm your slot.');
        return;
    }

    setLoading(true);
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        const finalData = {
            ...lastBookingData,
            paymentMethod: selectedPaymentMethod,
            receiptData: base64,
            receiptName: file.name
        };

        // Create Local Record
        const record = {
            id: 'BK-' + Date.now().toString().slice(-6),
            name: finalData.name,
            contact: finalData.contact,
            email: finalData.email,
            sport: finalData.sport,
            court: finalData.court,
            date: finalData.date,
            startTime: finalData.startTime,
            endTime: finalData.endTime,
            duration: (parseInt(finalData.endTime) - parseInt(finalData.startTime)) || 1,
            amount: finalData.totalPrice,
            paymentMethod: finalData.paymentMethod,
            timestamp: new Date().toISOString(),
            status: 'Confirmed'
        };
        addLocalRecord(record);

        if (typeof google !== 'undefined') {
            google.script.run.withSuccessHandler((res) => {
                setLoading(false);
                alert(res.message);
                if (res.success) location.reload();
            }).submitBooking(finalData);
        } else {
            setTimeout(() => {
                setLoading(false);
                alert('Success (Local Mode)! Booking finalized and recorded.');
                location.reload();
            }, 1200);
        }
    };
    reader.readAsDataURL(file);
}

function addLocalRecord(record) {
    localRecords.push(record);
    localStorage.setItem('boost_booking_records', JSON.stringify(localRecords));

    // Trigger immediate UI updates
    updateDashboardStats();
    renderWeeklyCalendar();
}

function renderBookingRecords() {
    applyRecordFilters();
}

function applyRecordFilters() {
    const search = (document.getElementById('record-search')?.value || '').toLowerCase();
    const sport = document.getElementById('record-sport-filter')?.value || 'All';
    const sort = document.getElementById('record-sort')?.value || 'date-desc';
    const tbody = document.getElementById('records-table-body');
    if (!tbody) return;

    let filtered = localRecords.filter(r => {
        const matchSearch = (r.name || '').toLowerCase().includes(search) || (r.id || '').toLowerCase().includes(search);
        const matchSport = sport === 'All' || r.sport === sport;
        return matchSearch && matchSport;
    });

    if (sort === 'date-desc') filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (sort === 'date-asc') filtered.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (sort === 'amount-desc') filtered.sort((a, b) => (b.amount || 0) - (a.amount || 0));

    // Update Summary Stats
    const totalRev = filtered.reduce((sum, r) => sum + (r.status !== 'Cancelled' ? (r.amount || 0) : 0), 0);
    const revEl = document.getElementById('record-total-revenue');
    const countEl = document.getElementById('record-total-count');
    if (revEl) revEl.textContent = `₱${totalRev.toLocaleString()}`;
    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding: 4rem; text-align: center; color: #64748b; font-style: italic; background: #f8fafc;">No matching records found in local storage.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(r => {
        const statusColor = r.status === 'Cancelled' ? '#ef4444' : '#10b981';
        const statusBg = r.status === 'Cancelled' ? '#fef2f2' : '#f0fdf4';

        return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <td style="padding: 1.25rem 1rem;">
                    <span style="font-family: monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: 600; color: #475569;">${r.id}</span>
                </td>
                <td style="padding: 1.25rem 1rem;">
                    <div style="font-weight: 600; color: #1e293b;">${r.name}</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${r.email || 'N/A'} • ${r.contact || 'N/A'}</div>
                </td>
                <td style="padding: 1.25rem 1rem;">
                    <div style="font-weight: 500; color: #334155;">${r.court}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.025em;">${r.sport}</div>
                </td>
                <td style="padding: 1.25rem 1rem;">
                    <div style="color: #475569;">${new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div style="font-size: 0.8125rem; color: var(--primary); font-weight: 600; margin-top: 2px;">${r.startTime} - ${r.endTime}</div>
                </td>
                <td style="padding: 1.25rem 1rem; font-weight: 700; color: #0f172a;">₱${(r.amount || 0).toLocaleString()}</td>
                <td style="padding: 1.25rem 1rem;">
                    <span style="font-size: 0.75rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569;">${r.paymentMethod}</span>
                </td>
                <td style="padding: 1.25rem 1rem;">
                    <span style="display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: ${statusBg}; color: ${statusColor};">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColor}; margin-right: 6px;"></span>
                        ${r.status}
                    </span>
                </td>
                <td style="padding: 1.25rem 1rem; text-align: center;">
                    ${r.status !== 'Cancelled' ? `
                        <button class="btn" style="padding: 6px 12px; font-size: 0.75rem; background: transparent; border: 1px solid #fee2e2; color: #ef4444; border-radius: 6px;" 
                                onclick="cancelLocalRecord('${r.id}')">Cancel</button>
                    ` : `
                        <span style="color: #94a3b8; font-size: 0.75rem;">Archived</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function cancelLocalRecord(id) {
    if (!confirm('Are you sure you want to mark this record as CANCELLED?')) return;
    const idx = localRecords.findIndex(r => r.id === id);
    if (idx !== -1) {
        localRecords[idx].status = 'Cancelled';
        localStorage.setItem('boost_booking_records', JSON.stringify(localRecords));
        applyRecordFilters();

        // Refresh all views to show the cancelled status immediately
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
        if (typeof renderWeeklyCalendar === 'function') renderWeeklyCalendar();
    }
}

/**
 * ADMIN FUNCTIONS
 */
function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    setLoading(true);

    if (typeof google !== 'undefined') {
        google.script.run.withSuccessHandler((res) => {
            setLoading(false);
            if (res.success) { localStorage.setItem('role', 'admin'); checkSession(); }
            else alert(res.message);
        }).authenticate(user, pass);
    } else {
        // Mock Login
        setTimeout(() => {
            setLoading(false);
            if (user === 'admin' && pass === 'password123') { localStorage.setItem('role', 'admin'); checkSession(); }
            else alert('Access Denied: Invalid Credentials');
        }, 600);
    }
}

function loadAdminData() {
    setLoading(true);
    if (typeof google !== 'undefined') {
        google.script.run.withSuccessHandler((res) => {
            allBookingsCache = res;
            updateDashboardStats();
            renderWeeklyCalendar();
            applyRecordFilters();
            setLoading(false);
        }).getBookings();
    } else {
        // Mock Data
        setTimeout(() => {
            allBookingsCache = [
                { Name: 'Pro Training', Sport: 'Whole Basketball', Court: 'Whole Basketball Court', Date: new Date().toISOString().split('T')[0], StartTime: '10:00', EndTime: '12:00', Status: 'Confirmed', TotalPrice: 2000, PaymentMethod: 'Manual' },
                { Name: 'Weekend Warrior', Sport: 'Half Basketball', Court: 'Half Court 1', Date: new Date().toISOString().split('T')[0], StartTime: '15:00', EndTime: '16:00', Status: 'Confirmed', TotalPrice: 500, PaymentMethod: 'Manual' }
            ];
            updateDashboardStats();
            renderWeeklyCalendar();
            applyRecordFilters();
            setLoading(false);
        }, 500);
    }
}

function updateDashboardStats() {
    const now = new Date();
    const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const eb = getEffectiveBookings();
    const confirmedOnly = eb.filter(b => b.Status === 'Confirmed' || b.Status === 'Paid (Full)' || b.Status === 'Paid (Downpayment)');
    const todayBookings = eb.filter(b => b.Date === today);
    const uniqueCusts = new Set(eb.map(b => b.Name)).size;
    const activeCourts = new Set(todayBookings.map(b => b.Court)).size;

    document.getElementById('stat-today-count').textContent = todayBookings.length;
    document.getElementById('stat-total-cust').textContent = uniqueCusts;
    document.getElementById('stat-active-courts').textContent = `${activeCourts}/7`;

    document.getElementById('stat-future-count').textContent = eb.filter(b => b.Date >= today && b.Status === 'Confirmed').length;
    document.getElementById('stat-blocked-count').textContent = eb.filter(b => b.Status === 'Blocked').length;

    // Charts Integration
    renderUsageChart(confirmedOnly);
    renderPeakHoursChart(confirmedOnly);
}

function renderUsageChart(confirmed) {
    const ctx = document.getElementById('usageDonutChart');
    if (!ctx) return;

    const dataMap = { 'Whole Basketball': 0, 'Half Basketball': 0, 'Pickleball': 0 };
    confirmed.forEach(b => {
        if (dataMap.hasOwnProperty(b.Sport)) dataMap[b.Sport]++;
        else if (b.sport && dataMap.hasOwnProperty(b.sport)) dataMap[b.sport]++;
    });

    const labels = Object.keys(dataMap);
    const values = Object.values(dataMap);

    if (usageChart) usageChart.destroy();
    usageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#FF5F1F', '#0F172A', '#10B981'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
            },
            cutout: '70%'
        }
    });
}

function renderPeakHoursChart(confirmed) {
    const ctx = document.getElementById('peakHoursBarChart');
    if (!ctx) return;

    const hourCounts = {};
    // Populate 6AM to 11PM
    for (let h = 6; h <= 23; h++) hourCounts[h] = 0;

    confirmed.forEach(b => {
        const start = parseInt((b.StartTime || b.startTime || '0:0').split(':')[0]);
        if (hourCounts.hasOwnProperty(start)) hourCounts[start]++;
    });

    const labels = Object.keys(hourCounts).map(h => formatH_Short(parseInt(h)));
    const values = Object.values(hourCounts);

    if (peakHoursChart) peakHoursChart.destroy();
    peakHoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bookings',
                data: values,
                backgroundColor: 'rgba(255, 95, 31, 0.1)',
                borderColor: '#FF5F1F',
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderWeeklyCalendar() {
    const filter = document.getElementById('admin-cal-filter').value;
    const daysHeader = document.getElementById('calendar-days-header');
    const timeColumn = document.getElementById('calendar-time-column');
    const gridLines = document.getElementById('calendar-grid-lines');
    const eventsLayer = document.getElementById('calendar-events-layer');

    if (!daysHeader) return;

    daysHeader.innerHTML = '';
    timeColumn.innerHTML = '';
    gridLines.innerHTML = '';
    eventsLayer.innerHTML = '';

    // 1. Render Days Header (Sunday to Saturday)
    const now = new Date();
    const startDate = new Date(currentAdminWeekDate);
    startDate.setDate(currentAdminWeekDate.getDate() - currentAdminWeekDate.getDay()); // Go back to Sunday

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);

        // Manual local YYYY-MM-DD to avoid timezone shifting
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const dStr = `${y}-${m}-${day}`;

        weekDates.push(dStr);

        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-label';
        // Add a visual indicator if it's today
        const isToday = d.toDateString() === now.toDateString();
        dayDiv.style.background = isToday ? '#FFF7ED' : 'transparent';
        if (isToday) dayDiv.style.borderBottom = '3px solid var(--primary)';

        dayDiv.innerHTML = `
            <div class="dow" style="${isToday ? 'color: var(--primary);' : ''}">${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div class="dom" style="${isToday ? 'color: var(--primary);' : ''}">${d.getDate()}</div>
        `;
        daysHeader.appendChild(dayDiv);
    }

    // 2. Render Time Column (6 AM to 11 PM)
    for (let h = 6; h <= 23; h++) {
        const label = document.createElement('div');
        label.className = 'time-slot-label';
        label.textContent = formatH_Short(h);
        timeColumn.appendChild(label);

        const row = document.createElement('div');
        row.className = 'grid-row';
        row.style.height = '60px'; // Explicit height for click calculation
        gridLines.appendChild(row);
    }

    // Add click handler to grid for manual booking
    gridLines.onclick = (e) => {
        const rect = gridLines.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        const hour = 6 + Math.floor(y / 60);
        const dayIdx = Math.floor(x / (rect.width / 7));

        if (hour >= 6 && hour <= 23 && dayIdx >= 0 && dayIdx < 7) {
            const targetDate = weekDates[dayIdx];
            const startTime = `${hour.toString().padStart(2, '0')}:00`;
            const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

            // Switch to Reservations Tab and fill data
            switchAdminTab('reservations', document.querySelectorAll('.admin-tab')[2]);
            document.getElementById('admin-man-date').value = targetDate;
            document.getElementById('admin-man-start').value = startTime;
            document.getElementById('admin-man-end').value = endTime;
            const filterVal = document.getElementById('admin-cal-filter').value;
            if (filterVal !== 'All') {
                document.getElementById('admin-man-court').value = filterVal;
                // Need to ensure the sport select is also correct
                for (let sport in COURT_OPTIONS) {
                    if (COURT_OPTIONS[sport].includes(filterVal)) {
                        document.getElementById('admin-man-sport').value = sport;
                        break;
                    }
                }
            }
        }
    };

    // 3. Render Events Columns
    const eb = getEffectiveBookings();
    weekDates.forEach((dStr, dayIdx) => {
        const col = document.createElement('div');
        col.className = 'day-events-column';

        const dayBookings = eb.filter(b => {
            if (b.Date !== dStr || b.Status === 'Cancelled') return false;
            const bCourtName = b.Court || b.court;
            if (filter !== 'All' && bCourtName !== filter) return false;
            return true;
        }).map(b => {
            const startH = parseInt((b.StartTime || b.startTime).split(':')[0]);
            const endH = parseInt((b.EndTime || b.endTime).split(':')[0]);
            return { ...b, startH, endH };
        }).sort((a, b) => a.startH - b.startH || (a.endH - a.startH) - (b.endH - b.startH));

        // Laning Algorithm
        const clusters = [];
        dayBookings.forEach(booking => {
            let placed = false;
            for (let cluster of clusters) {
                const lastInCluster = cluster[cluster.length - 1];
                if (booking.startH < Math.max(...cluster.map(cb => cb.endH))) {
                    cluster.push(booking);
                    placed = true;
                    break;
                }
            }
            if (!placed) clusters.push([booking]);
        });

        clusters.forEach(cluster => {
            const columns = [];
            cluster.forEach(booking => {
                let colIdx = 0;
                while (columns[colIdx] && columns[colIdx].some(b => booking.startH < b.endH && booking.endH > b.startH)) {
                    colIdx++;
                }
                if (!columns[colIdx]) columns[colIdx] = [];
                columns[colIdx].push(booking);
                booking.colIdx = colIdx;
            });
            const maxCols = columns.length;
            cluster.forEach(booking => {
                booking.totalCols = maxCols;
            });
        });

        dayBookings.forEach(b => {
            if (b.startH >= 6 && b.startH <= 23) {
                const block = document.createElement('div');
                const cat = (b.Sport || b.sport || '').toLowerCase();
                const category = cat.includes('whole') ? 'whole' :
                    cat.includes('half') ? 'half' :
                        b.Status === 'Blocked' ? 'blocked' : 'pickle';

                block.className = `event-block ${category}`;
                const top = (b.startH - 6) * 60;
                const height = (b.endH - b.startH) * 60;

                const width = 100 / b.totalCols;
                const left = b.colIdx * width;

                block.style.top = `${top}px`;
                block.style.height = `${height}px`;
                block.style.left = `${left}%`;
                block.style.width = `calc(${width}% - 4px)`;
                block.style.margin = '0 2px';

                block.innerHTML = `
                    <h6 title="${b.Name || b.name}">${b.Name || b.name}</h6>
                    <div class="meta" style="font-weight:600;">${b.Court || b.court}</div>
                    <div class="meta">${formatH_Short(b.startH)} - ${formatH_Short(b.endH)}</div>
                `;

                block.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`Booking Summary:\nUser: ${b.Name || b.name}\nCourt: ${b.Court || b.court}\nTime: ${b.StartTime || b.startTime} - ${b.EndTime || b.endTime}\n\nDo you want to CANCEL this booking?`)) {
                        cancelReservation(b);
                    }
                };
                col.appendChild(block);
            }
        });
        eventsLayer.appendChild(col);
    });
}

function formatH_Short(h) {
    if (h === 0 || h === 24) return '12 AM';
    if (h === 12) return '12 PM';
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

function navigateAdminWeek(dir) {
    if (dir === 0) {
        currentAdminWeekDate = new Date();
    } else {
        currentAdminWeekDate.setDate(currentAdminWeekDate.getDate() + (dir * 7));
    }
    renderWeeklyCalendar();
}

function cancelReservation(b) {
    if (b.isLocal) {
        cancelLocalRecord(b.id);
        return;
    }
    setLoading(true);
    if (typeof google !== 'undefined') {
        google.script.run.withSuccessHandler(res => {
            setLoading(false);
            if (res.success) { alert('Cancelled'); loadAdminData(); }
            else alert(res.message);
        }).cancelBooking(b.rowIndex, b.CalendarEventID);
    } else {
        setTimeout(() => { setLoading(false); alert('Cancelled (Mock)'); loadAdminData(); }, 500);
    }
}

function handleAdminManualSubmit(e) {
    e.preventDefault();
    const status = document.getElementById('admin-man-status').value;
    const formData = {
        name: status === 'Blocked' ? 'FACILITY MAINTENANCE' : document.getElementById('admin-man-name').value,
        sport: document.getElementById('admin-man-sport').value,
        court: document.getElementById('admin-man-court').value,
        date: document.getElementById('admin-man-date').value,
        startTime: document.getElementById('admin-man-start').value,
        endTime: document.getElementById('admin-man-end').value,
        paymentMethod: status,
        status: status === 'Blocked' ? 'Blocked' : 'Confirmed',
        totalPrice: status === 'Blocked' ? 0 : (RATES[document.getElementById('admin-man-sport').value] || 0),
        contact: 'INTERNAL', email: 'INTERNAL'
    };

    // --- OVERLAP VALIDATION ---
    const newStart = parseInt(formData.startTime.replace(':', ''));
    const newEnd = parseInt(formData.endTime.replace(':', ''));

    if (newStart >= newEnd) {
        alert("Action Blocked: Start time must be earlier than End time.");
        return;
    }

    const eb = getEffectiveBookings();
    const conflict = eb.find(b => {
        // Only check same date, same court, and non-cancelled items
        if (b.Date !== formData.date || b.Court !== formData.court || b.Status === 'Cancelled') return false;

        const bStart = parseInt((b.StartTime || b.startTime || '00:00').replace(':', ''));
        const bEnd = parseInt((b.EndTime || b.endTime || '00:00').replace(':', ''));

        // Intersection check
        return (newStart < bEnd && newEnd > bStart);
    });

    if (conflict) {
        alert(`CRITICAL: DOUBLE-BOOKING DETECTED\n\n${formData.court} is already occupied during this time.\nExisting Booking: ${conflict.Name} (${conflict.StartTime} - ${conflict.EndTime})`);
        return;
    }
    // --------------------------

    setLoading(true);
    if (typeof google !== 'undefined') {
        google.script.run.withSuccessHandler((res) => {
            setLoading(false);
            if (res.success) {
                alert('Entry Recorded Successfully.');
                document.getElementById('admin-manual-form').reset();
                loadAdminData();

                // Add to local records
                const rec = {
                    id: 'ADM-' + Date.now().toString().slice(-6),
                    name: formData.name,
                    contact: 'POS-ENTRY', email: 'POS-ENTRY',
                    sport: formData.sport, court: formData.court,
                    date: formData.date, startTime: formData.startTime, endTime: formData.endTime,
                    duration: (parseInt(formData.endTime) - parseInt(formData.startTime)) || 1,
                    amount: formData.totalPrice, paymentMethod: 'Counter',
                    timestamp: new Date().toISOString(), status: formData.status
                };
                addLocalRecord(rec);
            } else alert(res.message);
        }).submitBooking(formData);
    } else {
        setTimeout(() => {
            setLoading(false);
            alert('Entry Recorded (Mock)');

            // Add to local records in mock mode too
            const rec = {
                id: 'ADM-' + Date.now().toString().slice(-6),
                name: formData.name,
                contact: 'POS-ENTRY', email: 'POS-ENTRY',
                sport: formData.sport, court: formData.court,
                date: formData.date, startTime: formData.startTime, endTime: formData.endTime,
                duration: (parseInt(formData.endTime) - parseInt(formData.startTime)) || 1,
                amount: formData.totalPrice, paymentMethod: 'Counter',
                timestamp: new Date().toISOString(), status: formData.status
            };
            addLocalRecord(rec);

            loadAdminData();
            document.getElementById('admin-manual-form').reset();
        }, 600);
    }
}

function updateAdminManCourts() {
    const s = document.getElementById('admin-man-sport').value;
    const c = document.getElementById('admin-man-court');
    c.innerHTML = '';
    COURT_OPTIONS[s].forEach(court => {
        const o = document.createElement('option');
        o.value = court; o.textContent = court;
        c.appendChild(o);
    });
}
function logout() { localStorage.removeItem('role'); location.reload(); }
function setLoading(loading) { document.getElementById('loading-overlay').style.display = loading ? 'flex' : 'none'; }
