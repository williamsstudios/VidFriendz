const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    author: {
        type: String
    },
    account_name: {
        type: String
    },
    data: {
        type: String
    },
    image: {
        type: String
    },
    video: {
        type: String
    },
    likes: {
        type: [String]
    },
    sharedText: {
        type: String
    },
    action: {
        type: String
    },
    privacy: {
        type: Number,
        default: 0
    },
    date_made: {
        type: Date,
        default: Date.now()
    }
});

const Post = mongoose.model('Post', PostSchema);

module.exports = Post;