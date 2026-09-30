import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SALT_ROUNDS = 10;
const DEFAULT_EMAIL = "admin@estovia.in";
const DEFAULT_PASSWORD = "changeme123";

function loadEnv() {
  try {
    const envPath = resolve(__dirname, "..", ".env.local");
    const content = readFileSync(envPath, "utf8");
    const vars = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
    return vars;
  } catch {
    return {};
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      parsed[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return parsed;
}

const userSchema = new mongoose.Schema(
  {
    name: String,
    username: { type: String, unique: true, lowercase: true, trim: true },
    email: { type: String, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    roles: { type: [String], default: ["admin"] },
    profileCompleted: { type: Boolean, default: true },
    accountStatus: { type: String, default: "active" },
    verification: {
      identity: { type: String, default: "verified" },
      address: { type: String, default: "verified" },
      phone: { type: String, default: "verified" },
    },
  },
  { timestamps: true }
);

/**
 * Creates the Estovia admin account.
 *
 * Non-destructive & idempotent:
 *  - Existing admin accounts are never deleted.
 *  - If the target admin already exists, only the password is reset when the
 *    supplied password differs (or --reset-password is passed explicitly) so a
 *    concurrent admin login does not get silently broken during development.
 *  - Credentials can be overridden via CLI flags or ADMIN_EMAIL / ADMIN_PASSWORD
 *    environment variables. Defaults: admin@estovia.in / changeme123
 */
async function main() {
  const env = loadEnv();
  const args = parseArgs();

  const MONGODB_URI = env.MONGODB_URI || args.mongoUri;
  const MONGODB_DB = env.MONGODB_DB || "estovia";
  if (!MONGODB_URI) {
    console.error("Error: MONGODB_URI not found in .env.local (or --mongoUri).");
    process.exit(1);
  }

  const email = (args.email || env.ADMIN_EMAIL || DEFAULT_EMAIL).toLowerCase();
  const username = (args.username || "admin").toLowerCase();
  const password = args.password || env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const name = args.name || "Admin";
  const resetPassword = args["reset-password"] === "true";

  if (password.length < 8) {
    console.error("Error: password must be at least 8 characters.");
    process.exit(1);
  }

  console.log(`Connecting to MongoDB (${MONGODB_DB})...`);
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  console.log("Connected.");

  const User = mongoose.models.User || mongoose.model("User", userSchema);

  const existing = await User.findOne({ email }).select("+passwordHash");

  if (existing) {
    const valid = await bcrypt.compare(password, existing.passwordHash);
    let changed = false;

    if (!valid && resetPassword) {
      existing.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      existing.username = username;
      existing.roles = existing.roles?.includes("admin") ? existing.roles : ["admin", ...(existing.roles || [])];
      existing.roles = [...new Set(existing.roles)];
      existing.profileCompleted = true;
      existing.accountStatus = existing.accountStatus || "active";
      await existing.save();
      changed = true;
    }

    console.log(`\nAdmin account already exists:`);
    console.log(`  Email:    ${existing.email}`);
    console.log(`  Username: ${existing.username || username}`);
    console.log(`  Roles:    ${existing.roles}`);
    console.log(`  Status:   ${existing.accountStatus}`);
    console.log(`  Password matches '${password}': ${valid ? "OK" : "NO"}`);
    if (!valid && !resetPassword) {
      console.log(`\n  Password does NOT match '${password}'.`);
      console.log("  Re-run with `node scripts/create-admin.mjs --reset-password true` to reset it.");
    }
    if (changed) console.log(`  Password reset to '${password}'.`);
    await mongoose.disconnect();
    console.log("\nDone.");
    process.exit(valid || changed ? 0 : 1);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const admin = await User.create({
    name,
    username,
    email,
    passwordHash,
    roles: ["admin"],
    profileCompleted: true,
    accountStatus: "active",
    verification: { identity: "verified", address: "verified", phone: "verified" },
  });

  const verify = await User.findById(admin._id).select("+passwordHash");
  const passwordValid = await bcrypt.compare(password, verify.passwordHash);

  console.log(`\nAdmin account created:`);
  console.log(`  Email:    ${email}`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(`  Roles:    ${verify.roles}`);
  console.log(`  Status:   ${verify.accountStatus}`);
  console.log(`  Password hash verified: ${passwordValid ? "OK" : "FAILED"}`);

  const adminCount = await User.countDocuments({ roles: "admin" });
  console.log(`  Total admins in DB: ${adminCount}`);

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});