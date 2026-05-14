export type ItemSize = "small" | "medium" | "large";

export type MenuCategory =
  | "signature"
  | "sandwiches"
  | "salads"
  | "sides"
  | "drinks"
  | "desserts";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  tags: string[];
  sizePrices?: Partial<Record<ItemSize, number>>;
};

export type CartItem = {
  itemId: string;
  quantity: number;
  size?: ItemSize;
};

export type CartAction =
  | { type: "add"; itemId: string; quantity: number; size?: ItemSize }
  | { type: "remove"; itemId: string; quantity?: number; size?: ItemSize }
  | { type: "set_quantity"; itemId: string; quantity: number; size?: ItemSize }
  | { type: "clear_cart" };

export type AIParseRequest = {
  message: string;
  cart: CartItem[];
};

export type AIParseResponse = {
  actions: CartAction[];
  assistantMessage: string;
  clarifyingQuestion?: string;
};

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "spicy-chicken-sandwich",
    name: "Spicy Chicken Sandwich",
    description: "Crispy chicken, chili aioli, slaw, toasted brioche.",
    category: "sandwiches",
    price: 11.5,
    tags: ["spicy", "popular"],
  },
  {
    id: "classic-cheeseburger",
    name: "Classic Cheeseburger",
    description: "Smash patty, cheddar, pickles, special sauce.",
    category: "sandwiches",
    price: 10.75,
    tags: ["beef", "popular"],
  },
  {
    id: "truffle-fries",
    name: "Truffle Parmesan Fries",
    description: "Crispy fries, truffle oil, parmesan, herbs.",
    category: "sides",
    price: 6.5,
    tags: ["vegetarian"],
  },
  {
    id: "sweet-potato-fries",
    name: "Sweet Potato Fries",
    description: "Sea salt, paprika, garlic dip.",
    category: "sides",
    price: 5.95,
    tags: ["vegetarian", "gluten-free"],
  },
  {
    id: "caesar-salad",
    name: "Caesar Salad",
    description: "Romaine, croutons, parmesan, house caesar dressing.",
    category: "salads",
    price: 9.25,
    tags: ["vegetarian"],
  },
  {
    id: "kale-avocado-salad",
    name: "Kale Avocado Salad",
    description: "Kale, avocado, citrus vinaigrette, pumpkin seeds.",
    category: "salads",
    price: 10.25,
    tags: ["vegan", "gluten-free"],
  },
  {
    id: "water",
    name: "Still Water",
    description: "Filtered spring water.",
    category: "drinks",
    price: 2,
    tags: ["zero-sugar"],
    sizePrices: {
      small: 2,
      medium: 2.5,
      large: 3,
    },
  },
  {
    id: "sparkling-water",
    name: "Sparkling Water",
    description: "Naturally carbonated mineral water.",
    category: "drinks",
    price: 2.75,
    tags: ["zero-sugar"],
    sizePrices: {
      small: 2.75,
      medium: 3.25,
      large: 3.75,
    },
  },
  {
    id: "house-lemonade",
    name: "House Lemonade",
    description: "Fresh squeezed lemon, cane sugar, mint.",
    category: "drinks",
    price: 3.5,
    tags: ["refreshing"],
    sizePrices: {
      small: 3.5,
      medium: 4,
      large: 4.5,
    },
  },
  {
    id: "cold-brew",
    name: "Nitro Cold Brew",
    description: "Smooth single-origin cold brew on nitro tap.",
    category: "drinks",
    price: 4,
    tags: ["caffeine"],
    sizePrices: {
      small: 4,
      medium: 4.5,
      large: 5,
    },
  },
  {
    id: "lava-cake",
    name: "Chocolate Lava Cake",
    description: "Warm chocolate center with vanilla bean cream.",
    category: "desserts",
    price: 7,
    tags: ["popular"],
  },
  {
    id: "signature-combo",
    name: "Signature Bistro Combo",
    description: "Any sandwich, side, and medium drink.",
    category: "signature",
    price: 18.5,
    tags: ["best-value"],
  },
];

export const CATEGORY_TITLES: Record<MenuCategory, string> = {
  signature: "Signature",
  sandwiches: "Sandwiches",
  salads: "Salads",
  sides: "Sides",
  drinks: "Drinks",
  desserts: "Desserts",
};

export function getItemPrice(item: MenuItem, size?: ItemSize): number {
  if (size && item.sizePrices?.[size]) {
    return item.sizePrices[size] as number;
  }

  return item.price;
}

export function findMenuItemById(itemId: string): MenuItem | undefined {
  return MENU_ITEMS.find((item) => item.id === itemId);
}

function cartKey(itemId: string, size?: ItemSize): string {
  return `${itemId}::${size ?? "regular"}`;
}

function mergeCartItems(items: CartItem[]): CartItem[] {
  const byKey = new Map<string, CartItem>();

  for (const item of items) {
    if (item.quantity <= 0) {
      continue;
    }

    const key = cartKey(item.itemId, item.size);
    const existing = byKey.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }

    byKey.set(key, { ...item });
  }

  return [...byKey.values()];
}

export function applyCartActions(currentCart: CartItem[], actions: CartAction[]): CartItem[] {
  let next = mergeCartItems(currentCart);

  for (const action of actions) {
    if (action.type === "clear_cart") {
      next = [];
      continue;
    }

    if (action.type === "add") {
      next = mergeCartItems([
        ...next,
        {
          itemId: action.itemId,
          quantity: action.quantity,
          size: action.size,
        },
      ]);
      continue;
    }

    if (action.type === "set_quantity") {
      let matched = false;

      next = next
        .map((cartItem) => {
          if (cartItem.itemId === action.itemId && cartItem.size === action.size) {
            matched = true;
            return {
              ...cartItem,
              quantity: action.quantity,
            };
          }

          return cartItem;
        })
        .filter((cartItem) => cartItem.quantity > 0);

      if (!matched && action.quantity > 0) {
        next = mergeCartItems([
          ...next,
          {
            itemId: action.itemId,
            size: action.size,
            quantity: action.quantity,
          },
        ]);
      }
      continue;
    }

    if (action.type === "remove") {
      const removeQuantity = action.quantity ?? Number.MAX_SAFE_INTEGER;
      let pending = removeQuantity;

      next = next
        .map((cartItem) => {
          const sameItem = cartItem.itemId === action.itemId;
          const sameSize = action.size ? cartItem.size === action.size : true;

          if (!sameItem || !sameSize || pending <= 0) {
            return cartItem;
          }

          const deduction = Math.min(cartItem.quantity, pending);
          pending -= deduction;

          return {
            ...cartItem,
            quantity: cartItem.quantity - deduction,
          };
        })
        .filter((cartItem) => cartItem.quantity > 0);
    }
  }

  return mergeCartItems(next);
}
