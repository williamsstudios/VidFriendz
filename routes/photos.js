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
const MobileDetect = require('mobile-detect');

// Load Modals
const User = require('../models/User');
const Post = require('../models/Post');
const Note = require('../models/Note');
const Photo = require('../models/Photo');
const Video = require('../models/Video');
const Comment = require('../models/Comment');
const Album = require('../models/Album');

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
    Photo.find({ author: req.user.username }, (err, photos) => {
        if(err) {
            console.log(err);
        } else {
            Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                if(err) {
                    console.log(err);
                } else if(md.mobile()) {
                    res.render('mobile/upload_photo', {
                        title: 'Upload A Photo',
                        logUser: req.user,
                        hasNotes: hasNote,
                        photos: photos
                    });
                } else {
                    res.render('upload_photo', {
                        title: 'Upload A Photo',
                        logUser: req.user,
                        hasNotes: hasNote,
                        photos: photos
                    });
                }
            });
        }
    });
});


// Upload Function 
router.post('/upload', upload.single('image'), (req, res) => {
    const author = req.user.username;
    const file = req.file;
    const album = req.body.album;
    const description = req.body.description;
    const privacy = req.body.privacy;

    if(!file || !album || !description || !privacy) {
        req.flash(
            'error_msg',
            'All Fields Required'
        );
        res.redirect(req.get('referer'));
    } else {
        Album.findOne({ $and: [{ author: req.user.username }, { name: album }] }, (err, albumExists ) => {
            if(err) {
                console.log(err);
            } else if(albumExists) {
                let newPhoto = new Photo({
                    author: author,
                    filename: file.filename,
                    album: album,
                    description: description,
                    privacy: privacy
                });

                newPhoto
                    .save()
                    .then((photo) => {
                        Album.findOneAndUpdate({ name: album }, { $push: { photos: newPhoto.filename } }).exec();
                        req.flash(
                            'success_msg',
                            'Your Photo Has Been Uploaded'
                        );
                        res.redirect(req.get('referer'));
                    })
                    .catch(err => console.log(err));
            } else {
                let newAlbum = new Album({
                    author: req.user.username,
                    name: album
                });

                newAlbum
                    .save()
                    .then(newAlbum => {
                        let newPhoto = new Photo({
                            author: author,
                            filename: file.filename,
                            album: newAlbum.name,
                            description: description,
                            privacy: privacy
                        });

                        newPhoto
                            .save()
                            .then(photo => {
                                Album.findOneAndUpdate({ $and: [{ author: req.user.username }, { name: newAlbum.name }] }, { $push: { photos: newPhoto.filename } }, (err) => {
                                    if(err) {
                                        console.log(err);
                                    } else {
                                        req.flash(
                                            'success_msg',
                                            'Your Photo Has Been Uploaded'
                                        );
                                        res.redirect(req.get('referer'));
                                    }
                                });
                            })
                            .catch(err => console.log(err));
                    })
                    .catch(err => console.log(err));
            }
        })
    }
});


// View Photo
router.get('/view/:id', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    Photo.findOne({ _id: req.params.id }, (err, photo) => {
        if(err) {
            console.log(err);
        } else {
            Photo.find({ album: photo.album }, (err, albumPhotos) => {
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
                        },
                        {
                            $sort: { date_made: -1 }
                        }
                    ]).then(comments => {
                        User.findOne({ username: photo.author }, (err, user) => {
                            if(err) {
                                console.log(err);
                            } else {
                                Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                                    if(err) {
                                        console.log(err);
                                    } else if(md.mobile()) {
                                        res.render('/mobile/view_photos', {
                                            title: user.firstname + ' ' + user.lastname + ' photos',
                                            logUser: req.user,
                                            albumPhotos: albumPhotos,
                                            photo: photo,
                                            hasNotes: hasNote,
                                            helper: helper,
                                            comments: comments,
                                            user: user
                                        });
                                    } else {
                                        res.render('/view_photos', {
                                            title: user.firstname + ' ' + user.lastname + ' photos',
                                            logUser: req.user,
                                            albumPhotos: albumPhotos,
                                            photo: photo,
                                            hasNotes: hasNote,
                                            helper: helper,
                                            comments: comments,
                                            user: user
                                        });
                                    }
                                });
                            }
                        })
                    });
                }
            });
        }
    });
});

// Share Photo Function
router.post('/share/:id', (req, res) => {
    Photo.findOne({ _id: req.params.id }, (err, photo) => {
        if(err) {
            console.log(err);
        } else {
            User.findOne({ username: photo.author }, (err, photoUser) => {
                if(err) {
                    console.log(err);
                } else {
                    let newPost = new Post({
                        author: req.user.username,
                        account_name: photo.author,
                        data: photo.description,
                        image: photo.filename,
                        action: "shared " + photoUser.firstname + ' ' + photoUser.lastname + "'s photo"
                    });

                    newPost
                        .save()
                        .then(newPost => {
                            notes.addNewNote(req.user.username, photo.author, "Photo Share", 'shared your photo <a href="/photos/view/' + photo._id + '">View Here</a>');
                            req.flash(
                                'success_msg',
                                'You shared a photo'
                            );
        
                            res.redirect(req.get('referer'));
                        })
                        .catch(err => console.log(err));
                }
            })
        }
    });
});

// Like Photo
router.post('/like/:id', (req, res) => {
    Photo.findOne({ _id: req.params.id }, (err, photo) => {
        if(err) {
            console.log(err);
        } else {
            Photo.findOneAndUpdate({ _id: post._id }, { $push: { likes: req.user.username } }).exec();
            notes.addNewNote(req.user.username, post.author, 'Liked Photo', ' liked your photo <a href="/photos/view/' + photo._id + '">view here</a>');
            if(req.user.subscribers) {
                req.user.subscribers.forEach((sub) => {
                    notes.addNewNote(req.user.username, sub, 'Liked Photo', 'liked a photo <a href="/photos/view/' + photo._id + '">view here</a>');
                });
                res.redirect(req.get('referer'));
            } else {
                res.redirect(req.get('referer'));
            }
        }
    })
});

