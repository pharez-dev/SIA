const mongoose = require("mongoose"),
  router = require("express").Router(),
  uniqid = require("uniqid"),
  jwt = require("jsonwebtoken"),
  passport = require("passport"),
  User = mongoose.model("Users"),
  Property = mongoose.model("Property"),
  Transaction = mongoose.model("TransactionCodes"),
  formidable = require("formidable"),
  cloudinary = require("cloudinary"),
  fs = require("fs"),
  path = require("path"),
  request = require("request"),
  moment = require("moment"),
  Payments = mongoose.model("Payments"),
  Favourites = mongoose.model("Favourites"),
  inputFolder = path.join(__dirname + "/../public/uploads/originalImages/"),
  ObjectId = require("mongodb").ObjectID,
  { Storage } = require("@google-cloud/storage"),
  bucketname = "sia_images",
  ImageTasks = require("../../scheduled/scheduled.js"),
  Base64 = require("js-base64").Base64;
Mpesa = require("../../Middleware/payment");
const logger = require("../../util/logger")(module);
const storage = new Storage({
  keyFilename: path.join(__dirname + "/../../keys/sia_images_key.json")
});
const FeaturedHouses = 50;
//Cloudibary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
//console.log(process.env);
mongoose.set("useFindAndModify", false);
//console.log(process.env)
/**
 *Endpoint for uploading house ...*
 **/

// console.log(Property.getIndexes())

router.post(
  "/upload",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    ImageTasks.ImageJobs.stop();

    const options = {
      multiples: true,
      maxFileSize: 1024 * 1024 * 30
    };

    const form = formidable(options);

    new Promise((resolve, reject) => {
      form.parse(req);
      //console.log("line 46");
      let houseDetails = {};
      let images = [];
      let _id = new ObjectId();
      console.log(_id);
      // return;
      form.on("error", err => {
        console.log(err);
        ImageTasks.ImageJobs.start();
        return res
          .status(200)
          .json({ message: "There was an error in your request" });
        reject(err);
      });
      form.on("fileBegin", (filename, file) => {
        let img =
          _id.toHexString() + "_" + uniqid("house_") + path.extname(file.name);
        storePath = "uploads/originalImages/";
        file.path =
          path.join(__dirname + "/../../public/uploads/originalImages/") + img;
        images.push(storePath + img);
      });
      console.log(images);
      form.on("field", (field, name) => {
        // console.log("Line 60", JSON.parse(name));
        houseDetails = { ...JSON.parse(name) };
        return resolve({
          houseDetails: { ...houseDetails, _id, images }
        });
      });
    })
      .then(async data => {
        console.log("Line 69", data);

        new Promise((resolve, reject) => {
          return resolve(data.houseDetails);
        }).then(data => {
          //  console.log(data);
          data.units = data.units.filter(item => item.number != null);
          data.units = data.units.map(eachUnit => {
            return {
              type: eachUnit.type,
              number: parseInt(eachUnit.number),
              vacant: parseInt(eachUnit.vacant),
              price: parseInt(eachUnit.price)
            };
          });

          //  console.log(data);
          //  Property.createIndex({ location: "2dsphere" });
          User.findOne({ phoneNumber: req.user.phoneNumber }).then(user => {
            new Property({
              ...data,
              location: {
                type: "Point",
                coordinates: [
                  data.locationInfo.coords.longitude,
                  data.locationInfo.coords.latitude
                ]
              },
              landlordId: user._id
            })
              .save()
              .then(async newProperty => {
                ImageTasks.ImageJobs.start();
                res.status(200).json({
                  success: true,
                  uploaded: true,
                  house: newProperty
                });
              })
              .catch(err => {
                ImageTasks.ImageJobs.start();
                res.status(200).json({
                  success: false,
                  uploaded: false,
                  message: err.message
                });
              });
          });
        });
      })
      .catch(err => {
        ImageTasks.ImageJobs.start();
        console.log(err);
        res.json({ success: false, message: data.message });
        //  throw err;
      });
  }
);

