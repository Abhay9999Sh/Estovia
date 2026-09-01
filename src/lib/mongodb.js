import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "realestate";

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

// Bounded timeouts so API requests fail fast instead of hanging for the
// driver default (~30s) when MongoDB is unreachable.
const SERVER_SELECTION_TIMEOUT_MS = 5000;
const CONNECT_TIMEOUT_MS = 10000;

// After a failed attempt, short-circuit retries for a brief window so
// concurrent requests don't each spawn a fresh 5s connection attempt.
const RETRY_COOLDOWN_MS = 5000;

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents exhausting connections on each reload.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, lastFailureAt: 0, lastError: null };
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (cached.lastFailureAt && Date.now() - cached.lastFailureAt < RETRY_COOLDOWN_MS) {
    throw cached.lastError || new Error("Database temporarily unavailable. Please try again shortly.");
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      dbName: MONGODB_DB,
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        return mongooseInstance;
      })
      .catch((error) => {
        cached.promise = null;
        cached.lastFailureAt = Date.now();
        cached.lastError = error;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
