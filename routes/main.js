var express = require('express');
var router = express.Router();

const Package = require('../models/Package');
const Blog = require('../models/Blog');

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
const moment = require('moment');
const Enquiry = require('../models/Enquiry');
const { body, validationResult, check } = require('express-validator');
const flash = require('connect-flash');
router.use(flash());





/**
 * Home (Landing Page)
 */
router.get('/', async (req, res) => {

    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];

    try {
        const packages = await Package.find(); // Fetch packages from the database
        const blogs = await Blog.find({ status: 'Published' }); // Only fetch published blogs
        res.render('main/index', { 
            packages, 
            blogs,
            successMessage,
            errorMessage
        });
    } catch (err) {
        console.log(err);
        res.render('main/index', { 
            packages: [], 
            blogs: [],
            successMessage,
            errorMessage
        }); // If an error occurs, render with empty arrays
    }
});


/**
 * Enquiry post data
 */
router.post('/enquiry', [
    // Express Validation Middleware
    body('fname').trim().notEmpty().withMessage('Full Name is required'),
    body('destination').trim().notEmpty().withMessage('Destination is required'),
    body('date1').notEmpty().withMessage('Travel Date is required'),
    body('whatsapp').notEmpty().withMessage('Valid WhatsApp number is required'),
    body('adults').optional().isInt({ min: 1 }).withMessage('Adults must be a number'),
    body('children').optional().isInt({ min: 0 }).withMessage('Children must be a number')
], async (req, res) => {
    console.log('date', req.body.date1)
    // Extract validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors)
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.redirect('/'); // Redirect to contact page if validation fails
    }

    try {
        // Save Enquiry Data to MongoDB
        const { fname, destination, date1, whatsapp, adults, children } = req.body;

        const newEnquiry = new Enquiry({
            fname: fname,
            destination: destination,
            date1: date1,
            whatsapp: whatsapp,
            dateSubmit: moment().format(), // Current timestamp using moment.js
            status: 'pending', // Default status
            adults: adults || null,
            children: children || null
        });

        await newEnquiry.save();

        req.flash('success', 'Your enquiry has been submitted successfully!');
        res.redirect('/'); // Redirect to contact page
    } catch (err) {
        console.error(err);
        req.flash('error', 'Something went wrong. Please try again later.');
        res.redirect('/'); // Redirect on error
    }
});

/**
 * Send email from Contact Page
 */
router.post(
    '/enquiry_email',
    [
        // Validation rules
        body('fname').trim().notEmpty().withMessage('Name is required.'),
        body('email').isEmail().withMessage('Valid email is required.'),
        body('subject').trim().notEmpty().withMessage('Subject is required.'),
        body('messageTxt').trim().notEmpty().withMessage('Message cannot be empty.')
    ],
    async (req, res) => {
        // Extract validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error', errors.array().map(err => err.msg));
            console.log(errors)
            return res.redirect('/contact'); // Reload the contact page with errors
        }

        // Extract data from the request body
        const { fname, email, subject, messageTxt } = req.body;

        try {
            // Set up the Nodemailer transporter
            const transporter = nodemailer.createTransport({
                service: 'gmail', // Example: use 'gmail' or your preferred email provider
                auth: {
                    user: 'webmailservices001@gmail.com', // Replace with your email
                    pass: 'jiavpmqyfoauqbvw'  // Replace with your app-specific password
                }
            });

            // Set up the email options
            const mailOptions = {
                from: email, // Sender's email address
                to: 'victormutua71@gmail.com', // bookings@lenmanyaadventures.com
                subject: `New Enquiry: ${subject}`, // Email subject
                text: `You have received a new enquiry from:
                
                Name: ${fname}
                Email: ${email} ← click to reply
                Subject: ${subject}
                
                Message:
                ${messageTxt}`
            };

            // Send the email
            await transporter.sendMail(mailOptions);

            req.flash('success', 'Your enquiry has been sent successfully.');
            res.redirect('/contact'); // Redirect back to contact page with success message
        } catch (error) {
            console.error('Error sending email:', error);
            req.flash('error', 'There was an error sending your message. Please try again later.');
            res.redirect('/contact'); // Reload with error message
        }
    }
);


/**
 * Blogs List
 */
