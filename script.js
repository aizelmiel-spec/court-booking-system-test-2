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
let lastBookingData = null;
let selectedPaymentMethod = '';
let currentViewDate = new Date();

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
            const hasActivity = allBookingsCache.some(b => b.Date === dStr && (b.Status === 'Confirmed' || b.Status === 'Blocked') && (isAdmin || b.Court === userFlow.court));
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
    const dayBookings = allBookingsCache.filter(b => b.Date === dateStr && b.Court === userFlow.court && (b.Status === 'Confirmed' || b.Status === 'Blocked'));

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
    const overlap = allBookingsCache.some(b => {
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

        if (typeof google !== 'undefined') {
            google.script.run.withSuccessHandler((res) => {
                setLoading(false);
                alert(res.message);
                if (res.success) location.reload();
            }).submitBooking(finalData);
        } else {
            // MOCK Success for local preview
            setTimeout(() => {
                setLoading(false);
                alert('Success (Local Mode)! Booking finalized with receipt verification.');
                location.reload();
            }, 1200);
        }
    };
    reader.readAsDataURL(file);
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
            setLoading(false);
        }, 500);
    }
}

function updateDashboardStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = allBookingsCache.filter(b => b.Date === today);
    const uniqueCusts = new Set(allBookingsCache.map(b => b.Name)).size;
    const activeCourts = new Set(todayBookings.map(b => b.Court)).size;

    document.getElementById('stat-today-count').textContent = todayBookings.length;
    document.getElementById('stat-total-cust').textContent = uniqueCusts;
    document.getElementById('stat-active-courts').textContent = `${activeCourts}/7`;

    document.getElementById('stat-future-count').textContent = allBookingsCache.filter(b => b.Date >= today && b.Status === 'Confirmed').length;
    document.getElementById('stat-blocked-count').textContent = allBookingsCache.filter(b => b.Status === 'Blocked').length;
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

    // 1. Render Days Header (7 days starting from today)
    const today = new Date();
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        weekDates.push(dStr);

        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-label';
        dayDiv.innerHTML = `
            <div class="dow">${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div class="dom">${d.getDate()}</div>
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
    weekDates.forEach((dStr, dayIdx) => {
        const col = document.createElement('div');
        col.className = 'day-events-column';

        const dayBookings = allBookingsCache.filter(b => {
            if (b.Date !== dStr || b.Status === 'Cancelled') return false;
            const bCourtName = b.Court || b.court; // Normalize based on backend field names
            if (filter !== 'All' && bCourtName !== filter) return false;
            return true;
        });

        dayBookings.forEach(b => {
            const startH = parseInt(b.StartTime.split(':')[0]);
            const endH = parseInt(b.EndTime.split(':')[0]);

            if (startH >= 6 && startH <= 23) {
                const block = document.createElement('div');
                const cat = (b.Sport || b.sport || '').toLowerCase();
                const category = cat.includes('whole') ? 'whole' :
                    cat.includes('half') ? 'half' :
                        b.Status === 'Blocked' ? 'blocked' : 'pickle';

                block.className = `event-block ${category}`;
                const top = (startH - 6) * 60;
                const height = (endH - startH) * 60;

                block.style.top = `${top}px`;
                block.style.height = `${height}px`;
                block.innerHTML = `
                    <h6>${b.Name || b.name}</h6>
                    <div class="meta">${b.Court || b.court}</div>
                    <div class="meta">${formatH_Short(startH)} - ${formatH_Short(endH)}</div>
                `;

                block.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`Booking Summary:\nUser: ${b.Name || b.name}\nCourt: ${b.Court || b.court}\nTime: ${b.StartTime} - ${b.EndTime}\n\nDo you want to CANCEL this booking?`)) {
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

function cancelReservation(b) {
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
        totalPrice: status === 'Blocked' ? 0 : RATES[document.getElementById('admin-man-sport').value],
        contact: 'INTERNAL', email: 'INTERNAL'
    };

    setLoading(true);
    if (typeof google !== 'undefined') {
        google.script.run.withSuccessHandler((res) => {
            setLoading(false);
            if (res.success) {
                alert('Entry Recorded Successfully.');
                document.getElementById('admin-manual-form').reset();
                loadAdminData();
            } else alert(res.message);
        }).submitBooking(formData);
    } else {
        setTimeout(() => {
            setLoading(false);
            alert('Entry Recorded (Mock)');
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
