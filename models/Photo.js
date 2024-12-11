const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
    author: {
        type: String
    },
    filename: {
        type: String
    },
    post_id: {
        type: String
    },
    album: {
        type: String
    },
    description: {
        type: String
    },
    privacy: {
        type: Number,
        default: 0
    },
    likes: {
        type: [String]
    },
    upload_date: {
        type: Date,
        default: Date.now()
    }
});

const Photo = mongoose.model('Photo', PhotoSchema);

module.exports = Photo;