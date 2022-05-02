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

let glDepthTracingTexture = function(ctx, depthMap, w, h)
{
    this.__ctx = ctx; 

    this.__depthAdsProgram = glDepthTracingTexture.__genDepthAdsProgram(ctx);
    this.__depthFittingProgram = glDepthTracingTexture.__genDepthFittingProgram(ctx);

    if(depthMap != null) this.set(depthMap, w, h);
}

glDepthTracingTexture.textureFormat = Object.freeze({"RGBA16F": 0, "RGBA32F": 1});

glDepthTracingTexture.__genDepthFittingProgram = function(ctx)
{
    if(glDepthTracingTexture.__depthFittingProgram_instances == null) glDepthTracingTexture.__depthFittingProgram_instances = new Map();

    let program = glDepthTracingTexture.__depthFittingProgram_instances.get(ctx);
    if(program == null)
    {
        program = new glProgram(ctx, "#version 300 es                                                                                      \n" +
                                     "out highp vec2 texCoords;                                                                            \n" +
                                     "const highp vec2 verticesCoords[] = vec2[](vec2(-1.0), vec2(1.0, -1.0), vec2(1.0), vec2(-1.0, 1.0)); \n" +
                                     "                                                                                                     \n" +
                                     "void main()                                                                                          \n" +
                                     "{                                                                                                    \n" +
                                     "    gl_Position = vec4(verticesCoords[gl_VertexID], 0.0, 1.0);                                       \n" +
                                     "    texCoords = gl_Position.xy * 0.5 + vec2(0.5);                                                    \n" +
                                     "}                                                                                                    \n",

                                     "#version 300 es                                                                                      \n" +
                                     "uniform highp sampler2D srcTexture;                                                                  \n" +
                                     "                                                                                                     \n" +
                                     "in highp vec2 texCoords;                                                                             \n" +
                                     "out highp vec4 depthRange;                                                                           \n" +
                                     "                                                                                                     \n" +
                                     "void main()                                                                                          \n" +
                                     "{                                                                                                    \n" +
                                     "    ivec2 bufferSize = textureSize(srcTexture, 0);                                                   \n" +
                                     "    ivec2 coord = ivec2(texCoords * vec2(bufferSize) - 0.5);                                         \n" +
                                     "                                                                                                     \n" +
                                     "    mat4 c = mat4(texelFetch(srcTexture, clamp(coord + ivec2(0, 0), ivec2(0), bufferSize - 1), 0),   \n" +
                                     "                  texelFetch(srcTexture, clamp(coord + ivec2(0, 1), ivec2(0), bufferSize - 1), 0),   \n" +
                                     "                  texelFetch(srcTexture, clamp(coord + ivec2(1, 0), ivec2(0), bufferSize - 1), 0),   \n" +
                                     "                  texelFetch(srcTexture, clamp(coord + ivec2(1, 1), ivec2(0), bufferSize - 1), 0));  \n" +
                                     "                                                                                                     \n" +
                                     "    depthRange.xy = depthRange.zw = vec2(min(min(min(c[0].x, c[1].x), c[2].x), c[3].x),              \n" +
                                     "                                         max(max(max(c[0].y, c[1].y), c[2].y), c[3].y));             \n" +
                                     "}                                                                                                    \n");

        if(!program.compile()) console.error(program.getLastError());
        program.createUniformSampler("srcTexture", 0);

        glDepthTracingTexture.__depthFittingProgram_instances.set(ctx, program);
    }

    return program;
}

