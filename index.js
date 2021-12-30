const logger = require('./src/logger');
const loggingWs = require('./src/logging-websocket')
const vmListener = require('./src/virtual-machine-listener')

const selfStarting = true;
const sendDelay = 10000; // 10 seconds

const initConnection = function() {
    loggingWs.connectWebSocket();
    /* Send log every interval */
    const _intervalID = setInterval(logger.sendLog, sendDelay);
};

// This module connects to the logging endpoint automatically on load,
// and sends the current log every few seconds over websocket.
if (selfStarting) initConnection();

module.exports = {
    logger: logger,
    wsOpen: loggingWs.isOpen,
    wsSaveError: loggingWs.hasSaveError,
    listenToVM: vmListener.listenToVM
};
