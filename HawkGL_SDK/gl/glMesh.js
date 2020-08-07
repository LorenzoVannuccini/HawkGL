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

let glMesh = function(ctx, meshData)
{
    glPrimitive.call(this, ctx, meshData);    
    this.__is_glMesh = true;
}

glMesh.prototype = Object.create(glPrimitive.prototype);

glMesh.prototype.add = function(meshData)
{
    if(meshData.__is_glPrimitive) meshData = meshData.__vertices;

    let nVertices = meshData.length;
    if(nVertices > 0 && (nVertices % 3) == 0) glPrimitive.prototype.add.call(this, meshData);    
}

glMesh.prototype.__updateVolume = function()
{
    this.__aabb.clear();
    
    this.__volumeRadius = 0.0;
    this.__volumeCenter.set(0.0);
    
    let nVertices = this.size();
    if(nVertices > 0)
    {
        let areaSum  = 0.0;
        for(let i = 0; i != nVertices; i += 3)
        {
            let face = [this.__vertices[i + 0].position, this.__vertices[i + 1].position, this.__vertices[i + 2].position];

            let area = glVector3f.cross(glVector3f.sub(face[1], face[0]), glVector3f.sub(face[2], face[0])).length() * 0.5;
            let center = glVector3f.div(glVector3f.add(glVector3f.add(face[0], face[1]), face[2]), 3.0);
            
            this.__volumeCenter.add(glVector3f.mul(center, area));
            
            this.__aabb.fit(face[0]);
            this.__aabb.fit(face[1]);
            this.__aabb.fit(face[2]);

            areaSum += area;
        }

        this.__volumeCenter.div(areaSum);

        for(let i = 0; i != nVertices; ++i) this.__volumeRadius = Math.max(this.__volumeRadius, glVector3f.squaredDistance(this.__volumeCenter, this.__vertices[i].position));
        this.__volumeRadius = Math.sqrt(this.__volumeRadius);
    }
    
    this.__shouldUpdateVolume = false;
}

