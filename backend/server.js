require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const productRoutes = require("./routes/productRoutes");
const partyRoutes = require("./routes/partyRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Health check: verify the API and database.
app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    return res.status(200).json({
      success: true,
      message: "Stock System backend is healthy",
      database: "connected",
      databaseTime: result.rows[0].database_time,
    });
  } catch (error) {
    console.error("Health check database error:", error.message);

    return res.status(503).json({
      success: false,
      message: "Backend is running, but database connection failed",
      database: "disconnected",
    });
  }
});

// Start the API server.
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Stock System API running on port ${PORT}`);
});

// Gracefully close the database pool when the server stops.
function shutdown() {
  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error("Error closing database pool:", error.message);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);