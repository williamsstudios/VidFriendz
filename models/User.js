const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    firstname: {
        type: String
    },
    lastname: {
        type: String
    },
    username: {
        type: String
    },
    email: {
        type: String,
    },
    password: {
        type: String,
        required: true
    },
    gender: {
        type: String
    },
    country: {
        type: String
    },
    birthday: {
        type: Date
    },
    joindate: {
        type: Date,
        default: Date.now
    },
    coins: {
        type: Number,
        default: 0
    },
    avatar: {
        type: String
    },
    cover_pic: {
        type: String
    },
    subscribers: {
        type: [String]
    },
    subscriptions: {
        type: [String]
    },
    bio: {
        type: String
    },
    city: {
        type: String
    },
    state: {
        type: String
    },
    privacy: {
        type: Boolean,
        default: false
    }
});

const User = mongoose.model('User', UserSchema);

module.exports = User;