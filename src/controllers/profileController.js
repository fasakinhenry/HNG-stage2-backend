const Profile = require("../models/Profile");
const { parseQuery } = require("../utils/queryParser");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SORT_FIELDS = ["age", "created_at", "gender_probability"];
const VALID_ORDERS = ["asc", "desc"];
const VALID_FILTER_KEYS = [
  "gender", "age_group", "country_id",
  "min_age", "max_age",
  "min_gender_probability", "min_country_probability",
  "sort_by", "order", "page", "limit",
];

function buildMongoFilter(query) {
  const filter = {};

  if (query.gender) {
    filter.gender = query.gender.toLowerCase();
  }
  if (query.age_group) {
    filter.age_group = query.age_group.toLowerCase();
  }
  if (query.country_id) {
    filter.country_id = query.country_id.toUpperCase();
  }

  // Age range
  if (query.min_age !== undefined || query.max_age !== undefined) {
    filter.age = {};
    if (query.min_age !== undefined) filter.age.$gte = Number(query.min_age);
    if (query.max_age !== undefined) filter.age.$lte = Number(query.max_age);
  }

  // Probability thresholds
  if (query.min_gender_probability !== undefined) {
    filter.gender_probability = { $gte: Number(query.min_gender_probability) };
  }
  if (query.min_country_probability !== undefined) {
    filter.country_probability = { $gte: Number(query.min_country_probability) };
  }

  return filter;
}

function buildSortObject(sort_by, order) {
  const field = VALID_SORT_FIELDS.includes(sort_by) ? sort_by : "created_at";
  const direction = order === "asc" ? 1 : -1;
  return { [field]: direction };
}

function parsePagination(query) {
  let page = parseInt(query.page) || 1;
  let limit = parseInt(query.limit) || 10;
  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 50) limit = 50;
  return { page, limit, skip: (page - 1) * limit };
}

function formatProfile(doc) {
  return {
    id: doc._id,
    name: doc.name,
    gender: doc.gender,
    gender_probability: doc.gender_probability,
    age: doc.age,
    age_group: doc.age_group,
    country_id: doc.country_id,
    country_name: doc.country_name,
    country_probability: doc.country_probability,
    created_at: doc.created_at instanceof Date
      ? doc.created_at.toISOString()
      : new Date(doc.created_at).toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/profiles
// ─────────────────────────────────────────────────────────────────────────────
async function getAllProfiles(req, res) {
  try {
    const {
      gender, age_group, country_id,
      min_age, max_age,
      min_gender_probability, min_country_probability,
      sort_by, order,
      page: pageQ, limit: limitQ,
      ...unknownParams
    } = req.query;

    // Reject unknown query parameters
    const knownKeys = new Set(VALID_FILTER_KEYS);
    const incoming = Object.keys(req.query);
    const invalid = incoming.filter((k) => !knownKeys.has(k));
    if (invalid.length > 0) {
      return res.status(400).json({ status: "error", message: "Invalid query parameters" });
    }

    // Validate sort_by if provided
    if (sort_by && !VALID_SORT_FIELDS.includes(sort_by)) {
      return res.status(400).json({ status: "error", message: "Invalid query parameters" });
    }

    // Validate order if provided
    if (order && !VALID_ORDERS.includes(order.toLowerCase())) {
      return res.status(400).json({ status: "error", message: "Invalid query parameters" });
    }

    // Validate numeric params
    const numericFields = { min_age, max_age, min_gender_probability, min_country_probability };
    for (const [key, val] of Object.entries(numericFields)) {
      if (val !== undefined && isNaN(Number(val))) {
        return res.status(422).json({ status: "error", message: `Invalid value for ${key}` });
      }
    }

    const filter = buildMongoFilter(req.query);
    const sort = buildSortObject(sort_by, order);
    const { page, limit, skip } = parsePagination(req.query);

    const [total, profiles] = await Promise.all([
      Profile.countDocuments(filter),
      Profile.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      data: profiles.map(formatProfile),
    });
  } catch (err) {
    console.error("getAllProfiles error:", err);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/profiles/search?q=...
// ─────────────────────────────────────────────────────────────────────────────
async function searchProfiles(req, res) {
  try {
    const { q, page: pageQ, limit: limitQ } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ status: "error", message: "Query parameter 'q' is required" });
    }

    // Reject unknown params (only q, page, limit allowed here)
    const allowed = new Set(["q", "page", "limit"]);
    const invalid = Object.keys(req.query).filter((k) => !allowed.has(k));
    if (invalid.length > 0) {
      return res.status(400).json({ status: "error", message: "Invalid query parameters" });
    }

    const filters = parseQuery(q.trim());

    if (!filters) {
      return res.status(200).json({ status: "error", message: "Unable to interpret query" });
    }

    const filter = buildMongoFilter(filters);
    const { page, limit, skip } = parsePagination(req.query);

    const [total, profiles] = await Promise.all([
      Profile.countDocuments(filter),
      Profile.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({
      status: "success",
      page,
      limit,
      total,
      data: profiles.map(formatProfile),
    });
  } catch (err) {
    console.error("searchProfiles error:", err);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/profiles/:id
// ─────────────────────────────────────────────────────────────────────────────
async function getProfileById(req, res) {
  try {
    const profile = await Profile.findById(req.params.id).lean();
    if (!profile) {
      return res.status(404).json({ status: "error", message: "Profile not found" });
    }
    return res.status(200).json({ status: "success", data: formatProfile(profile) });
  } catch (err) {
    console.error("getProfileById error:", err);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

module.exports = { getAllProfiles, searchProfiles, getProfileById };
