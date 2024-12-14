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

var glBVH = function(ctx)
{
    this.__ctx = ctx;
    
    this.clear();
}

glBVH.prototype.release = function() 
{
    this.__nodes = [];
    this.__groups = [];
    this.__mesh = new glMesh(ctx);
}

glBVH.prototype.clear = function()
{
    this.release();

    this.__depth = 0;
   
    if(this.__nodesDataTexture != null) this.__nodesDataTexture.free(), this.__nodesDataTexture = null;
    if(this.__attribDataTexture != null) this.__attribDataTexture.free(), this.__attribDataTexture = null;
    if(this.__verticesDataTexture != null) this.__verticesDataTexture.free(), this.__verticesDataTexture = null;
    if(this.__trianglesDataTexture != null) this.__trianglesDataTexture.free(), this.__trianglesDataTexture = null;
}

glBVH.prototype.add = function(mesh, transform)
{
    if(transform != null)
    {
        mesh = new glMesh(this.__ctx, mesh);
        mesh.transform(transform);
    }

    this.__mesh.add(mesh);

    let nTriangles = this.__mesh.size() / 3;
    this.__groups.push(nTriangles - 1);
}

glBVH.prototype.build = function()
{
    let buffers = this.__mesh.__buildVertexBuffers();
    this.__mesh = new glMesh(ctx);
    
    this.__vertices = buffers.vbo;
    this.__indices = buffers.ibo;

    let nTriangles = this.__indices.length / 3;
    let centroids = new Array(nTriangles);
    let triangles = new Array(nTriangles);
    let trisAABBs = new Array(nTriangles);

    for(let i = 0; i < nTriangles; ++i)
    {
        let v0 = this.__vertices[this.__indices[i * 3 + 0]].position;
        let v1 = this.__vertices[this.__indices[i * 3 + 1]].position;
        let v2 = this.__vertices[this.__indices[i * 3 + 2]].position;

        let min = glVector3f.min(glVector3f.min(v0, v1), v2);
        let max = glVector3f.max(glVector3f.max(v0, v1), v2);

        centroids[i] = glVector3f.add(v0, v1).add(v2).div(3.0);
        trisAABBs[i] = { min, max };
        triangles[i] = i;
    }

    let bvh = this;
    let Node = function(triangles, depth, texCoords)
    {
        this.id = bvh.__nodes.length;

        bvh.__depth = Math.max(bvh.__depth, 1 + depth);
        bvh.__nodes.push(this);

        this.triangles = triangles;
        this.boundingBox = this.computeBoundingBox();
        this.texCoords = texCoords;

        this.left  = null;
        this.right = null;

        if(triangles.length > 1) this.split(depth);
    }

    Node.prototype.split = function(depth)
    {
        let medianIndex;

        if(true)
        {
            this.triangles.sort((a, b) =>
            {
                return (centroids[a][this.boundingBox.longestAxis] -
                        centroids[b][this.boundingBox.longestAxis]);
            });

            medianIndex = Math.floor(this.triangles.length / 2);
        }
        else
        {
            // Sort triangles based purely on their areas
            this.triangles.sort((a, b) => { return (this.__computeTriangleArea(b) - this.__computeTriangleArea(a)); }); // Sort in descending order

            // Find the split index based on area
            let totalArea = this.triangles.reduce((sum, triID) => sum + this.__computeTriangleArea(triID), 0);
            let accumulatedArea = 0;
            for (medianIndex = 0; medianIndex < this.triangles.length; medianIndex++) {
                accumulatedArea += this.__computeTriangleArea(this.triangles[medianIndex]);
                if (accumulatedArea >= totalArea / 2) {
                    break;
                }
            }
        }

        let leftTexCoords, rightTexCoords;
        if(this.texCoords != null)
        {
            let childrenTexCoords = glBVH.__splitTriangle(this.texCoords);
            leftTexCoords  = childrenTexCoords[0];
            rightTexCoords = childrenTexCoords[1];
        }
        else
        {
            leftTexCoords  = [new glVector3f(0, 1, 0), new glVector3f(1, 1, 0), new glVector3f(1, 0, 0)];
            rightTexCoords = [new glVector3f(0, 0, 0), new glVector3f(0, 1, 0), new glVector3f(1, 0, 0)];
        }

        this.left  = new Node(this.triangles.slice(0, medianIndex), depth + 1, leftTexCoords);
        this.right = new Node(this.triangles.slice(medianIndex),    depth + 1, rightTexCoords);

        this.triangles = null;  // We no longer need the triangles in this node
    }

    Node.prototype.computeBoundingBox = function()
    {
        let min = new glVector3f(+Infinity);
        let max = new glVector3f(-Infinity);

        this.triangles.forEach(triangleID =>
        {
            min = glVector3f.min(trisAABBs[triangleID].min, min);
            max = glVector3f.max(trisAABBs[triangleID].max, max);
        });

        if(this.triangles.length < 1)
        {
            min.set(0);
            max.set(0);
        }

        let size = glVector3f.sub(max, min);
        let position = glVector3f.add(max, min).mul(0.5);
        let longestAxis = ((size.x > size.y) ? (size.x > size.z ? 'x' : 'z') : (size.y > size.z ? 'y' : 'z'));

        let radius = glVector3f.distance(max, position);
        let radiusSquared = radius * radius;

        return { min, max, position, size, radiusSquared, longestAxis };
    }

    bvh.__depth = 0;

    let rootNode = new Node(triangles, 0);

    this.__aabb = rootNode.boundingBox;

    for(let i = 0, e = this.__nodes.length; i != e; ++i)
    {
        let node = this.__nodes[i];

        if(node.left !== null)
        {
            node.left  = node.left.id;
            node.right = node.right.id;
        }
    }

    delete rootNode;
}

