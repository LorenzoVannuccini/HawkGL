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

let glVertexBuffer = function(ctx, bufferData)
{
    this.__ctx = ctx;
    this.__shouldUpdate = true;

    this.__bufferData = bufferData;
    this.__bufferID = this.__ctx.getGL().createBuffer();
}

glVertexBuffer.prototype.__pushToGPU = function() // NB: assumes buffer is already bound
{
    let gl = this.__ctx.getGL();
    gl.bufferData(gl.ARRAY_BUFFER, this.__bufferData, gl.STATIC_DRAW);
    
    this.__shouldUpdate = false;
}

glVertexBuffer.prototype.bind = function()
{
    this.__ctx.bindVertexBuffer(this.__bufferID);
    if(this.__shouldUpdate) this.__pushToGPU();
}

glVertexBuffer.prototype.unbind = function() {
    this.__ctx.unbindVertexBuffer(this.__bufferID);
}

glVertexBuffer.prototype.size = function() {
    return (this.__bufferData.byteLength / glVertex.sizeBytes());
}

glVertexBuffer.prototype.at = function(index) {
    return glVertex.fromArrayBuffer(this.__bufferData, index * glVertex.sizeBytes());
}

glVertexBuffer.prototype.free = function()
{
    this.unbind();
    
    this.__ctx.getGL().deleteBuffer(this.__bufferID);
    this.__bufferID = this.__bufferData = null;
}

// ----------------------------------------------------------------------------------------------------

let glIndexBuffer = function(ctx, bufferData)
{
    this.__ctx = ctx;
    this.__shouldUpdate = true;

    this.__bufferID = this.__ctx.getGL().createBuffer();
    this.__bufferData = ((bufferData != null) ? bufferData : []);

    let gl = this.__ctx.getGL();
    let size = this.size();

    let precisionBits = 8;
    while(size >= Math.pow(2, precisionBits) && precisionBits < 32) precisionBits *= 2;
    
    switch(precisionBits)
    {
        case 8:  this.__type = gl.UNSIGNED_BYTE;  break;
        case 16: this.__type = gl.UNSIGNED_SHORT; break;
        case 32: this.__type = gl.UNSIGNED_INT;   break;
    }
}

glIndexBuffer.prototype.__pushToGPU = function() // NB: assumes buffer is already bound
{
    let gl = this.__ctx.getGL();
    
    let bufferData = null;

    switch(this.getType())
    {
        case gl.UNSIGNED_BYTE:  bufferData = new Uint8Array( this.__bufferData); break;
        case gl.UNSIGNED_SHORT: bufferData = new Uint16Array(this.__bufferData); break;
        case gl.UNSIGNED_INT:   bufferData = new Uint32Array(this.__bufferData); break;
    }
    
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);
    
    this.__shouldUpdate = false;
}

glIndexBuffer.prototype.bind = function()
{
    this.__ctx.bindIndexBuffer(this.__bufferID);
    if(this.__shouldUpdate) this.__pushToGPU();
}

glIndexBuffer.prototype.unbind = function() {
    this.__ctx.unbindVertexBuffer(this.__bufferID);
}

glIndexBuffer.prototype.size = function() {
    return this.__bufferData.length;
}

glIndexBuffer.prototype.getType = function() {
    return this.__type;
}

glIndexBuffer.prototype.free = function()
{
    this.unbind();
    
    this.__ctx.getGL().deleteBuffer(this.__bufferID);
    this.__bufferID = this.__bufferData = null;
}
