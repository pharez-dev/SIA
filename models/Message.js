const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const MessagesSchema = new Schema(
  {
    subject: {
      type:String
    },
    body: {
      type: String
    },
    name: {
      type: String
      
    },
     email: {
         type:String,
      trim: true,
      lowercase: true
      
    },
  },
  { timestamps: true }
);

MessagesSchema.methods.toJSON = function() {
  return {
    _id: this._id,
    name: this.name,
    body: this.body,
    subject: this.subject,
    createdAt: this.createdAt,

    updatedAt: this.updatedAt
  };
};

MessagesSchema.index(
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

MessagesSchema.plugin(mongoosePaginate);
mongoose.model("Messages", MessagesSchema);
