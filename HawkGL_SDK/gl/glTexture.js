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

glTexture.prototype.toUint8Array = function(width, height)
{
    let gl = ctx.getGL();

    if(width  == null) width  = this.getWidth();
    if(height == null) height = this.getHeight();

    let activeFramebuffer = ctx.getActiveFramebuffer();

    let framebuffer = new glFramebuffer(ctx, width, height);
    let colorbuffer = framebuffer.createColorAttachmentRGBA8();
    
    framebuffer.bind([colorbuffer]);
    this.blit();

    let data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);

    framebuffer.unbind();
    framebuffer.free();
    
    ctx.bindFramebuffer(activeFramebuffer);

    return data;
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

// -------------------------------------------------------------------------------------------

let glTextureData = function(ctx, localSize, capacity)
{
    this.__ctx = ctx;
    
    this.__descriptor =
    {
        size: 0,
        capacity: 0,
        localSize: 0,
        workGroupSize: 0,
        workGroupSizeSquared: 0
    };

    this.__invalidated = true;
        
    if(localSize == null) localSize = 1;
    if(capacity  == null) capacity  = 1;
    
    this.reserve(localSize, capacity);
}

glTextureData.prototype.__createAttachment = null; // abstract

glTextureData.prototype.__resize = function(w, h) // NB: does not free last framebuffer
{
    let gl = this.__ctx.getGL();
    
    this.__framebuffer = new glFramebuffer(ctx, w, h);
    
    this.__framebufferAttachment = this.__createAttachment();
    this.__framebufferAttachment.setFilterMode(gl.NEAREST, gl.NEAREST);

    this.__framebufferAttachment.__renderTexture.getTextureID().__dataTexture = this;
}

glTextureData.__genCopyProgram = function(ctx, localSize)
{
    if(glTextureData.__copyProgramInstances == null) glTextureData.__copyProgramInstances = new Map();

    let contextProgramInstances = glTextureData.__copyProgramInstances.get(ctx);
    if(contextProgramInstances == null) glTextureData.__copyProgramInstances.set(ctx, (contextProgramInstances = new Map()));

    let program = contextProgramInstances.get(localSize);
    if(program == null) 
    {
        program = new glComputeProgram(ctx, "#version 300 es                                                         \n" +
                                            "                                                                        \n" +
                                            "precision highp int;                                                    \n" +
                                            "precision highp float;                                                  \n" +
                                            "                                                                        \n" +
                                            "uniform samplerData lastStateData;                                      \n" +
                                            "                                                                        \n" +
                                            "local_size(" + localSize + ")                                           \n" +
                                            "                                                                        \n" +
                                            "void main()                                                             \n" +
                                            "{                                                                       \n" +
                                            "   for(int i = 0; i < glInvocationSize; ++i) {                          \n" +    
                                            "       glData[i] = textureData(lastStateData, glGlobalInvocationID, i); \n" +
                                            "   }                                                                    \n" +
                                            "}                                                                       \n");
                    
        program.compile();
        program.createUniformSamplerData("lastStateData", 0);                    
        
        contextProgramInstances.set(localSize, program);
    }

    return program;
}

