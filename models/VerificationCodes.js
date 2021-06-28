const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-aggregate-paginate-v2");

const { Schema } = mongoose;

const VerficationCodesSchema = new Schema(
    {
        phoneNumber: {
            type: String
        },
        verificationCode: {
            type: Number
        },
        counter: {
            type: Number,
            default: 4
        }

    },
    { timestamps: true }
);

VerficationCodesSchema.methods.toJSON = function () {
    return {
        _id: this._id,
        phoneNumber: this.phoneNumber,
        verificationCode: this.verificationCode,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};


VerficationCodesSchema.plugin(mongoosePaginate);
mongoose.model("VerficationCode", VerficationCodesSchema);
