import OpenAI, { toFile } from "openai";
import {
  AIParseResponse,
  CartAction,
  CartItem,
  ItemSize,
  MENU_ITEMS,
  MenuItem,
} from "@bistro/shared";
import { z } from "zod";

const quantityWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const sizeOptions: ItemSize[] = ["small", "medium", "large"];

const aliases: Record<string, string[]> = {
  "spicy-chicken-sandwich": ["spicy chicken sandwich", "spicy chicken", "chicken sandwich"],
  "classic-cheeseburger": ["cheeseburger", "burger", "classic cheeseburger"],
  "truffle-fries": ["truffle fries", "parmesan fries"],
  "sweet-potato-fries": ["sweet potato fries", "sweet fries"],
  "caesar-salad": ["caesar", "caesar salad"],
  "kale-avocado-salad": ["kale avocado salad", "kale salad", "avocado salad"],
  water: ["water", "still water"],
  "sparkling-water": ["sparkling water"],
  "house-lemonade": ["lemonade", "house lemonade"],
  "cold-brew": ["cold brew", "nitro cold brew", "coffee"],
  "lava-cake": ["lava cake", "chocolate cake", "dessert"],
  "signature-combo": ["combo", "signature combo", "bistro combo"],
};

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add"),
    itemId: z.string(),
    quantity: z.number().int().positive(),
    size: z.enum(sizeOptions).optional(),
  }),
  z.object({
    type: z.literal("remove"),
    itemId: z.string(),
    quantity: z.number().int().positive().optional(),
    size: z.enum(sizeOptions).optional(),
  }),
  z.object({
    type: z.literal("set_quantity"),
    itemId: z.string(),
    quantity: z.number().int().nonnegative(),
    size: z.enum(sizeOptions).optional(),
  }),
  z.object({
    type: z.literal("clear_cart"),
  }),
]);

const aiParseSchema = z.object({
  assistantMessage: z.string(),
  clarifyingQuestion: z.string().optional(),
  actions: z.array(actionSchema),
});

let cachedApiKey: string | undefined;
let cachedOpenAI: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    return null;
  }

  if (cachedOpenAI && cachedApiKey === apiKey) {
    return cachedOpenAI;
  }

  cachedApiKey = apiKey;
  cachedOpenAI = new OpenAI({ apiKey });
  return cachedOpenAI;
}

export function isOpenAIConfigured(): boolean {
  return Boolean((process.env.OPENAI_API_KEY ?? "").trim());
}

export async function transcribeOrderAudio(
  audioBytes: Buffer,
  filename = "order-audio.m4a",
  mimeType = "audio/m4a",
): Promise<string> {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("OpenAI is not configured");
  }

  const file = await toFile(audioBytes, filename, { type: mimeType });
  const configuredModel = process.env.OPENAI_TRANSCRIBE_MODEL;
  const modelCandidates = [
    ...new Set(
      [configuredModel, "gpt-4o-mini-transcribe", "whisper-1"].filter(
        (model): model is string => Boolean(model),
      ),
    ),
  ];

  let lastError: unknown;

  for (const model of modelCandidates) {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file,
        model,
      });

      let text = "";
      if (typeof transcription === "string") {
        text = transcription;
      } else if (
        transcription &&
        typeof transcription === "object" &&
        "text" in transcription &&
        typeof (transcription as { text?: unknown }).text === "string"
      ) {
        text = (transcription as { text: string }).text;
      }

      if (text.trim()) {
        return text.trim();
      }
    } catch (error) {
      lastError = error;
    }
  }

  const message =
    lastError && typeof lastError === "object" && "message" in lastError && typeof lastError.message === "string"
      ? lastError.message
      : "Transcription failed with all available models.";

  throw new Error(message);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function findSize(text: string): ItemSize | undefined {
  return sizeOptions.find((size) => text.includes(size));
}

function findQuantity(text: string): number | undefined {
  const numberMatch = text.match(/\b(\d+)\b/);
  if (numberMatch) {
    return Number(numberMatch[1]);
  }

  for (const [word, value] of Object.entries(quantityWords)) {
    if (text.includes(` ${word} `) || text.startsWith(`${word} `) || text.endsWith(` ${word}`) || text === word) {
      return value;
    }
  }

  return undefined;
}

function allAliases(item: MenuItem): string[] {
  const base = [item.name.toLowerCase(), item.name.toLowerCase().replace(/s$/, "")];
  return [...new Set([...(aliases[item.id] ?? []), ...base])];
}

function findItemsInSegment(segment: string): MenuItem[] {
  const matches: { item: MenuItem; score: number }[] = [];

  for (const item of MENU_ITEMS) {
    const aliasList = allAliases(item);
    let best = 0;

    for (const alias of aliasList) {
      if (segment.includes(alias) && alias.length > best) {
        best = alias.length;
      }
    }

    if (best > 0) {
      matches.push({ item, score: best });
    }
  }

  return matches.sort((a, b) => b.score - a.score).map((entry) => entry.item);
}

function inferActionType(segment: string): "add" | "remove" | "set_quantity" {
  if (/(remove|delete|take off|cancel|drop)/.test(segment)) {
    return "remove";
  }

  if (/(set|change|update|make)\b/.test(segment) && /(to|=|be)\b/.test(segment)) {
    return "set_quantity";
  }

  if (/(set|change|update|make)\b/.test(segment) && /\b\d+\b/.test(segment)) {
    return "set_quantity";
  }

  return "add";
}

