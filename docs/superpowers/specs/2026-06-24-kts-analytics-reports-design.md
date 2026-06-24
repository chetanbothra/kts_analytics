# KTS Analytics Reports Dashboard — Design Spec

**Date:** 2026-06-24  
**Project:** kts_analytics  
**Type:** Web application (Next.js + React)  
**Deployment:** Vercel

---

## Overview

Two-report analytics dashboard for KTS. Users import CSV files (SALES and CLOSING stock data), generate aggregated reports, view results in a dashboard, and export to CSV/PDF. No database required — server-side processing only.

---

## Architecture

### Tech Stack
- **Framework:** Next.js (App Router)
- **Frontend:** React, Tailwind CSS
- **Backend:** Node.js API routes
- **CSV Processing:** `papaparse` (parsing), `csv-writer` (generation)
- **PDF Export:** `html2pdf` or `jspdf`
- **Deployment:** Vercel (single project)

### Page Structure
```
/
├── layout.tsx                    (root layout, sidebar + main)
├── page.tsx                      (redirects to first report)
├── average-sales/
│   └── page.tsx                  (Average Sales Report section)
├── stock-aging/
│   └── page.tsx                  (Stock Aging Report section)
└── api/
    ├── process-sales/
    │   └── route.ts              (POST: parse SALES CSV, return aggregated data)
    └── process-closing/
        └── route.ts              (POST: parse CLOSING CSV, return aged stock)
```

---

## API Routes

### POST `/api/process-sales`

**Request:**
- CSV file (multipart form-data, field: `file`)
- Expected columns: `Item Code`, `Item Name`, `Bill Date`, `Qty in PCs`, `Item Net Amount`

**Processing:**
1. Parse CSV with papaparse
2. Group by Item Code
3. For each item, calculate:
   - Total quantity sold (sum of `Qty in PCs`)
   - Count of transactions
   - Average quantity per transaction (`Total Qty / Count`)
   - Total revenue (sum of `Item Net Amount`)
   - Average revenue per transaction (`Total Revenue / Count`)
4. Sort by Item Code

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "itemCode": "180026205",
      "itemName": "KESH K. ANTI DANDRUF HAIR CLEANSER 180ML",
      "totalQtySold": 108,
      "avgQtyPerTransaction": 36,
      "totalRevenue": 10259.58,
      "avgRevenuePerTransaction": 3419.86
    }
  ],
  "recordCount": 42
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "CSV parsing failed: [details]"
}
```

---

### POST `/api/process-closing`

**Request:**
- CSV file (multipart form-data, field: `file`)
- Expected columns: `Item Code`, `Item Name`, `AVAILABLE STOCK`, `Days From Manufacture`, `Days To Expire`

**Processing:**
1. Parse CSV with papaparse
2. Group by Item Code (same item can have multiple batches)
3. For each item, aggregate:
   - Total available stock: **sum** of `AVAILABLE STOCK` across all batches
   - Days from manufacture: **select MAX** (oldest/earliest batch; higher days = older)
   - Days to expire: **select MIN** (soonest expiry date; lower days = more urgent)
4. Sort by `Days To Expire` (ascending — expiring soonest first)
5. Add status flag:
   - `Days To Expire < 30` → "URGENT" (red)
   - `Days To Expire < 60` → "SOON" (yellow)
   - Else → "SAFE" (green)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "itemCode": "180002735",
      "itemName": "BESAN 500 G",
      "totalStock": 20,
      "daysFromMfg": 198,
      "daysToExpire": 8,
      "status": "URGENT"
    }
  ],
  "recordCount": 150
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "CSV parsing failed: [details]"
}
```

---

## Frontend Pages

### Layout (`layout.tsx`)
- Fixed left sidebar (200px, dark bg)
- Sidebar sections:
  - Top: 2 nav items — "Average Sales Report" & "Stock Aging Report"
  - Bottom: "Recent Reports" section (last 3 uploads, clickable to reload)
- Main content area (flex-grow, right side)
- Active nav item highlighted

### Average Sales Report Page (`average-sales/page.tsx`)
**Components:**
- `FileUpload` — drag-drop or click to select SALES CSV (hint: "Drop SALES.csv here")
  - Option: "Use sample CSV" button for instant demo
