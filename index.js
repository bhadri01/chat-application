const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected users
const connectedUsers = new Map();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws, req) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'setUsername') {
            connectedUsers.set(ws, data.username);
            broadcastUserList();
        } else if (data.type === 'chatMessage') {
            const sender = connectedUsers.get(ws);
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
