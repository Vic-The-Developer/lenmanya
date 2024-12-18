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
const Blog = require('../models/Blog');

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
  const successMessage = req.flash('success')[0];

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
router.get('/dash', async (req, res) => {
  try {
      // Total Enquiries and Recent Enquiries (Limit 2)
      const totalEnquiries = await Enquiry.countDocuments();
      const recentEnquiries = await Enquiry.find()
          .sort({ createdAt: -1 })
          .limit(2);

      // Published and Draft Blog Counts
      const publishedBlogs = await Blog.countDocuments({ status: 'Published' });
      const draftBlogs = await Blog.countDocuments({ status: 'Draft' });

      // Latest Blogs (Limit 3)
      const latestBlogs = await Blog.find({ status: 'Published' })
          .sort({ createdAt: -1 })
          .limit(3);

      // Total Packages Placeholder
      const totalPackages = 0; // Replace with actual logic when Package model exists

      // Render the dashboard with fetched data
      res.render('dash/dash', {
          title: "Dashboard Overview | Lenmanya Adventures",
          currentPath: '/admin/dash',
          totalEnquiries: totalEnquiries || '-', // If no data, leave a dash
          recentEnquiries: recentEnquiries || [],
          publishedBlogs: publishedBlogs || '-',
          draftBlogs: draftBlogs || '-',
          totalPackages: totalPackages || '-',
          latestBlogs: latestBlogs || []
      });
  } catch (error) {
      console.error('Error loading dashboard data:', error);
      res.status(500).send('Internal Server Error');
  }
});

/**
 * Manage blogs
 */
router.get('/packages/:page', async (req, res) => {
  try {
      const perPage = 10; // Records per page
      const currentPage = parseInt(req.params.page) || 1;

      // Flash messages
      const successMessage = req.flash('success')[0];
      const errorMessage = req.flash('error')[0];

      // Counts for metrics
      const totalPackages = await Package.countDocuments();
      const activePackages = await Package.countDocuments({ status: 'Active' });
      const pendingPackages = await Package.countDocuments({ status: 'Pending' });

      // Fetch paginated packages
      const packages = await Package.find()
          .sort({ createdAt: -1 }) // Sort by newest first
          .skip((currentPage - 1) * perPage)
          .limit(perPage);

      const totalPages = Math.ceil(totalPackages / perPage);

      // Render the template with data
      res.render('dash/packages', {
          title: 'Manage Packages | Lenmanya Adventures',
          currentPath: '/admin/packages',
          successMessage,
          errorMessage,
          totalPackages,
          activePackages,
          pendingPackages,
          packages,
          currentPage,
          totalPages
      });
  } catch (error) {
      console.error('Error fetching paginated packages:', error);
      req.flash('error', 'An error occurred while loading packages.');
      res.redirect('/admin/packages/1');
  }
});

/**
 * filter packages
 */
router.post('/filter_package', async (req, res) => {
  try {
      const { location } = req.body; // Extract location input from the form

      // If no location input is provided, redirect back to manage page
      if (!location || location.trim() === "") {
          return res.redirect('/admin/packages');
      }

      // Query database for packages that match location (case-insensitive)
      const filteredPackages = await Package.find({
          location: { $regex: location, $options: 'i' } // Partial match, case-insensitive
      });

      // Render the results to the 'manage-package' page
      res.render('admin/manage-package', {
          packages: filteredPackages,
          searchQuery: location // Pass the search input to repopulate the form
      });
  } catch (error) {
      console.error('Error filtering packages:', error);
      res.flash('error', 'Error filtering packages');
      res.redirect('/admin/packages')
  }
});


