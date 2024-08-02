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
    img: {
      type: String,
      default: null,
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
          type: Schema.Types.ObjectId,
          ref: "user",
        },
      ],
      default: [],
    },
    rooms: {
      type: [
        {
          type: Schema.Types.ObjectId,
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
