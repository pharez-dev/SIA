const fs = require("fs");
const _ = require("lodash");
const exec = require("child_process").exec;
const path = require("path");
const archiver = require("archiver");
const { lstatSync, readdirSync } = require("fs");
const { Storage } = require("@google-cloud/storage");
const bucketname = "sia_databases";
const moment = require("moment");
require("dotenv").config();
const isProduction = process.env.NODE_ENV === "production";
const logger = require("../util/logger")(module);
const storage = new Storage({
  keyFilename: path.join(__dirname + "/../keys/sia_images_key.json"),
});
const dbOptions = {
  autoBackup: true,
  removeOldBackup: true,
  keepLastDaysBackup: 2,
  autoBackupPath: path.join(__dirname + "/../dbBackups/"), // i.e. /var/database-backup/
};
/* return date object */
const stringToDate = (dateString) => {
  return new Date(dateString);
};
/* return if variable is empty or not. */
const empty = (mixedVar) => {
  var undef, key, i, len;
  var emptyValues = [undef, null, false, 0, "", "0"];
  for (i = 0, len = emptyValues.length; i < len; i++) {
    if (mixedVar === emptyValues[i]) {
      return true;
    }
  }
  if (typeof mixedVar === "object") {
    for (key in mixedVar) {
      return false;
    }
    return true;
  }
  return false;
};
// Auto backup script
const dbAutoBackUp = () => {
  // check for auto backup is enabled or disabled
  if (dbOptions.autoBackup == true) {
    let date = new Date();
    let beforeDate, oldBackupDir, oldBackupPath;
    currentDate = stringToDate(date); // Current date
    let newBackupDir =
      currentDate.getFullYear() +
      "-" +
      (currentDate.getMonth() + 1) +
      "-" +
      currentDate.getDate() +
      "_" +
      currentDate.getHours() +
      ":" +
      currentDate.getMinutes();
    let newBackupPath = dbOptions.autoBackupPath + "mongodump-" + newBackupDir; // New backup path for current backup process
    // check for remove old backup after keeping # of days given in configuration
    let dbUrl =  isProduction ? process.env.DB_PRODUCTION_URL : process.env.DB_URL;
    let cmd = `mongodump --uri ${dbUrl} --out ${newBackupPath}`;
    //   " --port " +
    //   dbOptions.port +
    //   " --db " +
    //   dbOptions.database +
    //   " --username " +
    //   dbOptions.user +
    //    "--authenticationDatabase AUTH-DB --ssl "
    //   " --password " +
    //   dbOptions.pass +
    // Command for mongodb dump process
    console.log('command:', cmd)
    logger.info("command:", cmd);
    exec(cmd, function (error, stdout, stderr) {
      if (error) logger.error(error);
      console.log(stdout);
      console.log(stderr);
    });
    console.log("dump completed:");
  }
};
/*** zip helper */
const zipFolder = (source, out) => {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = fs.createWriteStream(out);

  return new Promise((resolve, reject) => {
    archive
      .directory(source, false)
      .on("error", (err) => reject(err))
      .pipe(stream);

    stream.on("close", () => resolve());
    archive.finalize();
  });
};
/*** zip helper */
const isDirectory = (source) => lstatSync(source).isDirectory();
/*** zip helper */
const deleteFolder = async (folder) => {
  return await new Promise((resolve, reject) => {
    return fs.rmdir(folder, { recursive: true }, (err) =>
      err != null ? reject(err) : resolve()
    );
  }).catch((err) => console.log(err.message));
};
/*** zips dumps and removes original directory */
const zipDumpsToFolder = async () => {
  let folders = await readdirSync(path.join(__dirname + "/../dbBackups"))
    .map((name) => path.join(path.join(__dirname + "/../dbBackups"), name))
    .filter(isDirectory);

  console.log("to zip:", folders);
  return await Promise.all(
    folders.map(async (each) => {
      await zipFolder(each, `${each}.zip`);
      await deleteFolder(each);
    })
  ).then(() => {
    logger.info("Done zipping:", folders.length, " folders zipped");
  });
};

//checkFolderstoZip();

/*** upload database to cloud bucket */
const uploadDumpsGCloud = async () => {
  try {
    let files = await new Promise((resolve, reject) => {
      return fs.readdir(
        path.join(__dirname + "/../dbBackups"),
        (err, filenames) => (err != null ? reject(err) : resolve(filenames))
      );
    });
    files = files.filter((e) => e.endsWith(".zip"));
    console.log("Dumps to upload: ", files);
    return await Promise.all(
      files.map(async (eachFile) => {
        // upload to cloud
        const res = await storage
          .bucket(bucketname)
          .upload(`${path.join(__dirname + "/../dbBackups")}/${eachFile}`, {
            destination: `mongodumps/${eachFile}`,
          });

        //delete   file from original images
        return await new Promise((resolve, reject) => {
          return fs.unlink(
            `${path.join(__dirname + "/../dbBackups")}/${eachFile}`,
            (err) => (err != null ? reject(err) : resolve())
          );
        })
          .then(() => {
            logger.info("Uploaded to cloud and file removed from server");
          })
          .catch((err) => logger.error(`${err.message}`));
        // fs.unlink(filePath, callbackFunction);
      })
    ).catch((err) => {
      console.log(err.message);
    });
    logger.info(`Cloud upload competed: ${files.length} dumps uploaded`);
  } catch (err) {
    console.log(err);
  }
};

const zipUploadChain = async () => {
  console.log("sad");
  await zipDumpsToFolder();
  await uploadDumpsGCloud();
};

const deleteOldBackups = async () => {
  let [files] = await storage.bucket(bucketname).getFiles();
   console.log('Fi');
  files = files.filter((e) => e.name.endsWith(".zip"));
  console.log(moment(Date.now()).tz("Africa/Nairobi").format("ha z"));
 
 // reduce to those longer than 30 days
  files = files.filter(
    (e) => moment(Date.now()).diff(e.metadata.timeCreated, "minutes") > 1*60*24*30
  );
  console.log("Files:");
  files.forEach((file) => {
    console.log(file.name);
  });
  // delete those files
  await Promise.all(
    files.map(async (each) => {
      await storage
        .bucket(bucketname)
        .file(`${each.name}`)
        .delete();
    })
  );

//   console.log(
//     "First file: ",
//     moment(files[files.length - 1].metadata.timeCreated)
//       .tz("Africa/Nairobi")
//       .format("ha z")
//   );
};

// zipUploadChain();
// dbAutoBackUp()
//Cronjobs
const CronJob = require("cron").CronJob;
if(process.env.NODE_APP_INSTANCE == '0'){
new CronJob(
  "0 1 * * * *",
  () => {
    logger.info("Starting DB back Up");
    dbAutoBackUp();
  },
  null,
  true,
  "Africa/Nairobi"
);
new CronJob(
  "2 * * * * *",
  () => {
    deleteOldBackups();
  },
  null,
  true,
  "Africa/Nairobi"
);
new CronJob(
  "0  2 * * * *",
  () => {
    logger.info("Starting dumps upload to cloud ");
    zipUploadChain();
  },
  null,
  true,
  "Africa/Nairobi"
);
}
module.exports = {
  dbAutoBackUp,
};
