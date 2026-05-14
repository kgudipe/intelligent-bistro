import { LinearGradient } from "expo-linear-gradient";
import { ItemSize, MenuItem, getItemPrice } from "@bistro/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  item: MenuItem;
  selectedSize?: ItemSize;
  inCartQuantity: number;
  onSizeSelect: (size: ItemSize) => void;
  onAdd: () => void;
};

const cardGradients: Record<MenuItem["category"], [string, string]> = {
  signature: ["#0f172a", "#1d4ed8"],
  sandwiches: ["#7c2d12", "#ea580c"],
  salads: ["#14532d", "#16a34a"],
  sides: ["#312e81", "#4f46e5"],
  drinks: ["#0f172a", "#0891b2"],
  desserts: ["#581c87", "#c026d3"],
};

export function MenuCard({ item, selectedSize, inCartQuantity, onSizeSelect, onAdd }: Props) {
  const hasSizes = Boolean(item.sizePrices);
  const effectiveSize = hasSizes ? selectedSize ?? "medium" : undefined;
  const price = getItemPrice(item, effectiveSize);

  return (
    <LinearGradient colors={cardGradients[item.category]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.price}>${price.toFixed(2)}</Text>
      </View>

      <Text style={styles.description}>{item.description}</Text>

      <View style={styles.metaRow}>
        <View style={styles.tagsWrap}>
          {item.tags.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {inCartQuantity > 0 ? (
          <View style={styles.inCartPill}>
            <Text style={styles.inCartText}>{inCartQuantity} in cart</Text>
          </View>
        ) : null}
      </View>

      {item.sizePrices ? (
        <View style={styles.sizeRow}>
          {Object.keys(item.sizePrices).map((rawSize) => {
            const size = rawSize as ItemSize;
            const active = effectiveSize === size;
            return (
              <Pressable
                key={size}
                onPress={() => onSizeSelect(size)}
                style={[styles.sizeButton, active ? styles.sizeButtonActive : null]}
              >
                <Text style={[styles.sizeButtonText, active ? styles.sizeButtonTextActive : null]}>{size}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable onPress={onAdd} style={styles.addButton}>
        <Text style={styles.addButtonText}>Add to cart</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  itemName: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  price: {
    color: "#fef3c7",
    fontSize: 16,
    fontWeight: "700",
  },
  description: {
    marginTop: 8,
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  tagPill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  tagText: {
    fontSize: 11,
    color: "#e2e8f0",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "700",
  },
  inCartPill: {
    marginLeft: 8,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "rgba(16, 185, 129, 0.22)",
  },
  inCartText: {
    fontSize: 11,
    color: "#d1fae5",
    fontWeight: "700",
  },
  sizeRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  sizeButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sizeButtonActive: {
    backgroundColor: "#f8fafc",
  },
  sizeButtonText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  sizeButtonTextActive: {
    color: "#0f172a",
  },
  addButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
