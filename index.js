const logger = require('./src/logger');
const loggingWs = require('./src/logging-websocket')
const vmListener = require('./src/virtual-machine-listener')

const selfStarting = true;
const sendDelay = 10000; // 10 seconds
const wsUrl = 'wss://endpoint.example.com/logging' // Add your endpoint url here

let sendInterval

const initConnection = function() {
    loggingWs.connectWebSocket(wsUrl);
    /* Send log every interval */
    clearInterval(sendInterval)
    sendInterval = setInterval(logger.sendLog, sendDelay);
};

// This module connects to the logging endpoint automatically on load,
// and sends the current log every few seconds over websocket.
if (selfStarting) initConnection();

module.exports = {
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