glMesh.prototype.__buildVertexBuffers = function()
{
    let vertexBuffers = glPrimitive.prototype.__buildVertexBuffers.call(this);

    let shouldRecomputeBasis = false;
    for(let i = 0, e = vertexBuffers.vbo.length; (i != e && !shouldRecomputeBasis); ++i)
    {
        let vertex = vertexBuffers.vbo[i];

        if(glVector3f.dot(vertex.normal,  vertex.normal)  <= 0.0) shouldRecomputeBasis = true;
        if(glVector3f.dot(vertex.tangent, vertex.tangent) <= 0.0) shouldRecomputeBasis = true;
    }

    if(shouldRecomputeBasis)
    {
        let sharedNormals  = new Map();
        let sharedTangents = new Map();

        function hashVertexForNormals(v)
        {
            return v.position.x.toPrecision(4) + ":" +
                   v.position.y.toPrecision(4) + ":" +
                   v.position.z.toPrecision(4) + ":" +
            
                   v.normal.x.toPrecision(4) + ":" +
                   v.normal.y.toPrecision(4) + ":" +
                   v.normal.z.toPrecision(4);
        }

        function hashVertexForTangents(v)
        {
            return v.position.x.toPrecision(4) + ":" +
                   v.position.y.toPrecision(4) + ":" +
                   v.position.z.toPrecision(4) + ":" +
            
                   v.normal.x.toPrecision(4) + ":" +
                   v.normal.y.toPrecision(4) + ":" +
                   v.normal.z.toPrecision(4) + ":" +

                   v.texCoord.x.toPrecision(4) + ":" +
                   v.texCoord.y.toPrecision(4);
        }

        function mapSharedNormalTangent(vertex, normal, tangent, weight)
        { 
            let tangentHash = hashVertexForTangents(vertex);
            let normalHash  = hashVertexForNormals(vertex);
            
            let sharedTangent = sharedTangents.get(tangentHash);
            if(sharedTangent == null) sharedTangents.set(tangentHash, (sharedTangent = new glVector4f(0.0)));
            
            let sharedNormal = sharedNormals.get(normalHash);
            if(sharedNormal == null) sharedNormals.set(normalHash, (sharedNormal = new glVector3f(0.0)));

            sharedTangent.add(glVector4f.mul(tangent, weight));
            sharedNormal.add(glVector3f.mul(normal, weight));
        }

        function readSharedNormal(vertex) {
            return glVector3f.normalize(sharedNormals.get(hashVertexForNormals(vertex)));
        }

        function readSharedTangent(vertex)
        {
            let tangentData = sharedTangents.get(hashVertexForTangents(vertex));

            let tangent = glVector3f.normalize(tangentData.x, tangentData.y, tangentData.z);
            let sign = ((tangentData.w < 0.0) ? -1.0 : 1.0);

            return new glVector4f(tangent.x, tangent.y, tangent.z, sign);
        }

        // recompute normals / tangents
        for(let i = 0, e = vertexBuffers.ibo.length; i != e; i += 3)
        {
            let a = vertexBuffers.vbo[vertexBuffers.ibo[i + 0]];
            let b = vertexBuffers.vbo[vertexBuffers.ibo[i + 1]];
            let c = vertexBuffers.vbo[vertexBuffers.ibo[i + 2]];
    
            let edge1 = glVector3f.sub(b.position, a.position);
            let edge2 = glVector3f.sub(c.position, a.position);
            let edge3 = glVector3f.sub(b.position, c.position);
            
            let deltaUV1 = glVector2f.sub(b.texCoord, a.texCoord);
            let deltaUV2 = glVector2f.sub(c.texCoord, a.texCoord);  

            let d = (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y);
            let f = ((d != 0.0) ? (1.0 / d) : 0.0);

            let tangent = new glVector3f((deltaUV2.y * edge1.x - deltaUV1.y * edge2.x) * f,
                                        (deltaUV2.y * edge1.y - deltaUV1.y * edge2.y) * f,
                                        (deltaUV2.y * edge1.z - deltaUV1.y * edge2.z) * f);

            edge1.normalize();
            edge2.normalize();
            edge3.normalize();
            
            let weightA = 1.0 - Math.abs(glVector3f.dot(edge1, edge2));
            let weightB = 1.0 - Math.abs(glVector3f.dot(edge1, edge3));
            let weightC = 1.0 - Math.abs(glVector3f.dot(edge2, edge3));
            
            let surfaceNormal = glVector3f.normalize(glVector3f.cross(edge3, edge2));

            if(glVector3f.dot(tangent, tangent) <= 0.0)
            {
                let bitangent = new glVector3f(1.0, 0.0, 0.0);
                
                if(glVector3f.cross(surfaceNormal, bitangent).squaredLength() < 1e-4)
                {
                    bitangent = new glVector3f(0.0, 1.0, 0.0);
                    
                    if(glVector3f.cross(surfaceNormal, bitangent).squaredLength() < 1e-4) bitangent = new glVector3f(0.0, 0.0, 1.0);
                }
                
                tangent = glVector3f.cross(surfaceNormal, bitangent);
            }
            
            tangent = new glVector4f(tangent.x, tangent.y, tangent.z, ((d < 0.0) ? -1.0 : 1.0));
            
            mapSharedNormalTangent(a, surfaceNormal, tangent, weightA);
            mapSharedNormalTangent(b, surfaceNormal, tangent, weightB);
            mapSharedNormalTangent(c, surfaceNormal, tangent, weightC);
        }

        for(let i = 0, e = vertexBuffers.vbo.length; i != e; ++i)
        {
            let vertex = vertexBuffers.vbo[i];

            let shouldRecomputeNormal  = (glVector3f.dot(vertex.normal,   vertex.normal)  <= 0.0);
            let shouldRecomputeTangent = (glVector3f.dot(vertex.tangent,  vertex.tangent) <= 0.0);
            
            if(shouldRecomputeTangent) vertex.tangent = readSharedTangent(vertex);
            if(shouldRecomputeNormal)  vertex.normal  = readSharedNormal(vertex);
        }
    }

    return vertexBuffers;
}

