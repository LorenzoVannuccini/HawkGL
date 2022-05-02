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

let glFramebufferAttachment = function(ctx, framebuffer, renderTexture)
{
    this.__ctx = ctx;

    this.__framebufferObject = framebuffer;
    this.__framebuffer = this.__framebufferObject.__framebuffer;
    
    this.__renderTexture = renderTexture;
    this.__shouldUpdateMipmap = true;
}

glFramebufferAttachment.prototype.free = function()
{
    this.__renderTexture.free();
    this.__renderTexture = null;
}

glFramebufferAttachment.prototype.getWidth = function() {
    return this.__framebufferObject.getWidth();
}

glFramebufferAttachment.prototype.getHeight = function() {
    return this.__framebufferObject.getHeight();
}

glFramebufferAttachment.prototype.bind = function(slotID)
{
    this.__renderTexture.bind(slotID);
    
    if(this.__shouldUpdateMipmap && (this.__renderTexture.getFilterMode().min == this.__ctx.getGL().LINEAR_MIPMAP_LINEAR)) this.generateMipmap(false);
}

glFramebufferAttachment.prototype.unbind = function() {
    this.__renderTexture.unbind();
}

glFramebufferAttachment.prototype.__blit = function(x0, y0, x1, y1, mask, attachment, filter) 
{
    let gl = this.__ctx.getGL();

    let dstAttachments = [gl.BACK];
    if(this.__ctx.__activeFramebuffer != null)
    {
        let dstAttachmentMatchesSource = false;
        dstAttachments = this.__ctx.getActiveDrawBuffers();
        
        for(let i = 0, e = dstAttachments.length; (i != e && !dstAttachmentMatchesSource); ++i) {
            dstAttachmentMatchesSource = (dstAttachments[i] == attachment);
        }

        if(dstAttachmentMatchesSource) for(let i = 0, e = dstAttachments.length; i != e; ++i) {
            if(dstAttachments[i] != attachment) dstAttachments[i] = gl.NONE;       
        }
    }

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.__framebuffer);
    gl.drawBuffers(dstAttachments);
    gl.readBuffer(attachment);
            
    gl.blitFramebuffer(0, 0, this.getWidth(), this.getHeight(), x0, y0, x1, y1, mask, filter);

    if(attachment != gl.NONE) gl.readBuffer(gl.NONE);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.__ctx.__activeFramebuffer);
    gl.drawBuffers(((this.__ctx.__activeFramebuffer != null) ? this.__ctx.getActiveDrawBuffers() : [gl.BACK]));
}

glFramebufferAttachment.prototype.getRenderTextureID = function() {
    return this.__renderTexture.getTextureID();
}

glFramebufferAttachment.prototype.setFilterMode = function(minFilter, magFilter) {
    this.__renderTexture.setFilterMode(minFilter, magFilter);
}

glFramebufferAttachment.prototype.getFilterMode = function() {
    return this.__renderTexture.getFilterMode();
}

glFramebufferAttachment.prototype.setWrapMode = function(wrapMode) {
    this.__renderTexture.setWrapMode(wrapMode);
}

glFramebufferAttachment.prototype.getWrapMode = function() {
    return this.__renderTexture.getWrapMode();
}

glFramebufferAttachment.prototype.setCompareMode = function(mode) {
    this.__renderTexture.setCompareMode(mode);
}

glFramebufferAttachment.prototype.getCompareMode = function() {
    return this.__renderTexture.getCompareMode();
}

glFramebufferAttachment.prototype.generateMipmap = function(enableAnisotropicFiltering)
{
    this.__renderTexture.generateMipmap(enableAnisotropicFiltering);
    this.__shouldUpdateMipmap = false;
}

glFramebufferAttachment.prototype.getFramebuffer = function() {
    return this.__framebufferObject;
}

// -------------------------------------------------------------------------------------------

let glFramebufferDepthAttachment = function(ctx, framebuffer, attachment) {
    glFramebufferAttachment.call(this, ctx, framebuffer, attachment);
}

glFramebufferDepthAttachment.prototype = Object.create(glFramebufferAttachment.prototype);

