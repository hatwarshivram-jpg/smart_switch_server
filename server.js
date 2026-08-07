const express = require('express');
const path = require('path');
const { smarthome } = require('actions-on-google');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// LED State stored in memory
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
// 2. OAuth2 Authorization Endpoints (Required by Google Home)
// Handles both /auth and /oauth/authorize
// -------------------------------------------------------------
app.get(['/auth', '/oauth/authorize'], (req, res) => {
    const redirectUri = req.query.redirect_uri;
    const state = req.query.state;

    if (redirectUri) {
        // Redirect back to Google Home app with auth code
        return res.redirect(`${redirectUri}?code=dummy_auth_code&state=${state}`);
    }
    res.status(200).send("OAuth Auth Endpoint Working!");
});

app.post('/token', (req, res) => {
    // Send access token back to Google Home
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
    jwt: null
});

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

app.post('/smarthome', appSmartHome);

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
