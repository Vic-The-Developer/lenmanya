exports.isUser = function(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    } else {
        req.flash('success', 'Please log in.');
        res.redirect('/login');
    }
}

exports.isAdmin = function(req, res, next) {
    if (req.isAuthenticated() && res.locals.user.amd==='admin') {
        next();
    } else {
        req.flash('success', 'Please log in as admin.');
        res.redirect('/users/login');
    }
}