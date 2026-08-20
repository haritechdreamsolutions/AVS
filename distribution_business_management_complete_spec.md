# Distribution Business & Management Web Application
## Complete Product Requirements & Developer Specification

**Version:** 1.0  
**Document Type:** Product + UX + Functional + Technical Specification  
**Primary Users:** Owner, Store Keeper, Delivery Employees  
**Business Type:** FMCG / Beverage / Small-item Distribution  
**Initial Scale:** 1 Owner, 1+ Store Keepers, 7 Delivery Employees, ~10 Products, ~30 Shops per Employee

---

# 1. Product Vision

Build a simple, attractive, mobile-first distribution management application that manages the complete business cycle:

> Dealer → Warehouse → Employee Allocation → Shop Delivery → Billing → Payment → Stock Deduction → Expenses → Return → Damage → Cash Settlement → Reports

The application must be extremely easy for delivery employees to use, even when they have limited reading/writing skills.

The system should minimize:
- Typing
- Manual calculations
- Stock calculations
- Payment calculations
- Accounting mistakes
- Duplicate entries
- Unauthorized edits

The system should maximize:
- Visual clarity
- Large buttons
- Product images/icons
- Automatic calculations
- Error prevention
- Auditability
- Printable reports
- Offline usability

---

# 2. User Roles

There are three primary roles.

## 2.1 Owner

Full system access.

Can:
- View all dashboards
- Manage users
- Manage employees
- Manage store keepers
- Manage products
- Manage dealers
- Manage routes
- Manage shops
- View stock
- View stock movements
- Receive stock
- Allocate stock
- View bills
- Correct transactions
- View payments
- View expenses
- View employee settlements
- View damage/loss
- View profit/revenue reports
- Print A4 reports
- Print/export bills
- View audit logs
- Configure business settings

Owner should have complete read/write access, while important historical records should remain audit-protected.

---

## 2.2 Store Keeper

Operational full access with restrictions.

Can:
- Receive stock from dealer
- Record purchase/receiving amount
- Manage warehouse stock
- Allocate stock to employees
- Receive returned stock
- Record damaged stock
- Record employee cash settlement
- Record employee expenses
- Correct employee mistakes
- Correct stock mistakes
- View employee bills
- View employee stock
- Print reports
- Print A4 reports

Cannot:
- Manage owner permissions
- Change system-level configuration unless permitted
- Delete important financial history silently

Every correction must be logged.

---

## 2.3 Delivery Employee

Employee has a highly simplified interface.

Can:
- View own vehicle
- View own route
- View assigned shops
- View allocated stock
- Create bills
- Select shop
- Select product
- Select unit
- Select quantity
- Select payment type
- Record expenses
- View today's sales
- View remaining stock
- End the day
- Submit stock return

Cannot:
- Edit completed bills
- Edit allocated stock
- Change product price
- Change warehouse stock
- Edit cash settlement
- Delete transactions
- Modify historical records

---

# 3. Core Business Flow

```text
DEALER
   ↓
STORE KEEPER
   ↓
WAREHOUSE STOCK
   ↓
EMPLOYEE STOCK ALLOCATION
   ↓
EMPLOYEE STARTS ROUTE
   ↓
SHOP
   ↓
BILL
   ↓
PAYMENT
   ↓
STOCK DEDUCTION
   ↓
NEXT SHOP
   ↓
EMPLOYEE RETURNS
   ↓
REMAINING STOCK
   ↓
DAMAGED STOCK
   ↓
CASH SETTLEMENT
   ↓
EXPENSE SETTLEMENT
   ↓
DAY CLOSED
   ↓
OWNER REPORT
```

---

# 4. Product Management

Each product should have:

- Product ID
- Product name
- Short name
- Full display name
- Category
- SKU
- Image/icon
- Base unit
- Selling unit
- Purchase price
- Selling price
- Active/inactive status
- Pieces per tray/box
- Optional unit conversions
- Tax configuration if required

## Example

Product:

```text
Name: Milk
Variant: 200ml
Display Name: Milk 200ml
Base Unit: Piece
Selling Units:
  - Piece
  - Tray
```

If:

```text
1 Tray = 20 Pieces
```

the inventory engine should internally be able to convert between them.

---

# 5. Product Display Must Be Clear

The bill must never show ambiguous names.

Bad:

```text
Milk
```

Good:

```text
Milk 200ml
```

Better:

```text
Milk - 200ml
```

Example bill:

```text
Milk - 200ml       1 Tray      ₹850
Water - 1L         2 Tray      ₹1200
Coccola - 500ml    3 Box       ₹900
```

The exact product variant/size should always be visible.

---

# 6. Unit System: Piece / Tray / Box / Pack

The employee should be able to select the unit easily.

Example:

```text
Product:
Milk - 200ml

Quantity:
[ - ]  1  [ + ]

Unit:
[ Tray ▼ ]
```

Dropdown options can be:

```text
Piece
Tray
Box
Pack
```

Only valid units for that product should appear.

Example:

```text
Milk 200ml
Unit:
[ Tray ▼ ]
```

Options:

```text
Piece
Tray
```

For a card product:

```text
Card
Unit:
[ Pack ▼ ]
```

---

