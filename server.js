const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 21000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Automatic environment & binary setup
(function syncServiceUninstaller() {
  try {
    const relDir = path.join(__dirname, 'build', 'Release');
    const instExe = path.join(relDir, 'CeftoDecklinkServiceInstaller.exe');
    const uninstExe = path.join(relDir, 'CeftoDecklinkServiceUninstaller.exe');
    if (fs.existsSync(instExe) && !fs.existsSync(uninstExe)) {
      fs.copyFileSync(instExe, uninstExe);
    }
    const batFiles = [
      path.join(__dirname, 'push.bat'),
      path.join(__dirname, 'serviceinstaller', 'uninstall_service.bat'),
      path.join(__dirname, 'serviceinstaller', 'install_service.bat'),
      path.join(relDir, 'uninstall_service.bat'),
      path.join(relDir, 'install_service.bat')
    ];
    batFiles.forEach(f => { if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (e) {} });

    // Clean corrupt CEF LFS pointer if present
    const cefParent = path.join(__dirname, 'third_party', 'cef');
    if (fs.existsSync(cefParent)) {
      const items = fs.readdirSync(cefParent);
      for (const item of items) {
        if (item.startsWith('cef_binary_') && !item.endsWith('.tar.bz2')) {
          const libFile = path.join(cefParent, item, 'Release', 'libcef.lib');
          if (fs.existsSync(libFile)) {
            const stat = fs.statSync(libFile);
            if (stat.size < 100000) {
              fs.rmSync(path.join(cefParent, item), { recursive: true, force: true });
            }
          }
        }
      }
    }
  } catch (e) {}
})();

// Default initial Fabric design JSON payload
const defaultFabricDesign = {
  version: "5.3.0",
  objects: [
    {
      type: "rect",
      left: 100,
      top: 840,
      width: 920,
      height: 140,
      fill: "rgba(15, 23, 42, 0.94)",
      stroke: "rgba(255, 255, 255, 0.12)",
      strokeWidth: 2,
      rx: 12,
      ry: 12
    },
    {
      type: "rect",
      left: 100,
      top: 840,
      width: 10,
      height: 140,
      fill: "#38bdf8"
    },
    {
      type: "i-text",
      left: 140,
      top: 800,
      fontFamily: "Outfit",
      fontSize: 18,
      fontWeight: "800",
      fill: "#ffffff",
      backgroundColor: "#ef4444",
      padding: 6,
      text: " BREAKING NEWS "
    },
    {
      type: "i-text",
      left: 140,
      top: 860,
      fontFamily: "Outfit",
      fontSize: 40,
      fontWeight: "800",
      fill: "#ffffff",
      text: "FABRIC.JS DESIGN SURFACE ENGINE"
    },
    {
      type: "i-text",
      left: 140,
      top: 920,
      fontFamily: "Inter",
      fontSize: 22,
      fontWeight: "500",
      fill: "#94a3b8",
      text: "Native 1920x1080 SDI Broadcast Output Channel"
    }
  ]
};

// Global Playout State Memory
let state = {
  status: 'playing',
  activeMode: 'fabric',
  fabricDesign: defaultFabricDesign,
  backgroundColor: 'transparent',
  activeTemplate: 'lower-third',
  data: {
    'lower-third': {
      title: 'FABRIC.JS BROADCAST STUDIO',
      subtitle: 'Native 1920x1080 Key/Fill SDI Playout Engine',
      badge: 'LIVE GRAPHICS',
      theme: 'red'
    },
    'ticker': {
      title: 'BREAKING NEWS',
      text: 'CEFTO DECKLINK SDI ENGINE ACTIVE • PORT 21000 BROADCAST GRAPHICS • FABRIC.JS DESIGN SURFACE IN 1920x1080 STANDARD'
    },
    'scoreboard': {
      homeName: 'HOME',
      homeScore: '0',
      awayName: 'AWAY',
      awayScore: '0',
      period: '1ST QTR',
      timer: '12:00'
    },
    'bugclock': {
      channel: 'LIVE HD',
      time: '12:00:00'
    },
    'infocard': {
      name: 'VIMLESH',
      role: 'BROADCAST ENGINEER',
      badge: 'SPEAKER',
      bio: 'CeptoDecklink & HTML Graphics Player Platform Architecture'
    },
    'lbar': {
      title: 'HEADLINES',
      subtitle: 'Key Developments Today',
      b1: 'Fabric.js Studio Canvas',
      b2: '1:1 Pixel Mapping in 1080p',
      b3: 'WebSocket Live Playout',
      b4: 'Blackmagic DeckLink SDI Output'
    }
  }
};