glFramebufferDepthAttachment.prototype.bindAsShadowMap = function(unitID) {
    this.__renderTexture.bindAsShadowMap(unitID);
}

glFramebufferDepthAttachment.prototype.blit = function()
{
    if(this.__ctx.getActiveFramebuffer() != null)
    {
        let gl = this.__ctx.getGL();
        
        let viewport = this.__ctx.getViewport();      
        this.__blit(viewport.x, viewport.y, viewport.w, viewport.h, gl.DEPTH_BUFFER_BIT, gl.NONE, gl.NEAREST);   
         
    } else this.__renderTexture.blit();
}

// -------------------------------------------------------------------------------------------

let glFramebufferDepthAttachment16 = function(ctx, framebuffer, w, h) {
    glFramebufferDepthAttachment.call(this, ctx, framebuffer, new glDepthTexture16(ctx, w, h));
}

glFramebufferDepthAttachment16.prototype = Object.create(glFramebufferDepthAttachment.prototype);

// -------------------------------------------------------------------------------------------

let glFramebufferDepthAttachment24 = function(ctx, framebuffer, w, h) {
    glFramebufferDepthAttachment.call(this, ctx, framebuffer, new glDepthTexture24(ctx, w, h));
}

glFramebufferDepthAttachment24.prototype = Object.create(glFramebufferDepthAttachment.prototype);

// -------------------------------------------------------------------------------------------

let glFramebufferDepthAttachment32F = function(ctx, framebuffer, w, h) {
    glFramebufferDepthAttachment.call(this, ctx, framebuffer, new glDepthTexture32F(ctx, w, h));
}

glFramebufferDepthAttachment32F.prototype = Object.create(glFramebufferDepthAttachment.prototype);

// -------------------------------------------------------------------------------------------

let glFramebufferColorAttachment = function(ctx, framebuffer, attachmentID, attachment)
{
    glFramebufferAttachment.call(this, ctx, framebuffer, attachment);
    this.__attachmentID  = attachmentID;
}

glFramebufferColorAttachment.prototype = Object.create(glFramebufferAttachment.prototype);

glFramebufferColorAttachment.prototype.blit = function(filter) 
{
    let gl = this.__ctx.getGL();

    let viewport = this.__ctx.getViewport();
    if(filter == null) filter = ((this.getWidth() == viewport.w && this.getHeight() == viewport.h) ? gl.NEAREST : gl.LINEAR); 
         
    this.__blit(viewport.x, viewport.y, viewport.w, viewport.h, gl.COLOR_BUFFER_BIT, (gl.COLOR_ATTACHMENT0 + this.getAttachmentID()), filter);    
}

glFramebufferColorAttachment.prototype.getAttachmentID = function() {
    return this.__attachmentID;
}

glFramebufferColorAttachment.prototype.toImage = function(width, height, onLoad) {
    return this.__renderTexture.toImage(width, height, onLoad);
}

glFramebufferColorAttachment.prototype.toBase64 = function(width, height) {
    return this.__renderTexture.toBase64(width, height);
}

// -------------------------------------------------------------------------------------------

let glFramebufferColorAttachmentRGBA8 = function(ctx, framebuffer, attachmentID, w, h, renderTexture) {
    glFramebufferColorAttachment.call(this, ctx, framebuffer, attachmentID, ((renderTexture != null) ? renderTexture : new glTextureRGBA8(ctx, w, h)));
}

glFramebufferColorAttachmentRGBA8.prototype = Object.create(glFramebufferColorAttachment.prototype);

// -------------------------------------------------------------------------------------------

let glFramebufferColorAttachmentRGBA16F = function(ctx, framebuffer, attachmentID, w, h, renderTexture) {
    glFramebufferColorAttachment.call(this, ctx, framebuffer, attachmentID, ((renderTexture != null) ? renderTexture : new glTextureRGBA16F(ctx, w, h)));
}

glFramebufferColorAttachmentRGBA16F.prototype = Object.create(glFramebufferColorAttachment.prototype);

glFramebufferColorAttachmentRGBA16F.prototype.toFloat16Array = function(width, height) {
    return this.__renderTexture.toFloat16Array(width, height);
}

