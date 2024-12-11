const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { forwardAuthenticated, ensureAuthenticated } = require('../config/auth');
const helper = require('../public/scripts/helper');
const notes = require('../lib/notes');

// Load Models
const User = require('../models/User');
const Post = require('../models/Post');                  
const Note = require('../models/Note');
const Photo = require('../models/Photo');
const Video = require('../models/Video');

// Search Page
router.get('/', ensureAuthenticated, (req, res) => {
    Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
        if(err) {
            console.log(err);
        } else {
            res.render('search', {
                title: 'VidFriendz - Search',
                logUser: req.user,
                hasNotes: hasNote,
                userResults: "",
                videoResults: "",
                query: "",
                helper: helper
            });
        }
    });
});

// Search Function
router.post('/getResults', (req, res) => {
    const query = req.body.query;

    if(!query) {
        req.flash(
            'error_msg',
            'Please type something first'
        );
        res.redirect(req.get('referer'));
    } else {
        User.find({ $or: [{ username: { $regex: query, $options: 'i' } }, { firstname: { $regex: query, $options: 'i' } }, { lastname: { $regex: query, $options: 'i' } }] }, (err, userResults) => {
            if(err) {
                console.log(err);
            } else {
                Video.find({ $or: [{ title: { $regex: query, $options: 'i' } }, { author: { $regex: query, $options: 'i' } }, { category: { $regex: query, $options: 'i' } }, { description: { $regex: query, $options: 'i' } }] }, (err, videoResults) => {
                    if(err) {
                        console.log(err);
                    } else {
                        Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                            if(err) {
                                console.log(err);
                            } else {
                                res.render('search', {
                                    title: 'VidFriendz - Search',
                                    logUser: req.user,
                                    hasNotes: hasNote,
                                    userResults: userResults,
                                    videoResults: videoResults,
                                    query: query,
                                    helper: helper
                                });
                            }
                        });
                    }
                })
            }
        });
    }
});

module.exports = router;