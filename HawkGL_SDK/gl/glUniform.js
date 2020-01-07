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

let glUniform = function(ctx, program, name, arrayTypeConstructor, nComponents)
{
    this.__ctx = ctx;
    
    this.__name = name;
    this.__size = nComponents;
    
    this.__program = program;
    this.__bindUniformLocation();

    this.__clientData = new arrayTypeConstructor(this.__size);
    this.__clientData.fill(0.0);

    this.__gpuData = new arrayTypeConstructor(this.__size);
    this.__gpuData.fill(0.0);

    this.__upToDate = true;
}

glUniform.prototype.__shouldUpdate = function()
{
    if(!this.__upToDate && (this.__locationID != null)) 
    {
        let size = this.__clientData.length;
        if(size > this.__ctx.__uniformsUpdateCheckMaxComponents) return true;
        
        for(let i = 0; i != size; ++i) if(this.__clientData[i] != this.__gpuData[i]) return true;
        this.__upToDate = true;
    }

    return false;
}

glUniform.prototype.__setClientData = function(newClientData)
{
    if(newClientData != null) this.__clientData.set(newClientData);

    this.__program.__pendingUpdateUniforms.set(this.__name, this);
    this.__upToDate = false; 
}

glUniform.prototype.__bindUniformLocation = function() {
    if(this.__program.ready()) this.__locationID = this.__program.__getUniformLocation(this.__name);
}

glUniform.prototype.update = function() // NB: assumes glProgram is bound
{
    if(this.__shouldUpdate())
    {
        this.__sendToGPU();

        this.__gpuData.set(this.__clientData);
        this.__upToDate = true;
    }
}

glUniform.prototype.set = null;         // abstract
glUniform.prototype.get = null;         // abstract
glUniform.prototype.__sendToGPU = null; // abstract

// -------------------------------------------------------------------------------------------

let glUniformArray = function(ctx, program, name, arrayTypeConstructor, size, array)
{
    glUniform.call(this, ctx, program, name, arrayTypeConstructor, size);    
    if(array != null) this.set(array);
}

glUniformArray.prototype = Object.create(glUniform.prototype);

glUniformArray.prototype.set = function(array) {
    this.__setClientData(array);
}

glUniformArray.prototype.get = function() {
    return this.__clientData.slice(0);
}

// -------------------------------------------------------------------------------------------

let glUniformBlockIndex = function(ctx, program, name, value)
{
    glUniform.call(this, ctx, program, name, Int32Array, 1);    
    if(value != null) this.set(value);
}

glUniformBlockIndex.prototype = Object.create(glUniform.prototype);

glUniformBlockIndex.prototype.__bindUniformLocation = function() {
    if(this.__program.ready()) this.__locationID = this.__program.__getUniformBlockLocation(this.__name);
}

glUniformBlockIndex.prototype.set = function(value) {
    this.__setClientData([(value + glContext.__reservedUniformBlockUnits)]);
}

glUniformBlockIndex.prototype.get = function() {
    return (this.__clientData[0] - glContext.__reservedUniformBlockUnits);
}

glUniformBlockIndex.prototype.__sendToGPU = function() {
    this.__ctx.uniformBlockBinding(this.__program.getProgramID(), this.__locationID, this.__clientData[0]);
}

// -------------------------------------------------------------------------------------------

let glUniformInt = function(ctx, program, name, value)
{
    glUniform.call(this, ctx, program, name, Int32Array, 1);    
    if(value != null) this.set(value);
}

glUniformInt.prototype = Object.create(glUniform.prototype);

glUniformInt.prototype.set = function(value) {
    this.__setClientData([value]);
}

glUniformInt.prototype.get = function() {
    return this.__clientData[0];
}

glUniformInt.prototype.__sendToGPU = function() {
    this.__ctx.uniform1i(this.__locationID, this.__clientData[0]);
}

// -------------------------------------------------------------------------------------------

let glUniformFloat = function(ctx, program, name, value)
{
    glUniform.call(this, ctx, program, name, Float32Array, 1);
    if(value != null) this.set(value);
}
  
glUniformFloat.prototype = Object.create(glUniform.prototype);

