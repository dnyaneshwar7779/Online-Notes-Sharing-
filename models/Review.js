const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    note: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
    adminReply: { type: String, default: '' },
    isVisible: { type: Boolean, default: false }, // Admin approval needed
    approvedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);
