const Joi = require("joi");

const paramsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
}).options({ allowUnknown: false });

const bodySchema = Joi.object({
  name: Joi.string().trim(true).required(),
  desc: Joi.string().trim(true),
  password: Joi.string()
    .trim(true)
    .when("isPublic", {
      is: false,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  creator: Joi.string().hex().length(24).trim(true).required(),
  members: Joi.array().items(
    Joi.string().hex().length(24).trim(true).required()
  ),
  isPublic: Joi.boolean(),
}).options({ allowUnknown: false });

const editSchema = Joi.object({
  name: Joi.string().trim(true),
  desc: Joi.string().trim(true),
  password: Joi.string().trim(true),
  members: Joi.array().items({
    content: Joi.string().hex().length(24).trim(true).required(),
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