# 7. Unit Conversion

Every product can have a conversion rule.

Example:

```text
Milk 200ml

1 Tray = 20 Pieces
```

If employee sells:

```text
1 Tray
```

system internally deducts:

```text
20 Pieces
```

If employee sells:

```text
5 Pieces
```

system deducts:

```text
5 Pieces
```

Remaining stock must always be accurate.

---

# 8. Inventory Architecture

Do NOT rely only on a single editable stock number.

Use a stock ledger.

Every movement must be recorded.

Example:

```text
+100 Tray   Dealer → Warehouse
-20 Tray    Warehouse → Tharun
-1 Tray     Tharun → Shop
+2 Tray     Tharun → Warehouse Return
-1 Tray     Warehouse → Damage
```

Every movement should contain:

- Transaction ID
- Product
- Quantity
- Unit
- Base quantity
- Movement type
- Source
- Destination
- Employee
- Reference transaction
- Date/time
- Created by
- Notes

---

# 9. Dealer Stock Receiving

Store Keeper selects:

```text
Dealer
ABC Distributors
```

Then adds products.

Example:

```text
Milk - 200ml

Quantity: 50
Unit: Tray
Rate: ₹700
Amount: ₹35,000
```

Another product:

```text
Water - 1L

Quantity: 50
Unit: Tray
Rate: ₹600
Amount: ₹30,000
```

Total:

```text
₹65,000
```

On confirmation:

- Warehouse stock increases
- Purchase/receiving record is created
- Stock ledger is created
- Amount is recorded
- Dealer transaction is saved

---

# 10. Employee Stock Allocation

Store Keeper selects:

```text
Employee:
Tharun

Vehicle:
TN 32 XX 2222

Route:
Route A
```

Then:

```text
Milk - 200ml
10 Tray

Water - 1L
5 Tray

Coccola - 500ml
8 Box
```

System calculates total stock value.

On confirmation:

```text
Warehouse stock ↓
Employee stock ↑
```

Allocation record must be immutable after confirmation except through authorized correction.

---

# 11. Employee Mobile Home

The employee interface must be extremely simple.

Recommended bottom navigation:

```text
🏠 Home
🧾 Bill
🏪 Shops
💰 Day
```

Home:

```text
Hello Tharun 👋

🚚 TN 32 XX 2222
Route A

Today's Shops
12 / 30 Completed

MY STOCK

🥛 Milk - 200ml
8 Tray

💧 Water - 1L
5 Tray

🥤 Coccola - 500ml
8 Box

[ 🧾 BILL PODU ]
```

Use local-language-friendly labels where appropriate.

Example:

```text
பில் போடு
கடை தேர்வு
பணம்
முடி
```

---

# 12. Shop Management

Each shop should have:

- Shop ID
- Shop name
- Owner name
- Phone
- Address
- Route
- GPS location (optional)
- Credit allowed
- Credit limit
- Outstanding amount
- Active/inactive
- Notes

Example:

```text
SHOP #102
Mani Store

Route A

Outstanding:
₹1,200

Last Visit:
Today
```

---

# 13. Shop Selection UX

Employee should not need to type shop names.

Use large cards:

```text
🏪 Mani Store
Shop #102

🏪 Kumar Store
Shop #103

🏪 Raja Store
Shop #104
```

Features:
- Search
- Route order
- Recent shops
- Nearest shops (optional GPS)
- Completed/pending indicator

---

# 14. Billing Flow

Employee:

```text
Select Shop
    ↓
Select Product
    ↓
Select Unit
    ↓
Select Quantity
    ↓
Review
    ↓
Payment
    ↓
Save Bill
    ↓
Print
```

---

# 15. Product Selection UX

Use visual product cards.

Example:

```text
┌──────────────────────┐
│ 🥛                   │
│ Milk - 200ml         │
│ Stock: 8 Tray        │
│ [ ADD ]              │
└──────────────────────┘
```

For employees with limited reading ability, product image/icon should be prominent.

---

# 16. Quantity Selection

Avoid typing quantity where possible.

Use:

```text
[-]    1    [+]
```

or quick buttons:

```text
1
2
5
10
```

The quantity must never exceed available stock.

If available stock is:

```text
8 Tray
```

employee cannot sell:

```text
9 Tray
```

System should show:

```text
Not enough stock
Available: 8 Tray
```

---

# 17. Unit Dropdown in Billing

Example:

```text
Milk - 200ml

Quantity:
[-] 1 [+]

Unit:
[ Tray ▼ ]
```

Dropdown:

```text
Piece
Tray
```

If the employee selects:

```text
5 Piece
```

the app calculates the piece-level amount.

If pricing differs by unit, use configured unit pricing.

---

# 18. Pricing

Products can have unit-specific prices.

Example:

```text
Milk - 200ml

Piece:
₹45

Tray:
₹850
```

System should use the correct configured price based on selected unit.

Price must not be editable by employees.

---

# 19. Bill Calculation

Example:

```text
Milk - 200ml
1 Tray × ₹850
₹850

Coccola - 500ml
2 Box × ₹200
₹400

----------------
TOTAL
₹1,250
```

System calculates automatically.

Employee does not calculate anything manually.

---

