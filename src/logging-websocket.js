// const wsURL = 'ws://localhost:8000/logging'; // local
const wsURL = 'wss://scratch-log-endpoint.herokuapp.com/logging'; // heroku

// Set this to false to disable websocket connections for debugging
const selfConnect = true;

const authKey = 'notthatsecret';
const url = new URL(window.location.href);
const retryDelay = 5000;

let userId = url.searchParams.get('user');
let taskId = url.searchParams.get('task');
let ws;
let reconnectTimer;
let saveError = false;

/**
 * @returns {boolean} Whether the websocket is open and ready
 */
const isOpen = function () {
    return ws?.readyState === WebSocket.OPEN;
};

/**
 * Stores whether or not the last response from the logging endpoint reported a save error.
 * @returns {boolean} Last response had a save error
 */
const hasSaveError = function () {
    return (saveError);
};
/**
 * Sends a String over the websocket
 * @param {string} message The String to send
 * @returns {boolean} True if message was sent, else false
 */
const sendString = function (message) {
    if (!isOpen()) return false;
    ws.send(message);
    return isOpen();
};

/**
 * Sends user actions over the websocket
 * @param {[object]} actions Array of user action objects
 * @returns {boolean} True if message was sent, else false
 */
const sendActions = function (actions) {
    if (!isOpen) return false;
    const payload = {};
    payload.authKey = authKey;
    payload.userActions = actions;
    ws.send(JSON.stringify(payload));
    // Simple isOpen check to see if message was (probably) sent.
    // Possible to implement awaiting response here instead.
    return isOpen();
};

/**
 * React to messages / responses from the logging endpoint
 * @param msg Message that's hopefully from the logging endpoint
 */
const handleResponse = function (msg) {
    try {
        msg = JSON.parse(msg);
    } catch (e) {
        console.log('message received was not valid JSON');
        return;
    }
    if ('success' in msg) {
        saveError = !msg.success;
        if (saveError) console.log(`Actions not saved on endpoint: ${msg.error}`);
    }
    if ('newUserId' in msg) {
        userId = msg.newUserId;
    }

};

/**
 * Creates new ws connection to logging endpoint, automatically reconnects on close.
 * Doesn't change or redo existing connection.
 */
const connectWebSocket = function () {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
    // Don't reconnect healthy connection
    if (isOpen()) return;

    console.log("creating new websocket");
    let fullURL = userId ? (wsURL + `/?userId=${userId}`) : wsURL;
    ws = new WebSocket(fullURL);

    ws.onopen = function () {
        console.log('WebSocket Connected');
    };

    ws.onmessage = function (ev) {
        console.log(`Received ws message: ${ev.data}`);
        handleResponse(ev.data);
    };

    ws.onerror = function (ev) {
        console.error('WebSocket error:', ev);
    };

    ws.onclose = function (ev) {
        console.log(`Websocket closed: ${ev.code}  ${ev.reason}`);
        // Retry
        if (!reconnectTimer) {
            console.log(`retrying websocket connection in ${retryDelay}ms`);
            reconnectTimer = setTimeout(connectWebSocket, retryDelay);
        }
    };
};

// Create connection automatically on load.
if (selfConnect) connectWebSocket();

module.exports = {
    sendActions: sendActions,
    sendString: sendString,
    isOpen: isOpen,
    hasSaveError: hasSaveError
};
