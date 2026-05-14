import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Props = {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  isRecording: boolean;
  onInputChange: (text: string) => void;
  onSend: () => void;
  onToggleVoice: () => void;
};

export function AssistantPanel({
  messages,
  input,
  isLoading,
  isRecording,
  onInputChange,
  onSend,
  onToggleVoice,
}: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>AI Order Assistant</Text>

      <View style={styles.messageList}>
        {messages.slice(-4).map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.role === "assistant" ? styles.assistantBubble : styles.userBubble,
            ]}
          >
            <Text style={message.role === "assistant" ? styles.assistantText : styles.userText}>{message.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={onInputChange}
          placeholder="Try: add two spicy chicken sandwiches and a large water"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          multiline
          autoCapitalize="sentences"
          editable={!isLoading}
        />
        <Pressable
          onPress={onToggleVoice}
          disabled={isLoading}
          style={[styles.voiceButton, isRecording ? styles.voiceButtonRecording : null, isLoading ? styles.voiceButtonDisabled : null]}
        >
          <Ionicons name={isRecording ? "stop-circle" : "mic"} size={16} color="#f8fafc" />
          <Text style={styles.voiceButtonText}>{isRecording ? "Stop" : "Voice"}</Text>
        </Pressable>
        <Pressable
          onPress={onSend}
          disabled={isLoading || !input.trim()}
          style={[styles.sendButton, !input.trim() || isLoading ? styles.sendButtonDisabled : null]}
        >
          <Text style={styles.sendButtonText}>{isLoading ? "..." : "Send"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  title: {
    color: "#e2e8f0",
    fontSize: 17,
    fontWeight: "800",
  },
  messageList: {
    gap: 8,
  },
  messageBubble: {
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 12,
    maxWidth: "94%",
  },
  assistantBubble: {
    backgroundColor: "#1e293b",
    alignSelf: "flex-start",
  },
  userBubble: {
    backgroundColor: "#0ea5e9",
    alignSelf: "flex-end",
  },
  assistantText: {
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 18,
  },
  userText: {
    color: "#f8fafc",
    fontSize: 13,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 92,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
    fontSize: 13,
  },
  sendButton: {
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  voiceButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voiceButtonRecording: {
    backgroundColor: "#ef4444",
  },
  voiceButtonDisabled: {
    backgroundColor: "#334155",
  },
  voiceButtonText: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: 13,
  },
  sendButtonDisabled: {
    backgroundColor: "#334155",
  },
  sendButtonText: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: 13,
  },
});
