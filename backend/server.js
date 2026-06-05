const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const XLSX = require('xlsx');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');
const qrcode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());


app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Store state per socket session
const sessions = {};

function initWhatsApp(socketId) {
  if (sessions[socketId]?.client) {
    try { sessions[socketId].client.destroy(); } catch (_) {}
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: socketId }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  sessions[socketId] = {
    client,
    contacts: [],
    message: '',
    ready: false
  };

  client.on('qr', async (qr) => {
    try {
      const qrDataUrl = await qrcode.toDataURL(qr);
      io.to(socketId).emit('qr', qrDataUrl);
    } catch (e) {
      console.error('QR error:', e);
    }
  });

  client.on('ready', () => {
    console.log(`[${socketId}] WhatsApp ready`);
    sessions[socketId].ready = true;
    io.to(socketId).emit('wa_ready');
  });

  client.on('authenticated', () => {
    io.to(socketId).emit('wa_authenticated');
  });

  client.on('auth_failure', () => {
    io.to(socketId).emit('wa_error', 'Authentication failed. Please try again.');
  });

  client.on('disconnected', () => {
    sessions[socketId].ready = false;
    io.to(socketId).emit('wa_disconnected');
  });

  client.initialize().catch(err => {
    io.to(socketId).emit('wa_error', err.message);
  });
}

// Upload Excel file
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    const socketId = req.body.socketId;
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    let contacts = XLSX.utils.sheet_to_json(ws);

    // Normalize column names (trim spaces)
    contacts = contacts.map(row => {
      const clean = {};
      for (const key of Object.keys(row)) {
        clean[key.trim()] = row[key];
      }
      return clean;
    });

    // Clean phone numbers (handle scientific notation)
    contacts = contacts.map(c => ({
      ...c,
      Phone: Math.round(Number(String(c.Phone).replace(/\D/g, '')))
    }));

    if (sessions[socketId]) {
      sessions[socketId].contacts = contacts;
    }

    res.json({
      success: true,
      count: contacts.length,
      preview: contacts.slice(0, 3),
      columns: Object.keys(contacts[0] || {})
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Save message template
app.post('/message', (req, res) => {
  const { socketId, message } = req.body;
  if (sessions[socketId]) {
    sessions[socketId].message = message;
  }
  res.json({ success: true });
});

// Start sending messages
app.post('/send', async (req, res) => {
  const { socketId } = req.body;
  const session = sessions[socketId];

  if (!session || !session.ready) {
    return res.status(400).json({ error: 'WhatsApp not connected' });
  }
  if (!session.contacts.length) {
    return res.status(400).json({ error: 'No contacts loaded' });
  }

  res.json({ started: true, total: session.contacts.length });

  // Send messages asynchronously
  (async () => {
    const { client, contacts, message } = session;
    let success = 0, failed = 0;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const phone = `${contact.Phone}@c.us`;

      // Build personalized message
      const personalizedMsg = message
        .replace(/\{Name\}/gi, contact.Name || '')
        .replace(/\{Outstanding Amount\}/gi, contact['Outstanding Amount'] || '')
        .replace(/\{Phone\}/gi, contact.Phone || '');

      try {
        await client.sendMessage(phone, personalizedMsg);
        success++;
        io.to(socketId).emit('progress', {
          index: i + 1,
          total: contacts.length,
          name: contact.Name,
          phone: contact.Phone,
          status: 'success',
          success,
          failed
        });
      } catch (e) {
        failed++;
        io.to(socketId).emit('progress', {
          index: i + 1,
          total: contacts.length,
          name: contact.Name,
          phone: contact.Phone,
          status: 'failed',
          success,
          failed
        });
      }

      // Delay between messages
      if (i < contacts.length - 1) {
        await new Promise(r => setTimeout(r, 4500));
      }
    }

    io.to(socketId).emit('done', { success, failed, total: contacts.length });
  })();
});

// Socket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  initWhatsApp(socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Clean up session after delay
    setTimeout(() => {
      if (sessions[socket.id]) {
        try { sessions[socket.id].client.destroy(); } catch (_) {}
        delete sessions[socket.id];
      }
    }, 5000);
  });

  socket.on('restart_wa', () => {
    initWhatsApp(socket.id);
  });
});

const path = require('path');

// Serve React frontend
app.use(express.static(path.join(__dirname, 'frontend/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp Blast server running on http://localhost:${PORT}\n`);
});
