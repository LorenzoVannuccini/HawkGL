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

let DialogWindow = function()
{ 
    const zIndex = 1; // TODO: infer from DOM
    
    this.__containerDiv = document.createElement("div");
    this.__containerDiv.style.cssText = "width:100vw; height:100vh; display:block; position:fixed; -webkit-user-drag:none; -khtml-user-drag:none; -moz-user-drag:none; -o-user-drag:none; user-drag:none;";
    this.__containerDiv.style.zIndex = zIndex;

    this.__windowDiv = document.createElement("div");
    this.__windowDiv.style.cssText = "border-radius:4px; overflow:hidden; overflow:hidden;";
    
    this.__headerDiv = document.createElement("div");
    this.__headerDiv.style.cssText = "display:block; float:left; overflow:hidden; background-color:rgba(0, 0, 0, 0.1);";

    this.__iconDiv = document.createElement("div");
    this.__iconDiv.style.cssText = "display:block; float:left;";
    
    this.__closeBtn = document.createElement("div");
    this.__closeBtn.style.cssText = "display:block; float:right; text-align:center; background-color:rgba(0, 0, 0, 0.1);";
    this.__closeBtn.innerHTML = "<span style='-webkit-user-select:none; -moz-user-select:none; -ms-user-select:none; user-select:none;'>&times;</span>";
    
    this.__captionDiv = document.createElement("div");
    this.__captionDiv.style.cssText = "height:100%; display:block; float:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center;";
    
    this.__footerDiv = document.createElement("div");
    this.__footerDiv.style.cssText = "width:100%; display:block; float:left; background-color:rgba(0, 0, 0, 0.1);";
    
    this.__resizingCorner = document.createElement("div");
    this.__resizingCorner.style.cssText = "width:20px; height:20px; position:fixed; display:block; cursor:nwse-resize;";
    
    this.__contentContainerDiv = document.createElement("div");
    this.__contentContainerDiv.style.cssText = "width:100%; height:100%; display:block; float:left; text-align:center; overflow:auto;";

    this.__contentDiv = document.createElement("div");
    this.__contentDiv.style.cssText = "width:auto; height:auto; padding:0.75em; display:inline-block; text-align:left; vertical-align:middle; line-height:normal; -webkit-user-select:none; -moz-user-select:none; -ms-user-select:none; user-select:none;";

    this.__headerDiv.appendChild(this.__iconDiv);
    this.__headerDiv.appendChild(this.__captionDiv);
    
    this.__contentContainerDiv.appendChild(this.__contentDiv);

    this.__windowDiv.appendChild(this.__headerDiv);
    this.__windowDiv.appendChild(this.__closeBtn);
    this.__windowDiv.appendChild(this.__contentContainerDiv);
    this.__windowDiv.appendChild(this.__footerDiv);
    this.__windowDiv.appendChild(this.__resizingCorner);
    
    this.__containerDiv.appendChild(this.__windowDiv);

    document.body.appendChild(this.__containerDiv);
    
    let self = this;
    this.__containerDiv.onmousedown = this.__containerDiv.onmousemove = function(e)
    {
        if(self.__resizing)
        {
            let w = self.__w, h = self.__h;

            self.resize(self.__resizeAnchorW + (e.clientX - self.__resizeAnchorX), self.__resizeAnchorH + (e.clientY - self.__resizeAnchorY));
            self.move(self.__x + 0.5 * (self.__w - w), self.__y + 0.5 * (self.__h - h));
            
        } else if(self.__dragging) self.move((e.clientX - self.__dragAnchorX), (e.clientY - self.__dragAnchorY));

        e.preventDefault();
    };

    this.__containerDiv.onmouseup = function(e)
    {
        if(self.__dragging) self.__headerDiv.style.cursor = "grab";
        self.__dragging = self.__resizing = false;
        e.preventDefault();
    };

    this.__closeBtn.onmouseover = function()
    {
        if(!self.__dragging && !self.__resizing)
        {
            self.__closeBtn.style.backgroundColor = "rgba(215, 21, 38, 1.0)";
            self.__closeBtn.style.color = "white";
        }
    };

    this.__closeBtn.onmouseleave = function()
    {
        self.__closeBtn.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
        self.__closeBtn.style.color = "inherit";
    };

    this.__closeBtn.onclick = function()
    {
        self.destroy();
        if(self.__onCloseCallback != null) self.__onCloseCallback();
    };

    this.__onResizeWindowHook = function()
    {
        let isWindowResizable = (self.__resizingCorner.onmousedown != null);
        if(!isWindowResizable) self.fitContent();  

        self.__update();
    };

    window.addEventListener("resize", this.__onResizeWindowHook);
   
    this.__x = 0;
    this.__y = 0;
    this.__w = 0;
    this.__h = 0;

    this.__buttons = [];
    this.__buttonsTotalWidth = 0;
    this.__onCloseCallback = null;
    
    this.__headerHeight = 40;
    this.__footerHeight = 20;

    this.fitContent();
    this.enableDragging(true);
    this.enableResizing(false);
}