// Multer Storage Configuration
const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "public/uploads/packages");

    // Check if the directory exists; if not, create it
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath); // Pass the path to multer
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
router.get('/manage-blogs', async (req, res) => {
  try {
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];

    // Pagination setup
    const page = parseInt(req.query.page) || 1; // Current page, default to 1
    const limit = 15; // Number of blogs per page
    const skip = (page - 1) * limit;

    // Fetch paginated blogs
    const blogs = await Blog.find().skip(skip).limit(limit).sort({ datePublished: -1 });

    // Fetch metrics
    const totalBlogs = await Blog.countDocuments();
    const publishedBlogs = await Blog.countDocuments({ status: 'Published' });
    const draftBlogs = await Blog.countDocuments({ status: 'Draft' });

    // Calculate total pages
    const totalPages = Math.ceil(totalBlogs / limit);

    res.render('dash/manage_blog', {
      title: 'Manage Blogs | Lenmanya Adventures',
      currentPath: '/admin/manage-blogs',
      successMessage,
      errorMessage,
      blogs,
      currentPage: page,
      totalPages,
      totalBlogs,
      publishedBlogs,
      draftBlogs
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error fetching blog data.');
    res.redirect('/admin/dash');
  }
});


/**
 * Create Blog
 */
router.get('/create-blog', (req, res)=>{

  const successMessage = req.flash('success')[0];
  const errorMessage = req.flash('error')[0];


  res.render('dash/create_blog', {
    title: 'Create Blog Post | Lenmanya Adventures',
    currentPath: '/admin/create-blog',
    successMessage,
    errorMessage
  })
})

/**
 * filter blogs
 */
router.post('/filter_blogs', async (req, res) => {
  try {
      const { category, status } = req.body; // Extract category and status from form submission

      // Build the filter object dynamically
      const filter = {};

      if (category && category.trim() !== "") {
          filter.category = category; // Filter by category
      }

      if (status && status.trim() !== "") {
          filter.status = status; // Filter by status
      }

      // If no filters are applied, redirect to the blog management page
      if (Object.keys(filter).length === 0) {
          return res.redirect('/admin/manage-blogs');
      }

      // Fetch filtered blogs from the database
      const filteredBlogs = await Blog.find(filter);

      // Render the results to the 'manage-blogs' page
      res.render('admin/manage-blogs', {
          blogs: filteredBlogs,
          filters: { category, status } // Pass applied filters to repopulate form
      });
  } catch (error) {
      console.error('Error filtering blogs:', error);
      res.flash('error', "Error filtering blogs");
      res.redirect('/admin/manage-blogs')
  }
});

// Multer storage configuration
const storage2 = multer.diskStorage({
  destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, "../public/uploads/blogs");

      // Check if the directory exists; if not, create it
      if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath); // Pass the path to multer
  },
  filename: (req, file, cb) => {
      const timestamp = Date.now();
      const extension = path.extname(file.originalname);
      cb(null, `${timestamp}${extension}`); // Unique filename with timestamp
  },
});

// Initialize multer
const upload2 = multer({ storage: storage2 });

/**
* Create Blog
*/
router.post('/create_blog', upload2.single('featuredImage'), async (req, res) => {
  try {
      // Extract blog data from the request body
      const { bTitle, category, content, metaTitle, metaDescription, keywords, status } = req.body;

      // Extract featured image path
      let featuredImage = '';
      if (req.file) {
          featuredImage = `/uploads/blogs/${req.file.filename}`; // Path to save in the database
      }

      // Validate required fields
      if (!bTitle || !category || !content || !metaTitle || !metaDescription || !status) {
          req.flash('error', 'All fields are required!');
          return res.redirect('/admin/create_blog');
      }

      // Create new blog object
      const newBlog = new Blog({
          bTitle,
          category,
          featuredImage,
          content,
          metaTitle,
          metaDescription,
          keywords: keywords ? keywords.split(',').map(kw => kw.trim()) : [], // Convert keywords to array
          status,
          createdAt: new Date(),
      });

      // Save the blog to the database
      await newBlog.save();

      // Success feedback
      req.flash('success', 'Blog created successfully!');
      res.redirect('/admin/manage-blogs');
  } catch (err) {
      console.error(err);
      req.flash('error', 'An error occurred while creating the blog.');
      res.redirect('/admin/create_blog');
  }
});

/**
 * Upload Images from WYSIWYG Editor
 * 
 * TinyMCE has a built-in file upload mechanism that uses an endpoint (/upload_image) to upload files like images. When an image is added through TinyMCE (drag and drop or file picker), TinyMCE sends an HTTP POST request with the file data to the endpoint defined in your backend
 */
