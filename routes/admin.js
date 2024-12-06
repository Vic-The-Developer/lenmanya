var express = require("express");

// const Blogs = require('../models/blog');


const fs = require("fs");
const fs2 = require("fs").promises;
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

var router = express.Router();
const { check, body, validationResult } = require("express-validator");
const flash = require("connect-flash");
const { title } = require("process");
router.use(flash());


/**
 * Main Dashboard
 */
router.get('/dash', (req, res)=>{
  res.render('dash/dash', {
    title: "Dashboard Overview | Decode Tech Byte",
    currentPath: '/admin/dash'
  })
})


/**
 * Manage blogs
 */
router.get('/manage-blogs', (req, res)=>{
  res.render('dash/manage_blog', {
    title: 'Manage Blogs | Decode Tech Byte',
    currentPath: '/admin/manage-blogs'
  })
})


/**
 * Create Blog
 */
router.get('/create-blog', (req, res)=>{
  res.render('dash/create_blog', {
    title: 'Create Blog Post | Decode Tech Byte',
    currentPath: '/admin/create-blog'
  })
})

/**
 * Edit Blog
 */


router.get("/dash/:page", async (req, res) => {

  //if not logged in
  if (req.user == undefined || req.user.admin != 0) res.redirect('/user/login');

  try {
    // Get total users, properties, suspended listings, featured listings

    // get paginated results
    const perPage = 2;
    const page = parseInt(req.params.page) || 1;

    // find featured listings
    const featuredListings = await Apartment.find({ sponsored: 'true' })
      .skip((perPage * page) - perPage)
      .limit(perPage)
      .exec();

    console.log('Paginated listings', featuredListings);

    // get total pages and total Apartment
    const totalListings = await Apartment.countDocuments({});
    const pages = Math.ceil(totalListings / perPage);

    //get sponsored listings
    const sponsTot = await Apartment.countDocuments({sponsored: 'true'});
    console.log('sponsored', sponsTot);

    // Get total users
    const totalUsers = await User.countDocuments({});

    console.log('Users total', totalUsers);

    // get total suspended listings
    const totalSuspendedListings = await Apartment.countDocuments({ disabled: 'true' });

    console.log('Suspended total', totalSuspendedListings);

    // Get Search Terms
    // const topLocations = await SearchTerms.aggregate([
    //   { $group: { _id: '$loc', count: { $sum: 1 } } },
    //   { $sort: { count: -1 } },
    //   { $limit: 5 },
    // ]);

    // const topApartmentTypes = await SearchTerms.aggregate([
    //   { $group: { _id: '$appaType', count: { $sum: 1 } } },
    //   { $sort: { count: -1 } },
    //   { $limit: 5 },
    // ]);

    // const topMaxBudgets = await SearchTerms.aggregate([
    //   { $group: { _id: '$maxBudget', count: { $sum: 1 } } },
    //   { $sort: { count: -1 } },
    //   { $limit: 5 },
    // ]);

    const successMessage = req.flash("success");

    // render the view
    res.render('dash/dash', {
      title: 'Main Dashboard | Keja Connect',
      apart: featuredListings,
      current: page,
      pages,
      usersTot: totalUsers,
      apartTot: totalListings,
      suspendedTot: totalSuspendedListings,
      successMessage,
      sponsTot
      // topLocations,
      // topApartmentTypes,
      // topMaxBudgets,
    });
  } catch (err) {
    console.error(err);
    req.flash('success', "Error in quering data");
    res.redirect('/')
  }

  // res.render("dash/dash", {
  //   title: "Main Dashboard | Keja Connect",
  // });
});



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