glBVH.prototype.buildDataTextures = function()
{
    this.__genVertsPositionsDataTexture();
    this.__genVertsAttribsDataTexture();
    this.__genTrianglesDataTexture();
    this.__genNodesDataTexture();
}

glBVH.prototype.bindVertsPositionsDataTexture = function(unitID)
{
    if(this.__verticesDataTexture == null) this.__genVertsPositionsDataTexture();
    this.__verticesDataTexture.bind(unitID);
}

glBVH.prototype.bindVertsAttribsDataTexture = function(unitID)
{
    if(this.__attribDataTexture == null) this.__genVertsAttribsDataTexture();
    this.__attribDataTexture.bind(unitID);
}

glBVH.prototype.bindTrianglesDataTexture = function(unitID)
{
    if(this.__trianglesDataTexture == null) this.__genTrianglesDataTexture();
    this.__trianglesDataTexture.bind(unitID);
}

glBVH.prototype.bindNodesDataTexture = function(unitID)
{
    if(this.__nodesDataTexture == null) this.__genNodesDataTexture();
    this.__nodesDataTexture.bind(unitID);
}

glBVH.__splitTriangle = function(inputTriangle)
{
    let tessellatedTriangles = new Array(2);

    // Calculate the lengths of the three sides
    let l1 = glVector3f.distance(inputTriangle[1], inputTriangle[2]);
    let l2 = glVector3f.distance(inputTriangle[0], inputTriangle[2]);
    let l3 = glVector3f.distance(inputTriangle[0], inputTriangle[1]);

    // Identify the hypotenuse by finding the edge opposite to the longest side
    if (l1 > l2 && l1 > l3)
    {  // base as the hypotenuse
        let midpoint = glVector3f.add(inputTriangle[1], inputTriangle[2]).mul(0.5);
        tessellatedTriangles[0] = [inputTriangle[0], midpoint, inputTriangle[2]];
        tessellatedTriangles[1] = [midpoint, inputTriangle[0], inputTriangle[1]];
    } else if (l2 > l1 && l2 > l3)  {  // right side as the hypotenuse
        let midpoint = glVector3f.add(inputTriangle[0], inputTriangle[2]).mul(0.5);
        tessellatedTriangles[0] = [inputTriangle[0], inputTriangle[1], midpoint];
        tessellatedTriangles[1] = [midpoint, inputTriangle[1], inputTriangle[2]];
    } else {  // left side as the hypotenuse
        let midpoint = glVector3f.add(inputTriangle[0], inputTriangle[1]).mul(0.5);
        tessellatedTriangles[0] = [midpoint, inputTriangle[1], inputTriangle[2]];
        tessellatedTriangles[1] = [inputTriangle[0], midpoint, inputTriangle[2]];
    }

    return tessellatedTriangles;
}

