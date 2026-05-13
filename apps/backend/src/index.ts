import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/ai/parse-order", async (req, res) => {
  // TODO: call OpenAI and return structured actions
  res.json({
    actions: [],
    assistantMessage: "Parser stub ready"
  });
});

app.listen(4000, () => console.log("API running on http://localhost:4000"));
