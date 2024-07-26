const router = require("express").Router();
const {
  add,
  getAll,
  getOne,
  editOne,
  deleteOne,
  getChatMessages,
  getCommunicatedUsers,
} = require("../controllers/message");

const {
  validateParams,
  validateQuery,
  validateBody,
} = require("../validations/message");

router.route("/").post(validateBody, add);

router
  .route("/getcommunicatedusers/:id")
  .get(validateParams, getCommunicatedUsers);

router.route("/getchatmessages").get(validateQuery, getChatMessages);

router.route("/").get(getAll);

router.route("/:id").get(validateParams, getOne);

router.route("/:id").put(validateParams, editOne);

router.route("/:id").delete(validateParams, deleteOne);

module.exports = router;
