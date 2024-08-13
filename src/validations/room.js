const Joi = require("joi");

const paramsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
}).options({ allowUnknown: false });

const bodySchema = Joi.object({
  name: Joi.string().trim().required(),
  desc: Joi.string().trim(),
  password: Joi.string()
    .trim()
    .when("isPublic", {
      is: false,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  creator: Joi.string().hex().length(24).trim().required(),
  members: Joi.array().items(
    Joi.string().hex().length(24).trim().required()
  ),
  isPublic: Joi.boolean(),
}).options({ allowUnknown: false });

const editSchema = Joi.object({
  name: Joi.string().trim(),
  desc: Joi.string().trim(),
  password: Joi.string().trim(),
  members: Joi.array().items({
    content: Joi.string().hex().length(24).trim().required(),
    status: Joi.number().required(),
  }),
  isPublic: Joi.boolean(),
}).options({ allowUnknown: false });

async function validateParams(req, res, next) {
  try {
    await paramsSchema.validateAsync(req.params);
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
  validateBody,
  validateEdit,
};
