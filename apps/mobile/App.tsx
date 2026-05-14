import Ionicons from "@expo/vector-icons/Ionicons";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import {
  CATEGORY_TITLES,
  CartItem,
  ItemSize,
  MENU_ITEMS,
  MenuCategory,
  MenuItem,
} from "@bistro/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AssistantPanel, ChatMessage } from "./src/components/AssistantPanel";
import { CartPanel } from "./src/components/CartPanel";
import { MenuCard } from "./src/components/MenuCard";
import { API_BASE_URL, fetchMenu, parseOrder, parseVoiceOrder } from "./src/lib/api";
import { useCartStore } from "./src/store/cartStore";

type CategoryFilter = "all" | MenuCategory;
type AppScreen = "home" | "cart";

const defaultMessages: ChatMessage[] = [
  {
    id: "assistant-hello",
    role: "assistant",
    text: "Welcome to Intelligent Bistro. Ask me naturally, for example: 'Add two spicy chicken sandwiches and one large water.'",
  },
];

function toMap(items: MenuItem[]): Record<string, MenuItem> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function sizeFromItem(item: MenuItem, current?: ItemSize): ItemSize | undefined {
  if (!item.sizePrices) {
    return undefined;
  }

  const sizes = Object.keys(item.sizePrices) as ItemSize[];
  if (current && sizes.includes(current)) {
    return current;
  }

  if (sizes.includes("medium")) {
    return "medium";
  }

  return sizes[0];
}

function quantityInCart(cart: CartItem[], itemId: string): number {
  return cart
    .filter((item) => item.itemId === itemId)
    .reduce((total, item) => total + item.quantity, 0);
}

