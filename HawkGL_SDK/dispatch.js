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

let DispatchQueue = function(onFinishCallback)
{
    this.__tasks = [];
    this.__pendingTasks = 0;

    this.onFinish(onFinishCallback);
}

DispatchQueue.prototype.__resolvePendingTask = function() {
    if((--this.__pendingTasks == 0) && this.__onFinishCallback != null) this.__onFinishCallback(); 
}

DispatchQueue.prototype.createTask = function(block)
{
    let Task = function(ctx, block)
    {
        this.__ctx = ctx;
        this.__block = block;
    }

    Task.prototype.__run = function() {
        this.__block(this);
    }

    Task.prototype.done = function() {
        this.__ctx.__resolvePendingTask();
    }

    let task = new Task(this, block);
    this.__tasks.push(task);
    
    return task;
}

DispatchQueue.prototype.onFinish = function(block) {
    this.__onFinishCallback = block;
}

DispatchQueue.prototype.dispatch = function()
{
    let nTasks = this.__tasks.length;
    this.__pendingTasks += nTasks;
    
    for(let i = 0; i != nTasks; ++i) this.__tasks[i].__run();
    this.__tasks.length = 0;
}

function dispatchAsync(block) {
    setTimeout(block, 0);
}
