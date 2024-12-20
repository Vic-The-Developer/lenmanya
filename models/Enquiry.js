const mongoose = require('mongoose');

// Define the Enquiry Schema
const EnquirySchema = new mongoose.Schema({
    fname: {
        type: String,
        required: true,
        trim: true
    },
    destination: {
        type: String,
        required: true,
        trim: true
    },
    date1: {
        type: Date,
        required: true
    },
    whatsapp: {
        type: String,
        required: true,
        trim: true
    },
    dateSubmit: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'resolved'],
        default: 'pending'
    },
    adults: {
        type: Number,
        min: 1,
        default: null
    },
    children: {
        type: Number,
        min: 0,
        default: null
    }
}, { timestamps: true }); // Enable createdAt and updatedAt

// Export the Enquiry model
module.exports = mongoose.model('Enquiry', EnquirySchema);
