const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const requestIp = require('request-ip');
const mongoose = require('mongoose');

// Load environment variables (add this line if you use a .env file)
require('dotenv').config();

// MongoDB setup via environment variables or fallback to default
const mongoURL = process.env.MONGO_URL || 'mongodb://root:example@localhost:27017/chatApp?authSource=admin';
mongoose.connect(mongoURL)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));


const chatSchema = new mongoose.Schema({
    sender: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', chatSchema);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected users
const connectedUsers = new Map();

// WebSocket connection
wss.on('connection', async (ws, req) => {
    // Fetch previous chat messages and send to the newly connected user
    const previousMessages = await Chat.find({}).sort({ timestamp: 1 });
    ws.send(JSON.stringify({ type: 'previousMessages', messages: previousMessages }));

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        var clientIp = requestIp.getClientIp(req);
        console.log(clientIp, JSON.parse(message));

        if (data.type === 'setUsername') {
            connectedUsers.set(ws, data.username);
            broadcastUserList();
        } else if (data.type === 'chatMessage') {
            const sender = connectedUsers.get(ws);

            // Save the chat message to the database
            const chatMessage = new Chat({ sender, message: data.message });
            await chatMessage.save();

            broadcastMessage(sender, data.message);
        }
    });

    ws.on('close', () => {
        connectedUsers.delete(ws);
        broadcastUserList();
    });
});

function broadcastUserList() {
    const users = Array.from(connectedUsers.values());
    const userListMessage = JSON.stringify({ type: 'userList', users });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(userListMessage);
        }
    });
}

function broadcastMessage(sender, message) {
    const chatMessage = JSON.stringify({ type: 'chatMessage', sender, message });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(chatMessage);
        }
    });
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