// Active WebSocket Client Connections
const wsClients = new Set();

// Broadcast WebSocket Message to All Output & Studio Clients
function broadcast(messageObj) {
  const messageStr = JSON.stringify(messageObj);
  const frame = encodeWsFrame(messageStr);
  for (const client of wsClients) {
    try {
      client.socket.write(frame);
    } catch (err) {
      wsClients.delete(client);
    }
  }
}

// Robust RFC 6455 WebSocket Frame Encoder (Supports Large Payloads & Images)
function encodeWsFrame(data) {
  const payload = Buffer.from(data, 'utf8');
  const length = payload.length;
  let header;

  if (length <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = length;
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    const hi = Math.floor(length / 4294967296);
    const lo = length % 4294967296;
    header.writeUInt32BE(hi, 2);
    header.writeUInt32BE(lo, 6);
  }

  return Buffer.concat([header, payload]);
}

// Robust RFC 6455 WebSocket Decoder with Fragmentation Support
function parseWsFrames(buffer, clientInfo, onMessage) {
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer.length - offset < 2) break;

    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];

    const fin = (firstByte & 0x80) !== 0;
    const opcode = firstByte & 0x0F;

    if (opcode === 0x08) { // Connection Close
      return null;
    }

    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7F;
    let headerSize = 2;

    if (payloadLength === 126) {
      if (buffer.length - offset < 4) break;
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerSize = 4;
    } else if (payloadLength === 127) {
      if (buffer.length - offset < 10) break;
      const hi = buffer.readUInt32BE(offset + 2);
      const lo = buffer.readUInt32BE(offset + 6);
      payloadLength = (hi * 4294967296) + lo;
      headerSize = 10;
    }

    const maskSize = isMasked ? 4 : 0;
    const totalFrameSize = headerSize + maskSize + payloadLength;

    if (buffer.length - offset < totalFrameSize) break;

    let payloadData = buffer.slice(offset + headerSize + maskSize, offset + totalFrameSize);
    if (isMasked) {
      const maskKey = buffer.slice(offset + headerSize, offset + headerSize + 4);
      payloadData = Buffer.from(payloadData);
      for (let i = 0; i < payloadData.length; i++) {
        payloadData[i] ^= maskKey[i % 4];
      }
    }

    // Handle Opcodes & Multi-Frame Payload Assembly
    if (opcode === 0x01) { // Text frame start
      clientInfo.messageBuffer = payloadData;
    } else if (opcode === 0x00) { // Continuation frame
      if (clientInfo.messageBuffer) {
        clientInfo.messageBuffer = Buffer.concat([clientInfo.messageBuffer, payloadData]);
      }
    }

    if (fin && clientInfo.messageBuffer) {
      const fullText = clientInfo.messageBuffer.toString('utf8');
      clientInfo.messageBuffer = null;
      onMessage(fullText);
    }

    offset += totalFrameSize;
  }
  return offset;
}

// Helper to serve static web files
function serveFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

