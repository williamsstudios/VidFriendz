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
const Album = require('../models/Album');
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

// New Post
router.post('/new/:id', upload.single('image'), (req, res, next) => {
    const author = req.user.username;
    const account_name = req.params.id;
    const privacy = req.body.privacy;
    const data = req.body.postText;
    const file = req.file;  

    if(!data) {
        req.flash(
            'error_msg',
            'Please type something first'
        );
        res.redirect(req.get('referer'));
    } else if(!file) {
        let newPost = new Post({
            author: author,
            account_name: account_name,
            data: data,
            privacy: privacy,
            image: "",
            video: ""
        });

        newPost
            .save()
            .then(post => {
                res.redirect(req.get('referer'));
            })
            .catch(err => console.log(err));
    } else {
        const file_extension = file.filename.slice(
            ((file.filename.lastIndexOf('.') - 1) >>> 0) + 2
        );
        if(file_extension == 'png' || file_extension == 'jpg' || file_extension == 'jpeg') {
            let newPost = new Post({
                author: author,
                account_name: account_name,
                data: data,
                privacy: privacy,
                image: file.filename,
                video: ""
            });
    
            newPost
                .save()
                .then(post => {
                    Album.findOne({ $and: [{ author: req.user.username }, { name: "Feed Photos" }] }, (err, albumExists ) => {
                        if(err) {
                            console.log(err);
                        } else if(albumExists) {
                            let newPhoto = new Photo({
                                author: author,
                                filename: file.filename,
                                post_id: newPost._id,
                                album: "Feed Photos",
                                description: data,
                                privacy: privacy
                            });

                            newPhoto
                                .save()
                                .then((photo) => {
                                    Album.findOneAndUpdate({ name: "Feed Photos" }, { $push: { photos: newPhoto._id } }).exec();
                                    res.redirect(req.get('referer'));
                                })
                                .catch(err => console.log(err));
                        } else {
                            let newAlbum = new Album({
                                author: req.user.username,
                                name: "Feed Photos"
                            });

                            newAlbum
                                .save()
                                .then(newAlbum => {
                                    let newPhoto = new Photo({
                                        author: author,
                                        filename: file.filename,
                                        post_id: newPost._id,
                                        album: "Feed Photos",
                                        description: data,
                                        privacy: privacy
                                    });

                                    newPhoto
                                        .save()
                                        .then(photo => {
                                            Album.findOneAndUpdate({ $and: [{ author: req.user.username }, { name: "Feed Photos" }] }, { $push: { photos: newPhoto._id } }, (err) => {
                                                if(err) {
                                                    console.log(err);
                                                } else {
                                                    res.redirect(req.get('referer'));
                                                }
                                            });
                                        })
                                        .catch(err => console.log(err));
                                })
                        }
                    });
                })
                .catch(err => console.log(err));
        } else if(file_extension == 'mp4' || file_extension == 'avi') {
            let newPost = new Post({
                author: author,
                account_name: account_name,
                data: data,
                privacy: privacy,
                image: "",
                video: file.filename
            });
    
            newPost
                .save()
                .then(post => {
                    let newVideo = new Video({
                        author: req.user.username,
                        post_id: newPost._id,
                        filename: file.filename,
                        description: data,
                        privacy: newPost.privacy
                    });

                    newVideo
                        .save()
                        .then(video => {
                            res.redirect(req.get('referer'));
                        })
                        .catch(err => console.log(err));
                    
                })
                .catch(err => console.log(err));
        }
    }
});

// Share Post
router.post('/share/:id', (req, res) => {
    Post.findOne({ _id: req.params.id }, (err, post) => {
        if(err) {
            console.log(err);
        } else {
            User.findOne({ username: post.author }, (err, postUser) => {
                if(err) {
                    console.log(err);
                } else {
                    let newPost = new Post({
                        author: req.user.username,
                        account_name: post.author,
                        data: post.data,
                        image: post.image,
                        video: post.video,
                        action: "shared" + postUser.firstname + postUser.lastname + "'s post"
                    });
        
                    newPost
                        .save()
                        .then(newPost => {
                            notes.addNewNote(req.user.username, post.author, "Post Share", 'shared your post <a href="/posts/view/' + post._id + '">view here</a>');
                            req.flash(
                                'success_msg',
                                'You shared a post'
                            );
        
                            res.redirect(req.get('referer'));
                        })
                        .catch(err => console.log(err));
                }
            });
        }
    });
});

// View Post Page
router.get('/view/:id', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    Post.findOne({ _id: req.params.id }, (err, post) => {
        if(err) {
            console.log(err);
        } else {
            User.findOne({ username: post.author }, (err, postUser) => {
                if(err) {
                    console.log(err);
                } else {
                    Comment.aggregate([
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
                                res.render('mobile/view_post', {
                                    title: postUser.firstname + ' ' + postUser.lastname + ' Post',
                                    logUser: req.user,
                                    hasNotes: hasNote,
                                    helper: helper,
                                    comments: comments,
                                    post: post,
                                    postUser: postUser
                                });
                            } else {
                                res.render('view_post', {
                                    title: postUser.firstname + ' ' + postUser.lastname + ' Post',
                                    logUser: req.user,
                                    hasNotes: hasNote,
                                    helper: helper,
                                    comments: comments,
                                    post: post,
                                    postUser: postUser
                                });
                            }
                        });
                    }).catch(err => console.log(err));
                }
            });
        }
    });
});

