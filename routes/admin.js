var express = require("express");

// const Blogs = require('../models/blog');


const fs = require("fs");
const fs2 = require("fs").promises;
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const Admin = require("../models/Admin");
const Enquiry = require("../models/Enquiry");
const Package = require('../models/Package');

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

  const successMessage = req.flash('success')[0];
  const errorMessage = req.flash('error')[0];


  res.render('dash/packages', {
    title: 'Manage Packages | Lenmanya Adventures',
    currentPath: '/admin/packages',
    successMessage,
    errorMessage
  })
})


// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "public", "packages");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Append timestamp to make the filename unique
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `${timestamp}${extension}`);
  },
});

const upload = multer({ storage: storage });

// POST route to add a new package
router.post(
  "/packages_add",
  upload.array("pImages", 5), // Limit to 5 images
  [
    // Validation rules using express-validator
    body("pTitle").notEmpty().withMessage("Package title is required"),
    body("pLoc").notEmpty().withMessage("Location is required"),
    body("pDays")
      .isInt({ min: 1 })
      .withMessage("Days must be a valid positive number"),
    body("description")
      .isLength({ min: 10 })
      .withMessage("Description must be at least 10 characters long"),
    body("price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a valid positive number"),
    body("pRating")
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage("Rating must be between 0 and 5"),
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash(
        "error",
        errors.array().map((error) => error.msg)
      );
      return res.redirect("/admin/packages");
    }

    // Extract validated data from the request body
    const { pTitle, pLoc, pDays, description, price, pRating } = req.body;

    // Extract file paths from uploaded images
    const images = req.files.map((file) => `/packages/${file.filename}`);

    try {
      // Create a new package instance
      const newPackage = new Package({
        pTitle: pTitle,
        pLoc: pLoc,
        pDays: pDays,
        description: description,
        price: price,
        pRating: pRating || 0, // Default to 0 if not provided
        pImages: images, // Save image file paths
      });

      // Save to MongoDB
      await newPackage.save();

      // Success response
      req.flash("success", "Package added successfully!");
      res.redirect("/admin/packages");
    } catch (err) {
      console.error("Error saving package:", err);
      req.flash("error", "Error adding package.");
      res.redirect("/admin/packages");
    }
  }
);


/**
 * Edit Package
 */
router.post(
  "/edit_package",
  [
    // Validation rules
    body("pTitle").notEmpty().withMessage("Title is required"),
    body("pLoc").notEmpty().withMessage("Location is required"),
    body("pDays")
      .isInt({ min: 1 })
      .withMessage("Days must be a number greater than 0"),
    body("description")
      .isLength({ min: 10 })
      .withMessage("Description must be at least 10 characters"),
    body("price")
      .isFloat({ min: 0 })
      .withMessage("Price must be a positive number"),
    body("pRating")
      .optional()
      .isFloat({ min: 0, max: 5 })
      .withMessage("Rating must be between 0 and 5"),
  ],
  async (req, res) => {
    var id = req.query.id;

    // Validate input data
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash(
        "error",
        errors.array().map((error) => error.msg)
      );
      return res.redirect("/admin/packages");
    }

    try {
      // Find the package by ID
      const packageToUpdate = await Package.findById(id);
      if (!packageToUpdate) {
        req.flash("error", "Package not found!");
        return res.redirect("/admin/packages");
      }

      // Update fields with new data (images remain untouched)
      packageToUpdate.pTitle = req.body.pTitle;
      packageToUpdate.pLoc = req.body.pLoc;
      packageToUpdate.pDays = req.body.pDays;
      packageToUpdate.description = req.body.description;
      packageToUpdate.price = req.body.price;
      packageToUpdate.pRating = req.body.pRating || packageToUpdate.pRating;

      // Save updated package to the database
      await packageToUpdate.save();

      req.flash("success", "Package updated successfully!");
      res.redirect("/admin/packages");
    } catch (error) {
      console.error("Error updating package:", error);
      req.flash("error", "Failed to update package. Please try again.");
      res.redirect("/admin/packages");
    }
  }
);

/**
 * Delete package
 */
