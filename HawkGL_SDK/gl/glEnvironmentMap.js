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

let glEnvironmentMap = function(ctx, skyMap, size, onDrawCallback)
{
    this.__ctx = ctx;
    let gl = ctx.getGL();
    
    let halfSize = Math.floor(size * 0.5);

    this.__envMappingProgram = glEnvironmentMap.__genEnvMappingProgram(ctx);
    this.__skyMapIntensityUniform = this.__envMappingProgram.getUniform("skyMapIntensity");
    
    this.__faceFramebuffer = new glFramebuffer(ctx, halfSize, halfSize);
    this.__faceMap = this.__faceFramebuffer.createColorAttachmentRGBA16F();
    this.__faceFramebuffer.createDepthAttachment16();

    this.__faceMap.setFilterMode(gl.LINEAR, gl.LINEAR);
    this.__faceMap.setWrapMode(gl.CLAMP_TO_EDGE);

    this.__environmentFramebuffer = null; 
    this.__environmentMap = null; 

    this.__environmentFramebuffer = new glFramebuffer(ctx, size, halfSize);
    this.__environmentMap = this.__environmentFramebuffer.createColorAttachmentRGBA16F();
        
    this.__environmentMap.setFilterMode(gl.LINEAR, gl.LINEAR);
    this.__environmentMap.setWrapMode(gl.REPEAT);
    
    this.__onDrawCallback = onDrawCallback;

    this.__skyMap = skyMap;
    this.__faceID = 0;
}  

glEnvironmentMap.__genEnvMappingProgram = function(ctx)
{
    if(glEnvironmentMap.__envMappingProgramInstances == null) glEnvironmentMap.__envMappingProgramInstances = new Map();

    let program = glEnvironmentMap.__envMappingProgramInstances.get(ctx);
    if(program == null) 
    {
        program = new glProgram(ctx, "#version 300 es                            \n" +
                                     "precision highp float;                     \n" +
                                     "                                           \n" +
                                     "out vec2 texCoords;                        \n" +
                                     "                                           \n" +
                                     "void main()                                \n" +
                                     "{                                          \n" +
                                     "    texCoords = glTexCoord;                \n" +
                                     "    gl_Position = vec4(glVertex.xyz, 1.0); \n" +
                                     "}                                          \n",
                                     
                                     "#version 300 es                                                                                                                \n" +
                                     "precision mediump float;                                                                                                       \n" +
                                     "                                                                                                                               \n" +
                                     "uniform mat3 glNormalMatrix;                                                                                                   \n" +
                                     "uniform mat4 glProjectionMatrix;                                                                                               \n" +
                                     "                                                                                                                               \n" +
                                     "uniform mediump sampler2D skyMap;                                                                                              \n" +
                                     "uniform mediump sampler2D patchMap;                                                                                            \n" +
                                     "                                                                                                                               \n" +
                                     "uniform float skyMapIntensity;                                                                                                 \n" +
                                     "                                                                                                                               \n" +
                                     "in vec2 texCoords;                                                                                                             \n" +
                                     "                                                                                                                               \n" +
                                     "layout(location = 0) out mediump vec4 renderTargetColor;                                                                       \n" +
                                     "                                                                                                                               \n" +
                                     "const float PI        = 3.1415926535897932384626433832795028841971693993751058209749;                                          \n" +
                                     "const float PI_2      = PI * 2.0;                                                                                              \n" +
                                     "const float PI_OVER_2 = PI * 0.5;                                                                                              \n" +
                                     "                                                                                                                               \n" +
                                     "vec2 polarToUV(in vec3 n)                                                                                                      \n" +
                                     "{                                                                                                                              \n" +
                                     "    n = normalize(n);                                                                                                          \n" +
                                     "    return vec2((atan(n.z, -n.x) + PI_OVER_2) / PI_2 + PI * (28.670 / 360.0), acos(-n.y) / PI);                                \n" +
                                     "}                                                                                                                              \n" +
                                     "                                                                                                                               \n" +
                                     "vec3 uvToPolar(in vec2 uv)                                                                                                     \n" +
                                     "{                                                                                                                              \n" +
                                     "    uv = uv;                                                                                                                   \n" +
                                     "                                                                                                                               \n" +
                                     "    float phi   = PI * uv.y;                                                                                                   \n" +
                                     "    float theta = PI_2 * uv.x - PI_OVER_2;                                                                                     \n" +
                                     "                                                                                                                               \n" +
                                     "    float sinPhi = sin(phi);                                                                                                   \n" +
                                     "                                                                                                                               \n" +
                                     "    return normalize(vec3(-sin(theta) * sinPhi, -cos(phi), -cos(theta) * sinPhi));                                             \n" +
                                     "}                                                                                                                              \n" +
                                     "                                                                                                                               \n" +
                                     "void main()                                                                                                                    \n" +
                                     "{                                                                                                                              \n" +
                                     "    vec4 patchUV = (glProjectionMatrix * mat4(glNormalMatrix)) * vec4(uvToPolar(texCoords), 1.0);                              \n" +
                                     "    patchUV.xyz = vec3(0.5) + 0.5 * (patchUV.xyz / patchUV.w);                                                                 \n" +
                                     "                                                                                                                               \n" +
                                     "    vec3 edge = abs(vec3(0.5) - patchUV.xyz);                                                                                  \n" +
                                     "    if(max(edge.x, max(edge.y, edge.z)) > 0.5) discard;                                                                        \n" +
                                     "                                                                                                                               \n" +
                                     "    renderTargetColor = texture(patchMap, patchUV.xy);                                                                         \n" +
                                     "    renderTargetColor.rgb = mix(texture(skyMap, texCoords).rgb * skyMapIntensity, renderTargetColor.rgb, renderTargetColor.a); \n" +
                                     "}                                                                                                                              \n");

        program.compile();
        program.createUniformSampler("skyMap",          0);
        program.createUniformSampler("patchMap",        1);
        program.createUniformFloat("skyMapIntensity", 1.0);
        
        glEnvironmentMap.__envMappingProgramInstances.set(ctx, program);
    }

    return program;
}