glUniformFloat.prototype.set = function(value) {
    this.__setClientData([value]);
}

glUniformFloat.prototype.get = function() {
    return this.__clientData[0];
}

glUniformFloat.prototype.__sendToGPU = function() {
    this.__ctx.uniform1f(this.__locationID, this.__clientData[0]);
}

// -------------------------------------------------------------------------------------------

let glUniformVec2 = function(ctx, program, name, x, y)
{
    glUniform.call(this, ctx, program, name, Float32Array, 2);
    if(x != null) this.set(x, y);
}

glUniformVec2.prototype = Object.create(glUniform.prototype);

glUniformVec2.prototype.set = function(x, y)
{
    let v = x;
    if(!v.__is_glVector2f) v = new glVector2f(x, y);
    
    this.__setClientData([v.x, v.y]);
}

glUniformVec2.prototype.get = function() {
    return new glVector2f(this.__clientData[0], this.__clientData[1]);
}

glUniformVec2.prototype.__sendToGPU = function() {
    this.__ctx.uniform2f(this.__locationID, this.__clientData[0], this.__clientData[1]);
}

// -------------------------------------------------------------------------------------------

let glUniformVec3 = function(ctx, program, name, x, y, z)
{
    glUniform.call(this, ctx, program, name, Float32Array, 3);
    if(x != null) this.set(x, y, z);
}

glUniformVec3.prototype = Object.create(glUniform.prototype);

glUniformVec3.prototype.set = function(x, y, z)
{
    let v = x;
    if(!v.__is_glVector3f) v = new glVector3f(x, y, z);
    
    this.__setClientData([v.x, v.y, v.z]);
}

glUniformVec3.prototype.get = function() {
    return new glVector3f(this.__clientData[0], this.__clientData[1], this.__clientData[2]);
}

glUniformVec3.prototype.__sendToGPU = function() {
    this.__ctx.uniform3f(this.__locationID, this.__clientData[0], this.__clientData[1], this.__clientData[2]);
}

// -------------------------------------------------------------------------------------------

let glUniformVec4 = function(ctx, program, name, x, y, z, w)
{
    glUniform.call(this, ctx, program, name, Float32Array, 4);
    if(x != null) this.set(x, y, z, w);
}

glUniformVec4.prototype = Object.create(glUniform.prototype);

glUniformVec4.prototype.set = function(x, y, z, w)
{
    let v = x;
    if(!v.__is_glVector4f) v = new glVector4f(x, y, z, w);
    
    this.__setClientData([v.x, v.y, v.z, v.w]);
}

glUniformVec4.prototype.get = function() {
    return new glVector4f(this.__clientData[0], this.__clientData[1], this.__clientData[2], this.__clientData[3]);
}

glUniformVec4.prototype.__sendToGPU = function() {
    this.__ctx.uniform4f(this.__locationID, this.__clientData[0], this.__clientData[1], this.__clientData[2], this.__clientData[3]);
}

// -------------------------------------------------------------------------------------------

let glUniformMat2 = function(ctx, program, name, matrix)
{
    glUniform.call(this, ctx, program, name, Float32Array, 4);
    this.set(((matrix != null) ? matrix : glMatrix4x4f.identityMatrix()));
}

glUniformMat2.prototype = Object.create(glUniform.prototype);

glUniformMat2.prototype.set = function(matrix)
{
    if(matrix.__is_glMatrix4x4f)
    {
        let m = matrix.__m;
        matrix = [ m[0], m[1],
                   m[4], m[5] ];  
    }
    
    this.__setClientData(matrix);
}

glUniformMat2.prototype.get = function()
{
    let m = this.__clientData;
    return new glMatrix4x4f([ m[0], m[1], 0.0, 0.0, 
                              m[2], m[3], 0.0, 0.0,
                              0.0,  0.0,  1.0, 0.0,
                              0.0,  0.0,  0.0, 1.0 ]);
}

glUniformMat2.prototype.__sendToGPU = function() {
    this.__ctx.uniformMatrix2fv(this.__locationID, false, this.__clientData);
}

// -------------------------------------------------------------------------------------------

