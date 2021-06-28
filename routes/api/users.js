const mongoose = require("mongoose");
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const uniqid = require("uniqid");
const User = mongoose.model("Users");
const nodemailer = require("nodemailer");
const Verification = mongoose.model("VerficationCode");
const Transaction = mongoose.model("TransactionCodes"),
  Payments = mongoose.model("Payments"),
  GuestUser = mongoose.model("GuestUsers"),
  Property = mongoose.model("Property"),
  Message = mongoose.model("Messages"),
  path = require("path"),
  request = require("request"),
  http = require("http");
require("dotenv").config();

/**
 *Endpoint for sending sms ...*
 **/
router.get("/policy", (req, res) => {
  res.render("policy.ejs");
});
router.post("/generate_verification_code", async (req, res, next) => {
  //const { apikey, partnerID, shortcode, url } = smsCredentials;
  let { phoneNumber, countryCode } = req.body;
  // console.log(req.body);
  if (countryCode == undefined || phoneNumber == undefined) {
    return res
      .status(400)
      .json({ success: false, error: "Phone number is required" });
  }
  phoneNumber = countryCode.slice(1, 4) + phoneNumber;
  const code = Math.floor(100000 + Math.random() * 900000);
  /* Check if exists (YES) - update counter, reset counter if counter was 1
   *
   **/

  new Promise((resolve, reject) => {
    Verification.findOne({ phoneNumber: phoneNumber }).then(
      async existingDoc => {
        let sendCode = false;

        if (existingDoc) {
          /// console.log(existingDoc)
          let sendCodeAndResetCounter = false;
          const lastCode = new Date(existingDoc.updatedAt);
          const timeFrameFromLastCode =
            Math.abs(new Date() - lastCode) / (1000 * 60).toFixed(1);
          let sendCount = 0;
          //console.log(timeFrameFromLastCode)
          //Last verifiction <4 hrs and counter is zero. !sendCode else save newCode and sendCode
          if (timeFrameFromLastCode < 2) {
            return resolve({
              sendCode: false,
              message: "Try again after 2 minutes",
              countdown: 2 - timeFrameFromLastCode,
              code: existingDoc.verificationCode
            });
          } else {
            existingDoc.verificationCode = code;
            existingDoc
              .save()
              .then(newDoc => {
                return resolve({
                  newDoc,
                  sendCode: true,
                  countdown: 2
                });
              })
              .catch(err => {
                reject(err);
              });
          }
        } else {
          const newVerification = new Verification({
            phoneNumber: phoneNumber,
            verificationCode: code
          });
          newVerification
            .save()
            .then(newDoc => {
              return resolve({ newDoc, sendCode: true, countdown: 2 });
            })
            .catch(err => {
              reject(err);
            });
        }
      }
    );
  })
    .then(data => {
      //  console.log(data.countdown)
      if (data.sendCode) {
        const options = {
          method: "POST",
          url: process.env.SMS_URL,
          qs: {
            username: process.env.SMS_USERNAME,
            password: process.env.SMS_PASSWORD,
            apiKey: process.env.SMS_API_KEY,
            message:
              "Your verification code for SIA is " +
              data.newDoc.verificationCode,
            senderID: process.env.SMS_SHORTCODE,
            method: "sendsms",
            msisdn: data.newDoc.phoneNumber
          },
          headers: {
            "postman-token": "4a76f18f-e896-e7cd-1cd0-b342f0d6871a",
            "cache-control": "no-cache",
            "content-type": "application/json"
          },
          body: { username: "admin", password: " 1234" },
          json: true
        };

        request(options, (error, response, body) => {
          if (error) {
            console.log(error.message);
            res.json({ success: false, message: error.message });
          } else {
            console.log(response.body);
            console.log("[count down]", data.countdown, "[code:]", code);
            switch (response.body.status) {
              case "200":
                res.status(200).json({
                  success: true,
                  code: code,
                  message: "Code sent to your number",
                  countdown: data.countdown
                });
                break;
              default:
                res
                  .status(400)
                  .json({ success: false, error: "Sorry,please try again" });
                break;
            }
          }
        });
      } else {
        // console.log(doc)
        return res.json({
          success: true,
          message: data.message,
          countdown: data.countdown,
          code: data.code
        });
      }
    })
    .catch(err => {
      console.log(err);
      res.json({ success: false, message: err.message });
    });
});

