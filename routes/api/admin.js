const mongoose = require("mongoose"),
  router = require("express").Router(),
  bcrypt = require("bcryptjs"),
  jwt = require("jsonwebtoken"),
  passport = require("passport"),
  User = mongoose.model("Users"),
  GuestUser = mongoose.model("GuestUsers");
(Property = mongoose.model("Property")),
  (Transaction = mongoose.model("TransactionCodes"));
const uniqid = require("uniqid");
const nodemailer = require("nodemailer");

router.post("/login", (req, res, next) => {
  const { email, password } = req.body;
  // console.log(req.body);

  User.findOne({ email: email })
    .then(user => {
      if (!user) {
        return res.status(200).json({
          success: false,
          message: "Incorrect email or --password!"
        });
      }
      console.log(user);
      if (!user.password)
        return res.status(200).json({
          success: false,
          message: "Incorrect email or --password!"
        });
      bcrypt.compare(password, user.password).then(isMatch => {
        if (isMatch) {
          if (user.status == "pending-approval")
            return res.status(200).json({
              success: false,
              message:
                "Your account is yet to be approved. It might take a while as your info has to be reviewed!"
            });
          if (user.status == "suspended") {
            return res
              .status(200)
              .json({ success: false, message: "Your account was suspended!" });
          }
          const payload = parseUser(user._doc);

          jwt.sign(
            payload,
            "secret",
            {
              expiresIn: 60 * 30
            },
            (err, token) => {
              if (err) console.error("There is some error in token", err);
              else {
                res.json({
                  success: true,
                  token: `Bearer ${token}`,

                  message: "You have successfully logged in"
                });
              }
            }
          );
        } else {
          return res.status(200).json({
            success: false,
            message: "Incorrect username or password!"
          });
        }
      });
    })
    .catch(err => console.log(err));
});

router.post("/register", (req, res, next) => {
  const { body } = req;
  //   console.log("[register body]", body);

  User.findOne({
    email: body.email
  }).then(user => {
    if (user) {
      return res
        .status(200)
        .json({ success: false, message: "Email already in use" });
    } else {
      User.findOne({
        email: body.phoneNumber
      }).then(user => {
        if (user) {
          return res
            .status(200)
            .json({ success: false, message: "Phone number already in use" });
        } else {
          const newUser = new User({
            email: body.email,
            role: "admin",
            fname: body.fname,
            lname: body.lname,
            phoneNumber: body.phoneNumber,
            password: body.password
          });
          console.log(newUser);
          bcrypt.genSalt(10, (err, salt) => {
            if (err) console.error("There was an error", err);
            else {
              bcrypt.hash(body.password, salt, (err, hash) => {
                if (err) console.error("There was an error", err);
                else {
                  newUser.password = hash;
                  newUser.save().then(user => {
                    console.log(newUser);
                    user = user.toObject();
                    delete user.password;
                    const payload = {
                      id: user._id,
                      fname: user.fname,
                      lname: user.lname,

                      email: user.email,
                      isVerified: user.isVerified
                    };
                    jwt.sign(
                      payload,
                      "secret",
                      {
                        expiresIn: 90000
                      },
                      (err, token) => {
                        if (err)
                          console.error("There is some error in token", err);
                        else {
                          res.json({
                            success: true,
                            token: `Bearer ${token}`,

                            message: "Registration Successful"
                          });
                        }
                      }
                    );
                  });
                }
              });
            }
          });
        }
      });
    }
  });
});

/**
 *Endpoint for checking token ...*
 **/
router.post(
  "/checkToken",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    res.json({});
  }
);