glBVH.__scaleTriangle = function(inputTriangle, s)
{
    let triangle = [new glVector3f(inputTriangle[0]), new glVector3f(inputTriangle[1]), new glVector3f(inputTriangle[2])];

    let g = glVector3f.add(glVector3f.add(triangle[0], triangle[1]), triangle[2]).div(3.0);

    let t0 = glVector3f.sub(g, triangle[0]);
    let t1 = glVector3f.sub(g, triangle[1]);
    let t2 = glVector3f.sub(g, triangle[2]);

    let tMin = Math.min(Math.min(t0.length(), t1.length()), t2.length());

    t0.div(tMin);
    t1.div(tMin);
    t2.div(tMin);

    triangle[0].add(glVector3f.mul(t0, s));
    triangle[1].add(glVector3f.mul(t1, s));
    triangle[2].add(glVector3f.mul(t2, s));

    return triangle;
}

glBVH.__rayIntersectsSphere = function(ro, rd, sphereCenter, sphereRadiusSq)
{
    let v = glVector3f.sub(ro, sphereCenter);

    let d2 = glVector3f.dot(v, v);
    if(d2 <= sphereRadiusSq) return true; // ray inside sphere

    let t = glVector3f.dot(v, rd);
    if(t > 0.0) return false; // sphere behind ray

    return ((d2 - t * t) <= sphereRadiusSq); // ray hits sphere
}

glBVH.__rayIntersectsAABB = function(ro, rd, rd_inv, aabb)
{
    let t1 = glVector3f.sub(aabb.min, ro).mul(rd_inv);
    let t2 = glVector3f.sub(aabb.max, ro).mul(rd_inv);

    let tn = glVector3f.min(t1, t2);
    let tf = glVector3f.max(t1, t2);

    let tmin = Math.max(Math.max(tn.x, tn.y), tn.z);
    let tmax = Math.min(Math.min(tf.x, tf.y), tf.z);

    return (tmax >= 0.0 && tmax >= tmin);
}

glBVH.prototype.__computeTriangleArea = function(triangleID)
{
    let v0 = this.__vertices[this.__indices[triangleID * 3 + 0]].position;
    let v1 = this.__vertices[this.__indices[triangleID * 3 + 1]].position;
    let v2 = this.__vertices[this.__indices[triangleID * 3 + 2]].position;

    let edge1 = glVector3f.sub(v1, v0);
    let edge2 = glVector3f.sub(v2, v0);

    let crossProduct = glVector3f.cross(edge1, edge2);

    return 0.5 * crossProduct.length();
}

glBVH.prototype.__rayIntersectTriangle = function(ro, rd, triangleID)
{
    let v0 = this.__vertices[this.__indices[triangleID * 3 + 0]].position;
    let v1 = this.__vertices[this.__indices[triangleID * 3 + 1]].position;
    let v2 = this.__vertices[this.__indices[triangleID * 3 + 2]].position;

    let v1v0 = glVector3f.sub(v1, v0);
    let v2v0 = glVector3f.sub(v2, v0);
    let rov0 = glVector3f.sub(ro, v0);

    let n = glVector3f.cross(v1v0, v2v0);
    let q = glVector3f.cross(rov0, rd);

    let d = glVector3f.dot(rd, n);
    // if(d <= 0.0) return null; // back-face culling
    d = 1.0 / d;

    let u = -d * glVector3f.dot(q, v2v0);
    let v =  d * glVector3f.dot(q, v1v0);
    let t = -d * glVector3f.dot(n, rov0);

    if(t < 0.0 || u < 0.0 || v < 0.0 || (u + v) > 1.0) return null;

    return t;
}

// packs 2 half floats into a 32 bit float
function packHalf2x16(array32f, index, a16F, b16F)
{
    let pair32F = new Float32Array([a16F, b16F, 0, 0]);
    let pair32U = new Uint32Array(pair32F.buffer);

    // to half floats
    for(let i = 0; i < 2; ++i)
    {
        pair32U[2] = ((pair32U[i] >> 16) & 0x8000); // sign
        pair32U[3] = ((pair32U[i] >> 23) & 0xFF);   // exp

        if(pair32U[3] == 0 || pair32U[3] < 113) pair32U[i] = pair32U[2];
        else pair32U[i] = pair32U[2] | ((((pair32U[i] & 0x7f800000) - 0x38000000) >> 13) & 0x7c00) | ((pair32U[i] >> 13) & 0x03ff);
    }

    let bufferView32U = new Uint32Array(array32f.buffer);
    bufferView32U[index] = pair32U[0] | pair32U[1] << 16;
}

