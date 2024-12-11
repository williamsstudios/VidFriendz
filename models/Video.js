const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
    title: {
        type: String
    },
    author: {
        type: String
    },
    post_id: {
        type: String
    },
    filename: {
        type: String
    },
    thumbnail: {
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
    views: {
        type: [String]
    },
    kids_friendly: {
        type: Boolean,
        default: false
    },
    category: {
        type: String
    },
    upload_date: {
        type: Date,
        default: Date.now()
    }
});

const Video = mongoose.model('Video', VideoSchema);

module.exports = Video;