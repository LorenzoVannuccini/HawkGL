//
//  Copyright © 2019 Lorenzo Vannuccini, blackravenprod@gmail.com
//  http://www.blackravenproduction.com/portfolio/lorenzo_vannuccini
//
//  This framework is provided 'as-is', without any express or implied
//  warranty. In no event will the authors be held liable for any damages
//  arising from the use of this framework.
//
//  Permission is granted to anyone to use this framework for any purpose,
//  including commercial applications, and to alter it and redistribute it
//  freely, subject to the following restrictions:
//
//    1. The origin of this framework must not be misrepresented; you must not
//       claim that you wrote the original framework. If you use this framework
//       in a product, an acknowledgment in the product documentation would be
//       appreciated but is not required.
//
//    2. Altered source versions must be plainly marked as such, and must not be
//       misrepresented as being the original software.
//
//    3. This notice may not be removed or altered from any source distribution.
//

let KeyCodes = Object.freeze(
{
    MOUSE_LEFT_BUTTON: 1,
    MOUSE_MID_BUTTON: 2,
    MOUSE_RIGHT_BUTTON: 3,
    BACKSPACE: 8,
    TAB: 9,
    ENTER: 13,
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
    PAUSE: 19,
    CAPS_LOCK: 20,
    ESCAPE: 27,
    SPACE: 32,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    END: 35,
    HOME: 36,
    LEFT_ARROW: 37,
    UP_ARROW: 38,
    RIGHT_ARROW: 39,
    DOWN_ARROW: 40,
    INSERT: 45,
    DELETE: 46,
    KEY_0: 48,
    KEY_1: 49,
    KEY_2: 50,
    KEY_3: 51,
    KEY_4: 52,
    KEY_5: 53,
    KEY_6: 54,
    KEY_7: 55,
    KEY_8: 56,
    KEY_9: 57,
    KEY_A: 65,
    KEY_B: 66,
    KEY_C: 67,
    KEY_D: 68,
    KEY_E: 69,
    KEY_F: 70,
    KEY_G: 71,
    KEY_H: 72,
    KEY_I: 73,
    KEY_J: 74,
    KEY_K: 75,
    KEY_L: 76,
    KEY_M: 77,
    KEY_N: 78,
    KEY_O: 79,
    KEY_P: 80,
    KEY_Q: 81,
    KEY_R: 82,
    KEY_S: 83,
    KEY_T: 84,
    KEY_U: 85,
    KEY_V: 86,
    KEY_W: 87,
    KEY_X: 88,
    KEY_Y: 89,
    KEY_Z: 90,
    LEFT_META: 91,
    RIGHT_META: 92,
    SELECT: 93,
    NUMPAD_0: 96,
    NUMPAD_1: 97,
    NUMPAD_2: 98,
    NUMPAD_3: 99,
    NUMPAD_4: 100,
    NUMPAD_5: 101,
    NUMPAD_6: 102,
    NUMPAD_7: 103,
    NUMPAD_8: 104,
    NUMPAD_9: 105,
    MULTIPLY: 106,
    ADD: 107,
    SUBTRACT: 109,
    DECIMAL: 110,
    DIVIDE: 111,
    F1: 112,
    F2: 113,
    F3: 114,
    F4: 115,
    F5: 116,
    F6: 117,
    F7: 118,
    F8: 119,
    F9: 120,
    F10: 121,
    F11: 122,
    F12: 123,
    NUM_LOCK: 144,
    SCROLL_LOCK: 145,
    SEMICOLON: 186,
    EQUALS: 187,
    COMMA: 188,
    DASH: 189,
    PERIOD: 190,
    FORWARD_SLASH: 191,
    GRAVE_ACCENT: 192,
    OPEN_BRACKET: 219,
    BACK_SLASH: 220,
    CLOSE_BRACKET: 221,
    SINGLE_QUOTE: 222
});

let InputDeviceManager = function(target)
{
    this.__keyState = new Array(256);
    
    this.__onKeyClickedEvents = new Map();
    this.__onKeyReleaseEvents = new Map();

    this.__onMouseMoveEvents  = [];
    this.__onMouseWheelEvents = [];

    this.__cursorDragEvents = new Map();
    this.__cursorPosition = {x: 0, y: 0};
    this.__dragging = 0;
    
    this.__enabled = true;
    
    this.setTarget(((target != null) ? target : window));
}

