const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const PropertySchema = new Schema(
  {
    landlordId: {
      type: Schema.Types.ObjectId,
      ref: "Users"
    },
    name: {
      type: String,
      trim: true
    },
    type: {
      type: String
    },
    location: {
      type: Object
    },
    purpose: {
      type: String,
      enum: ["sale", "rent"]
    },
    furnished: {
      type: Boolean,
      default: false
    },
    images: {
      type: Array
    },
    locationInfo: {
      type: Object
    },
    units: {
      type: Array
    },
    status: {
      type: String,
      enum: ["active", "suspended", "blocked", "pending", "deleted"],
      default: "pending"
    },
    sellPrice: {
      type: Number
    },
    size: {
      type: Number
    },
    garbage: {
      type: Number
    },
    security: {
      type: Number
    },
    water: {
      type: Number
    },
    stima: {
      type: Number
    },
    featured: { type: Boolean, default: false },

    description: {
      type: String,
      index: true,
      trim: true
    }
  },
  { timestamps: true },
  { autoIndex: false }
);

PropertySchema.methods.toJSON = function () {
  return {
    _id: this._id,
    landlordId: this.landlordId,
    name: this.name,
    vacant: this.vacant,
    locationInfo: this.locationInfo,
    images: this.images,
    units: this.units,
    houseType: this.houseType,
    size: this.size,
    status: this.status,
    sellPrice: this.sellPrice,
    purpose: this.purpose,
    furnished: this.furnished,
    description: this.description,
    featured: this.featured,
    water: this.water,
    security: this.security,
    stima: this.stima,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

PropertySchema.index(
  {
    _id: "text",
    name: "text",
    houseType: "text",
    vacant: "text",
    description: '"text',
    "units.type": "text",
    status: "text",
    purpose: "text",
    location: "2dsphere"
  },
  {
    weights: {
      units: 5,
      location: 4,
      name: 4,
      houseType: 4,
      sellPrice: 4,
      description: 4,
      status: 4,
      units: 4,
      status: 2,
      _id: 1
    }
  }
);

PropertySchema.plugin(mongoosePaginate);
mongoose.model("Property", PropertySchema);
const Property = mongoose.model("Property", PropertySchema);