DialogWindow.prototype.destroy = function()
{
    document.body.removeChild(this.__containerDiv);
    window.removeEventListener("resize", this.__onResizeWindowHook);
}

DialogWindow.prototype.setTextColor = function(color) {
    this.__windowDiv.style.color = color;
}

DialogWindow.prototype.setSkinColor = function(color) {
    this.__windowDiv.style.backgroundColor = color;
}

DialogWindow.prototype.setBackgroundColor = function(color) {
    this.__containerDiv.style.backgroundColor = color;
}

DialogWindow.prototype.setTitle = function(title, fontSize)
{
    this.__captionDiv.innerHTML = "<span style='-webkit-user-select:none; -moz-user-select:none; -ms-user-select:none; user-select:none;'>" + title + "</span>";
    this.__captionDiv.style.fontSize = ((fontSize != null) ? fontSize : (this.__headerHeight * 0.375)) + "px";
}

DialogWindow.prototype.setIcon = function(imgURL, scale)
{
    if(scale == null) scale = 0.75;

    let size = 100.0 * scale;
    let span = 50.0 * (1.0 - scale);

    this.__iconDiv.innerHTML = "<div style=\"width:" + size + "%; height:" + size + "%; margin-left:" + span + "%; margin-top:" + span + "%; background-image:url('" + imgURL + "'); background-size:contain; background-repeat:no-repeat;\"></div>";
}

DialogWindow.prototype.setContent = function(content, fontSize)
{
    this.__contentDiv.innerHTML = content;
    this.__contentDiv.style.fontSize = ((fontSize != null) ? fontSize : (this.__headerHeight * 0.5)) + "px";

    this.fitContent();
}

DialogWindow.prototype.createButton = function(caption, fontSize, onClick)
{
    let self = this;
    
    this.__footerHeight = 55;
    let button = document.createElement("div");
    
    button.style.cssText = "width:auto; height:auto; float:left; display:block; border-radius:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center;";
    button.innerHTML = "<span style='-webkit-user-select:none; -moz-user-select:none; -ms-user-select:none; user-select:none;'>" + caption + "</span>";
    button.style.fontSize = ((fontSize != null) ? fontSize : (this.__footerHeight * 0.2727)) + "px";

    button.onmouseover = function()
    {
        if(!self.__dragging && !self.__resizing)
        {
            button.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
            button.style.color = "white";
        }
    };

    button.onmouseleave = function()
    {
        button.style.backgroundColor = "transparent";
        button.style.color = "inherit";
    };

    button.onclick = function()
    {
        self.destroy();
        if(onClick != null) onClick();
    };
    
    this.__footerDiv.appendChild(button);
    
    this.__buttonsTotalWidth += (button.width = Math.max(button.clientWidth * 1.2, this.__footerHeight));
    this.__buttons.push(button);
    
    this.fitContent();
}

DialogWindow.prototype.onClose = function(callback) {
    this.__onCloseCallback = callback;
}

DialogWindow.prototype.enableDragging = function(flag)
{
    let self = this;

    this.__headerDiv.style.cursor = (flag ? "grab" : "auto");

    this.__headerDiv.onmousedown = (flag ? function(e)
    {
        self.__dragAnchorX = (e.clientX - self.__x);
        self.__dragAnchorY = (e.clientY - self.__y);
        
        if(!self.__dragging) self.__headerDiv.style.cursor = "grabbing";
        self.__dragging = true;

        e.preventDefault();

    } : null);
}