// -------------------------------------------------------------------------------------------

let glFramebufferColorAttachmentRGBA32F = function(ctx, framebuffer, attachmentID, w, h, renderTexture) {
    glFramebufferColorAttachment.call(this, ctx, framebuffer, attachmentID, ((renderTexture != null) ? renderTexture : new glTextureRGBA32F(ctx, w, h)));
}

glFramebufferColorAttachmentRGBA32F.prototype = Object.create(glFramebufferColorAttachment.prototype);

glFramebufferColorAttachmentRGBA32F.prototype.toFloat32Array = function(width, height) {
    return this.__renderTexture.toFloat32Array(width, height);
}

// -------------------------------------------------------------------------------------------

let glFramebuffer = function(ctx, width, height)
{
    this.__ctx = ctx;

    this.__width  = width;
    this.__height = height;

    this.__colorAttachments = [];
    this.__depthAttachment = null;

    this.__framebuffer = this.__ctx.getGL().createFramebuffer();
}

glFramebuffer.prototype.free = function()
{
    if(this.__framebuffer != null)
    {
        this.__ctx.getGL().deleteFramebuffer(this.__framebuffer);
        this.__framebuffer = null;

        for(let i = 0, e = this.__colorAttachments.length; i != e; ++i) this.__colorAttachments[i].free();
        this.__colorAttachments.length = 0;
        
        if(this.__depthAttachment != null) this.__depthAttachment.free();
        this.__depthAttachment = null;
    }
}

glFramebuffer.prototype.getWidth = function() {
    return this.__width;
}

glFramebuffer.prototype.getHeight = function() {
    return this.__height;
}

glFramebuffer.prototype.getFramebufferID = function() {
    return this.__framebuffer;
}

glFramebuffer.prototype.bind = function(attachments)
{
    let gl = this.__ctx.getGL();

    this.__ctx.bindFramebuffer(this.__framebuffer);
    this.__ctx.setViewport(0, 0, this.__width, this.__height);

    let mask = new Array(Math.max(this.__colorAttachments.length, 1)).fill(gl.NONE);
        
    if(attachments != null) 
    {
        if(!(attachments instanceof Array)) attachments = [attachments];
        for(let i = 0, e = attachments.length; i != e; ++i)
        {
            let attachment = attachments[i];

            attachment.__shouldUpdateMipmap = true;
            let attachmentID = attachment.getAttachmentID();
            
            mask[attachmentID] = (gl.COLOR_ATTACHMENT0 + attachmentID);
        }   
    }

    this.__ctx.drawBuffers(mask);
}

glFramebuffer.prototype.invalidate = function(attachments)
{
    let gl = this.__ctx.getGL();

    let activeFramebuffer = this.__ctx.getActiveFramebuffer();
    this.__ctx.bindFramebuffer(this.__framebuffer);
    
    if(attachments == null)
    {
        attachments = this.__colorAttachments.slice(0);
        if(this.__depthAttachment != null) attachments.push(this.__depthAttachment);
    
    } else if(!(attachments instanceof Array)) attachments = [attachments];

    let nAttachments = attachments.length;
    let attachmentsIDs = new Array(nAttachments);
    
    for(let i = 0; i != nAttachments; ++i)
    {
        let attachment = attachments[i];
        attachmentsIDs[i] = ((attachment != this.__depthAttachment) ? (gl.COLOR_ATTACHMENT0 + attachment.getAttachmentID()) : gl.DEPTH_ATTACHMENT);
    }

    gl.invalidateFramebuffer(gl.FRAMEBUFFER, attachmentsIDs);
    this.__ctx.bindFramebuffer(activeFramebuffer);
}

glFramebuffer.prototype.unbind = function() {
    this.__ctx.unbindFramebuffer();
}

