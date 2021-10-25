const userEventLog = require('./src/user-event-log');
const loggingWs = require('./src/logging-websocket')

module.exports = {
    userEventLog: userEventLog,
    setUserId: loggingWs.setUserId,
    wsOpen: loggingWs.isOpen,
    wsSaveError: loggingWs.hasSaveError
};
