var express = require("express");

// const Blogs = require('../models/blog');


const fs = require("fs");
const fs2 = require("fs").promises;
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const Admin = require("../models/Admin");

var router = express.Router();
const { check, body, validationResult } = require("express-validator");
const flash = require("connect-flash");
var passport = require('passport');
const randtoken = require("rand-token");
const bcrypt = require('bcrypt');
const { title } = require("process");
router.use(flash());



/**
 * Login Page
 */
router.get('/login', (req, res)=>{
  const successMessage = req.flash('success');

  res.render('dash/login', {
    successMessage
  })
})

//post login code
router.post('/login', [
  // Validate email and password
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required'),
], (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    req.flash('success', errorMessages);
    return res.redirect('/admin/login');
  }

  // If validation passes, proceed to authentication
  passport.authenticate('local', {
    successRedirect: '/admin/dash',
    failureRedirect: '/admin/login',
    failureFlash: true,
  })(req, res, next);
});

router.get('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }

    req.flash('success', 'You are logged out!');
    res.redirect('/admin/login');
  });
});


/**
 * Reset Page
 */
router.get('/reset', (req, res)=>{
  res.render('dash/reset')
})

router.post("/reset", (req, res) => {
  const emailSender = "webmailservices001@gmail.com"; // Your email
  const emailPass = "jiavpmqyfoauqbvw"; // App-specific password or email password
  var { email } = req.body;

  // Validate email
  if (!email) {
    req.flash("error", "Please provide a valid email address.");
    return res.redirect("/reset");
  }

  // Function to send the email
  async function sendEmail(recipientEmail, resetCode) {
    try {
      // Nodemailer transporter
      let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // TLS enabled
        auth: {
          user: emailSender,
          pass: emailPass,
        },
      });

      // Email options
      let mailOptions = {
        from: emailSender,
        to: recipientEmail,
        subject: "Admin Password Reset Request - Lenmanya Adventures",
        html: `
          <p>You requested a password reset.</p>
          <p>Click this <a href="http://localhost:5000/admin/new_pass?code=${resetCode}&email=${email}">link</a> to reset your password.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
      };

      let info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending email:", error);
      return false;
    }
  }

  // Find user/admin with the provided email
  Admin.findOne({ email: email }).exec(async (err, user) => {
    if (err) {
      console.error(err);
      req.flash("error", "An error occurred. Please try again.");
      return res.redirect("/admin/reset");
    }

    if (!user) {
      req.flash("error", "The provided email is not registered with us.");
      return res.redirect("/admin/reset");
    }

    // Generate a random reset code
    const resetCode = randtoken.generate(6); // A 6-character reset code

    // Send email with the reset code and reset link
    const emailSent = await sendEmail(email, resetCode);

    if (emailSent) {
      // Save reset code to the database for the user
      user.resetCode = resetCode;
      user.save((err) => {
        if (err) {
          console.error("Failed to save reset code:", err);
          req.flash("error", "Failed to process the reset request.");
          return res.redirect("/admin/reset");
        }

        req.flash("success", "Reset code has been sent to your email.");
        return res.redirect("/admin/reset");
      });
    } else {
      req.flash("error", "Failed to send the reset email. Try again later.");
      return res.redirect("/admin/reset");
    }
  });
});



/**
 * New password Page
 */
router.get('/new_pass', (req, res)=>{
  res.render('dash/newPass')
})

router.post("/new_pass", (req, res) => {
  const token = req.query.token; // Reset token from the link
  const email = req.query.email; // Email from the link
  const password = req.body.password; // New password from the form

  if (!token || !password) {
    req.flash("error", "Invalid request. Missing reset code or password.");
    return res.redirect("/admin/login"); // Redirect if input is invalid
  }

  // Step 1: Find the user by reset token
  Admin.findOne({ email: email, resetCode: token }).exec((err, user) => {
    if (err) {
      console.error("Error finding user by reset code:", err);
      req.flash("error", "An error occurred. Please try again.");
      return res.redirect("/admin/login");
    }

    if (!user) {
      req.flash("error", "Invalid or expired reset code.");
      return res.redirect("/admin/login");
    }

    // Step 2: Hash the new password
    const saltRounds = 10;
    bcrypt.genSalt(saltRounds, (err, salt) => {
      if (err) {
        console.error("Error generating salt:", err);
        req.flash("error", "An error occurred while processing your request.");
        return res.redirect("/admin/login");
      }

      bcrypt.hash(password, salt, (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
          req.flash("error", "Failed to update password. Try again.");
          return res.redirect("/admin/login");
        }

        // Step 3: Update password and remove reset token
        Admin.findOneAndUpdate(
          { email: user.email },
          { $set: { password: hash }, $unset: { resetCode: "" } },
          { new: true }
        ).exec((err, updatedUser) => {
          if (err) {
            console.error("Error updating password:", err);
            req.flash("error", "Failed to update your password.");
            return res.redirect("/admin/login");
          }

          console.log("Password updated successfully for:", updatedUser.email);
          req.flash("success", "Your password has been reset successfully.");
          res.redirect("/admin/login"); // Redirect to login page
        });
      });
    });
  });
});



/**
 * Main Dashboard
 */
router.get('/dash', (req, res)=>{
  res.render('dash/dash', {
    title: "Dashboard Overview | Lenmanya Adventures",
    currentPath: '/admin/dash'
  })
})


/**
 * Manage blogs
 */
router.get('/packages', (req, res)=>{
  res.render('dash/packages', {
    title: 'Manage Packages | Lenmanya Adventures',
    currentPath: '/admin/packages'
  })
})

/**
 * Manage blogs
 */
router.get('/manage-Enquiries', (req, res)=>{
  res.render('dash/manage_enquiries', {
    title: 'Manage Enquiries | Lenmanya Adventures',
    currentPath: '/admin/manage-Enquiries'
  })
})

/**
 * Manage blogs
 */
router.get('/manage-blogs', (req, res)=>{
  res.render('dash/manage_blog', {
    title: 'Manage Blogs | Lenmanya Adventures',
    currentPath: '/admin/manage-blogs'
  })
})


/**
 * Account Page
 */
router.get('/account', (req, res)=>{
  res.render('dash/account', {
    title: 'Account | Lenmanya Adventures',
    currentPath: '/admin/account'
  })
})


/**
 * Create Blog
 */
router.get('/create-blog', (req, res)=>{
  res.render('dash/create_blog', {
    title: 'Create Blog Post | Lenmanya Adventures',
    currentPath: '/admin/create-blog'
  })
})

/**
 * Edit Blog
 */


// router.get("/dash/:page", async (req, res) => {

//   //if not logged in
//   if (req.user == undefined || req.user.admin != 0) res.redirect('/user/login');

//   try {
//     // Get total users, properties, suspended listings, featured listings

//     // get paginated results
//     const perPage = 2;
//     const page = parseInt(req.params.page) || 1;

//     // find featured listings
//     const featuredListings = await Apartment.find({ sponsored: 'true' })
//       .skip((perPage * page) - perPage)
//       .limit(perPage)
//       .exec();

//     console.log('Paginated listings', featuredListings);

//     // get total pages and total Apartment
//     const totalListings = await Apartment.countDocuments({});
//     const pages = Math.ceil(totalListings / perPage);

//     //get sponsored listings
//     const sponsTot = await Apartment.countDocuments({sponsored: 'true'});
//     console.log('sponsored', sponsTot);

//     // Get total users
//     const totalUsers = await User.countDocuments({});

//     console.log('Users total', totalUsers);

//     // get total suspended listings
//     const totalSuspendedListings = await Apartment.countDocuments({ disabled: 'true' });

//     console.log('Suspended total', totalSuspendedListings);

//     // Get Search Terms
//     // const topLocations = await SearchTerms.aggregate([
//     //   { $group: { _id: '$loc', count: { $sum: 1 } } },
//     //   { $sort: { count: -1 } },
//     //   { $limit: 5 },
//     // ]);

//     // const topApartmentTypes = await SearchTerms.aggregate([
//     //   { $group: { _id: '$appaType', count: { $sum: 1 } } },
//     //   { $sort: { count: -1 } },
//     //   { $limit: 5 },
//     // ]);

//     // const topMaxBudgets = await SearchTerms.aggregate([
//     //   { $group: { _id: '$maxBudget', count: { $sum: 1 } } },
//     //   { $sort: { count: -1 } },
//     //   { $limit: 5 },
//     // ]);

//     const successMessage = req.flash("success");

//     // render the view
//     res.render('dash/dash', {
//       title: 'Main Dashboard | Keja Connect',
//       apart: featuredListings,
//       current: page,
//       pages,
//       usersTot: totalUsers,
//       apartTot: totalListings,
//       suspendedTot: totalSuspendedListings,
//       successMessage,
//       sponsTot
//       // topLocations,
//       // topApartmentTypes,
//       // topMaxBudgets,
//     });
//   } catch (err) {
//     console.error(err);
//     req.flash('success', "Error in quering data");
//     res.redirect('/')
//   }

//   // res.render("dash/dash", {
//   //   title: "Main Dashboard | Keja Connect",
//   // });
// });



// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Append current timestamp to make the filename unique
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `${timestamp}${extension}`);
  },
});

const upload = multer({ storage: storage });

function generateApartmentId() {
  return uuidv4();
}

router.post(
  "/properties_add",
  upload.array("images"), // 'images' is the field name for the images in the form
  [
    // Validate the data using express-validator
    body("capName").notEmpty().withMessage("Caption/Name cannot be empty"),
    body("buildingName")
      .notEmpty()
      .withMessage("Building name cannot be empty"),
    body("loc").notEmpty().withMessage("Location cannot be empty"),
    body("specLoc").notEmpty().withMessage("Specific location cannot be empty"),
    body("rent").isNumeric().withMessage("Rent must be a numeric value"),
    body("deposit").isNumeric().withMessage("Deposit must be a numeric value"),
    body("desc").notEmpty().withMessage("Description cannot be empty"),
    body("amenities").notEmpty().withMessage("Amenities must be a list"),
    body("appaType").notEmpty().withMessage("Apartment type cannot be empty"),
    body("transType")
      .notEmpty()
      .withMessage("Transaction type cannot be empty"),
    body("beds").notEmpty().withMessage("Beds must have a value"),
    body("baths").notEmpty().withMessage("Baths must have a value"),
    body("agentName").notEmpty().withMessage("Agent name cannot be empty"),
    body("agentPhone")
      .isMobilePhone()
      .matches(/^(?:\+254|07|01)[0-9]\d*$/)
      .withMessage("Invalid phone number format"),
    body("booked").notEmpty().withMessage("Booked must have a boolean value"),
    body("sponsored")
      .notEmpty()
      .withMessage("Sponsored must be a boolean value"),
    // Custom validator for checking the maximum number of images
    body("images").custom((images) => {
      if (!Array.isArray(images) || images.length >= 10) {
        // Check if images is undefined or not an array
        const imagesLength = Array.isArray(images) ? images.length : 0;
    
        console.log(imagesLength);
        
        if (imagesLength >= 10) {
          throw new Error("Maximum of 9 images allowed");
        }
      }
      return true;
    }),
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    console.log('errors', errors)
    if (!errors.isEmpty()) {
      req.flash(
        "success",
        errors.array().map((error) => error.msg)
      );
      return res.redirect("/admin/properties_add");
    }

    // Check if the buildingName already exists
    const existingApartment = await Apartment.findOne({
      buildingName: buildingName,
    });
    if (existingApartment) {
      req.flash(
        "success",
        "Apartment with the same building name already exists"
      );
      return res.redirect("/admin/properties_add");
    }

    // Extract validated parameters from the request body
    var capName = req.body.capName;
    var buildingName = req.body.buildingName;
    var loc = req.body.loc;
    var specLoc = req.body.specLoc;
    var rent = parseInt(req.body.rent);
    var deposit = req.body.deposit;
    var desc = req.body.desc;
    var amenities = req.body.amenities;
    var appaType = req.body.appaType;
    var transType = req.body.transType;
    var beds = req.body.beds;
    var baths = req.body.baths;
    var agentName = req.body.agentName;
    var agentPhone = req.body.agentPhone;
    var booked = req.body.booked;
    var sponsored = req.body.sponsored;
    var disabled = req.body.disabled;
    var uDate = new Date().toISOString(); //uploaded date

    // Calculate sponsorFrom as the current date in ISO format
    var sponsorFrom = new Date().toISOString();
    let sponsorTo;

    if (sponsored == "true") {
      // Calculate sponsorTo based on sponsorFrom and the received number of days
      const sponsorToDays = parseInt(req.body.sponsorTo);
      if (sponsorToDays) {
        const sponsorFromDate = new Date(sponsorFrom);
        sponsorFromDate.setDate(
          sponsorFromDate.getDate() + parseInt(sponsorToDays, 10)
        );
        sponsorTo = sponsorFromDate.toISOString();
      } else {
        sponsorTo = "N/A"; // or set a default value if needed
      }
    } else {
      console.log("Apartment is not sponsored!");
    }

    // Extract image file paths from the uploaded files
    var images = req.files.map((file) => `/uploads/${file.filename}`);

    // Generate a unique apartment ID
    const Id = generateApartmentId();

    try {
      // Example: Save to MongoDB
      const newApartment = new Apartment({
        Id,
        capName,
        buildingName,
        loc,
        specLoc,
        rent,
        deposit,
        desc,
        amenities,
        appaType,
        transType,
        beds,
        baths,
        agentName,
        agentPhone,
        booked,
        sponsored,
        sponsorFrom,
        sponsorTo,
        disabled,
        images,
        uDate,
      });

      await newApartment.save();

      req.flash("success", "Apartment added successfully");
      res.redirect("/admin/properties_add");
    } catch (err) {
      console.error(err);
      req.flash("success", "Error adding apartment");
      res.redirect("/admin/properties_add");
    }
  }
);


module.exports = router;