glTextureData.__genMeshToTextureProgram = function(ctx)
{
    if(glTextureData.__meshToTextureInstances == null) glTextureData.__meshToTextureInstances = new Map();

    let program = glTextureData.__meshToTextureInstances.get(ctx);
    if(program == null) 
    {
        program = new glProgram(ctx, "#version 300 es                                                                                              \n" +
                                     "precision highp float;                                                                                       \n" +
                                     "                                                                                                             \n" +
                                     "uniform int accessorID;                                                                                      \n" +
                                     "uniform float squaredSize;                                                                                   \n" +
                                     "                                                                                                             \n" +
                                     "flat out vec4 accessorData;                                                                                  \n" +
                                     "                                                                                                             \n" +
                                     "void main()                                                                                                  \n" +
                                     "{                                                                                                            \n" +
                                     "    const int nAccessors = 3;                                                                                \n" +
                                     "    int invocationID = gl_VertexID * nAccessors + accessorID;                                                \n" +
                                     "                                                                                                             \n" +
                                     "    switch(accessorID)                                                                                       \n" +
                                     "    {                                                                                                        \n" +
                                     "        case 0: accessorData = vec4(glVertex,  glTexCoord.x); break;                                         \n" +
                                     "        case 1: accessorData = vec4(glNormal,  glTexCoord.y); break;                                         \n" +
                                     "        case 2: accessorData = vec4(_glTangent);              break;                                         \n" +
                                     "    }                                                                                                        \n" +
                                     "                                                                                                             \n" +
                                     "    gl_Position = vec4(invocationID % int(squaredSize), floor(float(invocationID) / squaredSize), 0.0, 1.0); \n" +
                                     "    gl_Position.xy = vec2(-1.0) + 2.0 * ((gl_Position.xy + vec2(0.5)) / squaredSize);                        \n" +
                                     "    gl_PointSize = 1.0;                                                                                      \n" +
                                     "}                                                                                                            \n",
                                     
                                     "#version 300 es                           \n" +
                                     "precision highp float;                    \n" +
                                     "                                          \n" +                                                                                                                            
                                     "flat in vec4 accessorData;                \n" +
                                     "layout(location = 0) out highp vec4 data; \n" +
                                     "                                          \n" +
                                     "void main() {                             \n" +
                                     "    data = accessorData;                  \n" +                                                                                    
                                     "}                                         \n");

        if(!program.compile()) console.error(program.getLastError());
        program.createUniformFloat("squaredSize");
        program.createUniformInt("accessorID");
        
        glTextureData.__meshToTextureInstances.set(ctx, program);
    }

    return program;
}

glTextureData.__genMeshToTextureDataProgram = function(ctx)
{
    if(glTextureData.__meshToTextureDataInstances == null) glTextureData.__meshToTextureDataInstances = new Map();

    let program = glTextureData.__meshToTextureDataInstances.get(ctx);
    if(program == null) 
    {
        program = new glComputeProgram(ctx, "#version 300 es                                                                                            \n" +
                                            "                                                                                                           \n" +
                                            "precision highp int;                                                                                       \n" +
                                            "precision highp float;                                                                                     \n" +
                                            "                                                                                                           \n" +
                                            "uniform sampler2D geoTexture;                                                                              \n" +
                                            "                                                                                                           \n" +
                                            "local_size(3)                                                                                              \n" +
                                            "                                                                                                           \n" +
                                            "void main()                                                                                                \n" +
                                            "{                                                                                                          \n" +
                                            "   const int nAccessors = 3;                                                                               \n" +
                                            "                                                                                                           \n" +
                                            "   ivec2 tSize = textureSize(geoTexture, 0);                                                               \n" +
                                            "   int invocationID = (glGlobalInvocationID * nAccessors);                                                 \n" +
                                            "                                                                                                           \n" +
                                            "   ivec2 accessor0 = ivec2((invocationID + 0) % tSize.x, floor(float(invocationID + 0) / float(tSize.x))); \n" +
                                            "   ivec2 accessor1 = ivec2((invocationID + 1) % tSize.x, floor(float(invocationID + 1) / float(tSize.x))); \n" +
                                            "   ivec2 accessor2 = ivec2((invocationID + 2) % tSize.x, floor(float(invocationID + 2) / float(tSize.x))); \n" +
                                            "                                                                                                           \n" +
                                            "   glData[0] = texelFetch(geoTexture, accessor0, 0);                                                       \n" +                      
                                            "   glData[1] = texelFetch(geoTexture, accessor1, 0);                                                       \n" +
                                            "   glData[2] = texelFetch(geoTexture, accessor2, 0);                                                       \n" +
                                            "}                                                                                                          \n");
                    
        if(!program.compile()) console.error(program.getLastError());
        program.createUniformSamplerData("geoTexture", 0);                    
        
        glTextureData.__meshToTextureDataInstances.set(ctx, program);
    }

    return program;
}