/**
 *Endpoint for changing house photo ...*
 **/

router.post(
  "/editPhoto",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    ImageTasks.ImageJobs.stop();
    console.log(req.body);
    const options = {
      multiples: true,
      maxFileSize: 1024 * 1024 * 30
    };

    const form = formidable(options);
    let details = {};
    let newImages = [];
    let replaceWithId = "doNotOptimize" + uniqid();
    try {
      await new Promise((resolve, reject) => {
        form.parse(req);

        form.on("error", err => {
          console.log(err);
          ImageTasks.ImageJobs.start();

          return res
            .status(200)
            .json({ message: "There was an error in your request" });
          reject(err);
        });
        form.on("field", (field, name) => {
          //  console.log("Line 190", JSON.parse(name));
          details = { ...JSON.parse(name) };
          return resolve();
        });
        form.on("fileBegin", (filename, file) => {
          //   console.log("file begin");
          let img =
            replaceWithId + "_" + uniqid("house_") + path.extname(file.name);
          storePath = "uploads/originalImages/";
          file.path =
            path.join(__dirname + "/../../public/uploads/originalImages/") +
            img;
          newImages.push(storePath + img);
        });
      });
      console.log(details, newImages);
      await Promise.all(
        newImages.map(async each => {
          let newName = each.replace(replaceWithId, details.houseId);
          console.log("newName", newName);
          await new Promise((resolve, reject) => {
            return fs.rename(
              path.join(__dirname + "/../../public/", each),
              path.join(__dirname + "/../../public/", newName),
              (err, filenames) =>
                err != null ? reject(err) : resolve(filenames)
            );
          });
        })
      );
      let deleteThese = [...details.toBeRemoved];

      let house = await Property.findById(details.houseId);
      if (details.deleteAllExisting) deleteThese = [...house.images];
      if (details.deleteAllExisting) house.images = []; // and delete from cloud too,
      if (details.addNew)
        newImages.map(each =>
          house.images.push(each.replace(replaceWithId, details.houseId))
        );
      if (details.deleteSpecific)
        house.images = house.images.filter(
          each => !details.toBeRemoved.includes(each)
        );

      //   console.log(
      //     "To be removed",
      //     details.toBeRemoved,
      //     "vs House images",
      //     house.images
      //   );
      let newHouse = await house.save();
      //   console.log("new house:", newHouse.images);
      //delete from cloud or disk;
      //read all disk images
      let optimizedFiles = await new Promise((resolve, reject) => {
        return fs.readdir(
          path.join(__dirname + "/../../public/uploads/optimizedImages/"),
          (err, filenames) => (err != null ? reject(err) : resolve(filenames))
        );
      });
      let originalFiles = await new Promise((resolve, reject) => {
        return fs.readdir(
          path.join(__dirname + "/../../public/uploads/originalImages/"),
          (err, filenames) => (err != null ? reject(err) : resolve(filenames))
        );
      });
      originalFiles = originalFiles.map(e => `uploads/originalImages/${e}`);
      optimizedFiles = optimizedFiles.map(e => `uploads/optimizedImages/${e}`);
      console.log(originalFiles, " and ", optimizedFiles, "and", deleteThese);
      await Promise.all(
        await deleteThese.map(async each => {
          if (originalFiles.includes(each)) {
            return await new Promise((resolve, reject) => {
              return fs.unlink(
                path.join(__dirname + "/../../public/", each),
                err => (err != null ? reject(err) : resolve())
              );
            });
          }
          if (optimizedFiles.includes(each)) {
            return await new Promise((resolve, reject) => {
              return fs.unlink(
                path.join(__dirname + "/../../public/", each),
                err => (err != null ? reject(err) : resolve())
              );
            });
          }

          if (
            !optimizedFiles.includes(each) &&
            !optimizedFiles.includes(each)
          ) {
            //Delete from cloud
            console.log("Delete from cloud");
            let filetoDel = each.slice(each.indexOf("houses"));
            console.log(filetoDel);
            return await storage
              .bucket(bucketname)
              .file(`${filetoDel}`)
              .delete();
          }
        })
      );

      ImageTasks.ImageJobs.start();
      res.json({
        success: true,
        message: "Changes saved",
        newImages: newHouse.images
      });
    } catch (err) {
      //remove files received
      ImageTasks.ImageJobs.start();

      console.log(err.message);
      res.json({ success: false, message: err.message });
    }
  }
);

