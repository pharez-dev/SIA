const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const PaymentsSchema = new Schema(
  {
    landlordId: {
      type: Schema.Types.ObjectId,
      ref: "Users"
    },
    trasactionId: {
      type: Schema.Types.Number,
      ref: "TransactionCodes"
    },
    purpose: {
      type: String,
      enum: ["upload", "featured", "uploadAndFeatured"],
      default: "upload"
    }
  },
  { timestamps: true }
);

PaymentsSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    landlordId: this.landlordId,
    purpose: this.purpose,
    trasactionId: thistrasactionId,
    createdAt: this.createdAt,

    updatedAt: this.updatedAt
  };
};

PaymentsSchema.index(
  {
    _id: "text",
    landlordId: "text"
  },
  {
    weights: {
      landlordId: 5,
      _id: 1
    }
  }
);

PaymentsSchema.plugin(mongoosePaginate);
mongoose.model("Payments", PaymentsSchema);
