var express = require('express');
var router = express.Router();


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
router.get('/', (req, res)=>{
    res.render('main/index')
})


/**
 * Enquiry post data
 */
router.post('/enquiry', [
    // Express Validation Middleware
    body('fname').trim().notEmpty().withMessage('Full Name is required'),
    body('destination').trim().notEmpty().withMessage('Destination is required'),
    body('date1').notEmpty().withMessage('Travel Date is required'),
    body('whatsapp').isMobilePhone().withMessage('Valid WhatsApp number is required'),
    body('adults').optional().isInt({ min: 1 }).withMessage('Adults must be a number'),
    body('children').optional().isInt({ min: 0 }).withMessage('Children must be a number')
], async (req, res) => {
    // Extract validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.redirect('/contact'); // Redirect to contact page if validation fails
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
        res.redirect('/contact'); // Redirect to contact page
    } catch (err) {
        console.error(err);
        req.flash('error', 'Something went wrong. Please try again later.');
        res.redirect('/contact'); // Redirect on error
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
                Email: ${email}
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
router.get('/blog', (req, res)=>{
    res.render('main/blog')
})


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
router.get('/package', (req, res)=>{
    res.render('main/package')
})

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