- `ProcessingStatus` — badge after upload ("✓ 250 items processed in 2.3s | Errors: 0")
- `SummaryCard` — metrics snapshot (grid of 4 cards):
  - Total Items | Total Revenue | Avg Qty/Txn | Avg Revenue/Txn
- `ProcessingSpinner` — show while API processes
- `ReportTable` — display results:
  - Columns: Item Code | Item Name | Total Qty | Avg Qty/Txn | Total Revenue | Avg Revenue/Txn
  - Subtotals row at bottom (sum of quantities, sum of revenue)
  - Sortable by any column
  - Pagination (50 items/page)
  - Row header: "Showing X-Y of Z items"
- `ExportButtons` — CSV & PDF download + "Export all sections as PDF"

**State:**
- `file`: selected file
- `isLoading`: API call in progress
- `data`: array of report rows
- `error`: error message if API fails

**Flow:**
1. User selects SALES CSV file
2. POST to `/api/process-sales` (aggregates all transactions regardless of Bill Date)
3. On success, populate table with results
4. User can sort columns, paginate, export

**Note:** Date filtering is out-of-scope for Phase 1. All transactions are aggregated.

---

### Stock Aging Report Page (`stock-aging/page.tsx`)
**Components:**
- `FileUpload` — drag-drop or click to select CLOSING CSV (hint: "Drop CLOSING.csv here")
  - Option: "Use sample CSV" button for instant demo
- `ProcessingStatus` — badge after upload ("✓ 150 items processed in 1.8s | Errors: 0")
- `SummaryCard` — critical metrics (grid of 4 cards):
  - Total Stock Value (sum) | URGENT Items (count, red bg) | SOON Items (count, yellow bg) | SAFE Items (count, green bg)
- `ProcessingSpinner` — show while API processes
- `ReportTable` — display results:
  - Columns: Item Code | Item Name | Total Stock | Days From Mfg | Days To Expire | Status (badge: URGENT=red, SOON=yellow, SAFE=green)
  - Pre-sorted by Days To Expire (soonest first)
  - Subtotals row at bottom (sum of stock)
  - Pagination (50 items/page)
  - Row header: "Showing X-Y of Z items | URGENT: N | SOON: N"
- `ExportButtons` — CSV & PDF download + "Export all sections as PDF"

**State:**
- `file`: selected file
- `isLoading`: API call in progress
- `data`: array of report rows
- `error`: error message if API fails

**Flow:**
1. User selects CLOSING CSV file
2. POST to `/api/process-closing`
3. On success, populate table with results (already sorted by expiry)
4. User can paginate, export

---

## Export Implementation

### CSV Export
- Use `csv-writer` lib to generate CSV from results
- Include: header row, all data rows, subtotals row
- File name: `[ReportName]_[YYYY-MM-DD_HHmm].csv`
- Trigger download in browser

### PDF Export (Phase 1)
- Client-side only: use `html2pdf` or `jspdf` to convert table HTML → PDF
- Include: Report title + processing date/time + summary cards + full table with subtotals
- File name: `[ReportName]_[YYYY-MM-DD_HHmm].pdf`
- No pagination/multi-page logic; let browser handle rendering
- Large datasets (150+ rows) may hit memory limits; acceptable for Phase 1

### Combined Export (Future Phase 2)
- "Export all sections as PDF" button: generates single PDF with:
  - Page 1: Summary cards + Average Sales Report table
  - Page 2: Summary cards + Stock Aging Report table
  - Page header: Company branding (space reserved)
  - Footer: Export timestamp + page numbers

---

## Error Handling

**Upload errors:**
- File not selected → "Please select a CSV file"
- Wrong file type → "Only CSV files allowed"
- File size > 50MB → "File too large (max 50MB)"

**Processing errors:**
- Missing required columns → "CSV missing required column: [columnName]"
- Parsing failed → "Error parsing CSV: [details]"
- No data after parsing → "CSV file is empty"

**Frontend:**
- Show error banner (red bg, dismiss button)
- Log errors to console
- Retry button available after error

---

## Data Presentation & Trust

**Processing Status Badge** (appears after upload):
```
✓ Processed: 250 items | 0 errors | Time: 2.3s
```
- Show processing metadata to build user confidence
- Display timestamp of report generation (useful for audits)
- Log any skipped/invalid rows with count

