#version 300 es
precision mediump float;
                  
out lowp vec4 fragColor;

uniform lowp sampler2D diffuseMap;
uniform lowp sampler2DShadow shadowMap;

in vec2 texCoords;
in vec3 shadowCoords;
in vec3 normalEyeSpace;
in vec3 lightVectorEyeSpace;

void main()
{      
    float lightContribution = max(dot(normalize(normalEyeSpace), normalize(lightVectorEyeSpace)), 0.0);
    lightContribution *= texture(shadowMap, shadowCoords);
    lightContribution = max(lightContribution, 0.2);

    fragColor = texture(diffuseMap, texCoords) * lightContribution;
}