DialogWindow.prototype.enableResizing = function(flag)
{
    let self = this;
    this.__resizingCorner.style.display = (flag ? "block" : "none");

    this.__resizingCorner.onmousedown = (flag ? function(e)
    {
        self.__dragAnchorX = self.__x;
        self.__dragAnchorY = self.__y;

        self.__resizeAnchorX = e.clientX;
        self.__resizeAnchorY = e.clientY;

        self.__resizeAnchorW = self.__w;
        self.__resizeAnchorH = self.__h - (self.__headerHeight + self.__footerHeight);
    
        self.__resizing = true;

        e.preventDefault();

    } : null);
}

DialogWindow.prototype.move = function(x, y)
{
    this.__x = x;
    this.__y = y;
    
    this.__update();
}

DialogWindow.prototype.resize = function(w, h)
{
    this.__w = w;
    this.__h = h + (this.__headerHeight + this.__footerHeight);
    
    this.__update();
}

DialogWindow.prototype.fitContent = function()
{
    const constraintSolverSteps = 20;
    for(let i = 0; i < constraintSolverSteps; ++i)
    {
        let h = Math.min(Math.max(this.__contentDiv.clientHeight * 1.1, 4.0 * this.__headerHeight), (window.innerHeight - (this.__headerHeight + this.__footerHeight)) * 0.75);
        let w = Math.min(Math.max(this.__contentDiv.clientWidth  * 1.1, h + (this.__headerHeight + this.__footerHeight)), window.innerWidth * 0.75);

        this.resize(Math.max(w, this.__buttonsTotalWidth), h);
    }
}

DialogWindow.prototype.__update = function()
{
    this.__w =  Math.max(Math.min(this.__w, window.innerWidth), (2.0 * this.__headerHeight));
    this.__h =  Math.max(Math.min(this.__h, window.innerHeight), (this.__headerHeight + this.__footerHeight));

    this.__x = Math.max(Math.min(this.__x, (+window.innerWidth  * 0.5) - this.__w * 0.5), (-window.innerWidth  * 0.5) + this.__w * 0.5);
    this.__y = Math.max(Math.min(this.__y, (+window.innerHeight * 0.5) - this.__h * 0.5), (-window.innerHeight * 0.5) + this.__h * 0.5);
    
    this.__windowDiv.style.width   = this.__w + "px";
    this.__windowDiv.style.height  = this.__h + "px";
    this.__windowDiv.style.marginLeft = "calc(50vw - " + (this.__w * 0.5) + "px + " + this.__x + "px)";
    this.__windowDiv.style.marginTop  = "calc(50vh - " + (this.__h * 0.5) + "px + " + this.__y + "px)";

    this.__headerDiv.style.width  = "calc(100% - " + this.__headerHeight + "px";
    this.__headerDiv.style.height = this.__headerHeight + "px";

    this.__iconDiv.style.width  = this.__headerHeight + "px";
    this.__iconDiv.style.height = this.__iconDiv.style.lineHeight = this.__headerHeight + "px";

    this.__captionDiv.style.width  = "calc(100% - " + this.__headerHeight + "px";
    this.__captionDiv.style.height = this.__captionDiv.style.lineHeight = this.__headerHeight + "px";
    
    this.__closeBtn.style.width = this.__closeBtn.style.height = this.__headerHeight + "px";
    this.__closeBtn.style.fontSize = (this.__headerHeight * 0.8) + "px";
    this.__closeBtn.style.lineHeight = this.__headerHeight + "px";
    
    this.__contentContainerDiv.style.height = this.__contentContainerDiv.style.lineHeight = this.__h - (this.__headerHeight + this.__footerHeight) + "px";

    this.__footerDiv.style.height = this.__footerHeight + "px";

    this.__resizingCorner.style.marginLeft = (this.__w - 10) + "px";
    this.__resizingCorner.style.marginTop  = (this.__h - 10) + "px";

    for(let i= 0, e = this.__buttons.length; i != e; ++i)
    {
        let button = this.__buttons[i];
       
        button.style.width = ((button.width / this.__buttonsTotalWidth) * 100.0) + "%";
        button.style.lineHeight = this.__footerHeight + "px";
    }
}

let DialogManager = function() {};

DialogManager.alertIcon   = null;
DialogManager.errorIcon   = null;
DialogManager.warningIcon = null;
DialogManager.confirmIcon = null;

DialogManager.titleFontSize   = null;
DialogManager.messageFontSize = null;
DialogManager.buttonFontSize  = null;

