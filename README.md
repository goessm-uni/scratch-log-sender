# scratch-log-sender
#### Scratch-log-sender offers functions to collect user actions in [Scratch](https://github.com/LLK/) and send them to an endpoint like [scratch-log-endpoint](https://github.com/goessm/scratch-log-endpoint).

It can be used in scratch-gui, without changes to scratch-vm.\
It was created to collect usage information for analysis in research.

## Usage with [Scratch-Gui](https://github.com/LLK/scratch-gui)
If you have a running version of Scratch-Gui, all you need to do is install scratch-log-sender:
```bash
npm install https://github.com/goessm/scratch-log-sender/tarball/main
```
Then start logging with a single line of code:
```bash
require('scratch-log-sender').logUserEvent(...);
```
or, using import:
```bash
import logger from 'scratch-log-sender';
logger.logUserEvent(...);
```

Scratch-log-sender handles connecting (and reconnecting) to the endpoint, and sending the log in 10 second batches automatically just by being required/imported.
This design aims to minimize the amount of code needed in your Scratch-Gui.

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
