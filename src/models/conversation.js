const { Schema, model } = require("mongoose");

const conversationSchema = new Schema(
  {
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "user",
        },
      ],
      default: []
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: "room",
      default: null,
    },
    inChat: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "user",
        },
      ],
      default: [],
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