glTextureData.prototype.reserve = function(localSize, requestCapacity, nInvocationsPerWorkGroup)
{
    let lastStateFramebuffer           = this.__framebuffer;
    let lastStateFrameBufferAttachment = this.__framebufferAttachment;
    let lastStateCapacity              = this.__descriptor.capacity;
    
    if(nInvocationsPerWorkGroup == null) nInvocationsPerWorkGroup = this.__descriptor.workGroupSize;
    
    let didResize = (localSize != this.__descriptor.localSize || requestCapacity > this.__descriptor.capacity);
    if(didResize)
    {
        let capacitySquared = Math.max(nextPot(Math.ceil(Math.sqrt(requestCapacity * localSize))), 1);
        this.__descriptor.capacity = Math.floor((capacitySquared * capacitySquared) / localSize);
        
        this.__resize(capacitySquared, capacitySquared);
    }

    let workGroupSizeSquared = Math.min(Math.min(Math.max(nextPot(Math.sqrt(localSize * nInvocationsPerWorkGroup)), 1), this.getWidth()), this.__ctx.getMaxPointSize());
    let workGroupSize = Math.max(Math.floor((workGroupSizeSquared * workGroupSizeSquared) / localSize), 1);
    
    let didLayoutChange = (workGroupSize != this.__descriptor.workGroupSize || workGroupSizeSquared != this.__descriptor.workGroupSizeSquared);
    
    let shouldCopyLastState = (!this.__invalidated && (didResize || didLayoutChange));
    if(shouldCopyLastState)
    {
        if(!didResize) this.__resize(this.getWidth(), this.getHeight());

        let lastActiveTexture = this.__ctx.getActiveTexture(0);
        lastStateFrameBufferAttachment.bind(0);

        let copyProgram = glTextureData.__genCopyProgram(this.__ctx, this.__descriptor.localSize);
        copyProgram.__dispatchRange(this, 0, lastStateCapacity, workGroupSize, workGroupSizeSquared);
        
        if(lastActiveTexture != null) this.__ctx.bindTexture(0, lastActiveTexture);
        else lastStateFrameBufferAttachment.unbind();
    }

    if(lastStateFramebuffer != null && lastStateFramebuffer != this.__framebuffer) lastStateFramebuffer.free();

    this.__descriptor.workGroupSizeSquared = workGroupSizeSquared;
    this.__descriptor.workGroupSize = workGroupSize;
    this.__descriptor.localSize = localSize;
}

glTextureData.prototype.free = function()
{
    if(this.__framebuffer != null)
    {
        this.__framebuffer.free();
        this.__framebuffer = null;
    }
}

glTextureData.prototype.invalidate = function()
{
    this.__framebuffer.invalidate();

    this.__descriptor.size = 0;
    this.__invalidated = true;
}

glTextureData.prototype.clear = function()
{
    let gl = this.__ctx.getGL();
    
    let lastClearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);
    let lastActiveFramebuffer = this.__ctx.getActiveFramebuffer();
    
    this.__framebuffer.bind(this.__framebufferAttachment);
   
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.clearColor(lastClearColor[0], lastClearColor[1], lastClearColor[2], lastClearColor[3]);
    this.__ctx.bindFramebuffer(lastActiveFramebuffer);

    this.__descriptor.size = 0;
    this.__invalidated = true;
}