DialogManager.textColor       = "rgb(16, 16, 16)";
DialogManager.skinColor       = "rgba(249, 249, 250, 0.85)";
DialogManager.backgroundColor = "rgba(0, 0, 0, 0.5)";

DialogManager.__stack = [];

DialogManager.__createPopupWindow = function()
{
    let popupWindow = new DialogWindow();

    let offset = (DialogManager.__stack.length) * 6.0;
    popupWindow.move(offset, offset);

    popupWindow.setTextColor(DialogManager.textColor);
    popupWindow.setSkinColor(DialogManager.skinColor);
    popupWindow.setBackgroundColor(DialogManager.backgroundColor);

    DialogManager.__stack.push(popupWindow);

    return popupWindow;
}

DialogManager.__createButtonCallback = function(event)
{
    return function()
    {
        DialogManager.__stack.pop();
        if(event != null) event();
    };
}

DialogManager.alert = function(title, message, onClose)
{
    let popupWindow = DialogManager.__createPopupWindow();
    
    if(DialogManager.alertIcon != null) popupWindow.setIcon(DialogManager.alertIcon);
    
    if(title   != null) popupWindow.setTitle(title, DialogManager.titleFontSize);
    if(message != null) popupWindow.setContent(message, DialogManager.messageFontSize);
    
    popupWindow.createButton("OK", DialogManager.buttonFontSize, DialogManager.__createButtonCallback(onClose));
    popupWindow.onClose(DialogManager.__createButtonCallback(onClose));

    return popupWindow;
}

DialogManager.warning = function(title, message, onCancel, onRetry)
{
    let popupWindow = DialogManager.__createPopupWindow();
    
    if(DialogManager.warningIcon != null) popupWindow.setIcon(DialogManager.warningIcon);
    
    if(title   != null) popupWindow.setTitle(title, DialogManager.titleFontSize);
    if(message != null) popupWindow.setContent(message, DialogManager.messageFontSize);
    
    if(onRetry != null) popupWindow.createButton("RETRY", DialogManager.buttonFontSize, DialogManager.__createButtonCallback(onRetry));
    popupWindow.createButton("OK", DialogManager.buttonFontSize, DialogManager.__createButtonCallback(onCancel));
    popupWindow.onClose(DialogManager.__createButtonCallback(onCancel));

    return popupWindow;
}

DialogManager.error = function(title, message, onCancel, onRetry)
{
    let popupWindow = DialogManager.__createPopupWindow();
    
    if(DialogManager.errorIcon != null) popupWindow.setIcon(DialogManager.errorIcon);
    
    if(title   != null) popupWindow.setTitle(title, DialogManager.titleFontSize);
    if(message != null) popupWindow.setContent(message, DialogManager.messageFontSize);
    
    if(onRetry != null) popupWindow.createButton("RETRY", DialogManager.buttonFontSize, DialogManager.__createButtonCallback(onRetry));
    popupWindow.createButton("OK", DialogManager.buttonFontSize, DialogManager.__createButtonCallback(onCancel));
    popupWindow.onClose(DialogManager.__createButtonCallback(onCancel));

    return popupWindow;
}

DialogManager.confirm = function(title, message, onCancel, onConfirm, onRefuse)
{
    let popupWindow = DialogManager.__createPopupWindow();
    
    if(DialogManager.confirmIcon != null) popupWindow.setIcon(DialogManager.confirmIcon);
    
    if(title   != null) popupWindow.setTitle(title, DialogManager.titleFontSize);
    if(message != null) popupWindow.setContent(message, DialogManager.messageFontSize);
    
    popupWindow.createButton("CANCEL", DialogManager.buttonFontSize, DialogManager.__createButtonCallback(onCancel));
    if(onRefuse != null) popupWindow.createButton("NO", DialogManager.buttonFontSize, DialogManager.__createButtonCallback(onRefuse));
    popupWindow.createButton(((onRefuse != null) ? "YES" : "OK"), DialogManager.buttonFontSize, DialogManager.__createButtonCallback(onConfirm));
    popupWindow.onClose(DialogManager.__createButtonCallback(onCancel));

    return popupWindow;
}

DialogManager.clear = function()
{
    for(let i = 0, e = this.__stack.length; i != e; ++i) this.__stack[i].destroy();
    this.__stack.length = 0;
}
