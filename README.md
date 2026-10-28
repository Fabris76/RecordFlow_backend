# MoMo Business Management - Backend

This backend includes the secure authentication layer and the Step 2 owner-managed vendor account flow for the RecordFlow Business Management system.

---

## 🚀 Included Features

- MySQL connection using `mysql2` and `.env` values
- JWT-based login for `OWNER` and `VENDOR`
- Password hashing with `bcryptjs`
- Role-based protection for admin and vendor routes
- Owner-created vendor account management
- Vendor self-profile access
- Activation/deactivation without deleting records

---

## 🛠️ Setup & Installation

### 1. Install Dependencies
Make sure you have [Node.js](https://nodejs.org/) installed. Open your terminal in the `backend` directory and run:
```bash
npm install
```

### 2. Set Up the MySQL Database
You need a running MySQL server. 
1. Log into your MySQL server (via terminal, phpMyAdmin, MySQL Workbench, etc.).
2. Execute the provided SQL schema to create the database and table:
   * You can copy the contents of `database/schema.sql` and run it.
   * OR run this command in your terminal: `mysql -u root -p < database/schema.sql`

### 3. Configure Environment Variables
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your actual database credentials:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root          # Change if your MySQL username is different
   DB_PASSWORD=          # Enter your MySQL password here
   DB_NAME=momo_business_db
   DB_PORT=3306
   JWT_SECRET=super_secret_jwt_key_change_me
   ```

### 4. Seed Initial Data (Optional)
To instantly create a test `OWNER` and `VENDOR` account, run:
```bash
npm run seed
```
*Note: This creates two accounts (0240000000 / Admin@123 and 0241111111 / Vendor@123). Please change these passwords in production.*

### 5. Start the Server
Start the development server using nodemon (auto-restarts on code changes):
```bash
npm run dev
```
You should see: `Server is running on port 5000`

---

## 🔑 How JWT Authentication Works

1. **Login Request:** The client sends a `phone` and `password` to `/api/auth/login`.
2. **Verification:** The server checks if the user exists, is ACTIVE, and uses bcrypt to verify the password.
3. **Token Creation:** The server creates a JWT containing the user's ID, phone, role, and status, signed with the `JWT_SECRET`.
4. **Token Storage:** The server sends this token back to the client. (The client usually saves it in localStorage or cookies).
5. **Authenticated Requests:** For any protected route (like `/api/auth/me`), the client must send the token in the headers:
   `Authorization: Bearer <YOUR_TOKEN>`
6. **Validation:** The server middleware reads the token, verifies the signature, and grants access if valid.

---

## 🔌 API Endpoints & Examples

### 1. Register a User
**Endpoint:** `POST /api/auth/register`  
**Description:** Registers a new Owner or Vendor.

**Request Body:**
```json
{
    "name": "Jane Doe",
    "phone": "0245555555",
    "password": "securepassword",
    "role": "VENDOR"
}
```

**Success Response (201 Created):**
```json
{
    "message": "User registered successfully"
}
```

### 2. Login User
**Endpoint:** `POST /api/auth/login`  
**Description:** Authenticates a user and returns a JWT.

**Request Body:**
```json
{
    "phone": "0245555555",
    "password": "securepassword"
}
```

**Success Response (200 OK):**
```json
{
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
        "id": 3,
        "name": "Jane Doe",
        "phone": "0245555555",
        "role": "VENDOR",
        "status": "ACTIVE"
    }
}
```

### 3. Get Current User Profile
**Endpoint:** `GET /api/auth/me`  
**Description:** Retrieves the authenticated user's details. Requires JWT.

**Headers:**
```
Authorization: Bearer <YOUR_TOKEN>
```

**Success Response (200 OK):**
```json
{
    "user": {
        "id": 3,
        "name": "Jane Doe",
        "phone": "0245555555",
        "role": "VENDOR",
        "status": "ACTIVE",
        "created_at": "2026-08-31T12:00:00.000Z",
        "updated_at": "2026-08-31T12:00:00.000Z"
    }
}
```

---

## 🧪 How to Test the Endpoints

A file named `requests.http` has been provided in the root folder.
If you use **VS Code**, install the **REST Client** extension. 

1. Open `requests.http`.
2. Ensure your backend server is running (`npm run dev`).
3. Click the **"Send Request"** text floating above each block to instantly fire the API call and see the response.
4. After logging in, copy the `token` from the response and paste it at the top of the file where it says `@token = YOUR_JWT_TOKEN_HERE` to test the protected `/me` routes.

---

## ⚠️ IMPORTANT DEVELOPMENT NOTES

- **Never** commit your `.env` file to version control.
- **Always** change your `JWT_SECRET` in a production environment to a long, random, unguessable string.
- If you run into MySQL connection errors, ensure that your `DB_USER` and `DB_PASSWORD` exactly match your local MySQL configuration.

---

## 📊 Step 5 — Daily Closing System

### Purpose
At the end of each business day, a vendor can close their business day. Once closed, transactions for that day become **locked** and cannot be added or edited.

### Key Concept: Locked Days
Once a vendor closes a business day:
- ✅ The vendor can view the closing record
- ✅ The vendor can view transaction history
- ❌ **The vendor cannot add new transactions for that date**
- ❌ **The vendor cannot edit transactions from that date**
- ❌ The day cannot be reopened

This ensures the business records remain immutable after daily reconciliation.

### How It Works
1. Vendor logs in
2. Vendor reviews today's transactions
3. Vendor calls `POST /api/daily-closing` to close the day
4. System:
   - Calculates totals from all COMPLETED transactions
   - Creates a daily_closing record
   - Marks status as CLOSED
   - Records closed_at timestamp
5. System enforces transaction locking

### Daily Closing Calculation
The system calculates:
- Total transaction count
- Total amounts by type (DEPOSIT, WITHDRAWAL, TRANSFER, AIRTIME, DATA, BILL_PAYMENT, OTHER)
- Total amount (sum of all transactions)

**Important:** The backend calculates all totals directly from the database. The frontend does **not** send these values.

### Database Table: daily_closing
```sql
CREATE TABLE daily_closing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT NOT NULL,
    closing_date DATE NOT NULL,
    total_transactions INT DEFAULT 0,
    total_deposits DECIMAL(12,2) DEFAULT 0,
    total_withdrawals DECIMAL(12,2) DEFAULT 0,
    total_transfers DECIMAL(12,2) DEFAULT 0,
    total_airtime DECIMAL(12,2) DEFAULT 0,
    total_data DECIMAL(12,2) DEFAULT 0,
    total_bill_payments DECIMAL(12,2) DEFAULT 0,
    total_other DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    status ENUM('OPEN', 'CLOSED'),
    closed_at DATETIME,
    UNIQUE(vendor_id, closing_date),
    FOREIGN KEY (vendor_id) REFERENCES users(id)
);
```

### API Endpoints

#### 1. Close Business Day
**Endpoint:** `POST /api/daily-closing`  
**Authentication:** VENDOR only  
**Description:** Closes the business day for the authenticated vendor.

**Request Body:**
```json
{
    "closing_date": "2026-09-01"
}
```

**Business Rules:**
- Only a VENDOR can close a day
- Vendor must be ACTIVE
- Closing date cannot be in the future
- Only one closing per vendor per date (duplicate closing returns 409)

**Success Response (201 Created):**
```json
{
    "success": true,
    "message": "Business day closed successfully",
    "data": {
        "id": 1,
        "vendor_id": 2,
        "vendor_name": "John Mensah",
        "closing_date": "2026-09-01",
        "total_transactions": 5,
        "total_deposits": "1500.00",
        "total_withdrawals": "300.00",
        "total_transfers": "0.00",
        "total_airtime": "50.00",
        "total_data": "100.00",
        "total_bill_payments": "0.00",
        "total_other": "0.00",
        "total_amount": "1950.00",
        "status": "CLOSED",
        "closed_at": "2026-09-01 19:30:00"
    }
}
```

**Error Response (409 Conflict - Already Closed):**
```json
{
    "success": false,
    "message": "This business day has already been closed"
}
```

**Error Response (400 Bad Request - Future Date):**
```json
{
    "success": false,
    "message": "Future closing dates are not allowed"
}
```

#### 2. Get Today's Closing Status
**Endpoint:** `GET /api/daily-closing/today`  
**Authentication:** VENDOR only  
**Description:** Checks if today's business day is open or closed.

**Success Response (200 OK - Not Closed):**
```json
{
    "success": true,
    "data": {
        "date": "2026-09-01",
        "status": "OPEN"
    }
}
```

**Success Response (200 OK - Closed):**
```json
{
    "success": true,
    "data": {
        "date": "2026-09-01",
        "status": "CLOSED",
        "total_transactions": 5,
        "total_amount": "1950.00",
        "closed_at": "2026-09-01 19:30:00"
    }
}
```

#### 3. View Vendor's Closing History
**Endpoint:** `GET /api/daily-closing/my`  
**Authentication:** VENDOR only  
**Description:** Lists all past closing records for the authenticated vendor.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Example:**
```
GET /api/daily-closing/my?page=1&limit=20
```

**Success Response (200 OK):**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "closing_date": "2026-09-01",
            "total_transactions": 5,
            "total_deposits": "1500.00",
            "total_withdrawals": "300.00",
            "total_transfers": "0.00",
            "total_airtime": "50.00",
            "total_data": "100.00",
            "total_bill_payments": "0.00",
            "total_other": "0.00",
            "total_amount": "1950.00",
            "status": "CLOSED",
            "closed_at": "2026-09-01 19:30:00"
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
    }
}
```

