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

let StateMachine = function()
{
    this.__inputs = new Map();
    this.__state = null;
}    

StateMachine.createInput = function()
{
    if(StateMachine.__inputUID == null) StateMachine.__inputUID = -1;
    return ++StateMachine.__inputUID;
}

StateMachine.State = function(ctx, onStateEnter, onStateLeave)
{
    this.__ctx = ctx;
    
    this.__onEnterCallback   = null;
    this.__onLeaveCallback   = null;
    this.__onInputCallbacks = new Map();

    this.onEnter(onStateEnter);
    this.onLeave(onStateLeave);
}

StateMachine.State.prototype.clear = function() {
    this.__onInputCallbacks.clear();
}

StateMachine.State.prototype.onEnter = function(callback) {
    this.__onEnterCallback = callback;
}

StateMachine.State.prototype.onLeave = function(callback) {
    this.__onLeaveCallback = callback;
}

StateMachine.State.prototype.onInput = function(input, state, conditionalFunctor)
{
    let self = this;

    this.__onInputCallbacks.set(input, function(ctx)
    {
        if(conditionalFunctor == null || conditionalFunctor(ctx))
        {
            if(state == self) ctx.setState(null, false);
            
            ctx.setState(state);
        }
    });
}

StateMachine.State.prototype.input = function(input)
{
    let response = this.__onInputCallbacks.get(input);
    if(response != null) response(this.__ctx);
}

StateMachine.prototype.createInput = function() {
    return StateMachine.createInput();
}

StateMachine.prototype.createState = function(onEnterCallback, onLeaveCallback) {
    return new StateMachine.State(this, onEnterCallback, onLeaveCallback);
}

StateMachine.prototype.setState = function(state, shouldFireEvents)
{
    if(shouldFireEvents == null) shouldFireEvents = true;

    if(state != this.__state)
    {
        if(shouldFireEvents && this.__state != null && this.__state.__onLeaveCallback != null) this.__state.__onLeaveCallback(this);
        
        this.__state = state;

        if(shouldFireEvents && this.__state != null && this.__state.__onEnterCallback != null) this.__state.__onEnterCallback(this);
    }
}

StateMachine.prototype.getState = function() {
    return this.__state;
}

StateMachine.prototype.input = function(input) {
    if(this.__state != null) this.__state.input(input); 
}