glFramebuffer.prototype.__createColorAttachment = function(attachmentConstructor, renderTexture, mipID)
{
    let attachmentID = this.__colorAttachments.length;

    let nMaxColorAttachments = 16;  // TODO: query from GL
    if(attachmentID >= nMaxColorAttachments) return null; // TODO: handle exception

    let attachment = new attachmentConstructor(this.__ctx, this, attachmentID, this.__width, this.__height, renderTexture);
    
    let lastActiveFramebuffer = this.__ctx.getActiveFramebuffer();
    this.bind();
    
    let gl = this.__ctx.getGL();
    this.__colorAttachments.push(attachment);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + attachmentID, gl.TEXTURE_2D, attachment.getRenderTextureID(), ((mipID != null) ? mipID : 0));
    this.__ctx.bindFramebuffer(lastActiveFramebuffer);
    
    return attachment;
}

glFramebuffer.prototype.createColorAttachmentRGBA8 = function(renderTexture, mipID) {
    return this.__createColorAttachment(glFramebufferColorAttachmentRGBA8, renderTexture, mipID);
}

glFramebuffer.prototype.createColorAttachmentRGBA16F = function(renderTexture, mipID) {
    return this.__createColorAttachment(glFramebufferColorAttachmentRGBA16F, renderTexture, mipID);
}

glFramebuffer.prototype.createColorAttachmentRGBA32F = function(renderTexture, mipID) {
    return this.__createColorAttachment(glFramebufferColorAttachmentRGBA32F, renderTexture, mipID);
}

glFramebuffer.prototype.__createDepthAttachment = function(attachmentConstructor, renderTexture, mipID)
{
    let attachment = new attachmentConstructor(this.__ctx, this, this.__width, this.__height, renderTexture);
    
    let lastActiveFramebuffer = this.__ctx.getActiveFramebuffer();
    this.bind();
        
    let gl = this.__ctx.getGL();
    this.__depthAttachment = attachment;

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, attachment.getRenderTextureID(), ((mipID != null) ? mipID : 0));
    this.__ctx.bindFramebuffer(lastActiveFramebuffer);
   
    return attachment;    
}

glFramebuffer.prototype.createDepthAttachment16 = function(renderTexture, mipID) {
    return this.__createDepthAttachment(glFramebufferDepthAttachment16, renderTexture, mipID);  
}

glFramebuffer.prototype.createDepthAttachment24 = function(renderTexture, mipID) {
    return this.__createDepthAttachment(glFramebufferDepthAttachment24, renderTexture, mipID);  
}

glFramebuffer.prototype.createDepthAttachment32F = function(renderTexture, mipID) {
    return this.__createDepthAttachment(glFramebufferDepthAttachment32F, renderTexture, mipID);  
}

// ----------------------------------------------------------------------------------------------------------------------------------------------------

let glRenderbufferAttachment = function(ctx, framebuffer, w, h, samples, internalFormat)
{
    this.__ctx = ctx;

    this.__w = w;
    this.__h = h;
    
    this.__framebufferObject = framebuffer;
    this.__framebuffer = this.__framebufferObject.__framebuffer;
    
    let gl = ctx.getGL();
    this.__renderbuffer = gl.createRenderbuffer();
    
    ctx.bindRenderbuffer(this.__renderbuffer);

    if(samples <= 1) gl.renderbufferStorage(gl.RENDERBUFFER, internalFormat, w, h);
    else gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, internalFormat, w, h);
}

glRenderbufferAttachment.prototype.free = function()
{
    this.__ctx.getGL().deleteRenderbuffer(this.__renderbuffer);
    this.__renderbuffer = null;
}

glRenderbufferAttachment.prototype.getWidth = function() {
    return this.__w;
}

glRenderbufferAttachment.prototype.getHeight = function() {
    return this.__h;
}

glRenderbufferAttachment.prototype.getRenderbuffer = function() {
    return this.__framebufferObject;
}