#### 4. View All Closings (OWNER)
**Endpoint:** `GET /api/daily-closing`  
**Authentication:** OWNER only  
**Description:** Lists all closing records from all vendors.

**Query Parameters:**
- `vendor_id` (filter by vendor)
- `date` (filter by closing date)
- `status` (filter by OPEN or CLOSED)
- `start_date` (filter closings from this date onwards)
- `end_date` (filter closings up to this date)
- `page` (default: 1)
- `limit` (default: 20, max: 100)

**Example:**
```
GET /api/daily-closing?vendor_id=2&status=CLOSED&page=1&limit=20
```

**Success Response (200 OK):**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "vendor_id": 2,
            "vendor_name": "John Mensah",
            "closing_date": "2026-09-01",
            "total_transactions": 5,
            "total_deposits": "1500.00",
            "total_withdrawals": "300.00",
            "total_transfers": "0.00",
            "total_airtime": "50.00",
            "total_data": "100.00",
            "total_bill_payments": "0.00",
            "total_other": "0.00",
            "total_amount": "1950.00",
            "status": "CLOSED",
            "closed_at": "2026-09-01 19:30:00"
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
    }
}
```

#### 5. View Single Closing
**Endpoint:** `GET /api/daily-closing/:id`  
**Authentication:** OWNER or owning VENDOR  
**Description:** Retrieves a specific closing record.

**Success Response (200 OK):**
```json
{
    "success": true,
    "data": {
        "id": 1,
        "vendor_id": 2,
        "vendor_name": "John Mensah",
        "closing_date": "2026-09-01",
        "total_transactions": 5,
        "total_deposits": "1500.00",
        "total_withdrawals": "300.00",
        "total_transfers": "0.00",
        "total_airtime": "50.00",
        "total_data": "100.00",
        "total_bill_payments": "0.00",
        "total_other": "0.00",
        "total_amount": "1950.00",
        "status": "CLOSED",
        "closed_at": "2026-09-01 19:30:00"
    }
}
```

**Error Response (403 Forbidden - Unauthorized Vendor):**
```json
{
    "success": false,
    "message": "You are not authorized to view this closing"
}
```

---

### Transaction Locking Behavior

#### Creating a Transaction When Day is Closed
**Endpoint:** `POST /api/transactions`  
**When the business day is CLOSED:**

**Error Response (403 Forbidden):**
```json
{
    "success": false,
    "message": "The business day is already closed. New transactions cannot be recorded for this date."
}
```

#### Editing a Transaction When Day is Closed
**Endpoint:** `PUT /api/transactions/:id`  
**When the transaction's date has a CLOSED closing:**

**Error Response (403 Forbidden):**
```json
{
    "success": false,
    "message": "This transaction belongs to a closed business day and cannot be edited."
}
```

---

### Important Rules

1. **One Closing Per Day:** A vendor can have only ONE daily closing for a specific date.
2. **Only COMPLETED Transactions:** Closing calculations only include transactions with `status = COMPLETED`. PENDING and FAILED transactions are excluded.
3. **Backend Calculation:** All totals are calculated by the backend. The frontend must NOT send type-specific totals.
4. **Date Control:** The business date is controlled by the backend using the server's date. Vendors cannot manipulate dates.
5. **No Reopening:** Once a day is CLOSED, it cannot be reopened.
6. **Inactive Vendors:** Inactive vendors cannot create a new closing, but can still view their historical records.
7. **Transaction History Preserved:** When a transaction is edited before closing, the closing uses the final value. The edit history is preserved in `transaction_history`.

### Example Workflow

```
1. Vendor logs in
   → Vendor's today status: OPEN

