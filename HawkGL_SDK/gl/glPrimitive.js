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

let glPrimitive = function(ctx, vertexData)
{
    this.__ctx = ctx;
    this.__is_glPrimitive = true;
    
    this.__vertices = [];     
    
    this.__ready = true;
    this.__shouldUpdate = false;
    this.__shouldUpdateVolume = false;
    
    this.__aabb = new glAABB();
    this.__volumeCenter = new glVector3f(0.0);
    this.__volumeRadius = 0.0;    
    
    if(vertexData != null) this.set(vertexData);
}

glPrimitive.prototype.__bindStandardAttributes = function()
{
    let gl = this.__ctx.getGL();

    let offset      = 0;
    let floatBytes  = 4;
    let vertexBytes = glVertex.sizeBytes();

    gl.vertexAttribPointer(glContext.__positionAttribLocation,           3, gl.FLOAT,         false, vertexBytes, offset); offset += 3 * floatBytes;
    gl.vertexAttribPointer(glContext.__texCoordAttribLocation,           2, gl.FLOAT,         false, vertexBytes, offset); offset += 2 * floatBytes;
    gl.vertexAttribPointer(glContext.__normalAttribLocation,             3, gl.FLOAT,         false, vertexBytes, offset); offset += 3 * floatBytes;
    gl.vertexAttribPointer(glContext.__tangentAttribLocation,            4, gl.FLOAT,         false, vertexBytes, offset); offset += 4 * floatBytes;
    gl.vertexAttribPointer(glContext.__bonesWeightsAttribLocation,       4, gl.UNSIGNED_BYTE, true,  vertexBytes, offset); offset += 4;
    gl.vertexAttribIPointer(glContext.__bonesIndicesAttribLocation,      4, gl.UNSIGNED_BYTE,        vertexBytes, offset); offset += 4;
    gl.vertexAttribIPointer(glContext.__animationMatrixIDAttribLocation, 1, gl.UNSIGNED_BYTE,        vertexBytes, offset); offset += 1;

    gl.enableVertexAttribArray(glContext.__positionAttribLocation);
    gl.enableVertexAttribArray(glContext.__texCoordAttribLocation);
    gl.enableVertexAttribArray(glContext.__normalAttribLocation);
    gl.enableVertexAttribArray(glContext.__tangentAttribLocation);
    gl.enableVertexAttribArray(glContext.__bonesIndicesAttribLocation);
    gl.enableVertexAttribArray(glContext.__bonesWeightsAttribLocation);
    gl.enableVertexAttribArray(glContext.__animationMatrixIDAttribLocation);
}

glPrimitive.prototype.__pushToGPU = function()
{
    if(this.__vertexBuffer != null) this.__vertexBuffer.free();
    if(this.__indexBuffer  != null) this.__indexBuffer.free();
    
    let gl = this.__ctx.getGL();

    this.__vertexArray  = gl.createVertexArray();
    this.__ctx.bindVertexArray(this.__vertexArray);

    let vertexData = this.__buildVertexData();

    this.__vertexBuffer = new glVertexBuffer(this.__ctx, vertexData.vbo);
    this.__vertexBuffer.bind();

    this.__indexBuffer = new glIndexBuffer(this.__ctx, vertexData.ibo);
    this.__indexBuffer.bind();

    this.__bindStandardAttributes();
    
    this.__ctx.bindVertexArray(null);
    
    this.__vertexBuffer.unbind(); 
    this.__indexBuffer.unbind();
    
    this.__shouldUpdate = false;
}

glPrimitive.__appendArrayBuffers = function(buffer1, buffer2)
{
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);

    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);

    return tmp.buffer;
};

glPrimitive.prototype.__buildVertexBuffers = function()
{
    let vertexBuffers =
    {
        vbo: [],
        ibo: []
    };
    
    let vertexMap = new Map();
    
    for(let i = 0, e = this.size(); i != e; ++i)
    {
        let vertex = this.__vertices[i];
        let vertexHash = vertex.toHash();

        let vertexIndex = vertexMap.get(vertexHash);
        if(vertexIndex == null)
        {
            vertexBuffers.vbo.push(vertex);
            vertexMap.set(vertexHash, (vertexIndex = vertexMap.size));
        }
        
        vertexBuffers.ibo.push(vertexIndex);
    }

    return vertexBuffers;
}

