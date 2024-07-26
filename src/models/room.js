const { Schema, model, Types } = require("mongoose");

const roomSchema = new Schema(
  {
    name: {
      type: String,
      index: true,
      required: true,
    },
    desc: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      default: null,
    },
    creator: {
      type: Types.ObjectId,
      required: true,
    },
    members: {
      type: [
        {
          type: Types.ObjectId,
          ref: "user",
        },
      ],
      default: [],
    },
    messages: {
      type: [
        {
          type: Types.ObjectId,
          ref: "message",
        },
      ],
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = model("room", roomSchema);
