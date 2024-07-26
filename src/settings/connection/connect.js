const { PORT, DB_URL } = process.env;
const { connect } = require("mongoose");

async function dbConnection(req, res, next) {
  try {
    await connect(DB_URL);
    console.log(`DB's running...`);
  } catch (err) {
    next(err);
  }
}

function portConnection(server) {
  server.listen(PORT, () => {
    console.log(`${PORT} port's running...`);
  });
}

module.exports = {
  dbConnection,
  portConnection,
};
