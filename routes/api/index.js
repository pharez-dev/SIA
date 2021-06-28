const router = require("express").Router();

router.use("/users", require("./users"));
router.use("/admin", require("./admin"));
router.use("/property", require("./property"));
router.use("/contact", require("./contact"));
module.exports = router;