router.post(
  "/all_houses",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    let {
      bedrooms,
      purpose,
      price,
      page,
      status,
      limit,
      radius,
      sortField,
      sortOrder,
      featured, //ghghgggjghgghgh TO DO
      filterByPrice,
      filterByLocation,
      coordinates,
      placeName,
      searchQuery
    } = req.body;
    let sortFields = {};
    if (sortOrder == "ascend") {
      sortOrder = 1;
    } else {
      sortOrder = -1;
    }
    if (sortField) {
      sortFields = { $sort: { sortField: sortOrder } };
    } else {
    }
    if (purpose.length == 0) {
      purpose = ["sale", "rent"];
    }
    console.log(req.body);
    console.log(sortFields);
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
        $match: {
          $or: [
            { status: "active" },
            { status: "pending" },
            { status: "suspended" },
            { status: "deleted" }
          ]
        }
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
      featuredR = {
        $match: {
          $or: [
            { status: "active" },
            { status: "pending" },
            { status: "suspended" },
            { status: "deleted" }
          ]
        }
      };
    }
    //Filter by status
    let filterByStatus = {};
    if (status && status.length > 0) {
      filterByStatus = {
        $match: {
          status: { $in: status }
        }
      };
    } else {
      filterByStatus = {
        $match: {
          status: {
            $in: ["active", "suspended", "blocked", "pending", "deleted"]
          }
        }
      };
    }
    //Filter by type
    if (status && status.length > 0) {
      filterByStatus = {
        $match: {
          status: { $in: status }
        }
      };
    } else {
      filterByStatus = {
        $match: {
          status: {
            $in: ["active", "suspended", "blocked", "pending", "deleted"]
          }
        }
      };
    }
    if (featured == true) {
      featuredR = { $match: { featured: true } };
      //  featuredN= {$match: { featured: true }}
    } else {
      featuredR = {
        $match: {
          $or: [
            { status: "active" },
            { status: "pending" },
            { status: "suspended" },
            { status: "deleted" }
          ]
        }
      };
    }
    let myAggregate = Property.aggregate([
      //   filterNearby,
      //   { $match: filterByName },
      //   featuredR,
      filterByStatus,
      { $match: queryStr },
      {
        $match: {
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
          createdAt: 0,
          updatedAt: 0,
          furnished: 0
        }
      }
    ]);

    Property.aggregatePaginate(myAggregate, { page, limit })
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
  "/house",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    const { houseId } = req.body;
    console.log(houseId);
    Property.findOne({ _id: houseId })
      .then(house => {
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
  }
);

router.post(
  "/landlords",
 
  (req, res) => {
    const { limit, page } = req.body;
    let myAggregate = User.aggregate([
      {
        $match: { role: "landlord" }
      },
      {
        $addFields: {
          name: { $concat: ["$fname", " ", "$lname"] }
        }
      },
      { $unset: ["fname", "lname"] },
      {
        $lookup: {
          from: "properties",
          localField: "_id",
          foreignField: "landlordId",
          as: "houses"
        }
      }
    ]);
    User.aggregatePaginate(myAggregate, { page, limit })
      .then(results => {
        const data = [...results.docs];
        results.docs = data.length;
        //console.log("[results], ", data.length);
        res.status(200).json({ success: true, otherInfo: results, data });
      })
      .catch(err => {
        console.log(err);
      });
  }
);
router.post(
  "/update_house",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    const { houseId, status } = req.body;
    console.log(req.body);
    Property.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(houseId) },
      { status: status },
      { returnOriginal: false }
    )
      .then(data => {
        console.log("Updavted", data);
        res.status(200).json({
          success: true,

          house: data
        });
      })
      .catch(err => {
        console.log(err);
        reject(err);
      });
  }
);

/**
 *Endpoint for dashdata ...*
 **/