let glUniformMat3 = function(ctx, program, name, matrix)
{
    glUniform.call(this, ctx, program, name, Float32Array, 9);
    this.set(((matrix != null) ? matrix : glMatrix4x4f.identityMatrix()));
}

glUniformMat3.prototype = Object.create(glUniform.prototype);

glUniformMat3.prototype.set = function(matrix)
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

glUniformMat3.prototype.get = function()
{
    let m = this.__clientData;
    return new glMatrix4x4f([ m[0], m[1], m[2], 0.0, 
                              m[3], m[4], m[5], 0.0,
                              m[6], m[7], m[8], 0.0,
                              0.0,  0.0,  0.0,  1.0 ]);
}

glUniformMat3.prototype.__sendToGPU = function() {
    this.__ctx.uniformMatrix3fv(this.__locationID, false, this.__clientData);
}

// -------------------------------------------------------------------------------------------

let glUniformMat4 = function(ctx, program, name, matrix)
{
    glUniform.call(this, ctx, program, name, Float32Array, 16);
    this.set(((matrix != null) ? matrix : glMatrix4x4f.identityMatrix()));
}

glUniformMat4.prototype = Object.create(glUniform.prototype);

glUniformMat4.prototype.set = function(matrix) {
    this.__setClientData((matrix.__is_glMatrix4x4f ? matrix.__m : matrix));
}

glUniformMat4.prototype.get = function() {
    return new glMatrix4x4f(this.__clientData);
}

glUniformMat4.prototype.__sendToGPU = function() {
    this.__ctx.uniformMatrix4fv(this.__locationID, false, this.__clientData);
}

// -------------------------------------------------------------------------------------------

let glUniformArrayInt = function(ctx, program, name, size, array) {
    glUniformArray.call(this, ctx, program, name, Int32Array, size, array);    
}

glUniformArrayInt.prototype = Object.create(glUniformArray.prototype);

glUniformArrayInt.prototype.__sendToGPU = function() {
    this.__ctx.uniform1iv(this.__locationID, this.__clientData);
}

// -------------------------------------------------------------------------------------------

let glUniformArrayFloat = function(ctx, program, name, size, array) {
    glUniformArray.call(this, ctx, program, name, Float32Array, size, array);    
}

glUniformArrayFloat.prototype = Object.create(glUniformArray.prototype);

glUniformArrayFloat.prototype.__sendToGPU = function() {
    this.__ctx.uniform1fv(this.__locationID, this.__clientData);
}

// -------------------------------------------------------------------------------------------

let glUniformArrayVec2 = function(ctx, program, name, size, array) {
    glUniformArray.call(this, ctx, program, name, Float32Array, size * 2, array);    
}

glUniformArrayVec2.prototype = Object.create(glUniformArray.prototype);

glUniformArrayVec2.prototype.__sendToGPU = function() {
    this.__ctx.uniform2fv(this.__locationID, this.__clientData);
}

glUniformArrayVec2.prototype.set = function(array)
{
    for(let i = 0, e = array.length; i != e; ++i)
    {
        let v = array[i];

        this.__clientData[i * 2 + 0] = v.x;
        this.__clientData[i * 2 + 1] = v.y;
    }
    
    this.__setClientData(null);
}

glUniformArrayVec2.prototype.get = function()
{
    let nElements = this.__clientData.length / 2;
    let array = new Array(nElements);

    for(let i = 0; i != nElements; ++i) array[i] = new glVector2f(this.__clientData[i * 2 + 0], this.__clientData[i * 2 + 1]);
    
    return array;
}

// -------------------------------------------------------------------------------------------

let glUniformArrayVec3 = function(ctx, program, name, size, array) {
    glUniformArray.call(this, ctx, program, name, Float32Array, size * 3, array);    
}

glUniformArrayVec3.prototype = Object.create(glUniformArray.prototype);

glUniformArrayVec3.prototype.__sendToGPU = function() {
    this.__ctx.uniform3fv(this.__locationID, this.__clientData);
}

glUniformArrayVec3.prototype.set = function(array)
{
    for(let i = 0, e = array.length; i != e; ++i)
    {
        let v = array[i];

        this.__clientData[i * 3 + 0] = v.x;
        this.__clientData[i * 3 + 1] = v.y;
        this.__clientData[i * 3 + 2] = v.z;
    }
    
    this.__setClientData(null);
}

