# NeurowexTech

> Full-stack web application for a Kenyan tech agency — custom web & mobile app development, a learning platform (NeurowexTech Academy), portfolio, blog, full admin panel, and Progressive Web App (PWA) support.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Templating | Handlebars (HBS) |
| Database | PostgreSQL (Neon serverless) |
| Auth | Session-based + Google OAuth2 |
| File uploads | Cloudinary |
| Deployment | Vercel (serverless) |
| PWA | Web App Manifest + Service Worker |

---

## Project Structure

```
neurowex-postgres/
│
├── server.js                   # Entry point — starts HTTP server, exports app
├── app.js                      # Express app — middleware stack + route mounting
├── .env                        # Environment variables (never commit this)
├── package.json
│
├── config/
│   ├── database.js             # PostgreSQL pool + startup migrations
│   ├── session.js              # express-session with pg store
│   ├── handlebars.js           # HBS engine setup + all template helpers
│   ├── constants.js            # ROLES, PAGINATION, TIMEOUTS, etc.
│   └── cloudinary.js           # Cloudinary SDK config + upload helpers
│
├── middleware/
│   ├── auth.js                 # isAuthenticated, isAdmin, isInstructor guards
│   ├── errorHandler.js         # API + web error handlers, 404s
│   ├── templateLocals.js       # Global res.locals injected into every render
│   └── validation.js           # Reusable validate() middleware factory
│
├── controllers/
│   ├── auth.controller.js      # register, login, Google OAuth, logout, password reset
│   └── dashboard.controller.js # User / admin / instructor dashboard handlers
│
├── services/
│   └── course.service.js       # assertCourseAccess() — shared ownership check
│
├── routes/
│   ├── index.js                # Central registry — all routers mounted here
│   ├── auth.routes.js          # /login, /signup, /logout, /api/auth/*
│   ├── dashboard.routes.js     # /user_dashboard, /admin_dashboard, /instructor/*
│   │
│   ├── api/
│   │   ├── user.api.js         # /api/user/*
│   │   ├── admin.api.js        # /api/admin/* (users, instructors, content CRUD)
│   │   ├── contacts.api.js     # /api/contacts/* (paginated, CSV export, bulk delete)
│   │   ├── courses.api.js      # /api/learn/*, /api/enroll*, /api/courses/search
│   │   ├── instructor.api.js   # /api/instructor/* (module/lesson CRUD)
│   │   ├── upload.api.js       # /api/upload/* (Cloudinary image uploads)
│   │   └── public.api.js       # /api/projects/public, /api/subscribe
│   │
│   └── web/
│       ├── home.routes.js      # /, /contact, /about, /services, static pages
│       ├── blog.routes.js      # /blog, /blog/:slug
│       ├── portfolio.routes.js # /portfolio, /portfolio/:id
│       └── learn.routes.js     # /learn, /learn/course/:id, /my-learning
│
├── db/
│   └── postgres.js             # DB query wrapper (exports { query, pool })
│
├── views/                      # Handlebars templates (all standalone HTML — layout: false)
│   ├── layouts/
│   │   └── main.hbs            # Shared layout (used by opt-in pages only)
│   ├── partials/               # header, footer, widget, project-card
│   ├── home.hbs                # Homepage (includes PWA SW registration + install popup)
│   └── ...                     # ~40 standalone page templates
│
└── public/                     # Static assets (served at /)
    ├── manifest.json           # PWA manifest
    ├── sw.js                   # Service worker
    ├── icons/
    │   ├── icon.svg            # App icon — any purpose
    │   └── icon-maskable.svg   # App icon — maskable (Android adaptive)
    ├── js/
    │   ├── widget.js           # AI chat widget
    │   └── pwa-install.js      # PWA install prompt logic
    └── robots.txt
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL database (Neon recommended)
- Cloudinary account
- Google Cloud project with OAuth2 credentials

### 1. Clone and install

```bash
git clone https://github.com/your-org/neurowex-postgres.git
cd neurowex-postgres
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Session
SESSION_SECRET=your_very_long_random_secret_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# App
NODE_ENV=development
PORT=3000
```

### 3. Run locally

```bash
node server.js
# or with auto-restart:
npm run dev   # requires nodemon
```

The app will be available at `http://localhost:3000`.

Database tables are created automatically on first run (idempotent migrations in `config/database.js`).

---

## Progressive Web App (PWA)

The site ships as an installable PWA. Users on Chrome (Android/desktop) and Safari (iOS) can add it to their home screen without going through an app store.

### Files

