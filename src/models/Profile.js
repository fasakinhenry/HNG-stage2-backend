const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    _id: { type: String },           // UUID v7 stored as string
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    gender: { type: String, required: true },
    gender_probability: { type: Number, required: true },
    age: { type: Number, required: true },
    age_group: {
      type: String,
      enum: ["child", "teenager", "adult", "senior"],
      required: true,
    },
    country_id: { type: String, required: true },
    country_name: { type: String, required: true },
    country_probability: { type: Number, required: true },
    created_at: { type: Date, default: () => new Date() },
  },
  {
    _id: false,       // we supply _id manually
    versionKey: false,
  }
);

// Indexes for fast filtering/sorting — avoids full-table scans
profileSchema.index({ gender: 1 });
profileSchema.index({ age_group: 1 });
profileSchema.index({ country_id: 1 });
profileSchema.index({ age: 1 });
profileSchema.index({ gender_probability: 1 });
profileSchema.index({ country_probability: 1 });
profileSchema.index({ created_at: 1 });

// Full profile output (single profile endpoints)
profileSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    gender: this.gender,
    gender_probability: this.gender_probability,
    age: this.age,
    age_group: this.age_group,
    country_id: this.country_id,
    country_name: this.country_name,
    country_probability: this.country_probability,
    created_at: this.created_at.toISOString(),
  };
};

module.exports = mongoose.model("Profile", profileSchema);
