import { create } from "zustand";
import { applyCartActions, CartAction, CartItem, ItemSize } from "@bistro/shared";

type CartState = {
  cart: CartItem[];
  addItem: (itemId: string, size?: ItemSize) => void;
  removeOne: (itemId: string, size?: ItemSize) => void;
  setQuantity: (itemId: string, quantity: number, size?: ItemSize) => void;
  applyActions: (actions: CartAction[]) => void;
  replaceCart: (cart: CartItem[]) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>((set) => ({
  cart: [],
  addItem: (itemId, size) => {
    set((state) => ({
      cart: applyCartActions(state.cart, [{ type: "add", itemId, quantity: 1, size }]),
    }));
  },
  removeOne: (itemId, size) => {
    set((state) => ({
      cart: applyCartActions(state.cart, [{ type: "remove", itemId, quantity: 1, size }]),
    }));
  },
  setQuantity: (itemId, quantity, size) => {
    set((state) => ({
      cart: applyCartActions(state.cart, [{ type: "set_quantity", itemId, quantity, size }]),
    }));
  },
  applyActions: (actions) => {
    set((state) => ({
      cart: applyCartActions(state.cart, actions),
    }));
  },
  replaceCart: (cart) => {
    set({ cart });
  },
  clear: () => {
    set({ cart: [] });
  },
}));
