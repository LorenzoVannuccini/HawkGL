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

let glUniformBlock = function(ctx, name)
{
    this.__ctx = ctx;

    this.__name = name;

    this.__uniforms = new Map();
    this.__pendingUpdateUniforms = new Map();

    this.__uniformBufferObject = ctx.getGL().createBuffer();
    this.__shouldCompile = false;
    this.__didCompile = false;
}

glUniformBlock.Precision = Object.freeze({"LOWP":"lowp", "MEDIUMP":"mediump", "HIGHP":"highp"});

glUniformBlock.__std140ArrayInt16 = function(data, length)
{
    if(length == null) length = data.length;
    let buffer = new Int16Array(length * 8);

    for(let i = 0; i != length; ++i) buffer[i * 8] = data[i];

    return buffer;
}

glUniformBlock.__std140ArrayInt32 = function(data, length)
{
    if(length == null) length = data.length;
    let buffer = new Int32Array(length * 4);

    for(let i = 0; i != length; ++i) buffer[i * 4] = data[i];

    return buffer;
}

glUniformBlock.__std140ArrayVec2 = function(data, length)
{
    if(length == null) length = data.length;
    let buffer = new Float32Array(length * 2);

    for(let i = 0; i < length; i += 2)
    {
        buffer[i * 2 + 0] = data[i + 0];
        buffer[i * 2 + 1] = data[i + 1];
    }
    
    return buffer;
}

glUniformBlock.__std140ArrayVec3 = function(data, length)
{
    if(length == null) length = data.length;
    let buffer = new Float32Array(Math.floor(length + length / 3));
    
    for(let i = 0, k = 0; i < length; i += 3, k += 4)
    {
        buffer[k + 0] = data[i + 0];
        buffer[k + 1] = data[i + 1];
        buffer[k + 2] = data[i + 2];
    }

    return buffer;
}

glUniformBlock.__std140ArrayFloat = function(data, length)
{
    if(length == null) length = data.length;
    let buffer = new Float32Array(length * 4);

    for(let i = 0; i != length; ++i) buffer[i * 4] = data[i];

    return buffer;
}

glUniformBlock.prototype.getName = function() {
    return this.__name;
}

glUniformBlock.prototype.size = function() {
    return this.__uniforms.size;
}

glUniformBlock.prototype.empty = function() {
    return (this.__uniforms.size < 1);
}

glUniformBlock.prototype.getMaxBindingUnit = function() {
    return (this.__ctx.__sharedUniformBlockUnitID - 1);
}

glUniformBlock.prototype.bind = function(unitID) {
    this.__ctx.bindUniformBlock(unitID, this);
}

glUniformBlock.prototype.getShaderSource = function()
{
    if(this.__shouldCompile) this.compile();
    return ((this.__didCompile) ? this.__shaderBlockSource : null);
}

glUniformBlock.prototype.update = function()
{
    if(this.__shouldCompile) this.compile();
    if(this.__didCompile && (this.__pendingUpdateUniforms.size > 0))
    {
        this.__ctx.bindUniformBuffer(this.__uniformBufferObject);
    
        this.__pendingUpdateUniforms.forEach( function(uniform) {
            uniform.update();
        });

        this.__pendingUpdateUniforms.clear();
    }
}