InputDeviceManager.prototype.free = function()
{
    this.clear();

    if(this.__target != null)
    {
        this.__unregisterHooks();
        this.__target = null;
    }
}

InputDeviceManager.prototype.__registerHooks = function()
{
    let self = this;

    this.__onKeyDownHook = function(e)
    {
        let keyCode = (e.which || e.keyCode);

        let dragEvent = self.__cursorDragEvents.get(keyCode);
        if(dragEvent != null && dragEvent.anchor == null)
        {
            dragEvent.anchor = self.getMouseCoords();
            ++self.__dragging;
        }
            
        let shouldFireEvent = false;
        if(self.__keyState[keyCode] == 0) shouldFireEvent = true;

        self.__keyState[keyCode] = Math.min(self.__keyState[keyCode] + 1, 2);
        
        if(shouldFireEvent && self.__enabled) 
        {
            let events = self.__onKeyClickedEvents.get(keyCode);
            if(events != null) for(let i = 0, e = events.length; i != e; ++i) events[i](keyCode);
        }
    };

    this.__onKeyUpHook = function(e)
    {
        let keyCode = (e.which || e.keyCode);
        
        let dragEvent = self.__cursorDragEvents.get(keyCode);
        if(dragEvent != null && dragEvent.anchor != null)
        {
            dragEvent.anchor = null;
            --self.__dragging;
        } 

        let shouldFireEvent = false;
        if(self.__keyState[keyCode] != 0) shouldFireEvent = true;

        self.__keyState[keyCode] = 0;

        if(shouldFireEvent && self.__enabled) 
        {
            let events = self.__onKeyReleaseEvents.get(keyCode);
            if(events != null) for(let i = 0, e = events.length; i != e; ++i) events[i](keyCode);
        }
    };

    this.__onMouseMoveHook = function(e)
    {
        let movementX = e.movementX || e.mozMovementX || 0;
        let movementY = e.movementY || e.mozMovementY || 0;

        let shouldFireEvent = (self.__enabled && (movementX != 0 || movementY != 0));

        self.__cursorPosition.x = e.clientX;
        self.__cursorPosition.y = e.clientY;

        if(shouldFireEvent) 
        {
            self.__cursorDragEvents.forEach( function(dragEvent, keyCode)
            {
                if(dragEvent.anchor != null) for(let i = 0, e = dragEvent.events.length; i != e; ++i) {
                    dragEvent.events[i](dragEvent.anchor.x, dragEvent.anchor.y, self.__cursorPosition.x, self.__cursorPosition.y);
                }
            });

            for(let i = 0, e = self.__onMouseMoveEvents.length; i != e; ++i) self.__onMouseMoveEvents[i](movementX, movementY, self.__cursorPosition.x, self.__cursorPosition.y);
        }
    };

    this.__onMouseDownHook = function(e)
    {
        self.__onMouseMoveHook(e);
        self.__onKeyDownHook(e);
    };

    this.__onMouseUpHook = function(e)
    {
        let keyCode = (e.which || e.keyCode);
        if(keyCode == self.__cursorDragKeyCode) self.__cursorDragEvents[keyCode] = null;

        self.__onKeyUpHook(e);
    };

    this.__onMouseWheelHook = function(e)
    {
        if(self.__enabled)
        {
            let delta = -Math.sign(e.deltaY);
            for(let i = 0, e = self.__onMouseWheelEvents.length; i != e; ++i) self.__onMouseWheelEvents[i](delta);
        }
    }

    this.__target.addEventListener("keyup",     this.__onKeyUpHook);
    this.__target.addEventListener("keydown",   this.__onKeyDownHook);
    this.__target.addEventListener("mouseup",   this.__onMouseUpHook);
    this.__target.addEventListener("mousedown", this.__onMouseDownHook);
    this.__target.addEventListener("mousemove", this.__onMouseMoveHook);
    this.__target.addEventListener("wheel",     this.__onMouseWheelHook);
}

InputDeviceManager.prototype.__unregisterHooks = function()
{
    this.__target.removeEventListener("keyup",     this.__onKeyUpHook);
    this.__target.removeEventListener("keydown",   this.__onKeyDownHook);
    this.__target.removeEventListener("mouseup",   this.__onMouseUpHook);
    this.__target.removeEventListener("mousedown", this.__onMouseDownHook);
    this.__target.removeEventListener("mousemove", this.__onMouseMoveHook);
    this.__target.removeEventListener("wheel",     this.__onMouseWheelHook);
}

