const Jimp = require("jimp"),
  mongoose = require("mongoose"),
  Property = mongoose.model("Property"),
  path = require("path"),
  inputFolder = path.join(__dirname + "/../public/uploads/originalImages/"),
  processedFolder = path.join(
    __dirname + "/../public/uploads/optimizedImages/"
  ),
  assert = require("assert"),
  fs = require("fs"),
  { Storage } = require("@google-cloud/storage"),
  bucketname = "sia_images";
const logger = require("../util/logger")(module);
const interval = 60 * 1000 * 2;

const storage = new Storage({
  keyFilename: path.join(__dirname + "/../keys/sia_images_key.json")
});

/*** optimize images helper */

const resizeImage = (fileName, i) => {
  return new Promise((resolve, reject) => {
    Jimp.read(inputFolder + fileName)
      .then(async image => {
        //await  image        .resize(1920, Jimp.AUTO)
        await image.quality(60);

        await image.writeAsync(`${processedFolder}${fileName}`);
        console.log(i + 1, "image optimized");
        resolve();
        //Write to log maybe
        //   console.log("Moving filename", fileName);
        //   //   fs.rename(inputFolder + fileName, processedFolder + fileName, function (
        //   //     ignore
        //   //   ) {});
      })
      .catch(function (e) {
        logger.error(`${e.message} ${fileName}`);
        //   console.log(e, fileName);
        reject(e);
      });
  });
};
/*** reads original and passed them to optimized */

const optimizeImages = async () => {
  //Read files and pass them to resizer
  new Promise((resolve, reject) => {
    return fs.readdir(inputFolder, (err, filenames) =>
      err != null ? reject(err) : resolve(filenames)
    );
  })
    .then(async files => {
      let alreadyOptimized = await new Promise((resolve, reject) => {
        return fs.readdir(processedFolder, (err, filenames) =>
          err != null ? reject(err) : resolve(filenames)
        );
      });
      return { files, alreadyOptimized };
    })
    .then(async data => {
      //   console.log(data);
      await Promise.all(
        data.files.map(async (file, i) => {
          if (data.alreadyOptimized.includes(file)) return;
          if (file.includes("doNotOptimize")) return;
          // if (i > 2) return;
          if (file.toLowerCase().endsWith(".jpg")) {
            return await resizeImage(file, i);
          }
        })
      );
      logger.info(
        `Image optimization finished: ${data.files.length} optimized`
      );
      //Move files
      setTimeout(() => {
        changeOptimizedDB();
      }, 2000);
    })

    .catch(err => logger.error(`${err.message}`));
};

/*** changes and moves optimized files  */

