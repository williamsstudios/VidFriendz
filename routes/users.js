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

// Load Models
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

router.get('/signup', forwardAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);

    if(md.mobile()) {
        res.render('mobile/signup', {
            title: 'Sign Up For Free',
            logUser: "",
            hasNotes: ""
        });
    } else {
        res.redirect('../index');
    }
});
    
// Sign Up Function
router.post('/signup', (req, res) => {
    const { firstname, lastname, username, reg_email, pass, pass2, gender, country, birthday } = req.body;
    let errors = [];

    if(!firstname || !lastname || !username || !reg_email || !pass || !pass2 || !gender || !country || !birthday) {
        errors.push({ msg: 'All Fields Required' });
    }
    if(pass != pass2) {
        errors.push({ msg: 'Your Password Fields Do Not Match' });
    }
    if(pass.length < 7) {
        errors.push({ msg: 'Passwords Should Be 7 characters or longer' });
    }
    if(username.length < 3 || username.length > 32) {
        errors.push({ msg: 'Usernames should be between 3 and 32 characters' });
    }
    if(errors.length > 0) {
        res.render('signup', {
            title: 'Sign Up',
            logUser: '',
            errors: errors
        });
    } else {
        let newUser = new User({
            firstname: firstname,
            lastname: lastname,
            username: username,
            email: reg_email,
            password: pass,
            gender: gender,
            country: country,
            birthday: birthday
        });


        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(newUser.password, salt, (err, hash) => {
                if (err) throw err;
                newUser.password = hash;
                newUser
                    .save()
                    .then(user => {
                        fs.mkdir("./public/uploads/" + newUser.username, function(err) {
                            if (err) {
                                console.log(err)
                            } else {
                                req.flash(
                                    'success_msg',
                                    'Account Created You May Now Login'
                                );
                                res.redirect(req.get('referer'));
                            }
                        })
                    })
                    .catch(err => console.log(err));
            });
        });
    }
});

// Log In Function
router.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/users/dashboard',
        failureRedirect: '/',
        failureFlash: true
    })(req, res, next);

});

// Log Out Function
router.get('/logout', (req, res) => {
    req.logout();
    req.flash('success_msg', 'You are logged out');
    res.redirect('/');
});

// Dashboard Page
router.get('/dashboard', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    Post.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "author",
                foreignField: "username",
                as: "posts"
            }
        },
        {
            $unwind: "$posts"
        },
        {
            $sort: { date_made: -1 }
        }
    ]).then(posts => {
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
            },
            {
                $limit: 5
            }
        ]).then(comments => {
            Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                if(err) {
                    console.log(err);
                } else {
                    User.find({ username: { $ne: req.user.username} }, (err, moreUsers) => {
                        if(err) {
                            console.log(err);
                        } else if(md.mobile()) {
                            res.render('mobile/dashboard', {
                                title: 'VidFriendz - Dashboard',
                                logUser: req.user,
                                hasNotes: hasNote,
                                posts: posts,
                                moreUsers: moreUsers,
                                helper: helper,
                                comments: comments
                            });
                        } else {
                            res.render('dashboard', {
                                title: 'VidFriendz - Dashboard',
                                logUser: req.user,
                                hasNotes: hasNote,
                                posts: posts,
                                moreUsers: moreUsers,
                                helper: helper,
                                comments: comments
                            });
                        }
                    });
                }
            });
        }).catch(err => console.log(err));
    }).catch(err => console.log(err));
});

// Explore Users
router.get('/explore', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    User.find({  }, (err, moreUsers) => {
        if(err) {
            console.log(err);
        } else {
            Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                if(err) {
                    console.log(err);
                } else if(md.mobile()) {
                    res.render('mobile/explore_users', {
                        title: 'Explore VidFriendz',
                        logUser: req.user,
                        moreUsers: moreUsers,
                        hasNotes: hasNote
                    });
                } else {
                    res.render('explore_users', {
                        title: 'Explore VidFriendz',
                        logUser: req.user,
                        moreUsers: moreUsers,
                        hasNotes: hasNote
                    });
                }
            });
        }
    });
});

