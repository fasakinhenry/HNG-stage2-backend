/**
 * Seed script — run with: npm run seed
 *
 * Reads profiles.json from the project root,
 * inserts all profiles into MongoDB.
 * Re-running is safe — duplicates are skipped by name (unique index).
 *
 * Usage:
 *   1. Place your profiles.json in the project root
 *   2. Make sure MONGODB_URI is set in .env
 *   3. Run: npm run seed
 */

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Profile = require("../models/Profile");
const { uuidv7 } = require("../utils/uuid");

const JSON_PATH = path.join(__dirname, "../../profiles.json");

async function seed() {
  // ── Load JSON file ────────────────────────────────────────────────────────
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`ERROR: profiles.json not found at ${JSON_PATH}`);
    console.error("Place your profiles.json in the project root folder.");
    process.exit(1);
  }

  const raw = fs.readFileSync(JSON_PATH, "utf-8");
  const parsed = JSON.parse(raw);

  // Support both { profiles: [...] } and a plain array [...]
  const profiles = Array.isArray(parsed) ? parsed : parsed.profiles;

  if (!profiles || profiles.length === 0) {
    console.error("No profiles found in JSON file.");
    process.exit(1);
  }

  console.log(`Found ${profiles.length} profiles in JSON file.`);

  // ── Connect to MongoDB ────────────────────────────────────────────────────
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log("Connected to MongoDB");

  // ── Build documents ───────────────────────────────────────────────────────
  const docs = profiles.map((p) => ({
    _id: uuidv7(),
    name: p.name,
    gender: p.gender,
    gender_probability: p.gender_probability,
    age: p.age,
    age_group: p.age_group,
    country_id: p.country_id,
    country_name: p.country_name,
    country_probability: p.country_probability,
    created_at: new Date(),
  }));

  // ── Insert, skip duplicates (ordered: false = continue on error) ──────────
  let inserted = 0;
  let skipped = 0;

  // Use insertMany with ordered:false so duplicates don't stop the batch
  try {
    const result = await Profile.insertMany(docs, { ordered: false });
    inserted = result.length;
  } catch (err) {
    if (err.code === 11000 || err.name === "MongoBulkWriteError") {
      // Partial insert — count what got through
      inserted = err.result?.nInserted ?? err.insertedDocs?.length ?? 0;
      skipped = docs.length - inserted;
    } else {
      throw err;
    }
  }

  console.log(`Seeding complete: ${inserted} inserted, ${skipped} skipped (duplicates).`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