InputDeviceManager.prototype.setTarget = function(target)
{
    if(this.__target != target)
    {
        if(this.__target != null) this.__unregisterHooks();
        
        this.__target = target;
        this.clear(false);

        if(this.__target != null) this.__registerHooks();
    }
}

InputDeviceManager.prototype.clear = function(shouldClearEvents)
{
    if(shouldClearEvents == null) shouldClearEvents = true;
    
    if(shouldClearEvents)
    {
        this.__cursorDragEvents.clear();
        this.__onKeyClickedEvents.clear();
        this.__onKeyReleaseEvents.clear();
        
        this.__onMouseMoveEvents.length  = 0;
        this.__onMouseWheelEvents.length = 0;
    }

    for(let i = 0, e = this.__keyState.length; i != e; ++i) this.__keyState[i] = 0;
    
    this.__cursorDragEvents.forEach( function(dragEvent, keyCode) {
        dragEvent.anchor = null;
    });

    this.__dragging = 0;
}

InputDeviceManager.prototype.update = function()
{
    for(let i = 0, e = this.__keyState.length; i != e; ++i)
    {
        if(this.__keyState[i] == 1) this.__keyState[i] = 2;
    }
}

InputDeviceManager.prototype.enable = function(flag) {
    this.__enabled = ((flag != null) ? flag : true);
}

InputDeviceManager.prototype.disable = function(flag) {
    this.__enabled = ((flag != null) ? flag : false);
}

InputDeviceManager.prototype.isEnabled = function() {
    return this.__enabled;
}

InputDeviceManager.prototype.isKeyPressed = function(keyCode) {
    return (this.__enabled && this.__keyState[keyCode] > 0);
}

InputDeviceManager.prototype.isKeyClicked = function(keyCode) {
    return (this.__enabled && this.__keyState[keyCode] == 1);
}

InputDeviceManager.prototype.isAnyKeyClicked = function(keyCodeArray)
{
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) if(this.isKeyClicked(keyCodeArray[i])) return true;
    return false;
}

InputDeviceManager.prototype.isAnyKeyPressed = function(keyCodeArray)
{
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) if(this.isKeyPressed(keyCodeArray[i])) return true;
    return false;
}

InputDeviceManager.prototype.areAllKeysPressed = function(keyCodeArray)
{
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) if(!this.isKeyPressed(keyCodeArray[i])) return false;
    return true;
}

InputDeviceManager.prototype.isMouseLeftKeyPressed = function() {
    return this.isKeyPressed(KeyCodes.MOUSE_LEFT_BUTTON);
}

InputDeviceManager.prototype.isMouseMidKeyPressed = function() {
    return this.isKeyPressed(KeyCodes.MOUSE_MID_BUTTON);
}

InputDeviceManager.prototype.isMouseRightKeyPressed = function() {
    return this.isKeyPressed(KeyCodes.MOUSE_RIGHT_BUTTON);
}

InputDeviceManager.prototype.isMouseLeftKeyClicked = function() {
    return this.isKeyClicked(KeyCodes.MOUSE_LEFT_BUTTON);
}

InputDeviceManager.prototype.isMouseMidKeyClicked = function() {
    return this.isKeyClicked(KeyCodes.MOUSE_MID_BUTTON);
}

InputDeviceManager.prototype.isMouseRightKeyClicked = function() {
    return this.isKeyClicked(KeyCodes.MOUSE_RIGHT_BUTTON);
}

InputDeviceManager.prototype.isMouseDragging = function() {
    return (this.__enabled && this.__dragging > 0);
}

InputDeviceManager.prototype.getMouseCoords = function()
{
    let coords =
    {
        x: (this.__enabled ? this.__cursorPosition.x : 0),
        y: (this.__enabled ? this.__cursorPosition.y : 0)
    };

    return coords;
}

InputDeviceManager.prototype.__registerKeyboardEvent = function(classifier, keyCode, event)
{
    let queue = classifier.get(keyCode);
    if(queue == null) classifier.set(keyCode, (queue = []));

    queue.push(event);
}

InputDeviceManager.prototype.__unregisterKeyboardEvent = function(classifier, keyCode, event)
{
    let queue = classifier.get(keyCode);
    if(queue != null) 
    {
        let index = queue.indexOf(event);
        if(index >= 0) queue.remove(index);
    }
}

InputDeviceManager.prototype.__registerMouseEvent = function(event) {
    this.__onMouseMoveEvents.push(event);
}