# 20. Discounts

Optional feature.

If enabled:

```text
Subtotal       ₹1,250
Discount          ₹50
---------------------
Total          ₹1,200
```

Employee should only have discount access if explicitly permitted.

---

# 21. Payment Types

Support:

```text
Cash
GPay / UPI
Split
Credit / Due
```

---

# 22. Cash Payment

Example:

```text
TOTAL

₹1,250

[ 💵 CASH ]
```

Save payment:

```text
Cash:
₹1,250
```

---

# 23. GPay / UPI Payment

Example:

```text
TOTAL

₹1,250

[ 📱 GPay ]
```

Record:

```text
UPI:
₹1,250
```

Optional:
- UPI reference ID
- Transaction number
- Screenshot/attachment if needed

---

# 24. Split Payment

Example:

```text
Total:
₹1,250

Cash:
₹500

GPay:
₹750

Total Paid:
₹1,250

Remaining:
₹0
```

System must block saving if:

```text
Cash + UPI + Credit != Total
```

unless the difference is intentionally recorded as due/adjustment.

---

# 25. Credit / Due Payment

If business supports credit:

```text
Payment:
[ Credit ]

Due:
₹850
```

Shop ledger increases:

```text
Previous Due: ₹1,200
New Bill: ₹850
Current Due: ₹2,050
```

Owner can see total outstanding.

---

# 26. Bill Generation

Every completed bill gets:

- Bill number
- Date
- Time
- Employee
- Vehicle
- Shop
- Shop ID
- Product full name
- Quantity
- Unit
- Unit price
- Line amount
- Discount
- Total
- Payment method
- Paid amount
- Due amount

---

# 27. Thermal Bill

Support:

- 58mm thermal printer
- 80mm thermal printer

Example:

```text
        COMPANY NAME
     Distribution Center

Bill No: INV-000123
Date: 07-08-2026
Employee: Tharun
Vehicle: TN 32 XX 2222

Mani Store
Shop ID: 102

Milk - 200ml
1 Tray x ₹850       ₹850

Coccola - 500ml
2 Box x ₹200        ₹400

-------------------------
TOTAL               ₹1,250

Cash                  ₹500
GPay                  ₹750
-------------------------

Thank You 🙏
```

---

# 28. Daily Employee Stock Tracking

When employee starts:

```text
Opening Stock
```

During day:

```text
Allocated
- Sold
- Damaged
+ Returned
```

Expected closing stock:

```text
Opening + Allocated - Sold - Damage + Returns
```

The exact formula should use the inventory ledger/base units.

---

# 29. Damaged Product Management

This is a critical feature.

Employees/store keeper must be able to record damaged products.

Damage record should include:

- Product
- Variant
- Quantity
- Unit
- Base quantity
- Cost per unit
- Total damage cost
- Reason
- Employee
- Vehicle
- Date/time
- Photo (optional)
- Approved by
- Notes

---

# 30. Damage Example

Employee has:

```text
Milk - 200ml
10 Tray
```

During delivery:

```text
1 Tray damaged
```

Employee records:

```text
Product:
Milk - 200ml

Quantity:
1

Unit:
Tray

Reason:
Damaged
```

If:

```text
1 Tray = 20 Pieces
Cost per Tray = ₹700
```

System calculates:

```text
Damage Quantity:
1 Tray

Damage Cost:
₹700
```

Employee stock becomes:

```text
10 Tray
-1 Damaged
=9 Tray
```

---

# 31. Damage Cost Calculation

Damage cost should use the configured cost price, not the selling price.

Example:

```text
Purchase Cost:
₹700 / Tray

Selling Price:
₹850 / Tray

Damage:
2 Tray

Damage Cost:
2 × ₹700
= ₹1,400
```

Owner report:

```text
Total Damage Quantity:
2 Tray

Total Damage Cost:
₹1,400
```

This must be separate from sales loss/revenue.

---

# 32. Damage Approval

Recommended workflow:

```text
Employee records damage
        ↓
Store Keeper reviews
        ↓
Approved
        ↓
Stock deducted
        ↓
Damage ledger created
```

If employees are trusted to record directly, system can still mark:

```text
Reported By
Approved By
```

---

# 33. End-of-Day Employee Flow

Employee clicks:

```text
🔴 END DAY
```

System shows:

```text
TODAY'S SUMMARY

Bills:
42

Sales:
₹18,250

Cash:
₹12,000

GPay:
₹6,250

Credit:
₹0

Expenses:
₹3,200

Damage:
₹700
```

Then:

```text
REMAINING STOCK

Milk - 200ml
2 Tray

Water - 1L
1 Tray

Coccola - 500ml
3 Box
```

Employee submits.

---

# 34. Stock Return

Store Keeper sees:

```text
Employee: Tharun

Expected Return:

Milk - 200ml
2 Tray

Water - 1L
1 Tray

Coccola - 500ml
3 Box
```

Actual received:

```text
Milk - 200ml
2 Tray

Water - 1 Tray

Coccola - 2 Box
```

System detects:

```text
Coccola
Expected: 3 Box
Actual: 2 Box

Difference: 1 Box
```

Reason required:

```text
Damaged
Missing
Wrong Entry
Other
```

