# scratch-log-sender
| Statements                  | Branches                | Functions                 | Lines             |
| --------------------------- | ----------------------- | ------------------------- | ----------------- |
| ![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-100%25-brightgreen.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg?style=flat) |
#### Scratch-log-sender offers functions to collect user actions in [Scratch](https://github.com/LLK/) and send them to an endpoint like [scratch-log-endpoint](https://github.com/goessm/scratch-log-endpoint).

It can be used in scratch-gui, without changes to scratch-vm.\
It was created to collect usage information for analysis in research.

## Usage with [Scratch-Gui](https://github.com/LLK/scratch-gui)
If you have a running version of Scratch-Gui, all you need to do is install scratch-log-sender:
```bash
npm install https://github.com/goessm/scratch-log-sender/tarball/main
```
Connect to your websocket somewhere on startup:
```bash
require('scratch-log-sender').connect(wsUrl, sendDelay);
```
Then start logging with a single line of code:
```bash
require('scratch-log-sender').logUserEvent(...);
```
or, using import:
```bash
import logger from 'scratch-log-sender';
logger.connect(wsUrl, sendDelay)
logger.logUserEvent(...);
```

For a complete example, also see my fully instrumented version of scratch-gui [here](https://github.com/goessm/scratch-gui).

#### Logging block events
Block events are one of the main types of events you may want to log.\
`logListenEvent` is a special function to log block events that tries to filter noise events using a `denoiser` and can ignore certain event types.

Logging block events with scratch-log-sender works without any changes to the [Scratch-VM](https://github.com/LLK/scratch-vm).
This means you can use the default VM or your own version.

A good point to log block events in the Gui is the `attachVM` function in `containers/blocks.jsx`. Simply add your own listener.\
For example, you could change:
```bash
this.workspace.addChangeListener(this.props.vm.blockListener);
```
to:
```bash
this.workspace.addChangeListener(e => {
    this.props.vm.blockListener(e);
    require('scratch-log-sender').logListenEvent(e, this.props.vm.editingTarget.blocks);
});
```
Make sure the workspace events reach the logger **after** they reach scratch-blocks. This is important for events such as create or delete that change the codestate.


## Usage with [Scratch-VM](https://github.com/LLK/scratch-vm)
Scratch-log-sender was designed to be used in the Scratch-GUI without needing to alter the VM.\
However, the log functions are flexible and can be called from other places, like the VM.\
If for some reason you cannot alter the GUI or only want to instrument the VM, you can still use scratch-log-sender to log events.\
For example, you could log events by changing or overriding functions of the `VirtualMachine` class.

Example for the greenFlag event in `VirtualMachine.greenFlag`:
```bash
require('scratch-log-sender').logControlEvent('greenFlag', this.runtime);
```
or for block events in `VirtualMachine.blockListener`:
```bash
if (this.editingTarget) {
    require('scratch-log-sender').logListenEvent(e, this.editingTarget.blocks);
}
```
For an (out of date) example that overrides `VirtualMachine`, see also [scratch-vm-logging](https://github.com/goessm/scratch-vm-logging).


## API

### connect (wsUrl, sendDelay)

Connects to a websocket using given `wsUrl` and sends the log there every `sendDelay` ms.
Automatically reconnects on close, so you only need to call this once.

### logUserEvent (eventType, eventData, jsonString)

Call when a user event occurs to add it to the log.
- **eventType**: String description of event type
- **eventData**: Object containing dditional event data
- **jsonString**: Optional string representation of the scratch runtime (code state)

### logListenEvent (event, blocks, jsonString)

Call with a blockly listen event. Extracts relevant information then logs a user event.
Tries to filter noise / non-user events.
- **event**: A scratch-blocks Blockly event
- **blocks**: Scratch Blocks object of the target where the event occured
- **jsonString**: String representation of the serialized scratch runtime

### logControlEvent (type, data, jsonString)

Same as `logUserEvent`, meant for control events such as greenFlag, stopAll.

### logGuiEvent (type, data)

Log a Gui event.
Event types containing 'change' will be batched based on the data.target and data.property fields.
This means rapid change events will be grouped together.

### logCostumeEvent (type, data, runtime)

Log a GUI event that involves changes to costume or backdrop.
Detects if target is backdrop using runtime and changes type from 'costume_[...]' to 'backdrop_[...]' accordingly.

### logSpriteChange (spriteId, property, newValue)

Convenience function to call logGuiEvent for a sprite_change event.

### getEventLog

Returns the courrent array of stored events but not yet sent events.

### sendLog

Sends current log buffer over websocket connection.

### isOpen

Returns whether the websocket is open and ready.

### hasSaveError

Returns whether or not the last response from the logging endpoint reported a save error.

### isReconnecting

Returns whether websocket is currently trying to reconnect.

### listenToVm (vm)

Call with `vm` object to capture additional events from the VM.
Currently captures the vm events `TURBO_MODE_ON`, `TURBO_MODE_OFF`, and `RUNTIME_STARTED` and logs them as control events.
