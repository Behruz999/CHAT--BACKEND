const Joi = require("joi");

const paramsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
}).options({ allowUnknown: false });

const querySchema = Joi.object({
  currentUserId: Joi.string().hex().length(24).required(),
  chatUserId: Joi.string().hex().length(24).when("roomId", {
    is: Joi.exist(),
    then: Joi.forbidden(),
    otherwise: Joi.required(),
  }),
  roomId: Joi.string().hex().length(24),
}).options({ allowUnknown: false });

const bodySchema = Joi.object({
  sender: Joi.string().hex().length(24).trim(true).required(),
  receiver: Joi.string().hex().length(24).trim(true),
  room: Joi.string().hex().length(24).trim(true),
  content: Joi.string(),
  replyTo: Joi.string().hex().length(24),
}).options({ allowUnknown: false });

async function validateParams(req, res, next) {
  try {
    await paramsSchema.validateAsync(req.params);
    next();
  } catch (err) {
    return res.status(400).json({ msg: err?.message ? err?.message : err });
  }
}

async function validateQuery(req, res, next) {
  try {
    await querySchema.validateAsync(req.query);
    next();
  } catch (err) {
    return res.status(400).json({ msg: err?.message ? err?.message : err });
  }
}

async function validateBody(req, res, next) {
  try {
    await bodySchema.validateAsync(req.body);
    next();
  } catch (err) {
    return res.status(400).json({ msg: err?.message ? err?.message : err });
  }
}

module.exports = {
  validateParams,
  validateQuery,
  validateBody,
};
