const Joi = require("joi");

const paramsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
}).options({ allowUnknown: false });

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().trim(true),
}).options({ allowUnknown: false });

const editSchema = Joi.object({
  firstname: Joi.string().trim(true),
  username: Joi.string().trim(true),
  bio: Joi.string().trim(true),
  password: Joi.string().trim(true),
  contacts: Joi.array().items({
    content: Joi.string().hex().length(24).trim(true).required(),
    status: Joi.number().valid(0, 1).required(),
  }),
  rooms: Joi.array().items({
    content: Joi.string().hex().length(24).trim(true).required(),
    status: Joi.number().valid(0, 1).required(),
  }),
}).options({ allowUnknown: false });

async function validateParams(req, res, next) {
  try {
    await paramsSchema.validateAsync(req.params);
    next();
  } catch (err) {
    return res.status(400).json({ msg: err?.message ? err?.message : err });
  }
}

async function validateLogin(req, res, next) {
  try {
    await loginSchema.validateAsync(req.body);
    next();
  } catch (err) {
    return res.status(400).json({ msg: err?.message ? err?.message : err });
  }
}

async function validateEdit(req, res, next) {
  try {
    await editSchema.validateAsync(req.body);
    next();
  } catch (err) {
    return res.status(400).json({ msg: err?.message ? err?.message : err });
  }
}

module.exports = {
  validateParams,
  validateLogin,
  validateEdit,
};