2. Vendor creates transactions
   → POST /api/transactions (DEPOSIT 500)
   → POST /api/transactions (DEPOSIT 1000)
   → POST /api/transactions (WITHDRAWAL 300)
   → POST /api/transactions (AIRTIME 50)
   → POST /api/transactions (DATA 100)

3. Vendor checks today's status
   → GET /api/daily-closing/today
   → Status: OPEN

4. Vendor closes the business day
   → POST /api/daily-closing { closing_date: "2026-09-01" }
   → System calculates totals
   → Returns CLOSED status with totals

5. Vendor checks today's status again
   → GET /api/daily-closing/today
   → Status: CLOSED

6. Vendor tries to add a transaction
   → POST /api/transactions
   → ERROR 403: "The business day is already closed..."

7. Vendor tries to edit a transaction
   → PUT /api/transactions/1
   → ERROR 403: "This transaction belongs to a closed business day..."

8. Owner views all closings
   → GET /api/daily-closing
   → Sees all closings from all vendors

9. Owner views vendor's specific closing
   → GET /api/daily-closing/1
   → See detailed breakdown
```

### Testing the Daily Closing Feature

See the `requests.http` file for example API calls to test closing operations.

---

## STEP 6 — Balance Management

Vendor balance tracking with automatic effects from DEPOSIT and WITHDRAWAL transactions. Each vendor has two balance types: cash and mobile money (MoMo). Balance changes are recorded in an append-only audit trail with full traceability.

### Balance Types

- **CASH**: Physical cash held by the vendor
- **MOMO**: Mobile money balance available for customer transactions

### Transaction Balance Effects

When a vendor creates a transaction, the following balance changes occur automatically:

| Transaction Type | Cash Effect | MoMo Effect | Use Case |
|---|---|---|---|
| DEPOSIT | Increase | Decrease | Customer deposits cash, vendor loses MoMo balance |
| WITHDRAWAL | Decrease | Increase | Customer withdraws cash, vendor gains MoMo balance |
| TRANSFER | No effect | No effect | Transfers between vendors (no balance impact) |
| AIRTIME | No effect | No effect | Airtime purchase services |
| DATA | No effect | No effect | Data bundle purchase services |
| BILL_PAYMENT | No effect | No effect | Bill payment services |
| OTHER | No effect | No effect | Miscellaneous transactions |

### Key Features

1. **Atomic Transactions**: All balance updates are atomic. If a transaction fails, balances are rolled back.
2. **Row-Level Locking**: Using `SELECT ... FOR UPDATE`, prevents concurrent balance conflicts.
3. **Negative Balance Prevention**: System rejects transactions that would result in negative balances.
4. **Append-Only Audit Trail**: All balance changes are recorded immutably in `balance_history`.
5. **Owner Manual Adjustments**: The business owner can manually adjust vendor balances with a reason.
6. **Transaction Editing**: When a transaction is edited, the original balance effect is reversed and the new effect is applied.

### API Endpoints

#### Get Own Balance
**Endpoint:** `GET /api/balances/me`  
**Auth:** VENDOR only  
**Response:**
```json
{
    "success": true,
    "data": {
        "vendor_id": 1,
        "cash_balance": "5000.00",
        "momo_balance": "10000.00",
        "updated_at": "2026-09-15 14:30:00"
    }
}
```

#### Get All Vendor Balances
**Endpoint:** `GET /api/balances`  
**Auth:** OWNER only  
**Response:**
```json
{
    "success": true,
    "data": [
        {
            "vendor_id": 1,
            "vendor_name": "John Vendor",
            "cash_balance": "5000.00",
            "momo_balance": "10000.00"
        },
        {
            "vendor_id": 2,
            "vendor_name": "Jane Vendor",
            "cash_balance": "3000.00",
            "momo_balance": "8000.00"
        }
    ]
}
```

#### Get Specific Vendor Balance
**Endpoint:** `GET /api/balances/:vendorId`  
**Auth:** OWNER only  
**Response:**
```json
{
    "success": true,
    "data": {
        "vendor_id": 1,
        "vendor_name": "John Vendor",
        "cash_balance": "5000.00",
        "momo_balance": "10000.00"
    }
}
```

#### Adjust Vendor Balance
**Endpoint:** `POST /api/balances/:vendorId/adjust`  
**Auth:** OWNER only  
**Request:**
```json
{
    "balance_type": "CASH",
    "amount": 1000.00,
    "reason": "Manual adjustment - compensation for lost shipment"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Balance adjusted successfully",
    "data": {
        "vendor_id": 1,
        "cash_balance": "6000.00",
        "momo_balance": "10000.00"
    }
}
```

**Validation Rules:**
- `balance_type` must be "CASH" or "MOMO"
- `amount` can be positive (increase) or negative (decrease)
- `reason` must be at least 5 characters
- The resulting balance cannot be negative

#### Get Own Balance History
**Endpoint:** `GET /api/balances/me/history`  
**Auth:** VENDOR only  
**Query Parameters:**
- `balance_type`: Filter by CASH or MOMO
- `start_date`: Filter by date (YYYY-MM-DD)
- `end_date`: Filter by date (YYYY-MM-DD)
- `page`: Pagination (default: 1)
- `limit`: Results per page (default: 20, max: 100)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "balance_type": "CASH",
            "change_amount": "500.00",
            "previous_balance": "5000.00",
            "new_balance": "5500.00",
            "reason": "DEPOSIT transaction #42",
            "reference_type": "TRANSACTION",
            "reference_id": 42,
            "changed_by_name": "John Vendor",
            "created_at": "2026-09-15 14:30:00"
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 150,
        "totalPages": 8
    }
}
```

