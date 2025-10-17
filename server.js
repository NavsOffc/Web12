const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { default: makeWASocket, useSingleFileAuthState } = require('@adiwajshing/baileys');
const fileUpload = require('express-fileupload');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));  // Only if you need to serve static files locally for testing
app.use(fileUpload());

const senders = {};  // Store active senders
const senderDir = path.join(__dirname, 'senders');
fs.ensureDirSync(senderDir);

// Add Sender Route (Modified to return QR via response)
app.post('/add-sender', async (req, res) => {
    const senderId = `sender${Date.now()}`;
    const senderPath = path.join(senderDir, senderId);
    fs.ensureDirSync(senderPath);
    const { state, saveState } = useSingleFileAuthState(path.join(senderPath, 'auth_info.json'));

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on('connection.update', (update) => {
        const { qr } = update;
        if (qr) {
            res.json({ success: true, senderId, qr });  // Return QR directly in response
            // Note: This is simplistic; in practice, handle it per request.
        }
        if (update.isNewLogin) {
            res.json({ success: true, senderId, message: 'Sender connected!' });
        }
    });

    sock.ev.on('creds.update', saveState);
    senders[senderId] = { client: sock, path: senderPath };
    res.json({ success: true, senderId });  // Initial response
});

// Keep other routes as before: /send-bug, /file-manager/*, etc.

app.listen(3000, () => console.log('Backend running on port 3000'));
