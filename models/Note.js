const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    title: { type: String, default: 'Untitled Note' },
    content: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Null for guest notes
    isPublic: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
    password: { type: String }, // Optional password protection
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // For future registered user collaboration
    averageRating: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', noteSchema);
