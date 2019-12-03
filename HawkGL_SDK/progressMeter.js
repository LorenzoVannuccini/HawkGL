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

let ProgressMeter = function()
{
    this.__total = 0;
    this.__pending = 0;

    this.__onChangeEvent = null;
}

ProgressMeter.prototype.push = function()
{
    ++this.__pending;
    ++this.__total;

    if(this.__onChangeEvent != null) this.__onChangeEvent(this);
}

ProgressMeter.prototype.pop = function()
{
    if(--this.__pending <= 0) this.__pending = this.__total = 0;
    if(this.__onChangeEvent != null) this.__onChangeEvent(this);
}

ProgressMeter.prototype.pending = function() {
    return this.__pending;
}

ProgressMeter.prototype.rate = function() {
    return ((this.__total > 0) ? ((this.__total - this.__pending) / this.__total) : 1.0);
}

ProgressMeter.prototype.onChange = function(callback) {
    this.__onChangeEvent = callback;
}
