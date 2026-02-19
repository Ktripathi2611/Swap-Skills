# 🔄 Skill Swap — Peer-to-Peer Learning Platform

> Connect, learn, and grow together. Exchange skills with passionate learners worldwide.

Skill Swap is a full-stack web application where users can trade skills with each other (e.g., teach Python and learn Spanish), book paid learning sessions with mentors, chat in real time, and review their experience.

---

## 📋 Table of Contents

1. [Features](#-features)
2. [Tech Stack](#-tech-stack)
3. [Folder Structure](#-folder-structure)
4. [Directory Reference](#-directory-reference)
   - [Root Files](#root-files)
   - [config/](#config)
   - [db/](#db)
   - [middleware/](#middleware)
   - [routes/](#routes)
   - [socket/](#socket)
   - [public/](#public)
   - [public/js/](#publicjs)
   - [public/css/](#publiccss)
   - [tests/](#tests)
5. [Installation & Setup (Beginners)](#-installation--setup-beginners)
6. [Environment Variables](#-environment-variables)
7. [Running the Project](#-running-the-project)
8. [API Overview](#-api-overview)
9. [Feature Flags](#-feature-flags)
10. [Contributing & Best Practices](#-contributing--best-practices)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔄 Skill Swap | Send and accept skill-exchange requests with other users |
| 💬 Real-time Chat | WebSocket-powered messaging for every swap or paid session |
| 💰 Paid Sessions | Book and pay for one-on-one mentoring sessions |
| ⭐ Reviews & Ratings | Leave reviews after completed sessions, feature testimonials |
| 📊 Reputation Score | Dynamic mentor reputation algorithm based on ratings, sessions, and response rate |
| 📅 Session Scheduling | Schedule sessions with meeting links and notes |
| 🎯 Recommendations | Smart skill-matching and top-instructor recommendations |
| 🌙 Dark/Light Mode | Theme toggle — persists across pages |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Server** | Node.js + Express.js |
| **Database** | MySQL 8 (via `mysql2`) |
| **Real-time** | Socket.IO |
| **Auth** | Session-based (`express-session` + `bcrypt`) |
| **Frontend** | Vanilla HTML, CSS, JavaScript (no framework) |
| **Payments** | Custom payment flow (extensible to Razorpay/Stripe) |

---

## 📁 Folder Structure

```
p1/
├── .env                    # Environment variables (NOT committed to git)
├── .gitignore              # Files to ignore in version control
├── package.json            # Project metadata & npm scripts
├── server.js               # Main Express server entry point
│
├── config/
│   └── features.js         # Feature flag toggles
│
├── db/
│   ├── connection.js       # MySQL connection pool + auto-create tables
│   └── seed.js             # (Optional) seed data for development
│
├── middleware/
│   └── auth.js             # isAuthenticated middleware
│
├── routes/
│   ├── auth.js             # Register, login, logout, /me
│   ├── users.js            # User profiles (get, update)
│   ├── skills.js           # Add, edit, delete skills
│   ├── requests.js         # Swap request CRUD + accept/reject/delete
│   ├── messages.js         # Chat messages (get, delete, clear, search)
│   ├── sessions.js         # Session scheduling + complete/cancel/delete
│   ├── payments.js         # Payment creation + webhook
│   ├── recommendations.js  # Skill-match & top instructor recommendations
│   ├── reviews.js          # Submit, get, delete, moderate reviews
│   ├── testimonials.js     # Feature/unfeature testimonials
│   └── reputation.js       # Reputation score breakdown + leaderboard
│
├── socket/
│   └── chat.js             # Socket.IO event handlers for real-time chat
│
├── tests/
│   └── api.test.js         # Node.js built-in test runner
│
└── public/                 # All frontend files (served statically)
    ├── index.html          # Landing page
    ├── login.html          # Login page
    ├── register.html       # Registration page
    ├── dashboard.html      # User dashboard
    ├── skills.html         # Browse & manage skills
    ├── requests.html       # Swap request management
    ├── chat.html           # Real-time chat interface
    ├── sessions.html       # Session list & scheduling
    ├── payment.html        # Payment flow
    ├── earnings.html       # Mentor earnings dashboard
    ├── profile.html        # User profile editor
    ├── mentor-profile.html # Public mentor profile with reviews
    ├── css/
    │   └── styles.css      # Global stylesheet (design system)
    └── js/
        ├── api.js          # Fetch wrapper (`api.get`, `api.post`, etc.)
        ├── navbar.js       # Dynamic navbar + auth state
        ├── theme.js        # Dark/light mode toggle
        └── utils.js        # Shared helpers (toast, initials, formatDate)
```

---

## 📖 Directory Reference

### Root Files

| File | Purpose |
|------|---------|
| `server.js` | Bootstraps Express, mounts all routes, initializes Socket.IO, serves `public/` statically |
| `package.json` | Lists dependencies, defines `start`, `dev`, and `test` npm scripts |
| `.env` | Secret config (DB credentials, session secret, port) — **never commit this** |
| `.gitignore` | Excludes `node_modules/` and `.env` from git |

---

### `config/`

| File | Purpose |
|------|---------|
| `features.js` | Central on/off switches for optional platform modules |

**Exports:** `isFeatureEnabled(name)`, `requireFeature(name)` middleware, and the `features` object.

> To disable a feature (e.g., paid learning), set `PAID_LEARNING: false`.
> All dependent routes will respond with `404` automatically.

---

### `db/`

| File | Purpose |
|------|---------|
| `connection.js` | Creates a MySQL connection pool; auto-creates all tables and runs safe ALTER migrations on startup |
| `seed.js` | Inserts demo users and skills for local development |

**Tables created automatically:**
`users`, `skills`, `swap_requests`, `messages`, `sessions`, `payments`, `reviews`, `testimonials`

> You never need to run SQL manually — just start the server and all tables appear.

---

### `middleware/`

| File | Purpose |
|------|---------|
| `auth.js` | Exports `isAuthenticated` — rejects unauthenticated API calls with `401` |

**Dependency:** Used by every protected route (`POST /api/reviews`, `DELETE /api/requests/:id`, etc.)

---

### `routes/`

Each file maps to an API prefix mounted in `server.js`:

| File | Mount Point | Key Endpoints |
|------|------------|---------------|
| `auth.js` | `/api/auth` | `POST /register`, `POST /login`, `POST /logout`, `GET /me` |
| `users.js` | `/api/users` | `GET /:id` (with rating + score), `PUT /:id` |
| `skills.js` | `/api/skills` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `requests.js` | `/api/requests` | `POST /`, `GET /`, `PUT /:id/accept`, `PUT /:id/reject`, `DELETE /:id` |
| `messages.js` | `/api/messages` | `GET /:requestId`, `GET /paid/:paymentId`, `DELETE /:id/message/:msgId`, `DELETE /:id/clear`, `GET /:id/search` |
| `sessions.js` | `/api/sessions` | `POST /`, `GET /`, `PUT /:id/complete`, `PUT /:id/cancel`, `DELETE /paid/:paymentId` |
| `payments.js` | `/api/payments` | `POST /`, `GET /`, `PUT /:id/confirm` |
| `recommendations.js` | `/api/recommendations` | `GET /` (matched users, trending, top instructors) |
| `reviews.js` | `/api/reviews` | `POST /`, `GET /mentor/:id`, `GET /session/:id`, `DELETE /:id`, `PUT /:id/moderate` |
| `testimonials.js` | `/api/testimonials` | `POST /`, `DELETE /:id`, `GET /mentor/:id`, `PUT /:id/priority` |
| `reputation.js` | `/api/reputation` | `GET /:userId`, `GET /leaderboard` |

---

### `socket/`

| File | Purpose |
|------|---------|
| `chat.js` | Handles `joinRoom`, `sendMessage`, `typing`, `stopTyping` Socket.IO events |

**Convention:** Swap chat rooms use `chat_<requestId>`. Paid chat rooms use `chat_-<paymentId>` (negative ID to avoid collisions).

---

### `public/`

All HTML pages served directly to the browser.

| File | Description |
|------|-------------|
| `index.html` | Landing page — hero, features, CTA |
| `login.html` | Login form |
| `register.html` | Registration form |
| `dashboard.html` | Personal dashboard — stats, recent activity |
| `skills.html` | Browse all skills, send swap requests, book paid sessions |
| `requests.html` | View, accept, reject incoming/outgoing swap requests |
| `chat.html` | Full-feature chat — sidebar, search, message delete, export |
| `sessions.html` | List all sessions, mark complete, leave reviews |
| `payment.html` | Payment checkout for a skill |
| `earnings.html` | Mentor earnings summary (feature-gated: `MENTOR_DASHBOARD`) |
| `profile.html` | Edit your own profile — name, bio, location, avatar |
| `mentor-profile.html` | Public mentor page — stars, testimonials, reviews, reputation |

---

### `public/js/`

Shared JavaScript utilities loaded by every page:

| File | Purpose |
|------|---------|
| `api.js` | Thin wrapper over `fetch` — `api.get()`, `api.post()`, `api.put()`, `api.delete()` with error handling |
| `navbar.js` | Renders navigation and updates auth state (logged in vs. out) |
| `theme.js` | Reads/writes `localStorage` for dark/light mode; applies class to `<body>` |
| `utils.js` | `showToast()`, `getInitials()`, `formatDateTime()`, `checkAuth()` |

**Dependency note:** Every page includes these scripts in this order:
```html
<script src="/js/api.js"></script>
<script src="/js/utils.js"></script>
<script src="/js/navbar.js"></script>
```

---

### `tests/`

| File | Purpose |
|------|---------|
| `api.test.js` | Integration tests using Node.js built-in `node:test` runner |

Run with: `npm test`

---

## 🚀 Installation & Setup (Beginners)

Follow these steps carefully. No prior experience needed!

### Step 1 — Install Prerequisites

You need three tools installed on your computer:

#### 1a. Install Node.js
- Go to [https://nodejs.org](https://nodejs.org)
- Download the **LTS** version (the green button)
- Run the installer — click Next on everything
- Verify it installed: open a terminal and type:
  ```bash
  node --version
  # Should print something like: v20.11.0
  ```

#### 1b. Install MySQL
- Go to [https://dev.mysql.com/downloads/installer/](https://dev.mysql.com/downloads/installer/)
- Download **MySQL Installer for Windows**
- During setup, choose **Developer Default**
- Set a **root password** — remember it, you'll need it!
- Verify: open MySQL Workbench or run `mysql -u root -p`

#### 1c. Install Git (optional but recommended)
- Go to [https://git-scm.com](https://git-scm.com) and install

---

### Step 2 — Get the Project

Either clone with Git:
```bash
git clone <your-repo-url>
cd p1
```

Or download the ZIP and extract it, then open a terminal in the `p1` folder.

---

### Step 3 — Install Dependencies

In your terminal inside the `p1` folder, run:
```bash
npm install
```

This downloads all the packages listed in `package.json` into a `node_modules/` folder. It may take a minute.

---

### Step 4 — Create the `.env` File

The `.env` file holds your secret configuration. Create one by copying the template below:

**Create a new file** named `.env` in the `p1` folder (same level as `server.js`) and paste:

```env
# Database — change these to match your MySQL setup
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_root_password_here
DB_NAME=skillswap

# Session secret — change this to any long random string
SESSION_SECRET=change_this_to_something_long_and_random_123

# Server port
PORT=3000
```

> ⚠️ Replace `your_mysql_root_password_here` with the password you set when installing MySQL.

---

### Step 5 — Start MySQL

Make sure your MySQL server is running:
- **Windows**: Open "Services" and start **MySQL80** (or equivalent)
- Or open MySQL Workbench — if it connects, MySQL is running

You do **not** need to create any database or tables manually — the app creates everything for you on first run.

---

### Step 6 — Start the Application

```bash
npm start
```

You should see:
```
✅ Database "skillswap" ready
✅ All tables ready
✨ Skill Swap server running on http://localhost:3000
```

Open your browser and go to: **http://localhost:3000**

---

### Step 7 — Register Your First Account

1. Click **Register** in the top navigation
2. Fill in your name, email, username, and password
3. Click Register — you'll be redirected to the dashboard
4. Go to **Skills** and add some skills you can teach and want to learn

---

## 🔑 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | MySQL server hostname | `localhost` |
| `DB_PORT` | MySQL port (default 3306) | `3306` |
| `DB_USER` | MySQL username | `root` |
| `DB_PASSWORD` | MySQL password | `mypassword` |
| `DB_NAME` | Database name (auto-created) | `skillswap` |
| `SESSION_SECRET` | Secret key for session encryption | `any_long_random_string` |
| `PORT` | Port the web server runs on | `3000` |

---

## ▶️ Running the Project

| Command | What it does |
|---------|-------------|
| `npm start` | Start the server (production mode) |
| `npm run dev` | Start with auto-restart on file changes (development) |
| `npm test` | Run the API test suite |

---

## 🌐 API Overview

All API routes are prefixed with `/api/`. The server returns JSON for all endpoints.

**Authentication:** Login creates a session cookie. Protected endpoints return `401` if not logged in.

**Example — Register a user:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"secret123","full_name":"Alice Smith"}'
```

**Example — Browse skills:**
```bash
curl http://localhost:3000/api/skills
```

See the [Directory Reference → routes/](#routes) section above for a full list of endpoints.

---

## 🚩 Feature Flags

Feature flags in `config/features.js` let you turn optional modules on or off without touching route code:

```javascript
const features = {
    PAID_LEARNING: true,      // Payment + paid sessions
    VIDEO_MEETINGS: true,     // Meeting link on sessions
    MENTOR_DASHBOARD: true,   // Earnings page for mentors
    REVIEWS_RATINGS: true,    // Reviews, testimonials, reputation
    ADVANCED_ANALYTICS: false // (future)
};
```

When set to `false`, all related API routes return `404` and the frontend hides those UI elements automatically.

---

## 🤝 Contributing & Best Practices

### Adding a New Feature

1. **Create the route file** in `routes/yourfeature.js`
2. **Mount it** in `server.js`:
   ```javascript
   app.use('/api/yourfeature', require('./routes/yourfeature'));
   ```
3. **Add a feature flag** in `config/features.js` if it's optional
4. **Add any new tables** in the `tables` array in `db/connection.js`
5. **Add migrations** in the `migrations` array for any `ALTER TABLE` changes

### Code Style

- Use `async/await` for all database calls — no raw callbacks
- Always wrap route handlers in `try/catch` and return `res.status(500).json({ error: 'Server error' })`
- Validate inputs at the top of each route before touching the database
- Use `isAuthenticated` middleware for any endpoint that requires login

### Security Checklist

- [ ] Never expose `DB_PASSWORD` or `SESSION_SECRET` in code — always use `.env`
- [ ] Always validate that the logged-in user owns the resource before modifying it
- [ ] Sanitize user-generated text (strip HTML) before storing in the database
- [ ] Use `bcrypt` for all passwords — never store plain text

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Route files | `kebab-case.js` | `swap-requests.js` |
| HTML pages | `kebab-case.html` | `mentor-profile.html` |
| CSS classes | `kebab-case` | `.mentor-profile-header` |
| JS functions | `camelCase` | `loadConversations()` |

### Git Workflow

```bash
# Always create a feature branch
git checkout -b feature/your-feature-name

# After making changes
git add .
git commit -m "feat: add testimonial reordering"

# Push and open a Pull Request
git push origin feature/your-feature-name
```

---

## 📄 License

ISC — see `package.json` for details.

---

> Built with ❤️ for learners everywhere.
