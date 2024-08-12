const { PORT, DB_URL } = process.env;
const { connect } = require("mongoose");

async function dbConnection() {
  try {
    await connect(DB_URL);
    console.log(`DB's running...`);
  } catch (err) {
    console.error(err.message ? err.message : err);
    throw new Error(
      `Database connection failed: ${err.message ? err.message : err}`
    );
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