// un-packs 2 half floats from a 32 bit float
function unpackHalf2x16(array32f, index)
{
    let bufferView32U = new Uint32Array(array32f.buffer);

    let pair32U = new Uint32Array(2);
    let pair32F = new Float32Array(pair32U.buffer);

    pair32U[0] = bufferView32U[index] & 0xffff;
    pair32U[1] = bufferView32U[index] >> 16;

    pair32U[0] = ((pair32U[0] & 0x8000) << 16) | (((pair32U[0] & 0x7c00) + 0x1c000) << 13) | ((pair32U[0] & 0x03ff) << 13);
    pair32U[1] = ((pair32U[1] & 0x8000) << 16) | (((pair32U[1] & 0x7c00) + 0x1c000) << 13) | ((pair32U[1] & 0x03ff) << 13);

    return [pair32F[0], pair32F[1]];
}

// packs a normal into a 32bit float
function packNormal32F(array32f, index, n)
{
    n = glVector3f.normalize(n);

    let d = glVector3f.dot(glVector3f.abs(n), new glVector3f(1));
    n.x /= d; n.y /= d;

    let x16F = 0.5 + 0.5 * ((n.z > 0.0) ? n.x : (1.0 - Math.abs(n.y)) * (((n.x >= 0.0) ? 1.0 : -1.0)));
    let y16F = 0.5 + 0.5 * ((n.z > 0.0) ? n.y : (1.0 - Math.abs(n.x)) * (((n.y >= 0.0) ? 1.0 : -1.0)));

    packHalf2x16(array32f, index, x16F, y16F);
}

// un-packs a normal from a 32bit float
function unpackNormal32F(array32f, index)
{
    let xy = unpackHalf2x16(array32f, index);

    let x = -1.0 + 2.0 * xy[0];
    let y = -1.0 + 2.0 * xy[1];

    let n = new glVector3f(x, y, 1.0 - Math.abs(x) - Math.abs(y));
    if(n.z < 0.0)
    {
        n.x = (1.0 - Math.abs(y)) * ((x >= 0.0) ? 1.0 : -1.0);
        n.y = (1.0 - Math.abs(x)) * ((y >= 0.0) ? 1.0 : -1.0);
    }

    return glVector3f.normalize(n);
}

glBVH.prototype.__genVertsPositionsDataTexture = function()
{
    let forceTexturesPOT = true;

    let nVertices = this.__vertices.length;
    let nElements = nVertices;

    let texelsPerElement = 1.0;
    let totalTexels = Math.ceil(nElements * texelsPerElement);
    let evaluateTextureSize = (forceTexturesPOT ? nextPot : function(x) { return x; });
    let textureWidth = Math.max(evaluateTextureSize(Math.ceil(Math.sqrt(totalTexels))), 1);
    let textureHeight = Math.max(evaluateTextureSize(Math.ceil(totalTexels / textureWidth)), 1);
    let textureDataRaw = new Float32Array(textureWidth * textureHeight * 4).fill(0);

    for(let i = 0; i < nVertices; ++i)
    {
        textureDataRaw[i * 4 + 0] = this.__vertices[i].position.x; // r
        textureDataRaw[i * 4 + 1] = this.__vertices[i].position.y; // g
        textureDataRaw[i * 4 + 2] = this.__vertices[i].position.z; // b

        packNormal32F(textureDataRaw, i * 4 + 3, this.__vertices[i].normal); // pack normal in alpha channel
    }

    if(this.__verticesDataTexture != null) this.__verticesDataTexture.free();

    this.__verticesDataTexture = new glTextureRGBA32F(ctx, textureWidth, textureHeight, textureDataRaw);
    this.__verticesDataTexture.setFilterMode(this.__ctx.getGL().NEAREST, this.__ctx.getGL().NEAREST);
}

