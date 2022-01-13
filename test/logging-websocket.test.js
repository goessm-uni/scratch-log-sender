const sinon = require('sinon')
const {assert} = require("@sinonjs/referee");
const ws = require('../src/logging-websocket')
const jsdom = require('mocha-jsdom')
const {WebSocket, Server} = require('mock-socket')

const fakeWsUrl = 'ws://localhost:8000/logging'
const fakeWs = {CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3, readyState: WebSocket.OPEN}

describe('.connectWebSocket', () => {
    beforeEach(() => {
        ws.resetState()
    })
    context('url without search params', () => {
        jsdom({url: 'http://localhost:8080'})
        it('should create a new websocket connection', () => {
            const wsFake = sinon.fake.returns(fakeWs)
            sinon.replace(window, 'WebSocket', wsFake)
            ws.connectWebSocket(fakeWsUrl)
            sinon.assert.called(wsFake)
        });
    });
    context('userId in url search params', () => {
        jsdom({url: 'http://localhost:8080/?user=testUserId'})
        it('should get userId from url and use it on connection', () => {
            const wsFake = sinon.fake.returns(fakeWs)
            sinon.replace(window, 'WebSocket', wsFake)
            ws.connectWebSocket(fakeWsUrl)
            sinon.assert.calledWith(wsFake, sinon.match('testUserId'))
        });
    });
    context('taskId in url search params', () => {
        jsdom({url: 'http://localhost:8080/?task=testTaskId'})
        it('should get taskId from url and use it on connection', () => {
            const wsFake = sinon.fake.returns(fakeWs)
            sinon.replace(window, 'WebSocket', wsFake)
            ws.connectWebSocket(fakeWsUrl)
            sinon.assert.calledWith(wsFake, sinon.match('testTaskId'))
        });
    });
    context('both userId and taskId in url search params', () => {
        jsdom({url: 'http://localhost:8080/?user=testUserId&task=testTaskId'})
        it('should get both ids and use them on connection', () => {
            const wsFake = sinon.fake.returns(fakeWs)
            sinon.replace(window, 'WebSocket', wsFake)
            ws.connectWebSocket(fakeWsUrl)
            sinon.assert.calledWith(wsFake, sinon.match('testUserId'))
            sinon.assert.calledWith(wsFake, sinon.match('testTaskId'))
        })
    });
    context('websocket is already open', () => {
        jsdom({url: 'http://localhost:8080'})
        let mockServer
        beforeEach(() => {
            ws.resetState()
            mockServer = new Server(fakeWsUrl)
            mockServer.on('connection', socket => {
                // connection intercepted by mock-socket
            });
        });
        afterEach(() => {
            ws.resetState()
            mockServer.stop()
        })
        it('should not open a new connection if socket is open', (done) => {
            ws.connectWebSocket(fakeWsUrl) // connection open mocked by mock-socket

            setTimeout(function () {
                assert.isTrue(ws.isOpen())
                const wsFake = sinon.fake.returns(fakeWs)
                sinon.replace(window, 'WebSocket', wsFake)
                ws.connectWebSocket(fakeWsUrl)
                sinon.assert.notCalled(wsFake)
                mockServer.stop()
                done()
            }, 100)
        });
    });
    context('called without params', () => {
        jsdom({url: 'http://localhost:8080'})
        beforeEach(() => {
            ws.resetState()
        });
        afterEach(() => {
            ws.resetState()
        })
        it('should remember last url and use it to connect', () => {
            const fakeWsCopy = {...fakeWs}
            const wsFake = sinon.fake.returns(fakeWsCopy)
            sinon.replace(window, 'WebSocket', wsFake)
            ws.connectWebSocket(fakeWsUrl) // Should save fakeWsUrl
            fakeWsCopy.readyState = WebSocket.CLOSED
            ws.connectWebSocket() // Should use saved url
            sinon.assert.calledTwice(wsFake)
            assert.equals(wsFake.firstArg, fakeWsUrl)
        });
        it('should do nothing if no url was ever given', () => {
            const wsFake = sinon.fake.returns(fakeWs)
            sinon.replace(window, 'WebSocket', wsFake)
            ws.connectWebSocket() // Should save fakeWsUrl
            sinon.assert.notCalled(wsFake)
        });
    });
});