---

# 35. Cash Settlement

At end of day:

```text
Expected Cash:
₹12,000
```

Store Keeper enters:

```text
Actual Cash:
₹11,500
```

System calculates:

```text
Difference:
-₹500

Status:
SHORT
```

If:

```text
Actual:
₹12,000
```

show:

```text
MATCHED ✓
```

If:

```text
Actual:
₹12,500
```

show:

```text
OVER:
₹500
```

---

# 36. Cash Reconciliation Formula

Expected cash should be calculated from actual payment transactions, not manually typed totals.

For example:

```text
Cash Sales
+ Cash received for dues
- Approved cash-paid expenses
- Authorized cash adjustments
= Expected cash
```

Exact accounting rules should be configurable.

---

# 37. Employee Expenses

Employee can record:

```text
⛽ Diesel
🍛 Lunch/Food
🛣️ Toll
🔧 Vehicle
📦 Other
```

Example:

```text
Diesel
₹3,000
```

Expense record must include:

- Category
- Amount
- Payment source
- Date/time
- Employee
- Vehicle
- Optional receipt/photo
- Notes

---

# 38. Expense Payment Source

Very important.

Every expense should ask:

```text
Who Paid?

○ Employee
○ Company
○ Cash from collection
```

Example:

```text
Diesel:
₹3,000

Paid by:
Employee
```

Then the system can calculate employee reimbursement.

If company paid:

```text
Company Expense:
₹3,000
```

This prevents settlement confusion.

---

# 39. Employee Settlement

At end of day, show:

```text
SALES
₹18,250

CASH RECEIVED
₹12,000

GPay RECEIVED
₹6,250

EMPLOYEE-PAID EXPENSES
₹3,200

REIMBURSEMENT DUE
₹3,200

STOCK RETURNED
₹7,200

DAMAGE
₹700

CASH DIFFERENCE
₹0
```

---

# 40. Owner Dashboard

The dashboard should answer:

> "What is happening in my business today?"

Top cards:

```text
Today's Sales
₹1,24,500

Cash
₹72,500

GPay
₹42,000

Credit
₹10,000

Bills
186

Employees Active
7 / 7

Damage Cost
₹2,100

Expenses
₹12,500
```

---

# 41. Employee Status

Example:

```text
🟢 Tharun
On Route

🟢 Kumar
On Route

🟡 Suresh
Returned

🔴 Mani
Not Started
```

Click employee → detailed activity.

---

# 42. Owner Employee Details

Example:

```text
THARUN

Vehicle:
TN 32 XX 2222

Route:
Route A

Shops:
30

Bills:
42

Sales:
₹18,250

Cash:
₹12,000

GPay:
₹6,250

Expenses:
₹3,200

Damage:
₹700

Stock Returned:
₹7,200

Cash Difference:
₹0
```

---

# 43. Stock Dashboard

Show:

```text
Warehouse Stock

Milk - 200ml
120 Tray

Water - 1L
80 Tray

Coccola - 500ml
50 Box
```

Also show:

```text
Low Stock
Fast Moving
Damaged
Allocated
Available
```

---

# 44. Complete Stock Report

For each product:

```text
Opening
+ Dealer Received
- Employee Allocation
+ Employee Return
- Sales
- Damage
- Other Adjustment
= Closing
```

The report should reconcile with the stock ledger.

---

# 45. Damage Report

Owner/Store Keeper can print:

```text
DAMAGE REPORT

Date Range:
01-08-2026 to 07-08-2026

Product        Qty      Cost
Milk - 200ml   3 Tray   ₹2,100
Water - 1L     2 Tray   ₹1,200
Coccola        1 Box    ₹180

Total Damage Cost:
₹3,480
```

Filters:
- Date
- Employee
- Product
- Vehicle
- Reason

---

# 46. Sales Reports

Reports:

- Daily sales
- Weekly sales
- Monthly sales
- Employee sales
- Product sales
- Shop sales
- Route sales
- Payment method
- Credit/due
- Discount
- Gross sales
- Net sales

---

# 47. Employee Performance Report

Example:

```text
Employee | Bills | Sales | Cash | UPI | Damage | Expense
Tharun   | 42    | 18,250|12,000|6,250|700    |3,200
Kumar    | 35    | 14,600|8,000 |6,600|0      |2,500
```

---

# 48. Shop Report

For each shop:

```text
Shop Name
Total Bills
Total Purchases
Cash Purchases
UPI Purchases
Credit
Current Due
Last Purchase
Top Products
```

---

# 49. Due / Outstanding Report

Example:

```text
SHOP OUTSTANDING

Mani Store      ₹4,200
Kumar Store     ₹2,100
Raja Store      ₹1,500

TOTAL:
₹7,800
```

---

# 50. A4 Printing

Owner and Store Keeper must be able to print full reports on A4 paper.

Every important report should support:

```text
Print
PDF
```

A4 reports should include:

- Business name
- Logo
- Report title
- Date range
- Filters
- Generated date/time
- Prepared by
- Data table
- Totals
- Signature area where applicable

---

# 51. A4 Reports Required

At minimum:

1. Daily Sales Report
2. Monthly Sales Report
3. Employee Sales Report
4. Employee Settlement Report
5. Stock Report
6. Stock Movement Report
7. Dealer Receiving Report
8. Employee Allocation Report
9. Stock Return Report
10. Damage Report
11. Expense Report
12. Cash Collection Report
13. Payment Method Report
14. Shop Sales Report
15. Shop Due Report
16. Product Sales Report
17. Profit/Cost Summary
18. Audit/Correction Report

---

# 52. A4 Daily Business Report

Example structure:

```text
------------------------------------------------
             COMPANY NAME
          DAILY BUSINESS REPORT
             07-08-2026
------------------------------------------------

Total Sales                         ₹1,24,500
Cash                                ₹72,500
UPI                                 ₹42,000
Credit                              ₹10,000
Total Bills                              186

Employees Active                        7 / 7

Expenses                            ₹12,500
Damage Cost                          ₹2,100

------------------------------------------------
EMPLOYEE SUMMARY
------------------------------------------------
Employee    Sales      Cash      UPI     Bills
Tharun      18,250     12,000    6,250    42
Kumar       14,600      8,000    6,600    35
...

------------------------------------------------
TOTAL
₹1,24,500
------------------------------------------------
```

---

# 53. Print Preview

Before printing:

```text
[ A4 Preview ]

[ Print ]
[ Save PDF ]
```

Report filters should be preserved.

---

# 54. Bill Search

Owner and Store Keeper should search bills by:

- Bill number
- Shop
- Employee
- Date
- Product
- Payment method
- Amount

---

# 55. Bill Correction

Employee cannot edit completed bills.

Store Keeper can correct.

Example:

Original:

```text
Milk - 200ml
1 Tray
₹850
```

Correction:

```text
Milk - 200ml
2 Tray
₹1,700
```

System must record:

```text
Edited By:
Store Keeper

Old:
1 Tray

New:
2 Tray

Reason:
Customer requested 2 trays
```

Inventory and payment ledgers must be adjusted through proper correction transactions.

Do not simply overwrite history.

---

# 56. Audit Logs

Every important action should be logged.

Examples:

```text
User
Action
Entity
Old Value
New Value
Reason
Date
Time
Device
```

Actions:
- Create
- Edit
- Correct
- Approve
- Cancel
- Return
- Damage
- Settlement

---

# 57. Delete Policy

Avoid hard deletion of business transactions.

Instead use:

```text
Active
Cancelled
Reversed
Corrected
```

Historical financial records should remain traceable.

---

# 58. Offline Mode

Because employees travel between shops, network may fail.

Employee app should preferably support offline operation.

Offline-capable data:

- Assigned route
- Shop list
- Product list
- Price list
- Employee stock
- Bill creation
- Payment
- Expense
- Damage report

When internet returns:

```text
Offline data
     ↓
Sync queue
     ↓
Server
     ↓
Sync confirmation
```

Conflicts must be detected, not silently overwritten.

---

# 59. Sync Safety

Every offline transaction should have a unique client transaction ID.

Example:

```text
client_txn_id
device_id
created_at
sync_status
```

Server must prevent duplicate bills if the same offline transaction is submitted twice.

---

# 60. Printer Support

Support thermal printers:

```text
58mm
80mm
```

Possible connection approaches:
- Bluetooth
- USB
- Browser print
- Android native bridge if packaged as app

The final choice depends on the actual printer models used by the agency.

---

# 61. UI/UX Principles

## Employee UI

- Mobile first
- Very large touch targets
- Large numbers
- Product images
- Minimal text
- Minimal typing
- Simple Tamil/English labels
- One main action per screen
- Confirmation before irreversible actions
- No complex tables
- No complicated settings

## Store Keeper UI

- Tablet/Desktop friendly
- Large action cards
- Tables for inventory
- Search/filter
- Stock warnings
- Settlement workflow

## Owner UI

- Desktop optimized
- Responsive mobile
- Charts
- Tables
- Filters
- Reports
- Alerts
- Business summaries

---

# 62. Error Prevention

The app should prevent:

### Over-selling

```text
Available: 2 Tray
Requested: 3 Tray

❌ Cannot continue
```

### Payment mismatch

```text
Bill:
₹1,250

Cash:
₹500
UPI:
₹500

Remaining:
₹250

⚠️ Payment incomplete
```

### Invalid return

```text
Expected:
2 Tray

Received:
5 Tray

⚠️ Cannot exceed allocated/valid stock without adjustment permission.
```

### Invalid quantity

No negative quantities.

---

# 63. Notifications / Alerts

Owner:

- Low stock
- Cash shortage
- Stock mismatch
- High damage
- Pending settlements
- High outstanding dues
- Employee not started
- Employee not returned
- Unapproved damage

Store Keeper:

- Employee returned
- Settlement pending
- Stock mismatch
- Damage reported

---

# 64. Route Management

Each employee can be assigned a route.

Example:

```text
Route A

1. Mani Store
2. Kumar Store
3. Raja Store
...
30. Lakshmi Store
```

Employee sees shops in route order.

Optional:
- GPS
- Route distance
- Visit status
- Visit time
- Last purchase

---

# 65. Shop Visit Tracking

Each shop visit can store:

```text
Visit Started
Bill Created
No Sale
Payment Received
Visit Completed
```

Optional future feature:

```text
GPS location
```

Do not make GPS mandatory for MVP.

---

# 66. Dashboard Quick Actions

Owner:

```text
+ Add Product
+ Add Employee
+ Add Shop
+ Receive Stock
+ View Settlement
+ Print Report
```

Store Keeper:

```text
Receive Stock
Give Stock
Receive Return
Settlement
Damage
Print Report
```

Employee:

```text
Bill
Shops
My Stock
Expense
End Day
```

---

# 67. Recommended Navigation

## Owner

```text
Dashboard
Sales
Inventory
Employees
Shops
Dealers
Reports
Expenses
Settlements
Settings
```

## Store Keeper

```text
Dashboard
Receive
Allocate
Return
Settlement
Damage
Reports
```

## Employee

```text
Home
Bill
Shops
Day
```

---

# 68. Database Tables

Recommended core entities:

```text
users
roles
employees
store_keepers
vehicles

products
product_variants
product_units
unit_conversions
product_prices

dealers
dealer_transactions
dealer_transaction_items

warehouses
stock_ledger
stock_balances

routes
route_shops
shops
shop_ledger

stock_allocations
stock_allocation_items

sales
sale_items
payments

expenses
expense_categories

damages
damage_items

stock_returns
stock_return_items

cash_settlements

audit_logs

daily_closures
sync_queue
devices
```

---

# 69. Important Relationships

```text
Employee
   ↓
Vehicle
   ↓
Route
   ↓
Shops
```

```text
Product
   ↓
Product Variant
   ↓
Units
   ↓
Price
```

```text
Dealer
   ↓
Receiving
   ↓
Warehouse
   ↓
Employee Allocation
   ↓
Employee Sale
   ↓
Return / Damage
```

---

# 70. API Structure

Recommended API modules:

```text
/auth
/users
/employees
/store-keepers
/vehicles

/products
/product-units
/product-prices

/dealers
/purchases
/receiving

/inventory
/stock-ledger
/stock-allocations
/stock-returns
/damages

/routes
/shops

/sales
/payments
/expenses
/settlements

/reports
/audit
/settings
/sync
```

---

# 71. Important API Examples

```text
POST   /auth/login

GET    /employees
POST   /employees
PATCH  /employees/:id

GET    /products
POST   /products

POST   /inventory/receive
POST   /inventory/allocate
POST   /inventory/return
POST   /inventory/damage

GET    /shops
POST   /shops

POST   /sales
GET    /sales/:id

POST   /payments

POST   /expenses

POST   /settlements

GET    /reports/daily-sales
GET    /reports/stock
GET    /reports/damage
GET    /reports/employee-settlement
```

---

# 72. Sale Creation Transaction

A sale should be handled as a transaction.

Conceptually:

```text
1. Validate employee
2. Validate shop
3. Validate product
4. Validate available stock
5. Validate unit
6. Calculate price
7. Calculate total
8. Validate payment
9. Create sale
10. Create sale items
11. Create payment records
12. Create stock ledger deductions
13. Update shop ledger if credit
14. Commit transaction
```

If any critical step fails, the complete transaction should roll back.

---

# 73. Stock Ledger Types

Use explicit movement types:

```text
PURCHASE_RECEIVED
EMPLOYEE_ALLOCATION
SALE
EMPLOYEE_RETURN
DAMAGE
ADJUSTMENT
TRANSFER
CANCELLED_SALE
CORRECTION
```

---

# 74. Financial Ledger Principles

Do not calculate historical reports from mutable current values.

Store transaction records.

Examples:

- Sale transaction
- Payment transaction
- Expense transaction
- Damage cost
- Settlement
- Adjustment

Reports should aggregate transaction history.

---

# 75. Profit / Cost Reporting

For products where purchase cost is known:

```text
Sales Revenue
- Cost of Goods Sold
= Gross Profit
```

Damage:

```text
Damage Cost
```

should be separately visible.

Example:

```text
Sales Revenue       ₹1,24,500
COGS                  ₹98,000
-----------------------------
Gross Profit          ₹26,500

Damage Cost            ₹2,100
Expenses               ₹12,500
-----------------------------
Operating Summary      ₹11,900
```

The exact profit formula should be finalized with the business owner/accountant, especially for taxes, discounts, credits and expenses.

---

# 76. Security

Use:
- Secure authentication
- Password/PIN hashing
- Role-based authorization
- Server-side permission checks
- Session/token management
- Audit logs
- HTTPS
- Input validation
- Rate limiting
- Database backups

Never rely only on hiding UI buttons for authorization.

---

# 77. Backup

Business data is critical.

Recommended:
- Automated database backups
- Backup retention
- Restore testing
- Transaction audit
- Export options

Owner should be able to export important reports.

---

# 78. Export

Support:

```text
PDF
Excel
CSV
Print
```

At minimum:
- Sales
- Stock
- Expenses
- Damage
- Settlement
- Shop dues

---

# 79. Search & Filters

Every major report should support:

```text
Date Range
Employee
Product
Shop
Route
Payment Type
Status
```

Example:

```text
Sales
Date: 01 Aug - 07 Aug
Employee: Tharun
Route: Route A
Payment: GPay
```

