const PaymentObj = {},
  request = require("request"),
  mongoose = require("mongoose"),
  moment = require("moment"),
  Property = mongoose.model("Property"),
  Payments = mongoose.model("Payments"),
  Transaction = mongoose.model("TransactionCodes"),
  Base64 = require("js-base64").Base64;
let accessToken = "Bearer nkQn5t1kpVBFSHOwpTgitoAJQ4l8";
const tillNo = "7335197";
//console.log(process.env.CONSUMER_SECRET);
PaymentObj.generateCredentials = () => {
  const options = {
    method: "GET",
    url: " https://api.safaricom.co.ke/oauth/v1/generate",
    qs: { grant_type: "client_credentials" },
    headers: {
      authorization: `Basic ${new Buffer(
        process.env.CONSUMER_KEY + ":" + process.env.CONSUMER_SECRET
      ).toString("base64")}`
    }
  };

  request(options, function (error, response, body) {
    try {
      if (error) {
        throw new Error(error);
      } else {
        if (response.body) {
          accessToken = JSON.parse(response.body);
          accessToken = "Bearer " + accessToken.access_token;
          console.log(accessToken);
        }
      }
    } catch (err) {
      console.log("[Credentials error]", err);
    }
  });
};

PaymentObj.stkPushPayment = (phoneNumber, Amount) => {
  const timestamp = moment(new Date()).format("YYYYMMDDHHMMSS");

  let pass = Base64.encode(tillNo + process.env.PASSKEY + timestamp);
  return new Promise((resolve, reject) => {
    request(
      {
        method: "POST",
        url: "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        headers: {
          Authorization: accessToken
        },
        json: {
          BusinessShortCode: tillNo,
          Password: pass,
          Timestamp: timestamp,
          TransactionType: "CustomerBuyGoodsOnline",
          Amount: Amount,
          PartyA: phoneNumber,
          PartyB: "5329603",
          PhoneNumber: phoneNumber,

          CallBackURL: process.env.SERVER_URL + "/api/property/payment/cb",
          // "https://8080-c7a66ad1-0fe6-45ec-9dea-435d570c2903.ws-eu01.gitpod.io/api/property/payment/cb",
          //   // "https://8080-db6e9531-a657-426e-ad2f-6e05bf8d1c77.ws-eu01.gitpod.io/api/property/payment/cb",
          AccountReference: "SIA UNIVERSAL",
          TransactionDesc: "SIA UNIVERSAL "
        }
      },
      (error, response, body) => {
        //console.log(body);
        if (error) {
          console.log(error);
          reject(error);
        } else {
          PaymentObj.checkTransactionStatus(body.CheckoutRequestID);
          resolve(body);
        }
      }
    );
  });
};

PaymentObj.checkTransactionStatus = CheckoutRequestID => {
  const timestamp = moment(new Date()).format("YYYYMMDDHHMMSS");
  let pass = Base64.encode(tillNo + process.env.PASSKEY + timestamp);
  const options = {
    method: "POST",
    url: "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query",
    headers: {
      Authorization: accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      BusinessShortCode: tillNo,
      Password: pass,
      Timestamp: timestamp,
      CheckoutRequestID: CheckoutRequestID
    })
  };

  request(options, function (error, response) {
    if (error) throw new Error(error);
    let body = JSON.parse(response.body);
   // console.log(body, body.errorCode);
    if (body.errorCode == "500.001.1001") {
      setTimeout(() => {
        PaymentObj.checkTransactionStatus(CheckoutRequestID);
      }, 2000);
    } else {
      Transaction.findOne({
        checkoutRequestId: CheckoutRequestID
      }).then(trans => {
        trans.resultDesc = body.ResultDesc;
        trans.status = "completed";

        if (body.ResultCode == "0") {
          if (trans.batchHouses.length == 0) {
            trans.save().then(transaction => {
              Property.findOne({
                _id: transaction.houseId
              })
                .then(house => {
                  house.status = "active";
                  house.featured = transaction.featured;
                  house.save().then(newHouse => {
                    return newHouse;
                  });
                })
                .catch(err => {
                  throw new Error(err);
                });
            });
          } else {
            trans.status = "completed";
            trans
              .save()
              .then(transaction => {
                Property.updateMany(
                  {
                    _id: {
                      $in: transaction.batchHouses
                    }
                  },
                  {
                    $set: {
                      featured: true
                    }
                  }
                )
                  .then(async newhouses => {
                    return newhouses;
                  })
                  .catch(err => {
                    console.log(err);
                    throw new Error(err);
                  });
              })
              .catch(err => {
                console.log(err);
                throw new Error(err);
              });
          }
        } else {
          trans.status = "failed";
          trans.resultDesc = body.ResultDesc;
          trans
            .save()
            .then(transaction => {
              // console.log("Transaction failed")
            })
            .catch(err => {
              console.log(err);
              throw new Error(err);
            });
        }
      });
    }
  });
};

PaymentObj.generateCredentials();
setInterval(() => {
  PaymentObj.generateCredentials();
}, 1000 * 60 * 59);

PaymentObj.registerUrl = () => {
  let url = "https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl";
  let auth = accessToken;
  request(
    {
      url: url,
      method: "POST",
      headers: {
        Authorization: auth
      },
      json: {
        ShortCode: "600383",
        ResponseType: "Complete",
        ConfirmationURL: "http://197.248.86.122:801/confirmation",
        ValidationURL: "http://197.248.86.122:801/validation"
      }
    },
    function (error, response, body) {
      if (error) {
        console.log(error);
      }
      resp.status(200).json(body);
    }
  );
};
module.exports = PaymentObj;
