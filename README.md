# 🎓 EduNest — Student Management Portal

A full-stack **Student Management Web Application** with a modern, dark editorial design. Built with **Node.js + Express** (backend) and vanilla **HTML/CSS/JS** (frontend) — zero database setup required.

---

## ✨ Features

| Module | Capabilities |
|--------|-------------|
| 🔐 **Login** | Admin authentication (scrypt-hashed passwords, HMAC tokens, 8h sessions) |
| 📊 **Dashboard** | Live stats — students, today's attendance, fee dues, overdue count, action alerts |
| 👤 **Students** | Add, edit, delete, filter, search; guardian contact; **report card** (attendance %, avg score, fee due) |
| ✅ **Attendance** | Date picker, single or **bulk "Mark All Students"** marking (P/A/L toggles), rates |
| 📈 **Marks** | Record exam marks, **auto-calculated grades**, progress bars |
| 💰 **Fees** | Create fee records, **record payments** (partial/full), overdue tracking |
| ⚠ **Parent Alerts** | Absentee list + fee defaulters with **ready-made parent messages** — copy or open in WhatsApp |
| 📅 **Timetable** | Weekly schedule grid |
| 📢 **Notices** | Post and manage school announcements |
| 💬 **Chat** | Support chat with admin auto-reply |
| ⚙ **Settings** | Change password, **JSON backup/restore**, **CSV exports** |

---

## 🛡 What this solves (real-world problems)

1. **Data loss** — all data persists to `data/db.json` (atomic writes, survives restarts). Previously everything was in-memory and vanished on restart.
2. **Privacy** — the API requires login; student data is no longer open to anyone on the network.
3. **Chasing parents** — the Parent Alerts page generates ready-to-send WhatsApp/SMS messages for absences and pending fees, with one-tap copy and `wa.me` deep links.
4. **Spreadsheet workflows** — one-click CSV exports of students, attendance, marks, and fees.
5. **Disaster recovery** — full JSON backup download and restore from Settings.

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 16

### Install & Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

**Default login:** `admin` / `admin123` — **change it in Settings → Change Password after first login.**

Dev mode with auto-restart:

```bash
npm run dev   # requires nodemon (npm install -D nodemon)
```

---

## 📁 Project Structure

```
my-students-app/
├── backend/
│   ├── server.js       # Express API + SPA fallback
│   ├── store.js        # JSON file persistence (atomic writes, seeding)
│   └── auth.js         # scrypt password hashing + HMAC token auth
├── public/
│   ├── index.html      # Login screen + app shell
│   ├── css/style.css   # Full design system
│   └── js/app.js       # Frontend router + pages
├── data/
│   └── db.json         # Persisted data (created on first run)
├── package.json
└── README.md
```

---

## 🌐 API Endpoints

All endpoints except `POST /api/auth/login` require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Get session token |
| POST | `/api/auth/change-password` | Change admin password |
| GET | `/api/stats` | Dashboard statistics (real dates) |
| GET/POST | `/api/students` | List / create students (roll uniqueness enforced) |
| GET/PUT/DELETE | `/api/students/:id` | Read / update / delete |
| GET | `/api/students/:id/profile` | Report card: attendance %, avg marks, fees |
| GET/POST | `/api/attendance` | Records (filter with `?date=YYYY-MM-DD`) |
| POST | `/api/attendance/bulk` | Mark whole class for a date in one call |
| GET/POST | `/api/marks` | Records; grade auto-calculated |
| GET/POST | `/api/fees` | Fee records |
| POST | `/api/fees/:id/pay` | Record a payment (validates against dues) |
| GET | `/api/reports/absentees?date=` | Absent students + parent messages + wa.me links |
| GET | `/api/reports/fee-defaulters` | Dues list + reminder messages |
| GET | `/api/export/:entity.csv` | `students` \| `attendance` \| `marks` \| `fees` |
| GET | `/api/backup` | Download full JSON backup |
| POST | `/api/restore` | Restore from JSON backup |
| GET/POST/DELETE | `/api/notices` | Notice board |
| GET | `/api/timetable` | Weekly schedule |
| GET/POST | `/api/messages` | Chat |

---

## 🎨 Design

- **Aesthetic**: Deep navy + amber editorial geometric
- **Fonts**: Syne (display) + DM Sans (body)
- **Responsive**: Mobile-friendly with collapsible sidebar
- **Theme**: Dark mode only

---

## 🔧 Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `PORT` | `3000` | Server port |
| `APP_SECRET` | dev fallback | Set a strong random string in production — signs auth tokens |

---

## 🚢 Deployment

### Deploy on Render / Railway / Fly.io

1. Push to GitHub
2. Connect repo to Render/Railway
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Set env var `APP_SECRET` to a long random string
6. Port: `3000`

> Note: the JSON store suits a single-instance deployment with a persistent disk. For multi-instance, swap `backend/store.js` for PostgreSQL/MongoDB.

---

## 📄 License

MIT