glMesh.prototype.render = function() {
    glPrimitive.prototype.render.call(this, this.__ctx.getGL().TRIANGLES);    
}

glMesh.createRectangle = function(ctx, w, h)
{
    w *= 0.5;
    h *= 0.5;
    
    return new glMesh(ctx, [new glVertex(-w, +h, 0.0,   0.0, 1.0,   0.0, 0.0, 1.0), new glVertex(-w, -h, 0.0,   0.0, 0.0,   0.0, 0.0, 1.0), new glVertex(+w, -h, 0.0,   1.0, 0.0,   0.0, 0.0, 1.0),
                            new glVertex(+w, -h, 0.0,   1.0, 0.0,   0.0, 0.0, 1.0), new glVertex(+w, +h, 0.0,   1.0, 1.0,   0.0, 0.0, 1.0), new glVertex(-w, +h, 0.0,   0.0, 1.0,   0.0, 0.0, 1.0)]);
}

glMesh.createPlane = function(ctx, w, h) {
    return (glMesh.createRectangle(ctx, w, h).transform(glMatrix4x4f.rotationMatrix(-90.0, 1.0, 0.0, 0.0)));
}

glMesh.createCube = function(ctx, size)
{
    let box = new glMesh(ctx);
    let quad = glMesh.createRectangle(ctx, size, size).transform(glMatrix4x4f.translationMatrix(0.0, 0.0, size * 0.5));

    box.add(quad.transform(glMatrix4x4f.rotationMatrix(90.0,  0.0, 1.0, 0.0)));
    box.add(quad.transform(glMatrix4x4f.rotationMatrix(90.0,  0.0, 1.0, 0.0)));
    box.add(quad.transform(glMatrix4x4f.rotationMatrix(90.0,  0.0, 1.0, 0.0)));
    box.add(quad.transform(glMatrix4x4f.rotationMatrix(90.0,  0.0, 1.0, 0.0)));
    box.add(quad.transform(glMatrix4x4f.rotationMatrix(90.0,  1.0, 0.0, 0.0)));
    box.add(quad.transform(glMatrix4x4f.rotationMatrix(180.0, 1.0, 0.0, 0.0)));

    return box;
}

glMesh.createBox = function(ctx, w, h, d) {
    return (glMesh.createCube(ctx, 1.0).transform(glMatrix4x4f.scaleMatrix(w, h, d)));
}

glMesh.createSphere = function(ctx, radius, nSlices, nStacks)
{
    let sphere = new glMesh(ctx);
    let vertices = new Array(nSlices * nStacks);

    let R = 1.0 / (nSlices - 1);
    let S = 1.0 / (nStacks - 1);

    for(let r = 0; r < nSlices; ++r) for(let s = 0; s < nStacks; ++s)
    {
        let p = glVector3f.normalize(+Math.cos(+Math.PI * 2.0 * s * S) * Math.sin(Math.PI * r * R),
                                     -Math.cos(-Math.PI * 2.0 + Math.PI * r * R),
                                     +Math.sin(+Math.PI * 2.0 * s * S) * Math.sin(Math.PI * r * R));

        vertices[r * nSlices + s] = new glVertex(p.x * radius, p.y * radius, p.z * radius, 1.0 - s * S, r * R, p.x, p.y, p.z);
    }
    
    for(let r = 0; r < nSlices - 1; ++r) for(let s = 0; s < nStacks - 1; ++s)
    {
        let curRow  = r * nStacks;
        let nextRow = (r + 1) * nStacks;

        let i1 = curRow  + s;
        let i2 = nextRow + s;
        let i3 = nextRow + s + 1;

        let i4 = curRow  + s;
        let i5 = nextRow + s + 1;
        let i6 = curRow  + s + 1;

        sphere.add([vertices[i1], vertices[i2], vertices[i3], vertices[i4], vertices[i5], vertices[i6]]);
    }
    
    return sphere;
}
