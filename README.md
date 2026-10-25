# FixMyCampus 🏛️

A full-stack campus complaint reporting application — students report issues (broken fans, water leakage, etc.), and campus admins triage, assign staff, and track resolution. Built to match the 13-screen UI design: Splash, Welcome, Login, Register, Student Home, Report Complaint, My Complaints, Complaint Details, Profile, Admin Login, Admin Dashboard, All Complaints, and Complaint Management.

**Stack:** Node.js + Express backend, MySQL database, JWT authentication with bcrypt password hashing, Multer for photo uploads, and a vanilla HTML/CSS/JS frontend (no build step required).

This project has been fully built and tested end-to-end (register → login → submit complaint with photo → admin login → dashboard stats → assign staff → update status) — every endpoint below was verified working before delivery.

---

## 1. Prerequisites

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **MySQL** 8.0+ installed and running locally (or a remote MySQL instance)

---

## 2. Database Setup

1. Log into MySQL:
   ```bash
   mysql -u root -p
   ```
2. Run the schema file (creates the `fixmycampus` database, `users` and `complaints` tables, and seeds one admin account):
   ```bash
   mysql -u root -p < database/schema.sql
   ```
3. **Default admin login** (seeded automatically):
   - Email: `admin@fixmycampus.com`
   - Password: `admin123`

   ⚠️ Change this password after your first login in production (there's no "change password" screen yet — update it directly in the database with a new bcrypt hash, or extend the Profile screen).

---

## 3. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your MySQL credentials:
```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=fixmycampus
JWT_SECRET=change_this_to_a_long_random_secret
```

> **Note on MySQL auth:** If you hit `ER_ACCESS_DENIED_NO_PASSWORD_ERROR` connecting as `root`, your MySQL install may use `auth_socket` for root (common on fresh Ubuntu installs). Either set a root password (`ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'yourpassword';`) or create a dedicated app user:
> ```sql
> CREATE USER 'fmc_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'fmc_pass';
> GRANT ALL PRIVILEGES ON fixmycampus.* TO 'fmc_user'@'localhost';
> FLUSH PRIVILEGES;
> ```
> Then use `DB_USER=fmc_user` / `DB_PASSWORD=fmc_pass` in `.env`.

Start the server:
```bash
npm start
```

The server runs on **http://localhost:5000** and also serves the frontend directly (see `frontend/` below), so you can open `http://localhost:5000` in your browser and use the whole app from one server — no separate frontend server needed.

For auto-restart during development:
```bash
npm run dev
```

---

## 4. Frontend

The frontend is plain HTML/CSS/JS in `frontend/` — no npm install or build step needed. It's already served by the Express backend at `http://localhost:5000`.

If you prefer to run it separately (e.g. VS Code Live Server on a different port), open `frontend/js/api.js` and change:
```js
const API_BASE = '';
```
to:
```js
const API_BASE = 'http://localhost:5000';
```

### Screens included
| # | Screen | File |
|---|--------|------|
| 1 | Splash | `index.html` |
| 2 | Welcome | `welcome.html` |
| 3 | Login | `login.html` |
| 4 | Register | `register.html` |
| 5 | Student Home | `student-home.html` |
| 6 | Report Complaint | `report-complaint.html` |
| 7 | My Complaints | `my-complaints.html` |
| 8 | Complaint Details | `complaint-details.html` |
| 9 | Profile | `profile.html` |
| 10 | Admin Login | `admin-login.html` |
| 11 | Admin Dashboard | `admin-dashboard.html` |
| 12 | All Complaints | `all-complaints.html` |
| 13 | Complaint Management | `complaint-management.html` |

---

## 5. API Reference

All protected routes require `Authorization: Bearer <token>` header (token returned from login/register).

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Student sign-up |
| POST | `/api/auth/login` | Student/admin login |
| POST | `/api/auth/admin-login` | Admin-only login (used by Admin Login screen) |
| GET | `/api/auth/profile` | Get logged-in user's profile |
| PUT | `/api/auth/profile` | Update profile |

### Complaints (student)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/complaints` | Submit a complaint (multipart form: `category`, `description`, `location`, `photo`) |
| GET | `/api/complaints/my` | List the logged-in student's complaints |
| GET | `/api/complaints/:id` | Get one complaint's details |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard totals + 5 most recent complaints |
| GET | `/api/admin/complaints` | All complaints (optional `?status=` and `?category=` filters) |
| PUT | `/api/admin/complaints/:id` | Update `status` and/or `assignedStaff` |

---

## 6. Project Structure

```
fixmycampus/
├── backend/
│   ├── config/db.js              # MySQL connection pool
│   ├── controllers/               # Route handler logic
│   ├── middleware/
│   │   ├── auth.js                # JWT verification + admin guard
│   │   └── upload.js              # Multer photo upload config
│   ├── routes/                    # Express routers
│   ├── uploads/                   # Uploaded complaint photos (served at /uploads)
│   ├── server.js                  # App entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── css/style.css              # Shared design system (blue theme)
│   ├── js/api.js                  # Fetch wrapper + auth/session helpers
│   └── *.html                     # 13 screens
├── database/
│   └── schema.sql                 # Tables + seed admin account
└── README.md
```

---

## 7. Installing as an App (PWA)

FixMyCampus is a Progressive Web App — it can be installed to a phone's home screen and opens like a native app (no browser address bar), with an offline app shell for the core screens.

- **Android (Chrome):** open `http://<your-server-ip>:5000` in Chrome → tap the "Install App" button on the Welcome screen, or use Chrome's menu → **Add to Home Screen**.
- **iPhone/iPad (Safari):** open the site in Safari → tap the Share icon → **Add to Home Screen**.
- **Desktop (Chrome/Edge):** click the install icon (⊕) in the address bar.

Notes:
- To install on a real phone, the server needs to be reachable from that phone (same Wi-Fi network, or deployed to a host with a public URL). `localhost` only works on the same machine.
- Installing over plain HTTP works for local testing; for a production deployment, serve over **HTTPS** (required by most browsers for full PWA install support).
- The app shell (HTML/CSS/JS/icons) is cached for offline loading via `frontend/service-worker.js`; live data (login, complaints, photos) always requires a network connection since it comes from the API.
- PWA files added: `frontend/manifest.json`, `frontend/service-worker.js`, `frontend/icons/`.

---

## 8. Notes & Next Steps

- Categories currently offered when reporting a complaint: Electrical, Plumbing, Furniture, Sanitation, Internet/Network, Other.
- Complaint statuses: `Pending → In Progress → Completed`, managed from the admin's Complaint Management screen.
- Staff assignment is a simple dropdown of role names (Electrician, Plumber, Carpenter, Cleaning Staff, IT Support, General Maintenance) — swap this for a real `staff` table if you want to manage actual staff accounts.
- Passwords are hashed with bcrypt; sessions use JWT (7-day expiry).
- For production: set a strong `JWT_SECRET`, enable HTTPS, and consider rate-limiting the auth endpoints.
