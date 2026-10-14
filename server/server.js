// Local relay server.
//
// The phone companion app and the browser extension both connect here as
// WebSocket clients. Commands sent by the phone ({ "cmd": "playpause" }, ...)
// are relayed to every connected extension; a "hello" message from either
// side just registers its role for logging/status purposes.
//
//   [Phone] --WS--> [this server] --WS--> [Extension] --> <video>
//
// Run: npm install && npm start  (listens on port 8787 on all interfaces)

const os = require("os");
const { WebSocketServer } = require("ws");

const PORT = 8787;
const wss = new WebSocketServer({ port: PORT });

const clients = new Set();

function lanAddresses() {
  const addrs = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface || []) {
      if (addr.family === "IPv4" && !addr.internal) addrs.push(addr.address);
    }
  }
  return addrs;
}

wss.on("connection", (socket) => {
  const client = { socket, role: "unknown" };
  clients.add(client);
  console.log(`[server] client connected (${clients.size} total)`);

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      console.warn("[server] ignoring non-JSON message:", raw.toString());
      return;
    }

    if (msg.type === "hello" && msg.role) {
      client.role = msg.role;
      console.log(`[server] client identified as "${client.role}"`);
      return;
    }

    if (msg.cmd) {
      console.log(`[server] relaying command from ${client.role}:`, msg);
      for (const other of clients) {
        if (other !== client && other.role === "extension" && other.socket.readyState === other.socket.OPEN) {
          other.socket.send(JSON.stringify(msg));
        }
      }
    }
  });

  socket.on("close", () => {
    clients.delete(client);
    console.log(`[server] client disconnected (${clients.size} total)`);
  });
});

console.log(`[server] listening on port ${PORT}`);
const addrs = lanAddresses();
if (addrs.length > 0) {
  console.log("[server] reachable at:");
  for (const addr of addrs) console.log(`  ws://${addr}:${PORT}`);
} else {
  console.log("[server] no LAN IPv4 address found - phone must be on the same network as this machine.");
}
