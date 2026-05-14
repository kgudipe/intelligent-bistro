import { AIParseResponse, CartItem, MENU_ITEMS, MenuItem } from "@bistro/shared";
import { Platform } from "react-native";

const defaultApi = Platform.select({
  android: "http://10.0.2.2:4000",
  ios: "http://localhost:4000",
  default: "http://localhost:4000",
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApi;

type ParseOrderResult = AIParseResponse & {
  cart: CartItem[];
};

type VoiceOrderResult = ParseOrderResult & {
  transcript: string;
};

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function fetchMenu(): Promise<MenuItem[]> {
  try {
    const response = await requestJSON<{ items: MenuItem[] }>("/menu");
    return response.items;
  } catch {
    // Local fallback keeps UI interactive even when backend is down.
    return MENU_ITEMS;
  }
}

export async function parseOrder(message: string, cart: CartItem[]): Promise<ParseOrderResult> {
  return requestJSON<ParseOrderResult>("/ai/parse-order", {
    method: "POST",
    body: JSON.stringify({
      message,
      cart,
    }),
  });
}

function inferAudioMeta(audioUri: string): { fileName: string; mimeType: string } {
  const cleanedUri = audioUri.split("?")[0]?.toLowerCase() ?? "";
  const extension = cleanedUri.split(".").pop() ?? "m4a";

  const mimeTypeByExtension: Record<string, string> = {
    m4a: "audio/m4a",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
    caf: "audio/x-caf",
  };

  return {
    fileName: `voice-order.${extension}`,
    mimeType: mimeTypeByExtension[extension] ?? "audio/m4a",
  };
}

export async function parseVoiceOrder(audioUri: string, cart: CartItem[]): Promise<VoiceOrderResult> {
  const formData = new FormData();
  const meta = inferAudioMeta(audioUri);

  formData.append(
    "audio",
    {
      uri: audioUri,
      name: meta.fileName,
      type: meta.mimeType,
    } as unknown as Blob,
  );
  formData.append("cart", JSON.stringify(cart));

  const response = await fetch(`${API_BASE_URL}/ai/voice-order`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    let parsedError: string | undefined;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      parsedError = parsed.error;
    } catch {
      parsedError = undefined;
    }
    if (parsedError) {
      throw new Error(parsedError);
    }
    throw new Error(`Voice API ${response.status}: ${text}`);
  }

  return (await response.json()) as VoiceOrderResult;
}