router.post(
  "/dash_data",
  //  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    try {
      let landlords = await User.find({ role: "landlord" }).countDocuments();
      let clients = await GuestUser.find({
        status: { $ne: "deleted" }
      }).countDocuments();
      let apartments = await Property.find().countDocuments();
      let payments = await Transaction.find({
        status: "completed"
      }).countDocuments();
      let totalGross = await Transaction.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: "",
            amount: { $sum: "$amount" }
          }
        }
      ]);
      totalGross = totalGross[0].amount;
      let propertyData = await Property.aggregate([
        {
          $group: {
            _id: { createdAt: { $month: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      let transactions = await Transaction.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: { createdAt: { $month: "$createdAt" } },
            count: { $sum: 1 }
          }
        }
      ]);
      console.log(landlords, clients, apartments, propertyData, transactions);
      const data = exptrapolateMerge(propertyData, transactions);
      res.json({
        success: true,
        landlords,
        clients,
        apartments,
        payments,
        totalGross,
        data: data
      });
    } catch (err) {
      console.log(err);
      // res.json({ success: false, message: err.message });
    }
  }
);
/**
 *Endpoint for reset password ...*
 **/
router.post(
  "/forgot_email",
  //  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { email } = req.body;
    try {
      //Find user and add reset token
      const resetToken = uniqid();
      let user = await User.findOne({ email, role: "admin" });
      if (!user) {
        return res.json({
          success: false,
          message: "The email you entered does not belong to an account!"
        });
      }
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000;
      await user.save();
      //Mail token
      let sent = await mailer({
        from: `Search in advance <${process.env.emailR}>`, // sender address
        to: `${email}`, // list of receivers
        subject: "Reset Password", // Subject line

        html: `<p>Dear sir/madam,<p> <p> You are receiving this  mail to reset your password <p>Click on the link or paste it into your browser to go on and reset your password, <p>http://siauniversal.co.ke/reset?rtoken=${resetToken} <p> If you did not request a password reset. Ignore this email`
      });
      console.log(sent);
      if (!sent.success) throw new Error(sent.message);
      res.json({
        success: true,
        message:
          "An email has been sent with further instructions to reset your password."
      });
    } catch (error) {
      return res.json({ success: false, message: error.message });
    }
  }
);

/**Logout */
/**
 *Endpoint check reset token ...*
 **/
router.post(
  "/check_reset_token",
  //  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    try {
      const user = await User.findOne({
        resetPasswordToken: req.body.token,
        resetPasswordExpires: { $gt: Date.now() }
      });
      if (!user) {
        return res.json({
          success: false,
          message: "Reset token has expired or is invalid"
        });
      } else {
        return res.json({ success: true, message: "Token valid" });
      }
    } catch (error) {
      return res.json({ success: false, message: error.message });
    }
  }
);

/**
 *Endpoint for reseting password ...*
 **/
router.post(
  "/reset_password",
  //  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    let { password } = req.body;
    console("[Password]", password);
    try {
      let user = await User.findOne({
        resetPasswordToken: req.body.token,
        resetPasswordExpires: { $gt: Date.now() }
      });
      if (!user) {
        return res.json({
          success: false,
          message: "Reset token has expired or is invalid"
        });
      }

      //hash new password
      bcrypt.genSalt(10, (err, salt) => {
        if (err) console.error("There was an error", err);
        else {
          bcrypt.hash(password, salt, (err, hash) => {
            if (err) console.error("There was an error", err);
            else {
              user.password = hash;
              user.save().then(async user => {
                // user = user.toObject();

                res.json({
                  success: true,

                  message: "Your password was updated successfully"
                });
              });
            }
          });
        }
      });
    } catch (error) {
      return res.json({ success: false, message: error.message });
    }
  }
);
const mailer = Options => {
  return new Promise((resolve, reject) => {
    transporter
      .sendMail(Options)
      .then(res => resolve({ success: true }))
      .catch(err => {
        reject({ success: false, message: err.message });
      });
  });
};
let transporter = nodemailer.createTransport({
  host: "mara.server254-e.net",
  port: "465",
  secure: true,
  auth: {
    user: `${process.env.emailR}`,
    pass: `${process.env.emailPass}`
  }
});

/**
 *Endpoint for updating user profile*
 **/
