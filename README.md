# Estovia

A real-estate platform for the Delhi NCR market where **landowners, builders,
buyers, suppliers and admins each get their own workspace**, and buyers and
landowners can check what a property is realistically worth before committing
to a price.

Built with Next.js (App Router), MongoDB and Tailwind CSS. Includes a trained
machine-learning valuation engine that runs entirely in JavaScript inside the
app — see [`ml-service/README.md`](ml-service/README.md) for the full ML
documentation.

---

## Table of contents

- [What the app does](#what-the-app-does)
- [Tech stack](#tech-stack)
- [Running it locally](#running-it-locally)
- [Environment variables](#environment-variables)
- [Testing the valuation feature](#testing-the-valuation-feature)
- [Project structure](#project-structure)
- [Available scripts](#available-scripts)
- [The ML valuation engine](#the-ml-valuation-engine)
- [Deployment](#deployment)

---

## What the app does

Estovia is a multi-role marketplace. Every role has a separate dashboard, and
each one has its own tools:

| Role | What they get |
| --- | --- |
| **Landowner** | List land, upload documents, manage enquiries, and check what a home in their area is likely to list for. |
| **Builder** | Create projects and units, publish availability, review buyer applications, and price units against the market. |
| **Buyer** | Browse and shortlist properties and land, apply to projects, and check a property's estimated value. |
| **Supplier** | Publish products and services, respond to material requirements, and manage quotations. |
| **Admin** | Review registrations and verifications, monitor reports, and run the valuation engine to audit its behaviour. |

Cross-cutting features:

- **Role-based authentication.** Sessions are signed cookies (`AUTH_SECRET`),
  and every API route checks the caller's roles before doing anything.
- **Property and land listings** with Cloudinary image/document uploads.
- **Saved properties and land**, plus buyer applications and supplier
  quotations.
- **Messaging and notifications** between interested parties.
- **RERA verification.** Optional. If `RERA_API_URL` is unset, RERA status stays
  `pending` / `manual_review` and is **never** reported as auto-verified.
- **Property valuation** — a trained ML model that estimates the advertised
  asking price of built-up homes in Delhi NCR, always shown with its own
  measured error.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.3.2 (App Router, React Server Components) |
| UI | React 19.2.8, Tailwind CSS v4, lucide-react icons |
| Language | JavaScript / JSX (no TypeScript) |
| Database | MongoDB with Mongoose 9 |
| Auth | Custom signed-cookie sessions (bcrypt for passwords) |
| Maps | Leaflet + react-leaflet, OpenStreetMap tiles |
| Uploads | Cloudinary |
| ML runtime | Pure JavaScript XGBoost tree evaluator, no Python in production |

## Running it locally

**Prerequisites:** Node.js 18+ and a MongoDB database (a free MongoDB Atlas
cluster is fine).

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env.local
# then edit .env.local and fill in MONGODB_URI and AUTH_SECRET

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To create the first admin user:

```bash
npm run seed:admin          # uses ADMIN_EMAIL / ADMIN_PASSWORD from .env.local
npm run seed:admin:reset    # same, but resets the password if the user exists
```

The seed is idempotent and non-destructive — it will not overwrite other users.

## Environment variables

`.env.example` documents every variable. The ones that matter most:

| Variable | Required | What it does |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string. |
| `MONGODB_DB` | no | Database name. Defaults to `realestate`. |
| `AUTH_SECRET` | yes | Long random string used to sign session cookies. |
| `CLOUDINARY_*` | for uploads | Cloudinary account name, API key and secret. |
| `VALUATION_ENGINE_VERSION` | no | Version stamped on every saved valuation. |
| `VALUATION_RATE_LIMIT_PER_HOUR` | no | Max saved valuations per user per hour. Default `30`; `0` disables. |
| `VALUATION_STORE_PREDICTIONS` | no | Set `false` to disable valuation history storage. |
| `ML_MODEL_DIR` | no | Leave **unset**. The resolver finds `src/lib/valuation/artifacts` automatically under both `next dev` and a production build. |

> `.env.local` is gitignored. `.env.example` is committed and safe to share.

## Testing the valuation feature

The valuation APIs require a session, so **log in first**. Any role works
(landowner, builder, buyer, admin, viewer).

| Log in as | Click | Direct URL |
| --- | --- | --- |
| Landowner | **Valuation** in the sidebar | `/landowner/valuation` |
| Builder | **Unit Valuation** | `/builder/valuation` |
| Buyer | **Property Valuation** | `/buyer/valuation` |
| Admin | **Valuation engine** (Model section) | `/admin/valuation` |

There is also a standalone `/valuation` page, which needs the same login.

A quick end-to-end check:

1. City `Gurugram`, locality `sohna road`, type `Apartment`, area `1250` sq ft,
   3 bedrooms, 2 bathrooms → **Value this property**.
2. You should get an estimated asking price, a price per sq ft, a
   **wide** range, and a count of the real listings used.
3. Enter your own asking price to see it compared against the estimate.
4. Switch the area unit to `sq m` and re-run to confirm conversion.
5. Change the property type to **Residential Land** → you get an explicit
   "not supported yet" refusal rather than a made-up number.
6. Re-run the same property → it appears in "Your recent valuations".

## Project structure

```
src/
  app/                 Pages and API routes (App Router)
    api/               Backend route handlers
    admin|builder|buyer|landowner|supplier|   Role dashboards
    valuation/         Standalone valuation page
  components/          Shared UI (ui/ primitives, role shells, valuation/)
  lib/
    models/            Mongoose schemas
    valuation/         The ML engine (JavaScript)
      artifacts/       Trained model files the app reads
  scripts/             Node maintenance scripts
ml-service/            Offline Python training pipeline (not used in production)
  estovia_ml/          Ingest, features, train, evaluate, export
  scripts/             Export + verification scripts
  tests/               Test directory
```

## Available scripts

```bash
npm run dev              # start the dev server
npm run build            # production build
npm start                # serve the production build
npm run lint             # ESLint
npm run seed:admin       # create/refresh the admin user

# ML engine smoke test — runs the JavaScript engine in plain Node,
# no server or database needed:
node scripts/valuation_smoke.mjs
```

## The ML valuation engine

Estovia can estimate the **advertised asking price** of a built-up home in
Delhi NCR (Noida, Greater Noida, Gurugram, Ghaziabad, New Delhi, Faridabad).

What is true about it, stated plainly:

- It predicts **asking price, not sale price**. No registered-transaction
  dataset was obtainable, so the engine does not estimate sale prices and does
  not claim to.
- It covers **built-up homes only** — apartments, independent houses and villas.
  Land and commercial property return an explicit "not supported" status
  instead of a number.
- On 1,418 listings from two cities it had **never seen during training**
  (Faridabad and Greater Noida), its typical error is about **42.7%**, and it
  beats a simple "multiply area by the locality's average price per sq ft"
  baseline (73.2% typical error).
- Because the real error is that wide, the estimate is **always shown with a
  wide range**, and the model's measured accuracy is available in a collapsible
  "How accurate is the model?" section on the same page.

Every published number is **verified by replaying the exported model** through
the app's own JavaScript evaluator, rather than trusting the numbers the
training run wrote down.

Full documentation — data sources, the 46 features, how the model works, how
to verify it, and its limitations — is in
**[`ml-service/README.md`](ml-service/README.md)**.
Data provenance and licensing is in
**[`ml-service/DATA_SOURCES.md`](ml-service/DATA_SOURCES.md)**.

### API endpoints

All require an authenticated session.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/valuation/predict` | `POST` | Run a valuation. Returns the estimate, the calibrated range, comparable listings, an explanation, and a coverage grade. |
| `/api/valuation/model` | `GET` | Which model is live, its verified metrics, and which segments have no model. |
| `/api/valuation/history` | `GET` | The caller's own saved valuations. Admin can request everyone's. |
| `/api/valuation/localities` | `GET` | Locality autocomplete for a city, from real listing data. |

## Deployment

The app is a standard Next.js deployment and works on Vercel or any Node host.

The one non-obvious part is the model: `next.config.mjs` lists the runtime
artifacts in `outputFileTracingIncludes` so the model files are packaged with
the server bundle automatically. You do not need to copy them by hand, and you
do not need Python on the server.

Set the same environment variables in your host's dashboard as in
`.env.local`, and make sure `ML_MODEL_DIR` is **not** set to
`ml-service/artifacts` — that folder is the training archive and is not what the
app reads.