glBVH.prototype.__genVertsAttribsDataTexture = function()
{
    let forceTexturesPOT = true;

    let nVertices = this.__vertices.length;
    let nElements = nVertices;

    let texelsPerElement = 1.0;
    let totalTexels = Math.ceil(nElements * texelsPerElement);
    let evaluateTextureSize = (forceTexturesPOT ? nextPot : function(x) { return x; });
    let textureWidth = Math.max(evaluateTextureSize(Math.ceil(Math.sqrt(totalTexels))), 1);
    let textureHeight = Math.max(evaluateTextureSize(Math.ceil(totalTexels / textureWidth)), 1);
    let textureDataRaw = new Float32Array(textureWidth * textureHeight * 4).fill(0);

    for(let i = 0; i < nVertices; ++i)
    {
        textureDataRaw[i * 4 + 0] = this.__vertices[i].texCoord.x;
        textureDataRaw[i * 4 + 1] = this.__vertices[i].texCoord.y;

        let tangent = new glVector3f(this.__vertices[i].tangent.x, this.__vertices[i].tangent.y, this.__vertices[i].tangent.z);
        let bitangent = glVector3f.cross(this.__vertices[i].normal, tangent).mul(Math.sign(this.__vertices[i].tangent.w));

        packNormal32F(textureDataRaw, i * 4 + 2, tangent);   // pack tangent   in blue  channel
        packNormal32F(textureDataRaw, i * 4 + 3, bitangent); // pack bitangent in alpha channel
    }

    if(this.__attribDataTexture != null) this.__attribDataTexture.free();

    this.__attribDataTexture = new glTextureRGBA32F(ctx, textureWidth, textureHeight, textureDataRaw);
    this.__attribDataTexture.setFilterMode(this.__ctx.getGL().NEAREST, this.__ctx.getGL().NEAREST);
}

glBVH.prototype.__genTrianglesDataTexture = function()
{
    let forceTexturesPOT = true;

    let nIndices = this.__indices.length;
    let nElements = nIndices / 3;

    let texelsPerElement = 1;
    let totalTexels = Math.ceil(nElements * texelsPerElement);
    let evaluateTextureSize = (forceTexturesPOT ? nextPot : function(x) { return x; });
    let textureWidth = Math.max(evaluateTextureSize(Math.ceil(Math.sqrt(totalTexels))), 1);
    let textureHeight = Math.max(evaluateTextureSize(Math.ceil(totalTexels / textureWidth)), 1);
    let textureDataRaw = new Float32Array(textureWidth * textureHeight * 4).fill(0);
    let uintBufferView = new Uint32Array(textureDataRaw.buffer);

    let groupID = 0;
    for(let i = 0; i < nElements; ++i)
    {
        if(i > this.__groups[groupID]) ++groupID;

        uintBufferView[i * 4 + 0] = this.__indices[i * 3 + 0];
        uintBufferView[i * 4 + 1] = this.__indices[i * 3 + 1];
        uintBufferView[i * 4 + 2] = this.__indices[i * 3 + 2];
        uintBufferView[i * 4 + 3] = groupID;
    }

    if(this.__trianglesDataTexture != null) this.__trianglesDataTexture.free();

    this.__trianglesDataTexture = new glTextureRGBA32F(ctx, textureWidth, textureHeight, textureDataRaw);
    this.__trianglesDataTexture.setFilterMode(this.__ctx.getGL().NEAREST, this.__ctx.getGL().NEAREST);
}

