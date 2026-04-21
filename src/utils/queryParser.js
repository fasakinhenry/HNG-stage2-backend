/**
 * Natural Language Query Parser
 * Rule-based only — no AI, no LLMs.
 *
 * Supported keywords and their mappings:
 *
 * GENDER:
 *   "male", "males", "men", "man"           → gender=male
 *   "female", "females", "women", "woman"   → gender=female
 *   "male and female" / "both"              → no gender filter (all genders)
 *
 * AGE GROUPS (stored values):
 *   "child", "children"                     → age_group=child
 *   "teenager", "teenagers", "teen", "teens"→ age_group=teenager
 *   "adult", "adults"                       → age_group=adult
 *   "senior", "seniors", "elderly", "old"   → age_group=senior
 *
 * AGE DESCRIPTORS (mapped to min/max_age ranges, not stored):
 *   "young"                                 → min_age=16, max_age=24
 *
 * AGE COMPARISONS:
 *   "above X", "over X", "older than X"    → min_age=X
 *   "below X", "under X", "younger than X" → max_age=X
 *   "between X and Y"                       → min_age=X, max_age=Y
 *
 * COUNTRY:
 *   "from <country>", "in <country>"       → country_id looked up by name
 *   "<country name>"                        → country_id looked up by name
 *
 * LIMITATIONS:
 *   - Does not handle compound countries like "United States" reliably in all positions
 *   - "young" is not an age_group — it only sets min/max_age
 *   - Ambiguous queries (e.g. "people") with no filters return "Unable to interpret query"
 *   - Does not support negation ("not from nigeria")
 *   - Does not support OR logic between filters ("males or seniors")
 *   - Country matching is name-based; spelling must be close to the country_name in the dataset
 */

// Country name → ISO code map (covers African + common countries in dataset)

const COUNTRY_MAP = {
  nigeria: "NG", ghana: "GH", kenya: "KE", tanzania: "TZ", uganda: "UG",
  ethiopia: "ET", senegal: "SN", cameroon: "CM", "ivory coast": "CI",
  "côte d'ivoire": "CI", mali: "ML", niger: "NE", chad: "TD",
  angola: "AO", mozambique: "MZ", zambia: "ZM", zimbabwe: "ZW",
  malawi: "MW", rwanda: "RW", burundi: "BI", somalia: "SO",
  "south africa": "ZA", botswana: "BW", namibia: "NA", lesotho: "LS",
  eswatini: "SZ", madagascar: "MG", mauritius: "MU", seychelles: "SC",
  comoros: "KM", "cape verde": "CV", "guinea-bissau": "GW", guinea: "GN",
  "equatorial guinea": "GQ", "sierra leone": "SL", liberia: "LR",
  "burkina faso": "BF", togo: "TG", benin: "BJ", gabon: "GA",
  congo: "CG", drc: "CD", "democratic republic of the congo": "CD",
  "republic of the congo": "CG", "central african republic": "CF",
  sudan: "SD", "south sudan": "SS", eritrea: "ER", djibouti: "DJ",
  libya: "LY", egypt: "EG", tunisia: "TN", algeria: "DZ", morocco: "MA",
  "western sahara": "EH", mauritania: "MR", gambia: "GM",
  // Common non-African countries
  usa: "US", "united states": "US", america: "US", uk: "GB",
  "united kingdom": "GB", britain: "GB", france: "FR", germany: "DE",
  italy: "IT", spain: "ES", portugal: "PT", brazil: "BR", india: "IN",
  china: "CN", japan: "JP", canada: "CA", australia: "AU",
  indonesia: "ID", pakistan: "PK", bangladesh: "BD", philippines: "PH",
  mexico: "MX", colombia: "CO", argentina: "AR",
};

const AGE_GROUP_ALIASES = {
  child: "child", children: "child", kid: "child", kids: "child",
  teenager: "teenager", teenagers: "teenager", teen: "teenager", teens: "teenager",
  adolescent: "teenager", adolescents: "teenager",
  adult: "adult", adults: "adult",
  senior: "senior", seniors: "senior", elderly: "senior", elder: "senior",
  "old people": "senior", "older people": "senior",
};

