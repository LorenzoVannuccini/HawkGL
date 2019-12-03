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

let glTexture = function(ctx, w, h, data)
{
    this.__ctx = ctx;
    let gl = this.__ctx.getGL();
    
    this.__unitID = 0;
    this.__ready = true;
    this.__textureID = this.__ctx.getGL().createTexture();

    this.__compareMode = gl.NONE;

    this.set(w, h, data);
}

glTexture.prototype.free = function()
{
    if(this.__textureID != null)
    {
        this.unbind();
        this.__ctx.getGL().deleteTexture(this.__textureID);
        
        this.__textureID = this.__filterModeMin = this.__filterModeMag = null;
        this.__width = this.__height = 0;
    }
}

glTexture.prototype.set = null; // abstract

glTexture.prototype.ready = function() {
    return this.__ready;
}

glTexture.prototype.__set = function(target, internalformat, w, h, format, type, data)
{
    let lastTextureBound = this.__ctx.getActiveTexture(this.__unitID);
    
    this.bind(this.__unitID);
    this.__ctx.getGL().texImage2D((this.__target = target), 0, internalformat, (this.__width = w), (this.__height = h), 0, format, type, data);

    this.__ctx.bindTexture(this.__unitID, lastTextureBound);
}

glTexture.prototype.resize = function(w, h)
{
    let self = this;
    
    if(this.getWidth() != w || this.getHeight() != h) this.toImage(w, h, function(image) {
       self.set(image.width, image.height, image); 
    });
}

glTexture.prototype.setFilterMode = function(minFilter, magFilter)
{
    if(this.__filterModeMin != minFilter || this.__filterModeMag != magFilter)
    {
        let lastTextureBound = this.__ctx.getActiveTexture(this.__unitID);

        this.bind(this.__unitID);
        let gl = this.__ctx.getGL();

        let hadMipmaps = (this.__filterModeMin == gl.LINEAR_MIPMAP_LINEAR);
        let hadAnisoFiltering = (hadMipmaps && this.__ctx.getTextureMaxAnisotropy() > 1);
        let shouldDisableAnisoFiltering = (hadAnisoFiltering && (minFilter != gl.LINEAR_MIPMAP_LINEAR));
        if(shouldDisableAnisoFiltering) gl.texParameterf(this.__target, this.__ctx.__extensions.anisotropicFilter.TEXTURE_MAX_ANISOTROPY_EXT, 1);

        gl.texParameteri(this.__target, gl.TEXTURE_MIN_FILTER, (this.__filterModeMin = minFilter));
        gl.texParameteri(this.__target, gl.TEXTURE_MAG_FILTER, (this.__filterModeMag = magFilter));

        this.__ctx.bindTexture(this.__unitID, lastTextureBound);
    }
}

glTexture.prototype.getFilterMode = function()
{
    let filterMode =
    {
        min: this.__filterModeMin,
        mag: this.__filterModeMag
    };

    return filterMode;
}

glTexture.prototype.setWrapMode = function(wrapMode)
{
    if(this.__wrapMode != wrapMode)
    {
        let lastTextureBound = this.__ctx.getActiveTexture(this.__unitID);
    
        this.bind(this.__unitID);
        let gl = this.__ctx.getGL();

        this.__wrapMode = wrapMode;

        gl.texParameteri(this.__target, gl.TEXTURE_WRAP_S, wrapMode);
        gl.texParameteri(this.__target, gl.TEXTURE_WRAP_T, wrapMode);
        
        this.__ctx.bindTexture(this.__unitID, lastTextureBound);
    }
}

glTexture.prototype.getWrapMode = function() {
    return this.__wrapMode;
}

glTexture.prototype.setCompareMode = function(mode)
{
    if(this.__compareMode != mode)
    {
        let lastTextureBound = this.__ctx.getActiveTexture(this.__unitID);
        
        this.bind(this.__unitID);
        let gl = this.__ctx.getGL();
        
        gl.texParameteri(this.__target, gl.TEXTURE_COMPARE_MODE, (this.__compareMode = mode));
        
        this.__ctx.bindTexture(this.__unitID, lastTextureBound);
    }
}

glTexture.prototype.getCompareMode = function() {
    return this.__compareMode;
}