#### Get All Balance History
**Endpoint:** `GET /api/balance-history`  
**Auth:** OWNER only  
**Query Parameters:**
- `vendor_id`: Filter by vendor
- `balance_type`: Filter by CASH or MOMO
- `start_date`: Filter by date (YYYY-MM-DD)
- `end_date`: Filter by date (YYYY-MM-DD)
- `page`: Pagination (default: 1)
- `limit`: Results per page (default: 20, max: 100)

**Response:**
```json

---

## STEP 7 — Transaction Search, Filtering & Pagination

### Overview
Vendors and Owners can search, filter, sort, and paginate through transactions with comprehensive query options. All filtering is enforced at the controller and database layers with role-based access control (RBAC).

### Key Features
- **14+ Search Parameters**: Type, status, date range, amount range, customer reference, transaction reference, vendor search (OWNER only)
- **RBAC Security**: Vendors can ONLY see their own transactions; vendor_id parameter is ignored for vendor requests
- **Flexible Sorting**: Sort by amount, transaction_date, or created_at (ascending/descending)
- **Pagination**: Page-based navigation with configurable limit (default 20, max 100)
- **Database Optimization**: Indexes on frequently searched columns for performance
- **Comprehensive Validation**: All query parameters validated with specific error messages

### API Endpoint: Get Transactions

#### Vendor - Get My Transactions
**Endpoint:** `GET /api/transactions`  
**Auth:** VENDOR only  
**RBAC:** Vendors automatically see only their own transactions (vendor_id = req.user.id)

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `type` | string | Transaction type (DEPOSIT, WITHDRAWAL, TRANSFER, AIRTIME, DATA, BILL_PAYMENT, OTHER) | `?type=DEPOSIT` |
| `status` | string | Transaction status (COMPLETED, PENDING, FAILED) | `?status=COMPLETED` |
| `date` | string | Exact date filter (YYYY-MM-DD) | `?date=2026-01-15` |
| `start_date` | string | Date range start (YYYY-MM-DD) | `?start_date=2026-01-01` |
| `end_date` | string | Date range end (YYYY-MM-DD) | `?end_date=2026-12-31` |
| `amount` | number | Exact amount filter | `?amount=500.00` |
| `min_amount` | number | Minimum amount filter | `?min_amount=100.00` |
| `max_amount` | number | Maximum amount filter | `?max_amount=1000.00` |
| `customer_reference` | string | LIKE search on customer reference | `?customer_reference=DEP` |
| `transaction_reference` | string | LIKE search on transaction reference | `?transaction_reference=TXN` |
| `sort_by` | string | Sort field (amount, transaction_date, created_at, transaction_time) | `?sort_by=amount` |
| `sort_order` | string | Sort direction (asc, desc) | `?sort_order=desc` |
| `page` | integer | Page number (default: 1, min: 1) | `?page=2` |
| `limit` | integer | Results per page (default: 20, max: 100) | `?limit=50` |

**Example Requests:**

```bash
# Get all transactions with default pagination
GET /api/transactions

# Get completed deposits
GET /api/transactions?type=DEPOSIT&status=COMPLETED

# Get transactions between ₵250 and ₵1000
GET /api/transactions?min_amount=250&max_amount=1000

# Get transactions from January 2026, sorted by amount descending, page 2 with 25 results per page
GET /api/transactions?start_date=2026-01-01&end_date=2026-01-31&sort_by=amount&sort_order=desc&page=2&limit=25

# Search customer reference containing "DEP", completed status
GET /api/transactions?customer_reference=DEP&status=COMPLETED
```

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 42,
            "vendor_id": 1,
            "type": "DEPOSIT",
            "amount": "500.00",
            "status": "COMPLETED",
            "customer_reference": "DEP-12345",
            "transaction_reference": "TXN-2026-0001",
            "description": null,
            "transaction_date": "2026-01-15",
            "transaction_time": "10:30:00",
            "created_at": "2026-01-15 10:30:00",
            "updated_at": "2026-01-15 10:30:00"
        },
        {
            "id": 43,
            "vendor_id": 1,
            "type": "WITHDRAWAL",
            "amount": "250.00",
            "status": "PENDING",
            "customer_reference": "WTH-67890",
            "transaction_reference": "TXN-2026-0002",
            "description": "Pending approval",
            "transaction_date": "2026-01-15",
            "transaction_time": "14:15:00",
            "created_at": "2026-01-15 14:15:00",
            "updated_at": "2026-01-15 14:15:00"
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 145,
        "totalPages": 8
    }
}
```

#### Owner - Get All Transactions
**Endpoint:** `GET /api/transactions`  
**Auth:** OWNER only  
**RBAC:** Owner can access all transactions and search by vendor

