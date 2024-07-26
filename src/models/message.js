const { Schema, model, Types } = require("mongoose");
const moment = require("moment");

const messageSchema = new Schema(
  {
    sender: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
    },
    receiver: {
      type: Types.ObjectId,
      ref: "user",
    },
    room: {
      type: Types.ObjectId,
      ref: "room",
      default: null,
    },
    content: {
      type: String,
      required: true,
    },
    replyTo: {
      type: Types.ObjectId,
      ref: "message",
      default: null,
    },
    delivered: {
      type: Boolean,
      default: false,
    },
    date: {
      type: String,
      default: moment().format("YYYY-mm-DD HH:mm"),
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = model("message", messageSchema);