glTexture.prototype.generateMipmap = function(enableAnisotropicFiltering)
{
    let lastTextureBound = this.__ctx.getActiveTexture(this.__unitID);
    
    this.bind(this.__unitID);
    let gl = this.__ctx.getGL();
    
    if(enableAnisotropicFiltering && this.__ctx.getTextureMaxAnisotropy() > 1.0) {
        gl.texParameterf(this.__target, this.__ctx.__extensions.anisotropicFilter.TEXTURE_MAX_ANISOTROPY_EXT, this.__ctx.getTextureMaxAnisotropy());
    }

    this.setFilterMode(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
    gl.generateMipmap(this.__target);
    
    this.__ctx.bindTexture(this.__unitID, lastTextureBound);
}

glTexture.prototype.getWidth = function() {
    return this.__width;
}

glTexture.prototype.getHeight = function() {
    return this.__height;
}

glTexture.prototype.bind = function(unitID)
{
    this.__unitID = ((unitID != null) ? unitID : 0);
    this.__ctx.bindTexture(this.__unitID, this.__textureID);
}

glTexture.prototype.unbind = function() {
    this.__ctx.unbindTexture(this.__unitID, this.__textureID);
}

glTexture.prototype.__blit = function(filter)
{
    let gl = this.__ctx.getGL();

    if(filter == null) 
    {
        let viewport = this.__ctx.getViewport();
        filter = ((this.getWidth() == viewport.w && this.getHeight() == viewport.h) ? gl.NEAREST : gl.LINEAR); 
    }
    
    let lastCompareMode   = this.__compareMode;
    let lastFilterModeMin = this.__filterModeMin;
    let lastFilterModeMag = this.__filterModeMag;
    let lastTextureBound  = this.__ctx.getActiveTexture(this.__unitID);
    
    this.bind(this.__unitID);
    
    this.setCompareMode(gl.NONE);
    this.setFilterMode(filter, filter);
    
    this.__ctx.blitActiveTexture(this.__unitID);

    this.setFilterMode(lastFilterModeMin, lastFilterModeMag);
    this.setCompareMode(lastCompareMode);
    
    this.__ctx.bindTexture(this.__unitID, lastTextureBound);
}

glTexture.prototype.blit = function(filter) {
    this.__blit(filter);
}

glTexture.prototype.getTextureID = function() {
    return this.__textureID;
}

glTexture.prototype.toImage = function(width, height, onLoad) {
    return this.__ctx.textureToImage(this, width, height, onLoad);
}

glTexture.prototype.toBase64 = function(width, height) {
    return this.__ctx.textureToBase64(this, width, height);
}

// -------------------------------------------------------------------------------------------

let glTextureRGBA8 = function(ctx, w, h, data) {
    glTexture.call(this, ctx, w, h, data);
}

glTextureRGBA8.prototype = Object.create(glTexture.prototype);

glTextureRGBA8.prototype.set = function(w, h, data)
{
    let gl = this.__ctx.getGL();

    this.__set(gl.TEXTURE_2D, gl.RGBA8, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);

    this.setFilterMode(gl.LINEAR, gl.LINEAR);
    this.setWrapMode(gl.CLAMP_TO_EDGE);
}

// -------------------------------------------------------------------------------------------

let glTextureRGBA16F = function(ctx, w, h, data) {
    glTexture.call(this, ctx, w, h, data);
}

glTextureRGBA16F.prototype = Object.create(glTexture.prototype);

glTextureRGBA16F.prototype.set = function(w, h, data)
{
    let gl = this.__ctx.getGL();

    this.__set(gl.TEXTURE_2D, gl.RGBA16F, w, h, gl.RGBA, gl.FLOAT, data);

    this.setFilterMode(gl.LINEAR, gl.LINEAR);
    this.setWrapMode(gl.CLAMP_TO_EDGE);
}

// -------------------------------------------------------------------------------------------

let glTextureRGBA32F = function(ctx, w, h, data) {
    glTexture.call(this, ctx, w, h, data);
}

glTextureRGBA32F.prototype = Object.create(glTexture.prototype);

glTextureRGBA32F.prototype.set = function(w, h, data)
{
    let gl = this.__ctx.getGL();

    this.__set(gl.TEXTURE_2D, gl.RGBA32F, w, h, gl.RGBA, gl.FLOAT, data);

    this.setFilterMode(gl.LINEAR, gl.LINEAR);
    this.setWrapMode(gl.CLAMP_TO_EDGE);
}

// -------------------------------------------------------------------------------------------

let glDepthTexture = function(ctx, w, h, data) {
    glTexture.call(this, ctx, w, h, data);
}

glDepthTexture.prototype = Object.create(glTexture.prototype);

glDepthTexture.prototype.set = null; // abstract

glDepthTexture.prototype.bindAsShadowMap = function(unitID)
{
    this.bind(unitID);
    
    let gl = this.__ctx.getGL();

    this.setCompareMode(gl.COMPARE_REF_TO_TEXTURE);
    this.setFilterMode(gl.LINEAR, gl.LINEAR);
}

glDepthTexture.prototype.blit = function() {
    this.__blit(this.__ctx.getGL().NEAREST);
}

// -------------------------------------------------------------------------------------------

let glDepthTexture16 = function(ctx, w, h, data) {
    glDepthTexture.call(this, ctx, w, h, data);
}

glDepthTexture16.prototype = Object.create(glDepthTexture.prototype);

glDepthTexture16.prototype.set = function(w, h, data)
{
    let gl = this.__ctx.getGL();

    this.__set(gl.TEXTURE_2D, gl.DEPTH_COMPONENT16, w, h, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, data);

    this.setFilterMode(gl.NEAREST, gl.NEAREST);
    this.setWrapMode(gl.CLAMP_TO_EDGE);
}

// -------------------------------------------------------------------------------------------

let glDepthTexture24 = function(ctx, w, h, data) {
    glDepthTexture.call(this, ctx, w, h, data);
}

glDepthTexture24.prototype = Object.create(glDepthTexture.prototype);

glDepthTexture24.prototype.set = function(w, h, data)
{
    let gl = this.__ctx.getGL();

    this.__set(gl.TEXTURE_2D, gl.DEPTH_COMPONENT24, w, h, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, data);

    this.setFilterMode(gl.NEAREST, gl.NEAREST);
    this.setWrapMode(gl.CLAMP_TO_EDGE);
}

// -------------------------------------------------------------------------------------------

let glDepthTexture32F = function(ctx, w, h, data) {
    glDepthTexture.call(this, ctx, w, h, data);
}

glDepthTexture32F.prototype = Object.create(glDepthTexture.prototype);

glDepthTexture32F.prototype.set = function(w, h, data)
{
    let gl = this.__ctx.getGL();

    this.__set(gl.TEXTURE_2D, gl.DEPTH_COMPONENT32F, w, h, gl.DEPTH_COMPONENT, gl.FLOAT, data);

    this.setFilterMode(gl.NEAREST, gl.NEAREST);
    this.setWrapMode(gl.CLAMP_TO_EDGE);
}