router.post(
  "/update_profile",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    console.log("[update body]", body);
    const { fname, lname, email, phoneNumber } = req.body;
    try {
      User.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(req.user._id) },
        { fname, lname, email, phoneNumber },
        { new: true }
      ).then(data => {
        const user = parseUser(data._doc);
        jwt.sign(
          user,
          "secret",
          {
            expiresIn: 60 * 30 * 100000
          },
          (err, token) => {
            if (err) console.error("There is some error in token", err);
            else {
              res.json({
                success: true,
                token: `Bearer ${token}`,
                user
              });
            }
          }
        );
      });
    } catch (e) {
      console.log(e);
      res.status(200).json({
        success: false,
        message: e.message
      });
    }
  }
);
/**
 *Endpoint for changing password*
 **/
router.post(
  "/update_password",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    const { pushToken } = body;
    const { oldpassword, newpassword } = req.body;
    console.log("[body]", body);
    //return;

    User.findOne({ _id: mongoose.Types.ObjectId(req.user._id) }).then(user => {
      if (!user) {
        return res.status(200).json({
          success: false,
          message: "An error occurred in changing your password!"
        });
      }
      bcrypt.compare(oldpassword, user.password).then(async isMatch => {
        if (isMatch) {
          //hash new password
          bcrypt.genSalt(10, (err, salt) => {
            if (err) console.error("There was an error", err);
            else {
              bcrypt.hash(newpassword, salt, (err, hash) => {
                if (err) console.error("There was an error", err);
                else {
                  user.password = hash;
                  user.save().then(async user => {
                    // user = user.toObject();

                    res.json({
                      success: true,

                      message: "Your password was udated successfully"
                    });
                  });
                }
              });
            }
          });
          // jwt.sign(
          //   payload,
          //   "secret",
          //   {
          //     expiresIn: 60 * 30 * 100000,
          //   },
          //   (err, token) => {
          //     if (err) console.error("There is some error in token", err);
          //     else {
          //       res.json({
          //         success: true,
          //         token: `Bearer ${token}`,
          //         message: "Login successful, Taking you to Home!",
          //       });
          //     }
          //   }
          // );
        } else {
          return res
            .status(200)
            .json({ success: false, message: "Incorrect current password!" });
        }
      });
    });
  }
);
/**Endpoint for dashboard home page */

const parseUser = user => {
  if (user.role == "admin") {
    delete user.students;
    delete user.trainers;
    delete user.instructors;
    delete user.courses;
  }
  delete user.password;
  delete user.__v;
  return user;
};
//Helper function
const exptrapolateMerge = (apartments, transactions) => {
  let month = new Array();
  month[1] = "January";
  month[2] = "February";
  month[3] = "March";
  month[4] = "April";
  month[5] = "May";
  month[6] = "June";
  month[7] = "July";
  month[8] = "August";
  month[9] = "September";
  month[10] = "October";
  month[11] = "November";
  month[12] = "December";
  let data = [];
  let end = 1;
  if (transactions[transactions.length - 1]._id.createdAt < 12) {
    end =
      12 -
      transactions[transactions.length - 1]._id.createdAt +
      transactions[transactions.length - 1]._id.createdAt -
      12;
  }

  let n = new Date().getMonth() + 1;
  for (let i = n; i > n - 12; i--) {
    let j = i;
    if (i < 1) j = i + 12;

    let obj = {
      name: month[j],
      Transactions: 0,
      Apartments: 0,
      number: j
    };
    console.log(i, n);
    // data.push(obj)
    data = [obj, ...data];
  }
  console.log(data);

  data = data.map(d => {
    transactions.map(each => {
      if (each._id.createdAt == d.number) d.Transactions = each.count;
    });
    apartments.map(each => {
      if (each._id.createdAt == d.number) d.Apartments = each.count;
    });

    return d;
  });
  console.log(data);
  console.log("END", end);
  return data;
};
module.exports = router;
