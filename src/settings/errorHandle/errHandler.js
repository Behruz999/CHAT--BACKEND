module.exports = (err, req, res, next) => {
  if (err) {
    return res
      .status(500)
      .json({
        msg: `Internal Server Error: ${err?.message ? err.message : err}`,
      });
  }

  next()
};