router.post(
  "/update_house",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    // console.log("Req", req.body);
    const { houseId, data } = req.body;

    data.units = data.units.filter(item => item.number != null);
    data.units = data.units.map(eachUnit => {
      return {
        type: eachUnit.type,
        number: parseInt(eachUnit.number),
        vacant: parseInt(eachUnit.vacant),
        price: parseInt(eachUnit.price)
      };
    });
    try {
      Property.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(houseId) },
        { ...data },
        { returnNewDocument: true }
      ).then(data => {
        // console.log("Updavted", data);
        res.status(200).json({
          success: true,

          house: data
        });
      });
    } catch (e) {
      // console.log("Err", e);
      res.status(200).json({
        success: false,

        house: data
      });
    }
  }
);

router.delete(
  "/delete_house",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    //console.log(req.body);
    const { houseId } = req.body;

    try {
      Favourites.updateMany({}, { $pull: { favouriteHouses: houseId } }).then(
        () => {
          Property.deleteOne({ _id: houseId })
            .then(() => {
              res.status(200).json({
                success: true
              });
            })
            .catch(err => {
              console.log(err);
              res.json({ success: false, message: err.message });
            });
        }
      );
    } catch (e) {
      console.log(e);
      res.status(200).json({
        success: false
      });
    }
  }
);

router.post(
  "/checkPaymentOption",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    const { houseId } = req.body;
    if (!houseId)
      return res.json({ success: false, message: "House Id missing" });
    User.findOne({ phoneNumber: req.user.phoneNumber })
      .then(async user => {
        const dateYearAgoFromNow = moment()
          .subtract(365, "days")
          .utc()
          .format();

        const allFeaturedHouses = await Property.find({
          status: "active",
          featured: true
        })
          .countDocuments()
          .exec();

        const allFeaturedHousesForLandlord = await Property.find({
          landlordId: user._id,
          status: "active",
          featured: true
        })
          .countDocuments()
          .exec();
        const allHousesUploadedAndpending = await Property.find({
          landlordId: user._id,
          status: "pending"
        })
          .countDocuments()
          .exec();
        //Get all payments made in  exactly 365 days ago  upto now and count them. returns a number
        const paymentMadeWithinOneYear = await Transaction.find({
          landlordId: user._id,
          createdAt: { $gt: dateYearAgoFromNow },
          status: "completed",
          purpose: { $in: ["upload", "uploadAndFeatured"] }
        })
          .countDocuments()
          .exec();
        //Get all properties uploaded by client and active. Returns a number
        const propertiesUploadedAndActive = await Property.find({
          landlordId: user._id,
          status: "active"
        })
          .countDocuments()
          .exec();
        /**Algorithm
                 * properties uploaded divide by 5 cannot be more than the number of payments made..
                    1. Divide properties uploaded by 5. i.e A single  payment takes 5 houses
                    2. If paymentMade is equal or negative to the division above, new payment is needed .. 
                    3. If paymentsMade is greater than the division, no new payment needed
                **/
        let makeNewPayment = true;
        if (!paymentMadeWithinOneYear) {
          makeNewPayment = true;
        } else if (
          paymentMadeWithinOneYear - propertiesUploadedAndActive / 5 <=
          0
        ) {
          makeNewPayment = true;
        }
        console.log(
          "Properties uploaded : ",
          propertiesUploadedAndActive,
          "\n Payments ing  1 year",
          paymentMadeWithinOneYear
        );
        if (makeNewPayment == false) {
          //  console.log("houseId", houseId);
          Property.findOne({ _id: mongoose.Types.ObjectId(houseId) }).then(
            house => {
              if (house == null) {
                return res.status(200).json({
                  success: false,
                  propertiesUploadedAndActive,
                  paymentMadeWithinOneYear,
                  message: "House does not exist",
                  allHousesUploadedAndpending,
                  allFeaturedHousesForLandlord,
                  featuredSlotsAvailable: FeaturedHouses - allFeaturedHouses,
                  makeNewPayment
                });
              }
              if (!house) return;

              house.status = "active";
              house.save().then(() => {
                res.status(200).json({
                  success: true,
                  propertiesUploadedAndActive,
                  paymentMadeWithinOneYear,
                  allHousesUploadedAndpending,
                  allFeaturedHousesForLandlord,
                  featuredSlotsAvailable: FeaturedHouses - allFeaturedHouses,
                  makeNewPayment
                });
              });
            }
          );
        } else {
          res.status(200).json({
            success: true,
            propertiesUploadedAndActive,
            paymentMadeWithinOneYear,
            allHousesUploadedAndpending,
            allFeaturedHousesForLandlord,
            featuredSlotsAvailable: FeaturedHouses - allFeaturedHouses,
            makeNewPayment
          });
        }
      })
      .catch(err => {
        console.log(err);
        throw err;
      });
  }
);

