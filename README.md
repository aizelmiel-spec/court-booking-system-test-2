# 🏀 Boost Basketball Court Booking System

A premium, localized court booking system integrated with Google Sheets and Google Calendar.

## 📂 Project Structure
- `index.html`: Main frontend (Login, Booking Form, Admin Dashboard).
- `styles.css`: Modern, basketball-themed design system.
- `script.js`: Client-side logic and GAS communication.
- `backend.gs`: Server-side logic for Google Apps Script.

---

## 🚀 Step-by-Step Setup Instructions

### 1. Prepare Google Sheet & Calendar
1. Create a new **Google Sheet**.
2. Rename the first tab to `Bookings`.
3. (Optional) Run the `setup()` function in the script later to generate headers automatically.
4. Note your **Google Calendar ID** (usually your email address if using the primary calendar).

### 2. Setup Google Apps Script (Backend)
1. In your Google Sheet, go to **Extensions > Apps Script**.
2. Delete any existing code and paste the contents of `backend.gs`.
3. Save the project as "Boost Basketball Backend".
4. Add the HTML files to the GAS project:
   - Click `+` next to "Files" > Select **HTML**.
   - Name it `index` (Google adds `.html` automatically). 
   - Paste the contents of `index.html` into it.
   - Repeat for `styles` (create `styles.html` and wrap the CSS in `<style>...</style>`) and `script` (create `script.html` and wrap the JS in `<script>...</script>`).
   
   *Tip: In a standard GAS Web App, you include CSS/JS using `<pre><?!= include('styles'); ?></pre>` style syntax. See "Alternative: Local Frontend" below if you prefer keeping files separate.*

### 3. Deploying the Web App
1. Click the **Deploy** button > **New deployment**.
2. Select **Web app** as the type.
3. **Description**: Boost Booking v1.
4. **Execute as**: Me.
5. **Who has access**: Internal (if for staff) or **Anyone** (if for public users).
6. Click **Deploy**.
7. Copy the **Web App URL**. You will need this if hosting the frontend externally.

### 4. Google Cloud Project & APIs (Advanced)
If you need to manage this via a specific Cloud Project for quotas or branding:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a **New Project** named "Boost Basketball".
3. Search for and **Enable** the following APIs:
   - Google Drive API
   - Google Sheets API
   - Google Calendar API
4. Go to the Apps Script project settings and click **Change Project**, then enter your Google Cloud Project Number.

### 5. Connecting Frontend to Backend
If you are running the `index.html` file **locally** (on your computer):
1. In `script.js`, replace the `google.script.run` calls with a `fetch()` call to your **Web App URL**.
2. You must modify `backend.gs` to include a `doPost(e)` function that returns JSON to handle cross-origin requests.
3. **Recommended approach**: Keep all files inside the Google Apps Script project for seamless `google.script.run` functionality and built-in authentication.

---

---

## 🔐 Configuration & Security
- **Admin/User Roles**: Configured inside the `CONFIG` object in `backend.gs`. 
- **Receipts**: All uploaded receipts are stored in a drive folder named "Boost Basketball Receipts" which is automatically created.
- **Strict Validation**: The system enforces hourly bookings ending in `:00` and calculates prices based on pre-defined rates.

## ✨ Key Features
- **Real-time Checks**: Prevents double bookings on the same court/time.
- **Calendar Sync**: Automatically adds events to the owner's Google Calendar.
- **Admin Control**: Filter by date/court and cancel bookings with one click.
- **Automated Logging**: Every booking is recorded in Google Sheets with a timestamp.