glRenderbufferAttachment.prototype.__blit = function(x0, y0, x1, y1, mask, attachment, filter) 
{
    let gl = this.__ctx.getGL();

    let dstAttachments = [gl.BACK];
    if(this.__ctx.__activeFramebuffer != null)
    {
        let dstAttachmentMatchesSource = false;
        dstAttachments = this.__ctx.getActiveDrawBuffers();
        
        for(let i = 0, e = dstAttachments.length; (i != e && !dstAttachmentMatchesSource); ++i) {
            dstAttachmentMatchesSource = (dstAttachments[i] == attachment);
        }

        if(dstAttachmentMatchesSource) for(let i = 0, e = dstAttachments.length; i != e; ++i) {
            if(dstAttachments[i] != attachment) dstAttachments[i] = gl.NONE;       
        }
    }

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.__framebuffer);
    gl.drawBuffers(dstAttachments);
    gl.readBuffer(attachment);
            
    gl.blitFramebuffer(0, 0, this.getWidth(), this.getHeight(), x0, y0, x1, y1, mask, filter);

    if(attachment != gl.NONE) gl.readBuffer(gl.NONE);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.__ctx.__activeFramebuffer);
    gl.drawBuffers(((this.__ctx.__activeFramebuffer != null) ? this.__ctx.getActiveDrawBuffers() : [gl.BACK]));
}

glRenderbufferAttachment.prototype.getRenderBufferID = function() {
    return this.__renderbuffer;
}

// -------------------------------------------------------------------------------------------

let glRenderbufferColorAttachment = function(ctx, framebuffer, attachmentID, w, h, samples, internalFormat)
{
    glRenderbufferAttachment.call(this, ctx, framebuffer, w, h, samples, internalFormat);
    this.__attachmentID  = attachmentID;
}

glRenderbufferColorAttachment.prototype = Object.create(glRenderbufferAttachment.prototype);

glRenderbufferColorAttachment.prototype.blit = function(filter) 
{
    let gl = this.__ctx.getGL();

    let viewport = this.__ctx.getViewport();
    if(filter == null) filter = ((this.getWidth() == viewport.w && this.getHeight() == viewport.h) ? gl.NEAREST : gl.LINEAR); 
         
    this.__blit(viewport.x, viewport.y, viewport.w, viewport.h, gl.COLOR_BUFFER_BIT, (gl.COLOR_ATTACHMENT0 + this.getAttachmentID()), filter);    
}

glRenderbufferColorAttachment.prototype.getAttachmentID = function() {
    return this.__attachmentID;
}

// -------------------------------------------------------------------------------------------------

let glRenderbufferColorAttachmentRGBA8 = function(ctx, framebuffer, attachmentID, w, h, samples) {
    glRenderbufferColorAttachment.call(this, ctx, framebuffer, attachmentID, w, h, samples, ctx.getGL().RGBA8);
}

glRenderbufferColorAttachmentRGBA8.prototype = Object.create(glRenderbufferColorAttachment.prototype);

// -------------------------------------------------------------------------------------------------

let glRenderbufferColorAttachmentRGBA16F = function(ctx, framebuffer, attachmentID, w, h, samples) {
    glRenderbufferColorAttachment.call(this, ctx, framebuffer, attachmentID, w, h, samples, ctx.getGL().RGBA16F);
}

glRenderbufferColorAttachmentRGBA16F.prototype = Object.create(glRenderbufferColorAttachment.prototype);

// -------------------------------------------------------------------------------------------------

let glRenderbufferColorAttachmentRGBA32F = function(ctx, framebuffer, attachmentID, w, h, samples) {
    glRenderbufferColorAttachment.call(this, ctx, framebuffer, attachmentID, w, h, samples, ctx.getGL().RGBA32F);
}

glRenderbufferColorAttachmentRGBA32F.prototype = Object.create(glRenderbufferColorAttachment.prototype);

// -------------------------------------------------------------------------------------------------

let glRenderbufferDepthAttachment = function(ctx, framebuffer, w, h, samples, internalFormat) {
    glRenderbufferAttachment.call(this, ctx, framebuffer, w, h, samples, internalFormat);
}

glRenderbufferDepthAttachment.prototype = Object.create(glRenderbufferAttachment.prototype);

glRenderbufferDepthAttachment.prototype.blit = function()
{
    let gl = this.__ctx.getGL();
    
    let viewport = ctx.getViewport();      
    this.__blit(viewport.x, viewport.y, viewport.w, viewport.h, gl.DEPTH_BUFFER_BIT, gl.NONE, gl.NEAREST);   
}