const changeOptimizedDB = async () => {
  try {
    let files = await new Promise((resolve, reject) => {
      return fs.readdir(processedFolder, (err, filenames) =>
        err != null ? reject(err) : resolve(filenames)
      );
    });
    let originalFiles = await new Promise((resolve, reject) => {
      return fs.readdir(inputFolder, (err, filenames) =>
        err != null ? reject(err) : resolve(filenames)
      );
    });

    //console.log(files);

    await Promise.all(
      files.map(async each => {
        if (originalFiles.includes(each)) {
          //Get id
          assert.equal(24, each.slice(0, 24).length);
          let id = each.slice(0, 24);
          return await Property.findById(id).then(async record => {
            let recordExists = record ? "It exists" : " does not exist";
            logger.info("{Current RECORD  to be optimized} ", recordExists);
            if (record) {
              record.images = await Promise.all(
                //     await new Promise(async resolve => {
                await record.images.map(async image => {
                  if (image.includes(each)) {
                    //change from originalToOptimized
                    // console.log("Change to optimized ", image, " ", each);
                    image = image.replace(
                      "/originalImages/",
                      "/optimizedImages/"
                    );
                    //  console.log("New Image", image);
                  }
                  return image;
                  //   });
                })
              );
              return await record
                .save()
                .then(async () => {
                  //delete   file from original images
                  return await new Promise((resolve, reject) => {
                    return fs.unlink(inputFolder + each, err =>
                      err != null ? reject(err) : resolve()
                    );
                  })
                    .then(() => {
                      console.log("DB updated and file removed");
                    })
                    .catch(err => logger.error(`${err.message}`));
                  // fs.unlink(filePath, callbackFunction);
                })
                .catch(err => logger.error(`${err.message}`));
            } else {
              return await new Promise((resolve, reject) => {
                return fs.unlink(inputFolder + each, err =>
                  err != null ? reject(err) : resolve()
                );
              })
                .then(() => {
                  logger.info(
                    "File removed from original images because it does not exist in DB"
                  );
                })
                .catch(err => logger.error(`${err.message}`));
            }
          });
        } else {
          //  console.log("Image was alread moved");
        }
      })
    );
    logger.info(`Moving  finished: ${files.length} files moved to optimized`);

    setTimeout(() => {
      uploadToGCloud();
    }, 2000);
  } catch (err) {
    logger.error(`${err.message}`);
  }
};
/*** upload to cloud bucket */
const uploadToGCloud = async () => {
  try {
    let files = await new Promise((resolve, reject) => {
      return fs.readdir(processedFolder, (err, filenames) =>
        err != null ? reject(err) : resolve(filenames)
      );
    });

    await Promise.all(
      files.map(async eachFile => {
        // upload to cloud
        const res = await storage
          .bucket(bucketname)
          .upload(`${processedFolder}/${eachFile}`, {
            destination: `houses/${eachFile}`
          });
        // `mediaLink` is the URL for the raw contents of the file.
        const url = `https://storage.googleapis.com/${res[0].metadata.bucket}/${res[0].metadata.name}`;
        // Need to make the file public before you can access it.
        //await storage.bucket(bucketname).file(`test.jpg`).makePublic(); // for fine-grained
        // console.log("[glcoud res]", res);
        console.log("url: ", url);
        assert.equal(24, eachFile.slice(0, 24).length);
        let id = eachFile.slice(0, 24);
        //Change db url

        await Property.findById(id).then(async record => {
          logger.info("{RECORD of to be uploaded}", record);
          if (record) {
            record.images = await Promise.all(
              //     await new Promise(async resolve => {
              await record.images.map(async image => {
                if (image.includes(eachFile)) {
                  //change url to google

                  image = url;
                  //  console.log("New Image", image);
                }
                return image;
                //   });
              })
            );
            return await record
              .save()
              .then(async () => {
                //delete   file from original images
                return await new Promise((resolve, reject) => {
                  return fs.unlink(processedFolder + eachFile, err =>
                    err != null ? reject(err) : resolve()
                  );
                })
                  .then(() => {
                    console.log(
                      "Uploaded to cloud  and file removed from server"
                    );
                  })
                  .catch(err => logger.error(`${err.message}`));
                // fs.unlink(filePath, callbackFunction);
              })
              .catch(err => console.log(err));
          } else {
            return await new Promise((resolve, reject) => {
              return fs.unlink(processedFolder + eachFile, err =>
                err != null ? reject(err) : resolve()
              );
            })
              .then(() => {
                logger.info(
                  "File removed from server because it does not exist in db"
                );
              })
              .catch(err => logger.error(`${err.message}`));
          }
        });
      })
    );
    logger.info(`Upload to cloud finished: ${files.length} files uploaded`);

    check();
  } catch (err) {
    console.log(err);
  }
};
/** status of optimization and uploads */
const check = async () => {
  let alreadyOptimized = await new Promise((resolve, reject) => {
    return fs.readdir(processedFolder, (err, filenames) =>
      err != null ? reject(err) : resolve(filenames)
    );
  });
  let original = await new Promise((resolve, reject) => {
    return fs.readdir(inputFolder, (err, filenames) =>
      err != null ? reject(err) : resolve(filenames)
    );
  });
  let notChangedDB = original.filter(e => alreadyOptimized.indexOf(e) !== -1);

  let inconsistencies = 0;
  if (notChangedDB.length > 0) {
    changeOptimizedDB();
  } else if (original.length > 0) {
    optimizeImages();
  } else if (alreadyOptimized.length > 0) {
    uploadToGCloud();
  }
  logger.info(
    `\nTo be optimized: ${original.length} \nTo be uploaded ${alreadyOptimized.length} \nTo be moved: ${notChangedDB.length}`
  );
  //       if(original.length ==0 &&alreadyOptimized.length == 0 ){
  //     let  notRenamedInDB   =   await Property.find({images:{$elemMatch: {value: {$regex : "NaN_house_1ukqiyrker5vm57.jpg"}}}}).countDocuments()
  //    console.log("not " , notRenamedInDB)
  //       }
};
// setInterval(() => {
//   check();
// }, interval);
//Cronjobs
const CronJob = require("cron").CronJob;
const ImageJobs = new CronJob(
  "10 * * * * *",
  () => {
    let a = "[Process: " + process.env.NODE_APP_INSTANCE + " :instance]";
    logger.info(a, process.env.NODE_APP_INSTANCE);
    console.log(a, process.env.NODE_APP_INSTANCE);
    if (process.env.NODE_APP_INSTANCE == "0") {
      logger.info("Image jobs started on this instance!");
      check();
    } else {
      logger.info("Image jobs started on instance 1 !");
    }
  },
  null,
  true,
  "Africa/Nairobi"
);

ImageJobs.start();
//ImageJobs.stop();

module.exports = {
  check,
  optimizeImages,
  uploadToGCloud,
  changeOptimizedDB,
  ImageJobs
};
// optimizeImages();
// setTimeout(() => changeOptimizedDB(), 1000 * 1);
// uploadToGCloud();