// Post Edit Page
router.get('/edit', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);

    if(md.mobile()) {
        res.render('mobile/edit_post', {
            title: 'Edit Post',
            logUser: req.user,
            hasNotes: ""
        });
    } else {
        res.redirect('/');
    }
});

// Like Post
router.post('/like/:id', (req, res) => {
    Post.findOne({ _id: req.params.id }, (err, post) => {
        if(err) {
            console.log(err);
        } else {
            Post.findOneAndUpdate({ _id: post._id }, { $push: { likes: req.user.username } }).exec();
            notes.addNewNote(req.user.username, post.author, 'Liked Post', ' liked your post <a href="/posts/view/' + post._id + '">view here</a>');
            if(req.user.subscribers) {
                req.user.subscribers.forEach((sub) => {
                    notes.addNewNote(req.user.username, sub, 'Liked Post', ' liked a post <a href="/posts/view/' + post._id + '">view here</a>');
                });
                res.redirect(req.get('referer'));
            } else {
                res.redirect(req.get('referer'));
            }
        }
    })
});

// Unlike Post
router.post('/unlike/:id', (req, res) => {
    Post.findOneAndUpdate({ _id: req.params.id }, { $pull: { likes: req.user.username } }).exec();
    res.redirect(req.get('referer'));
});

// Delete Post
router.post('/delete/:id', (req, res) => {
    Post.findOne({ _id: req.params.id }, (err, post) => {
        if(err) {
            console.log(err);
        } else if(post.image != "") {
            const filePath = './public/uploads/' + req.user.username + '/' + post.image;
            fs.unlinkSync(filePath);
            Photo.findOneAndDelete({ post_id: post._id }, (err, photo) => {
                if(err) {
                    console.log(err);
                } else {
                    Album.findOneAndUpdate({ $and: [{ author: req.user.username }, { name: photo.album }] }, { $pull: { photos: photo._id } }, (err) => {
                        if(err) {
                            console.log(err);
                        } else {
                            Post.findOneAndDelete({ _id: req.params.id }, (err) => {
                                if(err) {
                                    console.log(err);
                                } else {
                                    res.redirect(req.get('referer'));
                                }
                            });
                        }
                    })
                    
                }
            });
        } else if(post.video != "") {
            const filePath = './public/uploads/' + req.user.username + '/' + post.video;
            fs.unlinkSync(filePath);
            Video.findOneAndDelete({ post_id: post._id }, (err, video) => {
                if(err) {
                    console.log(err);
                } else {
                    Post.findOneAndDelete({ _id: req.params.id }, (err) => {
                        if(err) {
                            console.log(err);
                        } else {
                            res.redirect(req.get('referer'));
                        }
                    });
                }
            });
        } else {
            Post.findByIdAndDelete({ _id: req.params.id }, (err) => {
                if(err) {
                    console.log(err);
                } else {
                    res.redirect(req.get('referer'));
                }
            })
        } 
    })
});

// Comment Function
router.post('/comment/:id', (req, res) => {
    Post.findOne({ _id: req.params.id }, (err, post) => {
        if(err) {
            console.log(err);
        } else {
            const author = req.user.username;
            const account_name = post.author;
            const data = req.body.commentText;
            const post_id = req.params.id;

            if(!data) {
                req.flash(
                    'error_msg',
                    'Please Type Something First'
                );
                res.redirect(req.get('referer'));
            } else {
                let newComment = new Comment({
                    author: author,
                    account_name: account_name,
                    data: data,
                    post_id: post_id
                });

                newComment
                    .save()
                    .then(comment => {
                        notes.addNewNote(req.user.username, post.author, "Post Comment", ' commented on your post <a href="/posts/view/' + post._id + '">view here</a>')
                        res.redirect(req.get('referer'));
                    })
                    .catch(err => console.log(err));
            }
        }
    });
});

// Like Comment Function
router.post('/likeComment/:id', (req, res) => {
    Comment.findOne({ _id: req.params.id }, (err, comment) => {
        if(err) {
            console.log(err);
        } else {
            Comment.findOneAndUpdate({ _id: comment._id }, { $push: { likes: req.user.username } }).exec();
            notes.addNewNote(req.user.username, comment.author, 'Liked Comment', ' liked your comment <a href="/posts/view/' + comment.post_id + '">view here</a>');
            if(req.user.subscribers) {
                req.user.subscribers.forEach((sub) => {
                    notes.addNewNote(req.user.username, sub, 'Liked Comment', ' liked a comment <a href="/posts/view/' + comment.post_id + '">view here</a>');
                });
                res.redirect(req.get('referer'));
            } else {
                res.redirect(req.get('referer'));
            }
        }
    })
});

// UnLike Comment Function
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