glDepthTracingTexture.__genDepthAdsProgram = function(ctx)
{
    if(glDepthTracingTexture.__depthAdsProgram_instances == null) glDepthTracingTexture.__depthAdsProgram_instances = new Map();

    let program = glDepthTracingTexture.__depthAdsProgram_instances.get(ctx);
    if(program == null)
    {
        program = new glProgram(ctx, "#version 300 es                                                                                      \n" +
                                     "out highp vec2 texCoords;                                                                            \n" +
                                     "const highp vec2 verticesCoords[] = vec2[](vec2(-1.0), vec2(1.0, -1.0), vec2(1.0), vec2(-1.0, 1.0)); \n" +
                                     "                                                                                                     \n" +
                                     "void main()                                                                                          \n" +
                                     "{                                                                                                    \n" +
                                     "    gl_Position = vec4(verticesCoords[gl_VertexID], 0.0, 1.0);                                       \n" +
                                     "    texCoords = gl_Position.xy * 0.5 + vec2(0.5);                                                    \n" +
                                     "}                                                                                                    \n",

                                     "#version 300 es                                                                                                        \n" +
                                     "#define USE_LOGARITMIC_DEPTH (0)                                                                                       \n" +
                                     "                                                                                                                       \n" +
                                     "uniform highp sampler2D lastLodTexture;                                                                                \n" +
                                     "uniform highp sampler2D depthTexture;                                                                                  \n" +
                                     "                                                                                                                       \n" +
                                     "uniform lowp int mipLodID;                                                                                             \n" +
                                     "uniform lowp int maxLodID;                                                                                             \n" +
                                     "                                                                                                                       \n" +
                                     "in highp vec2 texCoords;                                                                                               \n" +
                                     "out highp vec4 tileDepth;                                                                                              \n" +
                                     "                                                                                                                       \n" +
                                     "vec2 getSliceDepthSection(in int sliceID, in vec2 depthRange)                                                          \n" +
                                     "{                                                                                                                      \n" +
                                     "    vec2 depthSection = clamp(vec2(0, 0.1) + 0.1 * float(sliceID), 0.0, 1.0);                                          \n" +
                                     "                                                                                                                       \n" +
                                     "#if USE_LOGARITMIC_DEPTH                                                                                               \n" +
                                     "    depthSection = depthSection * depthSection;                                                                        \n" +
                                     "#endif                                                                                                                 \n" +
                                     "                                                                                                                       \n" +
                                     "    depthSection = depthRange.x + (depthRange.y - depthRange.x) * depthSection;                                        \n" +
                                     "                                                                                                                       \n" +
                                     "    return depthSection;                                                                                               \n" +
                                     "}                                                                                                                      \n" +
                                     "                                                                                                                       \n" +
                                     "vec2 sliceDepth(in vec2 depthSection, in vec2 depthRange, in int sliceID)                                              \n" +
                                     "{                                                                                                                      \n" +
                                     "    vec2 sliceSection = getSliceDepthSection(sliceID, depthRange);                                                     \n" +
                                     "                                                                                                                       \n" +
                                     "    if(depthSection.x > sliceSection.y || depthSection.y < sliceSection.x) return vec2(1);                             \n" +
                                     "    depthSection = clamp(depthSection, sliceSection.x, sliceSection.y);                                                \n" +
                                     "                                                                                                                       \n" +
                                     "    return depthSection;                                                                                               \n" +
                                     "}                                                                                                                      \n" +
                                     "                                                                                                                       \n" +
                                     "void main()                                                                                                            \n" +
                                     "{                                                                                                                      \n" +
                                     "    int sliceID = 4;                                                                                                   \n" +
                                     "    vec2 texCoords = texCoords;                                                                                        \n" +
                                     "    ivec2 bufferSize = textureSize(lastLodTexture, 0);                                                                 \n" +
                                     "    vec2 depthRange = texelFetch(depthTexture, ivec2(0), 0).zw;                                                        \n" +
                                     "                                                                                                                       \n" +
                                     "    if(mipLodID % 2 == 1)                                                                                              \n" +
                                     "    {                                                                                                                  \n" +
                                     "         texCoords = floor(texCoords * vec2(bufferSize)) / vec2(bufferSize);                                           \n" +
                                     "         sliceID = (int(floor(texCoords.x * 2.0)) + 2 * int(floor(texCoords.y * 2.0)));                                \n" +
                                     "                                                                                                                       \n" +
                                     "         if(mipLodID == 1) texCoords = fract(texCoords * 2.0);                                                         \n" +
                                     "    }                                                                                                                  \n" +
                                     "                                                                                                                       \n" +
                                     "    ivec2 coord = ivec2(texCoords * vec2(bufferSize) - 1.5);                                                           \n" +
                                     "                                                                                                                       \n" +
                                     "    vec4 children[16] = vec4[16](texelFetch(lastLodTexture, clamp(coord + ivec2(0, 0), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(1, 0), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(2, 0), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(3, 0), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(0, 1), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(1, 1), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(2, 1), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(3, 1), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(0, 2), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(1, 2), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(2, 2), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(3, 2), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(0, 3), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(1, 3), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(2, 3), ivec2(0), bufferSize - 1), 0),  \n" +
                                     "                                 texelFetch(lastLodTexture, clamp(coord + ivec2(3, 3), ivec2(0), bufferSize - 1), 0)); \n" +
                                     "                                                                                                                       \n" +
                                     "    tileDepth = vec4(1, 0, 1, 0);                                                                                      \n" +
                                     "                                                                                                                       \n" +
                                     "    for(int i = 0; i < 16; ++i)                                                                                        \n" +
                                     "    {                                                                                                                  \n" +
                                     "        if(mipLodID <= 2) children[i].xy = children[i].zw = clamp(children[i].xy, vec2(0.0), vec2(1.0));               \n" +
                                     "                                                                                                                       \n" +
                                     "        children[i].xy = sliceDepth(children[i].xy, depthRange, 2 * sliceID + 0);                                      \n" +
                                     "        children[i].zw = sliceDepth(children[i].zw, depthRange, 2 * sliceID + 1);                                      \n" +
                                     "                                                                                                                       \n" +
                                     "        if(children[i][0] < 1.0)                                                                                       \n" +
                                     "        {                                                                                                              \n" +
                                     "            tileDepth[0] = min(tileDepth[0], children[i][0]);                                                          \n" +
                                     "            tileDepth[1] = max(tileDepth[1], children[i][1]);                                                          \n" +
                                     "        }                                                                                                              \n" +
                                     "                                                                                                                       \n" +
                                     "        if(children[i][2] < 1.0)                                                                                       \n" +
                                     "        {                                                                                                              \n" +
                                     "            tileDepth[2] = min(tileDepth[2], children[i][2]);                                                          \n" +
                                     "            tileDepth[3] = max(tileDepth[3], children[i][3]);                                                          \n" +
                                     "        }                                                                                                              \n" +
                                     "    }                                                                                                                  \n" +
                                     "}                                                                                                                      \n");

        if(!program.compile()) console.error(program.getLastError());

        program.__uniformMipLodID = program.createUniformInt("mipLodID");
        program.__uniformMaxLodID = program.createUniformInt("maxLodID");
        program.createUniformSampler("lastLodTexture", 0);
        program.createUniformSampler("depthTexture",   1);

        glDepthTracingTexture.__depthAdsProgram_instances.set(ctx, program);
    }

    return program;
}