// Notes Page
router.get('/notes', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    Note.updateMany({ receiver: req.user.username }, { did_read: true }).exec();
    Note.aggregate([
        { $match: { receiver: req.user.username } },
        {
            $lookup: {
                from: "users",
                localField: "initator",
                foreignField: "username",
                as: "mynotes"
            }
        },
        {
            $unwind: "$mynotes"
        }
    ]).then(mynotes => {
        Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
            if(err) {
                console.log(err);
            } else if(md.mobile()) {
                res.render('mobile/notes', {
                    title: 'VidFriendz - Notifications',
                    logUser: req.user,
                    hasNotes: hasNote,
                    helper: helper,
                    mynotes: mynotes
                });
            } else {
                res.render('notes', {
                    title: 'VidFriendz - Notifications',
                    logUser: req.user,
                    hasNotes: hasNote,
                    helper: helper,
                    mynotes: mynotes
                });
            }
        });
    }).catch(err => console.log(err));
});

// Mark Note As Read
router.post('/notes/markasread/:id', (req, res) => {
    notes.markasread(req.params.id);
    if("success") {
        req.flash(
            'success_msg',
            'Note Marked As Read'
        );
        res.redirect(req.get('referer'));
    } else {
        req.flash(
            'error_msg',
            'Oops Something Went Wrong'
        );
        res.redirect(req.get('referer'));
    }
});

// Delete Note
router.post('/notes/delete/:id', (req, res) => {
    Note.findOneAndDelete({ _id: req.params.id }).exec();
    res.redirect(req.get('referer'));
});

// Subscribe To User
router.post('/sub/:id', (req, res) => {
    User.findOne({ _id: req.params.id }, (err, user) => {
        if(err) {
            console.log(err);
        } else {
            User.findOneAndUpdate({ _id: req.params.id }, { $push: { subscribers: req.user.username } }).exec();
            User.findOneAndUpdate({ _id: req.user.id }, { $push: { subscriptions: user.username } }).exec();
            notes.addNewNote(req.user.username, user.username, "New Sub", "subscribed to your channel");
            
            Convo.findOne({ $or: [{ $and: [{ user1: req.user.username }, { user2: req.params.id }] }, { $and: [{ user1: req.params.id }, { user2: req.user.username }] }] }, (err, convoExist) => {
                if(err) {
                    console.log(err);
                } else if(!convoExist) {
                    let newConvo = new Convo({
                        user1: req.user.username,
                        user2: user.username
                    });

                    newConvo
                        .save()
                        .then((newConvo) => {
                            let newMessage = new Message({
                                senderId: req.user.username,
                                receiverId: user.username,
                                convo_id: newConvo._id,
                                message: 'Subscribed To This User'
                            });

                            newMessage
                                .save()
                                .then((newMessage) => {
                                    Convo.findOneAndUpdate({ _id: newConvo._id }, { $push: { messages: newMessage._id } }).exec();
                                    Convo.findOneAndUpdate({ _id: newConvo._id }, { hasNewMessages: true }).exec();
                                    req.flash(
                                        'success_msg',
                                        'You subscribed to this user'
                                    );
                                    res.redirect(req.get('referer'));
                                })
                                .catch(err => console.log(err));
                        })
                        .catch(err => console.log(err));
                } else {
                    req.flash(
                        'success_msg',
                        'You subscribed to this user'
                    );
                    res.redirect(req.get('referer'));
                }
            })
        }
    })
});

// Unsubscribe To User
router.post('/unsub/:id', (req, res) => {
    User.findOne({ _id: req.params.id }, (err, user) => {
        if(err) {
            console.log(err);
        } else {
            User.findOneAndUpdate({ _id: req.params.id }, { $pull: { subscribers: req.user.username } }).exec();
            User.findOneAndUpdate({ _id: req.user.id }, { $pull: { subscriptions: user.username } }).exec();
            req.flash(
                'success_msg',
                'You unsubscribed from this user'
            );
            res.redirect(req.get('referer'));
        }
    })
});