router.post(
  "/checkPaymentAndFeatured",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    console.log("Here is");
    User.findOne({ phoneNumber: req.user.phoneNumber })
      .then(async user => {
        const dateYearAgoFromNow = moment()
          .subtract(365, "days")
          .utc()
          .format();
        const allFeaturedHouses = await Property.find({
          status: "active",
          featured: true
        })
          .countDocuments()
          .exec();
        const allFeaturedHousesForLandlord = await Property.find({
          landlordId: user._id,
          status: "active",
          featured: true
        })
          .countDocuments()
          .exec();
        const allHousesUploadedAndpending = await Property.find({
          landlordId: user._id,
          status: "pending"
        })
          .countDocuments()
          .exec();
        //Get all payments made in  exactly 365 days ago  upto now and count them. returns a number
        const paymentMadeWithinOneYear = await Transaction.find({
          landlordId: user._id,
          createdAt: { $gt: dateYearAgoFromNow },
          status: "completed",
          purpose: { $in: ["upload", "uploadAndFeatured"] }
        })
          .countDocuments()
          .exec();
        //Get all properties uploaded by client and active. Returns a number
        const propertiesUploadedAndActive = await Property.find({
          landlordId: user._id,
          status: "active"
        })
          .countDocuments()
          .exec();
        /**Algorithm
                 * properties uploaded divide by 5 cannot be more than the number of payments made..
                    1. Divide properties uploaded by 5. i.e A single  payment takes 5 houses
                    2. If paymentMade is equal to the division above, new payment is needed .. 
                    3. If paymentsMade is greater than the division, no new payment needed
                **/
        let makeNewPayment = false;
        if (!paymentMadeWithinOneYear) {
          makeNewPayment = true;
        } else if (
          paymentMadeWithinOneYear - propertiesUploadedAndActive / 5 <=
          0
        ) {
          makeNewPayment = true;
        }
        console.log(
          "Properties uploaded : ",
          propertiesUploadedAndActive,
          "\n Payments in 1 year",
          paymentMadeWithinOneYear
        );
        res.status(200).json({
          success: true,
          propertiesUploadedAndActive,
          paymentMadeWithinOneYear,
          allHousesUploadedAndpending,
          allFeaturedHousesForLandlord,
          featuredSlotsAvailable: FeaturedHouses - allFeaturedHouses,
          makeNewPayment
        });
      })
      .catch(err => {
        console.log(err);
        reject(err);
      });
  }
);

