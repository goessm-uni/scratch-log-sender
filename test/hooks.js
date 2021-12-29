const sinon = require("sinon");

// Sinon.js Boilerplate
// Restore default sandbox after every test
exports.mochaHooks = {
    afterEach() {
        sinon.restore();
    },
};
