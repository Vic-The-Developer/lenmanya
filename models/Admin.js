const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: false, // Optional field
  },
  displayName: {
    type: String,
    required: false, // Optional field
  },
  role: {
    type: String,
    required: true, 
  },
  resetCode: {
    type: String,
    required: false, // Optional field for password reset
  },
});

module.exports = mongoose.model("Admin", AdminSchema);
