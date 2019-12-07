#version 300 es

uniform mat4 glModelViewProjectionMatrix;

void main() {      
    gl_Position = (glModelViewProjectionMatrix * vec4(glVertex.xyz, 1.0)); 
}