const express = require('express');
const path = require('path');
const { smarthome } = require('actions-on-google');

const app = express();
const PORT = process.env.PORT || 10000;

// Express Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// LED State stored in memory (false = OFF, true = ON)
let ledState = false;

// -------------------------------------------------------------
// 1. ESP32 & Web Dashboard Endpoints
// -------------------------------------------------------------
app.get('/api/led/status', (req, res) => {
    res.json({ status: ledState ? "ON" : "OFF", state: ledState });
});

app.post('/api/led/toggle', (req, res) => {
    if (req.body.state !== undefined) {
        ledState = Boolean(req.body.state);
    } else {
        ledState = !ledState;
    }
    res.json({ success: true, status: ledState ? "ON" : "OFF", state: ledState });
});

// -------------------------------------------------------------
// 2. Google OAuth2 Authentication Endpoints
// -------------------------------------------------------------

// Handles Google Home Authorization requests
app.get(['/auth', '/oauth/authorize'], (req, res) => {
    const redirectUri = req.query.redirect_uri;
    const state = req.query.state;

    // Google requires a redirect containing authorization code and state
    if (redirectUri) {
        return res.redirect(`${redirectUri}?code=dummy_auth_code&state=${state}`);
    }
    
    res.status(200).send("OAuth Authorization Endpoint Active");
});

// Handles Google Home Token requests
app.all(['/token', '/oauth/token'], (req, res) => {
    res.json({
        token_type: 'bearer',
        access_token: 'dummy_access_token',
        refresh_token: 'dummy_refresh_token',
        expires_in: 3600
    });
});

// -------------------------------------------------------------
// 3. Google Smart Home Fulfillment Engine
// -------------------------------------------------------------
const appSmartHome = smarthome({
    jwt: null // Bypasses service account key check for development
});

// SYNC Intent: Google asks what devices exist
appSmartHome.onSync((body) => {
    return {
        requestId: body.requestId,
        payload: {
            agentUserId: 'user_123',
            devices: [{
                id: 'esp32_switch_1',
                type: 'action.devices.types.SWITCH',
                traits: ['action.devices.traits.OnOff'],
                name: {
                    defaultNames: ['ESP32 Smart Switch'],
                    name: 'Smart Switch',
                    nicknames: ['Switch', 'Light']
                },
                willReportState: false
            }]
        }
    };
});

// QUERY Intent: Google asks for current device state
appSmartHome.onQuery((body) => {
    return {
        requestId: body.requestId,
        payload: {
            devices: {
                esp32_switch_1: {
                    on: ledState,
                    online: true
                }
            }
        }
    };
});

// EXECUTE Intent: Google sends ON/OFF commands from voice or app
appSmartHome.onExecute((body) => {
    const commands = body.inputs[0].payload.commands;
    const results = [];

    for (const command of commands) {
        for (const execution of command.execution) {
            if (execution.command === 'action.devices.commands.OnOff') {
                ledState = execution.params.on;
                results.push({
                    ids: [command.devices[0].id],
                    status: 'SUCCESS',
                    states: {
                        on: ledState,
                        online: true
                    }
                });
            }
        }
    }

    return {
        requestId: body.requestId,
        payload: {
            commands: results
        }
    };
});

// Route Google Smart Home fulfillment traffic
app.post('/smarthome', appSmartHome);

// Start Server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
