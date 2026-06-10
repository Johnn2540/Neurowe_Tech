# NeurowexTech — Refactor Migration Guide

## What changed

The monolithic `server.js` (~1,100 lines) has been split into 28 focused files
across a clean MVC-style architecture. **Zero logic has been removed or altered —
every route, query, and behaviour is preserved exactly.**

---

## File map (old → new)

| What                       | Old location  | New location                              |
|----------------------------|---------------|-------------------------------------------|
| App bootstrap              | `server.js`   | `app.js` + `server.js` (entry only)       |
| DB pool + migrations       | `server.js`   | `config/database.js`                      |
| Session config             | `server.js`   | `config/session.js`                       |
| HBS helpers + setup        | `server.js`   | `config/handlebars.js`                    |
| App constants (roles etc.) | *(implicit)*  | `config/constants.js`                     |
| `isAuthenticated` guard    | `server.js`   | `middleware/auth.js`                      |
| `isAdmin` guard            | `server.js`   | `middleware/auth.js`                      |
| `isInstructor` guard       | `server.js`   | `middleware/auth.js`                      |
| Error handlers             | `server.js`   | `middleware/errorHandler.js`              |
| `res.locals` injection     | `server.js`   | `middleware/templateLocals.js`            |
| Login / register / Google  | `server.js`   | `controllers/auth.controller.js`          |
| User/admin/instructor dash | `server.js`   | `controllers/dashboard.controller.js`     |
| `assertCourseAccess()`     | `server.js`   | `services/course.service.js`              |
| Auth routes                | `server.js`   | `routes/auth.routes.js`                   |
| Dashboard routes           | `server.js`   | `routes/dashboard.routes.js`              |
| `/api/user/*`              | `server.js`   | `routes/api/user.api.js`                  |
| `/api/admin/*`             | `server.js`   | `routes/api/admin.api.js`                 |
| `/api/contacts/*`          | `server.js`   | `routes/api/contacts.api.js`              |
| `/api/learn/*`, `/api/enroll*` | `server.js` | `routes/api/courses.api.js`             |
| `/api/instructor/*`        | `server.js`   | `routes/api/instructor.api.js`            |
| `/api/upload/*`            | `server.js`   | `routes/api/upload.api.js`                |
| Public API (`/api/projects/public` etc.) | `server.js` | `routes/api/public.api.js`   |
| `/`, `/contact`, `/about` etc. | `server.js` | `routes/web/home.routes.js`             |
| `/blog`, `/blog/:slug`     | `server.js`   | `routes/web/blog.routes.js`               |
| `/portfolio`, `/portfolio/:id` | `server.js` | `routes/web/portfolio.routes.js`        |
| `/learn`, `/learn/course/:id` | `server.js` | `routes/web/learn.routes.js`             |

---

## How to migrate your project

### Step 1 — Copy files into your repo

Copy everything from this refactored folder into your `neurowex-postgres/` root.

### Step 2 — Keep your existing files

These files are **unchanged** — just leave them where they are:

```
config/cloudinary.js     ← already exists, upload.api.js imports it
db/postgres.js           ← already exists, replace the stub with yours
views/                   ← all .hbs templates unchanged
public/                  ← all static files unchanged
.env                     ← unchanged
package.json             ← add any missing deps (see Step 3)
```

### Step 3 — Verify package.json dependencies

All packages used were already in your original `server.js`. Confirm these are
present in `package.json`:

```json
{
  "dependencies": {
    "express": "^4.x",
    "hbs": "^4.x",
    "express-session": "^1.x",
    "connect-pg-simple": "^9.x",
    "bcrypt": "^5.x",
    "pg": "^8.x",
    "google-auth-library": "^9.x",
    "multer": "^1.x",
    "cloudinary": "^2.x",
    "dotenv": "^16.x"
  }
}
```

### Step 4 — Verify `db/postgres.js` export shape

The refactored code uses:

```js
const db = require('../db/postgres');
await db.query('SELECT ...', [params]);
```

If your existing `db/postgres.js` exports `{ query }`, you're done.
If it exports the pool directly, either wrap it or update the imports.

### Step 5 — Test

```bash
node server.js
# or
npm start
```

All routes are identical to the original. No URL changes, no behaviour changes.

---

## Architecture overview

```
server.js           — entry point only (start HTTP server, export app)
app.js              — Express app: middleware stack + route mounting
│
├── config/
│   ├── database.js     — Pool + startup migrations
│   ├── session.js      — connect-pg-simple session store
│   ├── handlebars.js   — HBS setup + all 20+ helpers
│   └── constants.js    — ROLES, PAGINATION, TIMEOUTS, etc.
│
├── middleware/
│   ├── auth.js             — isAuthenticated / isAdmin / isInstructor
│   ├── errorHandler.js     — API + web error handlers, 404s
│   ├── templateLocals.js   — res.locals injected into every render
│   └── validation.js       — reusable validate() factory
│
├── controllers/
│   ├── auth.controller.js       — register, login, Google, logout, pw reset
│   └── dashboard.controller.js  — user / admin / instructor dashboards
│
├── services/
│   └── course.service.js   — assertCourseAccess() shared helper
│
├── routes/
│   ├── index.js            — central registry, all routers mounted here
│   ├── auth.routes.js      — /login, /signup, /logout, /api/auth/*
│   ├── dashboard.routes.js — /user_dashboard, /admin_dashboard, /instructor/*
│   │
│   ├── api/
│   │   ├── user.api.js       — /api/user/*
│   │   ├── admin.api.js      — /api/admin/* (users, instructors, content CRUD)
│   │   ├── contacts.api.js   — /api/contacts/* (paginated, CSV export, bulk delete)
│   │   ├── courses.api.js    — /api/learn/*, /api/enroll*, /api/courses/search
│   │   ├── instructor.api.js — /api/instructor/* (module/lesson CRUD)
│   │   ├── upload.api.js     — /api/upload/* (Cloudinary)
│   │   └── public.api.js     — /api/projects/public, /api/subscribe
│   │
│   └── web/
│       ├── home.routes.js      — /, /contact, /about, /services, /subscribe
│       ├── blog.routes.js      — /blog, /blog/:slug
│       ├── portfolio.routes.js — /portfolio, /portfolio/:id
│       └── learn.routes.js     — /learn, /learn/course/:id, /my-learning
│
└── db/
    └── postgres.js     — your existing DB module (stub only, keep yours)
```
