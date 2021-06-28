const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const FavouritesSchema = new Schema(
  {
    userId: {
      type: String
    },
    favouriteHouses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Properties"
      }
    ]
  },
  { timestamps: true }
);

FavouritesSchema.methods.toJSON = function() {
  return {
    _id: this._id,
    userId: this.landlordId,
    houseId: this.houseId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

FavouritesSchema.plugin(mongoosePaginate);
mongoose.model("Favourites", FavouritesSchema);
