const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
    initator: {
        type: String
    },
    receiver: {
        type: String
    },
    app: {
        type: String
    },
    note: {
        type: String
    },
    did_read: {
        type: Boolean,
        default: false
    },
    date_made: {
        type: Date,
        default: Date.now()
    }
});

const Note = mongoose.model('Note', NoteSchema);

module.exports = Note;