/**
 * Boost Basketball - Frontend Logic
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

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    initEventListeners();
});

function checkSession() {
    const role = localStorage.getItem('role');
    if (role === 'admin') {
        showView('admin-view');
        loadAdminData();
    } else if (role === 'user') {
        showView('user-view');
    } else {
        showView('role-view');
    }
}

function showView(viewId) {
    const views = ['role-view', 'auth-view', 'user-view', 'admin-view', 'payment-view'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = (id === viewId) ? (id.includes('view') && !id.includes('admin') && !id.includes('user') && !id.includes('payment') ? 'flex' : 'block') : 'none';
            // Flex for auth/role cards
            if (id === 'role-view' || id === 'auth-view') {
                el.style.display = (id === viewId) ? 'flex' : 'none';
            }
        }
    });

    if (viewId === 'role-view') localStorage.removeItem('role');
}

function selectRole(role) {
    if (role === 'user') {
        localStorage.setItem('role', 'user');
        checkSession();
    } else {
        showView('auth-view');
    }
}

function initEventListeners() {
    // Login Form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Sport Select -> Court Select Update
    document.getElementById('select-sport').addEventListener('change', (e) => {
        const sport = e.target.value;
        const courtSelect = document.getElementById('select-court');
        courtSelect.innerHTML = '<option value="" disabled selected>Select Court</option>';

        if (COURT_OPTIONS[sport]) {
            COURT_OPTIONS[sport].forEach(court => {
                const opt = document.createElement('option');
                opt.value = court;
                opt.textContent = court;
                courtSelect.appendChild(opt);
            });
            courtSelect.disabled = false;
        } else {
            courtSelect.disabled = true;
        }
    });

    // Time Change -> Price Update
    ['book-start', 'book-end', 'select-sport'].forEach(id => {
        document.getElementById(id).addEventListener('change', updatePriceDisplay);
    });

    // Booking Form
    document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);

    // Admin Filter Update
    document.getElementById('filter-sport').addEventListener('change', (e) => {
        const sport = e.target.value;
        const courtSelect = document.getElementById('filter-court');
        courtSelect.innerHTML = '<option value="">All Courts</option>';

        if (COURT_OPTIONS[sport]) {
            COURT_OPTIONS[sport].forEach(court => {
                const opt = document.createElement('option');
                opt.value = court;
                opt.textContent = court;
                courtSelect.appendChild(opt);
            });
        }
        applyFilters();
    });
}

/**
 * AUTHENTICATION
 */
function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorEl = document.getElementById('auth-error');

    setLoading(true);

    // In a real Google Apps Script deployment, we use google.script.run
    if (typeof google !== 'undefined') {
        google.script.run
            .withSuccessHandler((res) => {
                setLoading(false);
                if (res.success) {
                    localStorage.setItem('role', res.role);
                    checkSession();
                } else {
                    errorEl.textContent = res.message;
                    errorEl.style.display = 'block';
                }
            })
            .authenticate(user, pass);
    } else {
        // MOCK for local development
        setTimeout(() => {
            setLoading(false);
            if (user === 'admin' && pass === 'password123') {
                localStorage.setItem('role', 'admin');
                checkSession();
            } else if (user === 'user' && pass === 'user123') {
                localStorage.setItem('role', 'user');
                checkSession();
            } else {
                errorEl.textContent = 'Invalid credentials. Please contact management.';
                errorEl.style.display = 'block';
            }
        }, 800);
    }
}

function logout() {
    localStorage.removeItem('role');
    showView('role-view');
}

/**
 * BOOKING SUBMISSION
 */
