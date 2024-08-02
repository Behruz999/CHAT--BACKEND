const { Schema, model } = require("mongoose");

const conversationSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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
