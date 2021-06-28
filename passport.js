const JWTStrategy = require("passport-jwt").Strategy;
const ExtractJWT = require("passport-jwt").ExtractJwt;
const mongoose = require("mongoose");
const User = mongoose.model("Users");
const opts = {};

opts.jwtFromRequest = ExtractJWT.fromAuthHeaderAsBearerToken();
opts.secretOrKey = "secret";

module.exports = passport => {
  passport.use(
    new JWTStrategy(opts, (jwt_payload, done) => {
      User.findById(jwt_payload._id)
        .then(user => {
          if (user) {
            //console.log(user)
            //  console.log("Authenticated req from " + user.fname);
            return done(null, user);
          }
          return done(null, false);
        })
        .catch(err => console.error(err));
    })
  );
};
