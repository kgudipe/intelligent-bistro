import { CartItem, ItemSize, MenuItem, getItemPrice } from "@bistro/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  cart: CartItem[];
  menuById: Record<string, MenuItem>;
  onIncrease: (itemId: string, size?: ItemSize) => void;
  onDecrease: (itemId: string, size?: ItemSize) => void;
  onClear: () => void;
};

function lineTotal(item: CartItem, menuById: Record<string, MenuItem>): number {
  const menuItem = menuById[item.itemId];
  if (!menuItem) {
    return 0;
  }

  return getItemPrice(menuItem, item.size) * item.quantity;
}

export function CartPanel({ cart, menuById, onIncrease, onDecrease, onClear }: Props) {
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce((total, item) => total + lineTotal(item, menuById), 0);

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Your Cart</Text>
        <Text style={styles.count}>{itemCount} items</Text>
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Your cart is empty. Add from menu or ask the assistant.</Text>
        </View>
      ) : (
        <View style={styles.itemsWrap}>
          {cart.map((cartItem) => {
            const menuItem = menuById[cartItem.itemId];
            if (!menuItem) {
              return null;
            }

            const total = lineTotal(cartItem, menuById);

            return (
              <View key={`${cartItem.itemId}-${cartItem.size ?? "regular"}`} style={styles.row}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{menuItem.name}</Text>
                  <Text style={styles.itemMeta}>
                    {cartItem.size ? `${cartItem.size} • ` : ""}${menuItem.category}
                  </Text>
                </View>

                <View style={styles.controlsWrap}>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => onDecrease(cartItem.itemId, cartItem.size)} style={styles.stepButton}>
                      <Text style={styles.stepText}>-</Text>
                    </Pressable>
                    <Text style={styles.quantityText}>{cartItem.quantity}</Text>
                    <Pressable onPress={() => onIncrease(cartItem.itemId, cartItem.size)} style={styles.stepButton}>
                      <Text style={styles.stepText}>+</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.linePrice}>${total.toFixed(2)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.footerRow}>
        <View>
          <Text style={styles.subtotalLabel}>Subtotal</Text>
          <Text style={styles.subtotalValue}>${subtotal.toFixed(2)}</Text>
        </View>
        <Pressable onPress={onClear} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  count: {
    color: "#475569",
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 14,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
  },
  itemsWrap: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
    textTransform: "capitalize",
  },
  controlsWrap: {
    alignItems: "flex-end",
    gap: 4,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  stepButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 18,
  },
  quantityText: {
    width: 28,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  linePrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
  },
  subtotalLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  subtotalValue: {
    fontSize: 20,
    color: "#0f172a",
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  clearButton: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
});