**Additional Query Parameters (OWNER only):**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `vendor_id` | integer | Filter by specific vendor | `?vendor_id=2` |
| `vendor_name` | string | LIKE search on vendor name | `?vendor_name=John` |

**Example Requests:**

```bash
# Get all transactions for vendor ID 2
GET /api/transactions?vendor_id=2

# Get transactions from vendors with "Worker" in their name
GET /api/transactions?vendor_name=Worker

# Complex search: Vendor 1, type TRANSFER, status COMPLETED, sorted by date
GET /api/transactions?vendor_id=1&type=TRANSFER&status=COMPLETED&sort_by=transaction_date&sort_order=desc

# Date range and amount filter for vendor 3
GET /api/transactions?vendor_id=3&start_date=2026-01-01&end_date=2026-12-31&min_amount=100&max_amount=5000
```

**Response:** Same structure as Vendor response, but includes transactions from all vendors

### Validation Rules

| Rule | Error Code | Error Message |
|------|-----------|--------|
| Invalid type | 400 | "Invalid transaction type" |
| Invalid status | 400 | "Invalid transaction status" |
| Invalid date format | 400 | "Invalid date format. Use YYYY-MM-DD" |
| start_date > end_date | 400 | "Start date cannot be greater than end date" |
| Negative amount | 400 | "Amount cannot be negative" |
| min_amount > max_amount | 400 | "Minimum amount cannot be greater than maximum amount" |
| Invalid sort_by | 400 | "Invalid sort field" |
| Invalid sort_order | 400 | "Invalid sort order" |
| Invalid page/limit | 400 | "Page and limit must be positive integers" |
| Missing token | 401 | "Unauthorized" |
| Invalid token | 401 | "Unauthorized" |

### Sorting

**Allowed Sort Fields:**
- `amount`: Transaction amount
- `transaction_date`: Business day date
- `created_at`: Record creation timestamp
- `transaction_time`: Transaction time within the day

**Sort Order:**
- `asc`: Ascending order (smallest to largest for amounts, earliest to latest for dates)
- `desc`: Descending order (largest to smallest for amounts, latest to earliest for dates)

**Default:** `sort_by=created_at` with `sort_order=desc` (newest first)

### Pagination

**Limits:**
- Default limit: 20 results per page
- Maximum limit: 100 results per page
- Limit > 100 is automatically capped at 100
- Limit < 1 defaults to 20
- Page < 1 defaults to page 1

**Response Fields:**
- `page`: Current page number
- `limit`: Results returned per page
- `total`: Total number of matching records
- `totalPages`: Total pages available (`Math.ceil(total / limit)`)

### Database Optimization

**Indexes for Performance:**
- `idx_transactions_vendor_date`: (vendor_id, transaction_date) - for vendor + date filtering
- `idx_transactions_type_status`: (type, status) - for type/status filtering
- `idx_transactions_created_at`: (created_at) - for sorting by created_at
- `idx_transactions_amount`: (amount) - for amount range queries
- `idx_transactions_transaction_reference`: (transaction_reference) - for reference lookups

These indexes ensure efficient queries even with large transaction volumes.

### Security Notes

1. **VENDOR Endpoint Security:**
   - Vendors automatically see only their own transactions
   - `vendor_id` parameter in query string is completely ignored for vendors
   - Cannot be bypassed by URL manipulation or parameter injection
   - Enforcement is at controller layer (req.user.id)

2. **OWNER Endpoint Security:**
   - Can access all transactions
   - Can filter by `vendor_id` or `vendor_name`
   - Passwords never exposed in responses
   - All SQL queries use parameterized statements (no SQL injection)

3. **Date Validation:**
   - Format must be YYYY-MM-DD (ISO 8601 standard)
   - Invalid formats rejected with 400 error
   - Date range validation prevents illogical queries

4. **Amount Validation:**
   - Negative amounts rejected with 400 error
   - min_amount and max_amount must be >= 0
   - Logic validation ensures min <= max

### Error Responses

**400 Bad Request Example:**
```json
{
    "success": false,
    "message": "Invalid transaction type"
}
```

**401 Unauthorized Example:**
```json
{
    "success": false,
    "message": "Unauthorized"
}
```

### Common Use Cases

**Use Case 1: Vendor searches for large deposits**
```bash
GET /api/transactions?type=DEPOSIT&min_amount=500&sort_by=amount&sort_order=desc
```

**Use Case 2: Owner checks failed transactions from January**
```bash
GET /api/transactions?status=FAILED&start_date=2026-01-01&end_date=2026-01-31&sort_by=created_at&sort_order=desc
```

**Use Case 3: Vendor finds specific customer reference**
```bash
GET /api/transactions?customer_reference=ABC123&limit=50
```

**Use Case 4: Owner audits specific vendor's activity**
```bash
GET /api/transactions?vendor_id=3&sort_by=transaction_date&sort_order=desc&page=1&limit=100
```

