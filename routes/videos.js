const express = require('express');
const router = express.Router();
const notes = require('../lib/notes');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { forwardAuthenticated, ensureAuthenticated } = require('../config/auth');
const helper = require('../public/scripts/helper');
const MobileDetect = require('mobile-detect');

// Load Modals
const User = require('../models/User');
const Post = require('../models/Post');
const Note = require('../models/Note');
const Photo = require('../models/Photo');
const Video = require('../models/Video');
const Comment = require('../models/Comment');

// Multer Config
var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './public/uploads/' + req.user.username)
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

var upload = multer({
    storage: storage
});

// Upload Page
router.get('/upload', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
        if(err) {
            console.log(err);
        } else if(md.mobile()) {
            res.render('mobile/upload', {
                title: 'VidFriendz - Upload A Video',
                logUser: req.user,
                hasNotes: hasNote,
                helper: helper
            });
        } else {
            res.render('upload', {
                title: 'VidFriendz - Upload A Video',
                logUser: req.user,
                hasNotes: hasNote,
                helper: helper
            });
        }
    });
});

// Upload Function
router.post('/upload', upload.single('video'), (req, res) => {
    const title = req.body.title;
    const file = req.file;
    const privacy = req.body.privacy;
    const adult = req.body.adult;
    const description = req.body.description;
    const category = req.body.category;

    if(!title || !file || !privacy || !adult || !description || !category) {
        req.flash(
            'error_msg',
            'All Fields Required'
        );
        res.redirect(req.get('referer'));
    } else {
        let newVideo = new Video({
            title: title,
            author: req.user.username,
            filename: file.filename,
            privacy: privacy,
            kids_friendly: adult,
            description: description,
            category: category
        });

        newVideo
            .save()
            .then((video) => {
                if(req.user.subscribers) {
                    req.user.subscribers.forEach((sub) => {
                        notes.addNewNote(req.user.username, sub, 'New Video', 'added a new video');
                    });
                    req.flash(
                        'success_msg',
                        'Your video has been uploaded'
                    )
                    res.redirect(req.get('referer'));
                } else {
                    req.flash(
                        'success_msg',
                        'Your video has been uploaded'
                    )
                    res.redirect(req.get('referer'));
                }
            });
    }
});

// Watch Page
router.get('/watch/:id', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    Video.findOne({ $or: [{ _id: req.params.id }, { post_id: req.params.id }] }, (err, video) => {
        if(err) {
            console.log(err);
        } else {
            Video.findOneAndUpdate({ _id: req.params.id }, { $push: { views: req.user.username } }).exec();        
            User.findOne({ username: video.author }, (err, vidUser) => {
                if(err) {
                    console.log(err);
                } else {
                    Comment.aggregate([
                        { $match: { post_id: req.params.id } },
                        {
                            $lookup: {
                                from: "users",
                                localField: "author",
                                foreignField: "username",
                                as: "comments"
                            }
                        },
                        {
                            $unwind: "$comments"
                        }
                    ]).then(comments => {
                        Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                            if(err) {
                                console.log(err);
                            } else if(md.mobile()) {
                                res.render('mobil/watch', {
                                    title: video.title,
                                    logUser: req.user,
                                    video: video,
                                    vidUser: vidUser,
                                    hasNotes: hasNote,
                                    helper: helper,
                                    comments: comments
                                });
                            } else {
                                res.render('watch', {
                                    title: video.title,
                                    logUser: req.user,
                                    video: video,
                                    vidUser: vidUser,
                                    hasNotes: hasNote,
                                    helper: helper,
                                    comments: comments
                                });
                            }
                        });
                    }).catch(err => console.log(err));
                }
            });
        }
    });
});

// Comment Function
router.post('/comment/:id', (req, res) => {
    Video.findOne({ _id: req.params.id }, (err, video) => {
        if(err) {
            console.log(err);
        } else {
            const author = req.user.username;
            const post_id = req.params.id;
            const data = req.body.commentText;

            if(!data) {
                req.flash(
                    'error_msg',
                    'Please type something first'
                );
                res.redirect(req.get('referer'));
            } else {
                let newComment = new Comment({
                    author: author,
                    post_id: post_id,
                    data: data
                });

                newComment
                    .save()
                    .then(comments => {
                        notes.addNewNote(req.user.username, video.author, 'New Video Like', 'commented on your video <a href="/videos/watch/' + video._id + '">View Here</a>');
                        res.redirect(req.get('referer'));
                    })
                    .catch(err => console.log(err));
            }
        }
    });
});