router.get("/delete_package", async (req, res) => {
  const id = req.query.id;

  try {
    // Find the package by ID
    const packageToDelete = await Package.findById(id);

    if (!packageToDelete) {
      req.flash("error", "Package not found!");
      return res.redirect("/admin/packages");
    }

    // Delete package images from the file system
    if (packageToDelete.pImages && packageToDelete.pImages.length > 0) {
      packageToDelete.pImages.forEach((imagePath) => {
        const filePath = path.join(__dirname, "..", "public", imagePath);

        // Delete the image file if it exists
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    // Delete the package from the database
    await Package.findByIdAndDelete(id);

    req.flash("success", "Package deleted successfully!");
    res.redirect("/admin/packages");
  } catch (error) {
    console.error("Error deleting package:", error);
    req.flash("error", "Failed to delete the package. Please try again.");
    res.redirect("/admin/packages");
  }
});

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
 * Create blog
 */
router.post('/create_blog', (req, res)=>{

})

/**
 * Edit Blog
 */
router.post('/edit_blog', (req, res)=>{

})

/**
 * Delete Blog
 */
router.get('/delete_blog', (req, res)=>{
  
})

/**
 * Manage Enquiries
 */
router.get('/manage-Enquiries', (req, res)=>{

  const successMessage = req.flash('success')[0];
  const errorMessage = req.flash('error')[0];

  res.render('dash/manage_enquiries', {
    title: 'Manage Enquiries | Lenmanya Adventures',
    currentPath: '/admin/manage-Enquiries',
    successMessage,
    errorMessage
  })
})

/**
 * Toggle Resolve Enquiry
 */
router.get('/resolve_enquiry', (req, res) => {
  const enquiryId = req.query.id; // Extract ID of the enquiry from URL query options

  // Find the enquiry and toggle its status
  Enquiry.findById(enquiryId).exec((err, enquiry) => {
      if (err) {
          console.error("Error finding enquiry:", err);
          req.flash("error", "Something went wrong!");
          return res.redirect('/admin/manage-Enquiries');
      }

      if (!enquiry) {
          req.flash("error", "Enquiry not found.");
          return res.redirect('/admin/manage-Enquiries');
      }

      // Toggle the status
      const newStatus = enquiry.status === "pending" ? "resolved" : "pending";

      // Update the status in the database
      Enquiry.findByIdAndUpdate(
          enquiryId,
          { $set: { status: newStatus } },
          { new: true }
      ).exec((err, updatedEnquiry) => {
          if (err) {
              console.error("Error updating enquiry status:", err);
              req.flash("error", "Failed to update enquiry status.");
              return res.redirect('/admin/manage-Enquiries');
          }

          console.log(`Enquiry status updated to: ${newStatus}`);
          req.flash("success", `Enquiry status changed to ${newStatus}.`);
          res.redirect('/admin/manage-Enquiries');
      });
  });
});


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
 * Create blog
 */
router.post('/create_blog', (req, res)=>{

})

/**
 * Edit Blog
 */
router.post('/edit_blog', (req, res)=>{

  var id = req.query.id;

})

/**
 * Toggle publish or suspended
 */
router.get('/blog_status', (req, res)=>{

  var statusBlog = req.query.status; //suspend or publish
})

/**
 * Delete Blog
 */
router.get('/delete_blog', (req, res)=>{

  var id = req.query.id;

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



// router.get("/dash/:page", async (req, res) => {

//   //if not logged in
//   if (req.user == undefined || req.user.admin != 0) res.redirect('/user/login');

//   try {
//     // Get total users, properties, suspended listings, featured listings

//     // get paginated results
//     const perPage = 2;
//     const page = parseInt(req.query.page) || 1;

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


router.post(
  "/properties_add",
  upload.array("images"), // 'images' is the field name for the images in the form
  [
    // Validate the data using express-validator
    
    // Custom validator for checking the maximum number of images
    body("pImages").custom((images) => {
      if (!Array.isArray(images) || images.length >= 5) {
        // Check if images is undefined or not an array
        const imagesLength = Array.isArray(images) ? images.length : 0;
    
        console.log(imagesLength);
        
        if (imagesLength >= 10) {
          throw new Error("Maximum of 5 images allowed");
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
      return res.redirect("/admin/manage_packages");
    }

    // Extract validated parameters from the request body
    

    // Extract image file paths from the uploaded files
    var images = req.files.map((file) => `/uploads/${file.filename}`);


    try {
      //Save to MongoDB
      
      

      await newPackage.save();

      req.flash("success", "package added successfully");
      res.redirect("/admin/manage_packages");
    } catch (err) {
      console.error(err);
      req.flash("error", "Error adding package");
      res.redirect("/admin/manage_packages");
    }
  }
);


module.exports = router;
