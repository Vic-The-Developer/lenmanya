const mongoose = require('mongoose');

// Define the Blog schema
const blogSchema = new mongoose.Schema({
    bTitle: {
        type: String,
        required: true,
        trim: true, // Removes whitespace from the ends
    },
    category: {
        type: String,
        required: true,
        enum: ['Travel Tips', 'Destinations', 'Special Offers'], // Predefined categories
    },
    featuredImage: {
        type: String, // Path to the uploaded featured image
        default: '', // Default empty if no image
    },
    content: {
        type: String,
        required: true,
    },
    metaTitle: {
        type: String,
        required: true,
        trim: true,
    },
    metaDescription: {
        type: String,
        required: true,
        trim: true,
    },
    keywords: {
        type: [String], // Array of keywords
        default: [],
    },
    status: {
        type: String,
        enum: ['Draft', 'Published'], // Only allow these two options
        default: 'Draft',
    },
    createdAt: {
        type: Date,
        default: Date.now, // Automatically sets current date/time
    },
});

// Create and export the Blog model
module.exports = mongoose.model('Blog', blogSchema);
