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
    
    this.setTexture(skyMap, size);

    this.__envMappingProgram = glEnvironmentMap.__genEnvMappingProgram(ctx);
    this.__skyMapIntensityUniform = this.__envMappingProgram.getUniform("skyMapIntensity");
    
    this.__radianceIntegralPDF = glEnvironmentMap.__genRadianceIntegralPDF_LUT(ctx);
    this.__radianceSolverProgram = glEnvironmentMap.__genRadianceSolverProgram(ctx);
    this.__radianceDirectLightColUniform = this.__radianceSolverProgram.getUniform("lightColor");
    this.__radianceDirectLightVecUniform = this.__radianceSolverProgram.getUniform("lightVector");
    this.__radianceSamplesPerFrameUniform = this.__radianceSolverProgram.getUniform("samplesPerFrame");
    this.__radianceIterationCountUniform = this.__radianceSolverProgram.getUniform("iterationID");
    this.__directionalLightVector = new glVector3f(0);
    this.__directionalLightColor  = new glVector3f(0);
    this.__pendingRadianceIntegrationSteps = 1024;
        
    this.__radianceFramebuffer = [new glFramebuffer(ctx, 512, 512), new glFramebuffer(ctx, 512, 512)];
    this.__radianceIntegral = [null, null];
    this.__radianceResolved = [null, null];
    this.__radianceSmoothed = [null, null];
    this.__radianceIntegralIterationID = 0;
    
    for(let i = 0; i < 2; ++i)
    {
        this.__radianceIntegral[i] = this.__radianceFramebuffer[i].createColorAttachmentRGBA32F();
        this.__radianceResolved[i] = this.__radianceFramebuffer[i].createColorAttachmentRGBA32F();
        this.__radianceSmoothed[i] = this.__radianceFramebuffer[i].createColorAttachmentRGBA32F();

        this.__radianceIntegral[i].setFilterMode(gl.LINEAR, gl.LINEAR);
        this.__radianceResolved[i].setFilterMode(gl.LINEAR, gl.LINEAR);
        this.__radianceSmoothed[i].setFilterMode(gl.LINEAR, gl.LINEAR);

        this.__radianceIntegral[i].setWrapMode(gl.CLAMP_TO_EDGE);
        this.__radianceResolved[i].setWrapMode(gl.CLAMP_TO_EDGE);
        this.__radianceSmoothed[i].setWrapMode(gl.CLAMP_TO_EDGE);
    }
   
    this.__onDrawCallback = onDrawCallback; 
    this.__faceID = 0;
}  

