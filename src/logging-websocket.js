const authKey = 'notthatsecret';
const retryDelay = 5000;

 // ws keeps a small state to help with reconnecting
const params = {
    userId: null,
    taskId: null
};
let ws;
let reconnectTimer;
let saveError = false;

/**
 * @returns {boolean} Whether the websocket is open and ready
 */
const isOpen = function () {
    if (!ws) return false;
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
        params.userId = msg.newUserId;
    }

};

/**
 * Creates new ws connection to logging endpoint, automatically reconnects on close.
 * Doesn't change or redo existing connection.
 */
const connectWebSocket = function (url) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
    // Don't reconnect healthy connection
    if (isOpen()) return;

    _getParamsFromUrl();
    let firstParam = true
    if (params.userId) {
        url += `/?userId=${userId}`
        firstParam = false
    }
    if (params.taskId) {
        url += (firstParam) ? '/?' : '&' // use & if not first param
        url += `taskId=${taskId}`
    }
    ws = new window.WebSocket(url);

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

const _getParamsFromUrl = function () {
    // Get userId and taskId from url
    const url = new URL(window.location.href);
    // Replace only if not null
    const userIdFromUrl = url?.searchParams.get('user');
    if (userIdFromUrl) params.userId = userIdFromUrl;
    const taskIdFromUrl = url?.searchParams.get('task');
    if (taskIdFromUrl) params.taskId = taskIdFromUrl;
};

module.exports = {
    connectWebSocket: connectWebSocket,
    sendActions: sendActions,
    sendString: sendString,
    isOpen: isOpen,
    hasSaveError: hasSaveError,
    params: params
};
