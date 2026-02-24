/**
 * Boost Basketball - Court Booking System Backend
 * To be deployed as a Google Apps Script Web App.
 */

const CONFIG = {
  SHEET_NAME: 'Bookings',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'password123', // In a real app, use better hashing or external auth
  USER_USERNAME: 'user',
  USER_PASSWORD: 'user123',
  CALENDAR_ID: 'primary' // Uses the default calendar of the account
};

/**
 * Initializes the spreadsheet if it doesn't exist.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow([
      'ID', 'Name', 'Contact', 'Email', 'Sport', 'Court', 'Date', 'Start Time', 'End Time', 'Total Price', 'Timestamp', 'Status', 'Payment Type', 'Receipt URL', 'Calendar Event ID'
    ]);
    sheet.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#f3f3f3');
  }
}

/**
 * Handles Authentication
 */
function authenticate(username, password) {
  if (username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD) {
    return { success: true, role: 'admin' };
  } else if (username === CONFIG.USER_USERNAME && password === CONFIG.USER_PASSWORD) {
    return { success: true, role: 'user' };
  }
  return { success: false, message: 'Invalid credentials' };
}

/**
 * Fetches all bookings for Admin
 */
function getBookings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  return data.map((row, index) => {
    let obj = {};
    headers.forEach((h, i) => obj[h.replace(/ /g, '')] = row[i]);
    obj.rowIndex = index + 2; // Keep track of row for cancellation
    return obj;
  });
}

/**
 * Checks for double bookings
 */
function isDoubleBooked(court, date, startTime, endTime) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  data.shift(); // Remove header

  // Convert input times to Date objects for comparison
  const inputDate = new Date(date).toDateString();
  const inputStart = new Date(`${date} ${startTime}`);
  const inputEnd = new Date(`${date} ${endTime}`);

  for (let row of data) {
    const rowStatus = row[10];
    if (rowStatus === 'Cancelled') continue;

    const rowCourt = row[5];
    const rowDate = new Date(row[6]).toDateString();
    const rowStart = new Date(`${row[6]} ${row[7]}`);
    const rowEnd = new Date(`${row[6]} ${row[8]}`);

    if (rowCourt === court && rowDate === inputDate) {
      // Overlap logic: (StartA < EndB) and (EndA > StartB)
      if (inputStart < rowEnd && inputEnd > rowStart) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Submits a new booking
 */
function submitBooking(formData) {
  try {
    const { name, contact, email, sport, court, date, startTime, endTime } = formData;

    // Server-side validation
    if (isDoubleBooked(court, date, startTime, endTime)) {
      return { success: false, message: 'This court is already booked for the selected time.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const timestamp = new Date();
    const id = 'BK-' + timestamp.getTime();

    // 1. Handle Receipt Upload (to Google Drive)
    let receiptUrl = 'None';
    if (formData.receiptData) {
      try {
        const folderName = "Boost Basketball Receipts";
        let folder;
        const folders = DriveApp.getFoldersByName(folderName);
        if (folders.hasNext()) {
          folder = folders.next();
        } else {
          folder = DriveApp.createFolder(folderName);
        }
        
        const blob = Utilities.newBlob(Utilities.base64Decode(formData.receiptData), "image/png", formData.receiptName || "receipt.png");
        const file = folder.createFile(blob);
        receiptUrl = file.getUrl();
      } catch (err) {
        console.error("Upload error: " + err);
      }
    }

    // 2. Create Google Calendar Event
    let eventId = '';
    try {
      const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
      const start = new Date(`${date} ${startTime}`);
      const end = new Date(`${date} ${endTime}`);
      const event = calendar.createEvent(
        `Booking: ${sport} - ${court} (${name})`,
        start,
        end,
        {
          description: `Contact: ${contact}\nEmail: ${email}\nSport: ${sport}\nCourt: ${court}\nPayment: ${formData.paymentMethod}\nReceipt: ${receiptUrl}`,
          guests: email,
          sendInvites: true
        }
      );
      eventId = event.getId();
    } catch (e) {
      console.error('Calendar error: ' + e.message);
    }

    // 3. Add to Google Sheet
    sheet.appendRow([
      id, name, contact, email, sport, court, date, startTime, endTime, formData.totalPrice, timestamp, 'Confirmed', formData.paymentMethod, receiptUrl, eventId
    ]);

    return { success: true, message: 'Booking confirmed!' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

/**
 * Cancels a booking
 */
function cancelBooking(rowIndex, eventId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    // Update status in sheet
    sheet.getRange(rowIndex, 11).setValue('Cancelled');

    // Remove from Calendar
    if (eventId) {
      try {
        const calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
        const event = calendar.getEventById(eventId);
        if (event) event.deleteEvent();
      } catch (e) {
        console.error('Calendar cancellation error: ' + e.message);
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
