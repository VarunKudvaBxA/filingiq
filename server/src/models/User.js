import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // free: 3 documents, 20 questions/hour. pro: unlimited documents, 200 questions/hour.
    role: { type: String, enum: ['free', 'pro', 'admin'], default: 'free' },
    // Only the hash of the current refresh token is stored (rotation + reuse detection).
    refreshTokenHash: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
