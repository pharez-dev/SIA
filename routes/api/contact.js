const mongoose = require("mongoose"),
  router = require("express").Router(),
  bcrypt = require("bcryptjs"),
  jwt = require("jsonwebtoken"),
  passport = require("passport"),
  User = mongoose.model("Users"),
  Property = mongoose.model("Property"),
  Transaction = mongoose.model("TransactionCodes");
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
      // console.log(user);
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
  // console.log("[register body]", body);

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
/**Logout */

/**Endpoint for dashboard home page */
router.post(
  "/apartments",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    landlords = Users.find({ role: "landlord" });
    houses = Property.find({ status: "acive" });
    res.status(200).json({ success: true, data: { landlords, houses } });
  }
);
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

module.exports = router;
