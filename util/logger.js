const { createLogger, format, transports } = require("winston");
require("winston-daily-rotate-file");
require("winston-mongodb");
const fs = require("fs");
const path = require("path");

const env = process.env.NODE_ENV || "development";
const logDir = "log";

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const dailyRotateFileTransport = new transports.DailyRotateFile({
  filename: `${logDir}/%DATE%-results.log`,
  datePattern: "YYYY-MM-DD",
});

const getLabel = function (callingModule) {
  var parts = callingModule.filename.split("/");
  return parts[parts.length - 2] + "/" + parts.pop();
};
// const logger = createLogger({
//   // change level if in dev environment versus production
//   level: env === "development" ? "verbose" : "info",
//   format: format.combine(
//     format.timestamp({
//       format: "YYYY-MM-DD HH:mm:ss"
//     }),
//     format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
//   ),
//   transports: [
//     new transports.Console({
//       label: getLabel(callingModule),
//       level: "info",
//       format: format.combine(
//         format.label({ label: path.basename(process.mainModule.filename) }),
//         format.colorize(),
//         format.printf(
//           info =>
//             `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
//         )
//       )
//     }),
//     dailyRotateFileTransport
//   ]
// });
module.exports = (callingModule) => {
  return createLogger({
    // change level if in dev environment versus production
    level: env === "development" ? "verbose" : "info",
    format: format.combine(
      format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    ),
    transports: [
      new transports.Console({
        label: getLabel(callingModule),
        level: "info",
        format: format.combine(
          format.label({ label: getLabel(callingModule) }),
          format.colorize(),
          format.printf(
            (info) =>
              `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
          )
        ),
      }),
      //   new transports.MongoDB({
      //     db: `${process.env.DB_URL}`,
      //     options: {
      //       useUnifiedTopology: true,

      //       useNewUrlParser: true
      //     }
      //   }),
      dailyRotateFileTransport,
    ],
  });
};

// logger.debug('Debugging info');
// logger.verbose('Verbose info');
// logger.info('Hello world');
// logger.warn('Warning message');
// logger.error('Error info');