glUniformBlock.prototype.compile = function()
{
    this.__didCompile    = false;
    this.__shouldCompile = false;
    
    if(this.empty()) return false;
    
    let shaderBlockSource = "";
    shaderBlockSource = "layout(std140) uniform " + this.__name + "\n{\n";
    this.__uniforms.forEach( function(uniform)
    {
        let isArray = (uniform.__elements != null);
        shaderBlockSource += uniform.__precision + " " + uniform.__type + " " + uniform.__name + (isArray ? ("[" + uniform.__elements + "]") : "") + ";\n";
    });
    shaderBlockSource += "};\n";

    this.__shaderBlockSource = shaderBlockSource;
    let shaderSource = "#version 300 es\n" + this.__shaderBlockSource + "void main(){}";

    let activeProgram = this.__ctx.getActiveProgram();
    let program = new glProgram(this.__ctx, shaderSource, shaderSource);
    
    this.__didCompile = program.compile();
    this.__ctx.bindProgram(activeProgram);

    if(!this.__didCompile) return false;

    let gl = this.__ctx.getGL();
    program = program.getProgramID();

    let uniformNames = Array.from(this.__uniforms.keys());
    for(let i = 0, e = uniformNames.length; i != e; ++i)
    {
        let uniform = this.__uniforms.get(uniformNames[i]);
        let isArray = (uniform.__elements != null);
        
        if(isArray) uniformNames[i] += "[0]";
    }
    
    let uniformBlockLocationID = gl.getUniformBlockIndex(program, this.__name);
    let uniformBlockSizeBytes  = gl.getActiveUniformBlockParameter(program, uniformBlockLocationID, gl.UNIFORM_BLOCK_DATA_SIZE);
    
    this.__ctx.bindUniformBuffer(this.__uniformBufferObject);
    gl.bufferData(gl.UNIFORM_BUFFER, uniformBlockSizeBytes, gl.DYNAMIC_DRAW);

    let uniformIndices = gl.getUniformIndices(program, uniformNames);
    let uniformOffsets = gl.getActiveUniforms(program, uniformIndices, gl.UNIFORM_OFFSET);
    
    uniformNames = Array.from(this.__uniforms.keys());
    for(let i = 0, e = uniformNames.length; i != e; ++i) 
    {
        let uniform = this.__uniforms.get(uniformNames[i]);
        uniform.__offset = uniformOffsets[i];
    }
    
    return true;
}

