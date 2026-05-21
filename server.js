const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.post('/data', (req, res) => {
    if (req.body && req.body.payload) {
        req.body.payload.forEach(sensor => {
            if (sensor.name === 'magnetometer') {
                const magData = sensor.values;
                
                // Відправляємо дані клієнтам миттєво при отриманні POST-запиту
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(magData));
                    }
                });
            }
        });
    }
    res.sendStatus(200);
});

server.listen(8000, '0.0.0.0', () => {
    console.log('Bridge server is running on port 8000');
});