// Configure multer for image upload
const storage3 = multer.diskStorage({
  destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, "../public/uploads/contentImages");

      // Check if the directory exists; if not, create it
      if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true }); // Create directories recursively
      }

      cb(null, uploadPath); // Set the destination path
  },
  filename: (req, file, cb) => {
      const timestamp = Date.now();
      const extension = path.extname(file.originalname);
      cb(null, `${timestamp}${extension}`); // Unique filename with timestamp
  },
});

const upload3 = multer({ storage: storage3 });

// Route to upload images from TinyMCE
router.post('/upload_image', upload3.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const imagePath = `/uploads/contentImages/${req.file.filename}`;
    return res.json({ location: imagePath }); // TinyMCE requires this response
});


// Route to edit a blog
router.post('/edit_blog', upload2.single('featuredImage'), async (req, res) => {
    try {
        const { id } = req.query; // Blog ID to identify which blog to edit
        const {
            bTitle,
            category,
            content,
            metaTitle,
            metaDescription,
            keywords,
            status
        } = req.body;

        // Validate required fields
        if (!id || !bTitle || !category || !content || !metaTitle || !metaDescription) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/admin/manage-blogs');
        }

        // Fetch the blog to update
        const blog = await Blog.findById(id);
        if (!blog) {
            req.flash('error', 'Blog not found.');
            return res.redirect('/admin/manage-blogs');
        }

        // Update blog fields
        blog.bTitle = bTitle;
        blog.category = category;
        blog.content = content;
        blog.metaTitle = metaTitle;
        blog.metaDescription = metaDescription;
        blog.keywords = keywords;
        blog.status = status;

        // If a new featured image is uploaded
        if (req.file) {
            // Delete the old featured image if it exists
            if (blog.featuredImage) {
                const oldImagePath = path.join(__dirname, "../public", blog.featuredImage);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            // Save the new featured image
            blog.featuredImage = `/uploads/blogs/${req.file.filename}`;
        }

        // Save the updated blog
        await blog.save();

        req.flash('success', 'Blog updated successfully.');
        res.redirect('/admin/manage-blogs');
    } catch (error) {
        console.error(error);
        req.flash('error', 'An error occurred while updating the blog.');
        res.redirect('/admin/manage-blogs');
    }
});



/**
 * Delete Blog
 */
router.get('/delete_blog', async (req, res) => {
  try {
      const blogId = req.query.id; // Get blog ID from query parameters

      if (!blogId) {
          req.flash('error', 'Invalid request. Blog ID is required.');
          return res.redirect('/admin/manage-blogs');
      }

      // Find the blog to get the featured image path and content
      const blog = await Blog.findById(blogId);

      if (!blog) {
          req.flash('error', 'Blog not found.');
          return res.redirect('/admin/manage-blogs');
      }

      // Delete the featured image if it exists
      if (blog.featuredImage) {
          const featuredImagePath = path.join(__dirname, '..', 'public', blog.featuredImage);
          if (fs.existsSync(featuredImagePath)) {
              fs.unlinkSync(featuredImagePath); // Delete the featured image
          }
      }

      // Extract and delete any images from the blog content folder
      const contentImagesPath = path.join(__dirname, '..', 'public', 'uploads', 'contentImages');
      const contentImages = blog.content.match(/\/uploads\/contentImages\/[^\s"]+/g) || [];

      contentImages.forEach((imagePath) => {
          const fullPath = path.join(__dirname, '..', 'public', imagePath);
          if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath); // Delete each image in the blog content
          }
      });

      // Delete the blog document from the database
      await Blog.findByIdAndDelete(blogId);

      req.flash('success', 'Blog deleted successfully.');
      res.redirect('/admin/manage-blogs');
  } catch (error) {
      console.error(error);
      req.flash('error', 'An error occurred while deleting the blog.');
      res.redirect('/admin/manage-blogs');
  }
});


/**
 * Manage Enquiries
 */
