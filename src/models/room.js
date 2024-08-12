const { Schema, model } = require("mongoose");

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
      type: Schema.Types.ObjectId,
      required: true,
    },
    // conversation: {
    //   type: Schema.Types.ObjectId,
    //   ref: "conversation",
    //   required: true,
    // },
    members: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "user",
        },
      ],
      default: [],
    },
    // messages: {
    //   type: [
    //     {
    //       type: Schema.Types.ObjectId,
    //       ref: "message",
    //     },
    //   ],
    //   default: [],
    // },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = model("room", roomSchema);
