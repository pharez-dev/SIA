const path = require("path");
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const bodyParser = require("body-parser");
const session = require("express-session");
const cors = require("cors");
const errorHandler = require("errorhandler");
const mongoose = require("mongoose");
const passport = require("passport");
//const isProduction = process.env.NODE_ENV === "production";
const isProduction = process.env.NODE_ENV === "production";
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
//const PORT = process.env.PORT || 8080;
const logger = require("./util/logger")(module);
require("dotenv").config();

mongoose.promise = global.Promise;
mongoose.set("useCreateIndex", true);
mongoose
  .connect(isProduction ? process.env.DB_PRODUCTION_URL : process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((con) => console.log("DB connection successful"))
  .catch((err) => console.log("db Error: ", err.message));
useMongoClient: true;
const { db } = mongoose.connection;
console.log(mongoose.connection.db);
app.use(
  session({
    secret: "LightBlog",
    cookie: { maxAge: 60000 },
    resave: false,
    saveUninitialized: false,
  })
);
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);
app.use(require("morgan")("dev"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: false }));

// app.use(express.static(__dirname + "/public/uploads/originalImages"));
// app.use(express.static(__dirname + "/public/uploads/optimizedImages"));
app.use(express.static(__dirname + "/public"));

// Add models

require("./models/Users");
require("./models/GuestUsers");
require("./models/VerificationCodes");
require("./models/TransactionCodes");
require("./models/Property");
require("./models/Payments");

require("./models/Favourites");
require("./models/Message");
//const User = mongoose.model("Users");
require("./passport")(passport);

//Middleware functions
require("./Middleware/payment");
require("./Middleware/property");
app.use((req, res, next) => {
  req.io = io;
  next();
});
// Add routes
app.use(require("./routes"));
//require sheduled tasks
require("./scheduled/scheduled");
require("./scheduled/backup");
//app.get("/",(req,res)=>{res.send('Hi sir')});
app.use((req, res, next) => {
  let err = { message: "Not found" };
  err.status = 404;
  next(err);
});

// if (!isProduction) {
//   app.use((err, req, res) => {
//     res.status(err.status || 500);
//     res.json({
//       errors: {
//         message: "sd",
//        // error: err
//       }
//     });
//   });
// }
//Mpesa Confirmation
app.post('/confirmation', (req, res) => {
    console.log('....................... confirmation .............')
    console.log(req.body)
})

app.post('/validation', (req, resp) => {
    console.log('....................... validation .............')
    console.log(req.body)
})


app.use((err, req, res) => {
  res.status(err.status || 500);

  res.json({
    message: err.message,
  });
});
//Make images and keys  directory
const fs = require("fs");

fs.mkdir("./public/uploads/optimizedImages/", { recursive: true }, function (
  err
) {
  if (err) {
    logger.error(err.message);
  } else {
    logger.info("Created optimizedImages directory");
  }
});

fs.mkdir("./dbBackups/", { recursive: true }, function (err) {
  if (err) {
    logger.error(err.message);
  } else {
    logger.info("Created optimizedImages directory");
  }
});

fs.mkdir("./public/uploads/originalImages/", { recursive: true }, function (
  err
) {
  if (err) {
    logger.error(err.message);
  } else {
    logger.info("Created originalImages directory");
  }
});
/**
 * PORT AND IP
 */
const PORT = process.env.PORT || 8080;
//"192.168.0.173"
const IP =
  process.env.IP || process.env.OPENSHIFT_NODEJS_IP || "localhost" || "0.0.0.0";

console.log("isProduction", isProduction);

if (isProduction) {
  server.listen(PORT, () =>
    console.log(`FLIGHT SERVER IS RUNNING!!!, on   port :${PORT}`)
  );
} else {
  server.listen(PORT, IP, () =>
    console.log(`FLIGHT SERVER IS RUNNING!!!, on  ip ${IP} port :${PORT}`)
  );
}

// server.listen(PORT, () =>
//   logger.info(`SIA SERVER IS RUNNING!!!, on   port :${PORT}`)
// );
