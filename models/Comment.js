const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    author: {
        type: String
    },
    post_id: {
        type: String
    },
    data: {
        type: String
    },
    likes: {
        type: [String]
    },
    date_made: {
        type: Date,
        default: Date.now()
    }
});

const Comment = mongoose.model('Comment', CommentSchema);

module.exports = Comment;