glBVH.prototype.__genNodesDataTexture = function()
{
    let forceTexturesPOT = true;

    let nNodes = this.__nodes.length;
    let nElements = nNodes;

    let texelsPerElement = 2;
    let totalTexels = Math.ceil(nElements * texelsPerElement);
    let evaluateTextureSize = (forceTexturesPOT ? nextPot : function(x) { return x; });
    let textureWidth = Math.max(evaluateTextureSize(Math.ceil(Math.sqrt(totalTexels))), 1);
    let textureHeight = Math.max(evaluateTextureSize(Math.ceil(totalTexels / textureWidth)), 1);
    let textureDataRaw = new Float32Array(textureWidth * textureHeight * 4).fill(0);
    let uintBufferView = new Uint32Array(textureDataRaw.buffer);

    for(let i = 0; i < nElements; ++i)
    {
        let node = this.__nodes[i];

        let isLeaf = node.left === null;
        let indexL = (!isLeaf ? (node.left + 1) : 0);
        let indexR = (!isLeaf ? node.right : node.triangles[0]);

        textureDataRaw[i * 8 + 0] = node.boundingBox.min.x;
        textureDataRaw[i * 8 + 1] = node.boundingBox.min.y;
        textureDataRaw[i * 8 + 2] = node.boundingBox.min.z;
        uintBufferView[i * 8 + 3] = indexL;

        textureDataRaw[i * 8 + 4] = node.boundingBox.max.x;
        textureDataRaw[i * 8 + 5] = node.boundingBox.max.y;
        textureDataRaw[i * 8 + 6] = node.boundingBox.max.z;
        uintBufferView[i * 8 + 7] = indexR;
    }

    if(this.__nodesDataTexture != null) this.__nodesDataTexture.free();

    this.__nodesDataTexture = new glTextureRGBA32F(ctx, textureWidth, textureHeight, textureDataRaw);
    this.__nodesDataTexture.setFilterMode(this.__ctx.getGL().NEAREST, this.__ctx.getGL().NEAREST);
}

glBVH.prototype.generateMeshUV = function()
{
    let vertices = new Array(this.__indices.length);

    for(let i = 0, v = 0, e = this.__nodes.length; i != e; ++i)
    {
        let node = this.__nodes[i];
        let isLeaf = node.left === null;

        if(!isLeaf) continue;

        let triangleID = node.triangles[0];
        let vertsUVs = glBVH.__scaleTriangle(node.texCoords, (Math.sqrt(2.0) / 512.0));

        for(let j = 0; j < 3; ++j)
        {
            let vertex = new glVertex(this.__vertices[this.__indices[triangleID * 3 + j]]);

            vertex.texCoord.x = vertsUVs[j].x;
            vertex.texCoord.y = vertsUVs[j].y;

            vertices[v++] = vertex;
        }
    }

    return new glMesh(this.__ctx, vertices);
}

glBVH.prototype.intersect = function(ro, rd)
{
    let rd_inv = new glVector3f(rd);

    rd_inv.x = Math.max(Math.abs(rd_inv.x), 1e-6) * ((rd_inv.x >= 0.0) ? 1.0 : -1.0);
    rd_inv.y = Math.max(Math.abs(rd_inv.y), 1e-6) * ((rd_inv.y >= 0.0) ? 1.0 : -1.0);
    rd_inv.z = Math.max(Math.abs(rd_inv.z), 1e-6) * ((rd_inv.z >= 0.0) ? 1.0 : -1.0);

    rd_inv = glVector3f.div(new glVector3f(1.0), rd_inv);

    let maxStackSize = this.__depth;
    let stack = new Array(maxStackSize);
    stack[0] = 0;

    let stackPointer = 1;
    let closestIntersection = null;

    while(stackPointer > 0)
    {
        let nodeID = stack[--stackPointer];
        let node = this.__nodes[nodeID];

        if(!glBVH.__rayIntersectsAABB(ro, rd, rd_inv, node.boundingBox)) {
            continue;
        }

        if(!node.left) // leaf
        {
            for(let i = 0, e = node.triangles.length; i != e; ++i)
            {
                let triangleID = node.triangles[i];
                let intersection = this.__rayIntersectTriangle(ro, rd, triangleID);

                if(intersection !== null && (closestIntersection === null || intersection < closestIntersection)) {
                    closestIntersection = intersection;
                }
            }
        }
        else // branch
        {
            // add children to the stack
            stack[stackPointer + 0] = node.right;
            stack[stackPointer + 1] = node.left; // nodeID + 1;

            stackPointer += 2;
        }
    }

    return closestIntersection;
}

glBVH.prototype.getBoundingBox = function() {
    return this.__aabb;
}

glBVH.prototype.getDepth = function() {
    return this.__depth;
}

glBVH.prototype.getNodes = function() {
    return this.__nodes;
}

glBVH.prototype.getVertices = function() {
    return this.__vertices;
}

glBVH.prototype.getTriangles = function() {
    return this.__indices;
}