glPrimitive.prototype.__buildVertexData = function()
{
    let vertexData = this.__buildVertexBuffers();
    
    let vertices  = vertexData.vbo;
    let nVertices = vertices.length;
    
    vertexData.vbo = new ArrayBuffer(nVertices * glVertex.sizeBytes());
    for(let i = 0; i != nVertices; ++i) vertices[i].toArrayBuffer(vertexData.vbo, i * glVertex.sizeBytes());
    
    return vertexData;
}

glPrimitive.prototype.clear = function() {
    return this.__vertices = [];
}

glPrimitive.prototype.size = function() {
    return this.__vertices.length;
}

glPrimitive.prototype.empty = function() {
    return (this.size() == 0);
}

glPrimitive.prototype.ready = function() {
    return this.__ready;
}

glPrimitive.prototype.add = function(vertexData)
{
    if(vertexData.__is_glPrimitive) vertexData = vertexData.__vertices;

    let nVertices = vertexData.length;
    if(nVertices > 0)
    {
        let baseIndex = this.size();
        
        this.__vertices.length += nVertices;
        for(let i = 0; i != nVertices; ++i) this.__vertices[baseIndex + i] = new glVertex(vertexData[i]);
        
        this.__shouldUpdate = this.__shouldUpdateVolume = true;
    }
}

glPrimitive.prototype.set = function(vertexData)
{
    this.clear();
    this.add(vertexData);
}

glPrimitive.prototype.transform = function(matrix)
{ 
    let nVertices = this.size();
    if(nVertices > 0)
    {
        this.__shouldUpdate = this.__shouldUpdateVolume = true;
        let normalMatrix = glMatrix4x4f.normalMatrix(matrix);

        for(let i = 0; i != nVertices; ++i)
        {
            let vertex = this.__vertices[i];

            vertex.position = matrix.mul(vertex.position);

            let hasNormal = (glVector3f.dot(vertex.normal, vertex.normal) > 0.0);
            if(hasNormal) vertex.normal = glVector3f.normalize(normalMatrix.mul(vertex.normal));

            let hasTangent = (glVector3f.dot(vertex.tangent, vertex.tangent) > 0.0);
            if(hasTangent)
            {
                let tangent = glVector3f.normalize(normalMatrix.mul(new glVector3f(vertex.tangent.x, vertex.tangent.y, vertex.tangent.z)));
                vertex.tangent.set(tangent.x, tangent.y, tangent.z, vertex.tangent.w);
            }
        }   
    }

    return this;
}

glPrimitive.prototype.__updateVolume = function()
{
    this.__aabb.clear();
    
    this.__volumeRadius = 0.0;
    this.__volumeCenter.set(0.0);
    
    let nVertices = this.size();
    if(nVertices > 0)
    {
        for(let i = 0; i != nVertices; ++i)
        {
            let p = this.__vertices[i].position;

            this.__volumeCenter.add(p);
            this.__aabb.fit(p);
        }

        this.__volumeCenter.div(nVertices);

        for(let i = 0; i != nVertices; ++i) this.__volumeRadius = Math.max(this.__volumeRadius, glVector3f.squaredDistance(this.__volumeCenter, this.__vertices[i].position));
        this.__volumeRadius = Math.sqrt(this.__volumeRadius);
    }
    
    this.__shouldUpdateVolume = false;
}

glPrimitive.prototype.getBoundingBox = function()
{
    if(this.__shouldUpdateVolume) this.__updateVolume();
    return new glAABB(this.__aabb);   
}

glPrimitive.prototype.getBoundingSphere = function()
{
    if(this.__shouldUpdateVolume) this.__updateVolume();
    
    let boundingVolume =
    {
        radius: this.__volumeRadius,
        position: new glVector3f(this.__volumeCenter)
    };
    
    return boundingVolume;   
}

glPrimitive.prototype.render = function(mode)
{
    let nVertices = this.size();
    if(nVertices > 0 && this.__ctx.updateActiveProgram())
    {                                                     
        if(this.__shouldUpdate) this.__pushToGPU();
        this.__ctx.bindVertexArray(this.__vertexArray);   
  
        this.__ctx.getGL().drawElements(mode, nVertices, this.__indexBuffer.getType(), 0);
    }
}
