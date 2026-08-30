import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide your full name"],
      trim: true,
      maxlength: [80, "Name cannot be longer than 80 characters"],
    },
    username: {
      type: String,
      required: [true, "Please provide a username"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot be longer than 30 characters"],
      match: [/^[a-zA-Z0-9_.]+$/, "Username can only contain letters, numbers, dots and underscores"],
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    roles: {
      type: [String],
      default: ["viewer"],
      enum: ["viewer", "landowner", "builder", "buyer", "supplier", "admin"],
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    dob: {
      type: Date,
      default: null,
    },
    verification: {
      identity: {
        type: String,
        default: "pending",
        enum: ["pending", "submitted", "verified", "rejected"],
      },
      address: {
        type: String,
        default: "pending",
        enum: ["pending", "submitted", "verified", "rejected"],
      },
      phone: {
        type: String,
        default: "pending",
        enum: ["pending", "submitted", "verified", "rejected"],
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ roles: 1 });

export default mongoose.models.User || mongoose.model("User", userSchema);