describe('ws.onmessage', () => {
    jsdom({url: 'http://localhost:8080'})
    let mockServer
    let mockResponse = {}
    beforeEach(() => {
        ws.resetState()
        mockServer = new Server(fakeWsUrl)
        mockServer.on('connection', socket => {
            // connection intercepted by mock-socket
            socket.send(JSON.stringify(mockResponse))
        });
    });
    afterEach(() => {
        mockServer.stop()
        ws.resetState()
    })
    it('should set saveError if success is in message', (done) => {
        mockResponse = {success: true}
        ws.connectWebSocket(fakeWsUrl) // mock-socket sends mockResponse
        setTimeout(() => {
            assert.isFalse(ws.hasSaveError())
            done()
        }, 100)
    });
    it('should set saveError to true if success is false', (done) => {
        mockResponse = {success: false, error: 'test error'}
        ws.connectWebSocket(fakeWsUrl) // mock-socket sends mockResponse
        setTimeout(() => {
            assert.isTrue(ws.hasSaveError())
            done()
        }, 100)
    });
    it('should store userId if newUserId is in message', (done) => {
        mockResponse = {newUserId: 'testUserId'}
        ws.connectWebSocket(fakeWsUrl) // mock-socket sends mockResponse
        setTimeout(() => {
            // Stop connection and reconnect, it should use userId to connect
            mockServer.close()
            const wsFake = sinon.fake.returns(fakeWs)
            sinon.replace(window, 'WebSocket', wsFake)
            ws.connectWebSocket(fakeWsUrl)
            sinon.assert.calledWith(wsFake, sinon.match('testUserId'))
            done()
        }, 100)
    });
    it('should not throw if message is not an object', (done) => {
        mockResponse = 'a JSON.stringify-ed String'
        ws.connectWebSocket(fakeWsUrl)
        setTimeout(done, 100)
    });
    it('should not throw if message is not valid json', (done) => {
        mockServer.on('connection', socket => {
            socket.send('a non-json String')
        });
        ws.connectWebSocket(fakeWsUrl)
        setTimeout(done, 100)
    });
});

describe('ws.onerror', () => {
    jsdom({url: 'http://localhost:8080'})
    it('should continue execution on ws error', () => {
        const dummy = {CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3}
        const wsFake = sinon.fake.returns(dummy)
        sinon.replace(window, 'WebSocket', wsFake)
        ws.connectWebSocket(fakeWsUrl)
        dummy.onerror()
    })
});

describe('ws.onclose', () => {
    jsdom({url: 'http://localhost:8080'})
    const fakeWebSocket = {...fakeWs}
    beforeEach(() => {
        const wsFake = sinon.fake.returns(fakeWebSocket)
        sinon.replace(window, 'WebSocket', wsFake)
        ws.resetState()
    });
    afterEach(() => {
        ws.resetState()
    })
    it('should reconnect after a delay', () => {
        ws.connectWebSocket(fakeWsUrl)
        fakeWebSocket.onclose({code: 0, reason: null})
        fakeWebSocket.onclose({code: 0, reason: null}) // should be robust to multiple calls
        assert.isTrue(ws.isReconnecting())
    });
});

