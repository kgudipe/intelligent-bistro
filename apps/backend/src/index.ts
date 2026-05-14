import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
import multer from "multer";
import { AIParseRequest, applyCartActions, CartItem, MENU_ITEMS } from "@bistro/shared";
import { isOpenAIConfigured, parseOrderIntent, transcribeOrderAudio } from "./parser";

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  override: true,
});

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const port = Number(process.env.PORT ?? 4000);

const cartItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  size: z.enum(["small", "medium", "large"]).optional(),
});

const parseOrderSchema = z.object({
  message: z.string().min(1),
  cart: z.array(cartItemSchema).default([]),
});

const applyActionsSchema = z.object({
  cart: z.array(cartItemSchema).default([]),
  actions: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("add"),
        itemId: z.string().min(1),
        quantity: z.number().int().positive(),
        size: z.enum(["small", "medium", "large"]).optional(),
      }),
      z.object({
        type: z.literal("remove"),
        itemId: z.string().min(1),
        quantity: z.number().int().positive().optional(),
        size: z.enum(["small", "medium", "large"]).optional(),
      }),
      z.object({
        type: z.literal("set_quantity"),
        itemId: z.string().min(1),
        quantity: z.number().int().nonnegative(),
        size: z.enum(["small", "medium", "large"]).optional(),
      }),
      z.object({
        type: z.literal("clear_cart"),
      }),
    ]),
  ),
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "intelligent-bistro-api" });
});

app.get("/menu", (_req, res) => {
  res.json({ items: MENU_ITEMS });
});

app.post("/cart/apply-actions", (req, res) => {
  const parsed = applyActionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid payload",
      issues: parsed.error.flatten(),
    });
    return;
  }

  const nextCart = applyCartActions(parsed.data.cart, parsed.data.actions);
  res.json({ cart: nextCart });
});

app.post("/ai/parse-order", async (req, res) => {
  const parsed = parseOrderSchema.safeParse(req.body as AIParseRequest);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      issues: parsed.error.flatten(),
    });
    return;
  }

  const response = await parseOrderIntent(parsed.data.message, parsed.data.cart as CartItem[]);
  const nextCart = applyCartActions(parsed.data.cart as CartItem[], response.actions);

  res.json({
    ...response,
    cart: nextCart,
  });
});

app.post("/ai/voice-order", upload.single("audio"), async (req, res) => {
  const audioFile = req.file;
  if (!audioFile) {
    res.status(400).json({ error: "Missing audio file. Send multipart/form-data with field name `audio`." });
    return;
  }

  if (!isOpenAIConfigured()) {
    res.status(503).json({ error: "Voice transcription requires OPENAI_API_KEY on the backend." });
    return;
  }

  let cart: CartItem[] = [];
  if (typeof req.body.cart === "string" && req.body.cart.trim()) {
    try {
      const maybeCart = JSON.parse(req.body.cart);
      const cartParsed = z.array(cartItemSchema).safeParse(maybeCart);
      if (!cartParsed.success) {
        res.status(400).json({
          error: "Invalid `cart` payload in multipart body.",
          issues: cartParsed.error.flatten(),
        });
        return;
      }
      cart = cartParsed.data as CartItem[];
    } catch {
      res.status(400).json({ error: "Invalid JSON in multipart field `cart`." });
      return;
    }
  }

  try {
    const transcript = await transcribeOrderAudio(
      audioFile.buffer,
      audioFile.originalname || "order-audio.m4a",
      audioFile.mimetype || "audio/m4a",
    );

    if (!transcript) {
      res.status(422).json({ error: "Could not detect speech from audio." });
      return;
    }

    const response = await parseOrderIntent(transcript, cart);
    const nextCart = applyCartActions(cart, response.actions);

    res.json({
      transcript,
      ...response,
      cart: nextCart,
    });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "Voice parsing failed.";
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