glUniformBlock.prototype.createUniformInt = function(name, precision, value)
{
    let uniform = new glUniformBlock.UniformInt(this, name, precision, value);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformArrayInt = function(name, precision, size, array)
{
    let uniform = new glUniformBlock.UniformArrayInt(this, name, precision, size, array);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformFloat = function(name, precision, value)
{
    let uniform = new glUniformBlock.UniformFloat(this, name, precision, value);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformArrayFloat = function(name, precision, size, array)
{
    let uniform = new glUniformBlock.UniformArrayFloat(this, name, precision, size, array);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformVec2 = function(name, precision, x, y)
{
    let uniform = new glUniformBlock.UniformVec2(this, name, precision, x, y);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformArrayVec2 = function(name, precision, size, array)
{
    let uniform = new glUniformBlock.UniformArrayVec2(this, name, precision, size, array);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformVec3 = function(name, precision, x, y, z)
{
    let uniform = new glUniformBlock.UniformVec3(this, name, precision, x, y, z);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformArrayVec3 = function(name, precision, size, array)
{
    let uniform = new glUniformBlock.UniformArrayVec3(this, name, precision, size, array);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformVec4 = function(name, precision, x, y, z, w)
{
    let uniform = new glUniformBlock.UniformVec4(this, name, precision, x, y, z, w);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformArrayVec4 = function(name, precision, size, array)
{
    let uniform = new glUniformBlock.UniformArrayVec4(this, name, precision, size, array);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformMat2 = function(name, precision, matrix)
{
    let uniform = new glUniformBlock.UniformMat2(this, name, precision, matrix);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformArrayMat2 = function(name, precision, size, array)
{
    let uniform = new glUniformBlock.UniformArrayMat2(this, name, precision, size, array);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformMat3 = function(name, precision, matrix)
{
    let uniform = new glUniformBlock.UniformMat3(this, name, precision, matrix);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformArrayMat3 = function(name, precision, size, array)
{
    let uniform = new glUniformBlock.UniformArrayMat3(this, name, precision, size, array);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformMat4 = function(name, precision, matrix)
{
    let uniform = new glUniformBlock.UniformMat4(this, name, precision, matrix);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

glUniformBlock.prototype.createUniformArrayMat4 = function(name, precision, size, array)
{
    let uniform = new glUniformBlock.UniformArrayMat4(this, name, precision, size, array);
    this.__uniforms.set(name, uniform);
    this.__shouldCompile = true;
    
    return uniform;
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.Uniform = function(uniformBlock, name, precision, glslType, arrayTypeConstructor, nComponents)
{
    this.__name = name;
    this.__type = glslType;
    this.__size = nComponents;
    this.__precision = precision;
    
    this.__uniformBlock = uniformBlock;
    this.__offset = null;
   
    this.__clientData = new arrayTypeConstructor(this.__size);
    this.__clientData.fill(0.0);

    this.__gpuData = new arrayTypeConstructor(this.__size);
    this.__gpuData.fill(0.0);

    this.__upToDate = true;
}

glUniformBlock.Uniform.prototype.__shouldUpdate = function()
{
    if(!this.__upToDate && (this.__offset != null)) 
    {
        let size = this.__size;
        if(size > this.__uniformBlock.__ctx.__uniformsUpdateCheckMaxComponents) return true;
        
        for(let i = 0; i != size; ++i) if(this.__clientData[i] != this.__gpuData[i]) return true;
        this.__upToDate = true;
    }

    return false;
}

glUniformBlock.Uniform.prototype.__setClientData = function(newClientData)
{
    if(newClientData != null) this.__clientData.set(newClientData);

    this.__uniformBlock.__pendingUpdateUniforms.set(this.__name, this);
    this.__upToDate = false; 
}

glUniformBlock.Uniform.prototype.update = function() // NB: assumes uniform buffer is bound
{
    if(this.__shouldUpdate())
    {
        this.__sendToGPU(this.__uniformBlock.__ctx.getGL());

        this.__gpuData.set(this.__clientData.subarray(0, this.__size));
        this.__upToDate = true;
    }
}

glUniformBlock.Uniform.prototype.__sendToGPU = function(gl) {
    gl.bufferSubData(gl.UNIFORM_BUFFER, this.__offset, this.__clientData, 0, this.__size);
}

glUniformBlock.Uniform.prototype.set = null; // abstract
glUniformBlock.Uniform.prototype.get = null; // abstract

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformArray = function(uniformBlock, name, precision, glslType, arrayTypeConstructor, size, nElements, array)
{
    glUniformBlock.Uniform.call(this, uniformBlock, name, precision, glslType, arrayTypeConstructor, size);
    this.__elements = nElements;

    if(array != null) this.set(array);
}

glUniformBlock.UniformArray.prototype = Object.create(glUniformBlock.Uniform.prototype);

glUniformBlock.UniformArray.prototype.set = function(array) {
    this.__setClientData(array);
}

glUniformBlock.UniformArray.prototype.get = function() {
    return this.__clientData.slice(0, this.__size);
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformInt = function(uniformBlock, name, precision, value)
{
    glUniformBlock.Uniform.call(this, uniformBlock, name, precision, "int", Int32Array, 1);    
    if(value != null) this.set(value);
}

glUniformBlock.UniformInt.prototype = Object.create(glUniformBlock.Uniform.prototype);

glUniformBlock.UniformInt.prototype.set = function(value) {
    this.__setClientData([value]);
}

glUniformBlock.UniformInt.prototype.get = function() {
    return this.__clientData[0];
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformFloat = function(uniformBlock, name, precision, value)
{
    glUniformBlock.Uniform.call(this, uniformBlock, name, precision, "float", Float32Array, 1);    
    if(value != null) this.set(value);
}

glUniformBlock.UniformFloat.prototype = Object.create(glUniformBlock.Uniform.prototype);

glUniformBlock.UniformFloat.prototype.set = function(value) {
    this.__setClientData([value]);
}

glUniformBlock.UniformFloat.prototype.get = function() {
    return this.__clientData[0];
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformVec2 = function(uniformBlock, name, precision, x, y)
{
    glUniformBlock.Uniform.call(this, uniformBlock, name, precision, "vec2", Float32Array, 2);    
    if(x != null) this.set(x, y);
}

glUniformBlock.UniformVec2.prototype = Object.create(glUniformBlock.Uniform.prototype);

glUniformBlock.UniformVec2.prototype.set = function(x, y)
{
    let v = x;
    if(!v.__is_glVector2f) v = new glVector2f(x, y);
    
    this.__setClientData([v.x, v.y]);
}

glUniformBlock.UniformVec2.prototype.get = function() {
    return new glVector2f(this.__clientData[0], this.__clientData[1]);
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformVec3 = function(uniformBlock, name, precision, x, y, z)
{
    glUniformBlock.Uniform.call(this, uniformBlock, name, precision, "vec3", Float32Array, 3);    
    if(x != null) this.set(x, y, z);
}

glUniformBlock.UniformVec3.prototype = Object.create(glUniformBlock.Uniform.prototype);

glUniformBlock.UniformVec3.prototype.set = function(x, y, z)
{
    let v = x;
    if(!v.__is_glVector3f) v = new glVector3f(x, y, z);
    
    this.__setClientData([v.x, v.y, v.z]);
}

glUniformBlock.UniformVec3.prototype.get = function() {
    return new glVector3f(this.__clientData[0], this.__clientData[1], this.__clientData[2]);
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformVec4 = function(uniformBlock, name, precision, x, y, z, w)
{
    glUniformBlock.Uniform.call(this, uniformBlock, name, precision, "vec4", Float32Array, 4);    
    if(x != null) this.set(x, y, z, w);
}

glUniformBlock.UniformVec4.prototype = Object.create(glUniformBlock.Uniform.prototype);

glUniformBlock.UniformVec4.prototype.set = function(x, y, z, w)
{
    let v = x;
    if(!v.__is_glVector4f) v = new glVector4f(x, y, z, w);
    
    this.__setClientData([v.x, v.y, v.z, v.w]);
}

glUniformBlock.UniformVec4.prototype.get = function() {
    return new glVector4f(this.__clientData[0], this.__clientData[1], this.__clientData[2], this.__clientData[3]);
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformMat2 = function(uniformBlock, name, precision, matrix)
{
    glUniformBlock.Uniform.call(this, uniformBlock, name, precision, "mat2", Float32Array, 4);    
    this.set(((matrix != null) ? matrix : glMatrix4x4f.identityMatrix()));
}

glUniformBlock.UniformMat2.prototype = Object.create(glUniformBlock.Uniform.prototype);

glUniformBlock.UniformMat2.prototype.set = function(matrix)
{
    if(matrix.__is_glMatrix4x4f)
    {
        let m = matrix.__m;
        matrix = [ m[0], m[1],
                   m[4], m[5] ];  
    }
    
    this.__setClientData(matrix);
}

glUniformBlock.UniformMat2.prototype.get = function()
{
    let m = this.__clientData;
    return new glMatrix4x4f([ m[0], m[1], 0.0, 0.0, 
                              m[2], m[3], 0.0, 0.0,
                              0.0,  0.0,  1.0, 0.0,
                              0.0,  0.0,  0.0, 1.0 ]);
}

glUniformBlock.UniformMat2.prototype.__sendToGPU = function(gl) {
    gl.bufferSubData(gl.UNIFORM_BUFFER, this.__offset, glUniformBlock.__std140ArrayVec2(this.__clientData, this.__size));
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformMat3 = function(uniformBlock, name, precision, matrix)
{
    glUniformBlock.Uniform.call(this, uniformBlock, name, precision, "mat3", Float32Array, 9);    
    this.set(((matrix != null) ? matrix : glMatrix4x4f.identityMatrix()));
}

glUniformBlock.UniformMat3.prototype = Object.create(glUniformBlock.Uniform.prototype);

glUniformBlock.UniformMat3.prototype.set = function(matrix)
{
    if(matrix.__is_glMatrix4x4f)
    {
        let m = matrix.__m;
        matrix = [ m[0], m[1], m[2],
                   m[4], m[5], m[6],
                   m[8], m[9], m[10] ]; 
    }
    
    this.__setClientData(matrix);
}

glUniformBlock.UniformMat3.prototype.get = function()
{
    let m = this.__clientData;
    return new glMatrix4x4f([ m[0], m[1], m[2], 0.0, 
                              m[3], m[4], m[5], 0.0,
                              m[6], m[7], m[8], 0.0,
                              0.0,  0.0,  0.0,  1.0 ]);
}

glUniformBlock.UniformMat3.prototype.__sendToGPU = function(gl) {
    gl.bufferSubData(gl.UNIFORM_BUFFER, this.__offset, glUniformBlock.__std140ArrayVec3(this.__clientData, this.__size));
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformMat4 = function(uniformBlock, name, precision, matrix)
{
    glUniformBlock.Uniform.call(this, uniformBlock, name, precision, "mat4", Float32Array, 16);    
    this.set(((matrix != null) ? matrix : glMatrix4x4f.identityMatrix()));
}

glUniformBlock.UniformMat4.prototype = Object.create(glUniformBlock.Uniform.prototype);

glUniformBlock.UniformMat4.prototype.set = function(matrix) {
    this.__setClientData((matrix.__is_glMatrix4x4f ? matrix.__m : matrix));
}

glUniformBlock.UniformMat4.prototype.get = function() {
    return new glMatrix4x4f(this.__clientData);
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformArrayInt = function(uniformBlock, name, precision, size, array) {
    glUniformBlock.UniformArray.call(this, uniformBlock, name, precision, "int", Int32Array, size, size, array);    
}

glUniformBlock.UniformArrayInt.prototype = Object.create(glUniformBlock.UniformArray.prototype);

glUniformBlock.UniformArrayInt.prototype.set = function(array)
{
    this.__size = array.length;
    this.__clientData.set(array);

    this.__setClientData(null);
}

glUniformBlock.UniformArrayInt.prototype.__sendToGPU = function(gl) {
    gl.bufferSubData(gl.UNIFORM_BUFFER, this.__offset, glUniformBlock.__std140ArrayInt32(this.__clientData, this.__size));
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformArrayFloat = function(uniformBlock, name, precision, size, array) {
    glUniformBlock.UniformArray.call(this, uniformBlock, name, precision, "float", Float32Array, size, size, array);    
}

glUniformBlock.UniformArrayFloat.prototype = Object.create(glUniformBlock.UniformArray.prototype);

glUniformBlock.UniformArrayFloat.prototype.set = function(array)
{
    this.__size = array.length;
    this.__clientData.set(array);

    this.__setClientData(null);
}

glUniformBlock.UniformArrayFloat.prototype.__sendToGPU = function(gl) {
    gl.bufferSubData(gl.UNIFORM_BUFFER, this.__offset, glUniformBlock.__std140ArrayFloat(this.__clientData, this.__size));
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformArrayVec2 = function(uniformBlock, name, precision, size, array) {
    glUniformBlock.UniformArray.call(this, uniformBlock, name, precision, "vec2", Float32Array, size * 2, size, array);    
}

glUniformBlock.UniformArrayVec2.prototype = Object.create(glUniformBlock.UniformArray.prototype);

glUniformBlock.UniformArrayVec2.prototype.set = function(array)
{
    let len = array.length;
    this.__size = len * 2;
    this.__clientData.set(array);
    
    for(let i = 0; i != len; ++i)
    {
        let v = array[i];

        this.__clientData[i * 2 + 0] = v.x;
        this.__clientData[i * 2 + 1] = v.y;
    }
    
    this.__setClientData(null);
}

glUniformBlock.UniformArrayVec2.prototype.get = function()
{
    let nElements = this.__size / 2;
    let array = new Array(nElements);

    for(let i = 0; i != nElements; ++i) array[i] = new glVector2f(this.__clientData[i * 2 + 0], this.__clientData[i * 2 + 1]);
    
    return array;
}

glUniformBlock.UniformArrayVec2.prototype.__sendToGPU = function(gl) {
    gl.bufferSubData(gl.UNIFORM_BUFFER, this.__offset, glUniformBlock.__std140ArrayVec2(this.__clientData, this.__size));
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformArrayVec3 = function(uniformBlock, name, precision, size, array) {
    glUniformBlock.UniformArray.call(this, uniformBlock, name, precision, "vec3", Float32Array, size * 3, size, array);    
}

glUniformBlock.UniformArrayVec3.prototype = Object.create(glUniformBlock.UniformArray.prototype);

glUniformBlock.UniformArrayVec3.prototype.set = function(array)
{
    let len = array.length;
    this.__size = len * 3;
    this.__clientData.set(array);
    
    for(let i = 0; i != len; ++i)
    {
        let v = array[i];

        this.__clientData[i * 3 + 0] = v.x;
        this.__clientData[i * 3 + 1] = v.y;
        this.__clientData[i * 3 + 2] = v.z;
    }
    
    this.__setClientData(null);
}

glUniformBlock.UniformArrayVec3.prototype.get = function()
{
    let nElements = this.__size / 3;
    let array = new Array(nElements);

    for(let i = 0; i != nElements; ++i) array[i] = new glVector3f(this.__clientData[i * 3 + 0], this.__clientData[i * 3 + 1], this.__clientData[i * 3 + 2]);
    
    return array;
}

glUniformBlock.UniformArrayVec3.prototype.__sendToGPU = function(gl) {
    gl.bufferSubData(gl.UNIFORM_BUFFER, this.__offset, glUniformBlock.__std140ArrayVec3(this.__clientData, this.__size));
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformArrayVec4 = function(uniformBlock, name, precision, size, array) {
    glUniformBlock.UniformArray.call(this, uniformBlock, name, precision, "vec4", Float32Array, size * 4, size, array);    
}

glUniformBlock.UniformArrayVec4.prototype = Object.create(glUniformBlock.UniformArray.prototype);

glUniformBlock.UniformArrayVec4.prototype.set = function(array)
{
    let len = array.length;
    this.__size = len * 4;
    this.__clientData.set(array);
    
    for(let i = 0; i != len; ++i)
    {
        let v = array[i];

        this.__clientData[i * 4 + 0] = v.x;
        this.__clientData[i * 4 + 1] = v.y;
        this.__clientData[i * 4 + 2] = v.z;
        this.__clientData[i * 4 + 3] = v.w;
    }
    
    this.__setClientData(null);
}

glUniformBlock.UniformArrayVec4.prototype.get = function()
{
    let nElements = this.__size / 4;
    let array = new Array(nElements);

    for(let i = 0; i != nElements; ++i) array[i] = new glVector4f(this.__clientData[i * 4 + 0], this.__clientData[i * 4 + 1], this.__clientData[i * 4 + 2], this.__clientData[i * 4 + 3]);
    
    return array;
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformArrayMat2 = function(uniformBlock, name, precision, size, array) {
    glUniformBlock.UniformArray.call(this, uniformBlock, name, precision, "mat2", Float32Array, size * 4, size, array);    
}

glUniformBlock.UniformArrayMat2.prototype = Object.create(glUniformBlock.UniformArray.prototype);

glUniformBlock.UniformArrayMat2.prototype.set = function(array)
{
    let len = array.length;
    this.__size = len * 4;
    this.__clientData.set(array);
    
    for(let i = 0; i != len; ++i)
    {
        let m = array[i].__m;

        this.__clientData[i * 4 + 0]  = m[0];
        this.__clientData[i * 4 + 1]  = m[1];
        this.__clientData[i * 4 + 2]  = m[4];
        this.__clientData[i * 4 + 3]  = m[5];
    }
    
    this.__setClientData(null);
}

glUniformBlock.UniformArrayMat2.prototype.get = function()
{
    let nElements = this.__size / 4;
    let array = new Array(nElements);

    for(let i = 0; i != nElements; ++i)
    {
        let m = (array[i] = new glMatrix4x4f()).__m;

        m[0]  = this.__clientData[i * 4 + 0];
        m[1]  = this.__clientData[i * 4 + 1];
        m[4]  = this.__clientData[i * 4 + 2];
        m[5]  = this.__clientData[i * 4 + 3];
    }
    
    return array;
}

glUniformBlock.UniformArrayMat2.prototype.__sendToGPU = function(gl) {
    gl.bufferSubData(gl.UNIFORM_BUFFER, this.__offset, glUniformBlock.__std140ArrayVec2(this.__clientData, this.__size));
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformArrayMat3 = function(uniformBlock, name, precision, size, array) {
    glUniformBlock.UniformArray.call(this, uniformBlock, name, precision, "mat3", Float32Array, size * 9, size, array);    
}

glUniformBlock.UniformArrayMat3.prototype = Object.create(glUniformBlock.UniformArray.prototype);

glUniformBlock.UniformArrayMat3.prototype.set = function(array)
{
    let len = array.length;
    this.__size = len * 9;
    this.__clientData.set(array);
    
    for(let i = 0; i != len; ++i)
    {
        let m = array[i].__m;

        this.__clientData[i * 9 + 0]  = m[0];
        this.__clientData[i * 9 + 1]  = m[1];
        this.__clientData[i * 9 + 2]  = m[2];
        this.__clientData[i * 9 + 3]  = m[4];
        this.__clientData[i * 9 + 4]  = m[5];
        this.__clientData[i * 9 + 5]  = m[6];
        this.__clientData[i * 9 + 6]  = m[8];
        this.__clientData[i * 9 + 7]  = m[9];
        this.__clientData[i * 9 + 8]  = m[10];
    }

    this.__setClientData(null);
}

glUniformBlock.UniformArrayMat3.prototype.get = function()
{
    let nElements = this.__size / 9;
    let array = new Array(nElements);

    for(let i = 0; i != nElements; ++i)
    {
        let m = (array[i] = new glMatrix4x4f()).__m;

        m[0]  = this.__clientData[i * 9 + 0];
        m[1]  = this.__clientData[i * 9 + 1];
        m[2]  = this.__clientData[i * 9 + 2];
        m[4]  = this.__clientData[i * 9 + 3];
        m[5]  = this.__clientData[i * 9 + 4];
        m[6]  = this.__clientData[i * 9 + 5];
        m[8]  = this.__clientData[i * 9 + 6];
        m[9]  = this.__clientData[i * 9 + 7];
        m[10] = this.__clientData[i * 9 + 8];
    }
    
    return array;
}

glUniformBlock.UniformArrayMat3.prototype.__sendToGPU = function(gl) {
    gl.bufferSubData(gl.UNIFORM_BUFFER, this.__offset, glUniformBlock.__std140ArrayVec3(this.__clientData, this.__size));
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------

glUniformBlock.UniformArrayMat4 = function(uniformBlock, name, precision, size, array) {
    glUniformBlock.UniformArray.call(this, uniformBlock, name, precision, "mat4", Float32Array, size * 16, size, array);    
}

glUniformBlock.UniformArrayMat4.prototype = Object.create(glUniformBlock.UniformArray.prototype);

glUniformBlock.UniformArrayMat4.prototype.set = function(array)
{
    let len = array.length;
    this.__size = len * 16;
    this.__clientData.set(array);
    
    for(let i = 0; i != len; ++i)
    {
        let m = array[i].__m;

        this.__clientData[i * 16 + 0]  = m[0];
        this.__clientData[i * 16 + 1]  = m[1];
        this.__clientData[i * 16 + 2]  = m[2];
        this.__clientData[i * 16 + 3]  = m[3];
        this.__clientData[i * 16 + 4]  = m[4];
        this.__clientData[i * 16 + 5]  = m[5];
        this.__clientData[i * 16 + 6]  = m[6];
        this.__clientData[i * 16 + 7]  = m[7];
        this.__clientData[i * 16 + 8]  = m[8];
        this.__clientData[i * 16 + 9]  = m[9];
        this.__clientData[i * 16 + 10] = m[10];
        this.__clientData[i * 16 + 11] = m[11];
        this.__clientData[i * 16 + 12] = m[12];
        this.__clientData[i * 16 + 13] = m[13];
        this.__clientData[i * 16 + 14] = m[14];
        this.__clientData[i * 16 + 15] = m[15];
    }

    this.__setClientData(null);
}

glUniformBlock.UniformArrayMat4.prototype.get = function()
{
    let nElements = this.__size / 16;
    let array = new Array(nElements);

    for(let i = 0; i != nElements; ++i)
    {
        let m = (array[i] = new glMatrix4x4f()).__m;

        m[0]  = this.__clientData[i * 16 + 0];
        m[1]  = this.__clientData[i * 16 + 1];
        m[2]  = this.__clientData[i * 16 + 2];
        m[3]  = this.__clientData[i * 16 + 3];
        m[4]  = this.__clientData[i * 16 + 4];
        m[5]  = this.__clientData[i * 16 + 5];
        m[6]  = this.__clientData[i * 16 + 6];
        m[7]  = this.__clientData[i * 16 + 7];
        m[8]  = this.__clientData[i * 16 + 8];
        m[9]  = this.__clientData[i * 16 + 9];
        m[10] = this.__clientData[i * 16 + 10];
        m[11] = this.__clientData[i * 16 + 11];
        m[12] = this.__clientData[i * 16 + 12];
        m[13] = this.__clientData[i * 16 + 13];
        m[14] = this.__clientData[i * 16 + 14];
        m[15] = this.__clientData[i * 16 + 15];
    }

    return array;
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------