describe('.sendActions', () => {
    jsdom({url: 'http://localhost:8080'})
    beforeEach(() => {
        ws.resetState()
    });
    afterEach(() => {
        ws.resetState()
    })
    it('should send out a payload containing actions and authKey', () => {
        const sendFake = sinon.fake()
        const fakeWsSend = {...fakeWs, send: sendFake}
        sinon.replace(window, 'WebSocket', sinon.fake.returns(fakeWsSend))
        ws.connectWebSocket(fakeWsUrl)
        const dummyData = [{dummy: 'dummy'}]
        const result = ws.sendActions(dummyData)
        sinon.assert.called(sendFake)
        const parsedArg = JSON.parse(sendFake.firstArg)
        assert.match(parsedArg, sinon.match({userActions: sinon.match(dummyData)}))
        assert.match(parsedArg, sinon.match({authKey: sinon.match.string}))
    });
    it('should return true if websocket is open before and after sending', () => {
        const fakeWsSend = {...fakeWs, readyState: WebSocket.OPEN, send: sinon.fake()}
        sinon.replace(window, 'WebSocket', sinon.fake.returns(fakeWsSend))
        ws.connectWebSocket(fakeWsUrl)
        const result = ws.sendActions([{}])
        assert.isTrue(result)
    });
    it('should return false if websocket is not open', () => {
        const sendFake = sinon.fake()
        const fakeWsClosed = {...fakeWs, readyState: WebSocket.CLOSED, send: sendFake}
        fakeWsClosed.readyState = WebSocket.CLOSED
        sinon.replace(window, 'WebSocket', sinon.fake.returns(fakeWsClosed))
        ws.connectWebSocket(fakeWsUrl)
        const result = ws.sendActions([{}])
        sinon.assert.notCalled(sendFake)
        assert.isFalse(result)
    });
});

describe('.sendString', () => {
    jsdom({url: 'http://localhost:8080'})
    beforeEach(() => {
        ws.resetState()
    });
    afterEach(() => {
        ws.resetState()
    })
    it('should send the String and return true if ws open', () => {
        const testString = 'testString'
        const sendFake = sinon.fake()
        const fakeWsSend = {...fakeWs, send: sendFake}
        sinon.replace(window, 'WebSocket', sinon.fake.returns(fakeWsSend))
        ws.connectWebSocket(fakeWsUrl)
        const result = ws.sendString(testString)
        sinon.assert.calledWith(sendFake, testString)
        assert.isTrue(result)
    });
    it('should return false if ws closed', () => {
        const fakeWsClosed = {...fakeWs, readyState: WebSocket.CLOSED, send: sinon.fake()}
        sinon.replace(window, 'WebSocket', sinon.fake.returns(fakeWsClosed))
        ws.connectWebSocket(fakeWsUrl)
        const result = ws.sendString('test')
        assert.isFalse(result)
    });
});

describe('.resetState', () => {
    jsdom({url: 'http://localhost:8080/?user=testUserId&task=testTaskId'})
    beforeEach(() => {
        ws.resetState()
    })
    it('should clear userId and taskId', () => {
        sinon.replace(window, 'WebSocket', sinon.fake.returns({...fakeWs}))
        ws.connectWebSocket(fakeWsUrl)
        assert.isFalse(ws.getUserId() == null)
        assert.isFalse(ws.getTaskId() == null)
        ws.resetState()
        assert.isTrue(ws.getUserId() == null)
        assert.isTrue(ws.getTaskId() == null)
    });
    it('should clear websocket', () => {
        sinon.replace(window, 'WebSocket', sinon.fake.returns(fakeWs))
        ws.connectWebSocket(fakeWsUrl)
        assert.isTrue(ws.isOpen())
        ws.resetState()
        assert.isFalse(ws.isOpen())
    });
    it('should clear reconnectTimer', () => {
        const fakeWebSocket = {...fakeWs}
        const wsFake = sinon.fake.returns(fakeWebSocket)
        sinon.replace(window, 'WebSocket', wsFake)
        ws.connectWebSocket(fakeWsUrl)
        fakeWebSocket.onclose({code: 0, reason: null}) // Start reconnect timer
        ws.resetState()
        assert.isFalse(ws.isReconnecting())
    });
});