router.get('/manage-Enquiries/:page', async (req, res) => {
  try {
      const perPage = 15; // Number of records per page
      const currentPage = parseInt(req.params.page) || 1;

      // Flash messages
      const successMessage = req.flash('success')[0];
      const errorMessage = req.flash('error')[0];

      // Fetch counts
      const totalEnquiries = await Enquiry.countDocuments();
      const resolvedEnquiries = await Enquiry.countDocuments({ status: 'Resolved' });
      const unresolvedEnquiries = await Enquiry.countDocuments({ status: { $ne: 'Resolved' } });

      // Paginated Enquiries
      const enquiries = await Enquiry.find()
          .sort({ createdAt: -1 })
          .skip((currentPage - 1) * perPage)
          .limit(perPage);

      const totalPages = Math.ceil(totalEnquiries / perPage);

      // Render the template
      res.render('dash/manage_enquiries', {
          title: 'Manage Enquiries | Lenmanya Adventures',
          currentPath: '/admin/manage-Enquiries',
          successMessage,
          errorMessage,
          totalEnquiries,
          resolvedEnquiries,
          unresolvedEnquiries,
          enquiries,
          currentPage,
          totalPages
      });
  } catch (error) {
      console.error('Error fetching paginated enquiries:', error);
      res.status(500).send('Internal Server Error');
  }
});


/**
 * filter enquiries
 */
router.post('/filter_enquiries', async (req, res) => {
  try {
      var Whatsapp = req.body.Whatsapp;
      var statusFilter = req.body.status-filter;

      // If no filters are applied, redirect to the enquiries management page
      if (!Whatsapp && !statusFilter) {
          return res.redirect('/admin/manage-enquiry');
      }

      // Build filter query dynamically
      const filter = {};
      if (Whatsapp) filter.Whatsapp = { $regex: Whatsapp, $options: 'i' }; // Case-insensitive search
      if (statusFilter) filter.status = statusFilter;

      // Pagination setup
      const perPage = 10; // Results per page
      const page = parseInt(req.query.page) || 1;

      // Query database for filtered and paginated enquiries
      const totalEnquiries = await Enquiry.countDocuments(filter);
      const enquiries = await Enquiry.find(filter)
          .skip((perPage * page) - perPage)
          .limit(perPage);

      // Render results in the 'manage-enquiry' page
      res.render('admin/manage-enquiry', {
          enquiries,
          currentPage: page,
          totalPages: Math.ceil(totalEnquiries / perPage),
          filters: { Whatsapp, statusFilter } // Pass filters to repopulate input fields
      });
  } catch (error) {
      console.error('Error filtering enquiries:', error);
      res.flash('error', 'Error filtering enquiries');
      res.redirect('/admin/manage-Enquiries')
  }
});

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
 * Account Page
 */
router.get('/account', (req, res)=>{

  const successMessage = req.flash('success')[0];
  const errorMessage = req.flash('error')[0];


  res.render('dash/account', {
    title: 'Account | Lenmanya Adventures',
    currentPath: '/admin/account',
    successMessage,
    errorMessage
  })
})


// Create New Admin
router.post('/new_admin', async (req, res) => {
  const { name, email, password, role = 'Admin' } = req.body;

  try {
      // Check if email exists
      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) {
          req.flash('error', 'Admin with this email already exists.');
          return res.redirect('/admin/account');
      }

      // Hash password and save admin
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdmin = new Admin({ name, email, password: hashedPassword, role });
      await newAdmin.save();

      req.flash('success', 'New admin created successfully.');
      res.redirect('/admin/account');
  } catch (err) {
      console.error(err);
      req.flash('error', 'An error occurred while creating admin.');
      res.redirect('/admin/account');
  }
});


// Delete Admin
router.delete('/delete_admin', async (req, res) => {
  const adminId = req.query.id;
  try {
      await Admin.findByIdAndDelete(adminId);
      res.json({ message: "Admin successfully deleted." });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error deleting admin." });
  }
});

// Revoke Access
router.post('/revoke_access', async (req, res) => {
  const adminId = req.query.id;
  try {
      await Admin.findByIdAndUpdate(adminId, { role: "Revoked" });
      res.json({ message: "Admin access successfully revoked." });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error revoking admin access." });
  }
});


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