//https://www.getpostman.com/collections/87addac6e9af6d39d890
router.post(
  "/upload/payment",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { houseId, phoneNumber, featured } = req.body;
    // console.log("[upload/payment]", req.body);
    let Amount = "200";
    let purpose = "upload";
    if (featured) {
      Amount = (parseInt(Amount) + 500).toString();
      purpose = "uploadAndFeatured";
    }
    Property.findOne({ _id: mongoose.Types.ObjectId(houseId) })
      .then(async house => {
        if (house) {
          const body = await Mpesa.stkPushPayment(phoneNumber, Amount);

          // console.log("here", body);
          switch (body.ResponseCode) {
            case "0":
              // console.log("Trans");
              new Transaction({
                houseId: house._id,
                featured: featured,
                amount: parseInt(Amount),
                landlordId: req.user._id,
                purpose,
                merchantRequestId: body.MerchantRequestID,
                checkoutRequestId: body.CheckoutRequestID
              })
                .save()
                .then(transaction => {
                  // console.log(transaction);
                  return res.status(200).json({
                    success: true,
                    transactionOnProgress: true,
                    transaction: transaction,
                    amount: Amount
                  });
                })
                .catch(err => {
                  throw new Error(err);
                });
              break;
            default:
              // console.log(body);
              return res.status(200).json({
                success: false,
                transactionOnProgress: false,
                message: "There was an error in your phone number/Am not sure"
              });
              break;
          }
        } else {
          res.status(200).json({
            success: false,
            transactionOnProgress: false,
            message: "House not found"
          });
        }
      })
      .catch(err => {
        console.log(err);
        throw new Error(err);
      });
  }
);

router.post(
  "/feature_payment",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    let { selectedHouses, phoneNumber } = req.body;

    const Amount = selectedHouses.length * 500;
    const allFeaturedHouses = await Property.find({
      status: "active",
      featured: true
    })
      .countDocuments()
      .exec();
    if (selectedHouses.length > FeaturedHouses - allFeaturedHouses) {
      return res.status(200).json({
        success: false,
        featuredSlotsAvailable: FeaturedHouses - allFeaturedHouses,
        message: "No featured slot available!"
      });
    }
    selectedHouses = selectedHouses.map(houseId => {
      return mongoose.Types.ObjectId(houseId);
    });
    // console.log(selectedHouses);
    Property.find({ _id: { $in: selectedHouses } })
      .then(async house => {
        if (house) {
          const body = await Mpesa.stkPushPayment(phoneNumber, Amount);
          console.log("[Body]", body);
          switch (body.ResponseCode) {
            case "0":
              // console.log("Trans");
              new Transaction({
                batchHouses: selectedHouses,
                featured: true,
                amount: parseInt(Amount),
                landlordId: req.user._id,
                purpose: "featured",
                merchantRequestId: body.MerchantRequestID,
                checkoutRequestId: body.CheckoutRequestID
              })
                .save()
                .then(transaction => {
                  return res.status(200).json({
                    success: true,
                    transactionOnProgress: true,
                    transaction: transaction
                  });
                })
                .catch(err => {
                  console.log(err);
                  throw new Error(err);
                });
              break;
            default:
              //  console.log(error);
              return res.status(200).json({
                success: false,
                transactionOnProgress: false,
                message: "There was an error in your phone number/Am not sure"
              });
              break;
          }
        } else {
          res.status(200).json({
            success: false,
            transactionOnProgress: false,
            message: "House not found"
          });
        }
      })
      .catch(err => {
        throw new Error(err);
      });
  }
);

//TO DO
router.post("/payment/cb", (req, res, next) => {
  const { stkCallback } = req.body.Body;
  // console.log("[MetaData]", req.body);
  return res.json({});
});

router.post(
  "/transaction_status",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { _id } = req.body;
    //  console.log(req.body);
    Transaction.findOne({ _id: _id })
      .then(transaction => {
        // console.log(transaction);
        res.status(200).json({ success: true, status: transaction.status });
      })
      .catch(err => {
        throw new Error(err);
      });
  }
);