export default function App() {
  const [menu, setMenu] = useState<MenuItem[]>(MENU_ITEMS);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [selectedSizes, setSelectedSizes] = useState<Record<string, ItemSize>>({});
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(defaultMessages);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [menuLoading, setMenuLoading] = useState(true);
  const [screen, setScreen] = useState<AppScreen>("home");
  const recordingRef = useRef<Audio.Recording | null>(null);

  const cart = useCartStore((state) => state.cart);
  const addItem = useCartStore((state) => state.addItem);
  const removeOne = useCartStore((state) => state.removeOne);
  const clearCart = useCartStore((state) => state.clear);
  const replaceCart = useCartStore((state) => state.replaceCart);

  const menuById = useMemo(() => toMap(menu), [menu]);

  useEffect(() => {
    let mounted = true;

    async function loadMenu() {
      setMenuLoading(true);

      const remoteMenu = await fetchMenu();
      if (!mounted) {
        return;
      }

      setMenu(remoteMenu);
      setMenuLoading(false);
    }

    loadMenu();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      const recording = recordingRef.current;
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => undefined);
      }
      Speech.stop();
    };
  }, []);

  const filteredMenu = useMemo(() => {
    if (activeCategory === "all") {
      return menu;
    }

    return menu.filter((item) => item.category === activeCategory);
  }, [activeCategory, menu]);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartBadgeText = cartCount > 99 ? "99+" : String(cartCount);

  function onAddFromCard(item: MenuItem) {
    const size = sizeFromItem(item, selectedSizes[item.id]);
    addItem(item.id, size);
  }

  async function onSendMessage() {
    const message = chatInput.trim();
    if (!message || isSending) {
      return;
    }

    setChatInput("");
    setIsSending(true);

    setChatMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: message,
      },
    ]);

    try {
      const response = await parseOrder(message, cart);
      replaceCart(response.cart);

      const aiText = response.clarifyingQuestion
        ? `${response.assistantMessage} ${response.clarifyingQuestion}`
        : response.assistantMessage;

      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: aiText,
        },
      ]);
    } catch {
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "I couldn't reach the backend. Make sure the Node API is running on your local network.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function startVoiceRecording() {
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== "granted") {
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "Microphone permission is required for voice ordering.",
        },
      ]);
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
  }

  async function stopVoiceRecordingAndSend() {
    const recording = recordingRef.current;
    if (!recording) {
      return;
    }

    setIsSending(true);
    setIsRecording(false);
    recordingRef.current = null;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      if (!uri) {
        setChatMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: "I couldn't capture audio. Please try again.",
          },
        ]);
        return;
      }

      const response = await parseVoiceOrder(uri, cart);
      replaceCart(response.cart);

      setChatMessages((current) => [
        ...current,
        {
          id: `user-voice-${Date.now()}`,
          role: "user",
          text: `Voice: ${response.transcript}`,
        },
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: response.clarifyingQuestion
            ? `${response.assistantMessage} ${response.clarifyingQuestion}`
            : response.assistantMessage,
        },
      ]);

      Speech.stop();
      Speech.speak(
        response.clarifyingQuestion
          ? `${response.assistantMessage} ${response.clarifyingQuestion}`
          : response.assistantMessage,
      );
    } catch (error) {
      let message = "Voice request failed. Please check backend connection and OpenAI key.";
      if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
        message = error.message;
      }

      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: message,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function onToggleVoice() {
    if (isSending) {
      return;
    }

    if (isRecording) {
      await stopVoiceRecordingAndSend();
      return;
    }

    await startVoiceRecording();
  }

  return (
    <LinearGradient colors={["#f8fafc", "#ecfeff", "#fef9c3"]} style={styles.rootGradient}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topNavBar}>
          {screen === "home" ? (
            <>
              <View>
                <Text style={styles.topNavTitle}>Intelligent Bistro</Text>
                <Text style={styles.topNavSubtitle}>AI-powered ordering</Text>
              </View>

              <Pressable onPress={() => setScreen("cart")} style={styles.cartIconButton}>
                <Ionicons name="cart-outline" size={23} color="#0f172a" />
                {cartCount > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{cartBadgeText}</Text>
                  </View>
                ) : null}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => setScreen("home")} style={styles.backButton}>
                <Ionicons name="chevron-back" size={18} color="#0f172a" />
                <Text style={styles.backButtonText}>Back to Menu</Text>
              </Pressable>

              <View style={styles.cartSummaryPill}>
                <Ionicons name="cart" size={14} color="#f8fafc" />
                <Text style={styles.cartSummaryText}>{cartBadgeText}</Text>
              </View>
            </>
          )}
        </View>

        {screen === "home" ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.headerCard}>
              <Text style={styles.kicker}>AI Dining Experience</Text>
              <Text style={styles.pageTitle}>Intelligent Bistro</Text>
              <Text style={styles.subtitle}>
                Browse menu, update your order manually, or ask the assistant to modify the cart.
              </Text>
              <View style={styles.headerMetaRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaText}>{cartCount} items in cart</Text>
                </View>
                {/* <View style={styles.metaPillMuted}>
                  <Text style={styles.metaTextMuted}>API: {API_BASE_URL}</Text>
                </View> */}
              </View>
            </View>

            <View style={styles.categoryRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScrollContent}>
                <Pressable
                  style={[styles.categoryPill, activeCategory === "all" ? styles.categoryPillActive : null]}
                  onPress={() => setActiveCategory("all")}
                >
                  <Text style={[styles.categoryText, activeCategory === "all" ? styles.categoryTextActive : null]}>All</Text>
                </Pressable>

                {(Object.keys(CATEGORY_TITLES) as MenuCategory[]).map((category) => (
                  <Pressable
                    key={category}
                    style={[styles.categoryPill, activeCategory === category ? styles.categoryPillActive : null]}
                    onPress={() => setActiveCategory(category)}
                  >
                    <Text
                      style={[styles.categoryText, activeCategory === category ? styles.categoryTextActive : null]}
                    >
                      {CATEGORY_TITLES[category]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Menu</Text>
              <Text style={styles.sectionMeta}>{menuLoading ? "Refreshing..." : `${filteredMenu.length} items`}</Text>
            </View>

            <View>
              {filteredMenu.map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  selectedSize={selectedSizes[item.id]}
                  inCartQuantity={quantityInCart(cart, item.id)}
                  onSizeSelect={(size) => {
                    setSelectedSizes((current) => ({
                      ...current,
                      [item.id]: size,
                    }));
                  }}
                  onAdd={() => onAddFromCard(item)}
                />
              ))}
            </View>

            <Pressable style={styles.viewCartButton} onPress={() => setScreen("cart")}>
              <Text style={styles.viewCartButtonText}>View Cart</Text>
              <View style={styles.viewCartCountPill}>
                <Text style={styles.viewCartCountText}>{cartBadgeText}</Text>
              </View>
            </Pressable>

            {/* <Text style={styles.footerNote}>
              Tip: set EXPO_PUBLIC_API_BASE_URL in `apps/mobile/.env` when running on a physical iPhone.
            </Text> */}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.cartPageHeader}>
              <Text style={styles.cartPageTitle}>Your Order</Text>
              <Text style={styles.cartPageSubtitle}>Review and adjust quantities before checkout.</Text>
            </View>

            <CartPanel
              cart={cart}
              menuById={menuById}
              onIncrease={(itemId, size) => addItem(itemId, size)}
              onDecrease={(itemId, size) => removeOne(itemId, size)}
              onClear={clearCart}
            />

            <Pressable style={styles.continueButton} onPress={() => setScreen("home")}>
              <Text style={styles.continueButtonText}>Continue Browsing Menu</Text>
            </Pressable>
          </ScrollView>
        )}

        <View pointerEvents="box-none" style={styles.assistantFloatingLayer}>
          {isAssistantOpen ? (
            <View style={styles.assistantFloatingPanel}>
              <View style={styles.assistantFloatingHeader}>
                <Text style={styles.assistantFloatingTitle}>AI Assistant</Text>
                <Pressable onPress={() => setIsAssistantOpen(false)} style={styles.assistantFloatingCloseButton}>
                  <Ionicons name="close" size={16} color="#cbd5e1" />
                </Pressable>
              </View>

              <AssistantPanel
                messages={chatMessages}
                input={chatInput}
                isLoading={isSending}
                isRecording={isRecording}
                onInputChange={setChatInput}
                onSend={onSendMessage}
                onToggleVoice={onToggleVoice}
              />
            </View>
          ) : null}

          <Pressable
            onPress={() => setIsAssistantOpen((current) => !current)}
            style={[
              styles.assistantFloatingButton,
              isAssistantOpen ? styles.assistantFloatingButtonActive : null,
            ]}
          >
            <Ionicons name={isAssistantOpen ? "chevron-down" : "sparkles"} size={18} color="#f8fafc" />
            {!isAssistantOpen ? <Text style={styles.assistantFloatingButtonText}>AI</Text> : null}
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  rootGradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topNavBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topNavTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
  },
  topNavSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  cartIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  backButtonText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  cartSummaryPill: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cartSummaryText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 118,
    gap: 14,
  },
  headerCard: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    padding: 16,
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 10,
  },
  kicker: {
    fontSize: 11,
    color: "#38bdf8",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  pageTitle: {
    marginTop: 8,
    color: "#f8fafc",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
  },
  headerMetaRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: "#0ea5e9",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  metaPillMuted: {
    borderRadius: 999,
    backgroundColor: "#1e293b",
    paddingVertical: 7,
    paddingHorizontal: 10,
    maxWidth: "75%",
  },
  metaText: {
    color: "#f0f9ff",
    fontWeight: "700",
    fontSize: 12,
  },
  metaTextMuted: {
    color: "#cbd5e1",
    fontWeight: "600",
    fontSize: 11,
  },
  categoryRow: {
    marginTop: 2,
  },
  categoryScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  categoryPill: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoryPillActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  categoryText: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
  },
  categoryTextActive: {
    color: "#f8fafc",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 22,
  },
  sectionMeta: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
  },
  viewCartButton: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewCartButtonText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  viewCartCountPill: {
    backgroundColor: "#ef4444",
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  viewCartCountText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  cartPageHeader: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 14,
  },
  cartPageTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
  },
  cartPageSubtitle: {
    marginTop: 6,
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18,
  },
  continueButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0f172a",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  continueButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
  },
  footerNote: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  assistantFloatingLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 28,
  },
  assistantFloatingPanel: {
    width: "100%",
    maxWidth: 360,
    marginBottom: 12,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 12,
  },
  assistantFloatingHeader: {
    backgroundColor: "#0b1220",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  assistantFloatingTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  assistantFloatingCloseButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
  },
  assistantFloatingButton: {
    minWidth: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 8,
  },
  assistantFloatingButtonActive: {
    backgroundColor: "#0f172a",
  },
  assistantFloatingButtonText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
