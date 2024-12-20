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

    this.enableHiDPI(false);

    this.__pointerLocked = false;
    this.__pointerLockEngaged = false;
    this.__canvas.requestPointerLock = (this.__canvas.requestPointerLock || this.__canvas.mozRequestPointerLock || this.__canvas.webkitRequestPointerLock);
    this.__hookPointerLockEvents();
    
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
        shadersDebugger:          this.__gl.getExtension("WEBGL_debug_shaders"),
        rendererDebugger:         this.__gl.getExtension("WEBGL_debug_renderer_info"),
        disjointTimerQuery:       this.__gl.getExtension("EXT_disjoint_timer_query_webgl2"),
        renderableTextureFloat:   this.__gl.getExtension("EXT_color_buffer_float"),
        blendableTextureFloat:    this.__gl.getExtension("EXT_float_blend"),
        textureFloatLinearFilter: this.__gl.getExtension("OES_texture_float_linear"),
        anisotropicFilter:        this.__gl.getExtension("EXT_texture_filter_anisotropic"),
        minMaxMipmap:             this.__gl.getExtension("GL_EXT_texture_filter_minmax"),
    };
    
    this.__prfProfiler = new glPerformanceProfiler(this);
    this.__prfProfiler.enable(false);
    
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
    
    this.__animationUniformsBlock.glAnimationMatricesCurrentFrame = this.__animationUniformsBlock.createUniformArrayMat4("glAnimationMatricesCurrentFrame", glUniformBlock.Precision.MEDIUMP, 255, null);
    this.__animationUniformsBlock.glAnimationMatricesLastFrame    = this.__animationUniformsBlock.createUniformArrayMat4("glAnimationMatricesLastFrame",    glUniformBlock.Precision.MEDIUMP, 255, null);
    this.__animationUniformsBlock.glBonesMatricesCurrentFrame     = this.__animationUniformsBlock.createUniformArrayMat4("glBonesMatricesCurrentFrame",     glUniformBlock.Precision.MEDIUMP, 255, null);
    this.__animationUniformsBlock.glBonesMatricesLastFrame        = this.__animationUniformsBlock.createUniformArrayMat4("glBonesMatricesLastFrame",        glUniformBlock.Precision.MEDIUMP, 255, null);
    
    this.__standardUniformsBlock.bind((this.__standardUniformsBlockUnitID   = -1));
    this.__animationUniformsBlock.bind((this.__animationUniformsBlockUnitID = -2));

    if(!this.__standardUniformsBlock.empty())  this.__appendShadingHeader(this.__standardUniformsBlock.getShaderSource());
    if(!this.__animationUniformsBlock.empty()) this.__appendShadingHeader(this.__animationUniformsBlock.getShaderSource());

    this.__appendShadingHeader("#ifdef GLES_VERTEX_SHADER                                                                                                                                         \n" +
                               "precision highp float;                                                                                                                                            \n" +
                               "precision highp int;                                                                                                                                              \n" +
                               "#elif GLES_FRAGMENT_SHADER                                                                                                                                        \n" +
                               "precision mediump float;                                                                                                                                          \n" +
                               "precision highp int;                                                                                                                                              \n" +
                               "#elif GLES_COMPUTE_SHADER                                                                                                                                         \n" +
                               "precision highp float;                                                                                                                                            \n" +
                               "precision highp int;                                                                                                                                              \n" +
                               "#endif                                                                                                                                                            \n" +
                               "                                                                                                                                                                  \n" +
                               "#define signbit(x) (step(0.0, x) * 2.0 - 1.0)                                                                                                                     \n" +
                               "                                                                                                                                                                  \n" +
                               "const float NaN = uintBitsToFloat(0x7FC00000u);                                                                                                                   \n" +
                               "const float Infinity = uintBitsToFloat(0x7F800000u);                                                                                                              \n" +
                               "                                                                                                                                                                  \n" +
                               "#define uintBitsToFloat(v) uintBitsToFloat(v+uint(mod(glTime,1e-6))) // Hardware Bug Workaround: on some GPUs uintBitsToFloat() behaves inconsistently            \n" +
                               "                                                                     // due to internal optimizations. This workaround tricks the glsl compiler into thinking     \n" +
                               "                                                                     // input parameters to this function are uniform-dependent, which bypasses the issue.        \n" +
                               "                                                                                                                                                                  \n" +
                               "                                                                                                                                                                  \n" +
                               "#ifdef GLES_VERTEX_SHADER                                                                                                                                         \n" +
                               "                                                                                                                                                                  \n" +
                               "in highp   vec3  glVertex;                                                                                                                                        \n" +
                               "in mediump vec3  glNormal;                                                                                                                                        \n" +
                               "in mediump vec4  _glTangent;                                                                                                                                      \n" +
                               "in mediump vec2  glTexCoord;                                                                                                                                      \n" +
                               "in mediump vec4  glBonesWeights;                                                                                                                                  \n" +
                               "in lowp    uvec4 glBonesIndices;                                                                                                                                  \n" +
                               "in lowp    uint  glAnimationMatrixID;                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "#define glTangent   vec3(_glTangent.xyz)                                                                                                                          \n" +
                               "#define glBitangent vec3(cross(glNormal, _glTangent.xyz) * sign(_glTangent.w))                                                                                    \n" +
                               "                                                                                                                                                                  \n" +
                               "mat4 _glAnimationMatrixCurrentFrame = mat4(1.0);                                                                                                                  \n" +
                               "bool _glAnimationMatrixCurrentFrame_isSet = false;                                                                                                                \n" +
                               "mat3 _glAnimationNormalMatrixCurrentFrame = mat3(1.0);                                                                                                            \n" +
                               "bool _glAnimationNormalMatrixCurrentFrame_isSet = false;                                                                                                          \n" +
                               "vec3 _glAnimationVertexCurrentFrame = vec3(0.0);                                                                                                                  \n" +
                               "bool _glAnimationVertexCurrentFrame_isSet = false;                                                                                                                \n" +
                               "vec3 _glAnimationNormalCurrentFrame = vec3(0.0);                                                                                                                  \n" +
                               "bool _glAnimationNormalCurrentFrame_isSet = false;                                                                                                                \n" +
                               "vec3 _glAnimationTangentCurrentFrame = vec3(0.0);                                                                                                                 \n" +
                               "bool _glAnimationTangentCurrentFrame_isSet = false;                                                                                                               \n" +
                               "vec3 _glAnimationBitangentCurrentFrame = vec3(0.0);                                                                                                               \n" +
                               "bool _glAnimationBitangentCurrentFrame_isSet = false;                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "mat4 _glAnimationMatrixLastFrame = mat4(1.0);                                                                                                                     \n" +
                               "bool _glAnimationMatrixLastFrame_isSet = false;                                                                                                                   \n" +
                               "mat3 _glAnimationNormalMatrixLastFrame = mat3(1.0);                                                                                                               \n" +
                               "bool _glAnimationNormalMatrixLastFrame_isSet = false;                                                                                                             \n" +
                               "vec3 _glAnimationVertexLastFrame = vec3(0.0);                                                                                                                     \n" +
                               "bool _glAnimationVertexLastFrame_isSet = false;                                                                                                                   \n" +
                               "vec3 _glAnimationNormalLastFrame = vec3(0.0);                                                                                                                     \n" +
                               "bool _glAnimationNormalLastFrame_isSet = false;                                                                                                                   \n" +
                               "vec3 _glAnimationTangentLastFrame = vec3(0.0);                                                                                                                    \n" +
                               "bool _glAnimationTangentLastFrame_isSet = false;                                                                                                                  \n" +
                               "vec3 _glAnimationBitangentLastFrame = vec3(0.0);                                                                                                                  \n" +
                               "bool _glAnimationBitangentLastFrame_isSet = false;                                                                                                                \n" +
                               "                                                                                                                                                                  \n" +
                               "#define glIsAnimationActive (glIsAnimationActive > 0)                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "mat4 glGetCurrentFrameAnimationMatrix()                                                                                                                           \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationMatrixCurrentFrame_isSet)                                                                                                                     \n" +
                               "    {                                                                                                                                                             \n" +
                               "        if(glIsAnimationActive)                                                                                                                                   \n" +
                               "        {                                                                                                                                                         \n" +
                               "            if(glAnimationMatrixID < 255u) _glAnimationMatrixCurrentFrame *= glAnimationMatricesCurrentFrame[glAnimationMatrixID];                                \n" +
                               "                                                                                                                                                                  \n" +
                               "            bool hasSkin = false;                                                                                                                                 \n" +
                               "            mat4 skinMatrix = mat4(0);                                                                                                                            \n" +
                               "            if(glBonesWeights.x > 0.0 && glBonesIndices.x < 255u) skinMatrix += glBonesWeights.x * glBonesMatricesCurrentFrame[glBonesIndices.x], hasSkin = true; \n" +
                               "            if(glBonesWeights.y > 0.0 && glBonesIndices.y < 255u) skinMatrix += glBonesWeights.y * glBonesMatricesCurrentFrame[glBonesIndices.y], hasSkin = true; \n" +
                               "            if(glBonesWeights.z > 0.0 && glBonesIndices.z < 255u) skinMatrix += glBonesWeights.z * glBonesMatricesCurrentFrame[glBonesIndices.z], hasSkin = true; \n" +
                               "            if(glBonesWeights.w > 0.0 && glBonesIndices.w < 255u) skinMatrix += glBonesWeights.w * glBonesMatricesCurrentFrame[glBonesIndices.w], hasSkin = true; \n" +
                               "            if(hasSkin) _glAnimationMatrixCurrentFrame *= skinMatrix;                                                                                             \n" +
                               "        }                                                                                                                                                         \n" +
                               "                                                                                                                                                                  \n" +
                               "        _glAnimationMatrixCurrentFrame_isSet = true;                                                                                                              \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationMatrixCurrentFrame;                                                                                                                        \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "mat4 glGetLastFrameAnimationMatrix()                                                                                                                              \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationMatrixLastFrame_isSet)                                                                                                                        \n" +
                               "    {                                                                                                                                                             \n" +
                               "        if(glIsAnimationActive)                                                                                                                                   \n" +
                               "        {                                                                                                                                                         \n" +
                               "            if(glAnimationMatrixID < 255u) _glAnimationMatrixLastFrame *= glAnimationMatricesLastFrame[glAnimationMatrixID];                                      \n" +
                               "                                                                                                                                                                  \n" +
                               "            if(glBonesIndices.x < 255u)                                                                                                                           \n" +
                               "            {                                                                                                                                                     \n" +
                               "                mat4 skinMatrix = glBonesWeights.x * glBonesMatricesLastFrame[glBonesIndices.x] +                                                                 \n" +
                               "                                  glBonesWeights.y * glBonesMatricesLastFrame[glBonesIndices.y] +                                                                 \n" +
                               "                                  glBonesWeights.z * glBonesMatricesLastFrame[glBonesIndices.z] +                                                                 \n" +
                               "                                  glBonesWeights.w * glBonesMatricesLastFrame[glBonesIndices.w];                                                                  \n" +
                               "                                                                                                                                                                  \n" +
                               "                _glAnimationMatrixLastFrame *= skinMatrix;                                                                                                        \n" +
                               "            }                                                                                                                                                     \n" +
                               "        }                                                                                                                                                         \n" +
                               "                                                                                                                                                                  \n" +
                               "        _glAnimationMatrixLastFrame_isSet = true;                                                                                                                 \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationMatrixLastFrame;                                                                                                                           \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "mat3 glGetCurrentFrameAnimationNormalMatrix()                                                                                                                     \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationNormalMatrixCurrentFrame_isSet)                                                                                                               \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationNormalMatrixCurrentFrame = mat3(inverse(transpose(glGetCurrentFrameAnimationMatrix())));                                                      \n" +
                               "        _glAnimationNormalMatrixCurrentFrame_isSet = true;                                                                                                        \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationNormalMatrixCurrentFrame;                                                                                                                  \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "mat3 glGetLastFrameAnimationNormalMatrix()                                                                                                                        \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationNormalMatrixLastFrame_isSet)                                                                                                                  \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationNormalMatrixLastFrame = mat3(inverse(transpose(glGetLastFrameAnimationMatrix())));                                                            \n" +
                               "        _glAnimationNormalMatrixLastFrame_isSet = true;                                                                                                           \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationNormalMatrixLastFrame;                                                                                                                     \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "vec3 glGetCurrentFrameAnimatedVertex()                                                                                                                            \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationVertexCurrentFrame_isSet)                                                                                                                     \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationVertexCurrentFrame = (glGetCurrentFrameAnimationMatrix() * vec4(glVertex, 1.0)).xyz;                                                          \n" +
                               "        _glAnimationVertexCurrentFrame_isSet = true;                                                                                                              \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationVertexCurrentFrame;                                                                                                                        \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "vec3 glGetLastFrameAnimatedVertex()                                                                                                                               \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationVertexLastFrame_isSet)                                                                                                                        \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationVertexLastFrame = (glGetLastFrameAnimationMatrix() * vec4(glVertex, 1.0)).xyz;                                                                \n" +
                               "        _glAnimationVertexLastFrame_isSet = true;                                                                                                                 \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationVertexLastFrame;                                                                                                                           \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "vec3 glGetCurrentFrameAnimatedNormal()                                                                                                                            \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationNormalCurrentFrame_isSet)                                                                                                                     \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationNormalCurrentFrame = normalize(glGetCurrentFrameAnimationNormalMatrix() * glNormal);                                                          \n" +
                               "        _glAnimationNormalCurrentFrame_isSet = true;                                                                                                              \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationNormalCurrentFrame;                                                                                                                        \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "vec3 glGetLastFrameAnimatedNormal()                                                                                                                               \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationNormalLastFrame_isSet)                                                                                                                        \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationNormalLastFrame = normalize(glGetLastFrameAnimationNormalMatrix() * glNormal);                                                                \n" +
                               "        _glAnimationNormalLastFrame_isSet = true;                                                                                                                 \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationNormalLastFrame;                                                                                                                           \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "vec3 glGetCurrentFrameAnimatedTangent()                                                                                                                           \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationTangentCurrentFrame_isSet)                                                                                                                    \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationTangentCurrentFrame = normalize(glGetCurrentFrameAnimationNormalMatrix() * glTangent);                                                        \n" +
                               "        _glAnimationTangentCurrentFrame_isSet = true;                                                                                                             \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationTangentCurrentFrame;                                                                                                                       \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "vec3 glGetLastFrameAnimatedTangent()                                                                                                                              \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationTangentLastFrame_isSet)                                                                                                                       \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationTangentLastFrame = normalize(glGetLastFrameAnimationNormalMatrix() * glTangent);                                                              \n" +
                               "        _glAnimationTangentLastFrame_isSet = true;                                                                                                                \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationTangentLastFrame;                                                                                                                          \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "vec3 glGetCurrentFrameAnimatedBitangent()                                                                                                                         \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationBitangentCurrentFrame_isSet)                                                                                                                  \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationBitangentCurrentFrame = normalize(glGetCurrentFrameAnimationNormalMatrix() * glBitangent);                                                    \n" +
                               "        _glAnimationBitangentCurrentFrame_isSet = true;                                                                                                           \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationBitangentCurrentFrame;                                                                                                                     \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "vec3 glGetLastFrameAnimatedBitangent()                                                                                                                            \n" +
                               "{                                                                                                                                                                 \n" +
                               "    if(!_glAnimationBitangentLastFrame_isSet)                                                                                                                     \n" +
                               "    {                                                                                                                                                             \n" +
                               "        _glAnimationBitangentLastFrame = normalize(glGetLastFrameAnimationNormalMatrix() * glBitangent);                                                          \n" +
                               "        _glAnimationBitangentLastFrame_isSet = true;                                                                                                              \n" +
                               "    }                                                                                                                                                             \n" +
                               "                                                                                                                                                                  \n" +
                               "    return _glAnimationBitangentLastFrame;                                                                                                                        \n" +
                               "}                                                                                                                                                                 \n" +
                               "                                                                                                                                                                  \n" +
                               "#define glAnimatedVertex             glGetCurrentFrameAnimatedVertex()                                                                                            \n" +
                               "#define glAnimatedNormal             glGetCurrentFrameAnimatedNormal()                                                                                            \n" +
                               "#define glAnimatedTangent            glGetCurrentFrameAnimatedTangent()                                                                                           \n" +
                               "#define glAnimatedBitangent          glGetCurrentFrameAnimatedBitangent()                                                                                         \n" +
                               "#define glLastFrameAnimatedVertex    glGetLastFrameAnimatedVertex()                                                                                               \n" +
                               "#define glLastFrameAnimatedNormal    glGetLastFrameAnimatedNormal()                                                                                               \n" +
                               "#define glLastFrameAnimatedTangent   glGetLastFrameAnimatedTangent()                                                                                              \n" +
                               "#define glLastFrameAnimatedBitangent glGetLastFrameAnimatedBitangent()                                                                                            \n" +
                               "                                                                                                                                                                  \n" +
                               "#endif                                                                                                                                                            \n");

    this.__appendShadingHeader("mediump float _randomSeed = 0.0;                      \n" +
                               "void srand(in float seed) {                           \n" +
                               "   _randomSeed = seed;                                \n" +
                               "}                                                     \n" +
                               "                                                      \n" +
                               "float random() {                                      \n" +
                               "    return fract(sin(++_randomSeed) * 43758.5453123); \n" +
                               "}                                                     \n");

    this.__appendShadingHeader("struct samplerData                                                                                                                                                                      \n" +
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
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "struct samplerGeoData                                                                                                                                                                   \n" +
                               "{                                                                                                                                                                                       \n" +
                               "   highp sampler2D vertexSampler;                                                                                                                                                       \n" +
                               "   highp sampler2D attribSampler;                                                                                                                                                       \n" +
                               "   highp sampler2D faceSampler;                                                                                                                                                         \n" +
                               "   highp sampler2D nodeSampler;                                                                                                                                                         \n" +
                               "};                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " // Fetches vertex properties (position, uv, normal, tangent and bitangent) from a geodata texture's VBO (indexed mode)                                                                 \n" +
                               " void textureGeoDataVBO(in samplerGeoData g, in uint vID, out vec3 p, out vec2 uv, out vec3 n, out vec3 t, out vec3 b)                                                                  \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     uvec2 w = uvec2(textureSize(g.vertexSampler, 0).x, textureSize(g.attribSampler, 0).x);                                                                                             \n" +
                               "                                                                                                                                                                                        \n" +
                               "     vec4 data0 = texelFetch(g.vertexSampler, ivec2(vID % w.x, vID / w.x), 0);                                                                                                          \n" +
                               "     vec4 data1 = texelFetch(g.attribSampler, ivec2(vID % w.y, vID / w.y), 0);                                                                                                          \n" +
                               "                                                                                                                                                                                        \n" +
                               "     p  = data0.xyz;                                                                                                                                                                    \n" +
                               "     uv = vec2(data1.xy);                                                                                                                                                               \n" +
                               "                                                                                                                                                                                        \n" +
                               "     t = vec3(-1.0 + 2.0 * unpackHalf2x16(floatBitsToUint(data1.z)), 0);                                                                                                                \n" +
                               "     b = vec3(-1.0 + 2.0 * unpackHalf2x16(floatBitsToUint(data1.w)), 0);                                                                                                                \n" +
                               "     n = vec3(-1.0 + 2.0 * unpackHalf2x16(floatBitsToUint(data0.w)), 0);                                                                                                                \n" +
                               "                                                                                                                                                                                        \n" +
                               "     if((t.z = 1.0 - abs(t.x) - abs(t.y)) < 0.0) t.xy = (1.0 - abs(t.yx)) * vec2(((t.x >= 0.0) ? 1.0 : -1.0), ((t.y >= 0.0) ? 1.0 : -1.0));                                             \n" +
                               "     if((b.z = 1.0 - abs(b.x) - abs(b.y)) < 0.0) b.xy = (1.0 - abs(b.yx)) * vec2(((b.x >= 0.0) ? 1.0 : -1.0), ((b.y >= 0.0) ? 1.0 : -1.0));                                             \n" +
                               "     if((n.z = 1.0 - abs(n.x) - abs(n.y)) < 0.0) n.xy = (1.0 - abs(n.yx)) * vec2(((n.x >= 0.0) ? 1.0 : -1.0), ((n.y >= 0.0) ? 1.0 : -1.0));                                             \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " // Fetches vertex properties (position, uv, normal, tangent and bitangent) from a geodata texture (non-indexed mode)                                                                   \n" +
                               " void textureGeoData(in samplerGeoData g, in int vertexID, out vec3 position, out vec2 texCoord, out vec3 normal, out vec3 tangent, out vec3 bitangent)                                 \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     uint triangleID = uint(vertexID) / 3u;                                                                                                                                             \n" +
                               "                                                                                                                                                                                        \n" +
                               "     uint w = uint(textureSize(g.faceSampler, 0).x);                                                                                                                                    \n" +
                               "     uint vID = floatBitsToUint(texelFetch(g.faceSampler, ivec2(triangleID % w, triangleID / w), 0)[vertexID % 3]);                                                                     \n" +
                               "                                                                                                                                                                                        \n" +
                               "     textureGeoDataVBO(g, vID, position, texCoord, normal, tangent, bitangent);                                                                                                         \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " // Fetches vertex properties (position, uv, normal and tangent) from a geodata texture                                                                                                 \n" +
                               " void textureGeoData(in samplerGeoData g, in int vertexID, out vec3 position, out vec2 texCoord, out vec3 normal, out vec3 tangent)                                                     \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     vec3 b;                                                                                                                                                                            \n" +
                               "     textureGeoData(g, vertexID, position, texCoord, normal, tangent, b);                                                                                                               \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " // Fetches vertex properties (position, uv and normal) from a geodata texture                                                                                                          \n" +
                               " void textureGeoData(in samplerGeoData g, in int vertexID, out vec3 position, out vec2 texCoord, out vec3 normal)                                                                       \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     vec3 t, b;                                                                                                                                                                         \n" +
                               "     textureGeoData(g, vertexID, position, texCoord, normal, t, b);                                                                                                                     \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " // Fetches vertex properties (position and uv) from a geodata texture                                                                                                                  \n" +
                               " void textureGeoData(in samplerGeoData g, in int vertexID, out vec3 position, out vec2 texCoord)                                                                                        \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     vec3 n, t, b;                                                                                                                                                                      \n" +
                               "     textureGeoData(g, vertexID, position, texCoord, n, t, b);                                                                                                                          \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " // Fetches vertex properties (position) from a geodata texture                                                                                                                         \n" +
                               " void textureGeoData(in samplerGeoData g, in int vertexID, out vec3 position)                                                                                                           \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     vec2 uv; vec3 n, t, b;                                                                                                                                                             \n" +
                               "     textureGeoData(g, vertexID, position, uv, n, t, b);                                                                                                                                \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " // Fetches vertex properties (position, uv, normal, tangent and bitangent) of a triangle from a geodata texture                                                                        \n" +
                               " uint textureGeoData(in samplerGeoData g, in uint triangleID, out vec3 p[3], out vec2 uv[3], out vec3 n[3], out vec3 t[3], out vec3 b[3])                                               \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     uint w = uint(textureSize(g.faceSampler, 0).x);                                                                                                                                    \n" +
                               "     uvec4 vIDs = floatBitsToUint(texelFetch(g.faceSampler, ivec2(triangleID % w, triangleID / w), 0));                                                                                 \n" +
                               "                                                                                                                                                                                        \n" +
                               "     textureGeoDataVBO(g, vIDs.x, p[0], uv[0], n[0], t[0], b[0]);                                                                                                                       \n" +
                               "     textureGeoDataVBO(g, vIDs.y, p[1], uv[1], n[1], t[1], b[1]);                                                                                                                       \n" +
                               "     textureGeoDataVBO(g, vIDs.z, p[2], uv[2], n[2], t[2], b[2]);                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "     return vIDs.w; // triangle's materialID                                                                                                                                            \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " // Fetches interpolated vertex properties (position, uv, normal, tangent and bitangent) of a triangle from a geodata texture                                                           \n" +
                               " uint textureGeoData(in samplerGeoData g, in uint triangleID, in vec2 barycentric, out vec3 position, out vec2 texCoord, out vec3 normal, out vec3 tangent, out vec3 bitangent)         \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     vec3 w = vec3(1.0 - barycentric.x - barycentric.y, barycentric.xy);                                                                                                                \n" +
                               "                                                                                                                                                                                        \n" +
                               "     vec3 p[3], n[3], t[3], b[3]; vec2 u[3];                                                                                                                                            \n" +
                               "     uint materialID = textureGeoData(g, triangleID, p, u, n, t, b);                                                                                                                    \n" +
                               "                                                                                                                                                                                        \n" +
                               "     position  = p[0] * w.x + p[1] * w.y + p[2] * w.z;                                                                                                                                  \n" +
                               "     texCoord  = u[0] * w.x + u[1] * w.y + u[2] * w.z;                                                                                                                                  \n" +
                               "     tangent   = t[0] * w.x + t[1] * w.y + t[2] * w.z;                                                                                                                                  \n" +
                               "     bitangent = b[0] * w.x + b[1] * w.y + b[2] * w.z;                                                                                                                                  \n" +
                               "     normal    = n[0] * w.x + n[1] * w.y + n[2] * w.z;                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "     bitangent = normalize(bitangent);                                                                                                                                                  \n" +
                               "     tangent   = normalize(tangent);                                                                                                                                                    \n" +
                               "     normal    = normalize(normal);                                                                                                                                                     \n" +
                               "                                                                                                                                                                                        \n" +
                               "     return materialID;                                                                                                                                                                 \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " const uint _BVH_max_depth = 32u;                                                                                                                                                       \n" +
                               " uint  _BVH_stack[_BVH_max_depth];                                                                                                                                                      \n" +
                               " uint  _BVH_stackPointer = 1u;                                                                                                                                                          \n" +
                               " float _BVH_polygonOffset = 1e-6;                                                                                                                                                       \n" +
                               " bool  _BVH_async_mode = false;                                                                                                                                                         \n" +
                               "                                                                                                                                                                                        \n" +
                               " vec2 _BVH_rayIntersectAABB(const vec3 ro, const vec3 rd_inv, const vec3 aabbMin, const vec3 aabbMax)                                                                                   \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     vec3 t1 = (aabbMin - ro) * rd_inv;                                                                                                                                                 \n" +
                               "     vec3 t2 = (aabbMax - ro) * rd_inv;                                                                                                                                                 \n" +
                               "                                                                                                                                                                                        \n" +
                               "     vec3 tn = min(t1, t2);                                                                                                                                                             \n" +
                               "     vec3 tf = max(t1, t2);                                                                                                                                                             \n" +
                               "                                                                                                                                                                                        \n" +
                               "     float tmin = max(max(tn.x, tn.y), tn.z);                                                                                                                                           \n" +
                               "     float tmax = min(min(tf.x, tf.y), tf.z);                                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "     return vec2(tmin, tmax);                                                                                                                                                           \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               "float _BVH_signedDistanceAABB(vec3 p, vec3 aabbMin, vec3 aabbMax)                                                                                                                       \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    vec3 d = abs(p - (aabbMax + aabbMin) * 0.5) - (aabbMax - aabbMin) * 0.5;                                                                                                            \n" +
                               "    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);                                                                                                                     \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "float _BVH_dot2(const vec3 v) {                                                                                                                                                         \n" +
                               "    return dot(v, v);                                                                                                                                                                   \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "float _BVH_signedDistanceTriangle(const mat3 triangle, in vec3 p)                                                                                                                       \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    vec3 v21 = triangle[1] - triangle[0];                                                                                                                                               \n" +
                               "    vec3 v32 = triangle[2] - triangle[1];                                                                                                                                               \n" +
                               "    vec3 v13 = triangle[0] - triangle[2];                                                                                                                                               \n" +
                               "                                                                                                                                                                                        \n" +
                               "    vec3 n = normalize(cross(v21, v13));                                                                                                                                                \n" +
                               "    p += n * _BVH_polygonOffset;                                                                                                                                                        \n" +
                               "                                                                                                                                                                                        \n" +
                               "    vec3 p1 = p - triangle[0];                                                                                                                                                          \n" +
                               "    vec3 p2 = p - triangle[1];                                                                                                                                                          \n" +
                               "    vec3 p3 = p - triangle[2];                                                                                                                                                          \n" +
                               "                                                                                                                                                                                        \n" +
                               "    float s = sign(dot(-n, p1));                                                                                                                                                        \n" +
                               "                                                                                                                                                                                        \n" +
                               "    return sqrt( abs((sign(dot(cross(v21,n),p1)) +                                                                                                                                      \n" +
                               "                  sign(dot(cross(v32,n),p2)) +                                                                                                                                          \n" +
                               "                  sign(dot(cross(v13,n),p3))<2.0)                                                                                                                                       \n" +
                               "                  ?                                                                                                                                                                     \n" +
                               "                  min( min(                                                                                                                                                             \n" +
                               "                  _BVH_dot2(v21*clamp(dot(v21,p1)/_BVH_dot2(v21),0.0,1.0)-p1),                                                                                                          \n" +
                               "                  _BVH_dot2(v32*clamp(dot(v32,p2)/_BVH_dot2(v32),0.0,1.0)-p2) ),                                                                                                        \n" +
                               "                  _BVH_dot2(v13*clamp(dot(v13,p3)/_BVH_dot2(v13),0.0,1.0)-p3) )                                                                                                         \n" +
                               "                  :                                                                                                                                                                     \n" +
                               "                  dot(n,p1)*dot(n,p1)/_BVH_dot2(n))) * s;                                                                                                                               \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               " vec3 _BVH_rayIntersectTriangle(const vec3 ro, const vec3 rd, const mat3 triangle)                                                                                                      \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     vec3 v1v0 = (triangle[1] - triangle[0]);                                                                                                                                           \n" +
                               "     vec3 v2v0 = (triangle[2] - triangle[0]);                                                                                                                                           \n" +
                               "     vec3 rov0 = (ro - triangle[0]);                                                                                                                                                    \n" +
                               "                                                                                                                                                                                        \n" +
                               "     vec3 n = cross(v1v0, v2v0);                                                                                                                                                        \n" +
                               "     vec3 q = cross(rov0, rd);                                                                                                                                                          \n" +
                               "                                                                                                                                                                                        \n" +
                               "     float d = dot(rd, n);                                                                                                                                                              \n" +
                               "     // if(d >= 0.0) return vec3(0, 0, -1); // back-face culling                                                                                                                        \n" +
                               "     d = 1.0 / d;                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "     float u = -d * dot(q, v2v0);                                                                                                                                                       \n" +
                               "     float v =  d * dot(q, v1v0);                                                                                                                                                       \n" +
                               "     float t = -d * dot(n, rov0);                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "     if(t < 0.0 || u < 0.0 || v < 0.0 || (u + v) > 1.0) return vec3(0, 0, -1);                                                                                                          \n" +
                               "                                                                                                                                                                                        \n" +
                               "     return vec3(u, v, t);                                                                                                                                                              \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " bool textureGeoDataRayTrace( in samplerGeoData g,                                                                                                                                      \n" +
                               "                              const vec3 ro,                                                                                                                                            \n" +
                               "                              const vec3 rd,                                                                                                                                            \n" +
                               "                              inout vec3 hit,                                                                                                                                           \n" +
                               "                              inout uint triangleID,                                                                                                                                    \n" +
                               "                              const uint maxIterations )                                                                                                                                \n" +
                               "{                                                                                                                                                                                       \n" +
                               "     float rz = hit.z;                                                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "     if(!_BVH_async_mode)                                                                                                                                                               \n" +
                               "     {                                                                                                                                                                                  \n" +
                               "         _BVH_stack[0] = 0u,                                                                                                                                                            \n" +
                               "         _BVH_stackPointer = 1u;                                                                                                                                                        \n" +
                               "     }                                                                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "     vec3 rd_inv = 1.0 / (max(abs(rd), 1e-6) * signbit(rd));                                                                                                                            \n" +
                               "     uvec3 w = uvec3(textureSize(g.nodeSampler, 0).x, textureSize(g.vertexSampler, 0).x, textureSize(g.faceSampler, 0).x);                                                              \n" +
                               "                                                                                                                                                                                        \n" +
                               "     for(uint i = 0u; (i < maxIterations && _BVH_stackPointer > 0u && _BVH_stackPointer < _BVH_max_depth); ++i)                                                                         \n" +
                               "     {                                                                                                                                                                                  \n" +
                               "         uint nodeID = _BVH_stack[--_BVH_stackPointer];                                                                                                                                 \n" +
                               "                                                                                                                                                                                        \n" +
                               "         uvec2 texelIDs = nodeID * 2u + uvec2(0u, 1u);                                                                                                                                  \n" +
                               "         vec4 nodeData0 = texelFetch(g.nodeSampler, ivec2(texelIDs.x % w.x, texelIDs.x / w.x), 0);                                                                                      \n" +
                               "         vec4 nodeData1 = texelFetch(g.nodeSampler, ivec2(texelIDs.y % w.x, texelIDs.y / w.x), 0);                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               "         vec3 aabbMin = nodeData0.xyz;                                                                                                                                                  \n" +
                               "         vec3 aabbMax = nodeData1.xyz;                                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "         vec2 d = _BVH_rayIntersectAABB(ro, rd_inv, aabbMin, aabbMax);                                                                                                                  \n" +
                               "         if(d.y < 0.0 || d.y < d.x || (hit.z >= 0.0 && d.x >= hit.z)) continue;                                                                                                         \n" +
                               "                                                                                                                                                                                        \n" +
                               "         uint left  = floatBitsToUint(nodeData0.w);                                                                                                                                     \n" +
                               "         uint right = floatBitsToUint(nodeData1.w);                                                                                                                                     \n" +
                               "                                                                                                                                                                                        \n" +
                               "         bool isLeaf = (left == 0u);                                                                                                                                                    \n" +
                               "         left -= 1u;                                                                                                                                                                    \n" +
                               "                                                                                                                                                                                        \n" +
                               "         if(isLeaf) // leaf                                                                                                                                                             \n" +
                               "         {                                                                                                                                                                              \n" +
                               "             uvec3 vIDs = floatBitsToUint(texelFetch(g.faceSampler, ivec2(right % w.z, right / w.z), 0).xyz);                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "             mat3 triangle = mat3(texelFetch(g.vertexSampler, ivec2(vIDs.x % w.y, vIDs.x / w.y), 0).xyz,                                                                                \n" +
                               "                                  texelFetch(g.vertexSampler, ivec2(vIDs.y % w.y, vIDs.y / w.y), 0).xyz,                                                                                \n" +
                               "                                  texelFetch(g.vertexSampler, ivec2(vIDs.z % w.y, vIDs.z / w.y), 0).xyz);                                                                               \n" +
                               "                                                                                                                                                                                        \n" +
                               "             vec3 new_hit = _BVH_rayIntersectTriangle(ro, rd, triangle);                                                                                                                \n" +
                               "                                                                                                                                                                                        \n" +
                               "             if(new_hit.z > _BVH_polygonOffset && (hit.z < 0.0 || new_hit.z < hit.z))                                                                                                   \n" +
                               "             {                                                                                                                                                                          \n" +
                               "                 triangleID = right;                                                                                                                                                    \n" +
                               "                 hit = new_hit;                                                                                                                                                         \n" +
                               "             }                                                                                                                                                                          \n" +
                               "         }                                                                                                                                                                              \n" +
                               "         else // branch                                                                                                                                                                 \n" +
                               "         {                                                                                                                                                                              \n" +
                               "             // add children to the _BVH_stack                                                                                                                                          \n" +
                               "             _BVH_stack[_BVH_stackPointer++] = left;                                                                                                                                    \n" +
                               "             _BVH_stack[_BVH_stackPointer++] = right;                                                                                                                                   \n" +
                               "         }                                                                                                                                                                              \n" +
                               "     }                                                                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "     return (_BVH_stackPointer < 1u && hit.z >= 0.0 && (rz < 0.0 || hit.z < rz));                                                                                                       \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               " bool textureGeoDataRayTrace( in samplerGeoData g,                                                                                                                                      \n" +
                               "                              const vec3  ro,                                                                                                                                           \n" +
                               "                              const vec3  rd,                                                                                                                                           \n" +
                               "                              inout float rz,                                                                                                                                           \n" +
                               "                              inout vec3  p,                                                                                                                                            \n" +
                               "                              inout vec2  uv,                                                                                                                                           \n" +
                               "                              inout vec3  n,                                                                                                                                            \n" +
                               "                              inout vec3  t,                                                                                                                                            \n" +
                               "                              inout vec3  b,                                                                                                                                            \n" +
                               "                              const uint  maxIterations )                                                                                                                               \n" +
                               " {                                                                                                                                                                                      \n" +
                               "     vec3 hit = vec3(0, 0, rz); uint triID;                                                                                                                                             \n" +
                               "                                                                                                                                                                                        \n" +
                               "     if(!textureGeoDataRayTrace(g, ro, rd, hit, triID, maxIterations)) return false;                                                                                                    \n" +
                               "     textureGeoData(g, triID, hit.xy, p, uv, n, t, b); rz = hit.z;                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               "     return true;                                                                                                                                                                       \n" +
                               " }                                                                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               "bool textureGeoDataRayTrace(in samplerGeoData g, const vec3 ro, const vec3 rd, const uint maxIterations)                                                                                \n" +
                               "{                                                                                                                                                                                       \n" +
                               "     if(!_BVH_async_mode)                                                                                                                                                               \n" +
                               "     {                                                                                                                                                                                  \n" +
                               "         _BVH_stack[0] = 0u,                                                                                                                                                            \n" +
                               "         _BVH_stackPointer = 1u;                                                                                                                                                        \n" +
                               "     }                                                                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "    vec3 rd_inv = 1.0 / (max(abs(rd), 1e-6) * signbit(rd));                                                                                                                             \n" +
                               "    uvec3 w = uvec3(textureSize(g.nodeSampler, 0).x, textureSize(g.vertexSampler, 0).x, textureSize(g.faceSampler, 0).x);                                                               \n" +
                               "                                                                                                                                                                                        \n" +
                               "    for(uint i = 0u; (i < maxIterations && _BVH_stackPointer > 0u && _BVH_stackPointer < _BVH_max_depth); ++i)                                                                          \n" +
                               "    {                                                                                                                                                                                   \n" +
                               "        uint nodeID = _BVH_stack[--_BVH_stackPointer];                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "        uvec2 texelIDs = nodeID * 2u + uvec2(0u, 1u);                                                                                                                                   \n" +
                               "        vec4 nodeData0 = texelFetch(g.nodeSampler, ivec2(texelIDs.x % w.x, texelIDs.x / w.x), 0);                                                                                       \n" +
                               "        vec4 nodeData1 = texelFetch(g.nodeSampler, ivec2(texelIDs.y % w.x, texelIDs.y / w.x), 0);                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "        vec3 aabbMin = nodeData0.xyz;                                                                                                                                                   \n" +
                               "        vec3 aabbMax = nodeData1.xyz;                                                                                                                                                   \n" +
                               "                                                                                                                                                                                        \n" +
                               "        vec2 d = _BVH_rayIntersectAABB(ro, rd_inv, aabbMin, aabbMax);                                                                                                                   \n" +
                               "        if(d.y < 0.0 || d.y < d.x) continue;                                                                                                                                            \n" +
                               "                                                                                                                                                                                        \n" +
                               "        uint left  = floatBitsToUint(nodeData0.w);                                                                                                                                      \n" +
                               "        uint right = floatBitsToUint(nodeData1.w);                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               "        bool isLeaf = (left == 0u);                                                                                                                                                     \n" +
                               "        left -= 1u;                                                                                                                                                                     \n" +
                               "                                                                                                                                                                                        \n" +
                               "        if(isLeaf) // leaf                                                                                                                                                              \n" +
                               "        {                                                                                                                                                                               \n" +
                               "            uvec3 vIDs = floatBitsToUint(texelFetch(g.faceSampler, ivec2(right % w.z, right / w.z), 0).xyz);                                                                            \n" +
                               "                                                                                                                                                                                        \n" +
                               "            mat3 triangle = mat3(texelFetch(g.vertexSampler, ivec2(vIDs.x % w.y, vIDs.x / w.y), 0).xyz,                                                                                 \n" +
                               "                                 texelFetch(g.vertexSampler, ivec2(vIDs.y % w.y, vIDs.y / w.y), 0).xyz,                                                                                 \n" +
                               "                                 texelFetch(g.vertexSampler, ivec2(vIDs.z % w.y, vIDs.z / w.y), 0).xyz);                                                                                \n" +
                               "                                                                                                                                                                                        \n" +
                               "            if(_BVH_rayIntersectTriangle(ro, rd, triangle).z > _BVH_polygonOffset) return true;                                                                                         \n" +
                               "        }                                                                                                                                                                               \n" +
                               "        else // branch                                                                                                                                                                  \n" +
                               "        {                                                                                                                                                                               \n" +
                               "            // add children to the _BVH_stack                                                                                                                                           \n" +
                               "            _BVH_stack[_BVH_stackPointer++] = left;                                                                                                                                     \n" +
                               "            _BVH_stack[_BVH_stackPointer++] = right;                                                                                                                                    \n" +
                               "        }                                                                                                                                                                               \n" +
                               "    }                                                                                                                                                                                   \n" +
                               "                                                                                                                                                                                        \n" +
                               "    return false;                                                                                                                                                                       \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "bool textureGeoDataSDF( in samplerGeoData g,                                                                                                                                            \n" +
                               "                        const vec3 p,                                                                                                                                                   \n" +
                               "                        inout float signedDistance,                                                                                                                                     \n" +
                               "                        inout uint triangleID,                                                                                                                                          \n" +
                               "                        const uint maxIterations )                                                                                                                                      \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    float depth = signedDistance;                                                                                                                                                       \n" +
                               "    float distanceSign = 1.0;                                                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "    if(!_BVH_async_mode)                                                                                                                                                                \n" +
                               "    {                                                                                                                                                                                   \n" +
                               "        _BVH_stack[0] = 0u,                                                                                                                                                             \n" +
                               "        _BVH_stackPointer = 1u;                                                                                                                                                         \n" +
                               "    }                                                                                                                                                                                   \n" +
                               "                                                                                                                                                                                        \n" +
                               "    uvec3 w = uvec3(textureSize(g.nodeSampler, 0).x, textureSize(g.vertexSampler, 0).x, textureSize(g.faceSampler, 0).x);                                                               \n" +
                               "                                                                                                                                                                                        \n" +
                               "    for(uint i = 0u; (i < maxIterations && _BVH_stackPointer > 0u && _BVH_stackPointer < _BVH_max_depth); ++i)                                                                          \n" +
                               "    {                                                                                                                                                                                   \n" +
                               "        uint nodeID = _BVH_stack[--_BVH_stackPointer];                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "        uvec2 texelIDs = nodeID * 2u + uvec2(0u, 1u);                                                                                                                                   \n" +
                               "        vec4 nodeData0 = texelFetch(g.nodeSampler, ivec2(texelIDs.x % w.x, texelIDs.x / w.x), 0);                                                                                       \n" +
                               "        vec4 nodeData1 = texelFetch(g.nodeSampler, ivec2(texelIDs.y % w.x, texelIDs.y / w.x), 0);                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "        vec3 aabbMin = nodeData0.xyz;                                                                                                                                                   \n" +
                               "        vec3 aabbMax = nodeData1.xyz;                                                                                                                                                   \n" +
                               "                                                                                                                                                                                        \n" +
                               "        float d = _BVH_signedDistanceAABB(p, aabbMin, aabbMax);                                                                                                                         \n" +
                               "        if(signedDistance >= 0.0 && d >= signedDistance) continue;                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               "        uint left  = floatBitsToUint(nodeData0.w);                                                                                                                                      \n" +
                               "        uint right = floatBitsToUint(nodeData1.w);                                                                                                                                      \n" +
                               "                                                                                                                                                                                        \n" +
                               "        bool isLeaf = (left == 0u);                                                                                                                                                     \n" +
                               "        left -= 1u;                                                                                                                                                                     \n" +
                               "                                                                                                                                                                                        \n" +
                               "        if(isLeaf) // leaf                                                                                                                                                              \n" +
                               "        {                                                                                                                                                                               \n" +
                               "            uvec3 vIDs = floatBitsToUint(texelFetch(g.faceSampler, ivec2(right % w.z, right / w.z), 0).xyz);                                                                            \n" +
                               "                                                                                                                                                                                        \n" +
                               "            mat3 triangle = mat3(texelFetch(g.vertexSampler, ivec2(vIDs.x % w.y, vIDs.x / w.y), 0).xyz,                                                                                 \n" +
                               "                                texelFetch(g.vertexSampler, ivec2(vIDs.y % w.y, vIDs.y / w.y), 0).xyz,                                                                                  \n" +
                               "                                texelFetch(g.vertexSampler, ivec2(vIDs.z % w.y, vIDs.z / w.y), 0).xyz);                                                                                 \n" +
                               "                                                                                                                                                                                        \n" +
                               "            float new_sd = _BVH_signedDistanceTriangle(triangle, p);                                                                                                                    \n" +
                               "            float new_ud = abs(new_sd);                                                                                                                                                 \n" +
                               "                                                                                                                                                                                        \n" +
                               "            if(new_ud < signedDistance || signedDistance < 0.0)                                                                                                                         \n" +
                               "            {                                                                                                                                                                           \n" +
                               "                distanceSign = sign(new_sd);                                                                                                                                            \n" +
                               "                signedDistance = new_ud;                                                                                                                                                \n" +
                               "                triangleID = right;                                                                                                                                                     \n" +
                               "            }                                                                                                                                                                           \n" +
                               "        }                                                                                                                                                                               \n" +
                               "        else // branch                                                                                                                                                                  \n" +
                               "        {                                                                                                                                                                               \n" +
                               "            // add children to the _BVH_stack                                                                                                                                           \n" +
                               "            _BVH_stack[_BVH_stackPointer++] = left;                                                                                                                                     \n" +
                               "            _BVH_stack[_BVH_stackPointer++] = right;                                                                                                                                    \n" +
                               "        }                                                                                                                                                                               \n" +
                               "    }                                                                                                                                                                                   \n" +
                               "                                                                                                                                                                                        \n" +
                               "    signedDistance *= distanceSign;                                                                                                                                                     \n" +
                               "                                                                                                                                                                                        \n" +
                               "    return (_BVH_stackPointer < 1u && (depth < 0.0 || signedDistance < depth));                                                                                                         \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "bool textureGeoDataUDF( in samplerGeoData g,                                                                                                                                            \n" +
                               "                        const vec3 p,                                                                                                                                                   \n" +
                               "                        inout float unsignedDistance,                                                                                                                                   \n" +
                               "                        inout uint triangleID,                                                                                                                                          \n" +
                               "                        const uint maxIterations )                                                                                                                                      \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    bool retval = textureGeoDataSDF(g, p, unsignedDistance, triangleID, maxIterations);                                                                                                 \n" +
                               "    unsignedDistance = abs(unsignedDistance);                                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "    return retval;                                                                                                                                                                      \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "bool textureGeoDataSDF( in samplerGeoData g,                                                                                                                                            \n" +
                               "                        const vec3 p,                                                                                                                                                   \n" +
                               "                        inout float signedDistance,                                                                                                                                     \n" +
                               "                        const uint maxIterations )                                                                                                                                      \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    uint triangleID;                                                                                                                                                                    \n" +
                               "    return textureGeoDataSDF(g, p, signedDistance, triangleID, maxIterations);                                                                                                          \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "bool textureGeoDataUDF( in samplerGeoData g,                                                                                                                                            \n" +
                               "                        const vec3 p,                                                                                                                                                   \n" +
                               "                        inout float unsignedDistance,                                                                                                                                   \n" +
                               "                        const uint maxIterations )                                                                                                                                      \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    uint triangleID;                                                                                                                                                                    \n" +
                               "    return textureGeoDataUDF(g, p, unsignedDistance, triangleID, maxIterations);                                                                                                        \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "mediump float textureLods(in sampler2D sampler)                                                                                                                                         \n" +
                               "{                                                                                                                                                                                       \n" +
                               "   mediump ivec2 size = textureSize(sampler, 0);                                                                                                                                        \n" +
                               "   return (1.0 + floor(log2(float(max(size.x, size.y)))));                                                                                                                              \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "mediump float textureQueryLod(in sampler2D s, in vec2 uv)                                                                                                                               \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    #ifdef GLES_FRAGMENT_SHADER                                                                                                                                                         \n" +
                               "                                                                                                                                                                                        \n" +
                               "        uv = uv * vec2(textureSize(s, 0));                                                                                                                                              \n" +
                               "                                                                                                                                                                                        \n" +
                               "        mediump vec2 dx_vtc = dFdx(uv);                                                                                                                                                 \n" +
                               "        mediump vec2 dy_vtc = dFdy(uv);                                                                                                                                                 \n" +
                               "                                                                                                                                                                                        \n" +
                               "        mediump float delta_max_sqr = max(dot(dx_vtc, dx_vtc), dot(dy_vtc, dy_vtc));                                                                                                    \n" +
                               "        mediump float mml = 0.5 * log2(delta_max_sqr);                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "        return max(floor(mml), 0.0);                                                                                                                                                    \n" +
                               "                                                                                                                                                                                        \n" +
                               "    #else                                                                                                                                                                               \n" +
                               "                                                                                                                                                                                        \n" +
                               "        return 0.0;                                                                                                                                                                     \n" +
                               "                                                                                                                                                                                        \n" +
                               "    #endif                                                                                                                                                                              \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "vec4 texelFetch(in sampler2D s, in vec2 uv, in int lod)                                                                                                                                 \n" +                                                                               
                               "{                                                                                                                                                                                       \n" +
                               "    vec2 size = vec2(textureSize(s, lod));                                                                                                                                              \n" +
                               "    return texelFetch(s, ivec2(uv * size), lod); // on certain cards, textureLod() appears to interpolate with linear filtering even when GL_NEAREST is applied                         \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "mediump vec4 textureBicubicLod(in sampler2D sampler, in vec2 uv, in float lod)                                                                                                          \n" +
                               "{                                                                                                                                                                                       \n" +
                               "   lod = round(lod);                                                                                                                                                                    \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec2 texSize = vec2(textureSize(sampler, int(lod)));                                                                                                                         \n" +
                               "   mediump vec2 invTexSize = vec2(1.0) / texSize;                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "   uv = uv * texSize - 0.5;                                                                                                                                                             \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec2 fxy = fract(uv);                                                                                                                                                        \n" +
                               "   uv -= fxy;                                                                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - fxy.x;                                                                                                                                   \n" +
                               "   mediump vec4 s = n * n * n;                                                                                                                                                          \n" +
                               "                                                                                                                                                                                        \n" + 
                               "   mediump float x = s.x;                                                                                                                                                               \n" +
                               "   mediump float y = s.y - 4.0 * s.x;                                                                                                                                                   \n" +
                               "   mediump float z = s.z - 4.0 * s.y + 6.0 * s.x;                                                                                                                                       \n" +
                               "   mediump float w = 6.0 - x - y - z;                                                                                                                                                   \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec4 xcubic = vec4(x, y, z, w) * (1.0 / 6.0);                                                                                                                                \n" +
                               "                                                                                                                                                                                        \n" +
                               "   n = vec4(1.0, 2.0, 3.0, 4.0) - fxy.y;                                                                                                                                                \n" +
                               "   s = n * n * n;                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "   x = s.x;                                                                                                                                                                             \n" +
                               "   y = s.y - 4.0 * s.x;                                                                                                                                                                 \n" +
                               "   z = s.z - 4.0 * s.y + 6.0 * s.x;                                                                                                                                                     \n" +
                               "   w = 6.0 - x - y - z;                                                                                                                                                                 \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec4 ycubic = vec4(x, y, z, w) * (1.0 / 6.0);                                                                                                                                \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec4 c = uv.xxyy + vec2 (-0.5, +1.5).xyxy;                                                                                                                                   \n" +
                               "                                                                                                                                                                                        \n" +
                               "   s = vec4(xcubic.xz + xcubic.yw, ycubic.xz + ycubic.yw);                                                                                                                              \n" +
                               "   mediump vec4 offset = c + vec4 (xcubic.yw, ycubic.yw) / s;                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "   offset *= invTexSize.xxyy;                                                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec4 sample0 = textureLod(sampler, offset.xz, lod);                                                                                                                          \n" +
                               "   mediump vec4 sample1 = textureLod(sampler, offset.yz, lod);                                                                                                                          \n" +
                               "   mediump vec4 sample2 = textureLod(sampler, offset.xw, lod);                                                                                                                          \n" +
                               "   mediump vec4 sample3 = textureLod(sampler, offset.yw, lod);                                                                                                                          \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump float sx = s.x / (s.x + s.y);                                                                                                                                                \n" +
                               "   mediump float sy = s.z / (s.z + s.w);                                                                                                                                                \n" +
                               "                                                                                                                                                                                        \n" +
                               "   return mix(mix(sample3, sample2, sx), mix(sample1, sample0, sx), sy);                                                                                                                \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "mediump vec4 textureBicubic(in sampler2D sampler, in vec2 uv)                                                                                                                           \n" +
                               "{                                                                                                                                                                                       \n" +
                               "   mediump vec2 texSize = vec2(textureSize(sampler, 0));                                                                                                                                \n" +
                               "   mediump vec2 invTexSize = vec2(1.0) / texSize;                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "   uv = uv * texSize - 0.5;                                                                                                                                                             \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec2 fxy = fract(uv);                                                                                                                                                        \n" +
                               "   uv -= fxy;                                                                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - fxy.x;                                                                                                                                   \n" +
                               "   mediump vec4 s = n * n * n;                                                                                                                                                          \n" +
                               "                                                                                                                                                                                        \n" +   
                               "   mediump float x = s.x;                                                                                                                                                               \n" +
                               "   mediump float y = s.y - 4.0 * s.x;                                                                                                                                                   \n" +
                               "   mediump float z = s.z - 4.0 * s.y + 6.0 * s.x;                                                                                                                                       \n" +
                               "   mediump float w = 6.0 - x - y - z;                                                                                                                                                   \n" +
                               "                                                                                                                                                                                        \n" +   
                               "   mediump vec4 xcubic = vec4(x, y, z, w) * (1.0 / 6.0);                                                                                                                                \n" +
                               "                                                                                                                                                                                        \n" +      
                               "   n = vec4(1.0, 2.0, 3.0, 4.0) - fxy.y;                                                                                                                                                \n" +
                               "   s = n * n * n;                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" + 
                               "   x = s.x;                                                                                                                                                                             \n" +
                               "   y = s.y - 4.0 * s.x;                                                                                                                                                                 \n" +
                               "   z = s.z - 4.0 * s.y + 6.0 * s.x;                                                                                                                                                     \n" +
                               "   w = 6.0 - x - y - z;                                                                                                                                                                 \n" +
                               "                                                                                                                                                                                        \n" + 
                               "   mediump vec4 ycubic = vec4(x, y, z, w) * (1.0 / 6.0);                                                                                                                                \n" +
                               "                                                                                                                                                                                        \n" +  
                               "   mediump vec4 c = uv.xxyy + vec2 (-0.5, +1.5).xyxy;                                                                                                                                   \n" +
                               "                                                                                                                                                                                        \n" +
                               "   s = vec4(xcubic.xz + xcubic.yw, ycubic.xz + ycubic.yw);                                                                                                                              \n" +
                               "   mediump vec4 offset = c + vec4 (xcubic.yw, ycubic.yw) / s;                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "   offset *= invTexSize.xxyy;                                                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump vec4 sample0 = texture(sampler, offset.xz);                                                                                                                                  \n" +
                               "   mediump vec4 sample1 = texture(sampler, offset.yz);                                                                                                                                  \n" +
                               "   mediump vec4 sample2 = texture(sampler, offset.xw);                                                                                                                                  \n" +
                               "   mediump vec4 sample3 = texture(sampler, offset.yw);                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "   mediump float sx = s.x / (s.x + s.y);                                                                                                                                                \n" +
                               "   mediump float sy = s.z / (s.z + s.w);                                                                                                                                                \n" +
                               "                                                                                                                                                                                        \n" +
                               "   return mix(mix(sample3, sample2, sx), mix(sample1, sample0, sx), sy);                                                                                                                \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "mediump vec4 textureEnvRadiance(in sampler2D environmentMap, in vec3 n, in float roughness)                                                                                             \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    n.y *= 0.999;                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "    mediump float mipLevels = textureLods(environmentMap);                                                                                                                              \n" +
                               "    mediump float radianceLUT_mipID = mipLevels - 10.0; // 512x LOD                                                                                                                     \n" +
                               "                                                                                                                                                                                        \n" +
                               "    const mediump float texelSize = 1.0 / 512.0;                                                                                                                                        \n" +
                               "    mediump vec2 uv = vec2(atan(n.z, n.x) * 0.1591 + 0.5, asin(n.y) * 0.3183 + 0.5);                                                                                                    \n" +
                               "                                                                                                                                                                                        \n" +
                               "    mediump vec2 uv_lut = mix(vec2(0.0) + 0.5 * texelSize, vec2(0.25) - 0.5 * texelSize, uv);                                                                                           \n" +
                               "                                                                                                                                                                                        \n" +
                               "    mediump int mapID_base = int(floor(15.0 * roughness));                                                                                                                              \n" +
                               "    mediump int mapID_next = int(ceil(15.0 * roughness));                                                                                                                               \n" +
                               "                                                                                                                                                                                        \n" +
                               "    mediump vec2 uv_base = uv_lut + vec2(0.25 * float(mapID_base % 4), 0.25 * floor(float(mapID_base) / 4.0));                                                                          \n" +
                               "    mediump vec2 uv_next = uv_lut + vec2(0.25 * float(mapID_next % 4), 0.25 * floor(float(mapID_next) / 4.0));                                                                          \n" +
                               "                                                                                                                                                                                        \n" +
                               "    mediump vec4 base = textureLod(environmentMap, uv_base, radianceLUT_mipID);                                                                                                         \n" +
                               "    mediump vec4 next = textureLod(environmentMap, uv_next, radianceLUT_mipID);                                                                                                         \n" +
                               "                                                                                                                                                                                        \n" +
                               "    mediump float roughnessSquared = roughness * roughness;                                                                                                                             \n" +
                               "                                                                                                                                                                                        \n" +
                               "    mediump vec2 uv_grad = ((n.z > 0.0) ? vec2(1.0 - uv.x, uv.y) : uv);                                                                                                                 \n" +
                               "    mediump float radiance0_mipID = textureQueryLod(environmentMap, uv_grad);                                                                                                           \n" +
                               "    if(radiance0_mipID == radianceLUT_mipID) ++radiance0_mipID;                                                                                                                         \n" +
                               "                                                                                                                                                                                        \n" +
                               "    mediump vec4 radiance = mix(base, next, mod(roughness * 15.0, 1.0));                                                                                                                \n" +
                               "    radiance = mix(textureLod(environmentMap, uv, radiance0_mipID), radiance, smoothstep(0.01, 0.0625, roughnessSquared));                                                              \n" +
                               "                                                                                                                                                                                        \n" +
                               "    return radiance;                                                                                                                                                                    \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "mediump vec4 textureEnvIrradiance(in sampler2D environmentMap, in vec3 n)                                                                                                               \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    mediump float mipLevels = textureLods(environmentMap);                                                                                                                              \n" +
                               "    mediump float radianceLUT_mipID = mipLevels - 10.0; // 512x LOD                                                                                                                     \n" +
                               "                                                                                                                                                                                        \n" +
                               "    const mediump float texelSize = 1.0 / 512.0;                                                                                                                                        \n" +
                               "    mediump vec2 uv = vec2(atan(n.z, n.x) * 0.1591 + 0.5, asin(n.y) * 0.3183 + 0.5);                                                                                                    \n" +
                               "                                                                                                                                                                                        \n" +
                               "    mediump vec2 uv_lut = mix(vec2(0.0) + 0.5 * texelSize, vec2(0.25) - 0.5 * texelSize, uv) + vec2(0.75);                                                                              \n" +
                               "    mediump vec4 irradiance = textureLod(environmentMap, uv_lut, radianceLUT_mipID);                                                                                                    \n" +
                               "                                                                                                                                                                                        \n" +
                               "    return irradiance;                                                                                                                                                                  \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "mediump vec3 textureEnvFogColor(in sampler2D environmentMap, in vec3 eyeVector)                                                                                                         \n" + 
                               "{                                                                                                                                                                                       \n" + 
                               "    mediump float mipLevels = textureLods(environmentMap);                                                                                                                              \n" + 
                               "    mediump float radianceLUT_mipID = mipLevels - 10.0; // 512x LOD                                                                                                                     \n" + 
                               "                                                                                                                                                                                        \n" + 
                               "    const mediump float texelSize = 1.0 / 512.0;                                                                                                                                        \n" + 
                               "    mediump vec2 uv = vec2(atan(eyeVector.z, eyeVector.x) * 0.1591 + 0.5, asin(eyeVector.y) * 0.3183 + 0.5);                                                                            \n" + 
                               "                                                                                                                                                                                        \n" + 
                               "    mediump vec2 uv_lut = mix(vec2(0.0) + 0.5 * texelSize, vec2(0.25) - 0.5 * texelSize, uv) + vec2(0.25, 0.0);                                                                         \n" + 
                               "    mediump vec4 fog = textureLod(environmentMap, uv_lut, radianceLUT_mipID);                                                                                                           \n" + 
                               "    fog.rgb = pow(fog.rgb, vec3(1.0 / 2.24));                                                                                                                                           \n" +
                               "                                                                                                                                                                                        \n" + 
                               "#ifdef GLES_FRAGMENT_SHADER                                                                                                                                                             \n" +
                               "    mediump float oldSeed = _randomSeed;                                                                                                                                                \n" +
                               "    srand(glTime * sin(glTime) + (gl_FragCoord.x + 4096.0 * gl_FragCoord.y) / 4096.0);                                                                                                  \n" +
                               "    fog.rgb = max(fog.rgb + (1.0 / 255.0) * (-1.0 + 2.0 * random()), vec3(0)); // removes banding artifacts via dithering                                                               \n" +
                               "    _randomSeed = oldSeed;                                                                                                                                                              \n" +
                               "#endif                                                                                                                                                                                  \n" +
                               "                                                                                                                                                                                        \n" +
                               "    return fog.rgb;                                                                                                                                                                     \n" + 
                               "}                                                                                                                                                                                       \n" + 
                               "                                                                                                                                                                                        \n" +
                               "mediump vec3 textureEnvLightVector(in sampler2D environmentMap)                                                                                                                         \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    mediump int radianceLUT_mipID = int(textureLods(environmentMap) - 10.0); // 512x512                                                                                                 \n" +
                               "    return normalize(texelFetch(environmentMap, ivec2(0, 0), radianceLUT_mipID).xyz);                                                                                                   \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n" +
                               "mediump vec3 textureEnvLightColor(in sampler2D environmentMap)                                                                                                                          \n" +
                               "{                                                                                                                                                                                       \n" +
                               "    mediump int radianceLUT_mipID = int(textureLods(environmentMap) - 10.0); // 512x512                                                                                                 \n" +
                               "    return texelFetch(environmentMap, ivec2(1, 0), radianceLUT_mipID).xyz;                                                                                                              \n" +
                               "}                                                                                                                                                                                       \n" +
                               "                                                                                                                                                                                        \n"+
                               "struct BitStream                                                                                                                                                                        \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    uvec4 data;                                                                                                                                                                         \n"+
                               "    int   padding;                                                                                                                                                                      \n"+
                               "};                                                                                                                                                                                      \n"+
                               "                                                                                                                                                                                        \n"+
                               "const int BitStream_format_8bit  = 8;                                                                                                                                                   \n"+
                               "const int BitStream_format_16bit = 16;                                                                                                                                                  \n"+
                               "const int BitStream_format_32bit = 32;                                                                                                                                                  \n"+
                               "                                                                                                                                                                                        \n"+
                               "BitStream BitStream_init() {                                                                                                                                                            \n"+
                               "    return BitStream(uvec4(0), 0);                                                                                                                                                      \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_rewind(inout BitStream bitstream) {                                                                                                                                      \n"+
                               "    bitstream.padding = 0;                                                                                                                                                              \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_setPosition(inout BitStream bitstream, const int padding) {                                                                                                              \n"+
                               "    bitstream.padding = padding;                                                                                                                                                        \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "// bit streamed write / read                                                                                                                                                            \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, in int size, in uint data)                                                                                                              \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    int i = bitstream.padding >> 5u;  // / 32                                                                                                                                           \n"+
                               "    int s = bitstream.padding & 0x1F; // % 32                                                                                                                                           \n"+
                               "    int r = max((s + size) - 32, 0);  // remainder                                                                                                                                      \n"+
                               "                                                                                                                                                                                        \n"+
                               "    bitstream.padding += size;                                                                                                                                                          \n"+
                               "    size = size - r;                                                                                                                                                                    \n"+
                               "                                                                                                                                                                                        \n"+
                               "    bitstream.data[i + 0] |= (data & ((size < 32) ? (1u << size) - 1u : -1u)) << s;                                                                                                     \n"+
                               "    bitstream.data[i + 1] |= ((r > 0) ? (data >> size) & ((1u << r) - 1u) : 0u);                                                                                                        \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "uint BitStream_read(inout BitStream bitstream, in int size)                                                                                                                             \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    int i = bitstream.padding >> 5u;  // / 32                                                                                                                                           \n"+
                               "    int s = bitstream.padding & 0x1F; // % 32                                                                                                                                           \n"+
                               "    int r = max((s + size) - 32, 0);  // remainder                                                                                                                                      \n"+
                               "                                                                                                                                                                                        \n"+
                               "    uint data = ((bitstream.data[i] >> s) | ((r > 0) ? (bitstream.data[i + 1] << (size - r)) : 0u));                                                                                    \n"+
                               "    data &= ((size < 32) ? (1u << size) - 1u : -1u);                                                                                                                                    \n"+
                               "                                                                                                                                                                                        \n"+
                               "    bitstream.padding += size;                                                                                                                                                          \n"+
                               "                                                                                                                                                                                        \n"+
                               "    return data;                                                                                                                                                                        \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "// bool, bvec2, bvec3, bvec4                                                                                                                                                            \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, in bool flag) {                                                                                                                         \n"+
                               "    BitStream_write(bitstream, 1, uint(flag));                                                                                                                                          \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, out bool flag) {                                                                                                                         \n"+
                               "    flag = bool(BitStream_read(bitstream, 1));                                                                                                                                          \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, in bvec2 flag)                                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, flag.x);                                                                                                                                                 \n"+
                               "    BitStream_write(bitstream, flag.y);                                                                                                                                                 \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, out bvec2 flag)                                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, flag.x);                                                                                                                                                  \n"+
                               "    BitStream_read(bitstream, flag.y);                                                                                                                                                  \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, in bvec3 flag)                                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, flag.x);                                                                                                                                                 \n"+
                               "    BitStream_write(bitstream, flag.y);                                                                                                                                                 \n"+
                               "    BitStream_write(bitstream, flag.z);                                                                                                                                                 \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, out bvec3 flag)                                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, flag.x);                                                                                                                                                  \n"+
                               "    BitStream_read(bitstream, flag.y);                                                                                                                                                  \n"+
                               "    BitStream_read(bitstream, flag.z);                                                                                                                                                  \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, in bvec4 flag)                                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, flag.x);                                                                                                                                                 \n"+
                               "    BitStream_write(bitstream, flag.y);                                                                                                                                                 \n"+
                               "    BitStream_write(bitstream, flag.z);                                                                                                                                                 \n"+
                               "    BitStream_write(bitstream, flag.w);                                                                                                                                                 \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, out bvec4 flag)                                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, flag.x);                                                                                                                                                  \n"+
                               "    BitStream_read(bitstream, flag.y);                                                                                                                                                  \n"+
                               "    BitStream_read(bitstream, flag.z);                                                                                                                                                  \n"+
                               "    BitStream_read(bitstream, flag.w);                                                                                                                                                  \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "// uint, uvec2, uvec3, uvec4                                                                                                                                                            \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out uint ui) {                                                                                                         \n"+
                               "    ui = BitStream_read(bitstream, format);                                                                                                                                             \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in uvec2 ui)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, format, ui.x);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, ui.y);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out uvec2 ui)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, ui.x);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, ui.y);                                                                                                                                            \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in uvec3 ui)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, format, ui.x);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, ui.y);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, ui.z);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out uvec3 ui)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, ui.x);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, ui.y);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, ui.z);                                                                                                                                            \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in uvec4 ui)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, format, ui.x);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, ui.y);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, ui.z);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, ui.w);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out uvec4 ui)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, ui.x);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, ui.y);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, ui.z);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, ui.w);                                                                                                                                            \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "// int, ivec2, ivec3, ivec4                                                                                                                                                             \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in int si)                                                                                                            \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    if(format == BitStream_format_16bit) si -= 32768;                                                                                                                                   \n"+
                               "    else if(format == BitStream_format_8bit) si -= 128;                                                                                                                                 \n"+
                               "                                                                                                                                                                                        \n"+
                               "    BitStream_write(bitstream, format, uint(si));                                                                                                                                       \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out int si)                                                                                                            \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    si = int(BitStream_read(bitstream, format));                                                                                                                                        \n"+
                               "                                                                                                                                                                                        \n"+
                               "    if(format == BitStream_format_16bit) si -= 32768;                                                                                                                                   \n"+
                               "    else if(format == BitStream_format_8bit) si -= 128;                                                                                                                                 \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in ivec2 si)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, format, si.x);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, si.y);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out ivec2 si)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, si.x);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, si.y);                                                                                                                                            \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in ivec3 si)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, format, si.x);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, si.y);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, si.z);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out ivec3 si)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, si.x);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, si.y);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, si.z);                                                                                                                                            \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in ivec4 si)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, format, si.x);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, si.y);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, si.z);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, si.w);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out ivec4 si)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, si.x);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, si.y);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, si.z);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, si.w);                                                                                                                                            \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "// float, vec2, vec3, vec4                                                                                                                                                              \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in float fp)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    uint data;                                                                                                                                                                          \n"+
                               "    if(format == BitStream_format_32bit) data = floatBitsToUint(fp);                                                                                                                    \n"+
                               "    else if(format == BitStream_format_16bit) data = packHalf2x16(vec2(fp, 0));                                                                                                         \n"+
                               "    else data = uint(round(fp * 255.0));                                                                                                                                                \n"+
                               "                                                                                                                                                                                        \n"+
                               "    BitStream_write(bitstream, format, data);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out float fp)                                                                                                          \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    uint data = BitStream_read(bitstream, format);                                                                                                                                      \n"+
                               "                                                                                                                                                                                        \n"+
                               "    if(format == BitStream_format_32bit) fp = uintBitsToFloat(data);                                                                                                                    \n"+
                               "    else if(format == BitStream_format_16bit) fp = unpackHalf2x16(data).x;                                                                                                              \n"+
                               "    else fp = float(data) / 255.0;                                                                                                                                                      \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in vec2 fp)                                                                                                           \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, format, fp.x);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, fp.y);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out vec2 fp)                                                                                                           \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, fp.x);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, fp.y);                                                                                                                                            \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in vec3 fp)                                                                                                           \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, format, fp.x);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, fp.y);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, fp.z);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out vec3 fp)                                                                                                           \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, fp.x);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, fp.y);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, fp.z);                                                                                                                                            \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_write(inout BitStream bitstream, const int format, in vec4 fp)                                                                                                           \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_write(bitstream, format, fp.x);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, fp.y);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, fp.z);                                                                                                                                           \n"+
                               "    BitStream_write(bitstream, format, fp.w);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_read(inout BitStream bitstream, const int format, out vec4 fp)                                                                                                           \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, fp.x);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, fp.y);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, fp.z);                                                                                                                                            \n"+
                               "    BitStream_read(bitstream, format, fp.w);                                                                                                                                            \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "// custom packing functions                                                                                                                                                             \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_writeNormal(inout BitStream bitstream, const int format, in vec3 n)                                                                                                      \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    n = normalize(n);                                                                                                                                                                   \n"+
                               "                                                                                                                                                                                        \n"+
                               "    n.xy /= dot(abs(n), vec3(1));                                                                                                                                                       \n"+
                               "    n.xy = 0.5 + 0.5 * mix(n.xy, (1.0 - abs(n.yx)) * vec2(((n.x >= 0.0) ? 1.0 : -1.0), ((n.y >= 0.0) ? 1.0 : -1.0)), step(n.z, 0.0));                                                   \n"+
                               "                                                                                                                                                                                        \n"+
                               "    BitStream_write(bitstream, format, n.xy);                                                                                                                                           \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "void BitStream_readNormal(inout BitStream bitstream, const int format, out vec3 n)                                                                                                      \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    BitStream_read(bitstream, format, n.xy);                                                                                                                                            \n"+
                               "                                                                                                                                                                                        \n"+
                               "    n.xy = -1.0 + 2.0 * n.xy;                                                                                                                                                           \n"+
                               "    n.z = 1.0 - abs(n.x) - abs(n.y);                                                                                                                                                    \n"+
                               "                                                                                                                                                                                        \n"+
                               "    if(n.z < 0.0) n.xy = (1.0 - abs(n.yx)) * vec2(((n.x >= 0.0) ? 1.0 : -1.0), ((n.y >= 0.0) ? 1.0 : -1.0));                                                                            \n"+
                               "                                                                                                                                                                                        \n"+
                               "    n = normalize(n);                                                                                                                                                                   \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "// encoding / decoding                                                                                                                                                                  \n"+
                               "                                                                                                                                                                                        \n"+
                               "vec4 BitStream_encode(const BitStream bitstream, const int format)                                                                                                                      \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    if(format == BitStream_format_8bit)                                                                                                                                                 \n"+
                               "    {                                                                                                                                                                                   \n"+
                               "        return vec4((bitstream.data.x & uvec4(0x000000FFu, 0x0000FF00u, 0x00FF0000u, 0xFF000000u)) >> uvec4(0, 8, 16, 24)) / 255.0;                                                     \n"+
                               "    }                                                                                                                                                                                   \n"+
                               "    else if(format == BitStream_format_16bit) // bugged !! DO NOT USE                                                                                                                   \n"+
                               "    {                                                                                                                                                                                   \n"+
                               "        uvec4 bytesX = ((bitstream.data.x & uvec4(0x000000FFu, 0x0000FF00u, 0x00FF0000u, 0xFF000000u)) >> uvec4(0, 8, 16, 24));                                                         \n"+
                               "        uvec4 bytesY = ((bitstream.data.y & uvec4(0x000000FFu, 0x0000FF00u, 0x00FF0000u, 0xFF000000u)) >> uvec4(0, 8, 16, 24));                                                         \n"+
                               "                                                                                                                                                                                        \n"+
                               "        return vec4(bytesX.xy + 256u * bytesX.zw, bytesY.xy + 256u * bytesY.zw);                                                                                                        \n"+
                               "    }                                                                                                                                                                                   \n"+
                               "    else if(format == BitStream_format_32bit)                                                                                                                                           \n"+
                               "    {                                                                                                                                                                                   \n"+
                               "        return uintBitsToFloat(bitstream.data);                                                                                                                                         \n"+
                               "    }                                                                                                                                                                                   \n"+
                               "                                                                                                                                                                                        \n"+
                               "    return vec4(0);                                                                                                                                                                     \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n"+
                               "BitStream BitStream_decode(const vec4 encoded, const int format)                                                                                                                        \n"+
                               "{                                                                                                                                                                                       \n"+
                               "    uvec4 data = uvec4(0);                                                                                                                                                              \n"+
                               "                                                                                                                                                                                        \n"+
                               "    if(format == BitStream_format_8bit)                                                                                                                                                 \n"+
                               "    {                                                                                                                                                                                   \n"+
                               "        data = uvec4(round(encoded * 255.0));                                                                                                                                           \n"+
                               "        data = uvec4(((data.x << 0) | (data.y << 8) | (data.z << 16) | (data.w << 24)), 0, 0, 0);                                                                                       \n"+
                               "    }                                                                                                                                                                                   \n"+
                               "    else if(format == BitStream_format_16bit) // bugged !! DO NOT USE                                                                                                                   \n"+
                               "    {                                                                                                                                                                                   \n"+
                               "        data = uvec4(encoded);                                                                                                                                                          \n"+
                               "                                                                                                                                                                                        \n"+
                               "        uvec4 bytesX = uvec4(data.xy % 256u, data.xy / 256u);                                                                                                                           \n"+
                               "        uvec4 bytesY = uvec4(data.zw % 256u, data.zw / 256u);                                                                                                                           \n"+
                               "                                                                                                                                                                                        \n"+
                               "        data.x  = ((bytesX.x << 0) | (bytesX.y << 8) | (bytesX.z << 16) | (bytesX.w << 24));                                                                                            \n"+
                               "        data.y  = ((bytesY.x << 0) | (bytesY.y << 8) | (bytesY.z << 16) | (bytesY.w << 24));                                                                                            \n"+
                               "        data.zw = uvec2(0);                                                                                                                                                             \n"+
                               "    }                                                                                                                                                                                   \n"+
                               "    else if(format == BitStream_format_32bit)                                                                                                                                           \n"+
                               "    {                                                                                                                                                                                   \n"+
                               "        data = floatBitsToUint(encoded);                                                                                                                                                \n"+
                               "    }                                                                                                                                                                                   \n"+
                               "                                                                                                                                                                                        \n"+
                               "    return BitStream(data, 0);                                                                                                                                                          \n"+
                               "}                                                                                                                                                                                       \n"+
                               "                                                                                                                                                                                        \n");
                               
    this.__appendShadingHeader(glDepthTracingTexture.__glslAPI());
}

glContext.__reservedUniformBlockUnits = 2;

glContext.__positionAttribLocation          = 0;
glContext.__texCoordAttribLocation          = 1;
glContext.__tangentAttribLocation           = 2;
glContext.__normalAttribLocation            = 3;
glContext.__bonesIndicesAttribLocation      = 4;
glContext.__bonesWeightsAttribLocation      = 5;
glContext.__animationMatrixIDAttribLocation = 6;

glContext.__getRootPath = function()
{
    let parts = document.location.href.split('/');
    parts[parts.length - 1] = '';
  
    return parts.join('/');
}

glContext.prototype.__hookPointerLockEvents = function()
{
    let self = this;

    function onPointerLockChange() {
        self.__pointerLocked = ((document.pointerLockElement || document.mozPointerLockElement) != null); 
    }

    document.addEventListener("pointerlockchange",    onPointerLockChange);
    document.addEventListener("mozpointerlockchange", onPointerLockChange);

    document.addEventListener("mousedown", function(e) {
        if(e.button == 0 && self.__pointerLockEngaged && !self.isPointerLocked()) self.__canvas.requestPointerLock();
    });
}

glContext.prototype.enablePointerLock = function(flag) {
    this.__pointerLockEngaged = ((flag != null) ? flag : true);
}

glContext.prototype.isPointerLocked = function() {
    return this.__pointerLocked;
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

glContext.prototype.createComputeProgram = function(programSrcUrl, onLoad)
{
    let self = this;
    let program = new glComputeProgram(this);

    this.__pendingAssets.push();
    program.loadAsync(programSrcUrl, function(program, didCompile, error)
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

            vertex.texCoord.x =       uvBuffer[uvIndexBuffer[i] * 2 + 0];
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

        if(groups.size == 0) groups.set("", vertices);

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

glContext.prototype.createMeshFromGltfFile = function(path, onLoad)
{
    let mesh = new glMesh(this);
    
    let self = this;
    self.__pendingAssets.push();

    this.loadFile(path, "json", function(fileData)
    {
        mesh.clear();

        if(fileData == null) 
        {
            self.__pendingAssets.pop();
            if(onLoad != null) onLoad(mesh);

            return;
        }

        var basePath = '';
        let i = path.lastIndexOf('/');
        if(i >= 0) basePath = path.substring(0, i + 1);

        self.loadGltfFileFromMemory(fileData, function(bufferPath, resolve) {
            self.loadFile((basePath + bufferPath), "arraybuffer", resolve);
        },  
        function(texturePath, resolve) {
            resolve(null);
        }, 
        function(groups, animator, gltf)
        {
            for(let i = 0, e = groups.length; i != e; ++i) mesh.add(groups[i].mesh);
            self.__pendingAssets.pop();
            
            if(onLoad != null) onLoad(mesh);
        });
    });

    return mesh;
}

glContext.prototype.createTextureHDR = function(uri, onLoad)
{
    let self = this;
    let gl = this.getGL();

    let texture = new glTextureRGBA16F(this, 1, 1, new Float32Array([0, 0, 0, 0]));
    texture.__ready = false;

    self.__pendingAssets.push();

    let imageHDR = new HDRImage();
    imageHDR.onload = function()
    {
        let rawDataRGBA16F = new Float32Array(imageHDR.width * imageHDR.height * 4);
        let rawDataRGB32F  = imageHDR.dataFloat.slice(0);
    
        let lightVector = null;
        let lightColor  = null;
    
        for(let i = 0, w = imageHDR.width, h = imageHDR.height, e = w * h, w3 = w * 3, e3 = e * 3, toGamma = 1.0 / 2.24; i < e; ++i)
        {
            let j = e3 - w3 - Math.floor(i / w) * w3 + (i % w) * 3;
    
            let sampleColor = new glVector3f(rawDataRGB32F[j + 0], rawDataRGB32F[j + 1], rawDataRGB32F[j + 2]);
            if(lightColor == null || glVector3f.dot(sampleColor, sampleColor) > glVector3f.dot(lightColor, lightColor))
            {
                x = Math.floor(j / 3);
                y = Math.floor(x / w);
                x = x % w;
    
                x /= (w - 1);
                y /= (h - 1);
    
                let phi   = Math.PI * y;
                let theta = Math.PI * x * 2.0;
    
                lightVector = glVector3f.normalize(-Math.cos(theta) * Math.sin(phi), Math.cos(phi), -Math.sin(theta) * Math.sin(phi)).flip();
                lightColor  = sampleColor;
            }
    
            rawDataRGBA16F[i * 4 + 0] = Math.min(Math.pow(Math.max(rawDataRGB32F[j + 0], 0.0), toGamma), 65503.0);
            rawDataRGBA16F[i * 4 + 1] = Math.min(Math.pow(Math.max(rawDataRGB32F[j + 1], 0.0), toGamma), 65503.0);
            rawDataRGBA16F[i * 4 + 2] = Math.min(Math.pow(Math.max(rawDataRGB32F[j + 2], 0.0), toGamma), 65503.0);
            rawDataRGBA16F[i * 4 + 3] = 1.0;
        }
    
        texture.set(imageHDR.width, imageHDR.height, rawDataRGBA16F);
        texture.setWrapMode(gl.REPEAT);
        texture.generateMipmap(true);
        
        texture.directionalLightVector = lightVector;
        texture.directionalLightColor = null;
        texture.__ready = true;
            
        self.__pendingAssets.pop();

        if(onLoad != null) onLoad(texture, rawDataRGBA16F);
    }
    imageHDR.src = uri;

    return texture;
}

glContext.prototype.createTexture = function(image, onLoad, customWidth, customHeight)
{
    if((typeof image === "string" || image instanceof String) && !(image.startsWith("data:image")) && (image.toLowerCase()).endsWith(".hdr")) {
        return this.createTextureHDR(image, onLoad);
    }

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
    let environmentMap = new glEnvironmentMap(this, this.createTexture(image, function(texture)
    {
        environmentMap.__updateSkyMap(texture, customWidth, customHeight);

        environmentMap.setDirectionalLightColor(texture.directionalLightColor);
        environmentMap.setDirectionalLightVector(texture.directionalLightVector);
                
        environmentMap.update();
        environmentMap.updateRadiance();
        
        if(onLoad != null) onLoad(environmentMap);

    }, customWidth, customHeight ));

    return environmentMap;
}

glContext.prototype.getGraphicsCardModelName = function()
{
    if(this.__graphicsCardName == null)
    {
        let gl = this.getGL();
        this.__graphicsCardName = gl.getParameter(((this.__extensions.rendererDebugger != null) ? this.__extensions.rendererDebugger.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    }

    return this.__graphicsCardName;
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
    gl.bindAttribLocation(programID, glContext.__tangentAttribLocation,           "_glTangent");
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

        if(!this.__initialized)
        {
            this.__timeElapsed = 0.0;
            this.__initialized = true;
            this.__prfProfiler.clear();

            if(this.__onInitCallback != null) this.__onInitCallback(gl);
        }

        function animationLoop()
        {
            let shouldEnableInputManager = (!self.__pointerLockEngaged || self.isPointerLocked());
            self.__inputDeviceManager.enable(shouldEnableInputManager);

            self.__animationFrameRequestID = glContext.__requestAnimationFrame(animationLoop);

            let targetWidth  = Math.max(Math.round(self.getClientWidth()  * self.getPixelRatio()), 1);
            let targetHeight = Math.max(Math.round(self.getClientHeight() * self.getPixelRatio()), 1);
            
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
            
            self.__inputDeviceManager.update();
            glAudioPlayer.__update(dt);

            let shouldCaptureWithAlphaChannel    = (self.__streamCapturing &&  self.__streamCaptureWithAlpha);
            let shouldCaptureWithoutAlphaChannel = (self.__streamCapturing && !self.__streamCaptureWithAlpha);

            if(shouldCaptureWithAlphaChannel) self.__streamCapture.capture(self.__canvas);

            self.unbindFramebuffer();
            gl.colorMask(false, false, false, true);
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.colorMask(true, true, true, true);
        
            if(shouldCaptureWithoutAlphaChannel) self.__streamCapture.capture(self.__canvas);

            self.__prfProfiler.update();
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

glContext.prototype.isProfilingSupported = function() {
    return this.__prfProfiler.supported();
}

glContext.prototype.isProfilingEnabled = function() {
    return this.__prfProfiler.enabled();
}

glContext.prototype.enableProfiling = function(flag) {
    this.__prfProfiler.enable(flag);
} 

glContext.prototype.getProfiling = function(sectionName) {
    return this.__prfProfiler.get(sectionName);
}

glContext.prototype.clearProfiling = function(sectionName) {
    this.__prfProfiler.clear(sectionName);
}

glContext.prototype.createProfilingSection = function() {
    return this.__prfProfiler.create();
}

glContext.prototype.startProfilingSection = function(sectionName) {
    this.__prfProfiler.push(sectionName);
}

glContext.prototype.endProfilingSection = function() {
    this.__prfProfiler.pop();
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

glContext.prototype.enableHiDPI = function(flag) {
    this.__enableSuperSamplingHiDPI = flag;
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

glContext.prototype.getPixelRatio = function() {
    return Math.min(window.devicePixelRatio, (this.__enableSuperSamplingHiDPI ? window.devicePixelRatio : 1.0));
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

glContext.prototype.isVertexBufferBound = function(buffer) {
    return (this.__activeBuffer == buffer);
}

glContext.prototype.unbindVertexBuffer = function(buffer) {
    if(this.isVertexBufferBound(buffer)) this.bindVertexBuffer(null);
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

glContext.prototype.isVertexArrayBound = function(vertexArray) {
    return (this.__activeVertexArray == vertexArray);
}

glContext.prototype.unbindVertexArray = function() {
    this.bindVertexArray(null);
}

glContext.prototype.drawBuffers = function(attachmentsMask)
{
    this.__activeDrawBuffers = attachmentsMask.slice(0);
    this.__gl.drawBuffers(attachmentsMask);
}

glContext.prototype.getActiveDrawBuffers = function() {
    return ((this.__activeDrawBuffers != null) ? this.__activeDrawBuffers.slice(0) : [this.getGL().NONE]);
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
    this.setOrthographicProjection(-1.0, 1.0, -1.0, 1.0, -1.0, +1.0);
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
    
    this.setOrthographicProjection(-aabbProjectedSize.x, aabbProjectedSize.x, -aabbProjectedSize.y, aabbProjectedSize.y, -1e4, +1e4);
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
    if(width  == null) width  = texture.getWidth();
    if(height == null) height = texture.getHeight();
    
    let data = texture.toUint8Array(width, height);
    
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
