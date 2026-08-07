const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// LED State stored in memory (false = OFF, true = ON)
let ledState = false;

// Get current state (Used by both Web UI and ESP32)
app.get('/api/led/status', (req, res) => {
    res.json({ status: ledState ? "ON" : "OFF", state: ledState });
});

// Toggle/Set LED state (Used by Web UI)
app.post('/api/led/toggle', (req, res) => {
    if (req.body.state !== undefined) {
        ledState = Boolean(req.body.state);
    } else {
        ledState = !ledState;
    }
    res.json({ success: true, status: ledState ? "ON" : "OFF", state: ledState });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