router.post(
  "/all_houses",

  async (req, res, next) => {
    let {
      bedrooms,
      purpose,
      price,
      page,
      sort,
      limit,
      radius,
      featured, //ghghgggjghgghgh TO DO
      filterByPrice,
      filterByLocation,
      coordinates,
      placeName,
      searchQuery
    } = req.body;
    //console.log(req.body);
    let filterNearby,
      filterByName = {};

    if (bedrooms.length === 0) {
      //console.log(executed)
      bedrooms = [
        "Single rooms",
        "Bed-sitter",
        "1-Bedrooms",
        "2-Bedrooms",
        "3-Bedrooms",
        "4+ Bedrooms",
        "space"
      ];
    }
    if (!sort) {
      sort = { createdAt: -1 };
    }
    if (placeName) {
      // console.log("executed");
      filterByName = {
        $or: [
          {
            "locationInfo.address.region": { $regex: placeName, $options: "i" }
          },
          { "locationInfo.address.city": { $regex: placeName, $options: "i" } },
          {
            "locationInfo.address.street": { $regex: placeName, $options: "i" }
          }
        ]
      };
    }
    let queryStr = {};

    if (searchQuery) {
      let query = searchQuery;
      if (
        query == "bedsitter" ||
        query == "bedsiter" ||
        query == "bedsitters"
      ) {
        query = "Bed-sitter";
      }

      query = new RegExp(".*" + query + ".*");
      //   console.log(query);
      queryStr = {
        $or: [
          {
            "locationInfo.address.region": { $regex: query, $options: "i" }
          },
          { "locationInfo.address.city": { $regex: query, $options: "i" } },
          {
            "locationInfo.address.street": { $regex: query, $options: "i" }
          },
          {
            "locationInfo.address.name": { $regex: query, $options: "i" }
          },
          {
            description: { $regex: query, $options: "i" }
          },
          {
            name: { $regex: query, $options: "i" }
          },

          {
            "units.type": { $regex: query, $options: "i" }
          }
        ]
      };
    }
    //  console.log(queryStr.$or[0]);
    if (filterByLocation) {
      filterNearby = {
        $geoNear: {
          near: { type: "Point", coordinates },
          distanceField: "dist.calculated",
          maxDistance: parseInt(radius),
          includeLocs: "dist.location",
          spherical: true
        }
      };
    } else {
      filterNearby = {
        $match: { status: "active" }
      };
    }

    if (!filterByPrice) {
      price = { from: 0, to: 10000000 };
    }
    let featuredR = {};

    if (featured == true) {
      featuredR = { $match: { featured: true } };
      //  featuredN= {$match: { featured: true }}
    } else {
      featuredR = { $match: { status: "active" } };
    }

    //console.log(filterByPrice);
    // return;
    //  let size = await Property.countDocuments();
    let myAggregate = Property.aggregate([
      filterNearby,

      { $match: filterByName },
      featuredR,
      { $match: queryStr },
      {
        $match: {
          status: "active",
          purpose: { $in: purpose },

          "units.type": { $in: bedrooms }
        }
      },
      {
        $match: {
          "units.price": { $gte: price.from }
        }
      },
      {
        $match: {
          "units.price": { $lte: price.to }
        }
      },

      {
        $lookup: {
          from: "users",
          localField: "landlordId",
          foreignField: "_id",
          as: "landlord"
        }
      },

      {
        $project: {
          __v: 0,
          updatedAt: 0,
          furnished: 0
        }
      }
    ]);

    Property.aggregatePaginate(myAggregate, { page, limit, sort })
      .then(results => {
        const data = [...results.docs];
        results.docs = data.length;
        //  console.log("[results], ", data.length);
        res.status(200).json({ success: true, otherInfo: results, data });
      })
      .catch(err => {
        console.log(err);
      });
  }
);

