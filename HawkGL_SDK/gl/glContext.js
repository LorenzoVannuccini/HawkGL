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

let glContext = function(canvasID)
{
    this.__canvas = ((typeof canvasID === 'string' || canvasID instanceof String) ? document.getElementById(canvasID) : canvasID);
       
    let options = 
    {
        alpha: true, 
        depth: false,
        stencil: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false
    };

    this.__gl = this.__canvas.getContext("webgl2", options);
    
    this.__inputDeviceManager = new InputDeviceManager();
    this.__pendingAssets = new ProgressMeter();
    this.__fpsCounter = new fpsCounter();
    this.__timeElapsed = 0.0;
    
    this.__contextWidth  = -1;
    this.__contextHeight = -1;

    this.__uniformRectMesh = glMesh.createRectangle(this, 2.0, 2.0);
    
    this.__projectionMatrix = glMatrix4x4f.identityMatrix();
    this.__modelViewMatrix = glMatrix4x4f.identityMatrix();

    this.__normalMatrix = glMatrix4x4f.identityMatrix();
    this.__shouldUpdateNormalMatrix = false;

    this.__modelViewProjectionMatrix = glMatrix4x4f.identityMatrix();
    this.__shouldUpdateModelViewProjectionMatrix = false;

    this.__uniformsUpdateCheckMaxComponents = 64;
    
    this.__modelViewMatrixStack = [];
    this.__activeUniformBlocks = [];
    this.__activeTextures = [];

    this.__extensions =  {
        blendableTextureFloat:    this.__gl.getExtension("EXT_float_blend"),
        renderableTextureFloat:   this.__gl.getExtension("EXT_color_buffer_float"),
        textureFloatLinearFilter: this.__gl.getExtension("OES_texture_float_linear"),
        anisotropicFilter:        this.__gl.getExtension("EXT_texture_filter_anisotropic")
    };
    
    this.__shadingGlobalConstants = "";
    this.__shadingGlobalConstantsLineCount = 0;

    let maxFragTextureUnits = this.__gl.getParameter(this.__gl.MAX_TEXTURE_IMAGE_UNITS);
    let maxVertTextureUnits = this.__gl.getParameter(this.__gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    let maxTextureUnits = Math.max(maxVertTextureUnits, maxFragTextureUnits);
    
    // let maxUniformBlockUnits = this.__gl.getParameter(this.__gl.MAX_UNIFORM_BUFFER_BINDINGS);

    this.__standardUniformsBlock  = new glUniformBlock(this, "glStandardUniformsBlock");
    this.__animationUniformsBlock = new glUniformBlock(this, "glAnimationUniformsBlock");

    this.__standardUniformsBlock.glModelViewProjectionMatrix = this.__standardUniformsBlock.createUniformMat4("glModelViewProjectionMatrix",    glUniformBlock.Precision.MEDIUMP, glMatrix4x4f.identityMatrix());
    this.__standardUniformsBlock.glProjectionMatrix          = this.__standardUniformsBlock.createUniformMat4("glProjectionMatrix",             glUniformBlock.Precision.MEDIUMP, glMatrix4x4f.identityMatrix());
    this.__standardUniformsBlock.glModelViewMatrix           = this.__standardUniformsBlock.createUniformMat4("glModelViewMatrix",              glUniformBlock.Precision.MEDIUMP, glMatrix4x4f.identityMatrix());
    this.__standardUniformsBlock.glNormalMatrix              = this.__standardUniformsBlock.createUniformMat3("glNormalMatrix",                 glUniformBlock.Precision.MEDIUMP, glMatrix4x4f.identityMatrix());
    this.__standardUniformsBlock.glTime                      = this.__standardUniformsBlock.createUniformFloat("glTime",                        glUniformBlock.Precision.MEDIUMP, 0.0);
    this.__standardUniformsBlock.glIsAnimationActive         = this.__standardUniformsBlock.createUniformInt("glIsAnimationActive",             glUniformBlock.Precision.LOWP,    0);
    this.__standardUniformsBlock._glTextureDataDescriptors   = this.__standardUniformsBlock.createUniformArrayVec4("_glTextureDataDescriptors", glUniformBlock.Precision.MEDIUMP, maxTextureUnits, null);
    
    this.__animationUniformsBlock.glAnimationMatricesCurrentFrame = this.__animationUniformsBlock.createUniformArrayMat4("glAnimationMatricesCurrentFrame", glUniformBlock.Precision.MEDIUMP, 256, null);
    this.__animationUniformsBlock.glAnimationMatricesLastFrame    = this.__animationUniformsBlock.createUniformArrayMat4("glAnimationMatricesLastFrame",    glUniformBlock.Precision.MEDIUMP, 256, null);
    this.__animationUniformsBlock.glBonesMatricesCurrentFrame     = this.__animationUniformsBlock.createUniformArrayMat4("glBonesMatricesCurrentFrame",     glUniformBlock.Precision.MEDIUMP, 256, null);
    this.__animationUniformsBlock.glBonesMatricesLastFrame        = this.__animationUniformsBlock.createUniformArrayMat4("glBonesMatricesLastFrame",        glUniformBlock.Precision.MEDIUMP, 256, null);
    
    this.__standardUniformsBlock.bind((this.__standardUniformsBlockUnitID   = -1));
    this.__animationUniformsBlock.bind((this.__animationUniformsBlockUnitID = -2));

    if(!this.__standardUniformsBlock.empty())  this.__appendShadingHeader(this.__standardUniformsBlock.getShaderSource());
    if(!this.__animationUniformsBlock.empty()) this.__appendShadingHeader(this.__animationUniformsBlock.getShaderSource());

    this.__appendShadingHeader("#ifdef GLES_VERTEX_SHADER                                                                                                                  \n" +
                               "                                                                                                                                           \n" +
                               "in highp   vec3  glVertex;                                                                                                                 \n" +
                               "in mediump vec3  glNormal;                                                                                                                 \n" +
                               "in mediump vec2  glTexCoord;                                                                                                               \n" +
                               "in lowp    vec4  glBonesWeights;                                                                                                           \n" +
                               "in lowp    uvec4 glBonesIndices;                                                                                                           \n" +
                               "in lowp    uint  glAnimationMatrixID;                                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "mat4 _glAnimationMatrixCurrentFrame = mat4(1.0);                                                                                           \n" +
                               "bool _glAnimationMatrixCurrentFrame_isSet = false;                                                                                         \n" +
                               "mat3 _glAnimationNormalMatrixCurrentFrame = mat3(1.0);                                                                                     \n" +
                               "bool _glAnimationNormalMatrixCurrentFrame_isSet = false;                                                                                   \n" +
                               "vec3 _glAnimationVertexCurrentFrame = vec3(0.0);                                                                                           \n" +
                               "bool _glAnimationVertexCurrentFrame_isSet = false;                                                                                         \n" +
                               "vec3 _glAnimationNormalCurrentFrame = vec3(0.0);                                                                                           \n" +
                               "bool _glAnimationNormalCurrentFrame_isSet = false;                                                                                         \n" +
                               "                                                                                                                                           \n" +
                               "mat4 _glAnimationMatrixLastFrame = mat4(1.0);                                                                                              \n" +
                               "bool _glAnimationMatrixLastFrame_isSet = false;                                                                                            \n" +
                               "mat3 _glAnimationNormalMatrixLastFrame = mat3(1.0);                                                                                        \n" +
                               "bool _glAnimationNormalMatrixLastFrame_isSet = false;                                                                                      \n" +
                               "vec3 _glAnimationVertexLastFrame = vec3(0.0);                                                                                              \n" +
                               "bool _glAnimationVertexLastFrame_isSet = false;                                                                                            \n" +
                               "vec3 _glAnimationNormalLastFrame = vec3(0.0);                                                                                              \n" +
                               "bool _glAnimationNormalLastFrame_isSet = false;                                                                                            \n" +
                               "                                                                                                                                           \n" +
                               "#define glIsAnimationActive (glIsAnimationActive > 0)                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "mat4 glGetCurrentFrameAnimationMatrix()                                                                                                    \n" +
                               "{                                                                                                                                          \n" +
                               "    if(!_glAnimationMatrixCurrentFrame_isSet)                                                                                              \n" +
                               "    {                                                                                                                                      \n" +
                               "        if(glIsAnimationActive)                                                                                                            \n" +
                               "        {                                                                                                                                  \n" +
                               "            if(glAnimationMatrixID < 255u) _glAnimationMatrixCurrentFrame *= glAnimationMatricesCurrentFrame[glAnimationMatrixID];         \n" +
                               "                                                                                                                                           \n" +
                               "            if(glBonesIndices.x < 255u)                                                                                                    \n" +
                               "            {                                                                                                                              \n" +
                               "                mat4 skinMatrix = glBonesWeights.x * glBonesMatricesCurrentFrame[glBonesIndices.x] +                                       \n" +
                               "                                  glBonesWeights.y * glBonesMatricesCurrentFrame[glBonesIndices.y] +                                       \n" +
                               "                                  glBonesWeights.z * glBonesMatricesCurrentFrame[glBonesIndices.z] +                                       \n" +
                               "                                  glBonesWeights.w * glBonesMatricesCurrentFrame[glBonesIndices.w];                                        \n" +
                               "                                                                                                                                           \n" +
                               "                _glAnimationMatrixCurrentFrame *= skinMatrix;                                                                              \n" +
                               "            }                                                                                                                              \n" +
                               "        }                                                                                                                                  \n" +
                               "                                                                                                                                           \n" +
                               "        _glAnimationMatrixCurrentFrame_isSet = true;                                                                                       \n" +
                               "    }                                                                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "    return _glAnimationMatrixCurrentFrame;                                                                                                 \n" +
                               "}                                                                                                                                          \n" +
                               "                                                                                                                                           \n" +
                               "mat4 glGetLastFrameAnimationMatrix()                                                                                                       \n" +
                               "{                                                                                                                                          \n" +
                               "    if(!_glAnimationMatrixLastFrame_isSet)                                                                                                 \n" +
                               "    {                                                                                                                                      \n" +
                               "        if(glIsAnimationActive)                                                                                                            \n" +
                               "        {                                                                                                                                  \n" +
                               "            if(glAnimationMatrixID < 255u) _glAnimationMatrixLastFrame *= glAnimationMatricesLastFrame[glAnimationMatrixID];               \n" +
                               "                                                                                                                                           \n" +
                               "            if(glBonesIndices.x < 255u)                                                                                                    \n" +
                               "            {                                                                                                                              \n" +
                               "                mat4 skinMatrix = glBonesWeights.x * glBonesMatricesLastFrame[glBonesIndices.x] +                                          \n" +
                               "                                  glBonesWeights.y * glBonesMatricesLastFrame[glBonesIndices.y] +                                          \n" +
                               "                                  glBonesWeights.z * glBonesMatricesLastFrame[glBonesIndices.z] +                                          \n" +
                               "                                  glBonesWeights.w * glBonesMatricesLastFrame[glBonesIndices.w];                                           \n" +
                               "                                                                                                                                           \n" +
                               "                _glAnimationMatrixLastFrame *= skinMatrix;                                                                                 \n" +
                               "            }                                                                                                                              \n" +
                               "        }                                                                                                                                  \n" +
                               "                                                                                                                                           \n" +
                               "        _glAnimationMatrixLastFrame_isSet = true;                                                                                          \n" +
                               "    }                                                                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "    return _glAnimationMatrixLastFrame;                                                                                                    \n" +
                               "}                                                                                                                                          \n" +
                               "                                                                                                                                           \n" +
                               "mat3 glGetCurrentFrameAnimationNormalMatrix()                                                                                              \n" +
                               "{                                                                                                                                          \n" +
                               "    if(!_glAnimationNormalMatrixCurrentFrame_isSet)                                                                                        \n" +
                               "    {                                                                                                                                      \n" +
                               "        _glAnimationNormalMatrixCurrentFrame = mat3(inverse(transpose(glGetCurrentFrameAnimationMatrix())));                               \n" +
                               "        _glAnimationNormalMatrixCurrentFrame_isSet = true;                                                                                 \n" +
                               "    }                                                                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "    return _glAnimationNormalMatrixCurrentFrame;                                                                                           \n" +
                               "}                                                                                                                                          \n" +
                               "                                                                                                                                           \n" +
                               "mat3 glGetLastFrameAnimationNormalMatrix()                                                                                                 \n" +
                               "{                                                                                                                                          \n" +
                               "    if(!_glAnimationNormalMatrixLastFrame_isSet)                                                                                           \n" +
                               "    {                                                                                                                                      \n" +
                               "        _glAnimationNormalMatrixLastFrame = mat3(inverse(transpose(glGetLastFrameAnimationMatrix())));                                     \n" +
                               "        _glAnimationNormalMatrixLastFrame_isSet = true;                                                                                    \n" +
                               "    }                                                                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "    return _glAnimationNormalMatrixLastFrame;                                                                                              \n" +
                               "}                                                                                                                                          \n" +
                               "                                                                                                                                           \n" +
                               "vec3 glGetCurrentFrameAnimatedVertex()                                                                                                     \n" +
                               "{                                                                                                                                          \n" +
                               "    if(!_glAnimationVertexCurrentFrame_isSet)                                                                                              \n" +
                               "    {                                                                                                                                      \n" +
                               "        _glAnimationVertexCurrentFrame = (glGetCurrentFrameAnimationMatrix() * vec4(glVertex, 1.0)).xyz;                                   \n" +
                               "        _glAnimationVertexCurrentFrame_isSet = true;                                                                                       \n" +
                               "    }                                                                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "    return _glAnimationVertexCurrentFrame;                                                                                                 \n" +
                               "}                                                                                                                                          \n" +
                               "                                                                                                                                           \n" +
                               "vec3 glGetLastFrameAnimatedVertex()                                                                                                        \n" +
                               "{                                                                                                                                          \n" +
                               "    if(!_glAnimationVertexLastFrame_isSet)                                                                                                 \n" +
                               "    {                                                                                                                                      \n" +
                               "        _glAnimationVertexLastFrame = (glGetLastFrameAnimationMatrix() * vec4(glVertex, 1.0)).xyz;                                         \n" +
                               "        _glAnimationVertexLastFrame_isSet = true;                                                                                          \n" +
                               "    }                                                                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "    return _glAnimationVertexLastFrame;                                                                                                    \n" +
                               "}                                                                                                                                          \n" +
                               "                                                                                                                                           \n" +
                               "vec3 glGetCurrentFrameAnimatedNormal()                                                                                                     \n" +
                               "{                                                                                                                                          \n" +
                               "    if(!_glAnimationNormalCurrentFrame_isSet)                                                                                              \n" +
                               "    {                                                                                                                                      \n" +
                               "        _glAnimationNormalCurrentFrame = normalize(glGetCurrentFrameAnimationNormalMatrix() * glNormal);                                   \n" +
                               "        _glAnimationNormalCurrentFrame_isSet = true;                                                                                       \n" +
                               "    }                                                                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "    return _glAnimationNormalCurrentFrame;                                                                                                 \n" +
                               "}                                                                                                                                          \n" +
                               "                                                                                                                                           \n" +
                               "vec3 glGetLastFrameAnimatedNormal()                                                                                                        \n" +
                               "{                                                                                                                                          \n" +
                               "    if(!_glAnimationNormalLastFrame_isSet)                                                                                                 \n" +
                               "    {                                                                                                                                      \n" +
                               "        _glAnimationNormalLastFrame = normalize(glGetLastFrameAnimationNormalMatrix() * glNormal);                                         \n" +
                               "        _glAnimationNormalLastFrame_isSet = true;                                                                                          \n" +
                               "    }                                                                                                                                      \n" +
                               "                                                                                                                                           \n" +
                               "    return _glAnimationNormalLastFrame;                                                                                                    \n" +
                               "}                                                                                                                                          \n" +
                               "                                                                                                                                           \n" +
                               "#define glAnimatedVertex          glGetCurrentFrameAnimatedVertex()                                                                        \n" +
                               "#define glAnimatedNormal          glGetCurrentFrameAnimatedNormal()                                                                        \n" +
                               "#define glLastFrameAnimatedVertex glGetLastFrameAnimatedVertex()                                                                           \n" +
                               "#define glLastFrameAnimatedNormal glGetLastFrameAnimatedNormal()                                                                           \n" +
                               "                                                                                                                                           \n" +
                               "#endif                                                                                                                                     \n");

    this.__appendShadingHeader("struct samplerData                                                                                                                                                                                                                                                          " +
                               "{                                                                                                                                                                                       \n" +
                               "   highp sampler2D sampler;                                                                                                                                                             \n" +
                               "   lowp int unitID;                                                                                                                                                                     \n" +
                               "};                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               "highp vec4 textureData(in samplerData s, in int invocationID, in int outputID)                                                                                                          \n" +
                               "{                                                                                                                                                                                       \n" +
                               "   ivec2 bufferSize = textureSize(s.sampler, 0);                                                                                                                                        \n" +
                               "   ivec4 descriptor = ivec4(_glTextureDataDescriptors[s.unitID]);                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "   int localSize = descriptor.y;                                                                                                                                                        \n" +
                               "   int workGroupSize = descriptor.z;                                                                                                                                                    \n" +
                               "   int workGroupSizeSquared = descriptor.w;                                                                                                                                             \n" +
                               "                                                                                                                                                                                        \n" +
                               "   int workGroupID = int(floor(float(invocationID) / float(workGroupSize)));                                                                                                            \n" +
                               "   int localOutputID = (invocationID % workGroupSize) * localSize + outputID;                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "   ivec2 dataCoord = ivec2((workGroupID * workGroupSizeSquared) % bufferSize.x, float(workGroupSizeSquared) * floor(float(workGroupID * workGroupSizeSquared) / float(bufferSize.x)));  \n" +
                               "   dataCoord += ivec2(localOutputID % workGroupSizeSquared, floor(float(localOutputID) / float(workGroupSizeSquared)));                                                                 \n" +
                               "                                                                                                                                                                                        \n" +
                               "   return texelFetch(s.sampler, dataCoord, 0);                                                                                                                                          \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "highp int textureDataSize(in samplerData s) {                                                                                                                                           \n" +
                               "    return int(_glTextureDataDescriptors[s.unitID].x);                                                                                                                                  \n" +
                               "}                                                                                                                                                                                       \n");
    
    this.__appendShadingHeader("mediump vec4 textureRadiance(in sampler2D environmentMap, in vec3 n, in float roughness)                       \n" +
                               "{                                                                                                              \n" +
                               "    mediump ivec2 size = textureSize(environmentMap, 0);                                                       \n" +
                               "                                                                                                               \n" +
                               "    mediump float mipLevels = (1.0 + floor(log2(float(max(size.x, size.y)))));                                 \n" +
                               "    mediump float radianceLUT_mipID = mipLevels - 10.0; // 512x LOD                                            \n" +
                               "                                                                                                               \n" +
                               "    const mediump float texelSize = (0.25 / 128.0);                                                            \n" +
                               "    mediump vec2 uv = vec2(atan(n.z, n.x) * 0.1591 + 0.5, asin(n.y) * 0.3183 + 0.5);                           \n" +
                               "                                                                                                               \n" +
                               "    mediump vec2 uv_lut = mix(vec2(0.0 + texelSize), vec2(0.25) - 0.5 * texelSize, uv);                        \n" +
                               "                                                                                                               \n" +
                               "    mediump int mapID_base = int(floor(15.0 * roughness));                                                     \n" +
                               "    mediump int mapID_next = int(ceil(15.0 * roughness));                                                      \n" +
                               "                                                                                                               \n" +
                               "    mediump vec2 uv_base = uv_lut + vec2(0.25 * float(mapID_base % 4), 0.25 * floor(float(mapID_base) / 4.0)); \n" +
                               "    mediump vec2 uv_next = uv_lut + vec2(0.25 * float(mapID_next % 4), 0.25 * floor(float(mapID_next) / 4.0)); \n" +
                               "                                                                                                               \n" +
                               "    mediump vec4 base = textureLod(environmentMap, uv_base, radianceLUT_mipID);                                \n" +
                               "    mediump vec4 next = textureLod(environmentMap, uv_next, radianceLUT_mipID);                                \n" +
                               "                                                                                                               \n" +
                               "    mediump float roughnessSquared = roughness * roughness;                                                    \n" +
                               "                                                                                                               \n" +
                               "    mediump vec4 radiance = mix(base, next, mod(roughness * 15.0, 1.0));                                       \n" +
                               "    radiance = mix(textureLod(environmentMap, uv, 0.0), radiance, smoothstep(0.01, 0.0625, roughnessSquared)); \n" +        
                               "                                                                                                               \n" +
                               "    return radiance;                                                                                           \n" +
                               "}                                                                                                              \n" +
                               "                                                                                                               \n" +
                               "mediump vec4 textureIrradiance(in sampler2D environmentMap, in vec3 n)                                         \n" +
                               "{                                                                                                              \n" +
                               "    mediump ivec2 size = textureSize(environmentMap, 0);                                                       \n" +
                               "                                                                                                               \n" +
                               "    mediump float mipLevels = (1.0 + floor(log2(float(max(size.x, size.y)))));                                 \n" +
                               "    mediump float radianceLUT_mipID = mipLevels - 10.0; // 512x LOD                                            \n" +
                               "                                                                                                               \n" +
                               "    const mediump float texelSize = (0.25 / 128.0);                                                            \n" +
                               "    mediump vec2 uv = vec2(atan(n.z, n.x) * 0.1591 + 0.5, asin(n.y) * 0.3183 + 0.5);                           \n" +
                               "                                                                                                               \n" +
                               "    mediump vec2 uv_lut = mix(vec2(0.0 + texelSize), vec2(0.25) - 0.5 * texelSize, uv) + vec2(0.75);           \n" +
                               "    mediump vec4 irradiance = textureLod(environmentMap, uv_lut, radianceLUT_mipID);                           \n" +
                               "                                                                                                               \n" +
                               "    return irradiance;                                                                                         \n" +
                               "}                                                                                                              \n");
}

glContext.__reservedUniformBlockUnits = 2;

glContext.__positionAttribLocation          = 0;
glContext.__texCoordAttribLocation          = 1;
glContext.__normalAttribLocation            = 2;
glContext.__bonesIndicesAttribLocation      = 3;
glContext.__bonesWeightsAttribLocation      = 4;
glContext.__animationMatrixIDAttribLocation = 5;

glContext.__getRootPath = function()
{
    let parts = document.location.href.split('/');
    parts[parts.length - 1] = '';
  
    return parts.join('/');
}

glContext.prototype.createProgram = function(vertexSrcUrl, fragmentSrcUrl, onLoad)
{
    let self = this;
    let program = new glProgram(this);

    this.__pendingAssets.push();
    program.loadAsync(vertexSrcUrl, fragmentSrcUrl, function(program, didCompile, error)
    {
        self.__pendingAssets.pop();
        if(onLoad != null) onLoad(program, didCompile, error);    
    });

    return program;
}

glContext.__prepareImageForTexturing = function(image, onLoad)
{
    let canvas = document.createElement('canvas');
    
    let canvasCtx = canvas.getContext('2d', {alpha: true});
    canvasCtx.imageSmoothingEnabled = false;

    canvas.width  = image.width  = Math.min(closestPot(image.width),  4096);
    canvas.height = image.height = Math.min(closestPot(image.height), 4096);

    canvasCtx.translate(0, canvas.height);
    canvasCtx.scale(1.0, -1.0);
                
    canvasCtx.drawImage(image, 0, 0, canvas.width, canvas.height);

    dispatchAsync( function() {
        onLoad(canvasCtx.getImageData(0, 0, canvas.width, canvas.height)); 
    });   
}

glContext.prototype.loadFile = function(path, type, onLoad)
{
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

    if(isRelativePath(path)) path = glContext.__getRootPath() + path;

    let fileLoader = new Task(null, function(params)
    {
        let request = new XMLHttpRequest();

        request.onload = function() { 
            finish(this.response);
        };

        request.onerror = function()
        {
            console.warn("Failed to load file \"" + params.path + "\"");    
            finish(null);
        }
        
        request.open("GET", params.path, true);
        request.responseType = params.type;
 
        request.send();
    });

    fileLoader.onFinish(onLoad);

    fileLoader.run({path: path, type: type});
}

glContext.prototype.loadImage = function(path, onLoad)
{
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

    if(isRelativePath(path)) path = glContext.__getRootPath() + path;

    let imgLoader = new Task(null, function(path)
    {
        let request = new XMLHttpRequest();

        request.open("GET", path, true);
        request.responseType = "arraybuffer";

        request.onload = function(e)
        { 
            let blob = new Blob([new Uint8Array(e.target.response)]);
            createImageBitmap(blob).then( function(image)
            {
                finish(image);
                image.close();
            });
        };
        
        request.send();
    });

    imgLoader.onFinish(onLoad);

    imgLoader.run(path);
}

glContext.prototype.loadObjFileFromMemory = function(fileData, onLoad)
{
    let objLoader = new Task([ HawkGL_SDK_relativePath + "K3D.js",
                               HawkGL_SDK_relativePath + "gl/glPrimitive.js",  
                               HawkGL_SDK_relativePath + "gl/glMesh.js", 
                               HawkGL_SDK_relativePath + "gl/glVertex.js",
                               HawkGL_SDK_relativePath + "gl/glVector2f.js",
                               HawkGL_SDK_relativePath + "gl/glVector3f.js",
                               HawkGL_SDK_relativePath + "gl/glVector4f.js" ], 
                               
    function(fileData)
    {
        let modelData = K3D.parse.fromOBJ(fileData);

        let vertexBuffer = ((modelData.c_verts != null) ? modelData.c_verts : []);
        let normalBuffer = ((modelData.c_norms != null) ? modelData.c_norms : []);
        let uvBuffer     = ((modelData.c_uvt   != null) ? modelData.c_uvt   : []);

        let vertexIndexBuffer = ((modelData.i_verts != null) ? modelData.i_verts : []);
        let normalIndexBuffer = ((modelData.i_norms != null) ? modelData.i_norms : []);
        let uvIndexBuffer     = ((modelData.i_uvt   != null) ? modelData.i_uvt   : []);
        
        let nVertices = modelData.i_verts.length;
        let vertices = new Array(nVertices);

        for(let i = 0; i < nVertices; ++i)
        {
            let vertex = vertices[i] = new glVertex();

            vertex.position.x = vertexBuffer[vertexIndexBuffer[i] * 3 + 0];
            vertex.position.y = vertexBuffer[vertexIndexBuffer[i] * 3 + 1];
            vertex.position.z = vertexBuffer[vertexIndexBuffer[i] * 3 + 2];

            vertex.normal.x = normalBuffer[normalIndexBuffer[i] * 3 + 0];
            vertex.normal.y = normalBuffer[normalIndexBuffer[i] * 3 + 1];
            vertex.normal.z = normalBuffer[normalIndexBuffer[i] * 3 + 2];

            vertex.texCoord.x = uvBuffer[uvIndexBuffer[i] * 2 + 0];
            vertex.texCoord.y = 1.0 - uvBuffer[uvIndexBuffer[i] * 2 + 1];
        }
        
        let groups = new Map();
        
        Object.keys(modelData.groups).forEach(key =>
        {
            let groupName = key;
            let groupIndices = modelData.groups[key];

            let groupVertices = groups.get(groupName);
            if(groupVertices == null) groupVertices = [];

            groups.set(groupName, groupVertices.concat(vertices.slice(groupIndices.from, groupIndices.to)));
        });

        finish(groups);
    });

    let self = this;
    objLoader.onFinish( function(groups)
    {
        groups.forEach( function(groupVertices, groupName) {
            groups.set(groupName, new glMesh(self, groupVertices));
        });

        onLoad(groups);
    });

    objLoader.run(fileData);
}

glContext.prototype.loadObjFile = function(path, onLoad)
{
    let self = this;
    this.__pendingAssets.push();

    this.loadFile(path, "arraybuffer", function(fileData)
    {
        if(fileData == null) 
        {
            self.__pendingAssets.pop();
            if(onLoad != null) onLoad(null);

            return;
        }

        self.loadObjFileFromMemory(fileData, function(groups)
        {
            if(onLoad != null) onLoad(groups);
            self.__pendingAssets.pop();
        });
    });
}

glContext.prototype.createMeshFromObjFile = function(path, onLoad)
{
    let self = this;

    let mesh = new glMesh(this);
    mesh.__ready = false;

    this.loadObjFile(path, function(groups)
    {
        mesh.clear();
        groups.forEach( function(groupMesh, groupName) {
            mesh.add(groupMesh);
        });

        mesh.__ready = true;
        
        if(onLoad != null) onLoad(mesh);
    });

    return mesh;
}

glContext.prototype.loadGltfFileFromMemory = function(gltf, bufferLoaderCallback, textureLoaderCallback, onLoadCallback)
{
    let self = this;

    let scene = [];
    let loader = new glTFLoader();
    
    loader.parseGLTF(gltf, bufferLoaderCallback, textureLoaderCallback, function(groups, animator, gltf)
    {
        for(let i = 0, e = groups.length; i != e; ++i)
        {
            groups[i].mesh = new glMesh(self, groups[i].mesh);
            scene.push(groups[i]);
        }
        
        if(animator != null) animator.__ctx = self;

        if(onLoadCallback != null) onLoadCallback(scene, animator, gltf);
    });

    return scene;
}

glContext.prototype.loadGltfFile = function(path, onLoadCallback)
{
    let scene = [];

    let self = this;
    self.__pendingAssets.push();

    this.loadFile(path, "json", function(fileData)
    {
        if(fileData == null) 
        {
            self.__pendingAssets.pop();
            if(onLoadCallback != null) onLoadCallback(null, null, null);

            return;
        }

        var basePath = '';
        let i = path.lastIndexOf('/');
        if(i >= 0) basePath = path.substring(0, i + 1);

        self.loadGltfFileFromMemory(fileData, function(bufferPath, resolve) {
            self.loadFile((basePath + bufferPath), "arraybuffer", resolve);
        },  
        function(texturePath, resolve) {
            self.createTexture(basePath + texturePath, resolve);    
        }, 
        function(groups, animator, gltf)
        {
            for(let i = 0, e = groups.length; i != e; ++i) scene.push(groups[i]);
            self.__pendingAssets.pop();
            
            if(onLoadCallback != null) onLoadCallback(scene, animator, gltf);
        });
    });

    return scene;
}

glContext.prototype.createTexture = function(image, onLoad, customWidth, customHeight)
{
    let self = this;
    let gl = this.getGL();

    let texture = new glTextureRGBA8(this, 1, 1, new Uint8Array([255, 255, 255, 0]));
    texture.__ready = false;
    
    function setTextureFromImage(texture, image, onLoad)
    { 
        self.__pendingAssets.push();

        if(customWidth  != null) image.width  = customWidth;
        if(customHeight != null) image.height = customHeight;
        
        glContext.__prepareImageForTexturing(image, function(image)
        {
            texture.set(image.width, image.height, image);
        
            texture.setWrapMode(gl.REPEAT);
            texture.generateMipmap(true);
            texture.__ready = true;
            
            self.__pendingAssets.pop();

            if(onLoad != null) onLoad(texture, image);
        });
    }
       
    if(typeof image === "string" || image instanceof String)
    {
        if(image.startsWith("data:image"))
        {
            let imageBase64 = image;
            image = new Image();      
                     
            image.onload = function() {
                setTextureFromImage(texture, image, onLoad);
            };
            
            image.src = imageBase64;  
        }
        else
        {
            let imageUrl = image;
            
            this.loadImage(imageUrl, function(image) {
                setTextureFromImage(texture, image, onLoad);
            });
        }

    } else setTextureFromImage(texture, image, onLoad);
    
    return texture;
}

glContext.prototype.createEnvironmentMap = function(image, onLoad, customWidth, customHeight)
{
    let environmentMap = new glEnvironmentMap(this, this.createTexture(image, function()
    {
        environmentMap.update();
        environmentMap.updateRadiance();

        if(onLoad != null) onLoad(environmentMap);

    }, customWidth, customHeight ));

    return environmentMap;
}

glContext.prototype.getTextureMaxAnisotropy = function()
{
    if(this.__maxAnisotropyLevel == null && this.__extensions.anisotropicFilter != null) 
        this.__maxAnisotropyLevel = this.getGL().getParameter(this.__extensions.anisotropicFilter.MAX_TEXTURE_MAX_ANISOTROPY_EXT);

    return this.__maxAnisotropyLevel;
}

glContext.prototype.getMaxSamplesMSAA = function()
{
    if(this.__maxSamplesMSAA == null) this.__maxSamplesMSAA = this.getGL().getParameter(this.getGL().MAX_SAMPLES);

    return this.__maxSamplesMSAA;
}

glContext.prototype.getMaxPointSize = function()
{
    if(this.__maxPointSize == null) this.__maxPointSize = this.getGL().getParameter(this.getGL().ALIASED_POINT_SIZE_RANGE)[1];
    
    return this.__maxPointSize;
}

glContext.prototype.__bindProgramStandardAttributes = function(programID)
{
    let gl = this.getGL();

    gl.bindAttribLocation(programID, glContext.__positionAttribLocation,          "glVertex");
    gl.bindAttribLocation(programID, glContext.__texCoordAttribLocation,          "glTexCoord");
    gl.bindAttribLocation(programID, glContext.__normalAttribLocation,            "glNormal");
    gl.bindAttribLocation(programID, glContext.__bonesIndicesAttribLocation,      "glBonesIndices");
    gl.bindAttribLocation(programID, glContext.__bonesWeightsAttribLocation,      "glBonesWeights");
    gl.bindAttribLocation(programID, glContext.__animationMatrixIDAttribLocation, "glAnimationMatrixID");
}

glContext.prototype.__bindProgramStandardUniformsBlock = function(program)
{
    program.createUniformBlock(this.__standardUniformsBlock.getName(),  this.__standardUniformsBlockUnitID);
    program.createUniformBlock(this.__animationUniformsBlock.getName(), this.__animationUniformsBlockUnitID);
}

glContext.prototype.__appendShadingHeader = function(source)
{
    if(this.__shadingGlobalConstantsLineCount <= 0) source = "\n" + source;
    source += "\n";
   
    for(let i = 0, e = source.length; i != e; ++i) if(source[i] == '\n') ++this.__shadingGlobalConstantsLineCount;
    this.__shadingGlobalConstants += source;
}

glContext.__requestAnimationFrame = function(functor) {
    return ((window.requestAnimationFrame != null) ? window.requestAnimationFrame(functor) : setTimeout(functor, (1000.0 / 60.0)));
}

glContext.__cancelAnimationFrame = function(requestID)
{
    if(window.cancelAnimationFrame != null) window.cancelAnimationFrame(requestID)
    else clearTimeout(requestID);
}

glContext.prototype.run = function()
{
    if(!this.isRunning())
    {
        let self = this;
        let gl = this.getGL();
    
        this.__inputDeviceManager.enable();

        if(!this.__initialized)
        {
            this.__timeElapsed = 0.0;
            this.__initialized = true;
            
            if(this.__onInitCallback != null) this.__onInitCallback(gl);
        }

        function animationLoop()
        {
            self.__animationFrameRequestID = glContext.__requestAnimationFrame(animationLoop);

            let targetWidth  = self.__canvas.clientWidth;
            let targetHeight = self.__canvas.clientHeight;

            if(self.__streamCapturing)
            {
                targetWidth  = self.__streamCapturingWidth;
                targetHeight = self.__streamCapturingHeight;
            }

            if((self.__contextWidth != targetWidth) || (self.__contextHeight != targetHeight))
            {
                self.__contextWidth  = self.__canvas.width  = targetWidth;
                self.__contextHeight = self.__canvas.height = targetHeight;
       
                if(self.__onResizeCallback != null) self.__onResizeCallback(gl, self.__contextWidth, self.__contextHeight);
            }

            let currentTick = performance.now();
            let dt = ((self.__lastTick != null) ? ((currentTick - self.__lastTick) * 0.001) : 0.0);
            if(self.__streamCapturing) dt = (1.0 / self.__streamCaptureFramerate);        
            self.__standardUniformsBlock.glTime.set((self.__timeElapsed += dt));
            self.__lastTick = currentTick;
            
            if(self.__onFrameUpdateCallback != null) self.__onFrameUpdateCallback(gl, dt, self.__timeElapsed);
            
            let shouldCaptureWithAlphaChannel    = (self.__streamCapturing &&  self.__streamCaptureWithAlpha);
            let shouldCaptureWithoutAlphaChannel = (self.__streamCapturing && !self.__streamCaptureWithAlpha);

            if(shouldCaptureWithAlphaChannel) self.__streamCapture.capture(self.__canvas);

            self.unbindFramebuffer();
            gl.colorMask(false, false, false, true);
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.colorMask(true, true, true, true);
        
            if(shouldCaptureWithoutAlphaChannel) self.__streamCapture.capture(self.__canvas);

            self.__fpsCounter.update();  
        };
                                     
        dispatchAsync(animationLoop);
    }
}

glContext.prototype.pause = function()
{
    if(this.isRunning())
    {
        glContext.__cancelAnimationFrame(this.__animationFrameRequestID);
        this.__inputDeviceManager.disable();
        
        this.__animationFrameRequestID = null;
        this.__lastTick = null;
    }
}

glContext.prototype.stop = function()
{
    this.pause();
    this.__initialized = false;
}

glContext.prototype.restart = function()
{
    this.stop();
    this.run();
}

glContext.prototype.startCaptureSession = function(capturingFormat, width, height, framerate, quality)
{
    if(capturingFormat == null) capturingFormat = "webm";
    if(capturingFormat == "webm")
    {
        let webmCaptureSupported = (this.__canvas.toDataURL("image/webp").substr(5, 10) == "image/webp");
        if(!webmCaptureSupported) capturingFormat = "webm-mediarecorder";
    }

    switch(capturingFormat)
    {
        case "jpg":
        {
            this.__streamCaptureExtension = ".tar";
            this.__streamCaptureMIME = "image/jpg";
            this.__streamCaptureWithAlpha = false;

        } break;

        case "png":
        {
            this.__streamCaptureExtension = ".tar";
            this.__streamCaptureMIME = "image/png";
            this.__streamCaptureWithAlpha = true;

        } break;

        case "gif":
        {
            this.__streamCaptureExtension = ".gif";
            this.__streamCaptureMIME = "image/gif";
            this.__streamCaptureWithAlpha = false;

        } break;

        case "webm":
        case "webm-mediarecorder":
        {
            this.__streamCaptureExtension = ".webm";
            this.__streamCaptureMIME = "video/webm";
            this.__streamCaptureWithAlpha = false;
            
        } break;
    }

    if(this.__streamCapturing)
    {
        this.__streamCapture.stop();

        this.__canvas.style.width  = this.__streamCapturingOrigStyleWidth;
        this.__canvas.style.height = this.__streamCapturingOrigStyleHeight;
    }
    
    quality = ((quality != null) ? Math.min(Math.max(quality, 0.0), 100.0) : 100.0);

    this.__streamCapturingWidth   = ((width     != null) ? width     : this.getWidth());
    this.__streamCapturingHeight  = ((height    != null) ? height    : this.getHeight());
    this.__streamCaptureFramerate = ((framerate != null) ? framerate : 60.0);
    
    this.__streamCapture = new CCapture({ quality: quality,
                                          format: capturingFormat, 
                                          framerate: this.__streamCaptureFramerate });
       
    this.run();

    this.__streamCapture.start();
    this.__streamCapturing = true;
}

glContext.prototype.endCaptureSession = function(fileName)
{
    if(this.__streamCapturing) 
    {
        let self = this;
        dispatchAsync( function()
        {
            self.__streamCapture.stop();
            self.__streamCapturing = false;

            self.__canvas.style.width  = self.__streamCapturingOrigStyleWidth;
            self.__canvas.style.height = self.__streamCapturingOrigStyleHeight;

            
            self.__pendingAssets.push();
            self.__streamCapture.save( function(blob)
            {
                self.__pendingAssets.pop();

                if(fileName == null) fileName = "capture";
                download(blob, fileName + self.__streamCaptureExtension, self.__streamCaptureMIME);
            });
        });
    }
}

glContext.prototype.getFps = function() {
    return this.__fpsCounter.getFps();
}

glContext.prototype.onAssetLoading = function(callback)
{
    this.__pendingAssets.onChange(((callback != null) ? function(meter) {
        callback(meter.rate(), meter.pending());
    } : null));
}

glContext.prototype.onFramerateUpdate = function(callback) {
    this.__fpsCounter.onFramerateUpdate(callback);
}

glContext.prototype.onFrameUpdate = function(callback) {
    this.__onFrameUpdateCallback = callback;
}

glContext.prototype.onResize = function(callback) {
    this.__onResizeCallback = callback;
}

glContext.prototype.onInit = function(callback) {
    this.__onInitCallback = callback;
}

glContext.prototype.isRunning = function() {
    return (this.__animationFrameRequestID != null);
}

glContext.prototype.getGL = function() {
    return this.__gl;
}

glContext.prototype.getTimeElapsed = function() {
    return this.__timeElapsed;
}

glContext.prototype.getWidth = function() {
    return Math.max(this.__contextWidth, 1);
}

glContext.prototype.getHeight = function() {
    return Math.max(this.__contextHeight, 1);
}

glContext.prototype.getClientWidth = function() {
    return Math.max(this.__canvas.clientWidth, 1);
}

glContext.prototype.getClientHeight = function() {
    return Math.max(this.__canvas.clientHeight, 1);
}

glContext.prototype.getAspectRatio = function() {
    return (this.getWidth() / this.getHeight());
}

glContext.prototype.setViewport = function(x, y, w, h)
{
    if(w == null && h == null)
    {
        w  = x;
        h = y;

        x = y = 0.0;
    }

    this.getGL().viewport(x, y, w, h);
}

glContext.prototype.getViewport = function()
{
    let viewport = this.__gl.getParameter(this.__gl.VIEWPORT);
    
    let rect = ((viewport != null) ?
    {
        x: viewport[0],
        y: viewport[1],
        w: viewport[2],
        h: viewport[3]
    } : 
    {
        x: 0,
        y: 0,
        w: 1,
        h: 1
    });

    return rect;
}

glContext.prototype.getActiveProgram = function() {
    return this.__activeProgram;
}

glContext.prototype.isProgramBound = function(program) {
    return (this.__activeProgram == program);
}

glContext.prototype.bindProgram = function(program)
{
    if(program != null && !program.ready()) program = null;
    if(!this.isProgramBound(program)) this.__gl.useProgram(((this.__activeProgram = program) != null) ? program.getProgramID() : null);
}

glContext.prototype.unbindProgram = function() {
    this.bindProgram(null);
}

glContext.prototype.__updateStandardUniforms = function()
{
    if(this.__shouldUpdateModelViewProjectionMatrix) this.__updateModelViewProjectionMatrix();
    if(this.__shouldUpdateNormalMatrix) this.__updateNormalMatrix();
    
    this.updateActiveAnimator();
}

glContext.prototype.updateActiveProgram = function()
{
    if(this.__activeProgram != null && this.__activeProgram.ready())
    {
        this.__updateStandardUniforms();
        this.__activeProgram.update();

        return true;
    }

    return false;
}

glContext.prototype.getActiveAnimator = function() {
    return this.__activeAnimator;
}

glContext.prototype.isAnimatorBound = function(animator) {
    return (this.__activeAnimator == animator);
}

glContext.prototype.bindAnimator = function(animator)
{
    if(!this.isAnimatorBound(animator))
    {
        this.__activeAnimator = animator;
        this.__standardUniformsBlock.glIsAnimationActive.set((animator != null));
    }
}

glContext.prototype.unbindAnimator = function() {
    this.bindAnimator(null);
}

glContext.prototype.updateActiveAnimator = function() {
    if(this.__activeAnimator != null) this.__activeAnimator.__updateContextAnimationMatrices();
}

glContext.prototype.bindVertexBuffer = function(buffer) {
    if(this.__activeBuffer != buffer) this.__gl.bindBuffer(this.__gl.ARRAY_BUFFER, (this.__activeBuffer = buffer));
}

glContext.prototype.isBufferBound = function(buffer) {
    return (this.__activeBuffer == buffer);
}

glContext.prototype.unbindVertexBuffer = function(buffer) {
    if(this.isBufferBound(buffer)) this.bindVertexBuffer(null);
}

glContext.prototype.bindIndexBuffer = function(buffer) {
    if(this.__activeIndexBuffer != buffer) this.__gl.bindBuffer(this.__gl.ELEMENT_ARRAY_BUFFER, (this.__activeIndexBuffer = buffer));
}

glContext.prototype.isIndexBufferBound = function(buffer) {
    return (this.__activeIndexBuffer == buffer);
}

glContext.prototype.unbindIndexBuffer = function(buffer) {
    if(this.isIndexBufferBound(buffer)) this.bindIndexBuffer(null);
}

glContext.prototype.bindVertexArray = function(vertexArray) {
    if(this.__activeVertexArray != vertexArray) this.__gl.bindVertexArray((this.__activeVertexArray = vertexArray));
}

glContext.prototype.unbindVertexArray = function() {
    this.bindVertexArray(null);
}

glContext.prototype.bindFramebuffer = function(framebuffer) {
    if(!this.isFramebufferBound(framebuffer)) this.__gl.bindFramebuffer(this.__gl.FRAMEBUFFER, (this.__activeFramebuffer = framebuffer));
}

glContext.prototype.unbindFramebuffer = function() {
    this.bindFramebuffer(null);
}

glContext.prototype.isFramebufferBound = function(framebuffer) {
    return (this.getActiveFramebuffer() == framebuffer);
}

glContext.prototype.getActiveFramebuffer = function() {
    return this.__activeFramebuffer;
}

glContext.prototype.bindRenderbuffer = function(renderbuffer) {
    if(!this.isRenderbufferBound(renderbuffer)) this.__gl.bindRenderbuffer(this.__gl.RENDERBUFFER, (this.__activeRenderbuffer = renderbuffer));
}

glContext.prototype.unbindRenderbuffer = function() {
    this.bindRenderbuffer(null);
}

glContext.prototype.isRenderbufferBound = function(renderbuffer) {
    return (this.getActiveRenderbuffer() == renderbuffer);
}

glContext.prototype.getActiveRenderbuffer = function() {
    return this.__activeRenderbuffer;
}

glContext.prototype.bindUniformBuffer = function(uniformBuffer) {
    this.__gl.bindBuffer(this.__gl.UNIFORM_BUFFER, (this.__activeUniformBuffer = uniformBuffer));
}

glContext.prototype.unbindUniformBuffer = function() {
    this.bindUniformBuffer(null);
}

glContext.prototype.getActiveUniformBuffer = function() {
    return this.__activeUniformBuffer;
}

glContext.prototype.getActiveUniformBlock = function(unitID) {
    return this.__activeUniformBlocks[unitID + glContext.__reservedUniformBlockUnits];
}

glContext.prototype.isUniformBlockBound = function(unitID, uniformBlock) {
    return (this.getActiveUniformBlock(unitID) == uniformBlock);
}

glContext.prototype.bindUniformBlock = function(unitID, uniformBlock) {
    if(!this.isUniformBlockBound(unitID, uniformBlock)) this.__gl.bindBufferBase(this.__gl.UNIFORM_BUFFER, unitID + glContext.__reservedUniformBlockUnits, (this.__activeUniformBlocks[unitID + glContext.__reservedUniformBlockUnits] = uniformBlock).__uniformBufferObject);
}

glContext.prototype.unbindUniformBlockUnit = function(unitID) {
    this.bindUniformBlock(unitID, null);
}

glContext.prototype.bindTextureUnit = function(unitID)
{
    if(unitID == null) unitID = 0;
    if(this.__activeTextureUnit != unitID) this.__gl.activeTexture(this.__gl.TEXTURE0 + (this.__activeTextureUnit = unitID));
}

glContext.prototype.unbindTextureUnit = function(unitID)
{
    this.bindTextureUnit(unitID);
    if(this.__activeTextures[unitID] != null) this.__gl.bindTexture(this.__gl.TEXTURE_2D, (this.__activeTextures[unitID] = null));
}

glContext.prototype.getActiveTexture = function(unitID) {
    return this.__activeTextures[((unitID != null) ? unitID : 0)];
}

glContext.prototype.isTextureBound = function(unitID, textureID) {
    return (this.getActiveTexture(unitID) == textureID);
}

glContext.prototype.bindTexture = function(unitID, textureID)
{
    this.bindTextureUnit(unitID);
    if(!this.isTextureBound(unitID, textureID)) this.__gl.bindTexture(this.__gl.TEXTURE_2D, (this.__activeTextures[unitID] = textureID));
}

glContext.prototype.unbindTexture = function(unitID, textureID) {
    if(this.isTextureBound(unitID, textureID)) this.unbindTextureUnit(unitID);
}

glContext.prototype.blitActiveTexture = function(unitID)
{
    if(this.__blitProgram == null)
    {
        this.__blitProgram = new glProgram(this, "#version 300 es                                                                                \n" +
        
                                                 "out mediump vec2 texCoords;                                                                    \n" +      
                                                 "const vec2 verticesCoords[] = vec2[](vec2(-1.0), vec2(1.0, -1.0), vec2(1.0), vec2(-1.0, 1.0)); \n" + 
                                                              
                                                 "void main()                                                                                    \n" +
                                                 "{                                                                                              \n" +      
                                                 "    gl_Position = vec4(verticesCoords[gl_VertexID], 0.0, 1.0);                                 \n" + 
                                                 "    texCoords = gl_Position.xy * 0.5 + vec2(0.5);	                                             \n" + 
                                                 "}                                                                                              \n",
                                                
                                                 "#version 300 es                                             \n" +

                                                 "uniform sampler2D targetTexture;                            \n" +
                                                 "in mediump vec2 texCoords;                                  \n" +
                                                 "out lowp vec4 glFragColor;                                  \n" +
                                                
                                                 "void main() {                                               \n" +      
                                                 "   glFragColor = textureLod(targetTexture, texCoords, 0.0); \n" + 
                                                 "}                                                           \n");

        this.__blitProgram.compile();
        this.__blitProgram.createUniformSampler("targetTexture", 0);
    }

    let gl = this.getGL();
    
    let lastActiveProgram = this.__activeProgram;
    let wasCullingEnabled = gl.isEnabled(gl.CULL_FACE);
    let wasDepthTestingEnabled = gl.isEnabled(gl.DEPTH_TEST);

    if(wasCullingEnabled) gl.disable(gl.CULL_FACE);
    if(wasDepthTestingEnabled) gl.disable(gl.DEPTH_TEST);
    
    this.__blitProgram.bind();
    this.__blitProgram.getUniform("targetTexture").set(unitID);
    
    this.updateActiveProgram();                                                  
    this.unbindVertexArray(); 
        
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        
    this.bindProgram(lastActiveProgram);

    if(wasDepthTestingEnabled) gl.enable(gl.DEPTH_TEST);
    if(wasCullingEnabled) gl.enable(gl.CULL_FACE);
}

glContext.prototype.loadIdentity = function()
{
    this.__modelViewMatrix.setIdentity();
    this.__standardUniformsBlock.glModelViewMatrix.set(this.__modelViewMatrix);

    this.__shouldUpdateModelViewProjectionMatrix = this.__shouldUpdateNormalMatrix = true;
}

glContext.prototype.loadMatrix = function(matrix)
{
    this.__modelViewMatrix.set(matrix);
    this.__standardUniformsBlock.glModelViewMatrix.set(this.__modelViewMatrix);
    
    this.__shouldUpdateModelViewProjectionMatrix = this.__shouldUpdateNormalMatrix = true;
}

glContext.prototype.mulMatrix = function(matrix)
{
    this.__modelViewMatrix.mul(matrix);
    this.__standardUniformsBlock.glModelViewMatrix.set(this.__modelViewMatrix);
    
    this.__shouldUpdateModelViewProjectionMatrix = this.__shouldUpdateNormalMatrix = true;
}

glContext.prototype.pushMatrix = function() {
    this.__modelViewMatrixStack.push(new glMatrix4x4f(this.__modelViewMatrix));
}

glContext.prototype.popMatrix = function()
{
    this.__modelViewMatrix.set(this.__modelViewMatrixStack.pop());
    this.__standardUniformsBlock.glModelViewMatrix.set(this.__modelViewMatrix);
    
    this.__shouldUpdateModelViewProjectionMatrix = this.__shouldUpdateNormalMatrix = true;
}

glContext.prototype.lookAt = function(eye, center, up) {
    this.loadMatrix(glMatrix4x4f.lookAtMatrix(eye, center, up));
}

glContext.prototype.translate = function(x, y, z) {
    this.mulMatrix(glMatrix4x4f.translationMatrix(x, y, z));
}

glContext.prototype.rotate = function(degrees, x, y, z) {
    this.mulMatrix(glMatrix4x4f.rotationMatrix(degrees, x, y, z));
}

glContext.prototype.scale = function(x, y, z) {
    this.mulMatrix(glMatrix4x4f.scaleMatrix(x, y, z));
}

glContext.prototype.setProjectionMatrix = function(matrix)
{
    this.__projectionMatrix.set(matrix);
    this.__standardUniformsBlock.glProjectionMatrix.set(this.__projectionMatrix);

    this.__shouldUpdateModelViewProjectionMatrix = true;
}

glContext.prototype.setPerspectiveProjection = function(fov, aspectRatio, zNear, zFar) {
    this.setProjectionMatrix(glMatrix4x4f.perspectiveProjectionMatrix(fov, aspectRatio, zNear, zFar));
}

glContext.prototype.setOrthographicProjection = function(left, right, bottom, top, near, far) {
    this.setProjectionMatrix(glMatrix4x4f.orthographicProjectionMatrix(left, right, bottom, top, near, far));
}

glContext.prototype.setShadowViewProjectionMatrix = function(lightVector, aabbCenter, aabbSize)
{
    this.setOrthographicProjection(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);
    this.lookAt(aabbCenter, glVector3f.add(aabbCenter, lightVector));
    
    let modelViewProjectionMatrix = this.getModelViewProjectionMatrix();
    
    let aabbHalfSize = glVector3f.mul(aabbSize, 0.5);
    let boundingBoxProjectedCorners = new Array(8);
    
    boundingBoxProjectedCorners[0] = modelViewProjectionMatrix.mul(glVector3f.add(aabbCenter, new glVector3f(+aabbHalfSize.x, +aabbHalfSize.y, +aabbHalfSize.z)));
    boundingBoxProjectedCorners[1] = modelViewProjectionMatrix.mul(glVector3f.add(aabbCenter, new glVector3f(+aabbHalfSize.x, +aabbHalfSize.y, -aabbHalfSize.z)));
    boundingBoxProjectedCorners[2] = modelViewProjectionMatrix.mul(glVector3f.add(aabbCenter, new glVector3f(+aabbHalfSize.x, -aabbHalfSize.y, +aabbHalfSize.z)));
    boundingBoxProjectedCorners[3] = modelViewProjectionMatrix.mul(glVector3f.add(aabbCenter, new glVector3f(+aabbHalfSize.x, -aabbHalfSize.y, -aabbHalfSize.z)));
    boundingBoxProjectedCorners[4] = modelViewProjectionMatrix.mul(glVector3f.add(aabbCenter, new glVector3f(-aabbHalfSize.x, +aabbHalfSize.y, +aabbHalfSize.z)));
    boundingBoxProjectedCorners[5] = modelViewProjectionMatrix.mul(glVector3f.add(aabbCenter, new glVector3f(-aabbHalfSize.x, +aabbHalfSize.y, -aabbHalfSize.z)));
    boundingBoxProjectedCorners[6] = modelViewProjectionMatrix.mul(glVector3f.add(aabbCenter, new glVector3f(-aabbHalfSize.x, -aabbHalfSize.y, +aabbHalfSize.z)));
    boundingBoxProjectedCorners[7] = modelViewProjectionMatrix.mul(glVector3f.add(aabbCenter, new glVector3f(-aabbHalfSize.x, -aabbHalfSize.y, -aabbHalfSize.z)));

    let aabbProjectedMin = new glVector3f(0.0);
    let aabbProjectedMax = new glVector3f(0.0);

    for(let i = 0; i < 8; ++i)
    {
        let vertexPosition = boundingBoxProjectedCorners[i];

        if(i == 0)
        {
            aabbProjectedMin.set(vertexPosition);
            aabbProjectedMax.set(vertexPosition);
        }
        else
        {
            aabbProjectedMin.x = Math.min(aabbProjectedMin.x, vertexPosition.x);
            aabbProjectedMin.y = Math.min(aabbProjectedMin.y, vertexPosition.y);
            aabbProjectedMin.z = Math.min(aabbProjectedMin.z, vertexPosition.z);

            aabbProjectedMax.x = Math.max(aabbProjectedMax.x, vertexPosition.x);
            aabbProjectedMax.y = Math.max(aabbProjectedMax.y, vertexPosition.y);
            aabbProjectedMax.z = Math.max(aabbProjectedMax.z, vertexPosition.z);
        }
    }

    let aabbProjectedSize = glVector3f.abs(glVector3f.sub(aabbProjectedMax, aabbProjectedMin)).mul(0.5);
    let aabbProjectedCenter = glVector3f.add(aabbProjectedMin, aabbProjectedMax).mul(0.5);
    
    this.setOrthographicProjection(-aabbProjectedSize.x, aabbProjectedSize.x, -aabbProjectedSize.y, aabbProjectedSize.y, -aabbProjectedSize.z, aabbProjectedSize.z);
    this.translate(-aabbProjectedCenter.x, -aabbProjectedCenter.y, -aabbProjectedCenter.z);
    
    return this.getModelViewProjectionMatrix();
}

glContext.prototype.getProjectionMatrix = function() {
    return new glMatrix4x4f(this.__projectionMatrix);
}

glContext.prototype.getModelViewMatrix = function() {
    return new glMatrix4x4f(this.__modelViewMatrix);
}

glContext.prototype.__updateModelViewProjectionMatrix = function()
{
    this.__modelViewProjectionMatrix = glMatrix4x4f.mul(this.__projectionMatrix, this.__modelViewMatrix);
    this.__standardUniformsBlock.glModelViewProjectionMatrix.set(this.__modelViewProjectionMatrix);
    
    this.__shouldUpdateModelViewProjectionMatrix = false;    
}

glContext.prototype.getModelViewProjectionMatrix = function()
{
    if(this.__shouldUpdateModelViewProjectionMatrix) this.__updateModelViewProjectionMatrix();
    
    return new glMatrix4x4f(this.__modelViewProjectionMatrix);
}

glContext.prototype.__updateNormalMatrix = function()
{
    this.__normalMatrix = glMatrix4x4f.normalMatrix(this.__modelViewMatrix);
    this.__standardUniformsBlock.glNormalMatrix.set(this.__normalMatrix);
        
    this.__shouldUpdateNormalMatrix = false;       
}

glContext.prototype.getNormalMatrix = function()
{
    if(this.__shouldUpdateNormalMatrix) this.__updateNormalMatrix();
    
    return new glMatrix4x4f(this.__normalMatrix);
}

glContext.prototype.textureToBase64 = function(texture, width, height)
{
    let gl = this.getGL();

    if(width  == null) width  = texture.getWidth();
    if(height == null) height = texture.getHeight();
    
    let activeFramebuffer = this.getActiveFramebuffer();

    let framebuffer = new glFramebuffer(this, width, height);
    let colorbuffer = framebuffer.createColorAttachmentRGBA8();
    
    framebuffer.bind([colorbuffer]);
    texture.blit();

    let data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);

    framebuffer.unbind();
    framebuffer.free();
    
    let flippedCanvas = document.createElement('canvas');
    let canvas = document.createElement('canvas');
    
    let context = canvas.getContext('2d', {alpha: true});
    context.imageSmoothingEnabled = false;
    
    canvas.width  = flippedCanvas.width  = width;
    canvas.height = flippedCanvas.height = height;
    
    let imageData = context.createImageData(width, height);
    imageData.data.set(data);

    context.putImageData(imageData, 0, 0);
    
    context = flippedCanvas.getContext('2d', {alpha: true});
    context.imageSmoothingEnabled = false;
        
    context.translate(0.0, height);
    context.scale(1.0, -1.0);

    context.drawImage(canvas, 0.0, 0.0);
    
    this.bindFramebuffer(activeFramebuffer);

    return flippedCanvas.toDataURL();
}

glContext.prototype.textureToImage = function(texture, width, height, onLoad)
{
    let img = new Image();
    
    if(onLoad != null) img.onload = function() {
        onLoad(img);
    }
    
    img.src = this.textureToBase64(texture, width, height);
    
    return img;
}

glContext.prototype.getInputManager = function() {
    return this.__inputDeviceManager;
}
