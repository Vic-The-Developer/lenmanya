var express = require('express');
var router = express.Router();

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
    res.render('main/contact')
})


/**
 * Terms and conditions
 */
router.get('/terms', (req, res)=>{
    res.render('main/terms')
})

/**
 * Privacy page
 */
router.get('/privacy', (req, res)=>{
    res.render('main/privacy')
})


module.exports = router;