import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server is running on http://0.0.0.0:${PORT} (reachable at http://localhost:${PORT} and on LAN)`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    process.exit(0);
  });
});

export default server;
