# Insighta Labs — Intelligence Query Engine

A queryable demographic intelligence API built with Node.js, Express, and MongoDB.

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/fasakinhenry/HNG-stage2-backend.git
cd HNG-stage2-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your MONGODB_URI
```

`.env`:

```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/insighta?retryWrites=true&w=majority
```

### 3. Seed the database

Place your `profiles.json` in the project root, then run:

```bash
npm run seed
```

Re-running is safe — duplicates are skipped automatically.

### 4. Run locally

```bash
npm run dev
```

## API Reference

### `GET /api/profiles`

Returns all profiles with filtering, sorting, and pagination.

**Filter parameters:**
| Param | Type | Example |
|---|---|---|
| `gender` | string | `male`, `female` |
| `age_group` | string | `child`, `teenager`, `adult`, `senior` |
| `country_id` | string | `NG`, `KE`, `TZ` |
| `min_age` | number | `25` |
| `max_age` | number | `40` |
| `min_gender_probability` | number | `0.8` |
| `min_country_probability` | number | `0.5` |

**Sort parameters:**
| Param | Values |
|---|---|
| `sort_by` | `age`, `created_at`, `gender_probability` |
| `order` | `asc`, `desc` |

**Pagination:**
| Param | Default | Max |
|---|---|---|
| `page` | `1` | — |
| `limit` | `10` | `50` |

**Example:**

```
GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10
```

**Response:**

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 148,
  "data": [...]
}
```

### `GET /api/profiles/search?q=<query>`

Natural language query endpoint. Converts plain English into filters.

**Example:**

```
GET /api/profiles/search?q=young males from nigeria
GET /api/profiles/search?q=female seniors above 60
GET /api/profiles/search?q=adult men from kenya&page=2&limit=20
```

Supports `page` and `limit` for pagination.

### `GET /api/profiles/:id`

Returns a single profile by UUID.

## Natural Language Parsing

### How it works

The `/api/profiles/search` endpoint uses a **rule-based parser** (no AI, no LLMs). It tokenizes the query string and matches keywords against defined rules using regular expressions and lookup tables. Matched keywords are translated into MongoDB filter conditions that are applied to the database query.

### Supported keywords

#### Gender

| Keyword                               | Maps to                        |
| ------------------------------------- | ------------------------------ |
| `male`, `males`, `men`, `man`         | `gender=male`                  |
| `female`, `females`, `women`, `woman` | `gender=female`                |
| `male and female`, `both genders`     | No gender filter (all genders) |

#### Age Groups (stored values)

| Keyword                                                | Maps to              |
| ------------------------------------------------------ | -------------------- |
| `child`, `children`, `kid`, `kids`                     | `age_group=child`    |
| `teenager`, `teenagers`, `teen`, `teens`, `adolescent` | `age_group=teenager` |
| `adult`, `adults`                                      | `age_group=adult`    |
| `senior`, `seniors`, `elderly`, `elder`                | `age_group=senior`   |

#### Age Descriptors (not stored values)

| Keyword | Maps to                    |
| ------- | -------------------------- |
| `young` | `min_age=16`, `max_age=24` |

#### Age Comparisons

| Keyword pattern                                     | Maps to                  |
| --------------------------------------------------- | ------------------------ |
| `above X`, `over X`, `older than X`, `at least X`   | `min_age=X`              |
| `below X`, `under X`, `younger than X`, `at most X` | `max_age=X`              |
| `between X and Y`                                   | `min_age=X`, `max_age=Y` |

#### Country

Countries are resolved from names to ISO codes.
| Keyword pattern | Maps to |
|---|---|
| `from nigeria` | `country_id=NG` |
| `in kenya` | `country_id=KE` |
| `from south africa` | `country_id=ZA` |

Supported countries include all major African nations plus common global countries (USA, UK, France, etc.).

### Example query mappings

```
"young males"                         → gender=male, min_age=16, max_age=24
"females above 30"                    → gender=female, min_age=30
"people from angola"                  → country_id=AO
"adult males from kenya"              → gender=male, age_group=adult, country_id=KE
"male and female teenagers above 17"  → age_group=teenager, min_age=17
"senior women in ghana"               → gender=female, age_group=senior, country_id=GH
"men between 20 and 35"               → gender=male, min_age=20, max_age=35
```

### Uninterpretable queries

Queries with no recognizable keywords return:

```json
{ "status": "error", "message": "Unable to interpret query" }
```

## Parser Limitations

- **No negation support** — queries like "not from nigeria" or "non-adults" are not handled
- **No OR logic** — "males or seniors" cannot be parsed; all filters are AND conditions
- **"young" is not a stored age group** — it maps to ages 16–24 for parsing only
- **Country spelling** — country names must roughly match known names (e.g. "Cote d'Ivoire" may not resolve; use "ivory coast")
- **Ambiguous queries** — bare words like "people" or "profiles" with no other context return "Unable to interpret query"
- **Compound age + group conflict** — if both "young" and an age group (e.g. "adult") appear, the age group takes priority and the "young" range is ignored
- **No age exact match** — only ranges are supported (above/below/between), not exact age ("aged 25")
- **No probability filters** — natural language cannot set `min_gender_probability` or `min_country_probability`

## Deployment (Vercel)

1. Push repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add environment variable: `MONGODB_URI`
4. Deploy — Vercel uses `vercel.json` to route all requests to Express
5. Seed your database locally with `npm run seed` before submitting

> Made with ❤️ by [Fasakin Henry](https://github.com/fasakinhenry)
