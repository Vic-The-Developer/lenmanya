const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

//var expressValidator = require('express-validator');
var bodyParser = require('body-parser');
var config = require('./config/database');
var path = require('path');
//const flash = require('connect-flash');
var passport = require('passport');
var mongoose = require('mongoose');
const flash = require('connect-flash');
var cors = require('cors');
const corsOptions = {
    origin: ["http://localhost:5000"],
    credentials: true, 
    optionsSuccessStatus: 200,
    methods: "GET, PUT, DELETE, PATCH, POST"
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cors(corsOptions));


// View engine setup
app.set('views', path.join(__dirname, '/pages'));
app.set('view engine', 'ejs');

// Connect to db
mongoose.connect(config.database);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('Connected to MongoDB')
});

/**
 * Session management
 */
const session = require('express-session');
// const MongoDBStore = require('connect-mongodb-session')(session);
// const store = new MongoDBStore({
//    uri: 'mongodb://Admin:VictorMwendwa@victech-media-shard-00-00.lhlgr.mongodb.net:27017,victech-media-shard-00-01.lhlgr.mongodb.net:27017,victech-media-shard-00-02.lhlgr.mongodb.net:27017/keja-connect?ssl=true&replicaSet=atlas-ksor6c-shard-0&authSource=admin&retryWrites=true&w=majority',
//    collection: 'sessions',
//    expires: 1000 * 60 * 60 * 4
// });

app.use(session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

app.use(flash());
// //cookieparser
// app.use(cookieParser('secretstring'));


// Set public folder
app.use('/images', express.static('assets/images/'));
app.use('/', express.static('assets/'));
app.use('/', express.static('routes/public/'));
app.use('/', express.static('public/'));


//Set routes
const mainSite = require("./routes/main");
// const userPages = require('./routes/users');
const adminPages = require('./routes/admin');

app.use("/", mainSite);
// app.use('/user', userPages);
app.use('/admin', adminPages);



//Handle error 404
app.all('*', (req, res) => { 
    //res.render('main/404')
    res.send("No page found")
});



app.listen(PORT, ()=>{
    console.log(`Server is running and listening on port ${PORT}`);
})