function parseQuery(q) {
  if (!q || typeof q !== "string") return null;

  const raw = q.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const filters = {};
  let interpreted = false;

  // ── GENDER ──────────────────────────────────────────────────────────────────
  const bothGenders = /\b(male\s+and\s+female|female\s+and\s+male|both\s+genders?)\b/.test(lower);
  if (bothGenders) {
    interpreted = true; // "male and female" means no gender filter — still valid
  } else if (/\b(males?|men|man)\b/.test(lower)) {
    filters.gender = "male";
    interpreted = true;
  } else if (/\b(females?|women|woman)\b/.test(lower)) {
    filters.gender = "female";
    interpreted = true;
  }

  // ── AGE GROUP ────────────────────────────────────────────────────────────────
  for (const [alias, group] of Object.entries(AGE_GROUP_ALIASES)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(lower)) {
      filters.age_group = group;
      interpreted = true;
      break;
    }
  }

  // ── "YOUNG" — maps to age range 16–24, NOT a stored age_group ──────────────
  if (/\byoung\b/.test(lower) && !filters.age_group) {
    filters.min_age = 16;
    filters.max_age = 24;
    interpreted = true;
  }

  // ── AGE COMPARISONS ─────────────────────────────────────────────────────────
  // "between X and Y"
  const betweenMatch = lower.match(/\bbetween\s+(\d+)\s+and\s+(\d+)\b/);
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1]);
    filters.max_age = parseInt(betweenMatch[2]);
    interpreted = true;
  }

  // "above X", "over X", "older than X"
  const minAgeMatch = lower.match(/\b(?:above|over|older than|at least)\s+(\d+)\b/);
  if (minAgeMatch) {
    filters.min_age = parseInt(minAgeMatch[1]);
    interpreted = true;
  }

  // "below X", "under X", "younger than X"
  const maxAgeMatch = lower.match(/\b(?:below|under|younger than|at most)\s+(\d+)\b/);
  if (maxAgeMatch) {
    filters.max_age = parseInt(maxAgeMatch[1]);
    interpreted = true;
  }

  // ── COUNTRY ─────────────────────────────────────────────────────────────────
  // Match "from <country>" or "in <country>"
  const countryPrefixMatch = lower.match(/\b(?:from|in)\s+([a-z\s'-]+?)(?:\s+(?:above|below|over|under|between|who|that|aged?|with|and|$)|\s*$)/);
  if (countryPrefixMatch) {
    const countryRaw = countryPrefixMatch[1].trim();
    const code = resolveCountry(countryRaw);
    if (code) {
      filters.country_id = code;
      interpreted = true;
    }
  }

  // Fallback: check if any known country name appears anywhere in the query
  if (!filters.country_id) {
    const code = resolveCountryFromText(lower);
    if (code) {
      filters.country_id = code;
      interpreted = true;
    }
  }

  // ── RESULT ──────────────────────────────────────────────────────────────────
  if (!interpreted || Object.keys(filters).length === 0) {
    return null; // signals "Unable to interpret query"
  }

  return filters;
}

function resolveCountry(text) {
  const cleaned = text.trim().toLowerCase();
  if (COUNTRY_MAP[cleaned]) return COUNTRY_MAP[cleaned];

  // Try partial match (longest match wins)
  let bestMatch = null;
  let bestLen = 0;
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (cleaned.includes(name) && name.length > bestLen) {
      bestMatch = code;
      bestLen = name.length;
    }
  }
  return bestMatch;
}

function resolveCountryFromText(text) {
  let bestMatch = null;
  let bestLen = 0;
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(text) && name.length > bestLen) {
      bestMatch = code;
      bestLen = name.length;
    }
  }
  return bestMatch;
}

module.exports = { parseQuery };
