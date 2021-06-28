const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");
const AutoIncrement = require("mongoose-sequence")(mongoose);
const autoIncrement = require("mongoose-auto-increment");
//autoIncrement.initialize(mongoose.connection);
const { Schema } = mongoose;

const TransactionCodesSchema = new Schema(
  {
    _id: { type: Number },
    houseId: {
      type: Schema.Types.ObjectId,
      ref: "Properties"
    },

    batchHouses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Properties"
      }
    ],
    featured: {
      type: Boolean,
      default: false
    },
    amount: {
      type: Number
    },
    merchantRequestId: {
      type: String
    },
    checkoutRequestId: {
      type: String
    },
    resultDesc: {
      type: String
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending"
    },
    landlordId: {
      type: Schema.Types.ObjectId,
      ref: "Users"
    },
      purpose: {
      type: String,
      enum: ["upload", "featured", "uploadAndFeatured"],
  
    }
  },
    
  { timestamps: true, _id: false }
);

TransactionCodesSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    checkoutRequestId: this.checkoutRequestId,
    merchantRequestId: this.merchantRequestId,
    houseId: this.houseId,
    status: this.status,
    amount: this.amount,
    resultDesc: this.resultDesc,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

TransactionCodesSchema.plugin(mongoosePaginate);
TransactionCodesSchema.plugin(AutoIncrement);
//TransactionCodesSchema.plugin(autoIncrement.plugin, "TransactionCodes");
mongoose.model("TransactionCodes", TransactionCodesSchema);
