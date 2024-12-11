const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

// Load Models
const User = require('../models/User');
const Post = require('../models/Post');
const Note = require('../models/Note');


function addNewNote(initator, receiver, app, note) {
    let newNote = new Note({
        initator: initator,
        receiver: receiver,
        app: app,
        note: note
    });

    newNote.save();
}

function markasread(note) {
    Note.findOneAndUpdate({ _id: note }, {did_read: true}).exec();
    return "success";
}

module.exports = {router, addNewNote, markasread};