router.post(
  "/my_houses",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { page, limit } = req.body;
    const aggregate = Property.aggregate([
      {
        $match: {
          landlordId: req.user._id,
          status: { $in: ["active", "suspended", "blocked", "pending"] }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "landlordId",
          foreignField: "_id",
          as: "landlord"
        }
      }
    ]);
    Property.aggregatePaginate(aggregate, { page, limit })
      .then(results => {
        const data = [...results.docs];
        results.docs = null;
        // console.log(results, req.user._id);
        res.status(200).json({ success: true, otherInfo: results, data });
      })
      .catch(err => {
        console.log(err);
        throw err;
      });
  }
);

router.post(
  "/my_houses_for_featured_pay",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const allFeaturedHouses = await Property.find({
      status: "active",
      featured: true
    })
      .countDocuments()
      .exec();
    //console.log("Featurd",allFeaturedHouses)
    Property.find({ landlordId: req.user._id })
      .then(results => {
        // console.log("[data]", results);

        res.status(200).json({
          success: true,
          houses: results,
          featuredSlotsAvailable: 50 - allFeaturedHouses
        });
      })
      .catch(err => {
        console.log(err);
        throw err;
      });
  }
);

router.post("/house", (req, res) => {
  const { houseId } = req.body;
  Property.findOne({ _id: houseId })
    .then(house => {
      console.log(house);
      User.find({ _id: house.landlordId }).then(landlord => {
        return res
          .status(200)
          .json({ success: true, house: { ...house._doc, landlord } });
      });
    })
    .catch(err => {
      console.log(err);
      reject(err);
    });
});

router.post("/favourites", (req, res, next) => {
  console.log("[body]", req.body);
  const { houseId, userId } = req.body;
  Favourites.findOne({ userId: userId })
    .then(async favourites => {
      let message = "Added to favourites";
      if (favourites) {
        if (
          favourites.favouriteHouses.includes(mongoose.Types.ObjectId(houseId))
        ) {
          message = "Removed from favourites";
          favourites.favouriteHouses = favourites.favouriteHouses.filter(
            item => item != houseId
          );
        } else {
          favourites.favouriteHouses.push(mongoose.Types.ObjectId(houseId));
        }
        favourites.save().then(favourites => {
          res.status(200).json({ success: true, favourites, message });
        });
      } else {
        new Favourites({
          userId: userId,
          favouriteHouses: [mongoose.Types.ObjectId(houseId)]
        })
          .save()
          .then(favourites => {
            res.status(200).json({ success: true, favourites, message });
          });
      }
    })

    .catch(err => {
      console.log(err);
      throw err;
    });
});

router.post("/checkIfIsFavourite", (req, res, next) => {
  const { houseId, userId } = req.body;
  L = Favourites.findOne({ userId })
    .then(favourites => {
      let existsOnFavourites = false;
      if (favourites) {
        if (
          favourites.favouriteHouses.includes(mongoose.Types.ObjectId(houseId))
        ) {
          existsOnFavourites = true;
        }
      }
      res.status(200).json({ success: true, existsOnFavourites });
    })

    .catch(err => {
      console.log(err);
      throw err;
    });
});

router.post("/fetchFavourites", async (req, res, next) => {
  const { page, limit, userId } = req.body;
  try {
    // console.log("[body]", req.body);

    //fetch favouritehouses
    let favourite = await Favourites.findOne({ userId: userId });
    if (!favourite) favourite = { favouriteHouses: [] };
    let favouriteHouses = favourite.favouriteHouses.map(each =>
      mongoose.Types.ObjectId(each)
    );
    //console.log(favouriteHouses);
    //{ $match: {$in:{ landlordId: favouriteHouses }} },
    //return;
    const aggregate = Property.aggregate([
      { $match: { _id: { $in: favouriteHouses } } },
      {
        $lookup: {
          from: "users",
          localField: "landlordId",
          foreignField: "_id",
          as: "landlord"
        }
      }
    ]);
    Property.aggregatePaginate(aggregate, { page, limit })
      .then(results => {
        const data = [...results.docs];
        // console.log(results)
        results.docs = null;
        // console.log(results, req.user._id);
        res.status(200).json({ success: true, otherInfo: results, data });
      })
      .catch(err => {
        console.log(err);
        throw err;
      });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
