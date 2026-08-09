const express = require('express');
const path = require('path');
const { smarthome } = require('actions-on-google');

const app = express();
const PORT = process.env.PORT || 10000;

// Express Middlewares
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
// 2. Google OAuth2 Login & Authorization Page
// -------------------------------------------------------------

// Interactive OAuth Login Screen for Google Home App
app.get(['/auth', '/oauth/authorize'], (req, res) => {
    const redirectUri = req.query.redirect_uri;
    const state = req.query.state;

    if (!redirectUri) {
        return res.status(200).send("OAuth Authorization Endpoint Active");
    }

    // Serve a simple HTML page that Google Home's in-app browser can render
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Link Smart Switch</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding: 40px 20px; background: #0f172a; color: #fff; }
                .card { background: #1e293b; padding: 30px; border-radius: 16px; max-width: 320px; margin: auto; }
                button { background: #3b82f6; color: white; border: none; padding: 14px 28px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; width: 100%; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>ESP32 Smart Switch</h2>
                <p>Click below to link your switch with Google Home.</p>
                <form action="/auth-confirm" method="POST">
                    <input type="hidden" name="redirect_uri" value="${redirectUri}">
                    <input type="hidden" name="state" value="${state}">
                    <button type="submit">Authorize Google Home</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Confirmation Endpoint: Redirects back to Google with valid authorization code
app.post('/auth-confirm', (req, res) => {
    const { redirect_uri, state } = req.body;
    res.redirect(`${redirect_uri}?code=valid_dummy_code&state=${state}`);
});

// Token Exchange Endpoint
app.all(['/token', '/oauth/token'], (req, res) => {
    res.json({
        token_type: 'bearer',
        access_token: 'valid_access_token_123',
        refresh_token: 'valid_refresh_token_123',
        expires_in: 86400
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
            agentUserId: 'esp32_user_1',
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