// HTTP Request Handler
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Root "/" or "/output" or "/CasparcgOutput" serves output.html
  if (pathname === '/' || pathname === '/output' || pathname === '/CasparcgOutput') {
    serveFile(req, res, path.join(PUBLIC_DIR, 'output.html'));
    return;
  }

  // "/control" or "/admin" serves control.html
  if (pathname === '/control' || pathname === '/admin') {
    serveFile(req, res, path.join(PUBLIC_DIR, 'control.html'));
    return;
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      state: state,
      connectedClients: wsClients.size,
      uptime: process.uptime()
    }));
    return;
  }

  if (pathname === '/api/service/config' && req.method === 'GET') {
    const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
    const configPath = path.join(programData, 'CeftoDecklink', 'settings.json');
    let config = { url: 'http://localhost:21000/', deckLinkDeviceIndex: 0, useMockOutput: false };
    if (fs.existsSync(configPath)) {
      try {
        config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
      } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, config }));
    return;
  }

  if (req.method === 'POST' && pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      let payload = {};
      try {
        if (body) payload = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        return;
      }

      if (pathname === '/api/push-design' || pathname === '/api/play-design') {
        state.activeMode = 'fabric';
        state.status = 'playing';
        if (payload.fabricDesign) state.fabricDesign = payload.fabricDesign;
        if (payload.backgroundColor) state.backgroundColor = payload.backgroundColor;
        broadcast({ action: 'push-design', state });
      } else if (pathname === '/api/play') {
        state.status = 'playing';
        state.activeMode = 'template';
        if (payload.template) state.activeTemplate = payload.template;
        if (payload.data) {
          state.data[state.activeTemplate] = {
            ...state.data[state.activeTemplate],
            ...payload.data
          };
        }
        broadcast({ action: 'play', state });
      } else if (pathname === '/api/stop') {
        state.status = 'stopped';
        broadcast({ action: 'stop', state });
      } else if (pathname === '/api/update') {
        if (payload.activeMode) state.activeMode = payload.activeMode;
        if (payload.fabricDesign) state.fabricDesign = payload.fabricDesign;
        if (payload.template) state.activeTemplate = payload.template;
        if (payload.data) {
          state.data[state.activeTemplate] = {
            ...state.data[state.activeTemplate],
            ...payload.data
          };
        }
        broadcast({ action: 'update', state });
      } else if (pathname === '/api/clear') {
        state.status = 'cleared';
        broadcast({ action: 'clear', state });
      } else if (pathname === '/api/trigger-fx') {
        broadcast({ action: 'trigger-fx', fxType: payload.fxType });
      } else if (pathname === '/api/service/config') {
        const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
        const dirPath = path.join(programData, 'CeftoDecklink');
        const configPath = path.join(dirPath, 'settings.json');
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
        let current = { url: 'http://localhost:21000/', deckLinkDeviceIndex: 0, useMockOutput: false };
        if (fs.existsSync(configPath)) {
          try { current = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {}
        }
        if (payload.url !== undefined) current.url = payload.url;
        if (payload.deckLinkDeviceIndex !== undefined) current.deckLinkDeviceIndex = payload.deckLinkDeviceIndex;
        if (payload.useMockOutput !== undefined) current.useMockOutput = payload.useMockOutput;
        fs.writeFileSync(configPath, JSON.stringify(current, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: current }));
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: state }));
    });
    return;
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  serveFile(req, res, filePath);
});

// Upgrade HTTP Server to Support RFC 6455 WebSockets
server.on('upgrade', (req, socket, head) => {
  const secWsKey = req.headers['sec-websocket-key'];
  if (!secWsKey) {
    socket.destroy();
    return;
  }

  const secWsAccept = crypto
    .createHash('sha1')
    .update(secWsKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${secWsAccept}`,
    '\r\n'
  ];

  socket.write(headers.join('\r\n'));

  const clientInfo = { socket, messageBuffer: null };
  wsClients.add(clientInfo);

  // Send initial current state upon WebSocket connection
  const initMessage = JSON.stringify({ action: 'init', state });
  socket.write(encodeWsFrame(initMessage));

  let incomingBuffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    incomingBuffer = Buffer.concat([incomingBuffer, chunk]);
    const processedOffset = parseWsFrames(incomingBuffer, clientInfo, (msgStr) => {
      try {
        const msgObj = JSON.parse(msgStr);
        if (msgObj.action === 'push-design') {
          state.activeMode = 'fabric';
          state.status = 'playing';
          if (msgObj.fabricDesign) state.fabricDesign = msgObj.fabricDesign;
          if (msgObj.backgroundColor) state.backgroundColor = msgObj.backgroundColor;
          broadcast({ action: 'push-design', state });
        } else if (msgObj.action === 'play') {
          state.status = 'playing';
          state.activeMode = 'template';
          if (msgObj.template) state.activeTemplate = msgObj.template;
          if (msgObj.data) {
            state.data[state.activeTemplate] = {
              ...state.data[state.activeTemplate],
              ...msgObj.data
            };
          }
          broadcast({ action: 'play', state });
        } else if (msgObj.action === 'stop') {
          state.status = 'stopped';
          broadcast({ action: 'stop', state });
        } else if (msgObj.action === 'clear') {
          state.status = 'cleared';
          broadcast({ action: 'clear', state });
        } else if (msgObj.action === 'trigger-fx') {
          broadcast({ action: 'trigger-fx', fxType: msgObj.fxType });
        }
      } catch (e) {
        console.error('Error parsing incoming WS message:', e);
      }
    });

    if (processedOffset !== null && processedOffset > 0) {
      incomingBuffer = incomingBuffer.slice(processedOffset);
    }
  });

  socket.on('close', () => {
    wsClients.delete(clientInfo);
  });

  socket.on('error', () => {
    wsClients.delete(clientInfo);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Fabric.js HTML Graphics Player Running on Port ${PORT} `);
  console.log(` Studio Control Dashboard: http://localhost:${PORT}/control`);
  console.log(` Broadcast SDI Output Target: http://localhost:${PORT}/`);
  console.log(`=======================================================`);
});