InputDeviceManager.prototype.__unregisterMouseEvent = function(event)
{
    let index = this.__onMouseMoveEvents.indexOf(event);
    if(index >= 0) this.__onMouseMoveEvents.remove(index);
}

InputDeviceManager.prototype.__registerMouseWheelEvent = function(event) {
    this.__onMouseWheelEvents.push(event);
}

InputDeviceManager.prototype.__unregisterMouseWheelEvent = function(event)
{
    let index = this.__onMouseWheelEvents.indexOf(event);
    if(index >= 0) this.__onMouseWheelEvents.remove(index);
}

InputDeviceManager.prototype.__registerDragEvent = function(keyCode, event)
{
    let dragEvent = this.__cursorDragEvents.get(keyCode);
    if(dragEvent == null) this.__cursorDragEvents.set(keyCode, (dragEvent = {anchor: null, events: []}));

    dragEvent.events.push(event);
}

InputDeviceManager.prototype.__unregisterDragEvent = function(keyCode, event)
{
    let dragEvent = this.__cursorDragEvents.get(keyCode);
    if(dragEvent != null)
    {
        let index = dragEvent.events.indexOf(event);
        if(index >= 0) dragEvent.events.remove(index);
    }
}

InputDeviceManager.prototype.__createOnAllKeysDownFunctor = function(keyCodeArray, event)
{
    let self = this;

    return function() {
        if(self.areAllKeysPressed(keyCodeArray)) event(keyCodeArray);
    };
}

InputDeviceManager.prototype.createEventOnKey = function(keyCode, event)
{
    this.createEventOnKeyDown(keyCode, event);
    this.createEventOnKeyRelease(keyCode, event);    
}

InputDeviceManager.prototype.removeEventOnKey = function(keyCode, event)
{
    this.removeEventOnKeyDown(keyCode, event);
    this.removeEventOnKeyRelease(keyCode, event);  
}

InputDeviceManager.prototype.createEventOnKeyDown = function(keyCode, event) {
    this.__registerKeyboardEvent(this.__onKeyClickedEvents, keyCode, event);
}

InputDeviceManager.prototype.removeEventOnKeyDown = function(keyCode, event) {
    this.__unregisterKeyboardEvent(this.__onKeyClickedEvents, keyCode, event);
}

InputDeviceManager.prototype.createEventOnKeyRelease = function(keyCode, event) {
    this.__registerKeyboardEvent(this.__onKeyReleaseEvents, keyCode, event);
}

InputDeviceManager.prototype.removeEventOnKeyRelease = function(keyCode, event) {
    this.__unregisterKeyboardEvent(this.__onKeyReleaseEvents, keyCode, event);
}

InputDeviceManager.prototype.createEventOnAnyKey = function(keyCodeArray, event) {
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) this.createEventOnKey(keyCodeArray[i], event);
}

InputDeviceManager.prototype.removeEventOnAnyKey = function(keyCodeArray, event) {
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) this.removeEventOnKey(keyCodeArray[i], event);
}

InputDeviceManager.prototype.createEventOnAnyKeyDown = function(keyCodeArray, event) {
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) this.createEventOnKeyDown(keyCodeArray[i], event);
}

InputDeviceManager.prototype.removeEventOnAnyKeyDown = function(keyCodeArray, event) {
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) this.removeEventOnKeyDown(keyCodeArray[i], event);
}

InputDeviceManager.prototype.createEventOnAnyKeyRelease = function(keyCodeArray, event) {
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) this.createEventOnKeyRelease(keyCodeArray[i], event);
}

InputDeviceManager.prototype.removeEventOnAnyKeyRelease = function(keyCodeArray, event) {
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) this.releaseEventOnKeyRelease(keyCodeArray[i], event);
}

InputDeviceManager.prototype.createEventOnAllKeysDown = function(keyCodeArray, event)
{
    event = this.__createOnAllKeysDownFunctor(keyCodeArray, event);
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) this.createEventOnKeyDown(keyCodeArray[i], event);
}

InputDeviceManager.prototype.removeEventOnAllKeysDown = function(keyCodeArray, event)
{
    event = this.__createOnAllKeysDownFunctor(keyCodeArray, event);
    for(let i = 0, e = keyCodeArray.length; i != e; ++i) this.removeEventOnKeyDown(keyCodeArray[i], event);
}

