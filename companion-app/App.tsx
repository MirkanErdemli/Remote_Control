import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { StatusBar } from "expo-status-bar";
import Zeroconf, { useZeroconf } from "react-native-zeroconf";

type ConnectionState = "disconnected" | "connecting" | "connected";

export default function App() {
  const [serverHost, setServerHost] = useState("192.168.1.100");
  const [status, setStatus] = useState<ConnectionState>("disconnected");
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1); // 0..2, where 1 = 100%
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // Finds local servers advertised via mDNS ("_vrc._tcp") so the user
  // doesn't have to type an IP - manual entry below still works as a
  // fallback when mDNS is blocked on a network.
  const { services, isScanning, restart } = useZeroconf({ type: "vrc", protocol: "tcp" });

  // Android 13+ gates mDNS/NSD resolution behind a local-network permission
  // prompt; without asking for it up front the scan above can silently find
  // nothing. This asks once on mount (no-op on platforms/versions that don't
  // need it).
  useEffect(() => {
    const z = new Zeroconf();
    z.checkLocalNetworkAccess({ type: "vrc", protocol: "tcp" }).catch(() => {});
  }, []);

  const logDebug = useCallback((msg: string) => {
    const line = `${new Date().toLocaleTimeString()}  ${msg}`;
    setDebugLog((prev) => [line, ...prev].slice(0, 8));
  }, []);

  const connect = useCallback(
    (hostOverride?: string, nameOverride?: string) => {
      const host = hostOverride ?? serverHost;
      socketRef.current?.close();
      setStatus("connecting");
      setConnectedName(nameOverride ?? null);

      const url = `ws://${host}:8787`;
      logDebug(`Connecting to ${url}`);
      const socket = new WebSocket(url);
      socketRef.current = socket;

      const connectStartedAt = Date.now();
      const timeoutId = setTimeout(() => {
        if (socketRef.current === socket) {
          logDebug("Timeout: 8s'de hicbir event gelmedi (open/close/error yok)");
        }
      }, 8000);

      socket.onopen = () => {
        clearTimeout(timeoutId);
        setStatus("connected");
        logDebug("Acildi (onopen)");
        socket.send(JSON.stringify({ role: "phone", type: "hello" }));
      };
      socket.onmessage = (e) => {
        let msg: any;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg?.type !== "status") return;
        if (typeof msg.volume === "number") setVolume(msg.volume);
        if (typeof msg.speed === "number") setSpeed(msg.speed);
      };
      socket.onclose = (e) => {
        clearTimeout(timeoutId);
        setStatus("disconnected");
        logDebug(`Kapandi (onclose): code=${e.code} reason=${e.reason || "-"} (${Date.now() - connectStartedAt}ms sonra)`);
      };
      socket.onerror = (e: any) => {
        clearTimeout(timeoutId);
        setStatus("disconnected");
        logDebug(`Hata (onerror): ${e?.message ?? JSON.stringify(e)}`);
      };
    },
    [serverHost, logDebug]
  );

  useEffect(() => {
    return () => socketRef.current?.close();
  }, []);

  const send = useCallback((command: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(command));
    }
  }, []);

  // Speed/volume shown on screen now come from the extension's status
  // reports (see socket.onmessage above), so they self-correct a couple
  // seconds after switching videos - no need to guess here.
  const goNext = useCallback(() => send({ cmd: "next" }), [send]);
  const goPrev = useCallback(() => send({ cmd: "prev" }), [send]);

  const dotColor =
    status === "connected" ? "#2e7d32" : status === "connecting" ? "#f9a825" : "#c62828";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Video Remote Control</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={() => setSettingsOpen(true)}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>
            {isScanning ? "Ag taraniyor..." : `Bulunan cihazlar (${services.length})`}
          </Text>
          <TouchableOpacity onPress={() => restart()}>
            <Text style={styles.refreshLink}>Yenile</Text>
          </TouchableOpacity>
        </View>

        {services.length === 0 ? (
          <Text style={styles.hintText}>
            Hicbir cihaz bulunamadi. Server'in ayni WiFi agindaki bir bilgisayarda calistigindan emin ol,
            ya da altan IP ile manuel baglan.
          </Text>
        ) : (
          <View style={styles.deviceList}>
            {services.map((svc) => {
              const ip = svc.ipv4[0] ?? svc.addresses[0];
              const isActive = status === "connected" && connectedName === svc.name;
              return (
                <TouchableOpacity
                  key={svc.name}
                  style={[styles.deviceRow, isActive && styles.deviceRowActive]}
                  onPress={() => {
                    setServerHost(ip);
                    connect(ip, svc.name);
                  }}
                >
                  <Text style={styles.deviceName}>{svc.name}</Text>
                  <Text style={styles.deviceIp}>{ip}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionLabel}>Manuel baglanti</Text>
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
          <TouchableOpacity style={styles.connectButton} onPress={() => connect()}>
            <Text style={styles.buttonText}>Baglan</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.statusText}>
            {status === "connected"
              ? `Baglandi${connectedName ? ` (${connectedName})` : ""}`
              : status === "connecting"
              ? "Baglaniyor..."
              : "Bagli degil"}
          </Text>
        </View>

        <View style={styles.debugBox}>
          {debugLog.length === 0 ? (
            <Text style={styles.debugText}>Henuz baglanti denemesi yok.</Text>
          ) : (
            debugLog.map((line, i) => (
              <Text key={i} style={styles.debugText}>
                {line}
              </Text>
            ))
          )}
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

          <Text style={styles.label}>
            Ses: {Math.round(volume * 100)}%{volume > 1 ? " (guclendirilmis)" : ""}
          </Text>
          <View style={styles.seekRow}>
            <TouchableOpacity
              style={styles.seekButton}
              onPress={() => {
                const next = Math.max(0, volume - 0.1);
                setVolume(next);
                send({ cmd: "volume", delta: -0.1 });
              }}
            >
              <Text style={styles.buttonText}>Ses -</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.seekButton}
              onPress={() => {
                const next = Math.min(2, volume + 0.1);
                setVolume(next);
                send({ cmd: "volume", delta: 0.1 });
              }}
            >
              <Text style={styles.buttonText}>Ses +</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.seekRow}>
            <TouchableOpacity style={styles.seekButton} onPress={goPrev}>
              <Text style={styles.buttonText}>Onceki</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.seekButton} onPress={goNext}>
              <Text style={styles.buttonText}>Sonraki</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.seekButton} onPress={() => send({ cmd: "toggleSubtitles" })}>
            <Text style={styles.buttonText}>Altyazi</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Ayarlar</Text>
              <TouchableOpacity style={styles.settingsButton} onPress={() => setSettingsOpen(false)}>
                <Text style={styles.settingsIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>
              Yakinda: ses tekerlegi, tema, kontrol duzeni ve diger tercihler burada olacak.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: {
    color: "#ccc",
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionLabel: {
    color: "#999",
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
  },
  refreshLink: {
    color: "#64b5f6",
    fontSize: 13,
  },
  hintText: {
    color: "#777",
    fontSize: 12,
    marginBottom: 8,
  },
  deviceList: {
    gap: 8,
    marginBottom: 8,
  },
  deviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  deviceRowActive: {
    backgroundColor: "#16351c",
    borderWidth: 1,
    borderColor: "#2e7d32",
  },
  deviceName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  deviceIp: {
    color: "#888",
    fontSize: 12,
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
  debugBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    gap: 2,
  },
  debugText: {
    color: "#888",
    fontSize: 11,
    fontFamily: "monospace",
  },
});
