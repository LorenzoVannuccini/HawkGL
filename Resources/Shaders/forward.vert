#version 300 es
precision mediump float;

uniform mat3 glNormalMatrix;
uniform mat4 glModelViewMatrix;
uniform mat4 glModelViewProjectionMatrix;

uniform vec3 lightVector;
uniform mat4 shadowMatrix;

out vec2 texCoords;  
out vec3 shadowCoords;
out vec3 normalEyeSpace;
out vec3 lightVectorEyeSpace;
  
void main()
{      
    texCoords = glTexCoord;
    lightVectorEyeSpace = lightVector;
    normalEyeSpace = glNormalMatrix * glNormal;
    
    shadowCoords = (shadowMatrix * vec4(glVertex, 1.0)).xyz;
    shadowCoords = vec3(0.5) + 0.5 * shadowCoords;
    
    gl_Position = (glModelViewProjectionMatrix * vec4(glVertex.xyz, 1.0));
}