glEnvironmentMap.prototype.setTexture = function(skyMap, size)
{
    let gl = ctx.getGL();
   
    this.free();

    if(size == null) size = Math.max(skyMap.getWidth(), skyMap.getHeight());
    size = Math.min(Math.max(closestPot(size), 1024), 4096);
    
    let halfSize = Math.floor(size * 0.5);

    this.__faceFramebuffer = new glFramebuffer(ctx, halfSize, halfSize);
    this.__faceMap = this.__faceFramebuffer.createColorAttachmentRGBA16F();
    this.__faceFramebuffer.createDepthAttachment16();

    this.__faceMap.setFilterMode(gl.LINEAR, gl.LINEAR);
    this.__faceMap.setWrapMode(gl.CLAMP_TO_EDGE);

    this.__environmentFramebuffer = null; 
    this.__environmentMap = null; 

    this.__environmentFramebuffer = new glFramebuffer(ctx, size, size);
    this.__environmentMap = this.__environmentFramebuffer.createColorAttachmentRGBA16F();
    this.__environmentMap.setWrapMode(gl.CLAMP_TO_EDGE);
    this.__environmentMap.generateMipmap(false);

    this.__skyMapGammaSpace = this.__skyMap = skyMap;
    if(skyMap.__renderTexture != null) this.__skyMapGammaSpace = null;

    this.__radianceLutFramebuffer = new glFramebuffer(ctx, 512, 512);
    let mipLod_512x = (1 + Math.floor(Math.log2(Math.max(this.__environmentMap.getWidth(), this.__environmentMap.getHeight())))) - 10; 
    this.__radianceLUT = this.__radianceLutFramebuffer.createColorAttachmentRGBA16F(this.__environmentMap.__renderTexture, mipLod_512x);
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
                                     "vec3 uvToPolar(in vec2 uv)                                                                                                     \n" +
                                     "{                                                                                                                              \n" +
                                     "    float phi = PI * uv.y;                                                                                                     \n" +
                                     "    float theta = PI_2 * uv.x;                                                                                                 \n" +
                                     "                                                                                                                               \n" +
                                     "    return normalize(vec3(-cos(theta) * sin(phi), -cos(phi), -sin(theta) * sin(phi)));                                         \n" +
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

glEnvironmentMap.__genRadianceIntegralPDF_LUT = function(ctx)
{
    if(glEnvironmentMap.__radiancePdfLUT_instances == null) glEnvironmentMap.__radiancePdfLUT_instances = new Map();

    let pdfLUT_texture = glEnvironmentMap.__radiancePdfLUT_instances.get(ctx);
    if(pdfLUT_texture == null) 
    {
        let program = new glProgram(ctx, "#version 300 es                            \n" +
                                         "                                           \n" +
                                         "precision highp float;                     \n" +
                                         "                                           \n" +
                                         "out vec2 texCoords;                        \n" +
                                         "                                           \n" +
                                         "void main()                                \n" +
                                         "{                                          \n" +
                                         "    texCoords = glTexCoord;                \n" +
                                         "    gl_Position = vec4(glVertex.xyz, 1.0); \n" +
                                         "}                                          \n",

                                         "#version 300 es                                                                                                                                                                                                 \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "precision mediump float;                                                                                                                                                                                        \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "in vec2 texCoords;                                                                                                                                                                                              \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "layout(location = 0) out lowp vec4 pdf;                                                                                                                                                                         \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "const float PI        = 3.1415926535897932384626433832795;                                                                                                                                                      \n" +
                                         "const float PI_2      = PI * 2.0;                                                                                                                                                                               \n" +
                                         "const float PI_OVER_2 = PI * 0.5;                                                                                                                                                                               \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "vec3 uvToPolar(in vec2 uv)                                                                                                                                                                                      \n" +
                                         "{                                                                                                                                                                                                               \n" +
                                         "    float phi = PI * uv.y;                                                                                                                                                                                      \n" +
                                         "    float theta = PI_2 * uv.x;                                                                                                                                                                                  \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    return normalize(vec3(-cos(theta) * sin(phi), -cos(phi), -sin(theta) * sin(phi)));                                                                                                                          \n" +
                                         "}                                                                                                                                                                                                               \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "float RadicalInverse_VdC(uint bits)                                                                                                                                                                             \n" +
                                         "{                                                                                                                                                                                                               \n" +
                                         "    bits = (bits << 16u) | (bits >> 16u);                                                                                                                                                                       \n" +
                                         "    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);                                                                                                                                         \n" +
                                         "    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);                                                                                                                                         \n" +
                                         "    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);                                                                                                                                         \n" +
                                         "    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);                                                                                                                                         \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    return float(bits) * 2.3283064365386963e-10; // / 0x100000000                                                                                                                                               \n" +
                                         "}                                                                                                                                                                                                               \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "vec2 Hammersley(uint i, uint N) {                                                                                                                                                                               \n" +
                                         "    return vec2(float(i) / float(N), RadicalInverse_VdC(i));                                                                                                                                                    \n" +
                                         "}                                                                                                                                                                                                               \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)                                                                                                                                                      \n" +
                                         "{                                                                                                                                                                                                               \n" +
                                         "    float a = roughness*roughness;                                                                                                                                                                              \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    float phi = 2.0 * PI * Xi.x;                                                                                                                                                                                \n" +
                                         "    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));                                                                                                                                           \n" +
                                         "    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);                                                                                                                                                             \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    // from spherical coordinates to cartesian coordinates                                                                                                                                                      \n" +
                                         "    vec3 H;                                                                                                                                                                                                     \n" +
                                         "    H.x = cos(phi) * sinTheta;                                                                                                                                                                                  \n" +
                                         "    H.y = sin(phi) * sinTheta;                                                                                                                                                                                  \n" +
                                         "    H.z = cosTheta;                                                                                                                                                                                             \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    // from tangent-space vector to world-space sample vector                                                                                                                                                   \n" +
                                         "    const vec3 up  = vec3(0.0, 1.0, 0.0);                                                                                                                                                                       \n" +
                                         "    vec3 tangent   = normalize(cross(up, N));                                                                                                                                                                   \n" +
                                         "    vec3 bitangent = cross(N, tangent);                                                                                                                                                                         \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;                                                                                                                                                 \n" +
                                         "    return normalize(sampleVec);                                                                                                                                                                                \n" +
                                         "}                                                                                                                                                                                                               \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "void main()                                                                                                                                                                                                     \n" +
                                         "{                                                                                                                                                                                                               \n" +
                                         "    pdf = vec4(0.0);                                                                                                                                                                                            \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    const float texelSize = 1.0 / 512.0;                                                                                                                                                                        \n" +
                                         "    vec2 texCoords = mix(vec2(0), vec2(1) + 4.0 * texelSize, fract(texCoords * 4.0));                                                                                                                           \n" +
                                         "    float mapID = (floor(gl_FragCoord.x / 128.0) + 4.0 * floor(gl_FragCoord.y / 128.0));                                                                                                                        \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    float roughness = (mapID / 15.0) * float(int(mapID) != 1);                                                                                                                                                  \n" +
                                         "    float roughnessSquared = (roughness * roughness);                                                                                                                                                           \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    vec3 normal = uvToPolar(texCoords);                                                                                                                                                                         \n" +
                                         "    uint nSamples = max(uint(1024.0 * roughnessSquared), 1u);                                                                                                                                                   \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "    for(uint i = 0u; i < nSamples; ++i)                                                                                                                                                                         \n" +
                                         "    {                                                                                                                                                                                                           \n" +
                                         "        vec2 Xi = Hammersley(i % nSamples, nSamples);                                                                                                                                                           \n" +
                                         "        vec3 V  = ImportanceSampleGGX(Xi, normal, roughness);                                                                                                                                                   \n" +
                                         "                                                                                                                                                                                                                \n" +
                                         "        pdf += vec4(max(dot(normal, V), 0.0));                                                                                                                                                                  \n" +
                                         "    }                                                                                                                                                                                                           \n" +
                                         "}                                                                                                                                                                                                               \n");
                        
        program.compile();
        
        let framebuffer = new glFramebuffer(ctx, 512, 512);
        pdfLUT_texture = framebuffer.createColorAttachmentRGBA32F();
       
        framebuffer.bind([pdfLUT_texture]);
        program.runPostProcess();
        framebuffer.unbind();

        glEnvironmentMap.__radiancePdfLUT_instances.set(ctx, pdfLUT_texture);
    }

    return pdfLUT_texture;
}

glEnvironmentMap.__genRadianceSolverProgram = function(ctx)
{
    if(glEnvironmentMap.__radianceSolverProgramInstances == null) glEnvironmentMap.__radianceSolverProgramInstances = new Map();

    let program = glEnvironmentMap.__radianceSolverProgramInstances.get(ctx);
    if(program == null) 
    {
        program = new glProgram(ctx, "#version 300 es                            \n" +
                                     "                                           \n" +
                                     "precision highp float;                     \n" +
                                     "                                           \n" +
                                     "out vec2 texCoords;                        \n" +
                                     "                                           \n" +
                                     "void main()                                \n" +
                                     "{                                          \n" +
                                     "    texCoords = glTexCoord;                \n" +
                                     "    gl_Position = vec4(glVertex.xyz, 1.0); \n" +
                                     "}                                          \n",

                                     "#version 300 es                                                                                                                                                                                                 \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "precision mediump float;                                                                                                                                                                                        \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "uniform mediump sampler2D progressiveBuffer;                                                                                                                                                                    \n" +
                                     "uniform mediump sampler2D integralBuffer;                                                                                                                                                                       \n" +
                                     "uniform mediump sampler2D radianceBuffer;                                                                                                                                                                       \n" +
                                     "uniform mediump sampler2D environmentMap;                                                                                                                                                                       \n" +
                                     "uniform mediump sampler2D integralPDF;                                                                                                                                                                          \n" +
                                     "uniform mediump sampler2D skyMap;                                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "uniform vec3 lightColor;                                                                                                                                                                                        \n" +
                                     "uniform vec3 lightVector;                                                                                                                                                                                       \n" +
                                     "uniform int  samplesPerFrame;                                                                                                                                                                                   \n" +
                                     "uniform int  iterationID;                                                                                                                                                                                       \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "in vec2 texCoords;                                                                                                                                                                                              \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "layout(location = 0) out mediump vec4 integration;                                                                                                                                                              \n" +
                                     "layout(location = 1) out mediump vec4 resolvedRadiance;                                                                                                                                                         \n" +
                                     "layout(location = 2) out mediump vec4 progressiveRadiance;                                                                                                                                                      \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "const float PI        = 3.1415926535897932384626433832795;                                                                                                                                                      \n" +
                                     "const float PI_2      = PI * 2.0;                                                                                                                                                                               \n" +
                                     "const float PI_OVER_2 = PI * 0.5;                                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "vec3 uvToPolar(in vec2 uv)                                                                                                                                                                                      \n" +
                                     "{                                                                                                                                                                                                               \n" +
                                     "    float phi = PI * uv.y;                                                                                                                                                                                      \n" +
                                     "    float theta = PI_2 * uv.x;                                                                                                                                                                                  \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    return normalize(vec3(-cos(theta) * sin(phi), -cos(phi), -sin(theta) * sin(phi)));                                                                                                                          \n" +
                                     "}                                                                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "vec2 polarToUV(in vec3 n) {                                                                                                                                                                                     \n" +
                                     "    return vec2(atan(n.z, n.x) * 0.1591 + 0.5, asin(n.y) * 0.3183 + 0.5);                                                                                                                                       \n" +
                                     "}                                                                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "vec4 textureSphereLod(in sampler2D sphereMap, in vec3 n, in float lod) {                                                                                                                                        \n" +
                                     "    return textureLod(sphereMap, polarToUV(n), lod);                                                                                                                                                            \n" +
                                     "}                                                                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "float colorToLuma(in vec3 color) {                                                                                                                                                                              \n" +
                                     "    return max(color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722, 0.0);                                                                                                                                    \n" +
                                     "}                                                                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "float RadicalInverse_VdC(uint bits)                                                                                                                                                                             \n" +
                                     "{                                                                                                                                                                                                               \n" +
                                     "    bits = (bits << 16u) | (bits >> 16u);                                                                                                                                                                       \n" +
                                     "    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);                                                                                                                                         \n" +
                                     "    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);                                                                                                                                         \n" +
                                     "    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);                                                                                                                                         \n" +
                                     "    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);                                                                                                                                         \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    return float(bits) * 2.3283064365386963e-10; // / 0x100000000                                                                                                                                               \n" +
                                     "}                                                                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "vec2 Hammersley(uint i, uint N) {                                                                                                                                                                               \n" +
                                     "    return vec2(float(i) / float(N), RadicalInverse_VdC(i));                                                                                                                                                    \n" +
                                     "}                                                                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)                                                                                                                                                      \n" +
                                     "{                                                                                                                                                                                                               \n" +
                                     "    float a = roughness*roughness;                                                                                                                                                                              \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    float phi = 2.0 * PI * Xi.x;                                                                                                                                                                                \n" +
                                     "    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));                                                                                                                                           \n" +
                                     "    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    // from spherical coordinates to cartesian coordinates                                                                                                                                                      \n" +
                                     "    vec3 H;                                                                                                                                                                                                     \n" +
                                     "    H.x = cos(phi) * sinTheta;                                                                                                                                                                                  \n" +
                                     "    H.y = sin(phi) * sinTheta;                                                                                                                                                                                  \n" +
                                     "    H.z = cosTheta;                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    // from tangent-space vector to world-space sample vector                                                                                                                                                   \n" +
                                     "    const vec3 up  = vec3(0.0, 1.0, 0.0);                                                                                                                                                                       \n" +
                                     "    vec3 tangent   = normalize(cross(up, N));                                                                                                                                                                   \n" +
                                     "    vec3 bitangent = cross(N, tangent);                                                                                                                                                                         \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;                                                                                                                                                 \n" +
                                     "    return normalize(sampleVec);                                                                                                                                                                                \n" +
                                     "}                                                                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "void main()                                                                                                                                                                                                     \n" +
                                     "{                                                                                                                                                                                                               \n" +
                                     "    const float texelSize = 1.0 / 512.0;                                                                                                                                                                        \n" +
                                     "    vec2 texCoords = mix(vec2(0), vec2(1) + 4.0 * texelSize, fract(texCoords * 4.0));                                                                                                                           \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    integration         = texelFetch(integralBuffer,    ivec2(gl_FragCoord), 0);                                                                                                                                \n" +
                                     "    resolvedRadiance    = texelFetch(radianceBuffer,    ivec2(gl_FragCoord), 0);                                                                                                                                \n" +
                                     "    progressiveRadiance = texelFetch(progressiveBuffer, ivec2(gl_FragCoord), 0);                                                                                                                                \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    float mapID = (floor(gl_FragCoord.x / 128.0) + 4.0 * floor(gl_FragCoord.y / 128.0));                                                                                                                        \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    float roughness = (mapID / 15.0) * float(int(mapID) != 1);                                                                                                                                                  \n" +
                                     "    float roughnessSquared = (roughness * roughness);                                                                                                                                                           \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    vec3 normal = uvToPolar(texCoords);                                                                                                                                                                         \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    int sky_mip32_lod = max(int(textureLods(skyMap)) - 6, 0); // 32x32                                                                                                                                          \n" +
                                     "    uvec2 sky_mip32_size = uvec2(textureSize(skyMap, sky_mip32_lod));                                                                                                                                           \n" +
                                     "    uint nLightEstimationSamples = (sky_mip32_size.x * sky_mip32_size.y); // 1024                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    float lod = max(textureLods(environmentMap) - mix(8.0, 5.0, sqrt(roughness)), 0.0);                                                                                                                         \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    uint nSamples = ((gl_FragCoord.x >= 2.0 || gl_FragCoord.y >= 1.0) ? max(uint(1024.0 * roughnessSquared), 1u) : nLightEstimationSamples);                                                                    \n" +
                                     "    uint nSamplesPerFrame = ((gl_FragCoord.x >= 2.0 || gl_FragCoord.y >= 1.0) ? max(uint(float(samplesPerFrame) * roughnessSquared), 1u) : uint(samplesPerFrame));                                              \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    for(uint i = 0u; i < nSamplesPerFrame; ++i)                                                                                                                                                                 \n" +
                                     "    {                                                                                                                                                                                                           \n" +
                                     "        uint sampleID = uint(iterationID) * nSamplesPerFrame + i;                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "        if(nSamples == 1u || sampleID % nSamples == 0u) integration = vec4(0.0);                                                                                                                                \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "        if(gl_FragCoord.x >= 2.0 || gl_FragCoord.y >= 1.0)                                                                                                                                                      \n" +
                                     "        {                                                                                                                                                                                                       \n" +
                                     "            vec2 Xi = Hammersley(sampleID % nSamples, nSamples);                                                                                                                                                \n" +
                                     "            vec3 V  = ImportanceSampleGGX(Xi, normal, roughness);                                                                                                                                               \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "            float weight = dot(normal, V);                                                                                                                                                                      \n" +
                                     "            if(weight > 0.0)                                                                                                                                                                                    \n" +
                                     "            {                                                                                                                                                                                                   \n" +
                                     "                vec4 radianceSample = textureSphereLod(environmentMap, V, lod);                                                                                                                                 \n" +
                                     "                if(int(mapID) == 1) radianceSample = textureSphereLod(skyMap, V, 0.0);                                                                                                                          \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "                integration += radianceSample * weight;                                                                                                                                                         \n" +                      
                                     "            }                                                                                                                                                                                                   \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "            if(nSamples == 1u || sampleID % nSamples == (nSamples - 1u))                                                                                                                                        \n" +
                                     "            {                                                                                                                                                                                                   \n" +
                                     "                integration /= texelFetch(integralPDF, ivec2(gl_FragCoord), 0);                                                                                                                                 \n" +
                                     "                resolvedRadiance = integration;                                                                                                                                                                 \n" +
                                     "            }                                                                                                                                                                                                   \n" +
                                     "        }                                                                                                                                                                                                       \n" +
                                     "        else                                                                                                                                                                                                    \n" +
                                     "        {                                                                                                                                                                                                       \n" +
                                     "            ivec2 uv = ivec2(sampleID % sky_mip32_size.x, uint(floor(float(sampleID) / float(sky_mip32_size.x))) % sky_mip32_size.y);                                                                           \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "            vec3 radianceSample = texelFetch(skyMap, uv, sky_mip32_lod).rgb;                                                                                                                                    \n" +
                                     "            float weight = min(pow(colorToLuma(radianceSample / 100.0), 10.0) * 100.0, 1000.0);                                                                                                                 \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "            integration.xyz += ((gl_FragCoord.x < 1.0) ? vec3((vec2(uv) + 0.5) / vec2(sky_mip32_size), 0.0) : radianceSample) * weight;                                                                         \n" +
                                     "            integration.w += weight;                                                                                                                                                                            \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "            if(nSamples == 1u || sampleID % nSamples == (nSamples - 1u))                                                                                                                                        \n" +
                                     "            {                                                                                                                                                                                                   \n" +
                                     "                resolvedRadiance = vec4(((integration.w > 0.0) ? (integration.xyz / integration.w) : vec3(0.0)), 1.0);                                                                                          \n" +
                                     "                if(dot(lightColor, lightColor) > 0.0) resolvedRadiance.rgb = lightColor;                                                                                                                        \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "                if(gl_FragCoord.x < 1.0) resolvedRadiance.xyz = ((dot(lightVector, lightVector) > 0.0) ? normalize(lightVector) : -uvToPolar(resolvedRadiance.xy));                                             \n" +
                                     "            }                                                                                                                                                                                                   \n" +
                                     "        }                                                                                                                                                                                                       \n" +
                                     "    }                                                                                                                                                                                                           \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "    progressiveRadiance += (resolvedRadiance - progressiveRadiance) * (float(nSamplesPerFrame) / float(nSamples));                                                                                              \n" +
                                     "}                                                                                                                                                                                                               \n");
                        
        program.compile();
        
        program.createUniformSampler("skyMap",            0);
        program.createUniformSampler("integralPDF",       1);
        program.createUniformSampler("environmentMap",    2);
        program.createUniformSampler("integralBuffer",    3);
        program.createUniformSampler("radianceBuffer",    4);
        program.createUniformSampler("progressiveBuffer", 5);
        program.createUniformVec3("lightColor",     0, 0, 0);
        program.createUniformVec3("lightVector",    0, 0, 0);
        program.createUniformInt("samplesPerFrame",      16);
        program.createUniformInt("iterationID",           0);
        
        glEnvironmentMap.__radianceSolverProgramInstances.set(ctx, program);
    }

    return program;
}

glEnvironmentMap.__genGammaSpaceToLinearBlitProgram = function(ctx)
{
    if(glEnvironmentMap.__gammaSpaceToLinearBlitProgramInstances == null) glEnvironmentMap.__gammaSpaceToLinearBlitProgramInstances = new Map();

    let program = glEnvironmentMap.__gammaSpaceToLinearBlitProgramInstances.get(ctx);
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

                                     "#version 300 es                                                                                                                                                                                                 \n" +
                                     "precision mediump float;                                                                                                                                                                                        \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "uniform mediump sampler2D inputTexture;                                                                                                                                                                         \n" +
                                     "in vec2 texCoords;                                                                                                                                                                                              \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "layout(location = 0) out mediump vec4 fragColor;                                                                                                                                                                \n" +
                                     "                                                                                                                                                                                                                \n" +
                                     "void main()                                                                                                                                                                                                     \n" +
                                     "{                                                                                                                                                                                                               \n" +
                                     "    vec4 color = texelFetch(inputTexture, ivec2(gl_FragCoord.xy), 0);                                                                                                                                           \n" +
                                     "    fragColor = vec4(pow(color.rgb, vec3(2.24)), color.a);                                                                                                                                                      \n" +
                                     "}                                                                                                                                                                                                               \n");
                        
        program.compile();
        program.createUniformSampler("inputTexture", 0);
             
        glEnvironmentMap.__gammaSpaceToLinearBlitProgramInstances.set(ctx, program);
    }

    return program;
}

glEnvironmentMap.prototype.free = function()
{
    if(this.__radianceLutFramebuffer != null) this.__radianceLutFramebuffer.free();
    if(this.__environmentFramebuffer != null) this.__environmentFramebuffer.free();
    if(this.__faceFramebuffer != null) this.__faceFramebuffer.free();

    this.__radianceLutFramebuffer = null;
    this.__environmentFramebuffer = null;
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

    if(this.__onDrawCallback != null) this.__onDrawCallback(gl);
    
    this.__skyMap.bind(0);
    this.__faceMap.bind(1);

    this.__environmentFramebuffer.bind([this.__environmentMap]);
    this.__envMappingProgram.runPostProcess();
    this.__faceFramebuffer.invalidate();
}

glEnvironmentMap.prototype.update = function(position, nFacesUpdates)
{
    if(this.__skyMapGammaSpace != null && this.__skyMapGammaSpace.ready())
    {
        this.__gammaSpaceToLinearBlitProgram = glEnvironmentMap.__genGammaSpaceToLinearBlitProgram(ctx);
        this.__skyMapGammaToLinearFramebuffer = new glFramebuffer(ctx, this.__skyMapGammaSpace.getWidth(), this.__skyMapGammaSpace.getHeight());
        this.__skyMap = this.__skyMapGammaToLinearFramebuffer.createColorAttachmentRGBA16F();
    
        this.__skyMapGammaSpace.bind(0);
        this.__skyMapGammaToLinearFramebuffer.bind([this.__skyMap]);
        this.__gammaSpaceToLinearBlitProgram.runPostProcess();
        this.__skyMapGammaToLinearFramebuffer.unbind();
        this.__skyMapGammaSpace = null;
    }

    if(position == null) position = new glVector3f(0.0);
    if(nFacesUpdates == null) nFacesUpdates = 6;
    
    let currentViewport   = this.__ctx.getViewport();
    let activeProgram     = this.__ctx.getActiveProgram();
    let currentProjection = this.__ctx.getProjectionMatrix();
    let activeFramebuffer = this.__ctx.getActiveFramebuffer();
    
    if(this.__onDrawCallback != null)
    { 
        this.__ctx.pushMatrix();
        ctx.setPerspectiveProjection(90.0, 1.0, 0.1, 99.0);
    
        for(let i = 0, e = Math.min(Math.max(nFacesUpdates, 1), 6); i < e; ++i) this.__updateFace(position);

        this.__ctx.setProjectionMatrix(currentProjection);
        this.__ctx.popMatrix();
    }
    else
    {
        this.__environmentFramebuffer.bind([this.__environmentMap]);
        this.__skyMap.blit();
    }

    this.__ctx.bindFramebuffer(activeFramebuffer);
    this.__ctx.setViewport(currentViewport.x, currentViewport.y, currentViewport.w, currentViewport.h);
    this.__ctx.bindProgram(activeProgram);
    
    this.__pendingRadianceIntegrationSteps = 1024;
}

glEnvironmentMap.prototype.updateRadiance = function(nSamples)
{
    if(this.__pendingRadianceIntegrationSteps > 0)
    {
        let gl = this.__ctx.getGL();

        let currentViewport   = this.__ctx.getViewport();
        let activeProgram     = this.__ctx.getActiveProgram();
        let activeFramebuffer = this.__ctx.getActiveFramebuffer();

        this.__radianceDirectLightColUniform.set(this.__directionalLightColor);
        this.__radianceDirectLightVecUniform.set(this.__directionalLightVector);
 
        if(nSamples == null) nSamples = 1024;
        nSamples = Math.min(nSamples, 1024);
    
        this.__radianceSamplesPerFrameUniform.set(nSamples);
        if(nSamples >= 1024) this.__radianceIntegralIterationID = 0;
/*        
        if(this.__onDrawCallback != null)
        {
            this.__skyMap.setFilterMode(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
            this.__skyMap.bind(0);
        }
        else
        {
            this.__environmentMap.setFilterMode(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR); 
            this.__environmentMap.bind(0);
        }
*/
        this.__skyMap.setFilterMode(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
        this.__skyMap.bind(0);

        this.__radianceIntegralPDF.bind(1);

        this.__environmentMap.setFilterMode(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR); 
        this.__environmentMap.bind(2);
        
        this.__radianceIterationCountUniform.set(this.__radianceIntegralIterationID);
        
        let currentStateID = (this.__radianceIntegralIterationID) % 2;
        let lastStateID = (currentStateID + 1) % 2;
        
        this.__radianceIntegral[lastStateID].bind(3);
        this.__radianceResolved[lastStateID].bind(4);
        this.__radianceSmoothed[lastStateID].bind(5);

        this.__radianceFramebuffer[currentStateID].bind([ this.__radianceIntegral[currentStateID],
                                                          this.__radianceResolved[currentStateID],
                                                          this.__radianceSmoothed[currentStateID] ]);

        this.__radianceSolverProgram.runPostProcess();
        
        this.__radianceIntegral[lastStateID].unbind();
        this.__radianceResolved[lastStateID].unbind();
        this.__radianceSmoothed[lastStateID].unbind();
            
        this.__radianceLutFramebuffer.bind([this.__radianceLUT]);
        this.__radianceSmoothed[currentStateID].blit();
        
        this.__ctx.bindFramebuffer(activeFramebuffer);
        this.__ctx.setViewport(currentViewport.x, currentViewport.y, currentViewport.w, currentViewport.h);
        this.__ctx.bindProgram(activeProgram);

        this.__pendingRadianceIntegrationSteps = Math.max(this.__pendingRadianceIntegrationSteps - nSamples, 0);
        ++this.__radianceIntegralIterationID;
    }
}

glEnvironmentMap.prototype.setDirectionalLightVector = function(x, y, z) {
    this.__directionalLightVector.set(x, y, z);
}

glEnvironmentMap.prototype.setDirectionalLightColor = function(r, g, b) {
    this.__directionalLightColor.set(r, g, b);
}

glEnvironmentMap.prototype.getDirectionalLightVector = function() {
    return new glVector3f(this.__directionalLightVector);
}

glEnvironmentMap.prototype.getDirectionalLightColor = function() {
    return new glVector3f(this.__directionalLightColor);
}

glEnvironmentMap.prototype.setSkyIntensity = function(multiplier) {
    this.__skyMapIntensityUniform.set(multiplier);
}

glEnvironmentMap.prototype.getEnvironmentMap = function() {
    return this.__environmentMap;
}

glEnvironmentMap.prototype.getRadianceLUT = function() {
    return this.__radianceLUT;
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
    return this.__environmentMap.toBase64(width, height);
}
