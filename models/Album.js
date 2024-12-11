const mongoose = require('mongoose');

const AlbumSchema = new mongoose.Schema({
    author: {
        type: String
    },
    name: {
        type: String
    },
    photos: {
        type: [String]
    },
    upload_date: {
        type: Date,
        default: Date.now()
    }
});

const Album = mongoose.model('Album', AlbumSchema);

module.exports = Album;