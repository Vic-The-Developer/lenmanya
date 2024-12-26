var LocalStrategy = require('passport-local').Strategy;
// var GoogleStrategy = require('passport-google-oauth20').Strategy;
// var User = require('../models/user');
const User = require("../models/Admin");
const bcrypt = require('bcrypt');
// var Login = require('../models/logins');


// var bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
// var db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '/victor.mwendwa.18/',
//     database: 'tms'
// })
const clientID = "250874539293-oqrkfee88vi9o0hfd95eiput6veuoonp.apps.googleusercontent.com";
const clientSecret = "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";

module.exports = function (passport) {

    passport.use('local',new LocalStrategy({
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true 
        }, function (req, username, password, done) {

        User.findOne({email: username}, function (err, user) {
            if (err)
                console.log(err);

            if (!user) {
                req.flash('success', 'No user found!');
                return done(null, false, {message: 'No user found!'});
            }

            bcrypt.compare(password, user.password, function (err, isMatch) {
                if (err)
                    console.log(err);

                if (isMatch) {
                    req.flash('success', "Logged in Successfully!")
                    return done(null, user);
                } else {
                    req.flash('success', 'Wrong password!');
                    return done(null, false, {message: 'Wrong password.'});
                }
            });
        });

    }));

    //Google login passport
    // passport.use('google', new GoogleStrategy({

    //     clientID        : clientID,
    //     clientSecret    : clientSecret,
    //     callbackURL     : '/user/login/google/callback',
    //     passReqToCallback   : true

    // },
    // function(request, accessToken, refreshToken, profile, done) {

    //     // make the code asynchronous
    //     // User.findOne won't fire until we have all our data back from Google
    //     process.nextTick(function() {

    //         // try to find the user based on their google id
    //         User.findOne({ email: profile.emails[0].value }, function(err, user) {
    //             if (err)
    //                 return done(err);
            
    //             if (user) {
    //                 // Update user information if needed
    //                 user.fname = profile.name.givenName + " " + profile.name.familyName;
    //                 console.log('2', user)
            
    //                 // save the user
    //                 user.save(function(err) {
    //                     if (err)
    //                         throw err;
    //                     request.flash('success', 'Login successful!')
    //                     return done(null, user);
    //                 });
    //             } else {
    //                 function generateApartmentId() {
    //                     return uuidv4();
    //                 }
    //                 // Generate a unique apartment ID
    //                 var Id = generateApartmentId();

    //                 console.log(profile)

    //                 // Create a new user if not found
    //                 let newUser = new User();
    //                 newUser.fname = profile.name.givenName + " " + profile.name.familyName;
    //                 newUser.email = profile.emails[0].value;
    //                 newUser.jDate = new Date().toISOString();
    //                 newUser.admin = '1';
    //                 newUser.Id = Id;
    //                 newUser.isAdmin = 'false';
    //                 newUser.suspended = "false";
            
    //                 // save the user
    //                 newUser.save(function(err) {
    //                     if (err)
    //                         throw err;
    //                     request.flash('success', 'Login successful & Updated!')
    //                     return done(null, newUser);
    //                 });
    //             }
    //         });
    //     });

    // }));

    passport.serializeUser(function (user, done) {
        done(null, user._id);
    });

    passport.deserializeUser(function (id, done) {
        // var sql = `SELECT * FROM customers WHERE customerID = ?;`;
        // db.query(sql, id, (err, user)=>{
        //     done(err, user);
        // })

        User.findById(id, function (err, user) {
            done(err, user);
        });
    });

}