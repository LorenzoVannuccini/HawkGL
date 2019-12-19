#version 300 es

void main() {      
    gl_Position = (glModelViewProjectionMatrix * vec4(glVertex.xyz, 1.0)); 
}