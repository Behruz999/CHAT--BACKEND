const { Schema, model } = require("mongoose");

const conversationSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    room: {
      type: Schema.Types.ObjectId,
      ref: "room",
      default: null,
    },
    messages: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "message",
        },
      ],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = model("conversation", conversationSchema);
