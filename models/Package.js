const mongoose = require("mongoose");

// Define the schema for Package
const PackageSchema = new mongoose.Schema(
  {
    pTitle: {
      type: String,
      required: true,
      trim: true,
    },
    pLoc: {
      type: String,
      required: true,
      trim: true,
    },
    pDays: {
      type: Number,
      required: true,
      min: [1, "Number of days must be at least 1"],
    },
    description: {
      type: String,
      required: true,
      minlength: [10, "Description must be at least 10 characters long"],
      trim: true,
    },
    price: {
      type: String,
      required: true,
    },
    stat: {
      type: String,
      required: true,
    },
    pRating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot be more than 5"],
    },
    pImages: {
      type: [String], // Array of image file paths
      validate: {
        validator: function (images) {
          return images.length <= 5; // Ensure no more than 5 images
        },
        message: "A package can have a maximum of 5 images",
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// Export the Package model
module.exports = mongoose.model("Package", PackageSchema);
