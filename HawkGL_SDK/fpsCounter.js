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

let fpsCounter = function()
{
    this.__fps = 0;
    this.__frameCount = 0;

    this.__lastTick = null;
    this.__timeElapsed = 0.0;
    
    this.__onFramerateChange = null;
}

fpsCounter.prototype.update = function()
{
    let updateFrq = 0.25;

    let currentTick = performance.now();
    this.__timeElapsed += ((this.__lastTick != null) ? ((currentTick - this.__lastTick) * 0.001) : 0.0);
    this.__lastTick = currentTick;
    
    ++this.__frameCount;
    
    if(this.__timeElapsed >= updateFrq)
    {
        this.__timeElapsed = this.__timeElapsed % updateFrq;

        let oldFps = this.__fps;
        this.__fps = this.__frameCount / updateFrq; 
        this.__frameCount = 0;
        
        if(this.__fps != oldFps && this.__onFramerateChange != null) this.__onFramerateChange(this.__fps);
    }
}

fpsCounter.prototype.onFramerateUpdate = function(callback) {
    this.__onFramerateChange = callback;  
}

fpsCounter.prototype.getFps = function() {
    return this.__fps;
}
