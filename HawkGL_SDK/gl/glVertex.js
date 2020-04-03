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

let glVertex = function(px, py, pz, tc_u, tc_v, nx, ny, nz)
{
    this.__is_glVertex = true;
    
    this.position  = new glVector3f(px, py, pz);
    this.texCoord  = new glVector2f(tc_u, tc_v);
    this.normal    = new glVector3f(nx, ny, nz);
    
    this.bonesWeights = new glVector4f(0.0);
    this.bonesIndices = [-1, -1, -1, -1];
    this.animationMatrixID = -1;
}

glVertex.nComponents = function() {
    return 17;
}

glVertex.sizeBytes = function() {
    return (41 + 3); // 3 padding bytes (total size must be a multiple of 4)
}

glVertex.clone = function(other)
{
    let vertex = new glVertex();
    
    vertex.position.set(other.position);
    vertex.texCoord.set(other.texCoord);
    vertex.normal.set(other.normal);
    vertex.bonesWeights.set(other.bonesWeights);
    vertex.bonesIndices = other.bonesIndices.slice(0);
    vertex.animationMatrixID = other.animationMatrixID;
    
    return vertex;
}

glVertex.prototype.set = function(px, py, pz, tc_u, tc_v, nx, ny, nz)
{
    let other = px;
    if(!other.__is_glVertex) other = new glVertex(px, py, pz, tc_u, tc_v, nx, ny, nz);

    this.position.set(other.position);
    this.texCoord.set(other.texCoord);
    this.normal.set(other.normal);
    this.bonesWeights.set(other.bonesWeights);
    this.bonesIndices = other.bonesIndices.slice(0);
    this.animationMatrixID = other.animationMatrixID;
}

glVertex.prototype.toFloat32Array = function()
{
    let rawData = new Float32Array(glVertex.nComponents());

    rawData[0] = this.position.x;
    rawData[1] = this.position.y;
    rawData[2] = this.position.z;

    rawData[3] = this.texCoord.x;
    rawData[4] = this.texCoord.y;  

    rawData[5] = this.normal.x;
    rawData[6] = this.normal.y;
    rawData[7] = this.normal.z;

    rawData[8]  = this.bonesWeights.x;
    rawData[9]  = this.bonesWeights.y;
    rawData[10] = this.bonesWeights.z;
    rawData[11] = this.bonesWeights.w;

    rawData[12] = this.bonesIndices[0];
    rawData[13] = this.bonesIndices[1];
    rawData[14] = this.bonesIndices[2];
    rawData[15] = this.bonesIndices[3];

    rawData[16] = this.animationMatrixID;
    
    return rawData;
}

glVertex.fromFloat32Array = function(array, offset)
{
    if(offset == null) offset = 0;
    
    let vertex = new glVertex();

    vertex.position.x = array[offset + 0]; 
    vertex.position.y = array[offset + 1]; 
    vertex.position.z = array[offset + 2]; 

    vertex.texCoord.x = array[offset + 3];         
    vertex.texCoord.y = array[offset + 4];             
    
    vertex.normal.x = array[offset + 5];     
    vertex.normal.y = array[offset + 6];     
    vertex.normal.z = array[offset + 7];         
    
    vertex.bonesWeights.x = array[offset + 8];     
    vertex.bonesWeights.y = array[offset + 9]; 
    vertex.bonesWeights.z = array[offset + 10]; 
    vertex.bonesWeights.w = array[offset + 11];     
    
    vertex.bonesIndices[0] = array[offset + 12];     
    vertex.bonesIndices[1] = array[offset + 13];     
    vertex.bonesIndices[2] = array[offset + 14];     
    vertex.bonesIndices[3] = array[offset + 15];     
    
    vertex.animationMatrixID = array[offset + 16]; 
    
    return vertex;
}

glVertex.prototype.toArrayBuffer = function(buffer, byteOffset)
{
    if(buffer == null) buffer = new ArrayBuffer(glVertex.sizeBytes());
    let view = new DataView(buffer, ((byteOffset != null) ? byteOffset : 0), glVertex.sizeBytes());

    let offset = 0;

    view.setFloat32(offset, this.position.x, true); offset += 4;
    view.setFloat32(offset, this.position.y, true); offset += 4;
    view.setFloat32(offset, this.position.z, true); offset += 4;

    view.setFloat32(offset, this.texCoord.x, true); offset += 4;
    view.setFloat32(offset, this.texCoord.y, true); offset += 4;

    view.setFloat32(offset, this.normal.x, true); offset += 4;
    view.setFloat32(offset, this.normal.y, true); offset += 4;
    view.setFloat32(offset, this.normal.z, true); offset += 4;

    let weightSum = (this.bonesWeights.x + this.bonesWeights.y + this.bonesWeights.z + this.bonesWeights.w);
    
    view.setUint8(offset, Math.round((this.bonesWeights.x / weightSum) * 255)); offset += 1;
    view.setUint8(offset, Math.round((this.bonesWeights.y / weightSum) * 255)); offset += 1;
    view.setUint8(offset, Math.round((this.bonesWeights.z / weightSum) * 255)); offset += 1;
    view.setUint8(offset, Math.round((this.bonesWeights.w / weightSum) * 255)); offset += 1;
    
    view.setUint8(offset, this.bonesIndices[0]); offset += 1;
    view.setUint8(offset, this.bonesIndices[1]); offset += 1;
    view.setUint8(offset, this.bonesIndices[2]); offset += 1;
    view.setUint8(offset, this.bonesIndices[3]); offset += 1;

    view.setUint8(offset, this.animationMatrixID); offset += 1;

    return buffer;
}

glVertex.fromArrayBuffer = function(buffer, byteOffset)
{
    let vertex = new glVertex();
    let view = new DataView(buffer, ((byteOffset != null) ? byteOffset : 0), glVertex.sizeBytes());    

    let offset = 0;

    vertex.position.x = view.getFloat32(offset, true); offset += 4;
    vertex.position.y = view.getFloat32(offset, true); offset += 4;
    vertex.position.z = view.getFloat32(offset, true); offset += 4;

    vertex.texCoord.x = view.getFloat32(offset, true); offset += 4;
    vertex.texCoord.y = view.getFloat32(offset, true); offset += 4;

    vertex.normal.x = view.getFloat32(offset, true); offset += 4;
    vertex.normal.y = view.getFloat32(offset, true); offset += 4;
    vertex.normal.z = view.getFloat32(offset, true); offset += 4;

    vertex.bonesWeights.y = view.getUint8(offset); offset += 1;
    vertex.bonesWeights.z = view.getUint8(offset); offset += 1;
    vertex.bonesWeights.x = view.getUint8(offset); offset += 1;
    vertex.bonesWeights.w = view.getUint8(offset); offset += 1;
    
    vertex.bonesIndices[0] = view.getUint8(offset); offset += 1;
    vertex.bonesIndices[1] = view.getUint8(offset); offset += 1;
    vertex.bonesIndices[2] = view.getUint8(offset); offset += 1;
    vertex.bonesIndices[3] = view.getUint8(offset); offset += 1;

    vertex.animationMatrixID = view.getUint8(offset); offset += 1;

    return vertex;
}

glVertex.prototype.toHash = function()
{
    let rawData = this.toFloat32Array();
    for(let i = 0, e = rawData.length; i != e; ++i) rawData[i] = rawData[i].toPrecision(4);

    return rawData.toString();
}
