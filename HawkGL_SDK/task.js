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

let Task = function(dependencies, body)
{
    this.__worker = null;
    
    this.__body = body;
    this.__onFinish = null;
    this.__events = new Map();

    this.__dependencies = [];
    if(dependencies != null) this.addDependencies(dependencies);
}

Task.__getRootPath = function()
{
    let parts = document.location.href.split('/');
    parts[parts.length - 1] = '';
  
    return parts.join('/');
}

Task.prototype.addDependencies = function(dependencies) {
    this.__dependencies = this.__dependencies.concat(dependencies);    
}

Task.prototype.onEvent = function(eventID, eventHandler)
{
    if(eventHandler != null) this.__events.set(eventID, eventHandler);
    else this.__events.delete(eventID);
}

Task.prototype.onFinish = function(callback) {
    this.__onFinish = callback;
}

Task.prototype.isRunning = function() {
    return (this.__worker != null);
}

Task.prototype.arrest = function()
{
    if(this.isRunning())
    {                
         this.__worker.terminate();
         this.__worker = null;
    }                       
}

Task.prototype.run = function(data, transfer)
{      
    this.arrest();
    
    function isRelativePath(str)
    {
        let pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
                                 '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
                                 '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
                                 '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
                                 '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
                                 '(\\#[-a-z\\d_]*)?$','i'); // fragment locator

        return !pattern.test(str);
    }
    
    let builtins = "function finish(data, transfer) { postMessage({event: null, data: data}, transfer); }             \n" +
                    "function fireEvent(event, data, transfer) { postMessage({event: event, data: data}, transfer); } \n";
                    
    let dependencies = "";   
    let rootPath = Task.__getRootPath();

    for(let i = 0, e = this.__dependencies.length; i != e; ++i)
    {
        let absolutePath = (isRelativePath(this.__dependencies[i]) ? (rootPath + this.__dependencies[i]) : this.__dependencies[i]);
        dependencies += "importScripts(\"" + absolutePath + "\");\n";
     
    }

    let workerSrc = (dependencies + builtins + "self.onmessage = function(e) { (" + this.__body.toString() + ")(e.data); };");        
    this.__worker = new Worker((window.webkitURL || window.URL).createObjectURL(new Blob([workerSrc], {type: "application/javascript"})));
     
    let self = this;
    this.__worker.onmessage = function(e)
    { 
        e = e.data;

        let callback = null;
        if(e.event == null)
        {
            self.arrest();
            callback = self.__onFinish;

        } else callback = self.__events.get(e.event);
   
        if(callback != null) callback(e.data);
    }
    
    this.__worker.postMessage(data, transfer);
}