/**
 *Endpoint for confirming verification code ,if exists active ...
 *after user sends the code, check ;if user exists: create token and redirect to home
     else: registartion page
    
 * 
 **/
router.post("/verify_code", (req, res, next) => {
  const { phoneNumber, verificationCode, pushToken } = req.body;
  // console.log('Console', req.body)
  if (verificationCode == undefined || phoneNumber == undefined) {
    return res
      .status(200)
      .json({ success: false, error: "Verification code is required" });
  }
  Verification.findOne({ phoneNumber: phoneNumber }).then(doc => {
    if (doc) {
      if (doc.verificationCode != verificationCode) {
        return res.status(200).json({
          success: false,
          message: "Codes does not match"
        });
      } else {
        User.findOne({ phoneNumber: doc.phoneNumber }).then(async user => {
          if (user) {
            //console.log('User', user)
            if (pushToken) {
              await storePT(pushToken, "landlord", user._id);
            }
            jwt.sign(
              { ...user._doc },
              process.env.JWT_SECRET,
              {
                expiresIn: "7200h"
              },
              (err, token) => {
                if (err) console.error("There is some error in token", err);
                else {
                  res.json({
                    userExists: true,
                    success: true,
                    token: `Bearer ${token}`,
                    message: "You have successfully logged in"
                  });
                }
              }
            );
          } else {
            return res.status(200).json({
              success: true,
              userExists: false
            });
          }
        });
      }
    } else {
      return res.status(200).json({
        success: false,
        spam: true,
        message: "Sorry, we cannot process your request"
      });
    }
  });
});
/**
 * Endpoint for register after phone number is verified
 */
router.post("/register", (req, res, next) => {
  const { phoneNumber, email, fname, lname, pushToken } = req.body;
  //console.log("[register body]", req.body);

  User.findOne({
    phoneNumber: phoneNumber
  }).then(doc => {
    if (doc) {
      //console.log({ ...doc })
      return res.status(200).json({
        success: false,
        message: "Phone number already in use",
        phoneNumberUsed: true
      });
    } else {
      User.findOne({
        email: email
      }).then(user => {
        if (user) {
          return res.status(200).json({
            success: false,
            message: "Email already in use",
            emailUsed: true
          });
        } else {
          const newUser = new User({
            phoneNumber: phoneNumber,
            email: email,
            fname: fname,
            lname: lname
          });
          newUser
            .save()
            .then(async newUser => {
              //   console.log({ ...newUser._doc })
              if (pushToken) {
                await storePT(pushToken, "landlord", newUser._id);
              }
              jwt.sign(
                { ...newUser._doc },
                process.env.JWT_SECRET,
                {
                  expiresIn: "7200h"
                },
                (err, token) => {
                  if (err) console.error("There is some error in token", err);
                  else {
                    res.json({
                      emailUsed: false,
                      success: true,
                      token: `Bearer ${token}`,
                      message: "You have successfully logged in"
                    });
                  }
                }
              );
            })
            .catch(err => {
              throw new Error(err);
            });
        }
      });
    }
  });
});

router.post(
  "/update_user",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    const { userId, data } = req.body;
    try {
      User.findOneAndUpdate(
        { _id: mongoose.Types.ObjectId(userId) },
        { ...data },
        { new: true }
      ).then(data => {
        res.status(200).json({
          success: true,
          user: data
        });
      });
    } catch (e) {
      console.log(e);
      res.status(200).json({
        success: false
      });
      throw new Error(e);
    }
  }
);

/**
 *Endpoint for loging in, requires checking if user is active ...*
 **/
router.post("/loginGuest", async (req, res, next) => {
  const { body } = req;
  const { pushToken } = body;
  console.log(body);
  if (!body.deviceId)
    return res
      .status(200)
      .json({ success: false, message: "Failed to continue as guest" });
  GuestUser.findOne({ deviceId: body.deviceId })
    .then(found => {
      if (found) {
        //    console.log("found guest", found);
      }
      return found;
    })
    .then(async found => {
      let guestUser = found;
      if (!found) {
        guestname = "Client_" + uniqid.time().substring(4, 8);
        console.log(guestname);
        guestUser = await GuestUser.create({
          guestname: guestname,
          deviceId: body.deviceId
        });
      }
      if (pushToken) {
        console.log("storing pushToken");
        await storePT(pushToken, "client", guestUser._id);
      }

      //console.log("Guest user", guestUser);
      return res.json({
        success: true,

        guestUser,
        message: "You have successfully logged in"
      });
    });
});
/**
 *Endpoint for checking email ...*
 **/