glDepthTracingTexture.__getFramebuffers = function(ctx, w, h, format)
{
    if(glDepthTracingTexture.__depthLodFBOs_instances == null) glDepthTracingTexture.__depthLodFBOs_instances = new Map();

    let ctxCache = glDepthTracingTexture.__depthLodFBOs_instances.get(ctx);
    if(ctxCache == null) glDepthTracingTexture.__depthLodFBOs_instances.set(ctx, (ctxCache = new Map()));

    let resolutionHash = (w + "x" + h + ":" + format);
    let framebuffers = ctxCache.get(resolutionHash);
    if(framebuffers == null)
    {
        framebuffers = [new glFramebuffer(ctx, w, h), new glFramebuffer(ctx, w, h)];

        switch(format)
        {
            case glDepthTracingTexture.textureFormat.RGBA16F: framebuffers[0].createColorAttachmentRGBA16F(); break;
            case glDepthTracingTexture.textureFormat.RGBA32F: framebuffers[0].createColorAttachmentRGBA32F(); break;
        }

        ctxCache.set(resolutionHash, framebuffers);
    }

    return framebuffers;
}

glDepthTracingTexture.prototype.__resize = function(w, h, textureFormat)
{
    if(this.__framebuffer == null || this.__framebuffer.getWidth() != w || this.__framebuffer.getHeight() != h || this.__format != textureFormat)
    {
        if(this.__framebuffer != null) this.__framebuffer.free();
        this.__framebuffer = new glFramebuffer(this.__ctx, w, h);

        switch((this.__format = textureFormat))
        {
            case glDepthTracingTexture.textureFormat.RGBA16F: this.__depthAttachment = this.__framebuffer.createColorAttachmentRGBA16F(); break;
            case glDepthTracingTexture.textureFormat.RGBA32F: this.__depthAttachment = this.__framebuffer.createColorAttachmentRGBA32F(); break;
        }

        let gl = this.__ctx.getGL();
        this.__depthAttachment.setWrapMode(gl.CLAMP_TO_EDGE);
        this.__depthAttachment.generateMipmap(false); // disable anisotropic

        this.__mipLods = 1 + Math.floor(Math.log2(Math.max(w, h)));
    }
}

