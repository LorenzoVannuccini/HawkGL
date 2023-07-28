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

let glSkyMap = function(ctx)
{
    this.__ctx = ctx;
    let gl = ctx.getGL();

    this.__hdriProgram = glSkyMap.__genHDRIProgram(ctx);
    this.__atmosphereProgram = glSkyMap.__genAtmosphereProgram(ctx);

    this.__skyFramebuffer = new Array(2);
    this.__clearSkyMap    = new Array(2);
    this.__clearSkyLUT    = new Array(2);
    this.__cloudsMap      = new Array(2);
    this.__cloudsLUT      = new Array(2);
    
    for(let i = 0; i < 2; ++i)
    {
        this.__skyFramebuffer[i] = new glFramebuffer(ctx, 1024, 1024);

        this.__clearSkyMap[i] = this.__skyFramebuffer[i].createColorAttachmentRGBA16F();  
        this.__clearSkyLUT[i] = this.__skyFramebuffer[i].createColorAttachmentRGBA16F();  
        this.__cloudsMap[i]   = this.__skyFramebuffer[i].createColorAttachmentRGBA16F();  
        this.__cloudsLUT[i]   = this.__skyFramebuffer[i].createColorAttachmentRGBA16F();  

        this.__clearSkyMap[i].setFilterMode(gl.LINEAR, gl.LINEAR);
        this.__cloudsMap[i].setFilterMode(gl.LINEAR, gl.LINEAR);
    }
    
    this.__hdriFramebuffer = new glFramebuffer(ctx, 4096, 4096);
    this.__hdriMap = this.__hdriFramebuffer.createColorAttachmentRGBA16F();
    this.__hdriMap.setFilterMode(gl.LINEAR, gl.LINEAR);

    this.__envMap = new glEnvironmentMap(ctx, this.__hdriMap);

    this.setMoonTexture(null);
    this.setStarsTexture(null);
    this.setSunFlareTexture(null);
    this.setSunCoronaTexture(null);
    this.__noiseTexture = glSkyMap.__getNoiseTexture(ctx);

    this.__timeDate = glSkyMap.dateNow();
    this.__lastTimeDate = new glVector4f(0);
    this.__dayFactor = 0.0;
    
    this.__latitudeDeg = 51.5072; // london latitude
    this.__lastLatitudeDeg = this.__latitudeDeg;
    
    this.__iterationID = 0;
}

glSkyMap.__getStarsDefaultTexture = function(ctx)
{
    if(glSkyMap.__starsDefaultTextureInstances == null) glSkyMap.__starsDefaultTextureInstances = new Map();

    let texture = glSkyMap.__starsDefaultTextureInstances.get(ctx);
    if(texture == null) glSkyMap.__starsDefaultTextureInstances.set(ctx, (texture = ctx.createTexture(glSkyMap.__starsTextureImageData)));
 
    return texture;
}

glSkyMap.__getMoonDefaultTexture = function(ctx)
{
    if(glSkyMap.__moonDefaultTextureInstances == null) glSkyMap.__moonDefaultTextureInstances = new Map();

    let texture = glSkyMap.__moonDefaultTextureInstances.get(ctx);
    if(texture == null) glSkyMap.__moonDefaultTextureInstances.set(ctx, (texture = ctx.createTexture(glSkyMap.__moonTextureImageData)));
 
    return texture;
}

glSkyMap.__getSunFlareDefaultTexture = function(ctx)
{
    if(glSkyMap.__sunFlareDefaultTextureInstances == null) glSkyMap.__sunFlareDefaultTextureInstances = new Map();

    let texture = glSkyMap.__sunFlareDefaultTextureInstances.get(ctx);
    if(texture == null) glSkyMap.__sunFlareDefaultTextureInstances.set(ctx, (texture = ctx.createTexture(glSkyMap.__sunFlareTextureImageData)));
 
    return texture;
}

glSkyMap.__getSunCoronaDefaultTexture = function(ctx)
{
    if(glSkyMap.__sunCoronaDefaultTextureInstances == null) glSkyMap.__sunCoronaDefaultTextureInstances = new Map();

    let texture = glSkyMap.__sunCoronaDefaultTextureInstances.get(ctx);
    if(texture == null) glSkyMap.__sunCoronaDefaultTextureInstances.set(ctx, (texture = ctx.createTexture(glSkyMap.__sunCoronaTextureImageData)));
 
    return texture;
}

glSkyMap.__getNoiseTexture = function(ctx)
{
    if(glSkyMap.__noiseTextureInstances == null) glSkyMap.__noiseTextureInstances = new Map();

    let texture = glSkyMap.__noiseTextureInstances.get(ctx);
    if(texture == null) glSkyMap.__noiseTextureInstances.set(ctx, (texture = ctx.createTexture(glSkyMap.__noiseTextureImageData)));
 
    return texture;
}

