import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const SALT_ROUNDS = 10;

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

async function main() {
  const env = loadEnv();
  const args = parseArgs();

  const MONGODB_URI = env.MONGODB_URI;
  const MONGODB_DB = env.MONGODB_DB || "estovia";

  if (!MONGODB_URI) {
    console.error("Error: MONGODB_URI not found in .env.local");
    process.exit(1);
  }

  const email = (args.email || "admin@estovia.in").toLowerCase();
  const password = args.password || "admin123";
  const name = args.name || "Admin";
  const username = (args.username || "admin").toLowerCase();

  console.log(`Connecting to MongoDB (${MONGODB_DB})...`);
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  console.log("Connected.");

  const User = mongoose.models.User || mongoose.model("User", userSchema);

  // Step 1: Remove all existing admin accounts to start clean
  const deleted = await User.deleteMany({ roles: "admin" });
  console.log(`Removed ${deleted.deletedCount} existing admin account(s).`);

  // Step 2: Also remove any duplicates with same email or username
  const byEmail = await User.findOne({ email });
  if (byEmail) {
    await User.findByIdAndDelete(byEmail._id);
    console.log(`Removed duplicate account with email: ${email}`);
  }
  const byUsername = await User.findOne({ username });
  if (byUsername) {
    await User.findByIdAndDelete(byUsername._id);
    console.log(`Removed duplicate account with username: ${username}`);
  }

  // Step 3: Create the single admin account using $set (no .save() bug)
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

  // Step 4: Verify the passwordHash persisted correctly
  const verify = await User.findById(admin._id).select("+passwordHash");
  const passwordValid = await bcrypt.compare(password, verify.passwordHash);

  console.log(`\nAdmin account created:`);
  console.log(`  Email:    ${email}`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(`  Roles:    ${verify.roles}`);
  console.log(`  Status:   ${verify.accountStatus}`);
  console.log(`  Password hash verified: ${passwordValid ? "OK" : "FAILED"}`);

  // Step 5: Confirm only one admin exists
  const adminCount = await User.countDocuments({ roles: "admin" });
  console.log(`  Total admins in DB: ${adminCount}`);

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