glEnvironmentMap.prototype.free = function()
{
    this.__environmentFramebuffer.free();
    this.__environmentFramebuffer = null;
    
    this.__faceFramebuffer.free();
    this.__faceFramebuffer = null;
}

glEnvironmentMap.prototype.__updateFace = function(position)
{
    let orientationVector = null;
    switch((this.__faceID = ((this.__faceID + 1) % 6)))
    {
        case 0: orientationVector = new glVector3f(+1.0,  0.0,  0.0); break;
        case 1: orientationVector = new glVector3f( 0.0, +1.0,  0.0); break;
        case 2: orientationVector = new glVector3f( 0.0,  0.0, +1.0); break;
        case 3: orientationVector = new glVector3f(-1.0,  0.0,  0.0); break;
        case 4: orientationVector = new glVector3f( 0.0, -1.0,  0.0); break;
        case 5: orientationVector = new glVector3f( 0.0,  0.0, -1.0); break;
    }

    let gl = this.__ctx.getGL();

    this.__faceFramebuffer.bind([this.__faceMap]);
    this.__ctx.lookAt(position, glVector3f.add(position, orientationVector));
    
    gl.clearDepth(1.0);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.__onDrawCallback(gl);
    
    this.__skyMap.bind(0);
    this.__faceMap.bind(1);

    this.__environmentFramebuffer.bind([this.__environmentMap]);
    this.__envMappingProgram.runPostProcess();
    this.__faceFramebuffer.invalidate();
}

glEnvironmentMap.prototype.update = function(position, nFacesUpdates)
{
    if(nFacesUpdates == null) nFacesUpdates = 6;
    
    let currentViewport     = this.__ctx.getViewport();
    let activeProgram       = this.__ctx.getActiveProgram();
    let currentProjection   = this.__ctx.getProjectionMatrix();
    let activeFramebuffer   = this.__ctx.getActiveFramebuffer();
    
    this.__ctx.pushMatrix();
    ctx.setPerspectiveProjection(90.0, 1.0, 0.1, 99.0);
    
    for(let i = 0, e = Math.min(Math.max(nFacesUpdates, 1), 6); i < e; ++i) this.__updateFace(position);

    this.__ctx.setOrthographicProjection(currentProjection);
    this.__ctx.popMatrix();
    
    this.__ctx.bindFramebuffer(activeFramebuffer);
    this.__ctx.setViewport(currentViewport.x, currentViewport.y, currentViewport.w, currentViewport.h);
    this.__ctx.bindProgram(activeProgram);
}

glEnvironmentMap.prototype.setSkyIntensity = function(multiplier) {
    this.__skyMapIntensityUniform.set(multiplier);
}

glEnvironmentMap.prototype.getEvironmentMap = function() {
    return this.__environmentMap;
}

glEnvironmentMap.prototype.setFilterMode = function(minFilter, magFilter) {
    this.__environmentMap.setFilterMode(minFilter, magFilter);
}

glEnvironmentMap.prototype.getFilterMode = function() {
    return this.__environmentMap.getFilterMode();
}

glEnvironmentMap.prototype.setWrapMode = function(wrapMode) {
    this.__environmentMap.setWrapMode(wrapMode);
}

glEnvironmentMap.prototype.getWrapMode = function() {
    return this.__environmentMap.getWrapMode();
}

glEnvironmentMap.prototype.setCompareMode = function(mode) {
    this.__environmentMap.setCompareMode(mode);
}

glEnvironmentMap.prototype.getCompareMode = function() {
    return this.__environmentMap.getCompareMode();
}

glEnvironmentMap.prototype.generateMipmap = function(enableAnisotropicFiltering) {
    this.__environmentMap.generateMipmap(enableAnisotropicFiltering);
}

glEnvironmentMap.prototype.getWidth = function() {
    return this.__environmentMap.getWidth();
}

glEnvironmentMap.prototype.getHeight = function() {
    return this.__environmentMap.getHeight();
}

glEnvironmentMap.prototype.bind = function(unitID) {
    this.__environmentMap.bind(unitID);
}

glEnvironmentMap.prototype.unbind = function() {
    this.__environmentMap.unbind();
}

glEnvironmentMap.prototype.blit = function(filter) {
    this.__environmentMap.blit(filter);
}

glEnvironmentMap.prototype.getTextureID = function() {
    return this.__environmentMap.getTextureID();
}

glEnvironmentMap.prototype.toImage = function(width, height, onLoad) {
    return this.__environmentMap.toImage(width, height, onLoad);
}

glEnvironmentMap.prototype.toBase64 = function(width, height) {
    return this.__environmentMap.toImage(width, height);
}
