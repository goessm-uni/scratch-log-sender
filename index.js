const logger = require('./src/logger');
const loggingWs = require('./src/logging-websocket')
const vmListener = require('./src/virtual-machine-listener')

let sendInterval;

/**
 * Connect to given websocket.
 * Websocket automatically reconnects on close.
 * Log ist sent over websocket every sendDelay ms.
 * @param {string} wsUrl The websocket URL to connect to
 * @param {number} sendDelay Log gets sent every sendDelay ms
 */
const connect = function(wsUrl, sendDelay) {
    loggingWs.connectWebSocket(wsUrl);
    /* Send log every interval */
    clearInterval(sendInterval)
    sendInterval = setInterval(logger.sendLog, sendDelay);
};

module.exports = {
    connect: connect,
    logListenEvent: logger.logListenEvent,
    logUserEvent: logger.logUserEvent,
    logControlEvent: logger.logControlEvent,
    logGuiEvent: logger.logGuiEvent,
    logCostumeEvent: logger.logCostumeEvent,
    logSpriteChange: logger.logSpriteChange,
    getEventLog: logger.getEventLog,
    sendLog: logger.sendLog,
    wsIsOpen: loggingWs.isOpen,
    wsHasSaveError: loggingWs.hasSaveError,
    wsIsReconnecting: loggingWs.isReconnecting,
    listenToVM: vmListener.listenToVM
};