glDepthTracingTexture.prototype.__fitDepth = function()
{
    let gl = this.__ctx.getGL();
    this.__depthFittingProgram.bind();
    
    let depthMap = this.__depthAttachment.__renderTexture;
    for(let lodID = 1, srcMip = depthMap; lodID < this.__mipLods; ++lodID)
    {
        let l = 1 << lodID;
        let w = Math.max(Math.floor(depthMap.getWidth()  / l), 1);
        let h = Math.max(Math.floor(depthMap.getHeight() / l), 1);

        let framebuffers = glDepthTracingTexture.__getFramebuffers(this.__ctx, w, h, this.__format);
        let dstMip = framebuffers[0].__colorAttachments[0];
        this.__ctx.updateActiveProgram();
        this.__ctx.unbindVertexArray();

        srcMip.bind(0);
        framebuffers[0].bind([dstMip]);
        this.__ctx.setViewport(0, 0, w, h);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        srcMip = dstMip;

        if(lodID == this.__mipLods - 1)
        {
            switch(this.__format)
            {
                case glDepthTracingTexture.textureFormat.RGBA16F: dstMip = framebuffers[1].createColorAttachmentRGBA16F(depthMap, 0); break;
                case glDepthTracingTexture.textureFormat.RGBA32F: dstMip = framebuffers[1].createColorAttachmentRGBA32F(depthMap, 0); break;
            }

            srcMip.bind(0);
            framebuffers[1].bind([dstMip]);
            this.__ctx.setViewport(0, 0, 1, 1);
            gl.colorMask(false, false, true, true);
            this.__ctx.blitActiveTexture(0);
            gl.colorMask(true, true, true, true);
            framebuffers[1].unbind();

            framebuffers[1].__colorAttachments.length = 0; // dereference mip attachment (do not free)
        }
    }
}

glDepthTracingTexture.prototype.__genAccelerationDataStructure = function()
{
    let gl = this.__ctx.getGL();
    this.__depthAdsProgram.bind();

    let depthMap = this.__depthAttachment.__renderTexture;
    for(let lodID = 1, srcMip = [depthMap, depthMap]; lodID < this.__mipLods; ++lodID)
    {
        let l = 1 << lodID;
        let w = Math.max(Math.floor(depthMap.getWidth()  / l), 1);
        let h = Math.max(Math.floor(depthMap.getHeight() / l), 1);

        let framebuffers = glDepthTracingTexture.__getFramebuffers(this.__ctx, w, h, this.__format);
        let dstMip = framebuffers[0].__colorAttachments[0];

        this.__depthAdsProgram.__uniformMaxLodID.set(this.__mipLods - 1);
        this.__depthAdsProgram.__uniformMipLodID.set(lodID);
        this.__ctx.updateActiveProgram();
        this.__ctx.unbindVertexArray();

        let srcID = ((lodID % 2 == 0) ? 0 : 1);

        depthMap.bind(1);
        srcMip[srcID].bind(0);
        framebuffers[0].bind([dstMip]);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        depthMap.unbind();

        srcMip[srcID] = dstMip;

        switch(this.__format)
        {
            case glDepthTracingTexture.textureFormat.RGBA16F: dstMip = framebuffers[1].createColorAttachmentRGBA16F(depthMap, lodID); break;
            case glDepthTracingTexture.textureFormat.RGBA32F: dstMip = framebuffers[1].createColorAttachmentRGBA32F(depthMap, lodID); break;
        }

        framebuffers[1].bind([dstMip]);
        srcMip[srcID].blit();
        framebuffers[1].unbind();

        framebuffers[1].__colorAttachments.length = 0; // dereference mip attachment (do not free)
    }
}

