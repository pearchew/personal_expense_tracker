# Personal Expense Tracker 📉

> A zero-cost, serverless, offline-capable personal finance ecosystem built for the frustrated minimalist. No subscriptions, no ads, no forced banking integrations—just your data, perfectly formatted, exactly how you want it.

## 🧠 The Philosophy
Modern budgeting apps are bloated. They charge you $10/month to look at your own money, sell your data, and take 15 seconds to load a dashboard. ZenSpend is a radical departure. It uses a **Bring Your Own Database (BYOD)** architecture, leveraging Google Sheets as a free backend, Apple Shortcuts as an ingestion engine, and a React Native Web App as a lightning-fast frontend. 

## 🏗️ The Architecture

### 1. The Backend (Google Sheets)
* **Zero Cost:** Hosted entirely on a personal Google Sheet.
* **Write:** Receives POST requests via a linked Google Form URL.
* **Read:** Published to the web as a CSV, completely bypassing complex API authentication.

### 2. The Ingestion Engine (Apple Shortcuts)
Data enters the ecosystem via a suite of native iOS Shortcuts, running silently in the background:
* 📝 **Manual Logging:** A rapid-fire prompt for Amount, Category, and Note.
* 📸 **AI Receipt Scanner:** Uses Apple's on-device OCR to read a physical receipt, passes the text to a local, offline LLM (via Enclave), formats it as strict JSON, and fires it to the database.
* 📶 **Offline-First Queue:** If you lose internet (e.g., on the subway), Shortcuts intercepts the network failure, writes the transaction to a local `PendingSpends.txt` file, and automatically bulk-syncs the backlog the next time you log an expense on Wi-Fi.

### 3. The Frontend (React Native PWA)
* **Hosted on Vercel:** Installs natively to the iOS home screen as a Progressive Web App.
* **Cache-First Loading:** Reads the last synced state from `AsyncStorage` to render the dashboard in 0.1 seconds, while silently fetching the newest CSV rows in the background.
* **Data Cleansing:** Implements aggressive Regex at the fetch layer to strip out dirty data (e.g., converting `"HK$22.00"` or `"$2,500"` from the Google Sheet into pure integers).
* **Dynamic Pacing:** Calculates real-time daily burn rates based on the exact number of days in the current month.

---

## 🚀 Features

- [x] **BYOD Settings:** Input your own Google Sheet URL, base currency, and monthly budget directly in the app.
- [x] **Top-Level Metrics:** Instantly see Remaining Budget, Total Spent, and Daily Averages vs. Recommended.
- [x] **Infinite Scroller:** Uses React Native's `SectionList` to recycle UI components, allowing thousands of rows to scroll flawlessly without crashing the browser.
- [x] **Dark Mode Native:** Charcoal-gray cards, minimalist green progress bars, and zero visual clutter.

---

## 🛠️ Setup Guide (For Friends & Forks) - WIP

Because the tool has no central database, anyone can spin up their own completely private instance in 3 steps:

### Step 1: The Database
1. Duplicate the [ZenSpend Google Sheet Template](#) to your own Google Drive.
2. Go to **File > Share > Publish to Web** and publish the "Current" tab as a **CSV**. Copy this link.
3. Link a Google Form to the sheet to act as your POST webhook.

### Step 2: The App
1. Go to the hosted Vercel link: `[Your-Vercel-URL-Here]`
2. Add the site to your iOS Home Screen.
3. Open the app, click the Gear icon, and paste your **CSV Link**, **Budget**, and **Currency**. 

### Step 3: The Pipeline
1. Install the [ZenSpend Core Shortcuts](#) to your iPhone.

***

*Built with React Native, Apple Neural Engine, and spite for SaaS fees.*
