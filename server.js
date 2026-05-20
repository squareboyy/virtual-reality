const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(express.json());

let latestMagData = { x: 0, y: 0, z: 0 };

// Прийом даних від Sensor Logger (POST)
app.post('/data', (req, res) => {
    if (req.body && req.body.payload) {
        req.body.payload.forEach(sensor => {
            // Шукаємо дані магнітометра
            if (sensor.name === 'magnetometer') {
                latestMagData = sensor.values;
            }
        });
    }
    res.sendStatus(200);
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Розсилка даних через WebSocket кожні 20 мс
setInterval(() => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(latestMagData));
        }
    });
}, 20);

// Запуск сервера на порту 8000
server.listen(8000, '0.0.0.0', () => {
    console.log('Bridge server is running on port 8000');
});