function handleBookingSubmit(e) {
    e.preventDefault();

    const startTime = document.getElementById('book-start').value;
    const endTime = document.getElementById('book-end').value;

    const startH = parseInt(startTime.split(':')[0]);
    const endH = parseInt(endTime.split(':')[0]);
    const duration = endH - startH;

    if (duration < 1) {
        alert('Minimum booking is 1 hour. End time must be after start time.');
        return;
    }

    const sport = document.getElementById('select-sport').value;
    const totalPrice = RATES[sport] * duration;

    const formData = {
        name: document.getElementById('cust-name').value,
        contact: document.getElementById('cust-contact').value,
        email: document.getElementById('cust-email').value,
        sport: sport,
        court: document.getElementById('select-court').value,
        date: document.getElementById('book-date').value,
        startTime: startTime,
        endTime: endTime,
        totalPrice: totalPrice,
        downpayment: totalPrice * 0.5
    };

    // Instead of immediate submission, show payment summary
    showPaymentSummary(formData);
}

function showPaymentSummary(data) {
    lastBookingData = data;
    document.getElementById('summary-court').textContent = data.court;
    document.getElementById('summary-date').textContent = data.date;
    showView('payment-view');
}

function updatePriceDisplay() {
    const start = document.getElementById('book-start').value;
    const end = document.getElementById('book-end').value;
    const sport = document.getElementById('select-sport').value;

    if (start && end && sport) {
        const startH = parseInt(start.split(':')[0]);
        const endH = parseInt(end.split(':')[0]);
        const dur = endH - startH;
        if (dur >= 1) {
            const total = RATES[sport] * dur;
            document.getElementById('total-val').textContent = `₱${total}`;
            document.getElementById('down-val').textContent = `₱${total * 0.5}`;
            document.getElementById('booking-total').style.display = 'block';
            return;
        }
    }
    document.getElementById('booking-total').style.display = 'none';
}

function selectPayment(method, el) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');

    const amt = (method === 'GCash Full') ? lastBookingData.totalPrice : lastBookingData.downpayment;
    document.getElementById('payment-amt-text').textContent = `₱${amt}`;
    document.getElementById('payment-details-area').style.display = 'block';
}

function finalizeBooking() {
    if (!selectedPaymentMethod) {
        alert('Please select a payment method.');
        return;
    }

    const fileInput = document.getElementById('receipt-upload');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please upload your GCash receipt screenshot.');
        return;
    }

    setLoading(true);

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        const base64 = e.target.result.split(',')[1];
        const finalData = {
            ...lastBookingData,
            paymentMethod: selectedPaymentMethod,
            receiptData: base64,
            receiptName: file.name
        };

        if (typeof google !== 'undefined') {
            google.script.run
                .withSuccessHandler((res) => {
                    setLoading(false);
                    alert(res.message);
                    if (res.success) {
                        document.getElementById('booking-form').reset();
                        document.getElementById('receipt-upload').value = '';
                        selectedPaymentMethod = '';
                        showView('user-view');
                    }
                })
                .submitBooking(finalData);
        } else {
            // MOCK
            setTimeout(() => {
                setLoading(false);
                alert(`Booking Finalized! Receipt uploaded. (Mock Success)`);
                document.getElementById('booking-form').reset();
                showView('user-view');
            }, 1500);
        }
    };
    reader.readAsDataURL(file);
}

/**
 * ADMIN DATA
 */
function loadAdminData() {
    setLoading(true);
    if (typeof google !== 'undefined') {
        google.script.run
            .withSuccessHandler((data) => {
                allBookingsCache = data;
                renderBookingsTable(data);
                setLoading(false);
            })
            .getBookings();
    } else {
        // MOCK table data
        allBookingsCache = [
            { rowIndex: 2, Name: 'John Doe', Sport: 'Pickleball', Court: 'Court 1', Date: '2026-02-25', StartTime: '10:00', EndTime: '11:00', Status: 'Confirmed', CalendarEventID: 'mock1' },
            { rowIndex: 3, Name: 'Jane Smith', Sport: 'Whole Basketball', Court: 'Whole Basketball Court', Date: '2026-02-26', StartTime: '14:00', EndTime: '16:00', Status: 'Cancelled', CalendarEventID: 'mock2' }
        ];
        renderBookingsTable(allBookingsCache);
        setLoading(false);
    }
}

