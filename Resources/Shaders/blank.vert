#version 300 es

in vec3 glVertex;
uniform mat4 glModelViewProjectionMatrix;

void main() {      
    gl_Position = (glModelViewProjectionMatrix * vec4(glVertex.xyz, 1.0)); 
}