glTextureData.fromMesh = function(ctx, mesh, meshTextureData)
{
    let gl = ctx.getGL();

    let currentViewport   = ctx.getViewport();
    let activeProgram     = ctx.getActiveProgram();
    let activeFramebuffer = ctx.getActiveFramebuffer();

    let meshToTextureProgram     = glTextureData.__genMeshToTextureProgram(ctx);
    let meshToTextureDataProgram = glTextureData.__genMeshToTextureDataProgram(ctx);

    let uniformSquaredSize = meshToTextureProgram.getUniform("squaredSize");
    let uniformAccessorID  = meshToTextureProgram.getUniform("accessorID");
    
    mesh = new glPrimitive(ctx, mesh.__vertices);

    for(let vertexIndex = 0, e = mesh.size(); vertexIndex != e; ++vertexIndex) {
        mesh.__vertices[vertexIndex].bonesIndices[0] = vertexIndex; // enforce vertices duplication
    }
    
    let nAccessors = 3;
    let squaredSize = nextPot(Math.ceil(Math.sqrt(mesh.size() * nAccessors)));

    let framebuffer = new glFramebuffer(ctx, squaredSize, squaredSize);
    let meshTexture = framebuffer.createColorAttachmentRGBA32F();

    framebuffer.bind([meshTexture]);

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    meshToTextureProgram.bind();
    uniformSquaredSize.set(squaredSize);

    for(let accessorID = 0; accessorID < nAccessors; ++accessorID) 
    {
        uniformAccessorID.set(accessorID);
        mesh.render(gl.POINTS);
    }

    framebuffer.unbind();
    meshTexture.bind(0);
    
    if(meshTextureData == null) meshTextureData = new glTextureData32F(ctx);
    
    meshToTextureDataProgram.dispatch(meshTextureData, mesh.size(), 1024);
    meshTextureData.__descriptor.capacity = mesh.size();
   
    ctx.bindFramebuffer(activeFramebuffer);
    ctx.setViewport(currentViewport.x, currentViewport.y, currentViewport.w, currentViewport.h);
    ctx.bindProgram(activeProgram);

    return meshTextureData;
}

glTextureData.prototype.set = function(textureData)
{
    if(!textureData.__is_glPrimitive)
    {
        this.__invalidated = true;
        this.reserve(textureData.__descriptor.localSize, textureData.__descriptor.capacity);

        this.__descriptor.workGroupSize = textureData.__descriptor.workGroupSize;
        this.__descriptor.capacity = textureData.capacity();
        this.__descriptor.size = textureData.size();
        
        let lastActiveFramebuffer = this.__ctx.getActiveFramebuffer();
        this.__framebuffer.bind(this.__framebufferAttachment);
        
        textureData.blit(this.__ctx.getGL().NEAREST);
        
        this.__ctx.bindFramebuffer(lastActiveFramebuffer);
        this.__invalidated = false;

    } else glTextureData.fromMesh(this.__ctx, textureData, this);
}

glTextureData.prototype.size = function() {
    return this.__descriptor.size;
}

glTextureData.prototype.capacity = function() {
    return this.__descriptor.capacity;
}

glTextureData.prototype.localSize = function() {
    return this.__descriptor.localSize;
}

glTextureData.prototype.getWidth = function() {
    return this.__framebufferAttachment.getWidth();
}

glTextureData.prototype.getHeight = function() {
    return this.__framebufferAttachment.getHeight();
}

glTextureData.prototype.bind = function(unitID) {
    this.__framebufferAttachment.bind(unitID);
}

glTextureData.prototype.unbind = function() {
    this.__framebufferAttachment.unbind();
}

glTextureData.prototype.blit = function(filter) {
    this.__framebufferAttachment.blit(((filter != null) ? filter : this.__ctx.getGL().NEAREST));
}

// -------------------------------------------------------------------------------------------

let glTextureData8 = function(ctx, localSize, capacity) {
    glTextureData.call(this, ctx, localSize, capacity);
}

glTextureData8.prototype = Object.create(glTextureData.prototype);

glTextureData8.prototype.__createAttachment = function() {
    return this.__framebuffer.createColorAttachmentRGBA8();
}

// -------------------------------------------------------------------------------------------

let glTextureData16F = function(ctx, localSize, capacity) {
    glTextureData.call(this, ctx, localSize, capacity);
}

glTextureData16F.prototype = Object.create(glTextureData.prototype);

glTextureData16F.prototype.__createAttachment = function() {
    return this.__framebuffer.createColorAttachmentRGBA16F();
}

// -------------------------------------------------------------------------------------------

let glTextureData32F = function(ctx, localSize, capacity) {
    glTextureData.call(this, ctx, localSize, capacity);
}

glTextureData32F.prototype = Object.create(glTextureData.prototype);

glTextureData32F.prototype.__createAttachment = function() {
    return this.__framebuffer.createColorAttachmentRGBA32F();
}

// -------------------------------------------------------------------------------------------
