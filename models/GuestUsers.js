const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const GuestUsersSchema = new Schema(
  {
    deviceId: {
      type: String
    },
    pushToken: {
      type: String
    },
    guestname: {
      type: String
    }
  },
  { timestamps: true }
);

GuestUsersSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    deviceId: this.deviceId,
    guestname: this.guestname,
    pushToken: this.pushToken,
    interests: this.interests,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

GuestUsersSchema.index(
  {
    _id: "text",
    fname: "text",
    sname: "text"
  },
  {
    weights: {
      email: 5,
      fname: 4,

      _id: 1
    }
  }
);

GuestUsersSchema.plugin(mongoosePaginate);
mongoose.model("GuestUsers", GuestUsersSchema);
