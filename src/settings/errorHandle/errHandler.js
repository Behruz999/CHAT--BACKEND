module.exports = (err, req, res, next) => {
  if (err) {
    console.log('le;di');
    console.error(err?.message ? err.message : err);
    return res.status(500).json({
      status: "error",
      msg: `Internal Server Error: ${err?.message ? err.message : err}`,
    });
  }
};