// Profile Page
router.get('/:id', ensureAuthenticated, (req, res) => {
    const md = new MobileDetect(req.headers['user-agent']);
    User.findOne({ username : req.params.id }, (err, user) => {
        if(err) {
           console.log(err);
        } else {
            Post.aggregate([
                { $match: { $or: [{ author: user.username }, { account_name: user.username }] } },
                {
                    $lookup: {
                        from: "users",
                        localField: "author",
                        foreignField: "username",
                        as: "posts"
                    }
                },
                {
                    $unwind: "$posts"
                },
                {
                    $sort: { date_made: -1 }
                }
            ]).then((posts) => {
                Video.find({ $and: [{ author: user.username }, { privacy: 0 }] }, (err, videos) => {
                    if(err) {
                        console.log(err);
                    } else {
                        Photo.find({ $and: [{ author: user.username }, { privacy: 0 }] }, (err, photos) => {
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
                                    },
                                    {
                                        $limit: 5
                                    }
                                ]).then(comments => {
                                    Note.find({ $and: [{ receiver: req.user.username }, { did_read: false }] }, (err, hasNote) => {
                                        if(err) {
                                            console.log(err);
                                        } else if(md.mobile()) {
                                            res.render('mobile/profile', {
                                                title: user.firstname + ' ' + user.lastname,
                                                logUser: req.user,
                                                user: user,
                                                posts: posts,
                                                videos: videos,
                                                photos: photos,
                                                hasNotes: hasNote,
                                                helper: helper,
                                                comments: comments
                                            });
                                        } else {
                                            res.render('profile', {
                                                title: user.firstname + ' ' + user.lastname,
                                                logUser: req.user,
                                                user: user,
                                                posts: posts,
                                                videos: videos,
                                                photos: photos,
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
        }
    });
});

// Edit Profile Picture
router.post('/edit/avatar', upload.single('avatar'), (req, res) => {
    const avatar = req.file;

    if(!avatar) {
        req.flash(
            'error_msg',
            'Please select an image'
        );
        res.redirect(req.get('referer'));
    } else {
        let updateAvatar = {
            avatar: avatar.filename
        };

        let query = { username: req.user.username }

        User.updateMany(query, updateAvatar, (err) => {
            if(err) {
                console.log(err);
            } else {
                req.flash(
                    'success_msg',
                    'Profile Picture Updated'
                );
                res.redirect(req.get('referer'));
            }
        })
    }
});

// Edit Cover Picture
router.post('/edit/cover', upload.single('cover'), (req, res) => {
    const cover = req.file;

    if(!cover) {
        req.flash(
            'error_msg',
            'Please select an image'
        );
        res.redirect(req.get('referer'));
    } else {
        let updateCover = {
            cover_pic: cover.filename
        };

        let query = { username: req.user.username }

        User.updateMany(query, updateCover, (err) => {
            if(err) {
                console.log(err);
            } else {
                req.flash(
                    'success_msg',
                    'Cover Picture Updated'
                );
                res.redirect(req.get('referer'));
            }
        })
    }
});

// Edit Name
router.post('/edit/name', (req, res) => {
    const firstname = req.body.firstname;
    const lastname = req.body.lastname;

    if(!firstname || !lastname) {
        req.flash(
            'error_msg',
            'First And Last names are required'
        );
        res.redirect(req.get('referer'));
    } else {
        let updateName = {
            firstname: firstname,
            lastname: lastname
        };

        let query = { username: req.user.username }

        User.updateMany(query, updateName, (err) => {
            if(err) {
                console.log(err);
            } else {
                req.flash(
                    'success_msg',
                    'Name Updated'
                );
                res.redirect(req.get('referer'));
            }
        });
    }
});

// Edit Location
router.post('/edit/location', (req, res) => {
    const city = req.body.city;
    const state = req.body.state;
    const country = req.body.country;

    if(!country) {
        req.flash(
            'error_msg',
            'Country is required'
        );
        res.redirect(req.get('referer'));
    } else {
        let updateLocation = {
            city: city,
            state: state,
            country: country
        };

        let query = { username: req.user.username }

        User.updateMany(query, updateLocation, (err) => {
            if(err) {
                console.log(err);
            } else {
                req.flash(
                    'success_msg',
                    'Location Updated'
                );
                res.redirect(req.get('referer'));
            }
        });
    }
});

// Edit Bio
router.post('/edit/bio', (req, res) => {
    const bio = req.body.bio;

    if(!bio) {
        req.flash(
            'error_msg',
            'Bio is required'
        );
        res.redirect(req.get('referer'));
    } else {
        let updateBio = {
            bio: bio
        };

        let query = { username: req.user.username }

        User.updateMany(query, updateBio, (err) => {
            if(err) {
                console.log(err);
            } else {
                req.flash(
                    'success_msg',
                    'Bio Updated'
                );
                res.redirect(req.get('referer'));
            }
        });
    }
});



module.exports = router;