function renderBookingsTable(data) {
    const tbody = document.getElementById('bookings-body');
    const thead = document.querySelector('#bookings-table thead tr');

    // Update headers for more info
    thead.innerHTML = `
        <th>Name</th>
        <th>Sport / Court</th>
        <th>Date & Time</th>
        <th>Payment / Price</th>
        <th>Receipt</th>
        <th>Status</th>
        <th>Actions</th>
    `;

    tbody.innerHTML = '';
    updateAdminDashboard(data);

    data.forEach(booking => {
        const tr = document.createElement('tr');
        const statusBadge = `<span class="badge badge-${booking.Status.toLowerCase()}">${booking.Status}</span>`;
        const actionBtn = booking.Status === 'Confirmed'
            ? `<button class="btn" style="background:#dc3545; padding: 5px 10px; font-size: 0.7rem;" onclick="cancelBooking(${booking.rowIndex}, '${booking.CalendarEventID}')">Cancel</button>`
            : '-';

        const receiptLink = booking.ReceiptURL && booking.ReceiptURL !== 'None'
            ? `<a href="${booking.ReceiptURL}" target="_blank" style="color: var(--primary); font-size: 0.8rem;">View</a>`
            : '<small style="opacity:0.5">N/A</small>';

        tr.innerHTML = `
            <td><b>${booking.Name}</b></td>
            <td>${booking.Sport}<br><small style="opacity: 0.6">${booking.Court}</small></td>
            <td>${booking.Date}<br><small>${booking.StartTime} - ${booking.EndTime}</small></td>
            <td><small>${booking.PaymentType || booking.PaymentMethod}</small><br><b>₱${booking.TotalPrice || 0}</b></td>
            <td>${receiptLink}</td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function cancelBooking(rowIndex, eventId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    setLoading(true);
    if (typeof google !== 'undefined') {
        google.script.run
            .withSuccessHandler((res) => {
                if (res.success) {
                    loadAdminData();
                } else {
                    alert('Error: ' + res.message);
                    setLoading(false);
                }
            })
            .cancelBooking(rowIndex, eventId);
    } else {
        // MOCK
        setTimeout(() => {
            alert('Cancelled (Mock)');
            allBookingsCache.find(b => b.rowIndex === rowIndex).Status = 'Cancelled';
            renderBookingsTable(allBookingsCache);
            setLoading(false);
        }, 500);
    }
}

/**
 * FILTERS
 */
function applyFilters() {
    const date = document.getElementById('filter-date').value;
    const sport = document.getElementById('filter-sport').value;
    const court = document.getElementById('filter-court').value;

    const filtered = allBookingsCache.filter(b => {
        const matchesDate = !date || b.Date.includes(date);
        const matchesSport = !sport || b.Sport === sport;
        const matchesCourt = !court || b.Court === court;
        return matchesDate && matchesSport && matchesCourt;
    });

    renderBookingsTable(filtered);
}

/**
 * UTILS
 */
function setLoading(loading) {
    document.getElementById('loading-overlay').style.display = loading ? 'flex' : 'none';
}

function updateAdminDashboard(data) {
    const today = new Date().toISOString().split('T')[0];
    const todaysBookings = data.filter(b => b.Date.includes(today));
    const activeBookings = todaysBookings.filter(b => b.Status !== 'Cancelled');

    document.getElementById('stat-today-count').textContent = todaysBookings.length;
    document.getElementById('stat-cancellations').textContent = todaysBookings.filter(b => b.Status === 'Cancelled').length;

    // Utilization (7 courts total)
    const uniqueCourts = new Set(activeBookings.map(b => b.Court)).size;
    document.getElementById('stat-active-courts').textContent = `${uniqueCourts}/7`;

    const util = todaysBookings.length > 0 ? Math.round((activeBookings.length / todaysBookings.length) * 100) : 0;
    document.getElementById('stat-utilization').textContent = `${util}%`;
}