router.get('/blog', async (req, res) => {
    const category = req.query.cat; // Get the category query parameter
    const page = parseInt(req.query.page) || 1; // Current page (default: 1)
    const perPage = 6; // Number of blogs per page
    let query = {}; // Initialize query object for filtering

    // Add category filter if 'cat' query is provided
    if (category) {
        query.category = category;
    }

    try {
        // Fetch the latest 3 recent posts
        const recentPosts = await Blog.find()
            .sort({ createdAt: -1 })
            .limit(3);

        // Fetch paginated blogs based on the filter
        const blogs = await Blog.find(query)
            .sort({ createdAt: -1 })
            .skip((perPage * page) - perPage)
            .limit(perPage);

        // Count total blogs for pagination
        const count = await Blog.countDocuments(query);

        // Fetch blog counts for each category
        const categories = await Blog.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } } // Group blogs by category
        ]);

        // Render the blog page
        res.render('main/blog', {
            blogs: blogs,
            recentPosts: recentPosts,
            categories: categories, // Pass category counts to the template
            category: category || null, // Pass the current category for heading
            currentPage: page,
            totalPages: Math.ceil(count / perPage),
        });
    } catch (error) {
        console.error('Error fetching blogs:', error);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Blog page detail
 */
router.get('/blog/:id', async (req, res) => {
    const blogId = req.params.id;

    try {
        // Fetch the blog post by ID
        const blog = await Blog.findById(blogId);
        if (!blog) {
            return res.status(404).send('Blog not found');
        }

        // Fetch categories with counts
        const categories = await Blog.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { _id: 1 } }, // Sort categories alphabetically
        ]);

        // Fetch the latest 3 blogs for "recent posts"
        const recentBlogs = await Blog.find({ _id: { $ne: blogId } })
            .sort({ createdAt: -1 })
            .limit(3);

        // Render the blog details page
        res.render('main/blog-details', {
            blog: blog,          // Blog details
            categories: categories, // Categories with counts
            recentBlogs: recentBlogs, // Recent posts
        });
    } catch (error) {
        console.error('Error fetching blog details:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/properties/:page', async (req, res) => {
    // get paginated results
    const perPage = 2; //change to 10 so that when a limit either for sponsored is broken you'll still have adequate to show(which is 10 lisitings of regular apartments)
    const page = parseInt(req.params.page) || 1;

    try {
        // Get sponsored listings
        const sponsoredListings = await Apartments.find({ sponsored: 'true' })
            .skip((perPage * page) - perPage)
            .sort({ _id: -1 })
            .limit(perPage);

        // Get regular listings
        const regularListings = await Apartments.find({ sponsored: 'false' })
            .skip((perPage * page) - perPage)
            .sort({ _id: -1 })
            .limit(perPage);

        // Combine sponsored and regular listings
        const allListings = [...sponsoredListings, ...regularListings];

        // Get total pages
        const totalListings = await Apartments.countDocuments({});
        const pages = Math.ceil(totalListings / perPage);

        const successMessage = req.flash('success');

        res.render('main/property-grid', {
            apart: allListings,
            current: page,
            pages: pages,
            successMessage
        });
    } catch (err) {
        console.error(err);
        req.flash('success', 'Error fetching listings!');
        res.redirect('/properties/1');
    }
});

/**
 * About Page
 */
router.get('/about', (req, res)=>{
    res.render('main/about')
})

/**
 * Packages List
 */
router.get('/package', async (req, res) => {
    try {
        // Set the number of packages per page
        const perPage = 2;
        // Get the current page number from the query parameter or default to page 1
        const page = parseInt(req.query.page) || 1;

        // Fetch the paginated packages (skip and limit for pagination)
        const packages = await Package.find()
            .skip((perPage * page) - perPage) // Skip the first (page - 1) * perPage packages
            .limit(perPage) // Limit the results to perPage packages
            .exec();

        // Get the total number of packages to calculate pagination
        const packageCount = await Package.countDocuments();

        // Render the package page with paginated packages
        res.render('main/package', {
            packages,
            currentPage: page,
            totalPages: Math.ceil(packageCount / perPage),
        });
    } catch (err) {
        console.log(err);
        res.render('main/package', { packages: [], currentPage: 1, totalPages: 1 });
    }
});

/**
 * Package detail
 */
router.get('/package/:id', async (req, res) => {
    const packageId = req.params.id;

    try {
        // Fetch the main package details using the ID
        const selectedPackage = await Package.findById(packageId);

        // Fetch 4 suggested packages (exclude the selected package)
        const suggestedPackages = await Package.find({ _id: { $ne: packageId } })
            .limit(4);

        if (!selectedPackage) {
            return res.status(404).send('Package not found');
        }

        // Render the package details page
        res.render('main/package-detail', {
            selectedPackage: selectedPackage,
            suggestedPackages: suggestedPackages,
        });
    } catch (error) {
        console.error('Error fetching package details:', error);
        res.status(500).send('Internal Server Error');
    }
});



/**
 * Guides List
 */
router.get('/guide', (req, res)=>{
    res.render('main/guide')
})

/**
 * destination page
 */
router.get('/destination', (req, res)=>{
    res.render('main/destination')
})

/**
 * services Page
 */
router.get('/service', (req, res)=>{
    res.render('main/service')
})

/**
 * testimonials page
 */
router.get('/testimonial', (req, res)=>{
    res.render('main/testimonial')
})


/**
 * Contacts Page
 */
router.get('/contact', (req, res)=>{
    const successMessage = req.flash('success')[0];
    const errorMessage = req.flash('error')[0];

    console.log(errorMessage)

    res.render('main/contact', {
        successMessage,
        errorMessage
    })
})


/**
 * Terms and conditions
 */
router.get('/terms', (req, res)=>{
    res.render('main/terms');
})

/**
 * Privacy page
 */
router.get('/privacy', (req, res)=>{
    res.render('main/privacy')
})


module.exports = router;