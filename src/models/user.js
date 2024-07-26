const { Schema, model, Types } = require("mongoose");

const userSchema = new Schema(
  {
    firstname: {
      type: String,
      default: null,
    },
    username: {
      type: String,
      unique: true,
      required: true,
    },
    bio: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      default: null,
    },
    contacts: {
      type: [
        {
          type: Types.ObjectId,
          ref: "user",
        },
      ],
      default: [],
    },
    rooms: {
      type: [
        {
          type: Types.ObjectId,
          ref: "room",
        },
      ],
      default: [],
    },
    socketId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = model("user", userSchema);