InputDeviceManager.prototype.createEventOnMouseWheel = function(event) {
    this.__registerMouseWheelEvent(event);
}

InputDeviceManager.prototype.removeEventOnMouseWheel = function(event) {
    this.__unregisterMouseWheelEvent(event);
}

InputDeviceManager.prototype.createEventOnMouseLeftKeyDown = function(event) {
    this.createEventOnKeyDown(KeyCodes.MOUSE_LEFT_BUTTON, event);
}

InputDeviceManager.prototype.removeEventOnMouseLeftKeyDown = function(event) {
    this.removeEventOnKeyDown(KeyCodes.MOUSE_LEFT_BUTTON, event);
}

InputDeviceManager.prototype.createEventOnMouseMidKeyDown = function(event) {
    this.createEventOnKeyDown(KeyCodes.MOUSE_MID_BUTTON, event);
}

InputDeviceManager.prototype.removeEventOnMouseMidKeyDown = function(event) {
    this.removeEventOnKeyDown(KeyCodes.MOUSE_MID_BUTTON, event);
}

InputDeviceManager.prototype.createEventOnMouseRightKeyDown = function(event) {
    this.createEventOnKeyDown(KeyCodes.MOUSE_RIGHT_BUTTON, event);
}

InputDeviceManager.prototype.removeEventOnMouseRightKeyDown = function(event) {
    this.removeEventOnKeyDown(KeyCodes.MOUSE_RIGHT_BUTTON, event);
}

InputDeviceManager.prototype.createEventOnMouseLeftKeyRelease = function(event) {
    this.createEventOnKeyRelease(KeyCodes.MOUSE_LEFT_BUTTON, event);
}

InputDeviceManager.prototype.removeEventOnMouseLeftKeyRelease = function(event) {
    this.removeEventOnKeyRelease(KeyCodes.MOUSE_LEFT_BUTTON, event);
}

InputDeviceManager.prototype.createEventOnMouseMidKeyRelease = function(event) {
    this.createEventOnKeyRelease(KeyCodes.MOUSE_MID_BUTTON, event);
}

InputDeviceManager.prototype.removeEventOnMouseMidKeyRelease = function(event) {
    this.removeEventOnKeyRelease(KeyCodes.MOUSE_MID_BUTTON, event);
}

InputDeviceManager.prototype.createEventOnMouseRightKeyRelease = function(event) {
    this.createEventOnKeyRelease(KeyCodes.MOUSE_RIGHT_BUTTON, event);
}

InputDeviceManager.prototype.removeEventOnMouseRightKeyRelease = function(event) {
    this.removeEventOnKeyRelease(KeyCodes.MOUSE_RIGHT_BUTTON, event);
}

InputDeviceManager.prototype.createEventOnMouseMove = function(event) {
    this.__registerMouseEvent(event);
}

InputDeviceManager.prototype.removeEventOnMouseMove = function(event) {
    this.__unregisterMouseEvent(event);
}

InputDeviceManager.prototype.createEventOnKeyDrag = function(keyCode, event) {
    this.__registerDragEvent(keyCode, event);
}

InputDeviceManager.prototype.removeEventOnKeyDrag = function(keyCode, event) {
    this.__unregisterDragEvent(keyCode, event);
}

InputDeviceManager.prototype.createEventOnMouseLeftKeyDrag = function(event) {
    this.createEventOnKeyDrag(KeyCodes.MOUSE_LEFT_BUTTON, event);
}

InputDeviceManager.prototype.removeEventOnMouseLeftKeyDrag = function(event) {
    this.removeEventOnKeyDrag(KeyCodes.MOUSE_LEFT_BUTTON, event);
}

InputDeviceManager.prototype.createEventOnMouseMidKeyDrag = function(event) {
    this.createEventOnKeyDrag(KeyCodes.MOUSE_MID_BUTTON, event);
}

InputDeviceManager.prototype.removeEventOnMouseMidKeyDrag = function(event) {
    this.removeEventOnKeyDrag(KeyCodes.MOUSE_MID_BUTTON, event);
}

InputDeviceManager.prototype.createEventOnMouseRightKeyDrag = function(event) {
    this.createEventOnKeyDrag(KeyCodes.MOUSE_RIGHT_BUTTON, event);
}

InputDeviceManager.prototype.removeEventOnMouseRightKeyDrag = function(event) {
    this.removeEventOnKeyDrag(KeyCodes.MOUSE_RIGHT_BUTTON, event);
}