**Summary Cards** (metrics at-a-glance):
- Sales Report: 4 cards (Total Items, Total Revenue, Avg Qty/Txn, Avg Revenue/Txn)
- Stock Aging: 4 cards (Total Stock Value, URGENT count, SOON count, SAFE count)
- Use semantic colors (red for URGENT, yellow for SOON, green for SAFE)
- Show full values (no truncation)

**Data Presentation:**
- Include subtotals row in all tables (critical for validation)
- Show item count in page header ("Showing 1-50 of 250 items")
- Use numeric formatting: 2 decimals for currency, 0 for quantities
- Align numbers right in columns (easier to scan)

---

## Data Validation

### Average Sales CSV
Required columns: `Item Code`, `Item Name`, `Qty in PCs`, `Item Net Amount`
- `Item Code`: string (trim whitespace)
- `Item Name`: string
- `Qty in PCs`: numeric (convert string to number, skip if invalid)
- `Item Net Amount`: numeric (convert string to number, skip if invalid)

### Stock Aging CSV
Required columns: `Item Code`, `Item Name`, `AVAILABLE STOCK`, `Days From Manufacture`, `Days To Expire`
- `Item Code`: string (trim whitespace)
- `Item Name`: string
- `AVAILABLE STOCK`: numeric
- `Days From Manufacture`: numeric
- `Days To Expire`: numeric

---

## UI/UX Details

**Sidebar:**
- Fixed width (200px), dark background, light text
- Top section: 2 nav items with icons
- Active nav item: highlight with accent color + left border
- Bottom section: "Recent Reports" (display 3 most recent uploads)
  - Format: "[Report Type] - [Date] [Time]"
  - Click to reload that report data
  - Storage: Browser localStorage (session-only, no persistence)
- Smooth transition between pages

**File Upload:**
- Drag-drop zone (clear label: "Drop [FILE_TYPE].csv here or click to browse")
- Show selected file name + file size
- "Use sample CSV" button (optional, loads demo data for quick testing)
- "Upload & Process" button (disabled until file selected)
- Clear/reset button to start over ("Clear & upload new file")
- Processing spinner shows estimated time ("Processing...")
- Status badge appears after completion ("✓ Processed in 2.3s")

**Table:**
- Responsive (horizontal scroll on mobile if needed)
- Header: dark bg, sortable column indicators (↑/↓)
- Rows: alternating bg for readability, hover: slight bg change
- **Subtotals Row** (sticky at bottom): 
  - Sales Report: SUM(Total Qty), SUM(Total Revenue) with bold styling
  - Stock Aging: SUM(Total Stock) with bold styling
- Pagination: Previous/Next buttons, "Showing X-Y of Z"
- Summary row above table: "Showing X-Y of Z items" + quick stats (e.g., "URGENT: 5 items")

**Status Badges (Stock Aging only):**
- URGENT: red bg, white text
- SOON: yellow bg, dark text
- SAFE: green bg, dark text

**Export Buttons:**
- CSV: download icon + "Export CSV"
- PDF: document icon + "Export PDF"
- Disabled until results available

---

## Scope & Constraints

- **No authentication** — open access
- **No database** — all processing in-memory, no persistence of reports
- **Recent Reports:** Stored in browser localStorage (3 most recent, expires on session end)
- **Sample CSV:** Embedded demo data (small subset of provided CSVs, hardcoded in app)
- **File size limit:** 50MB per upload
- **Processing time:** expect < 5 seconds for both CSVs
- **Offline:** Not required initially, but could add service worker later
- **Mobile:** Responsive design (Tailwind), sidebar becomes drawer on mobile
- **Subtotals:** Client-side calculation (sum of numeric columns at table bottom)

---

## Success Criteria

1. ✅ Users can upload SALES CSV and view average sales report (qty + revenue metrics)
2. ✅ Users can upload CLOSING CSV and view stock aging report (sorted by expiry urgency)
3. ✅ Both reports exportable to CSV and PDF
4. ✅ Single Next.js project deployable to Vercel
5. ✅ No errors when processing provided sample CSVs
6. ✅ UI is responsive and usable on mobile

---

## Future Enhancements (Out of Scope)

- Add filters (by division, vertical, brand)
- Combine both CSVs in one view (sales + stock correlation)
- Historical tracking (store results, compare over time)
- Custom date range selection for sales report
- Notifications for expiring stock (email alerts)