glDepthTracingTexture.prototype.set = function(depthMap, w, h)
{
    let gl = this.__ctx.getGL();

    let lastActiveViewport = this.__ctx.getViewport();
    let lastActiveProgram = this.__ctx.getActiveProgram();
    let lastActiveTexture0 = this.__ctx.getActiveTexture(0);
    let lastActiveTexture1 = this.__ctx.getActiveTexture(1);
    let lastActiveFramebuffer = this.__ctx.getActiveFramebuffer();
    let wasDepthTestingEnabled = gl.isEnabled(gl.DEPTH_TEST);
    let wasCullingEnabled = gl.isEnabled(gl.CULL_FACE);

    if(wasCullingEnabled) gl.disable(gl.CULL_FACE);
    if(wasDepthTestingEnabled) gl.disable(gl.DEPTH_TEST);

    this.__textureRef = depthMap;
    let textureFormat = ((depthMap instanceof glTextureRGBA32F) ? glDepthTracingTexture.textureFormat.RGBA32F : glDepthTracingTexture.textureFormat.RGBA16F);

    if(w == null) w = depthMap.getWidth();
    if(h == null) h = depthMap.getHeight();
    
    w = Math.min(closestPot(w), 4096);
    h = Math.min(closestPot(h), 4096);
    
    this.__resize(w, h, textureFormat);

    let hasShells = true;
    this.__framebuffer.bind([this.__depthAttachment]);
    this.__depthAttachment.__shouldUpdateMipmap = false;
    depthMap.blit(gl.NEAREST);
    gl.clearColor(0.0, 1.0, 0.0, 1.0);
    gl.colorMask(false, !hasShells, true, true);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, true);
    this.__framebuffer.unbind();
    
    this.__fitDepth();
    this.__genAccelerationDataStructure();

    this.__ctx.bindFramebuffer(lastActiveFramebuffer);
    this.__ctx.setViewport(lastActiveViewport.x, lastActiveViewport.y, lastActiveViewport.w, lastActiveViewport.h);
    this.__ctx.bindTexture(1, lastActiveTexture1);
    this.__ctx.bindTexture(0, lastActiveTexture0);
    this.__ctx.bindProgram(lastActiveProgram);

    if(wasDepthTestingEnabled) gl.enable(gl.DEPTH_TEST);
    if(wasCullingEnabled) gl.enable(gl.CULL_FACE);
}

glDepthTracingTexture.prototype.resize = function(w, h) {
    if(this.__textureRef != null) this.set(this.__textureRef, w, h);
}

glDepthTracingTexture.prototype.update = function() {
    if(this.__textureRef != null) this.set(this.__textureRef, this.getWidth(), this.getHeight());
}

glDepthTracingTexture.prototype.getFormat = function() {
    return this.__format;
}

glDepthTracingTexture.prototype.getWidth = function() {
    return ((this.__framebuffer != null) ? this.__framebuffer.getWidth() : 0);
}

glDepthTracingTexture.prototype.getHeight = function() {
    return ((this.__framebuffer != null) ? this.__framebuffer.getHeight() : 0);
}

glDepthTracingTexture.prototype.bind = function(slotID) {
    if(this.__depthAttachment != null) this.__depthAttachment.bind(slotID);
}

glDepthTracingTexture.prototype.unbind = function() {
    if(this.__depthAttachment != null) this.__depthAttachment.unbind();
}

glDepthTracingTexture.prototype.free = function()
{
    if(this.__framebuffer != null) this.__framebuffer.free();
    this.__framebuffer = this.__depthAttachment = this.__textureRef = null;
}