glUniformArrayVec3.prototype.get = function()
{
    let nElements = this.__clientData.length / 3;
    let array = new Array(nElements);

    for(let i = 0; i != nElements; ++i) array[i] = new glVector3f(this.__clientData[i * 3 + 0], this.__clientData[i * 3 + 1], this.__clientData[i * 3 + 2]);
    
    return array;
}

// -------------------------------------------------------------------------------------------

let glUniformArrayVec4 = function(ctx, program, name, size, array) {
    glUniformArray.call(this, ctx, program, name, Float32Array, size * 4, array);    
}

glUniformArrayVec4.prototype = Object.create(glUniformArray.prototype);

glUniformArrayVec4.prototype.__sendToGPU = function() {
    this.__ctx.uniform4fv(this.__locationID, this.__clientData);
}

glUniformArrayVec4.prototype.set = function(array)
{
    for(let i = 0, e = array.length; i != e; ++i)
    {
        let v = array[i];

        this.__clientData[i * 4 + 0] = v.x;
        this.__clientData[i * 4 + 1] = v.y;
        this.__clientData[i * 4 + 2] = v.z;
        this.__clientData[i * 4 + 3] = v.w;
    }
    
    this.__setClientData(null);
}

glUniformArrayVec4.prototype.get = function()
{
    let nElements = this.__clientData.length / 4;
    let array = new Array(nElements);

    for(let i = 0; i != nElements; ++i) array[i] = new glVector4f(this.__clientData[i * 4 + 0], this.__clientData[i * 4 + 1], this.__clientData[i * 4 + 2], this.__clientData[i * 4 + 3]);
    
    return array;
}

// -------------------------------------------------------------------------------------------

let glUniformArrayMat2 = function(ctx, program, name, size, array) {
    glUniformArray.call(this, ctx, program, name, Float32Array, size * 4, array);    
}

glUniformArrayMat2.prototype = Object.create(glUniformArray.prototype);

glUniformArrayMat2.prototype.__sendToGPU = function() {
    this.__ctx.uniformMatrix2fv(this.__locationID, false, this.__clientData);
}

glUniformArrayMat2.prototype.set = function(array)
{
    for(let i = 0, e = array.length; i != e; ++i)
    {
        let m = array[i].__m;

        this.__clientData[i * 4 + 0]  = m[0];
        this.__clientData[i * 4 + 1]  = m[1];
        this.__clientData[i * 4 + 2]  = m[4];
        this.__clientData[i * 4 + 3]  = m[5];
    }
    
    this.__setClientData(null);
}

glUniformArrayMat2.prototype.get = function()
{
    let nElements = this.__clientData.length / 4;
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

// -------------------------------------------------------------------------------------------

let glUniformArrayMat3 = function(ctx, program, name, size, array) {
    glUniformArray.call(this, ctx, program, name, Float32Array, size * 9, array);    
}

glUniformArrayMat3.prototype = Object.create(glUniformArray.prototype);

glUniformArrayMat3.prototype.__sendToGPU = function() {
    this.__ctx.uniformMatrix3fv(this.__locationID, false, this.__clientData);
}

glUniformArrayMat3.prototype.set = function(array)
{
    for(let i = 0, e = array.length; i != e; ++i)
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

glUniformArrayMat3.prototype.get = function()
{
    let nElements = this.__clientData.length / 9;
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

// -------------------------------------------------------------------------------------------

let glUniformArrayMat4 = function(ctx, program, name, size, array) {
    glUniformArray.call(this, ctx, program, name, Float32Array, size * 16, array);    
}

glUniformArrayMat4.prototype = Object.create(glUniformArray.prototype);

glUniformArrayMat4.prototype.__sendToGPU = function() {
    this.__ctx.uniformMatrix4fv(this.__locationID, false, this.__clientData);
}

glUniformArrayMat4.prototype.set = function(array)
{
    for(let i = 0, e = array.length; i != e; ++i)
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

glUniformArrayMat4.prototype.get = function()
{
    let nElements = this.__clientData.length / 16;
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

// -------------------------------------------------------------------------------------------
