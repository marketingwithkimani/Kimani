import express from "express";

let app;
try {
  // Use async import to catch compilation/initialization errors
  // We use .js since type: module is enabled, but wrapped safely
  const mod = await import("../Relationship/execution/server.js");
  app = mod.default || mod.app || mod;
} catch (error) {
  app = express();
  app.all("*", (req, res) => {
    res.status(500).json({
      error: "Vercel Server Initialization Crash",
      message: error.message,
      stack: error.stack
    });
  });
}

export default app;
