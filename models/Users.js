const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const UsersSchema = new Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    pushToken: {
      type: String
    },
    password: {
      type: String,
      trim: true
    },
    alt_email: {
      type: String,
      trim: true
    },
    fname: {
      type: String,
      trim: true
    },

    lname: {
      type: String,
      trim: true
    },
    gender: {
      type: String,
      enum: ["male", "female"]
    },
    DOB: {
      type: Date
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    salutation: {
      type: String,
      enum: ["mr", "mrs", "miss", "dr", "prof", "other"],
      default: "other"
    },
    idNumber: {
      type: Number
    },
    status: {
      type: String,
      enum: ["active", "suspended", "pending-approval", "approval-denied"],
      default: "active",
      required: true
    },

    resetPasswordToken:{ type: String},
    resetPasswordExpires:Date,

    isVerified: {
      type: Boolean,
      default: false
    },

    //role for all other users of the system. required
    role: {
      type: String,
      enum: ["admin", "landlord", "client"],

      default: "landlord"
    },
    //Both county and sub count must be known for all users
    county: {
      type: String
    },
    sub_county: {
      type: String
    }
  },
  { timestamps: true }
);

UsersSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    fname: this.fname,
    sname: this.sname,
    lname: this.lname,
    gender: this.gender,
    phoneNumber: this.phoneNumber,
    DOB: this.DOB,
    email: this.email,
    role: this.role,
    status: this.status,
    pushToken: this.pushToken,
    county: this.county,
    sub_county: this.sub_county,
    resetPasswordToken: this.resetPasswordToken,
    resetPasswordExpires:this.resetPasswordExpires,
    interests: this.interests,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

UsersSchema.index(
  {
    _id: "text",
    fname: "text",
    sname: "text",
    lname: "text",
    email: "text",
    role: "text",
    status: "text",
    county: "text",
    subcounty: "text",
    residence: "text"
  },
  {
    weights: {
      email: 5,
      fname: 4,
      sname: 4,
      idnumber: 5,
      oname: 4,
      county: 4,
      subcounty: 4,
      role: 3,
      status: 2,
      _id: 1
    }
  }
);

UsersSchema.plugin(mongoosePaginate);
mongoose.model("Users", UsersSchema);
