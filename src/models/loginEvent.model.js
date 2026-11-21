const mongoose = require('mongoose');

// One document per login attempt (success or failure), geolocated once at login time.
// Personal data: readable by admins only; exact points are coarsened after the
// retention period (see src/jobs/loginEventRetention.js).
const loginEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = unknown username
    success: { type: Boolean, required: true },
    ip: { type: String, required: true },
    country: { type: String, default: null }, // ISO code, from IP
    city: { type: String, default: null }, // from IP
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    accuracyM: { type: Number, default: null }, // radius in metres
    source: { type: String, enum: ['gps', 'ip'], required: true },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginEventSchema.index({ user: 1, createdAt: -1 });
loginEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LoginEvent', loginEventSchema);
