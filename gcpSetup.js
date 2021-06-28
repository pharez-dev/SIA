const fs = require("fs");
require("dotenv").config();
fs.mkdir("./keys", { recursive: true }, function (err) {
  if (err) {
    console.log(err.message);
  } else {
    console.log("Created keys directory");
  }
});

console.log(process.env.GCP_KEY_FILE);
console.log(process.env.GCP_CRED);

setTimeout(() => {
  fs.writeFile(process.env.GCP_KEY_FILE, process.env.GCP_CRED, err => {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Created key file");
    }
  });
}, 1000);