// Edit Video Page
router.get('/edit/:id', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    Video.findOne({ _id: req.params.id }, (err, video) => {
        if(err) {
            console.log(err);
        } else {
            Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                if(err) {
                    console.log(err);
                } else if(md.mobile()) {
                    res.render('mobile/edit_video', {
                        title: 'Edit Your Video',
                        logUser: req.user,
                        video: video,
                        hasNotes: hasNote,
                    });
                } else {
                    res.render('edit_video', {
                        title: 'Edit Your Video',
                        logUser: req.user,
                        video: video,
                        hasNotes: hasNote,
                    });
                }
            });
        }
    });
});

// Edit Video Function
router.post('/edit/:id', upload.single("thumbnail"), (req, res) => {
    const title = req.body.title;
    const thumbnail = req.file;
    const privacy = req.body.privacy;
    const kids = req.body.adult;
    const description = req.body.description;
    const category = req.body.category;

    if(!title || !thumbnail || !privacy || !kids || !description || !category) {
        req.flash(
            'error_msg',
            'All Fields Required'
        );
        res.redirect(req.get('referer'));
    } else {
        let updateVideo = {
            title: title,
            thumbnail: thumbnail.filename,
            privacy: privacy,
            kids_friendly: kids,
            description: description,
            category: category
        }

        Video.findOneAndUpdate({ _id: req.params.id }, updateVideo, (err) => {
            if(err) {
                console.log(err);
            } else {
                req.flash(
                    'success_msg',
                    'Video Updated'
                );
                res.redirect('/videos/edit/' + req.params.id);
            }
        });
    }
});

// Like Video
router.post('/like/:id', (req, res) => {
    Video.findOne({ _id: req.params.id }, (err, video) => {
        if(err) {
            console.log(err);
        } else if(video.post_id != "") {
            Video.findOneAndUpdate({ _id: req.params.id }, { $push: { likes: req.user.username } }).exec();
            Post.findOneAndUpdate({ _id: video.post_id }, { $push: { likes: req.user.username } }).exec();
            notes.addNewNote(req.user.username, video.author, 'New Video Like', 'liked your video <a href="/videos/watch/' + video._id + '">View Here</a>');
            res.redirect(req.get('referer'));
        } else {
            Video.findOneAndUpdate({ _id: req.params.id }, { $push: { likes: req.user.username } }).exec();
            res.redirect(req.get('referer'));
        }
    })
});

// Unlike Video
router.post('/unlike/:id', (req, res) => {
    Video.findOne({ _id: req.params.id }, (err, video) => {
        if(err) {
            console.log(err);
        } else if(video.post_id != "") {
            Video.findOneAndUpdate({ _id: req.params.id }, { $pull: { likes: req.user.username } }).exec();
            Post.findOneAndUpdate({ _id: video.post_id }, { $pull: { likes: req.user.username } }).exec();
            res.redirect(req.get('referer'));
        } else {
            Video.findOneAndUpdate({ _id: req.params.id }, { $pull: { likes: req.user.username } }).exec();
            res.redirect(req.get('referer'));
        }
    })
});

// Comment Like
router.post('/likeComment/:id', (req, res) => {
    Comment.findOne({ _id: req.params.id }, (err, comment) => {
        if(err) {
            console.log(err);
        } else {
            Comment.findOneAndUpdate({ _id: comment._id }, { $push: { likes: req.user.username } }).exec();
            notes.addNewNote(req.user.username, comment.author, 'Liked Comment', ' liked your comment <a href="/videos/watch/' + comment.post_id + '">view here</a>');
            if(req.user.subscribers) {
                req.user.subscribers.forEach((sub) => {
                    notes.addNewNote(req.user.username, sub, 'Liked Comment', ' liked a comment <a href="/videos/watch/' + comment.post_id + '">view here</a>');
                });
                res.redirect(req.get('referer'));
            } else {
                res.redirect(req.get('referer'));
            }
        }
    })
});

// Comment Unlike
router.post('/unlikeComment/:id', (req, res) => {
    Comment.findOneAndUpdate({ _id: req.params.id }, { $pull: { likes: req.user.username } }).exec();
    res.redirect(req.get('referer'));
})

// Delete Comment Function
router.post('/deleteComment/:id', (req, res) => {
    Coment.findOneAndDelete({ _id: req.params.id });
    res.redirect(req.get('referer'));
});

module.exports = router;