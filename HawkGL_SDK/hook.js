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

let Hook = function(a, b)
{
    this.__enable = true;
    this.__object = ((b != null) ? a : window);
    this.__functionName = ((b != null) ? b : a);
    this.__trampoline = this.__object[this.__functionName];
}

Object.defineProperty(Hook.prototype, "trampoline", {
    get: function trampoline() {
        return this.__trampoline;
    }
});

Hook.detour = function(a, b, c)
{
    let object = ((b != null) ? a : window);
    let functionName = ((b != null) ? b : a);
    let interceptor = ((c != null) ? c : b);

    let hook = new Hook(object, functionName);
    hook.detour(interceptor);

    return hook;
}

Hook.prototype.detour = function(interceptor)
{
    let hook = this;
    if(interceptor == null) interceptor = this.__trampoline;

    this.__object[this.__functionName] = function() {
        return (hook.__enable ? interceptor.apply(this, arguments) : hook.__trampoline.apply(this, arguments));
    };
}

Hook.prototype.toggle = function(enable) {
    this.__enable = enable;
}

Hook.prototype.release = function() {
    this.detour(null);
}