| File | Path | Description |
|---|---|---|
| Manifest | `public/manifest.json` | App name, icons, colors, display mode, shortcuts |
| Service worker | `public/sw.js` | Caching + offline support |
| Install script | `public/js/pwa-install.js` | `beforeinstallprompt` capture + popup logic |
| Icon (any) | `public/icons/icon.svg` | Navy gradient "N" logo — used at any size |
| Icon (maskable) | `public/icons/icon-maskable.svg` | Full-bleed version for Android adaptive icons |

### Manifest highlights

```json
{
  "name": "NeurowexTech",
  "display": "standalone",
  "start_url": "/?source=pwa",
  "theme_color": "#1c2b4a",
  "background_color": "#1c2b4a"
}
```

Shortcuts registered: `/contact`, `/services`, `/learn`.

### Service worker caching strategy

| Request type | Strategy |
|---|---|
| Navigation (HTML pages) | Network-first, fall back to cached page |
| Images | Cache-first, update cache in background |
| JS / CSS | Stale-while-revalidate |
| `/api/*` | Bypassed entirely (never cached) |

Pre-cached on install: `/`, `/manifest.json`, `/icons/icon.svg`, `/icons/icon-maskable.svg`, `/images/logo.png`, `/js/widget.js`, `/js/pwa-install.js`.

### Install popup

The popup captures `beforeinstallprompt` and shows conditionally:

- **Trigger condition 1** — user has visited the site ≥ 2 times → popup appears 1.8 s after the event fires.
- **Trigger condition 2** — fewer than 2 visits but ≥ 30 seconds have elapsed since first visit → popup appears when the timer expires.
- **Dismissal** — "Not Now" or ✕ sets a 30-day cooldown in `localStorage`. Popup will not reappear until the cooldown expires.
- **After install** — `appinstalled` event clears the visit counter and dismissal key.

`localStorage` keys used:

| Key | Purpose |
|---|---|
| `nwt_pwa_fv` | Timestamp of first visit |
| `nwt_pwa_views` | Visit counter |
| `nwt_pwa_dismissed` | Timestamp of last dismissal |

### PWA head injection

Because all views are standalone HTML files (`layout: false`), a small Express middleware in `app.js` injects the required `<link rel="manifest">` and `<meta name="theme-color">` tags into every HTML response automatically — no need to touch individual templates.

```js
// app.js — injected into every HTML response
app.use((req, res, next) => {
    const _send = res.send.bind(res);
    res.send = function (body) {
        if (typeof body === 'string' && body.includes('</head>') && !body.includes('rel="manifest"')) {
            body = body.replace('</head>', `    ${PWA_HEAD}\n</head>`);
        }
        return _send(body);
    };
    next();
});
```

### Testing PWA locally

`beforeinstallprompt` only fires on HTTPS. To test the install popup during local development:

1. Open Chrome DevTools → **Application** tab → **Manifest**
2. Click **"Add to homescreen"** to force the prompt regardless of HTTPS
3. Or use Chrome's `chrome://flags/#bypass-app-banner-engagement-checks` flag

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Full PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Secret for signing session cookies |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth2 client ID |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `NODE_ENV` | | `development` or `production` (default: `development`) |
| `PORT` | | HTTP port (default: `3000`) |
| `VERCEL` | | Set to `1` automatically by Vercel |

---

## User Roles

| Role | Access |
|---|---|
| `user` | User dashboard, course enrollment, project requests |
| `instructor` | Instructor dashboard, manage assigned courses, modules, lessons |
| `admin` | Full access — all of the above + admin panel, user management, content CRUD |

Roles are stored in the `users.role` column. Admins promote users via the admin panel.

---

## Key Routes

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/` | Homepage |
| GET | `/learn` | Course catalogue |
| GET | `/learn/course/:id` | Course detail page |
| GET | `/portfolio` | Portfolio |
| GET | `/blog` | Blog listing |
| GET | `/blog/:slug` | Blog post |
| GET | `/contact` | Contact page |
| POST | `/contact` | Submit contact form |
| POST | `/subscribe` | Newsletter subscribe |
| GET | `/sitemap.xml` | Auto-generated XML sitemap |
| GET | `/health` | Health check (JSON) |

### Auth

| Method | Path | Description |
|---|---|---|
| GET | `/login` | Login page |
| GET | `/sign_up` | Register page |
| POST | `/api/login` | Login (JSON) |
| POST | `/api/register` | Register (JSON) |
| POST | `/api/auth/google` | Google OAuth |
| GET | `/logout` | Destroy session |
| POST | `/api/forgot-password` | Request password reset |
| POST | `/api/reset-password` | Reset password with token |

### Authenticated

| Method | Path | Description |
|---|---|---|
| GET | `/user_dashboard` | User dashboard |
| GET | `/my-learning` | Enrolled courses |
| GET | `/learn/course/:id/dashboard` | Course learning view |
| POST | `/api/enroll` | Enroll in a course |
| POST | `/api/lesson/complete` | Mark lesson complete |

### Admin (`/admin_dashboard`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/make-admin` | Promote to admin |
| POST | `/api/admin/make-instructor` | Promote to instructor |
| GET | `/api/contacts` | List contacts (paginated) |
| GET | `/api/contacts/export/csv` | Export contacts as CSV |
| GET | `/api/learn/courses` | List all courses |
| POST | `/api/learn/courses` | Create course |
| PUT | `/api/learn/courses/:id` | Update course |
| DELETE | `/api/learn/courses/:id` | Delete course |