// Unlike Photo
router.post('/unlike/:id', (req, res) => {
    Photo.findOneAndUpdate({ _id: req.params.id }, { $pull: { likes: req.user.username } }).exec();
    res.redirect(req.get('referer'));
});

// Like Comment
router.post('/comment/like/:id', (req, res) => {
    Comment.findOne({ post_id: req.params.id }, (err, comment) => {
        if(err) {
            console.log(err);
        } else {
            Comment.findOneAndUpdate({ post_id: comment.post_id }, { $push: { likes: req.user.username } }).exec();
            notes.addNewNote(req.user.username, comment.author, 'Liked Comment', 'liked your comment <a href="/photos/view/' + comment.post_id + '">view here</a>');
            if(req.user.subscribers) {
                req.user.subscribers.forEach((sub) => {
                    notes.addNewNote(req.user.username, sub, 'Liked Comment', ' liked a comment <a href="/photos/view/' + comment.post_id + '">view here</a>');
                });
                res.redirect(req.get('referer'));
            } else {
                res.redirect(req.get('referer'));
            }
        }
    })
});

// Unlike Comment
router.post('/comment/unlike/:id', (req, res) => {
    Comment.findOneAndUpdate({ post_id: req.params.id }, { $pull: { likes: req.user.username } }).exec();
    res.redirect(req.get('referer'));
});

// Comment On Photo
router.post('/comment/:id', (req, res) => {
    Photo.findOne({ _id: req.params.id }, (err, photo) => {
        if(err) {
            console.log(err);
        } else {
            const author = req.user.username;
            const post_id = req.params.id;
            const data = req.body.commentText;

            if(!data) {
                req.flash(
                    'error_msg',
                    'Please type something'
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
                    .then(comment => {
                        notes.addNewNote(req.user.username, photo.author, 'Photo Comment', 'commented on your photo <a href="/photos/view/' + photo._id + '">View Here</a>"')
                        res.redirect(req.get('referer'));
                    })
                    .catch(err => console.log(err));
            }
        }
    });
});

// Delete Comment
router.post('/comment/delete/:id', (req, res) => {
    Comment.findOne({ _id: req.params.id }, (err, comment) => {
        if(err) {
            console.log(err);
        } else {
            Comment.findOneAndDelete({ $and: [{ author: req.user.username }, { _id: comment._id }]}, (err, comment) => {
                if(err) {
                    console.log(err);
                } else {
                    req.flash(
                        'success_msg',
                        'You deleted your comment'
                    );
                    res.redirect(req.get('referer'));
                }
            })
        }
    });
});

// Delete Photo
router.post('/delete/:id', (req, res) => {
    Photo.findOne({ _id: req.params.id }, (err, photo) => {
        if(err) {
            console.log(err);
        } else {
            const filePath = './public/uploads/' + req.user.username + '/' + photo.filename;
            fs.unlinkSync(filePath);
            Photo.findOneAndDelete({ $and: [{ author: req.user.username }, { post_id: post._id }] }, (err, photo) => {
                if(err) {
                    console.log(err);
                } else if(photo.post_id) {
                    Post.findOneAndDelete({ _id: photo.post_id }, (err) => {
                        if(err) {
                            console.log(err);
                        } else {
                            req.flash(
                                'success_msg',
                                'You Delete A Photo'
                            );
                            res.redirect(req.get('/dashboard/username'));
                        }
                    });
                }
            });
        }
    });
});

// Album Page
router.get('/albums/:id', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    Album.find({ author: req.params.id }, (err, albums) => {
        if(err) {
            console.log(err);
        } else {
            User.findOne({ username: req.params.id }, (err, user) => {
                if(err) {
                    console.log(err);
                } else {
                    Photo.find({ author: req.params.id }, (err, photos) => {
                        if(err) {
                            console.log(err);
                        } else {
                            Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                                if(err) {
                                    console.log(err);
                                } else if(md.mobile()) {
                                    res.render('/mobile/gallery', {
                                        title: user.firstname + "'s Photo Gallery",
                                        logUser: req.user,
                                        hasNotes: hasNote,
                                        photos: photos,
                                        albums: albums,
                                        user: user
                                    });
                                } else {
                                    res.render('gallery', {
                                        title: user.firstname + "'s Photo Gallery",
                                        logUser: req.user,
                                        hasNotes: hasNote,
                                        photos: photos,
                                        albums: albums,
                                        user: user
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

// View Album
router.get('/viewAlbum/:id', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    Album.findOne({ _id: req.params.id }, (err, album) => {
        if(err) {
            console.log(err);
        } else {
            Photo.find({ album: album.name}, (err, photos) => {
                if(err) {
                    console.log(err);
                } else {
                    User.findOne({ username: album.author }, (err, user) => {
                        if(err) {
                            console.log(err);
                        } else {
                            Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                                if(err) {
                                    console.log(err);
                                } else if(md.mobile()) {
                                    res.render('mobile/view_album', {
                                        title: album.name,
                                        logUser: req.user,
                                        user: user,
                                        hasNotes: hasNote,
                                        album: album,
                                        photos: photos
                                    });
                                } else {
                                    res.render('view_album', {
                                        title: album.name,
                                        logUser: req.user,
                                        user: user,
                                        hasNotes: hasNote,
                                        album: album,
                                        photos: photos
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

module.exports = router;