---

# 80. Status System

Recommended statuses:

### Bill

```text
DRAFT
COMPLETED
CANCELLED
CORRECTED
```

### Settlement

```text
PENDING
MATCHED
SHORT
OVER
APPROVED
```

### Damage

```text
REPORTED
APPROVED
REJECTED
```

### Sync

```text
PENDING
SYNCED
FAILED
CONFLICT
```

---

# 81. Daily Closure

An employee's day should not be considered complete until:

```text
All bills synced
All payments recorded
Expenses recorded
Damage recorded
Stock returned
Cash settled
```

Then:

```text
DAY CLOSED ✓
```

After closure, employee cannot modify the day's transactions.

Store Keeper/Owner can correct with audit trail.

---

# 82. MVP Scope

For first release, prioritize:

### Must Have

- Login/roles
- Products
- Employees
- Shops
- Routes
- Dealer receiving
- Warehouse stock
- Employee allocation
- Employee billing
- Piece/Tray/Box unit selection
- Automatic calculations
- Cash/UPI/Split payment
- Thermal bill
- Stock deduction
- Damage quantity + cost
- Expenses
- Stock return
- Cash settlement
- Owner dashboard
- Store Keeper corrections
- Audit logs
- A4 reports

### Strongly Recommended

- Offline employee mode
- Sync
- PDF export
- Excel export

### Future

- GPS
- Route optimization
- WhatsApp bill sharing
- Advanced analytics
- Customer loyalty
- Barcode scanning
- Automated reminders
- Multi-warehouse

---

# 83. Employee UX Golden Rule

The employee should be able to complete a normal sale approximately like this:

```text
1. Tap "Bill"
2. Tap Shop
3. Tap Product
4. Choose Piece/Tray
5. Tap + / quantity
6. Tap Payment
7. Tap Cash / GPay / Split
8. Tap Confirm
9. Print
```

No manual arithmetic.

No complicated form.

No unnecessary fields.

---

# 84. Example Complete Employee Sale

Starting stock:

```text
Milk - 200ml
10 Tray
```

Employee visits:

```text
Mani Store
```

Customer asks:

```text
1 Tray Milk - 200ml
```

Employee:

```text
Product:
Milk - 200ml

Quantity:
1

Unit:
Tray
```

System:

```text
1 Tray × ₹850
= ₹850
```

Customer pays:

```text
Cash:
₹500

GPay:
₹350
```

System:

```text
Total:
₹850

Paid:
₹850

Balance:
₹0
```

After confirmation:

```text
Employee Stock:
10 Tray → 9 Tray

Cash:
+₹500

UPI:
+₹350

Sales:
+₹850

Bill:
INV-000123
```

Bill prints.

---

# 85. Example Damage

Employee stock:

```text
Milk - 200ml
9 Tray
```

One tray is damaged.

Employee records:

```text
Damage:
1 Tray

Cost:
₹700
```

System:

```text
Stock:
9 → 8 Tray

Damage:
1 Tray

Damage Cost:
₹700
```

Owner report:

```text
Milk - 200ml
Damage: 1 Tray
Cost: ₹700
```

---

# 86. Example End-of-Day

Tharun:

```text
Sales:
₹18,250

Cash:
₹12,000

UPI:
₹6,250

Expenses:
₹3,200

Damage:
₹700

Remaining Stock:
Milk 2 Tray
Water 1 Tray
```

Store Keeper:

```text
Stock received ✓
Cash received ₹12,000 ✓
Expenses verified ✓
Damage verified ✓
```

Day:

```text
CLOSED ✓
```

---

# 87. Design System

Recommended visual direction:

## General

- Clean
- Modern
- Spacious
- High contrast
- Rounded cards
- Clear typography
- Minimal clutter

## Employee

- Extra-large buttons
- Large icons
- Product images
- Big quantity controls
- Sticky bottom action
- Minimal navigation

## Store Keeper

- Dense but readable tables
- Search
- Filters
- Stock status chips
- Confirmation dialogs

## Owner

- KPI cards
- Charts
- Tables
- Alerts
- Drill-down reports

---

# 88. Accessibility

Employee screens should support:

- Large font
- High contrast
- Large touch targets
- Clear icon + text combinations
- No color-only status indicators
- Simple language
- Error messages in simple terms

Avoid:

```text
Transaction failed due to validation error.
```

Prefer:

```text
⚠️ Payment amount is not complete.
₹250 still pending.
```

---

# 89. Important UX Confirmations

Before irreversible actions:

```text
Confirm Bill?

Mani Store
Milk - 200ml
1 Tray

Total:
₹850

[ Cancel ] [ Confirm ]
```

For day closure:

```text
Close Today's Work?

You cannot edit today's bills after closing.

[ Go Back ] [ Close Day ]
```

---

# 90. Empty States

Do not show blank screens.

Example:

```text
📦 No stock allocated yet.

Ask Store Keeper to load your vehicle.
```

---

# 91. Loading States

Use skeleton/loading indicators.

Never make the user wonder whether the button worked.

After saving:

```text
✓ Bill Saved
INV-000123
```

---

# 92. Success Feedback

For employee:

```text
✓ Bill Completed

₹850
Paid: Cash + GPay

Stock Updated
```

Then:

```text
[ Print Bill ]
[ New Bill ]
```

---

# 93. Data Accuracy Rules

Every transaction must have:
- Unique ID
- Date/time
- User
- Role
- Reference
- Status
- Audit information

Financial and stock transactions must not be silently overwritten.

---

# 94. Testing Requirements

Test at minimum:

## Stock

- Purchase
- Allocation
- Sale
- Return
- Damage
- Correction
- Unit conversion

## Billing

- Piece
- Tray
- Box
- Split payment
- Credit
- Insufficient stock
- Payment mismatch

## Settlement

- Exact cash
- Short cash
- Extra cash
- Employee expense
- Damage

## Permissions

- Employee cannot edit
- Store Keeper can correct
- Owner full access

## Offline

- Create offline bill
- Reconnect
- Sync
- Duplicate prevention
- Conflict handling

---

# 95. Acceptance Criteria

The application is considered functionally ready when:

- Owner can see today's complete business status.
- Store Keeper can receive dealer stock.
- Store Keeper can allocate stock to employees.
- Employee can create a bill in a few simple taps.
- Product full name/variant is clearly printed.
- Employee can choose Piece/Tray/Box/Pack from a simple dropdown.
- Stock automatically reduces after sale.
- Cash/UPI/Split payment is automatically calculated.
- Payment mismatch is prevented.
- Damage quantity is recorded.
- Damage cost is automatically calculated using cost price.
- Employee can record expenses.
- Remaining stock is calculated.
- Store Keeper can receive returns.
- Cash settlement is automatically reconciled.
- Employee cannot edit completed bills.
- Store Keeper can correct mistakes with audit logs.
- Owner can view detailed reports.
- Owner and Store Keeper can print A4 reports.
- Thermal bills can be printed.
- Important transactions are auditable.
- System can scale beyond the initial 7 employees and 10 products.

---

# 96. Recommended Development Order

```text
PHASE 1
Authentication + Roles
        ↓
PHASE 2
Master Data
Products / Employees / Shops / Routes / Dealers
        ↓
PHASE 3
Inventory
Receiving / Warehouse / Allocation / Return / Damage
        ↓
PHASE 4
Employee App
Shop / Billing / Payment / Printing
        ↓
PHASE 5
Settlement
Expenses / Cash / Stock / Day Closure
        ↓
PHASE 6
Owner Dashboard
Reports / Analytics / Alerts
        ↓
PHASE 7
Audit + Security
        ↓
PHASE 8
Offline + Sync
        ↓
PHASE 9
Optimization + Production
```

---

# 97. Final Product Principle

The application should not feel like accounting software to the delivery employee.

For the employee it should feel like:

```text
Choose Shop
     ↓
Choose Product
     ↓
Choose Piece / Tray
     ↓
Choose Quantity
     ↓
Choose Payment
     ↓
Print
```

For the Store Keeper it should feel like:

```text
Receive
Allocate
Return
Settle
Correct
Report
```

For the Owner it should feel like:

```text
What happened?
Why did it happen?
Where is the money?
Where is the stock?
Who has what?
What was damaged?
What is pending?
What is today's profit?
```

That separation of experience is the key UX strategy for this product.

---

# 98. Product Success Definition

The final system should make it possible for the owner to answer, at any time:

1. How much stock is in the warehouse?
2. How much stock is with each employee?
3. How much did each employee sell today?
4. Which shops bought what?
5. How much cash was collected?
6. How much UPI was collected?
7. How much credit is pending?
8. How much stock was returned?
9. How much stock was damaged?
10. What is the cost of damaged stock?
11. How much did employees spend?
12. Is any cash short?
13. Is any stock missing?
14. Which employee has a mismatch?
15. What is today's total sales?
16. What is the product-wise sales?
17. What is the employee-wise performance?
18. What is the current outstanding amount?
19. What is the business's gross profit?
20. Can all of this be printed as a professional A4 report?

If the answer to all of these is available from the application, the core business management requirement is satisfied.

---

# 99. Final Architecture Summary

```text
                    OWNER
                      │
          ┌───────────┴───────────┐
          │                       │
    STORE KEEPER              REPORTS
          │
     WAREHOUSE
          │
   STOCK ALLOCATION
          │
   ┌──────┼──────┐
   ↓      ↓      ↓
 EMP 1   EMP 2   EMP 7
   │      │      │
 ROUTE   ROUTE   ROUTE
   │      │      │
 SHOPS   SHOPS   SHOPS
   │      │      │
 BILLS   BILLS   BILLS
   │      │      │
PAYMENTS PAYMENTS PAYMENTS
   │      │      │
STOCK    STOCK   STOCK
DEDUCTION DEDUCTION DEDUCTION
   │      │      │
RETURN  RETURN  RETURN
   └──────┼──────┘
          ↓
   STORE KEEPER
          ↓
 STOCK + CASH SETTLEMENT
          ↓
       OWNER
          ↓
 REPORTS / PROFIT / AUDIT
```

---

## End of Specification

This document is intended to be used as the baseline product specification before UI design, database implementation, API development, and production deployment.