function buildAssistantMessage(actions: CartAction[]): string {
  if (!actions.length) {
    return "I couldn't confidently map that request to menu items. Try naming the items and quantities.";
  }

  const summary = actions
    .map((action) => {
      if (action.type === "clear_cart") {
        return "cleared your cart";
      }

      const item = MENU_ITEMS.find((menuItem) => menuItem.id === action.itemId);
      const itemName = item?.name ?? action.itemId;
      const sizeText = action.size ? ` (${action.size})` : "";

      if (action.type === "add") {
        return `added ${action.quantity} x ${itemName}${sizeText}`;
      }

      if (action.type === "set_quantity") {
        return `set ${itemName}${sizeText} to ${action.quantity}`;
      }

      return action.quantity
        ? `removed ${action.quantity} x ${itemName}${sizeText}`
        : `removed ${itemName}${sizeText}`;
    })
    .join(", ");

  return `Done: ${summary}.`;
}

function heuristicParse(message: string): AIParseResponse {
  const normalized = ` ${normalize(message)} `;

  if (/(clear cart|empty cart|start over|reset cart)/.test(normalized)) {
    return {
      actions: [{ type: "clear_cart" }],
      assistantMessage: "Cleared your cart.",
    };
  }

  const segments = normalized
    .split(/\b(?:and|with|plus|,|\+)\b/)
    .map((part) => part.trim())
    .filter(Boolean);

  const actions: CartAction[] = [];

  for (const segment of segments) {
    const items = findItemsInSegment(segment);
    if (!items.length) {
      continue;
    }

    const size = findSize(segment);
    const actionType = inferActionType(segment);

    for (const item of items.slice(0, 1)) {
      const explicitQuantity = findQuantity(` ${segment} `);
      const quantity = explicitQuantity ?? 1;

      if (actionType === "add") {
        actions.push({
          type: "add",
          itemId: item.id,
          quantity,
          size: item.sizePrices ? size : undefined,
        });
      } else if (actionType === "set_quantity") {
        actions.push({
          type: "set_quantity",
          itemId: item.id,
          quantity,
          size: item.sizePrices ? size : undefined,
        });
      } else {
        actions.push({
          type: "remove",
          itemId: item.id,
          quantity: explicitQuantity,
          size: item.sizePrices ? size : undefined,
        });
      }
    }
  }

  return {
    actions,
    assistantMessage: buildAssistantMessage(actions),
  };
}

function sanitizeActions(actions: CartAction[]): CartAction[] {
  return actions.filter((action) => {
    if (action.type === "clear_cart") {
      return true;
    }

    const item = MENU_ITEMS.find((menuItem) => menuItem.id === action.itemId);
    if (!item) {
      return false;
    }

    if (action.size && !item.sizePrices?.[action.size]) {
      return false;
    }

    if (action.type === "add" || action.type === "set_quantity") {
      return action.type === "add" ? action.quantity > 0 : action.quantity >= 0;
    }

    return action.quantity === undefined || action.quantity > 0;
  });
}

async function parseWithOpenAI(message: string, cart: CartItem[]): Promise<AIParseResponse | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    return null;
  }

  const menuSummary = MENU_ITEMS.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    sizePrices: item.sizePrices,
    tags: item.tags,
  }));

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    temperature: 0,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content:
          "You are an ordering parser for a restaurant app. Convert user text into cart actions only. Return strict JSON with keys: assistantMessage (string), clarifyingQuestion (optional string), actions (array). Valid action.type values are add, remove, set_quantity, clear_cart. Use itemId values that exactly match the provided menu IDs.",
      },
      {
        role: "user",
        content: JSON.stringify({
          userMessage: message,
          menu: menuSummary,
          existingCart: cart,
          instructions: [
            "If request is ambiguous, return empty actions and a clarifyingQuestion.",
            "For drinks, include size if specified.",
            "Do not invent item IDs.",
          ],
        }),
      },
    ],
  });

  const rawText = completion.choices[0]?.message?.content;
  if (!rawText) {
    return null;
  }

  const parsed = aiParseSchema.safeParse(JSON.parse(rawText));
  if (!parsed.success) {
    return null;
  }

  const cleanedActions = sanitizeActions(parsed.data.actions);

  return {
    actions: cleanedActions,
    assistantMessage: parsed.data.assistantMessage,
    clarifyingQuestion: parsed.data.clarifyingQuestion,
  };
}

export async function parseOrderIntent(message: string, cart: CartItem[]): Promise<AIParseResponse> {
  const heuristic = heuristicParse(message);

  if (!isOpenAIConfigured()) {
    return heuristic;
  }

  try {
    const openAIParsed = await parseWithOpenAI(message, cart);
    if (!openAIParsed) {
      return heuristic;
    }

    if (!openAIParsed.actions.length && heuristic.actions.length) {
      return {
        ...heuristic,
        assistantMessage: `${openAIParsed.assistantMessage} I made a best-effort interpretation from your phrasing.`,
      };
    }

    return openAIParsed;
  } catch {
    return heuristic;
  }
}