router.post(
  "/check_email",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
    const { body } = req;
    const { user } = req;
    const { email } = body;
    if (user.email == email) {
      res.json({ success: true, valid: true });
    } else {
      //Check Email
      User.findOne({
        email: email
      })
        .then(user => {
          if (user) {
            return res.status(200).json({
              success: true,
              message: "Email already in use!",
              valid: false
            });
          } else {
            return res.status(200).json({
              success: true,

              valid: true
            });
          }
        })
        .catch(err => res.json({ success: false, message: err.message }));
    }
    console.log("[check email body]", body);
  }
);

/**
 *Endpoint for handling contact us ...*
 **/
router.post("/contact", async (req, res, next) => {
  const { body } = req;
  console.log("[contact body]", body);
  console.log("credentials: ", process.env.email, ": ", process.env.emailPass);
  try {
    //Save to db*****
    let message = new Message(body);
    await message.save().then(async message => {
      // console.log(message)
      let sent = await mailer({
        from: `Search in advance <${process.env.email}>`, // sender address
        to: `siaunav@gmail.com`, // list of receivers
        subject: body.subject, // Subject line

        html: `<p>Dear sir/madam,<p> ${body.name} has reached out to you. Their message is: <p><b> ${body.message} </b><p> You can reply to them at <p> ${body.email}`
      });
      console.log(sent);
      if (!sent.success) throw new Error(sent.message);
      res.json({ success: true, message: "Message Sent!" });
    });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: err.message });
  }
});

router.post(
  "/mytransactions",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    // console.log(req.user);

    Transaction.find({
      landlordId: req.user._id
    })
      .sort({ createdAt: -1 })
      .then(async data => {
        let transactions = [];
        return new Promise((resolve, reject) => {
          data.map(each => {
            each = {
              ...each._doc,
              houses: ""
            };

            if (each.batchHouses.length == 0) {
              Property.findOne({
                _id: mongoose.Types.ObjectId(each.houseId)
              }).then(house => {
                if (house) {
                  console.log(house);
                  each.houses = [{ name: house.name, _id: house._id }];
                  transactions.push(each);
                  if (data.length == transactions.length) {
                    resolve(transactions);
                  }
                } else {
                  each.houses = [null];
                  transactions.push(each);
                  if (data.length == transactions.length) {
                    resolve(transactions);
                  }
                }
              });
            } else {
              Property.find({ _id: { $in: each.batchHouses } }).then(house => {
                // console.log(house);
                house = house.map(item => {
                  return { _id: item._id, name: item.name };
                });
                each.houses = house;
                transactions.push(each);
                if (data.length == transactions.length) {
                  resolve(transactions);
                }
              });
            }
          });
        })
          .then(data => {
            data = data.sort((a, b) => {
              return b._id - a._id;
            });
            res.status(200).json({ success: true, data });
          })
          .catch(err => console.log(err));
      })

      .catch(err => {
        throw new Error(err);
      });
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
    user: `${process.env.email}`,
    pass: `${process.env.emailPass}`
  }
});
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

const storePT = async (token, type, _id) => {
  return new Promise(async (resolve, reject) => {
    if (_id == null) reject("id cannot be null");
    if (token == null) reject("token cannot be null");
    if (type == "landlord") {
      User.findByIdAndUpdate(_id, { pushToken: token })
        .then(doc => {
          //  console.log("[pt]", doc);
          resolve();
        })
        .catch(err => {
          console.log(err);
          reject();
        });
    } else if (type == "client") {
      await GuestUser.findByIdAndUpdate(_id, { pushToken: token });
      resolve();
    }
  });
};

/**
 *Endpoint for thumbnails ...*
 **/
const Media = require("../../util/Media");
router.get("/thumb", (req, res) => {
  console.log("thumnail query", req.query);
  if (req.query.src) {
    let image = new Media(req.query.src);
    image.thumb(req, res);
  } else {
    res.sendStatus(403);
  }
});

module.exports = router;