**Use Case 5: Vendor checks pending transactions**
```bash
GET /api/transactions?status=PENDING&sort_by=created_at&sort_order=desc
```
{
    "success": true,
    "data": [
        {
            "id": 1,
            "vendor_id": 1,
            "vendor_name": "John Vendor",
            "balance_type": "CASH",
            "change_amount": "500.00",
            "previous_balance": "5000.00",
            "new_balance": "5500.00",
            "reason": "DEPOSIT transaction #42",
            "reference_type": "TRANSACTION",
            "reference_id": 42,
            "changed_by_name": "John Vendor",
            "created_at": "2026-09-15 14:30:00"
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1500,
        "totalPages": 75
    }
}
```

### Database Schema

#### `vendor_balances` Table
| Column | Type | Description |
|---|---|---|
| id | BIGINT | Primary key |
| vendor_id | BIGINT | Foreign key to users (UNIQUE) |
| cash_balance | DECIMAL(12,2) | Cash balance (default: 0.00) |
| momo_balance | DECIMAL(12,2) | MoMo balance (default: 0.00) |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

#### `balance_history` Table
| Column | Type | Description |
|---|---|---|
| id | BIGINT | Primary key |
| vendor_id | BIGINT | Foreign key to users |
| balance_type | ENUM('CASH', 'MOMO') | Which balance was changed |
| change_amount | DECIMAL(12,2) | Amount added/removed |
| previous_balance | DECIMAL(12,2) | Balance before change |
| new_balance | DECIMAL(12,2) | Balance after change |
| reason | VARCHAR(255) | Description of change |
| reference_type | VARCHAR(50) | Type of reference (TRANSACTION, MANUAL_ADJUSTMENT) |
| reference_id | BIGINT | ID of referenced transaction/adjustment |
| changed_by | BIGINT | User ID who made the change |
| created_at | TIMESTAMP | Record creation time (append-only) |

### Example Workflow

```
1. Vendor balance created when account is created
   → Initial: cash_balance = 0.00, momo_balance = 0.00

2. Owner manually adjusts balance
   → POST /api/balances/1/adjust { balance_type: "MOMO", amount: 10000, reason: "Initial top-up for operations" }
   → Balance: cash_balance = 0.00, momo_balance = 10000.00
   → balance_history entry created with reason "Initial top-up for operations"

3. Vendor creates DEPOSIT transaction (₵500)
   → POST /api/transactions { type: "DEPOSIT", amount: 500 }
   → Atomically updates:
     * cash_balance += 500 (customer deposits cash)
     * momo_balance -= 500 (vendor loses MoMo balance)
   → Creates 2 balance_history entries:
     * CASH: change_amount = +500, reason = "DEPOSIT transaction #1"
     * MOMO: change_amount = -500, reason = "DEPOSIT transaction #1"
   → Balance: cash_balance = 500.00, momo_balance = 9500.00

4. Vendor creates WITHDRAWAL transaction (₵250)
   → POST /api/transactions { type: "WITHDRAWAL", amount: 250 }
   → Atomically updates:
     * cash_balance -= 250 (vendor gives cash)
     * momo_balance += 250 (customer's MoMo increases)
   → Creates 2 balance_history entries
   → Balance: cash_balance = 250.00, momo_balance = 9750.00

5. Vendor edits first DEPOSIT from ₵500 to ₵300
   → PUT /api/transactions/1 { amount: 300 }
   → Reversal (undo original effect):
     * cash_balance -= 500
     * momo_balance += 500
   → Apply new effect:
     * cash_balance += 300
     * momo_balance -= 300
   → Net result: cash_balance decreases by 200, momo_balance increases by 200
   → Creates 4 balance_history entries (2 for reversal, 2 for new effect)
   → Final balance: cash_balance = 50.00, momo_balance = 9950.00

6. Vendor tries to create DEPOSIT but has insufficient MoMo
   → POST /api/transactions { type: "DEPOSIT", amount: 10000 }
   → ERROR 400: "Insufficient MoMo balance. Required: 10000.00, Available: 9950.00"
   → Balance unchanged, atomic rollback

7. Owner views all balance changes
   → GET /api/balance-history
   → See all changes from all vendors with who made each change
```

### Important Rules

1. **Automatic Balance Creation**: A vendor's balance is automatically created when the vendor account is created (0.00, 0.00).
2. **Atomic Updates**: Balance and transaction updates are atomic. Both succeed or both fail.
3. **Immutable History**: Once recorded, balance history entries cannot be modified or deleted.
4. **Concurrency Safety**: Row-level locking prevents race conditions in concurrent operations.
5. **Negative Balance Prevention**: No transaction or adjustment can result in a negative balance.
6. **Reference Tracking**: Every balance change is linked to either a transaction or manual adjustment.
7. **Audit Trail**: The user who made the change (`changed_by`) is always recorded.
8. **No Manual Balance Edit**: Vendors cannot directly edit balances. Only the owner can via the adjust endpoint.

### Testing the Balance Feature

See the `requests.http` file for example API calls (Tests 26-45) to test balance operations.

### 4. Search and Filter Transactions
**Endpoint:** GET /api/transactions
**Description:** Retrieves paginated and filtered transactions. OWNER can view all, VENDOR can only view their own.

**Supported Query Parameters:**
* 	ype: Filter by type (e.g., DEPOSIT, WITHDRAWAL)
* endor_id: Filter by vendor ID (OWNER only)
* endor_name: Filter by vendor name (OWNER only, uses LIKE search)
* date: Filter by exact date (YYYY-MM-DD)
* start_date / end_date: Filter by date range
* mount: Filter by exact amount
* min_amount / max_amount: Filter by amount range
* status: Filter by status (e.g., COMPLETED, PENDING)
* customer_reference: Filter by customer reference (uses LIKE search)
* 	ransaction_reference: Filter by exact transaction reference
* sort_by: Field to sort by (mount, 	ransaction_date, created_at, 	ransaction_time)
* sort_order: Sort order (sc or desc)
* page: Pagination page (default 1)
* limit: Items per page (default 20, max 100)

**Example Requests:**
`ash
# Get deposits today (Vendor or Owner)
GET /api/transactions?type=DEPOSIT&date=2026-09-01

# Get John's withdrawals (Owner only)
GET /api/transactions?vendor_id=2&type=WITHDRAWAL

# Get transactions above GH₵500, newest first
GET /api/transactions?min_amount=500&sort_by=created_at&sort_order=desc
`

### 5. Reports (Owner Only)
**Endpoint:** `GET /api/reports/...`
**Description:** Generates aggregate business reports.

## Reports Module
Reports are generated dynamically from transaction and daily closing data.
Transaction amount is not the same as business profit.

Documented Endpoints:
* Daily report: `GET /api/reports/daily?date=2026-09-01` (Optionally add `&vendor_id=2` for vendor-specific daily report)
* Weekly report: `GET /api/reports/weekly?start_date=2026-09-01&end_date=2026-09-07` (Dates are optional; defaults to current week)
* Monthly report: `GET /api/reports/monthly?year=2026&month=9`
* Transaction type report: `GET /api/reports/transaction-types?start_date=2026-09-01&end_date=2026-09-07`
* Vendor performance report: `GET /api/reports/vendors?start_date=2026-09-01&end_date=2026-09-07&sort_by=total_amount&sort_order=desc`
* Daily trend report: `GET /api/reports/daily-trend?start_date=2026-09-01&end_date=2026-09-07` (Daily aggregate series for charts)
* Closing report: `GET /api/reports/closing?start_date=2026-09-01&end_date=2026-09-07` (Overview of vendor daily closings)

**Example Request:**
`GET /api/reports/daily?date=2026-09-01`

**Example Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-09-01",
    "total_transactions": 200,
    "total_amount": "35000.00",
    "total_deposits": "20000.00",
    "total_withdrawals": "15000.00",
    "total_transfers": "0.00",
    "total_airtime": "0.00",
    "total_data": "0.00",
    "total_bill_payments": "0.00",
    "total_other": "0.00"
  }
}
```

Reports endpoints only summarize transactions that are COMPLETED.

## STEP 11 - Backup & Data Recovery

Backup and restore are owner-only backend operations. Backup files are valid MySQL dumps created with `mysqldump` and stored in `storage/backups/`, outside any public or static directory. The server generates filenames; clients cannot provide paths or SQL.

Set `MYSQLDUMP_PATH` and `MYSQL_PATH` in `.env` when the MySQL client utilities are not on `PATH`. Database credentials remain server-side and are never returned by the API. Backups are retained until a future retention policy is implemented.

### Backup API

All endpoints require an active `OWNER` JWT. Vendors receive `403`; unauthenticated requests receive `401`.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/backups` | Create a database dump and record `COMPLETED` metadata |
| `GET` | `/api/backups?page=1&limit=20` | List backup metadata with database pagination |
| `GET` | `/api/backups/:id/download` | Download a registered completed backup |
| `POST` | `/api/backups/:id/restore` | Create a safety backup, then restore a registered backup |

There is no delete endpoint and no scheduled or cloud backup. Listing never exposes physical server paths. Downloading resolves only server-generated filenames that pass path-containment validation.

### Restore Safety

Restore requires this exact request body:

```json
{
    "confirmation": "RESTORE_DATABASE"
}
```

Before restoration, the server creates a current-database safety backup. It then restores only the selected registered file with the `mysql` utility and verifies the required tables exist: users, vendors, transactions, transaction history, daily closings, balances, balance history, audit logs, notifications, and backups.

Backup activity is recorded in `audit_logs` with `BACKUP_CREATED`, `BACKUP_RESTORE_STARTED`, `BACKUP_RESTORE_SUCCESS`, or `BACKUP_RESTORE_FAILED`. Audit metadata does not contain database credentials.

## STEP 12 - Business Analytics

These owner-only backend APIs provide aggregated data for a future dashboard. They use existing transactions, users/vendors, daily closings, transaction history, and balance history. No summary tables, frontend, charts, profit calculations, branches, or locations are added.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/analytics/dashboard` | Today's completed transaction totals, vendor counts, and closing status |
| `GET` | `/api/analytics/vendor-performance` | Completed transaction count/value by vendor; optional `start_date`, `end_date`, `sort_by`, `sort_order` |
| `GET` | `/api/analytics/transaction-types` | Completed transaction count/value grouped by type; optional date range |
| `GET` | `/api/analytics/transaction-trend?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` | Completed daily trend in ascending date order |
| `GET` | `/api/analytics/comparison` | Compare required current and previous date periods |
| `GET` | `/api/analytics/activity-summary` | Today's transactions, vendors, closings, large transactions, edits, and adjustments |
| `GET` | `/api/analytics/large-transactions` | Completed transactions at or above `LARGE_TRANSACTION_THRESHOLD`; optional date range |
| `GET` | `/api/analytics/transaction-edits` | Total edits and vendors with edits from `transaction_history` |

All endpoints require an active `OWNER` JWT. Vendors receive `403`, and unauthenticated requests receive `401`. Optional date filters use all stored dates when omitted. Dates must be real `YYYY-MM-DD` calendar dates, and start dates cannot follow end dates.

Vendor performance accepts only `sort_by=transaction_count` or `sort_by=transaction_amount`, and only `sort_order=asc` or `sort_order=desc`. Defaults are transaction amount descending. The comparison endpoint uses:

```text
/api/analytics/comparison?current_start_date=2026-09-01&current_end_date=2026-09-07&previous_start_date=2026-08-25&previous_end_date=2026-08-31
```

Percentage changes return `null` when the previous value is zero. Monetary values are returned as two-decimal strings; counts are numeric. Transaction value is not profit or revenue.

## STEP 13 - Backend Security & Validation

The backend now applies shared security controls without changing the business model:

- `helmet` security headers remain enabled.
- JSON request bodies are limited to `100kb`.
- Every request receives an `X-Request-ID`; error responses include `request_id`.
- Unexpected errors use a centralized handler and return `An internal server error occurred` without stack traces, SQL, paths, credentials, or environment values.
- CORS is restricted to the comma-separated `FRONTEND_URL` environment value. It is not open to every origin by default.
- JWT verification is pinned to `HS256` and still enforces token expiry and live account status.
- Login attempts are rate-limited to 10 attempts per 15 minutes per client route. General API traffic and sensitive writes have separate moderate limits and return `429` with `Retry-After` when exceeded.
- Public registration cannot create `OWNER` accounts; owner-created vendor provisioning remains the administrative path.
- Financial amounts reject empty values, exponent notation, non-finite values, negative/zero transaction amounts, excess decimal precision, and values above the supported maximum.
- Closing dates are validated as real calendar dates, not merely parseable date strings.
- Balance adjustment amounts and reasons have precision, size, and range limits.
- Existing owner/vendor middleware and object-level transaction ownership checks remain enforced.
- Backup filenames remain server-generated and path-contained; restore still requires `RESTORE_DATABASE`, a completed registered backup, a safety backup, and audit events.

Example controlled errors:

```json
{
    "success": false,
    "message": "Too many requests",
    "request_id": "8b5f2f1a-1c4d-4a7c-a25c-7ad4b1e9cf0e"
}
```

Credentials remain environment-only. No branches, locations, frontend code, new transaction types, or profit calculations were introduced.

## STEP 14 - API Documentation & Testing

The authoritative OpenAPI contract is [openapi.yaml](openapi.yaml). It documents the `/api` endpoints plus `GET /health`, their roles, request parameters, request bodies, and common responses. The owner-protected `GET /api/audit` endpoint lists recorded audit events with optional action, entity, date, and pagination filters.

### Authentication

Call `POST /api/auth/login` with a phone and password. The response contains a one-day JWT. Send it on protected requests as:

```text
Authorization: Bearer <token>
```

The server verifies the signature with the configured `JWT_SECRET`, pins the algorithm to `HS256`, checks expiry, and rechecks the user's active database status. Missing tokens return `401`; invalid or expired tokens return `403`; authenticated users without the required role return `403`.

Public registration is limited to `VENDOR`; owner accounts are created and managed through the owner-managed vendor workflow. Vendor IDs used by transactions and balances are the linked `users.id` values returned by the API.

### API Modules

| Module | Routes | Access |
|---|---|---|
| Authentication | `/api/auth/*` | Public login/register; JWT profile; role checks |
| Vendors | `/api/vendors/*` | OWNER management; VENDOR own profile |
| Transactions | `/api/transactions/*` | VENDOR creates/owns; OWNER views/edits business-wide |
| Transaction History | `/api/transaction-history/*` and transaction history subroute | OWNER or owning VENDOR |
| Daily Closing | `/api/daily-closing/*` | VENDOR own closing; OWNER business-wide reads |
| Balances | `/api/balances/*`, `/api/balance-history` | OWNER business-wide; VENDOR own permitted reads |
| Reports | `/api/reports/*` | OWNER |
| Notifications | `/api/notifications/*` | OWNER |
| Backups | `/api/backups/*` | OWNER |
| Analytics | `/api/analytics/*` | OWNER |

There are no branches, locations, `branch_id`, `location_id`, frontend routes, or audit-log mutation endpoints.

### Status Codes and Errors

`200` means a successful read/update, `201` a successful creation, `400` invalid input, `401` missing authentication, `403` invalid/expired token or insufficient role, `404` missing resource/route, `409` conflict, `413` oversized JSON, `429` rate limit exceeded, and `500` unexpected server failure. Unexpected errors return a safe message and request ID without stack traces, SQL, passwords, or filesystem paths.

### Testing

The project uses Node's built-in test runner and does not run destructive integration tests against the normal database. Current tests cover validation, analytics, backup path security, request IDs, rate limiting, HTTP health/auth/404 smoke behavior, and existing regression helpers.

```powershell
npm test
npm run test:watch
npm run test:coverage
```

For database-backed integration work, copy `.env.test.example` to `.env.test`, use the separate `momo_business_test_db` database, and never point destructive setup at `momo_business_db`. The current suite does not reset or drop any database. Production credentials are not stored in documentation, tests, or `.env.example`.

## STEP 10 - Notifications

Notifications are in-app backend alerts for the business owner. This step does not add a frontend, email, SMS, push delivery, branches, or locations.

### Notification Types

- `VENDOR_CREATED`
- `VENDOR_ACTIVATED`
- `VENDOR_DEACTIVATED`
- `TRANSACTION_EDITED`
- `LARGE_TRANSACTION`
- `BALANCE_ADJUSTED`
- `DAILY_CLOSING_COMPLETED`
- `CLOSING_PENDING`
- `UNUSUAL_ACTIVITY`

Notifications are created through the centralized notification service. Vendor creation and status changes, transaction edits, completed large transactions, owner balance adjustments, successful daily closings, and unusual completed-transaction activity are recorded atomically with their underlying operation. A failed operation rolls back its notification.

Large transaction alerts use `LARGE_TRANSACTION_THRESHOLD` from the environment and default to `5000`. Only completed transactions at or above the threshold alert the owner. Unusual activity means more than 20 completed transactions by one vendor within 10 minutes; identical alerts for that vendor are suppressed for 10 minutes.

### Owner Notification API

All endpoints require a valid owner JWT. Results are always limited to the authenticated owner identified by `req.user.id`; vendors receive `403` and unauthenticated requests receive `401`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/notifications` | List notifications with `page`, `limit`, `type`, `is_read`, `start_date`, `end_date`, and `sort_order` filters |
| `GET` | `/api/notifications/unread` | List unread notifications, newest first |
| `GET` | `/api/notifications/unread/count` | Return the unread count using `COUNT(*)` |
| `PATCH` | `/api/notifications/:id/read` | Mark one owned notification as read |
| `PATCH` | `/api/notifications/read-all` | Mark all owned notifications as read |
| `GET` | `/api/notifications/closing-pending?date=2026-09-06` | Identify active vendors without a closing for a date |

The list endpoint defaults to page 1, 20 records, and newest-first ordering. The maximum page size is 100. Notification history is retained; there is no delete endpoint.

Example response:

```json
{
    "success": true,
    "data": [
        {
            "id": 25,
            "type": "TRANSACTION_EDITED",
            "title": "Transaction Edited",
            "message": "Transaction TX-1002 was edited by John Mensah.",
            "entity_type": "TRANSACTION",
            "entity_id": 1002,
            "is_read": false,
            "created_at": "2026-09-06 11:10:00",
            "read_at": null
        }
    ],
    "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
    }
}
```