### Instructor

| Method | Path | Description |
|---|---|---|
| GET | `/instructor/dashboard` | Instructor hub |
| GET | `/instructor/course/:id` | Course editor |
| POST | `/api/instructor/module/create` | Add module |
| POST | `/api/instructor/lesson/create` | Add lesson |
| POST | `/api/instructor/module/reorder` | Reorder modules |
| POST | `/api/instructor/lesson/reorder` | Reorder lessons |

---

## Database Schema (key tables)

```sql
users               — id, username, email, password_hash, google_id, role, is_active, last_login
session             — sid, sess, expire  (managed by connect-pg-simple)
courses             — id, title, description, category, level, price, instructor_id, published
course_modules      — id, course_id, title, module_order
course_lessons      — id, module_id, title, video_url, duration, lesson_order, is_free, is_published
enrollments         — id, user_id, course_id, enrolled_at, progress, status
user_lesson_progress — user_id, lesson_id, completed, completed_at
projects            — id, name, description, category, featured, user_id
contacts            — id, name, email, phone, project_type, budget, message, status
subscribers         — id, email, subscribed_at
blog_posts          — id, title, slug, category, author, excerpt, published
testimonials        — id, client_name, client_role, company, rating, content
team                — id, name, role, bio, linkedin_url, github_url
faqs                — id, question, answer, display_order, active
pricing_plans       — id, name, tier, price, features, popular
services            — id, name, description, icon_class, price, visible
settings            — id (singleton), site_name, contact_email, whatsapp_number
instructor_course_assignments — instructor_id, course_id  (many-to-many)
password_resets     — email, token, expires_at
```

---

## Handlebars Helpers

All helpers are registered in `config/handlebars.js`.

| Helper | Usage | Output |
|---|---|---|
| `formatDate` | `{{formatDate date}}` | `June 7, 2025` |
| `shortDate` | `{{shortDate date}}` | `Jun 7, 2025` |
| `truncate` | `{{truncate text 100}}` | Truncates to 100 chars |
| `truncateWords` | `{{truncateWords text 20}}` | Truncates to 20 words |
| `eq` | `{{#if (eq a b)}}` | Strict equality |
| `ifCond` | `{{#ifCond val ">" 0}}` | Comparison operators |
| `math` | `{{math a "+" b}}` | Arithmetic |
| `starRating` | `{{starRating 4.5}}` | `★★★★½` |
| `json` | `{{json obj}}` | JSON stringified |
| `slice` | `{{slice str 0 1}}` | String slice |
| `lowercase` / `uppercase` | `{{lowercase str}}` | Case conversion |
| `join` | `{{join arr ", "}}` | Array join |
| `default` | `{{default val "N/A"}}` | Fallback value |
| `firstChar` | `{{firstChar name}}` | First character (for avatars) |
| `inc` / `dec` | `{{inc index}}` | Increment / decrement |

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in Vercel
3. Set all environment variables in the Vercel dashboard
4. Set the **Output Directory** to `.` and **Build Command** to blank (no build step)
5. Vercel detects `VERCEL=1` automatically — `app.listen()` is skipped and the app is exported as a serverless function

**`vercel.json`:**
```json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "server.js" }]
}
```

> The service worker requires HTTPS. Vercel provides HTTPS by default — PWA install will work on the deployed domain out of the box.

---

## Development Scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

---

## Security Notes

- All sessions are `httpOnly`, `sameSite: lax`, and `secure` in production
- Passwords are hashed with `bcrypt` (10 rounds)
- Google OAuth tokens are verified server-side via `google-auth-library`
- Security headers set on every response via `helmet` (`X-Frame-Options`, `Strict-Transport-Security`, etc.)
- API routes always return JSON — never HTML error pages
- Auth endpoints rate-limited to 20 requests per 15-minute window per IP
- Password reset tokens expire after 1 hour

---

## License

Private — NeurowexTech. All rights reserved.
