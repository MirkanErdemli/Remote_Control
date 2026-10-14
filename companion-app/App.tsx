import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { StatusBar } from "expo-status-bar";

type ConnectionState = "disconnected" | "connecting" | "connected";

export default function App() {
  const [serverHost, setServerHost] = useState("192.168.1.100");
  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [speed, setSpeed] = useState(1);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    socketRef.current?.close();
    setStatus("connecting");

    const socket = new WebSocket(`ws://${serverHost}:8787`);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("connected");
      socket.send(JSON.stringify({ role: "phone", type: "hello" }));
    };
    socket.onclose = () => setStatus("disconnected");
    socket.onerror = () => setStatus("disconnected");
  }, [serverHost]);

  useEffect(() => {
    return () => socketRef.current?.close();
  }, []);

  const send = useCallback((command: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(command));
    }
  }, []);

  const dotColor =
    status === "connected" ? "#2e7d32" : status === "connecting" ? "#f9a825" : "#c62828";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Video Remote Control</Text>

      <View style={styles.connectRow}>
        <TextInput
          style={styles.input}
          value={serverHost}
          onChangeText={setServerHost}
          placeholder="Local server IP (orn. 192.168.1.100)"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.connectButton} onPress={connect}>
          <Text style={styles.buttonText}>Baglan</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.statusText}>
          {status === "connected"
            ? "Baglandi"
            : status === "connecting"
            ? "Baglaniyor..."
            : "Bagli degil"}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.bigButton} onPress={() => send({ cmd: "playpause" })}>
          <Text style={styles.bigButtonText}>Play / Pause</Text>
        </TouchableOpacity>

        <View style={styles.seekRow}>
          <TouchableOpacity style={styles.seekButton} onPress={() => send({ cmd: "seek", seconds: -10 })}>
            <Text style={styles.buttonText}>-10s</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.seekButton} onPress={() => send({ cmd: "seek", seconds: 10 })}>
            <Text style={styles.buttonText}>+10s</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Hiz: {speed.toFixed(2)}x</Text>
        <Slider
          style={styles.slider}
          minimumValue={0.25}
          maximumValue={2}
          step={0.25}
          value={speed}
          onValueChange={setSpeed}
          onSlidingComplete={(value) => send({ cmd: "setSpeed", value })}
          minimumTrackTintColor="#2e7d32"
          thumbTintColor="#2e7d32"
        />

        <View style={styles.seekRow}>
          <TouchableOpacity style={styles.seekButton} onPress={() => send({ cmd: "toggleSubtitles" })}>
            <Text style={styles.buttonText}>Altyazi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.seekButton} onPress={() => send({ cmd: "next" })}>
            <Text style={styles.buttonText}>Sonraki</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
    padding: 20,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  connectRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#222",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  connectButton: {
    backgroundColor: "#2e7d32",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: "#ccc",
  },
  controls: {
    gap: 16,
  },
  bigButton: {
    backgroundColor: "#1976d2",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
  },
  bigButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  seekRow: {
    flexDirection: "row",
    gap: 12,
  },
  seekButton: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
  },
  label: {
    color: "#ccc",
  },
  slider: {
    width: "100%",
    height: 40,
  },
});