glSkyMap.__genAtmosphereProgram = function(ctx)
{
    if(glSkyMap.__atmosphereProgramInstances == null) glSkyMap.__atmosphereProgramInstances = new Map();

    let program = glSkyMap.__atmosphereProgramInstances.get(ctx);
    if(program == null) 
    {
        program = new glProgram(ctx, " #version 300 es                            \n" +
                                     " precision highp float;                     \n" +
                                     "                                            \n" +
                                     " out vec2 texCoords;                        \n" +
                                     "                                            \n" +
                                     " void main()                                \n" +
                                     " {                                          \n" +
                                     "     texCoords = glTexCoord;                \n" +
                                     "     gl_Position = vec4(glVertex.xyz, 1.0); \n" +
                                     " }                                          \n",

                                     " #version 300 es                                                                                                                                                                               \n" +
                                     " precision mediump float;                                                                                                                                                                      \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " #define TEMPORAL_DIVISION 8 // must be POT                                                                                                                                                    \n" +
                                     " #define TEMPORAL_FRAMES_COUNT (TEMPORAL_DIVISION * TEMPORAL_DIVISION)                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " uniform mediump vec3 moonVector;                                                                                                                                                              \n" +
                                     " uniform mediump vec3 sunVector;                                                                                                                                                               \n" +
                                     " uniform mediump int glFrameID;                                                                                                                                                                \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " const vec3 glViewport = vec3(1024, 1024, 1);                                                                                                                                                  \n" +
                                     " #define glTime (float(glFrameID) / 60.0)                                                                                                                                                      \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " uniform mediump sampler2D lastState1;                                                                                                                                                         \n" +
                                     " uniform mediump sampler2D lastState2;                                                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " layout(location = 0) out mediump vec4 fragColor1;                                                                                                                                             \n" +
                                     " layout(location = 1) out mediump vec4 fragColorLUT1;                                                                                                                                          \n" +
                                     " layout(location = 2) out mediump vec4 fragColor2;                                                                                                                                             \n" +
                                     " layout(location = 3) out mediump vec4 fragColorLUT2;                                                                                                                                          \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " const float PI        = 3.1415926535897932384626433832795028841971693993751058209749;                                                                                                         \n" +
                                     " const float PI_2      = PI * 2.0;                                                                                                                                                             \n" +
                                     " const float PI_OVER_2 = PI * 0.5;                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float getDayFactor(in float sunHeight) {                                                                                                                                                      \n" +
                                     "     return pow(smoothstep(-0.6, 0.6, sunHeight), 8.0);                                                                                                                                        \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " #define main() _main_progressive(in vec2 _gl_FragCoord, in vec2 _glViewport, in vec2 _texCoords)                                                                                              \n" +
                                     " #define gl_FragCoord vec4(_gl_FragCoord, gl_FragCoord.zw)                                                                                                                                     \n" +
                                     " #define glViewport vec3(_glViewport, glViewport.z)                                                                                                                                            \n" +
                                     " #define texCoords _texCoords                                                                                                                                                                  \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " #define main() _main_progressive(in vec2 _gl_FragCoord, in vec2 _glViewport, in vec2 _texCoords)                                                                                              \n" +
                                     " #define gl_FragCoord vec4(_gl_FragCoord, gl_FragCoord.zw)                                                                                                                                     \n" +
                                     " #define glViewport vec3(_glViewport, glViewport.z)                                                                                                                                            \n" +
                                     " #define texCoords _texCoords                                                                                                                                                                  \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " in vec2 texCoords;                                                                                                                                                                            \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " // Dimensions                                                                                                                                                                                 \n" +
                                     " #define PLANET_RADIUS     6371e3                                                                                                                                                              \n" +
                                     " #define ATMOSPHERE_HEIGHT 100e3                                                                                                                                                               \n" +
                                     " #define RAYLEIGH_HEIGHT   8e3                                                                                                                                                                 \n" +
                                     " #define MIE_HEIGHT        1.2e3                                                                                                                                                               \n" +
                                     " #define OZONE_PEAK_LEVEL  30e3                                                                                                                                                                \n" +
                                     " #define OZONE_FALLOFF     3e3                                                                                                                                                                 \n" +
                                     " // Scattering coefficients                                                                                                                                                                    \n" +
                                     " #define BETA_RAY   vec3(3.8e-6, 13.5e-6, 33.1e-6) // vec3(5.5e-6, 13.0e-6, 22.4e-6)                                                                                                           \n" +
                                     " #define BETA_MIE   vec3(21e-6)                                                                                                                                                                \n" +
                                     " #define BETA_OZONE vec3(2.04e-5, 4.97e-5, 1.95e-6)                                                                                                                                            \n" +
                                     " #define G          0.75                                                                                                                                                                       \n" +
                                     " // Samples                                                                                                                                                                                    \n" +
                                     " #define SAMPLES          16                                                                                                                                                                   \n" +
                                     " #define LIGHT_SAMPLES    16 // Set to more than 1 for a realistic, less vibrant sunset                                                                                                        \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " // Other                                                                                                                                                                                      \n" +
                                     " #define SUN_ILLUMINANCE   128000.0                                                                                                                                                            \n" +
                                     " #define MOON_ILLUMINANCE  0.032                                                                                                                                                               \n" +
                                     " #define SPACE_ILLUMINANCE 0.03                                                                                                                                                                \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " #define CLOUDLEVEL -47.5                                                                                                                                                                      \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " const float ATMOSPHERE_RADIUS = PLANET_RADIUS + ATMOSPHERE_HEIGHT;                                                                                                                            \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " vec2 raySphereIntersect(in vec3 origin, in vec3 dir, in float radius) {                                                                                                                       \n" +
                                     "     float a = dot(dir, dir);                                                                                                                                                                  \n" +
                                     "     float b = 2.0 * dot(dir, origin);                                                                                                                                                         \n" +
                                     "     float c = dot(origin, origin) - (radius * radius);                                                                                                                                        \n" +
                                     "     float d = (b * b) - 4.0 * a * c;                                                                                                                                                          \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     if(d < 0.0) return vec2(1.0, -1.0);                                                                                                                                                       \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     return vec2(                                                                                                                                                                              \n" +
                                     "         (-b - sqrt(d)) / (2.0 * a),                                                                                                                                                           \n" +
                                     "         (-b + sqrt(d)) / (2.0 * a)                                                                                                                                                            \n" +
                                     "     );                                                                                                                                                                                        \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float phaseR(in float cosTheta) {                                                                                                                                                             \n" +
                                     "     return (3.0 * (1.0 + cosTheta * cosTheta)) / (16.0 * PI);                                                                                                                                 \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float phaseM(in float cosTheta, in float g) {                                                                                                                                                 \n" +
                                     "     float gg = g * g;                                                                                                                                                                         \n" +
                                     "     return (1.0 - gg) / (4.0 * PI * pow(1.0 + gg - 2.0 * g * cosTheta, 1.5));                                                                                                                 \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " vec3 avgDensities(in vec3 pos) {                                                                                                                                                              \n" +
                                     "     float height = length(pos) - PLANET_RADIUS; // Height above surface                                                                                                                       \n" +
                                     "     vec3 density;                                                                                                                                                                             \n" +
                                     "     density.x = exp(-height / RAYLEIGH_HEIGHT);                                                                                                                                               \n" +
                                     "     density.y = exp(-height / MIE_HEIGHT);                                                                                                                                                    \n" +
                                     "     density.z = (1.0 / cosh((OZONE_PEAK_LEVEL - height) / OZONE_FALLOFF)) * density.x; // Ozone absorption scales with rayleigh                                                               \n" +
                                     "     return density;                                                                                                                                                                           \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " vec3 atmosphere(                                                                                                                                                                              \n" +
                                     "     in vec3 pos,                                                                                                                                                                              \n" +
                                     "     in vec3 dir,                                                                                                                                                                              \n" +
                                     "     in vec3 lightDir,                                                                                                                                                                         \n" +
                                     "     in float rayleighMieMultiplier                                                                                                                                                            \n" +
                                     " ) {                                                                                                                                                                                           \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     // Intersect the atmosphere                                                                                                                                                               \n" +
                                     "     vec2 intersect = raySphereIntersect(pos, dir, ATMOSPHERE_RADIUS);                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     // Accumulators                                                                                                                                                                           \n" +
                                     "     vec3 opticalDepth = vec3(0.0); // Accumulated density of particles participating in Rayleigh, Mie and ozone scattering respectively                                                       \n" +
                                     "     vec3 sumR = vec3(0.0);                                                                                                                                                                    \n" +
                                     "     vec3 sumM = vec3(0.0);                                                                                                                                                                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     // Here's the trick - we clamp the sampling length to keep precision at the horizon                                                                                                       \n" +
                                     "     // This introduces banding, but we can compensate for that by scaling the clamp according to horizon angle                                                                                \n" +
                                     "     float rayPos = max(0.0, intersect.x);                                                                                                                                                     \n" +
                                     "     float maxLen = ATMOSPHERE_HEIGHT;                                                                                                                                                         \n" +
                                     "     maxLen *= (1.0 - abs(dir.y) * 0.5);                                                                                                                                                       \n" +
                                     "     float stepSize = min(intersect.y - rayPos, maxLen) / float(SAMPLES);                                                                                                                      \n" +
                                     "     rayPos += stepSize * 0.5; // Let's sample in the center                                                                                                                                   \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     for(int i = 0; i < SAMPLES; i++) {                                                                                                                                                        \n" +
                                     "         vec3 samplePos = pos + dir * rayPos; // Current sampling position                                                                                                                     \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "         // Similar to the primary iteration                                                                                                                                                   \n" +
                                     "         vec2 lightIntersect = raySphereIntersect(samplePos, lightDir, ATMOSPHERE_RADIUS); // No need to check if intersection happened as we already are inside the sphere                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "         vec3 lightOpticalDepth = vec3(0.0);                                                                                                                                                   \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "         // We're inside the sphere now, hence we don't have to clamp ray pos                                                                                                                  \n" +
                                     "         float lightStep = lightIntersect.y / float(LIGHT_SAMPLES);                                                                                                                            \n" +
                                     "         float lightRayPos = lightStep * 0.5; // Let's sample in the center                                                                                                                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "         for(int j = 0; j < LIGHT_SAMPLES; j++) {                                                                                                                                              \n" +
                                     "             vec3 lightSamplePos = samplePos + lightDir * (lightRayPos);                                                                                                                       \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "             lightOpticalDepth += avgDensities(lightSamplePos) * lightStep;                                                                                                                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "             lightRayPos += lightStep;                                                                                                                                                         \n" +
                                     "         }                                                                                                                                                                                     \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "         // Accumulate optical depth                                                                                                                                                           \n" +
                                     "         vec3 densities = avgDensities(samplePos) * stepSize;                                                                                                                                  \n" +
                                     "         opticalDepth += densities;                                                                                                                                                            \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "         // Accumulate scattered light                                                                                                                                                         \n" +
                                     "         vec3 scattered = exp(-(BETA_RAY * (opticalDepth.x + lightOpticalDepth.x) + BETA_MIE * (opticalDepth.y + lightOpticalDepth.y) + BETA_OZONE * (opticalDepth.z + lightOpticalDepth.z))); \n" +
                                     "         sumR += scattered * densities.x;                                                                                                                                                      \n" +
                                     "         sumM += scattered * densities.y;                                                                                                                                                      \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "         rayPos += stepSize;                                                                                                                                                                   \n" +
                                     "     }                                                                                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     float cosTheta = dot(dir, lightDir);                                                                                                                                                      \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     return max(rayleighMieMultiplier * phaseR(cosTheta) * BETA_RAY * sumR + rayleighMieMultiplier * phaseM(cosTheta, G) * BETA_MIE * sumM, 0.0);                                              \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float getSunShadowIlluminance(in float sunHeight) {                                                                                                                                           \n" +
                                     "     return mix(SPACE_ILLUMINANCE, SUN_ILLUMINANCE, getDayFactor(sunHeight - 0.3));                                                                                                            \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float getMoonShadowIlluminance(in float moonHeight) {                                                                                                                                         \n" +
                                     "     return mix(MOON_ILLUMINANCE, SPACE_ILLUMINANCE, getDayFactor(moonHeight - 0.3));                                                                                                          \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " vec3 viewDir(in vec2 uv, in float ratio)                                                                                                                                                      \n" +
                                     " {                                                                                                                                                                                             \n" +
                                     "      vec2 t = ((uv * 2.0) - vec2(1.0)) * vec2(PI, PI * 0.5);                                                                                                                                  \n" +
                                     "      return normalize(vec3(cos(t.y) * cos(t.x), sin(t.y), cos(t.y) * sin(t.x)));                                                                                                              \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " vec3 sunPos   = vec3(0.0, 1.0, 0.0);                                                                                                                                                          \n" +
                                     " vec3 sunColor = vec3(1.0, 0.90, 0.85);                                                                                                                                                        \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float sdEllipsoid( vec3 p, vec3 r ) {                                                                                                                                                         \n" +
                                     "     return (length( p/r.xyz ) - 1.0) * r.y;                                                                                                                                                   \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float hash1( float n ) {                                                                                                                                                                      \n" +
                                     "     return fract( n*17.0*fract( n*0.3183099 ) );                                                                                                                                              \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " // value noise, and its analytical derivatives                                                                                                                                                \n" +
                                     " vec4 noised( in vec3 x )                                                                                                                                                                      \n" +
                                     " {                                                                                                                                                                                             \n" +
                                     "     vec3 p = floor(x);                                                                                                                                                                        \n" +
                                     "     vec3 w = fract(x);                                                                                                                                                                        \n" +
                                     "     #if 1                                                                                                                                                                                     \n" +
                                     "     vec3 u = w*w*w*(w*(w*6.0-15.0)+10.0);                                                                                                                                                     \n" +
                                     "     vec3 du = 30.0*w*w*(w*(w-2.0)+1.0);                                                                                                                                                       \n" +
                                     "     #else                                                                                                                                                                                     \n" +
                                     "     vec3 u = w*w*(3.0-2.0*w);                                                                                                                                                                 \n" +
                                     "     vec3 du = 6.0*w*(1.0-w);                                                                                                                                                                  \n" +
                                     "     #endif                                                                                                                                                                                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     float n = p.x + 317.0*p.y + 157.0*p.z;                                                                                                                                                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     float a = hash1(n+0.0);                                                                                                                                                                   \n" +
                                     "     float b = hash1(n+1.0);                                                                                                                                                                   \n" +
                                     "     float c = hash1(n+317.0);                                                                                                                                                                 \n" +
                                     "     float d = hash1(n+318.0);                                                                                                                                                                 \n" +
                                     "     float e = hash1(n+157.0);                                                                                                                                                                 \n" +
                                     "     float f = hash1(n+158.0);                                                                                                                                                                 \n" +
                                     "     float g = hash1(n+474.0);                                                                                                                                                                 \n" +
                                     "     float h = hash1(n+475.0);                                                                                                                                                                 \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     float k0 =   a;                                                                                                                                                                           \n" +
                                     "     float k1 =   b - a;                                                                                                                                                                       \n" +
                                     "     float k2 =   c - a;                                                                                                                                                                       \n" +
                                     "     float k3 =   e - a;                                                                                                                                                                       \n" +
                                     "     float k4 =   a - b - c + d;                                                                                                                                                               \n" +
                                     "     float k5 =   a - c - e + g;                                                                                                                                                               \n" +
                                     "     float k6 =   a - b - e + f;                                                                                                                                                               \n" +
                                     "     float k7 = - a + b + c - d + e - f - g + h;                                                                                                                                               \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     return vec4( -1.0+2.0*(k0 + k1*u.x + k2*u.y + k3*u.z + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z),                                                                            \n" +
                                     "                       2.0* du * vec3( k1 + k4*u.y + k6*u.z + k7*u.y*u.z,                                                                                                                      \n" +
                                     "                                       k2 + k5*u.z + k4*u.x + k7*u.z*u.x,                                                                                                                      \n" +
                                     "                                       k3 + k6*u.x + k5*u.y + k7*u.x*u.y ) );                                                                                                                  \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " const mat3 m3  = mat3( 0.00,  0.80,  0.60,                                                                                                                                                    \n" +
                                     "                       -0.80,  0.36, -0.48,                                                                                                                                                    \n" +
                                     "                       -0.60, -0.48,  0.64 );                                                                                                                                                  \n" +
                                     " const mat3 m3i = mat3( 0.00, -0.80, -0.60,                                                                                                                                                    \n" +
                                     "                        0.80,  0.36, -0.48,                                                                                                                                                    \n" +
                                     "                        0.60, -0.48,  0.64 );                                                                                                                                                  \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " vec4 fbmd_8( in vec3 x )                                                                                                                                                                      \n" +
                                     " {                                                                                                                                                                                             \n" +
                                     "     float f = 2.0;                                                                                                                                                                            \n" +
                                     "     float s = 0.65;                                                                                                                                                                           \n" +
                                     "     float a = 0.0;                                                                                                                                                                            \n" +
                                     "     float b = 0.5;                                                                                                                                                                            \n" +
                                     "     vec3  d = vec3(0.0);                                                                                                                                                                      \n" +
                                     "     mat3  m = mat3(1.0,0.0,0.0,                                                                                                                                                               \n" +
                                     "                    0.0,1.0,0.0,                                                                                                                                                               \n" +
                                     "                    0.0,0.0,1.0);                                                                                                                                                              \n" +
                                     "     for( int i=0; i<8; i++ )                                                                                                                                                                  \n" +
                                     "     {                                                                                                                                                                                         \n" +
                                     "         vec4 n = noised(x + 0.1 * vec3(-glTime * 0.3, 0, glTime * 0.45));                                                                                                                     \n" +
                                     "         a += b*n.x;          // accumulate values                                                                                                                                             \n" +
                                     "         if( i<4 )                                                                                                                                                                             \n" +
                                     "         d += b*m*n.yzw;      // accumulate derivatives                                                                                                                                        \n" +
                                     "         b *= s;                                                                                                                                                                               \n" +
                                     "         x = f*m3*x;                                                                                                                                                                           \n" +
                                     "         m = f*m3i*m;                                                                                                                                                                          \n" +
                                     "     }                                                                                                                                                                                         \n" +
                                     "     return vec4( a, d );                                                                                                                                                                      \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float cloudsMap(in vec3 pos)                                                                                                                                                                  \n" +
                                     " {                                                                                                                                                                                             \n" +
                                     "     float d = abs(pos.y-30.0)-4.0;                                                                                                                                                            \n" +
                                     "     vec3 gra = vec3(0.0,sign(pos.y-90.0),0.0);                                                                                                                                                \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     vec4 n = fbmd_8(pos);                                                                                                                                                                     \n" +
                                     "     d += 400.0*n.x * (0.7+0.3*gra.y);                                                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     if( d>0.0 ) return -d;                                                                                                                                                                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     d = -d / 100.0;                                                                                                                                                                           \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     //gra += 0.1*n.yzw *  (0.7+0.3*gra.y);                                                                                                                                                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     return d;                                                                                                                                                                                 \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float GetCloudHeightBelow(vec3 p) {                                                                                                                                                           \n" +
                                     "     return cloudsMap(p * 0.03) * 4.0;                                                                                                                                                         \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " float GetHorizon( vec3 p){                                                                                                                                                                    \n" +
                                     "     return sdEllipsoid(p, vec3(1000., -CLOUDLEVEL, 1000.));                                                                                                                                   \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " vec4 TraceCloudsBelow( vec3 origin, vec3 direction, int steps)                                                                                                                                \n" +
                                     " {                                                                                                                                                                                             \n" +
                                     "   vec4 cloudCol=vec4(vec3(0.95, 0.95, 0.98)*0.65, 0.0);                                                                                                                                       \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "   float density = 0.0, t = .0, dist = 0.0;                                                                                                                                                    \n" +
                                     "   vec3 rayPos;                                                                                                                                                                                \n" +
                                     "   float precis;                                                                                                                                                                               \n" +
                                     "   float td =.0;                                                                                                                                                                               \n" +
                                     "   float energy=1.0;                                                                                                                                                                           \n" +
                                     "   float densAdd=0.;                                                                                                                                                                           \n" +
                                     "   float sunDensity;                                                                                                                                                                           \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "   for ( int i=0; i<steps; i++ )                                                                                                                                                               \n" +
                                     "   {                                                                                                                                                                                           \n" +
                                     "     rayPos = origin+direction*t;                                                                                                                                                              \n" +
                                     "     density = clamp(GetCloudHeightBelow(rayPos), 0., 1.)*1.75;                                                                                                                                \n" +
                                     "     dist = -GetHorizon(rayPos);                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     precis = 0.015*t;                                                                                                                                                                         \n" +
                                     "     if (dist<precis && density>0.001)                                                                                                                                                         \n" +
                                     "     {                                                                                                                                                                                         \n" +
                                     "       densAdd = 0.14*density/td;                                                                                                                                                              \n" +
                                     "       sunDensity = clamp(GetCloudHeightBelow(rayPos+sunPos*3.), -0.6, 2.)*2.;                                                                                                                 \n" +
                                     "       cloudCol.rgb-=sunDensity*0.03*cloudCol.a*densAdd;                                                                                                                                       \n" +
                                     "       cloudCol.a+=(1.-cloudCol.a)*densAdd;                                                                                                                                                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "       cloudCol.rgb += 0.03*max(0., density-sunDensity)*densAdd;                                                                                                                               \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "       cloudCol.rgb+=mix(vec3(0.), vec3(1.0, 1.0, 0.9)*0.013, energy)*sunColor;                                                                                                                \n" +
                                     "       energy*=0.93;                                                                                                                                                                           \n" +
                                     "     }                                                                                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     if (cloudCol.a > 0.99) break;                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     td = max(1.4, dist);                                                                                                                                                                      \n" +
                                     "     t+=td;                                                                                                                                                                                    \n" +
                                     "   }                                                                                                                                                                                           \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "   return cloudCol;                                                                                                                                                                            \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " // Frame rendering function with option to set arbitrary rendering resolution                                                                                                                 \n" +
                                     " void main()                                                                                                                                                                                   \n" +
                                     " {                                                                                                                                                                                             \n" +
                                     "     vec3 dir = viewDir(texCoords, 1.0);                                                                                                                                                       \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     vec3 sunDir  = sunVector;                                                                                                                                                                 \n" +
                                     "     vec3 moonDir = moonVector;                                                                                                                                                                \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     vec3 pos = vec3(0.0, PLANET_RADIUS + 2.0, 0.0);                                                                                                                                           \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     float sunShadowIlluminance  = getSunShadowIlluminance(sunDir.y);                                                                                                                          \n" +
                                     "     float moonShadowIlluminance = getMoonShadowIlluminance(moonDir.y);                                                                                                                        \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     // Sky                                                                                                                                                                                    \n" +
                                     "     vec4 color = vec4(0);                                                                                                                                                                     \n" +
                                     "     color.rgb += atmosphere(pos, dir, vec3(sunDir.x, abs(sunDir.y), sunDir.z),  1.0) * sunShadowIlluminance * getDayFactor(sunDir.y + 0.3);                                                   \n" +
                                     "     color.rgb += atmosphere(pos, dir, vec3(moonDir.x, abs(moonDir.y), moonDir.z), getDayFactor(moonDir.y)) * moonShadowIlluminance;                                                           \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     fragColor1 = vec4(color.rgb, 1.0);                                                                                                                                                        \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     // Clouds                                                                                                                                                                                 \n" +
                                     "     dir = viewDir(texCoords * vec2(1, 0.5) + vec2(0, 0.5), 1.0);                                                                                                                              \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     sunPos = sunDir;                                                                                                                                                                          \n" +
                                     "     sunColor = vec3(1);                                                                                                                                                                       \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     vec4 cloudColor1 = clamp(TraceCloudsBelow(vec3(0), dir, 60), vec4(0), vec4(1));                                                                                                           \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     // make clouds slightly light near the sun                                                                                                                                                \n" +
                                     "     float sunVisibility = pow(max(0., dot(sunDir, dir)), 40.0)*0.2;                                                                                                                           \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     sunColor = atmosphere(pos, sunDir, vec3(sunDir.x, abs(sunDir.y), sunDir.z),  1.0) * sunShadowIlluminance * getDayFactor(sunDir.y + 0.3);                                                  \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     cloudColor1.rgb = pow(max(cloudColor1.rgb, vec3(0)) * cloudColor1.a, vec3(10.0)) * sunColor + sunVisibility * sunColor;                                                                   \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     sunPos = moonDir;                                                                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     float moonDotL = 1.0 - max(dot(sunDir, moonDir), 0.0);                                                                                            \n" +
                                     "     sunColor = vec3(MOON_ILLUMINANCE) * 0.1 + vec3(MOON_ILLUMINANCE) * 0.3 * clamp(pow(max(0., dot(moonDir, dir)), 8.0), 0.0, 1.0);                                                           \n" +
                                     "     sunColor *= getDayFactor(moonDir.y + 0.3) * moonDotL;                                                                                                                                     \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     vec4 cloudColor2 = clamp(TraceCloudsBelow(vec3(0), dir, 60), vec4(0), vec4(1));                                                                                                           \n" +
                                     "     cloudColor2.rgb = pow(max(cloudColor2.rgb, vec3(0)) * cloudColor2.a, vec3(10.0)) * sunColor;                                                                                              \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     fragColor2 = cloudColor1 + cloudColor2;                                                                                                                                                   \n" +
                                     "     fragColor2.a *= 0.5;                                                                                                                                                                      \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     fragColor2.a = smoothstep(0.75, 1.0, fragColor2.a);                                                                                                                                       \n" +
                                     "     fragColor2.rgb -= 0.0002 * fragColor2.a;                                                                                                                                                  \n" +
                                     "     fragColor2 *= getDayFactor(dir.y + 0.3);                                                                                                                                                  \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     // Tonemapping                                                                                                                                                                            \n" +
                                     "     float exposure = 16.0 / max(sunShadowIlluminance + moonShadowIlluminance, 1e-6);                                                                                                          \n" +
                                     "     exposure = min(exposure, 16.0 / (MOON_ILLUMINANCE * 8.0)); // Clamp the exposure to make night appear darker                                                                              \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     fragColor1.rgb *= exposure;                                                                                                                                                               \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " #undef gl_FragCoord                                                                                                                                                                           \n" +
                                     " #undef glViewport                                                                                                                                                                             \n" +
                                     " #undef main                                                                                                                                                                                   \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " int bayer(in int i, in int s)                                                                                                                                                                 \n" +
                                     " {                                                                                                                                                                                             \n" +
                                     "     i = i * 2 + i;                                                                                                                                                                            \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     int e = 0;                                                                                                                                                                                \n" +
                                     "     int m = int(log2(float(s)));                                                                                                                                                              \n" +
                                     "     ivec2 p = ivec2((s - 1) - i / s, (s - 1) - i % s);                                                                                                                                        \n" +
                                     "     for(int k = 0; k < m; ++k) e = 4 * e + (((((p.y >> k) & 1) << 1) + ((p.x >> k) & 1) + 1) & 3);                                                                                            \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     return e;                                                                                                                                                                                 \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " vec4 temporalFilteringOffsets(in int i, in int s)                                                                                                                                             \n" +
                                     " {                                                                                                                                                                                             \n" +
                                     "     vec4 fragOffset = vec4(i % s, (i / s) % s, 0, 0);                                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     vec2 j = vec2(0.5 - (1.0 / float(s)) * 0.5);                                                                                                                                              \n" +
                                     "     fragOffset.zw = -j + 2.0 * j * (fragOffset.xy / float(max(s - 1, 1)));                                                                                                                    \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     return fragOffset;                                                                                                                                                                        \n" +
                                     " }                                                                                                                                                                                             \n" +
                                     "                                                                                                                                                                                               \n" +
                                     " // Rendering lower resolution frame                                                                                                                                                           \n" +
                                     " void main()                                                                                                                                                                                   \n" +
                                     " {                                                                                                                                                                                             \n" +
                                     "     vec2 fragCoord = gl_FragCoord.xy;                                                                                                                                                         \n" +
                                     "     vec2 texCoords = gl_FragCoord.xy / glViewport.xy;                                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     fragColor1 = texelFetch(lastState1, ivec2(fragCoord), 0);                                                                                                                                 \n" +
                                     "     fragColor2 = texelFetch(lastState2, ivec2(fragCoord), 0);                                                                                                                                 \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     if(glFrameID == 0) fragColor1 = fragColor2 = vec4(0);                                                                                                                                     \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     vec2 temporalResolution = vec2(ivec2(glViewport.xy) / TEMPORAL_DIVISION);                                                                                                                 \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     int frame = bayer(glFrameID, TEMPORAL_DIVISION);                                                                                                                                          \n" +
                                     "     vec4 fragOffset = temporalFilteringOffsets(frame, TEMPORAL_DIVISION);                                                                                                                     \n" +
                                     "     vec2 resolutionOffset = fragOffset.xy;                                                                                                                                                    \n" +
                                     "     vec2 pixelOffset = fragOffset.zw;                                                                                                                                                         \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     vec2 subFragCoord = fragCoord - resolutionOffset * temporalResolution + pixelOffset;                                                                                                      \n" +
                                     "     vec2 subTexCoord  = subFragCoord / temporalResolution;                                                                                                                                    \n" +
                                     "     vec2 e = abs(subTexCoord - 0.5);                                                                                                                                                          \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     if(max(e.x, e.y) < 0.5) _main_progressive(subFragCoord, temporalResolution, subTexCoord);                                                                                                 \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     fragColorLUT1 = fragColor1;                                                                                                                                                               \n" +
                                     "     fragColorLUT2 = fragColor2;                                                                                                                                                               \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     ivec2 pixelQuadID = ivec2(fragCoord) % TEMPORAL_DIVISION;                                                                                                                                 \n" +
                                     "     int frame2 = pixelQuadID.x + pixelQuadID.y * TEMPORAL_DIVISION;                                                                                                                           \n" +
                                     "     resolutionOffset = temporalFilteringOffsets(frame2, TEMPORAL_DIVISION).xy;                                                                                                                \n" +
                                     "                                                                                                                                                                                               \n" +
                                     "     fragColor1 = texelFetch(lastState1, ivec2((fragCoord / float(TEMPORAL_DIVISION)) + resolutionOffset * temporalResolution), 0);                                                            \n" +
                                     "     fragColor2 = texelFetch(lastState2, ivec2((fragCoord / float(TEMPORAL_DIVISION)) + resolutionOffset * temporalResolution), 0);                                                            \n" +
                                     " }                                                                                                                                                                                             \n");

        if(!program.compile()) console.error(program.getLastError());
        
        program.__uniformMoonVector = program.createUniformVec3("moonVector");
        program.__uniformSunVector = program.createUniformVec3("sunVector");
        program.__uniformFrameID = program.createUniformInt("glFrameID");
        
        program.createUniformSampler("lastState1", 0);
        program.createUniformSampler("lastState2", 1);
             
        glSkyMap.__atmosphereProgramInstances.set(ctx, program);
    }

    return program;
}

glSkyMap.__genHDRIProgram = function(ctx)
{
    if(glSkyMap.__hdriProgramInstances == null) glSkyMap.__hdriProgramInstances = new Map();

    let program = glSkyMap.__hdriProgramInstances.get(ctx);
    if(program == null) 
    {
        program = new glProgram(ctx, " #version 300 es                            \n" +
                                     " precision highp float;                     \n" +
                                     "                                            \n" +
                                     " out vec2 texCoords;                        \n" +
                                     "                                            \n" +
                                     " void main()                                \n" +
                                     " {                                          \n" +
                                     "     texCoords = glTexCoord;                \n" +
                                     "     gl_Position = vec4(glVertex.xyz, 1.0); \n" +
                                     " }                                          \n",

                                     " #version 300 es                                                                                                                                       \n" +
                                     " precision mediump float;                                                                                                                              \n" +
                                     "                                                                                                                                                       \n" +
                                     " uniform mediump vec3 sunVector;                                                                                                                       \n" +
                                     " uniform mediump vec3 moonVector;                                                                                                                      \n" +
                                     " uniform mediump mat3 earthTransform;                                                                                                                  \n" +
                                     "                                                                                                                                                       \n" +
                                     " const vec3 glViewport = vec3(4096, 4096, 1);                                                                                                          \n" +
                                     "                                                                                                                                                       \n" +
                                     " uniform mediump sampler2D starsTexture;                                                                                                               \n" +
                                     " uniform mediump sampler2D cloudsTexture;                                                                                                              \n" +
                                     " uniform mediump sampler2D atmosphereTexture;                                                                                                          \n" +
                                     " uniform lowp    sampler2D sunCoronaTexture;                                                                                                           \n" +
                                     " uniform lowp    sampler2D sunFlareTexture;                                                                                                            \n" +
                                     " uniform lowp    sampler2D moonTexture;                                                                                                                \n" +
                                     " uniform lowp    sampler2D noiseTexture;                                                                                                               \n" +
                                     "                                                                                                                                                       \n" +
                                     " layout(location = 0) out mediump vec4 fragColor;                                                                                                      \n" +
                                     "                                                                                                                                                       \n" +
                                     " const float PI        = 3.1415926535897932384626433832795028841971693993751058209749;                                                                 \n" +
                                     " const float PI_2      = PI * 2.0;                                                                                                                     \n" +
                                     " const float PI_OVER_2 = PI * 0.5;                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " vec3 gammaToLinear(in vec3 color) {                                                                                                                   \n" +
                                     "     return pow(color, vec3(2.24));                                                                                                                    \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " vec4 textureSphere(in sampler2D sphereMap, in vec3 n) {                                                                                               \n" +
                                     "    return texture(sphereMap, vec2(atan(n.z, n.x) * 0.1591 + 0.5, asin(n.y) * 0.3183 + 0.5));                                                          \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " float getDayFactor(in float sunHeight) {                                                                                                              \n" +
                                     "     return pow(smoothstep(-0.6, 0.6, sunHeight), 8.0);                                                                                                \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " mat4 lookAtMatrix(in vec3 src, in vec3 dst)                                                                                                           \n" +
                                     " {                                                                                                                                                     \n" +
                                     "     vec3 up = vec3(0.0, 1.0, 0.0);                                                                                                                    \n" +
                                     "     vec3 forward = normalize(dst - src);                                                                                                              \n" +
                                     "                                                                                                                                                       \n" +
                                     "     if(length(cross(forward, up)) < 1e-4)                                                                                                             \n" +
                                     "     {                                                                                                                                                 \n" +
                                     "         up = vec3(1.0, 0.0, 0.0);                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     "         if(length(cross(forward, up)) < 1e-4)                                                                                                         \n" +
                                     "         {                                                                                                                                             \n" +
                                     "             up = vec3(0.0, 1.0, 0.0);                                                                                                                 \n" +
                                     "                                                                                                                                                       \n" +
                                     "             if(length(cross(forward, up)) < 1e-4) up = vec3(0.0, 0.0, 1.0);                                                                           \n" +
                                     "         }                                                                                                                                             \n" +
                                     "     }                                                                                                                                                 \n" +
                                     "                                                                                                                                                       \n" +
                                     "     vec3 right = normalize(cross(forward, up));                                                                                                       \n" +
                                     "     up = cross(right, forward);                                                                                                                       \n" +
                                     "                                                                                                                                                       \n" +
                                     "     mat4 m = mat4(1.0);                                                                                                                               \n" +
                                     "                                                                                                                                                       \n" +
                                     "     m[0][1] = up.x;                                                                                                                                   \n" +
                                     "     m[1][1] = up.y;                                                                                                                                   \n" +
                                     "     m[2][1] = up.z;                                                                                                                                   \n" +
                                     "     m[0][0] = right.x;                                                                                                                                \n" +
                                     "     m[1][0] = right.y;                                                                                                                                \n" +
                                     "     m[2][0] = right.z;                                                                                                                                \n" +
                                     "     m[0][2] = -forward.x;                                                                                                                             \n" +
                                     "     m[1][2] = -forward.y;                                                                                                                             \n" +
                                     "     m[2][2] = -forward.z;                                                                                                                             \n" +
                                     "     m[3][0] = dot(right,   -src);                                                                                                                     \n" +
                                     "     m[3][1] = dot(up,      -src);                                                                                                                     \n" +
                                     "     m[3][2] = dot(-forward, -src);                                                                                                                    \n" +
                                     "                                                                                                                                                       \n" +
                                     "     return m;                                                                                                                                         \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " mat3 normalMatrix(in mat4 m) {                                                                                                                        \n" +
                                     "     return mat3(inverse(transpose(m)));                                                                                                               \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " in vec2 texCoords;                                                                                                                                    \n" +
                                     "                                                                                                                                                       \n" +
                                     " #define SUN_ILLUMINANCE   128000.0                                                                                                                    \n" +
                                     " #define MOON_ILLUMINANCE  0.032                                                                                                                       \n" +
                                     " #define SPACE_ILLUMINANCE 0.03                                                                                                                        \n" +
                                     "                                                                                                                                                       \n" +
                                     " bool sphereIntersect(in vec3 ro, in vec3 rd, in vec3 ce, in float ra, out vec3 n)                                                                     \n" +
                                     " {                                                                                                                                                     \n" +
                                     "     vec3 oc = ro - ce;                                                                                                                                \n" +
                                     "     float b = dot(oc, rd);                                                                                                                            \n" +
                                     "     float c = dot(oc, oc) - ra * ra;                                                                                                                  \n" +
                                     "     float h = b * b - c;                                                                                                                              \n" +
                                     "                                                                                                                                                       \n" +
                                     "     float x = -b - sqrt(h);                                                                                                                           \n" +
                                     "     n = normalize(ro + rd * x - ce);                                                                                                                  \n" +
                                     "                                                                                                                                                       \n" +
                                     "     return (x > 0.0);                                                                                                                                 \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " vec4 renderMoon(in vec3 dir, in vec3 moonDir, in vec3 sunDir, in float r)                                                                             \n" +
                                     " {                                                                                                                                                     \n" +
                                     "     float cosTheta = max(dot(dir, moonDir), 0.0);                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     "     float glow = pow(max(cosTheta, 0.0), 4.0) * 0.01;                                                                                                 \n" +
                                     "                                                                                                                                                       \n" +
                                     "     float fade = smoothstep(0.05, 0.25, dir.y + 0.03);                                                                                                \n" +
                                     "     float glowFade = smoothstep(0.05, 0.25, moonDir.y);                                                                                               \n" +
                                     "                                                                                                                                                       \n" +
                                     "     vec4 col = vec4(0);                                                                                                                               \n" +
                                     "                                                                                                                                                       \n" +
                                     "     vec3 moonNormal;                                                                                                                                  \n" +
                                     "     if(sphereIntersect(vec3(0), dir, moonDir, r, moonNormal))                                                                                         \n" +
                                     "     {                                                                                                                                                 \n" +
                                     "         mat3 nrmMatrix = normalMatrix(lookAtMatrix(vec3(0), dir));                                                                                    \n" +
                                     "         vec3 albedo = gammaToLinear(texture(moonTexture, ((nrmMatrix * moonNormal).xy * 0.5 + 0.5)).rgb);                                             \n" +
                                     "         albedo = min(albedo * 1.75, vec3(1));                                                                                                         \n" +
                                     "                                                                                                                                                       \n" +
                                     "         float dotN = max(dot(moonNormal, -dir), 0.0);                                                                                                 \n" +
                                     "         float intensity = smoothstep(0.0, 0.25, dotN * dotN);                                                                                         \n" +
                                     "                                                                                                                                                       \n" +
                                     "         moonNormal = normalize(moonNormal + dir * 0.25);                                                                                              \n" +
                                     "         float dotL = max(dot(moonNormal, sunDir), 0.001);                                                                                             \n" +
                                     "                                                                                                                                                       \n" +
                                     "         col += vec4(albedo * dotL, 1) * intensity * intensity;                                                                                        \n" +
                                     "     }                                                                                                                                                 \n" +
                                     "                                                                                                                                                       \n" +
                                     "     return (col + glow * glowFade) * fade;                                                                                                            \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " vec3 renderSun(in vec3 dir, in vec3 lightDir, in float dayFactor)                                                                                     \n" +
                                     " {                                                                                                                                                     \n" +
                                     "     mat3 nrmMatrix = normalMatrix(lookAtMatrix(vec3(0), dir));                                                                                        \n" +
                                     "     vec3 sunUV = vec3((nrmMatrix * -lightDir) * 15.0 + 0.5);                                                                                          \n" +
                                     "     if(max(abs(sunUV.x - 0.5), abs(sunUV.y - 0.5)) >= 0.5) sunUV.z = -1.0;                                                                            \n" +
                                     "                                                                                                                                                       \n" +
                                     "                                                                                                                                                       \n" +
                                     "     vec2 sunUV2 = (sunUV.xy - 0.5) * vec2(1.0, 1.125) * 0.9 + 0.5;                                                                                    \n" +
                                     "     vec4 albedo = mix(1.25 * texture(sunCoronaTexture, sunUV.xy), texture(sunFlareTexture, sunUV2), clamp(dayFactor, 0.0, 0.999999));                 \n" +
                                     "                                                                                                                                                       \n" +
                                     "     albedo.rgb = gammaToLinear(albedo.rgb.rgb) * albedo.a * float(sunUV.z > 0.0);                                                                     \n" +
                                     "     albedo.rgb = pow(albedo.rgb, vec3(mix(4.0, 2.0, dayFactor)));                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     "     float cosTheta = pow(max(dot(dir, lightDir), 0.0), 9.0);                                                                                          \n" +
                                     "     float glow = pow(max(cosTheta, 0.0), 4.0) * 0.01;                                                                                                 \n" +
                                     "                                                                                                                                                       \n" +
                                     "     float fade = smoothstep(0.05, 0.25, dir.y);                                                                                                       \n" +
                                     "     float glowFade = smoothstep(0.05, 0.25, lightDir.y);                                                                                              \n" +
                                     "                                                                                                                                                       \n" +
                                     "     return vec3(albedo.rgb + vec3(1.0, 0.75, 0.5) * glow * glowFade) * fade * 2.0;                                                                    \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " float getSunShadowIlluminance(in float sunHeight) {                                                                                                   \n" +
                                     "     return mix(SPACE_ILLUMINANCE, SUN_ILLUMINANCE, getDayFactor(sunHeight - 0.3));                                                                    \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " float getMoonShadowIlluminance(in float moonHeight) {                                                                                                 \n" +
                                     "     return mix(MOON_ILLUMINANCE, SPACE_ILLUMINANCE, getDayFactor(moonHeight - 0.3));                                                                  \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " vec2 rotate(in vec2 coord, float angle) {                                                                                                             \n" +
                                     "     vec2 t = vec2(sin(angle), cos(angle));                                                                                                            \n" +
                                     "     return vec2(coord.x * t.y - coord.y * t.x, dot(coord, t));                                                                                        \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " vec3 viewDir(in vec2 uv, in float ratio)                                                                                                              \n" +
                                     " {                                                                                                                                                     \n" +
                                     "     vec2 t = ((uv * 2.0) - vec2(1.0)) * vec2(PI, PI * 0.5);                                                                                           \n" +
                                     "     return normalize(vec3(cos(t.y) * cos(t.x), sin(t.y), cos(t.y) * sin(t.x)));                                                                       \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " vec3 tonemapACES(in vec3 color) {                                                                                                                     \n" +
                                     "     float a = 2.51;                                                                                                                                   \n" +
                                     "     float b = 0.03;                                                                                                                                   \n" +
                                     "     float c = 2.43;                                                                                                                                   \n" +
                                     "     float d = 0.59;                                                                                                                                   \n" +
                                     "     float e = 0.14;                                                                                                                                   \n" +
                                     "     return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);                                                                \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " vec2 randomVec2() {                                                                                                                                   \n" +
                                     "    return normalize(vec2(-1.0 + 2.0 * random(), -1.0 + 2.0 * random())) * random();                                                                   \n" +
                                     " }                                                                                                                                                     \n" +
                                     "                                                                                                                                                       \n" +
                                     " void main()                                                                                                                                           \n" +
                                     " {                                                                                                                                                     \n" +
                                     "     vec3 dir = viewDir(texCoords, 1.0);                                                                                                               \n" +
                                     "                                                                                                                                                       \n" +
                                     "     vec3 sunDir  = sunVector;                                                                                                                         \n" +
                                     "     vec3 moonDir = moonVector;                                                                                                                        \n" +
                                     "                                                                                                                                                       \n" +
                                     "     float sunShadowIlluminance  = getSunShadowIlluminance(sunDir.y);                                                                                  \n" +
                                     "     float moonShadowIlluminance = getMoonShadowIlluminance(moonDir.y);                                                                                \n" +
                                     "                                                                                                                                                       \n" +
                                     "     float exposure = 16.0 / max(sunShadowIlluminance + moonShadowIlluminance, 1e-6);                                                                  \n" +
                                     "     exposure = min(exposure, 16.0 / (MOON_ILLUMINANCE * 8.0)); // Clamp the exposure to make night appear darker                                      \n" +
                                     "                                                                                                                                                       \n" +
                                     "     // Atmosphere                                                                                                                                     \n" +
                                     "     vec4 color = textureBicubic(atmosphereTexture, texCoords) * vec4(vec3(1.0 / exposure), 0);                                                        \n" +
                                     "                                                                                                                                                       \n" +
                                     "     // Clouds                                                                                                                                         \n" +
                                     "     vec4 clouds = vec4(0);                                                                                                                            \n" +
                                     "     if(dir.y > 0.0)                                                                                                                                   \n" +
                                     "     {                                                                                                                                                 \n" +
                                     "         _randomSeed = (texCoords.x + 1024.0 * texCoords.y);                                                                                           \n" +
                                     "         clouds = textureBicubic(cloudsTexture, texCoords * vec2(1, 2) + vec2(0, -1) + 0.5 * randomVec2() / 1024.0);                                   \n" +
                                     "         color += clouds;                                                                                                                              \n" +
                                     "     }                                                                                                                                                 \n" +
                                     "                                                                                                                                                       \n" +
                                     "     // Blackbodies                                                                                                                                    \n" +
                                     "     color.rgb += renderSun(dir, sunDir, getDayFactor(sunDir.y + 0.25)) * sunShadowIlluminance * max(1.0 - clouds.a, 0.2);                             \n" +
                                     "     color += renderMoon(dir, moonDir, sunDir, 0.02) * vec4(vec3(moonShadowIlluminance), 1) * max(1.0 - clouds.a, 0.0);                                \n" +
                                     "                                                                                                                                                       \n" +
                                     "     // Moon (glow)                                                                                                                                    \n" +
                                     "     float moonVisibility = pow(max(0., dot(moonDir, dir)), 400.0) * 0.2 * max(1.0 - clouds.a, 0.0);                                                   \n" +
                                     "     vec3 moonColor = vec3(MOON_ILLUMINANCE) * 0.1 + vec3(MOON_ILLUMINANCE) * 0.3 * clamp(pow(max(0., dot(moonDir, dir)), 8.0), 0.0, 1.0);             \n" +
                                     "     float fade = smoothstep(0.05, 0.25, moonDir.y + 0.0375);                                                                                          \n" +
                                     "     float moonDotL = 1.0 - max(dot(sunDir, moonDir), 0.0);                                                                                            \n" +
                                     "     color.rgb += moonVisibility * moonColor * moonDotL * sqrt(fade);                                                                                  \n" +
                                     "                                                                                                                                                       \n" +
                                     "     // Space                                                                                                                                          \n" +
                                     "     const float shimmering = 0.55;                                                                                                                    \n" +
                                     "     vec3 skyVector = normalize(earthTransform * dir);                                                                                                 \n" +
                                     "     vec3 stars = 12.0 * pow(gammaToLinear(textureSphere(starsTexture, skyVector).xyz), vec3(1.35)); float l = length(stars);                          \n" +
                                     "     stars = mix(stars, normalize(vec3(1)) * l, 0.75);                                                                                                 \n" +
                                     "     stars = max(stars - (shimmering * l * smoothstep(0.0, 0.0125, l)) * texture(noiseTexture, texCoords * 60.0 + glTime * 0.075).x, vec3(0));         \n" +
                                     "     stars *= getDayFactor(dir.y) * SPACE_ILLUMINANCE * max(1.0 - 3.0 * color.a, 0.0);                                                                 \n" +
                                     "     color.rgb += stars;                                                                                                                               \n" +
                                     "     color.rgb = max(color.rgb, vec3(0));                                                                                                              \n" +
                                     "                                                                                                                                                       \n" +
                                     "     // Tonemapping                                                                                                                                    \n" +
                                     "     color.rgb *= exposure;                                                                                                                            \n" +
                                     "                                                                                                                                                       \n" +
                                     "     fragColor = vec4(color.rgb, 1.0);                                                                                                                 \n" +
                                     " }                                                                                                                                                     \n");

        if(!program.compile()) console.error(program.getLastError());
        
        program.__uniformSunVector = program.createUniformVec3("sunVector");
        program.__uniformMoonVector = program.createUniformVec3("moonVector");
        program.__uniformEarthTransform = program.createUniformMat3("earthTransform");
        
        program.createUniformSampler("atmosphereTexture", 0);
        program.createUniformSampler("cloudsTexture",     1);
        program.createUniformSampler("starsTexture",      2);
        program.createUniformSampler("moonTexture",       3);
        program.createUniformSampler("sunFlareTexture",   4);
        program.createUniformSampler("sunCoronaTexture",  5);
        program.createUniformSampler("noiseTexture",      6);
             
        glSkyMap.__hdriProgramInstances.set(ctx, program);
    }

    return program;
}

glSkyMap.prototype.free = function()
{
    this.__skyFramebuffer[0].free();
    this.__skyFramebuffer[1].free();
    this.__skyFramebuffer = null;
    
    this.__hdriFramebuffer.free();
    this.__hdriFramebuffer = null;

    this.__envMap.free();
    this.__envMap = null;
}

glSkyMap.__radians = function(deg) {
    return ((Math.PI * deg) / 180.0);
}

glSkyMap.__smoothstep = function(edge0, edge1, x)
{
    let t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0.0), 1.0);
    return t * t * (3.0 - 2.0 * t);
}

glSkyMap.prototype.__updateBlackBodiesPositions = function()
{                                                                                                                 
    let D  = this.__timeDate.x;                                                                                             
    let m  = this.__timeDate.y;                                                                                             
    let y  = this.__timeDate.z;                                                                                             
    let UT = this.__timeDate.w;                                                        
                                 
    let d = 367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) - Math.floor(3 * ((y + Math.floor((m - 9) / 7)) / 100 + 1) / 4) + Math.floor(275 * m / 9) + D - 730515;
    d += UT / 24.0;                                                                                                  
  
    // Sun Orbitals                                                                                                  
    let M = glSkyMap.__radians(356.0470 + 0.9856002585 * d);                                                                  
    let e = 0.016709 - 1.151E-9 * d;                                                                               
    let w = glSkyMap.__radians(282.9404 + 4.70935E-5 * d);                                                                    
                                                                                                                        
    let E = M + e * Math.sin(M) * (1.0 + e * Math.cos(M));                                                                  
                                                                                                                        
    let xv = Math.cos(E) - e;                                                                                           
    let yv = Math.sqrt(1.0 - e*e) * Math.sin(E);                                                                             
                                                                                                                        
    let v = Math.atan2(yv, xv);                                                                                          
    let r = Math.sqrt(xv*xv + yv*yv);                                                                                   
    let lonsun = v + w;                                                                                            
                                                                                                                        
    let xs = r * Math.cos(lonsun);                                                                                      
    let ys = r * Math.sin(lonsun);                                                                                      
                                                                                                                        
    let sunPosition = new glVector3f(xs, 0.0, ys);                                                                                
    this.__sunVector = glVector3f.normalize(sunPosition);

    // Moon Orbitals                                                                                                 
    let a = 60.2666;                                                                                         
    let i = glSkyMap.__radians(5.1454);                                                                                 
    let N = glSkyMap.__radians(125.1228 - 0.0529538083 * d);                                                                  
    M = glSkyMap.__radians(115.3654 + 13.0649929509 * d);                                                                       
    e = 0.054900;                                                                                                    
    w = glSkyMap.__radians(318.0634 + 0.1643573223 * d);                                                                        
                                                                                                                        
    E = M + e * Math.sin(M) * (1.0 + e * Math.cos(M));                                                                        
                                                                                                                        
    xv = a * (Math.cos(E) - e);                                                                                           
    yv = a * (Math.sqrt(1.0 - e*e) * Math.sin(E));                                                                             
                                                                                                                        
    v = Math.atan2(yv, xv);                                                                                                
    r = Math.sqrt(xv*xv + yv*yv);                                                                                         
                                                                                                                        
    let xh = r * (Math.cos(N) * Math.cos(v+w) - Math.sin(N) * Math.sin(v+w) * Math.cos(i));                                               
    let yh = r * (Math.sin(N) * Math.cos(v+w) + Math.cos(N) * Math.sin(v+w) * Math.cos(i));                                               
    let zh = r * (Math.sin(v+w) * Math.sin(i) );                                                                            
                                                                                                                        
    let moonPosition = new glVector3f(xh, -zh, yh);  
    this.__moonVector = glVector3f.normalize(moonPosition);

    // Earth Transform
    let tiltDeg = 23.4;
    let timeOfDaySec = UT * 3600.0;
    timeOfDaySec -= 1.5 * 3600.0; // subtract ~1.5 hr for DST convention

    let earthSpin = -361.0 * (timeOfDaySec / 86400.0) + 180.0;

    this.__earthTransform = glMatrix4x4f.rotationMatrix(tiltDeg, new glVector3f(1, 0, 0));
    this.__earthTransform.mul(glMatrix4x4f.inverse(glMatrix4x4f.lookAtMatrix(new glVector3f(0), sunPosition)));
    this.__earthTransform.mul(glMatrix4x4f.rotationMatrix(earthSpin, new glVector3f(0, 1, 0)));
    this.__earthTransform.mul(glMatrix4x4f.rotationMatrix(this.__latitudeDeg - 90.0, new glVector3f(1, 0, 0)));
    
    // To Local Space
    let inverseEarthTransform = glMatrix4x4f.inverse(this.__earthTransform);
    this.__earthTransform = glMatrix4x4f.normalMatrix(this.__earthTransform);
    this.__sunVector  = glVector3f.normalize(glMatrix4x4f.mul(inverseEarthTransform, glVector3f.mul(this.__sunVector, 1.3e6)));
    this.__moonVector = glVector3f.normalize(glMatrix4x4f.mul(inverseEarthTransform, glVector3f.mul(this.__moonVector, 30.0)));

    this.__sunVector.z  = -this.__sunVector.z;
    this.__moonVector.z = -this.__moonVector.z;
    
    this.__dayFactor = Math.pow(glSkyMap.__smoothstep(-0.6, 0.6, this.__sunVector.y + 0.25), 8.0);

    // Lighting
    let kSun  = Math.sqrt(glSkyMap.__smoothstep(0.035, 0.12, this.__sunVector.y));
    let kMoon = Math.sqrt(glSkyMap.__smoothstep(0.035, 0.12, this.__moonVector.y));
    let moonDotL = 1.0 - Math.max(glVector3f.dot(this.__sunVector, this.__moonVector), 0.0);
    
    let sunLightColor  = new glVector3f(2.0 * kSun, 1.5 * kSun * kSun, 1.0 * kSun * kSun  * kSun);
    let moonLightColor = new glVector3f(0.0375 * kMoon * kMoon * kMoon * moonDotL);

    if(this.__sunVector.y > 0.0 || this.__sunVector.y > this.__moonVector.y)
    {
        this.__directionalLightColor  = sunLightColor;
        this.__directionalLightVector = glVector3f.flip(this.__sunVector);
    }
    else
    {
        this.__directionalLightColor  = moonLightColor;
        this.__directionalLightVector = glVector3f.flip(this.__moonVector);
    }

    this.__envMap.setDirectionalLightVector(this.__directionalLightVector);
   // this.__envMap.setDirectionalLightColor(this.__directionalLightColor);
    this.__envMap.setDirectionalLightColor(null);
}

glSkyMap.prototype.setStarsTexture = function(texture) {
    this.__starsTexture = ((texture != null) ? texture : glSkyMap.__getStarsDefaultTexture(this.__ctx));
}

glSkyMap.prototype.setMoonTexture = function(texture) {
    this.__moonTexture = ((texture != null) ? texture : glSkyMap.__getMoonDefaultTexture(this.__ctx));
}

glSkyMap.prototype.setSunFlareTexture = function(texture) {
    this.__sunFlareTexture = ((texture != null) ? texture : glSkyMap.__getSunFlareDefaultTexture(this.__ctx));
}

glSkyMap.prototype.setSunCoronaTexture = function(texture) {
    this.__sunCoronaTexture = ((texture != null) ? texture : glSkyMap.__getSunCoronaDefaultTexture(this.__ctx));
}

glSkyMap.__dateToSeconds = function(date) {
    return date.x * 3.154e+7 + date.y * 2.628e+6 + date.z * 86400.0 + date.w * 3600.0;
}

glSkyMap.__dateDiffSeconds = function(date1, date2) {
    return Math.abs(glSkyMap.__dateToSeconds(date1) - glSkyMap.__dateToSeconds(date2));
}

glSkyMap.__dateToVec4 = function(date) {
    return new glVector4f(date.getDate(), date.getMonth() + 1, date.getFullYear(), (date.getTime() / 3.6e6 + 1.0) % 24.0);
}

glSkyMap.__vec4ToDate = function(timeDate) 
{
    let date = new Date();
    
    date.setTime(timeDate.w * 3.6e6);
    date.setFullYear(timeDate.z);
    date.setMonth(timeDate.y - 1);
    date.setDate(timeDate.x);

    return date;
}

glSkyMap.dateNow = function() {
    return glSkyMap.__dateToVec4(new Date());
}

glSkyMap.prototype.setTimeDate = function(day, month, year, timeOfDayHours)
{
    if(timeOfDayHours == null) timeOfDayHours = glSkyMap.dateNow().w;
    
    let date = day;
    if(date instanceof Date) date = glSkyMap.__vec4ToDate(date);
    if(!date.__is_glVector4f) date = new glVector4f(day, month, year, timeOfDayHours);

    this.__timeDate.x = Math.floor(Math.min(Math.max(date.x, 1.0), 31.0));
    this.__timeDate.y = Math.floor(Math.min(Math.max(date.y, 1.0), 12.0));
    this.__timeDate.z = Math.floor(date.z);
    this.__timeDate.w = date.w % 24.0;
}

glSkyMap.prototype.setTimeOfDay = function(timeOfDay) 
{
    if(timeOfDay instanceof Date) timeOfDay = ((timeOfDay.getTime() / 3.6e6 + 1.0) % 24.0);
    this.setTimeDate(new glVector4f(this.__timeDate.x, this.__timeDate.y, this.__timeDate.z, timeOfDay));
}

glSkyMap.prototype.setLatitude = function(latitudeDeg) {
    this.__latitudeDeg = Math.min(Math.max(latitudeDeg, -90.0), +90.0);
}

glSkyMap.prototype.getLatitude = function() {
    return this.__latitudeDeg;
}

glSkyMap.prototype.getDayFactor = function() {
    return this.__dayFactor;
}

glSkyMap.prototype.update = function()
{
    let gl = this.__ctx.getGL();

    if(!this.__starsTexture.ready() || !this.__moonTexture.ready() || !this.__sunFlareTexture.ready() || !this.__sunCoronaTexture.ready()) return;

    let dateDiffSeconds = glSkyMap.__dateDiffSeconds(this.__timeDate, this.__lastTimeDate);
    this.__lastTimeDate.set(this.__timeDate);

    let latitudeDiffDegs = Math.abs(this.__latitudeDeg - this.__lastLatitudeDeg);
    if(latitudeDiffDegs > 0.0) dateDiffSeconds += 1e6;
    this.__lastLatitudeDeg = this.__latitudeDeg;

    if(dateDiffSeconds > 0.0) this.__updateBlackBodiesPositions();

    let nSkyIterations = Math.min(Math.max(Math.floor(dateDiffSeconds), 1), 65);
    let nRadianceIterations = Math.min(Math.max(Math.floor(dateDiffSeconds * 60.0), 1), 1024);

    let lastActiveViewport = this.__ctx.getViewport();
    let lastActiveProgram  = this.__ctx.getActiveProgram();
    let lastActiveTexture0 = this.__ctx.getActiveTexture(0);
    let lastActiveTexture1 = this.__ctx.getActiveTexture(1);
    let lastActiveTexture2 = this.__ctx.getActiveTexture(2);
    let lastActiveTexture3 = this.__ctx.getActiveTexture(3);
    let lastActiveTexture4 = this.__ctx.getActiveTexture(4);
    let lastActiveTexture5 = this.__ctx.getActiveTexture(5);
    let lastActiveTexture6 = this.__ctx.getActiveTexture(6);
    let lastActiveFramebuffer = this.__ctx.getActiveFramebuffer();
    
    this.__atmosphereProgram.__uniformSunVector.set(this.__sunVector);
    this.__atmosphereProgram.__uniformMoonVector.set(this.__moonVector);

    for(let i = 0; i < nSkyIterations; ++i)
    {
        let currStateID = ((this.__iterationID + 0) % 2);
        let lastStateID = ((this.__iterationID + 1) % 2);
        
        this.__atmosphereProgram.__uniformFrameID.set(this.__iterationID);

        this.__clearSkyLUT[lastStateID].bind(0);
        this.__cloudsLUT[lastStateID].bind(1);

        this.__skyFramebuffer[currStateID].bind([ this.__clearSkyMap[currStateID], 
                                                  this.__clearSkyLUT[currStateID], 
                                                  this.__cloudsMap[currStateID], 
                                                  this.__cloudsLUT[currStateID] ]);

        this.__atmosphereProgram.runPostProcess();

        ++this.__iterationID;
    }

    this.__hdriProgram.__uniformSunVector.set(this.__sunVector);
    this.__hdriProgram.__uniformMoonVector.set(this.__moonVector);
    this.__hdriProgram.__uniformEarthTransform.set(this.__earthTransform);

    let currStateID = ((this.__iterationID + 1) % 2);
    this.__envMap.__environmentFramebuffer.bind([this.__envMap.__environmentMap]);

    this.__starsTexture.setFilterMode(gl.LINEAR, gl.LINEAR);
    this.__moonTexture.setFilterMode(gl.LINEAR, gl.LINEAR);
    this.__sunFlareTexture.setFilterMode(gl.LINEAR, gl.LINEAR);
    this.__sunCoronaTexture.setFilterMode(gl.LINEAR, gl.LINEAR);

    this.__clearSkyMap[currStateID].bind(0);
    this.__cloudsMap[currStateID].bind(1);
    this.__starsTexture.bind(2);
    this.__moonTexture.bind(3);
    this.__sunFlareTexture.bind(4);
    this.__sunCoronaTexture.bind(5);
    this.__noiseTexture.bind(6);

    this.__hdriProgram.runPostProcess();
    this.__envMap.__environmentFramebuffer.unbind();
        
    this.__envMap.__skyMap = this.__clearSkyMap[currStateID];
    this.__envMap.__pendingRadianceIntegrationSteps = 1024;
    this.__envMap.updateRadiance(((nRadianceIterations < 16) ? 1 : null));
/*
    this.__envMap.__radianceLutFramebuffer.bind([this.__envMap.__radianceLUT]);
    let data = new Float32Array(4);
    gl.readPixels(1, 0, 1, 1, gl.RGBA, gl.FLOAT, data);
    this.__envMap.__radianceLutFramebuffer.unbind();
    this.__directionalLightColor.set(data[0], data[1], data[2]);
*/
    this.__ctx.bindFramebuffer(lastActiveFramebuffer);
    this.__ctx.setViewport(lastActiveViewport.x, lastActiveViewport.y, lastActiveViewport.w, lastActiveViewport.h);
    this.__ctx.bindTexture(6, lastActiveTexture6);
    this.__ctx.bindTexture(5, lastActiveTexture5);
    this.__ctx.bindTexture(4, lastActiveTexture4);
    this.__ctx.bindTexture(3, lastActiveTexture3);
    this.__ctx.bindTexture(2, lastActiveTexture2);
    this.__ctx.bindTexture(1, lastActiveTexture1);
    this.__ctx.bindTexture(0, lastActiveTexture0);
    this.__ctx.bindProgram(lastActiveProgram);
}