// -------------------------------------------------------------------------------------------

let glRenderbufferDepthAttachment16 = function(ctx, framebuffer, w, h, samples) {
    glRenderbufferDepthAttachment.call(this, ctx, framebuffer, w, h, samples, ctx.getGL().DEPTH_COMPONENT16);
}

glRenderbufferDepthAttachment16.prototype = Object.create(glRenderbufferDepthAttachment.prototype);

// -------------------------------------------------------------------------------------------

let glRenderbufferDepthAttachment24 = function(ctx, framebuffer, w, h, samples) {
    glRenderbufferDepthAttachment.call(this, ctx, framebuffer, w, h, samples, ctx.getGL().DEPTH_COMPONENT24);
}

glRenderbufferDepthAttachment24.prototype = Object.create(glRenderbufferDepthAttachment.prototype);

// -------------------------------------------------------------------------------------------

let glRenderbufferDepthAttachment32F = function(ctx, framebuffer, w, h, samples) {
    glRenderbufferDepthAttachment.call(this, ctx, framebuffer, w, h, samples, ctx.getGL().DEPTH_COMPONENT32F);
}

glRenderbufferDepthAttachment32F.prototype = Object.create(glRenderbufferDepthAttachment.prototype);

// -------------------------------------------------------------------------------------------

let glRenderbuffer = function(ctx, width, height, nSamplesMSAA)
{
    glFramebuffer.call(this, ctx, width, height);
    this.__nSamples = ((nSamplesMSAA != null) ? nSamplesMSAA : ctx.getMaxSamplesMSAA()); //ctx.getGL().getParameter(ctx.getGL().MAX_SAMPLES);
}

glRenderbuffer.prototype = Object.create(glFramebuffer.prototype);

glRenderbuffer.prototype.__createColorAttachment = function(attachmentConstructor)
{
    let attachmentID = this.__colorAttachments.length;

    let nMaxColorAttachments = 16;  // TODO: query from GL
    if(attachmentID >= nMaxColorAttachments) return null; // TODO: handle exception

    let attachment = new attachmentConstructor(this.__ctx, this, attachmentID, this.__width, this.__height, this.__nSamples);

    let lastActiveRenderbuffer = this.__ctx.getActiveRenderbuffer();
    this.bind();
    
    let gl = this.__ctx.getGL();
    this.__colorAttachments.push(attachment);

    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + attachmentID, gl.RENDERBUFFER, attachment.getRenderBufferID());
    this.__ctx.bindRenderbuffer(lastActiveRenderbuffer);
   
    return attachment;
}

glRenderbuffer.prototype.createColorAttachmentRGBA8 = function() {
    return this.__createColorAttachment(glRenderbufferColorAttachmentRGBA8);
}

glRenderbuffer.prototype.createColorAttachmentRGBA16F = function() {
    return this.__createColorAttachment(glRenderbufferColorAttachmentRGBA16F);
}

glRenderbuffer.prototype.createColorAttachmentRGBA32F = function() {
    return this.__createColorAttachment(glRenderbufferColorAttachmentRGBA32F);
}

glRenderbuffer.prototype.__createDepthAttachment = function(attachmentConstructor)
{
    let attachment = new attachmentConstructor(this.__ctx, this, this.__width, this.__height, this.__nSamples);

    let lastActiveRenderbuffer = this.__ctx.getActiveRenderbuffer();
    this.bind();
        
    let gl = this.__ctx.getGL();
    this.__depthAttachment = attachment;

    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, attachment.getRenderBufferID());
    this.__ctx.bindRenderbuffer(lastActiveRenderbuffer);
    
    return attachment;    
}

glRenderbuffer.prototype.createDepthAttachment16 = function() {
    return this.__createDepthAttachment(glRenderbufferDepthAttachment16);  
}

glRenderbuffer.prototype.createDepthAttachment24 = function() {
    return this.__createDepthAttachment(glRenderbufferDepthAttachment24);  
}

glRenderbuffer.prototype.createDepthAttachment32F = function() {
    return this.__createDepthAttachment(glRenderbufferDepthAttachment32F);  
}
