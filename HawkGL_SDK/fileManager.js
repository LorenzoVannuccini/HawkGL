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

function loadFilesAsync(filesPathArray, completionHandler)
{                            
    let nFiles = filesPathArray.length;
    
    let dispatch = new Object();
    dispatch.pendingFiles = nFiles;
    dispatch.filesContentArray = new Array(nFiles);
    dispatch.filesPathArray = filesPathArray.slice(0);
    
    for(let i = 0; i != nFiles; ++i)
    {
        let request = new XMLHttpRequest();
        request.responseType = "text";
        
        request.dispatch = dispatch;
        request.targetIndex = i;
        
        request.onreadystatechange = function()
        {
            if(this.readyState == 4)
            {
                let success = (this.status == 200);
                let filePath = this.dispatch.filesPathArray[this.targetIndex];
                
                if(!success) console.error("Error from loadFilesAsync(): unable to load file \"" + filePath + "\n");        
                else this.dispatch.filesContentArray[this.targetIndex] = this.responseText;
                
                if(--this.dispatch.pendingFiles <= 0) completionHandler(this.dispatch.filesContentArray);
            }
        };
        
        request.open("GET", filesPathArray[i], true);  
        request.send();
    }
}

function loadFileAsync(filePath, completionHandler) {
    loadFilesAsync([filePath], completionHandler);
}

