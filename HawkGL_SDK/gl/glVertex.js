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

    this.position  = new glVector3f();
    this.texCoord  = new glVector2f();
    this.normal    = new glVector3f();
    this.tangent   = new glVector4f();
    
    this.bonesWeights = new glVector4f(0.0);
    this.bonesIndices = [-1, -1, -1, -1];
    this.animationMatrixID = -1;

    if(px != null) this.set(px, py, pz, tc_u, tc_v, nx, ny, nz);
}

glVertex.nComponents = function() {
    return 21;
}

glVertex.sizeBytes = function() {
    return (57 + 3); // 3 padding bytes (total size must be a multiple of 4)
}

glVertex.prototype.set = function(px, py, pz, tc_u, tc_v, nx, ny, nz)
{
    let tx = 0.0;
    let ty = 0.0;
    let tz = 0.0;
    let tw = 0.0;
    
    let bw_x = 0.0;
    let bw_y = 0.0;
    let bw_z = 0.0;
    let bw_w = 0.0;

    let bi_0 = -1;
    let bi_1 = -1;
    let bi_2 = -1;
    let bi_3 = -1;
    
    let amID = -1;
    
    if(px.__is_glVertex)
    {
        let other = px;

        px = other.position.x;
        py = other.position.y;
        pz = other.position.z;
        
        tc_u = other.texCoord.x;
        tc_v = other.texCoord.y;
        
        nx = other.normal.x;
        ny = other.normal.y;
        nz = other.normal.z;

        tx = other.tangent.x;
        ty = other.tangent.y;
        tz = other.tangent.z;
        tw = other.tangent.w;
        
        bw_x = other.bonesWeights.x;
        bw_y = other.bonesWeights.y;
        bw_z = other.bonesWeights.z;
        bw_w = other.bonesWeights.w;  

        bi_0 = other.bonesIndices[0];
        bi_1 = other.bonesIndices[1];
        bi_2 = other.bonesIndices[2];
        bi_3 = other.bonesIndices[3];   
        
        amID = other.animationMatrixID;
    }
    
    this.position.set(px, py, pz);
    this.texCoord.set(tc_u, tc_v);
    this.normal.set(nx, ny, nz);
    this.tangent.set(tx, ty, tz, tw);
    
    this.bonesWeights.set(bw_x, bw_y, bw_z, bw_w);

    this.bonesIndices[0] = bi_0;
    this.bonesIndices[1] = bi_1;
    this.bonesIndices[2] = bi_2;
    this.bonesIndices[3] = bi_3;
    
    this.animationMatrixID = amID;
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

    rawData[8]  = this.tangent.x;
    rawData[9]  = this.tangent.y;
    rawData[10] = this.tangent.z;
    rawData[11] = this.tangent.w;
    
    rawData[12] = this.bonesWeights.x;
    rawData[13] = this.bonesWeights.y;
    rawData[14] = this.bonesWeights.z;
    rawData[15] = this.bonesWeights.w;

    rawData[16] = this.bonesIndices[0];
    rawData[17] = this.bonesIndices[1];
    rawData[18] = this.bonesIndices[2];
    rawData[19] = this.bonesIndices[3];

    rawData[20] = this.animationMatrixID;
    
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
    
    vertex.tangent.x = array[offset + 8];     
    vertex.tangent.y = array[offset + 9];     
    vertex.tangent.z = array[offset + 10];   
    vertex.tangent.w = array[offset + 11];   
    
    vertex.bonesWeights.x = array[offset + 12];     
    vertex.bonesWeights.y = array[offset + 13]; 
    vertex.bonesWeights.z = array[offset + 14]; 
    vertex.bonesWeights.w = array[offset + 15];     
    
    vertex.bonesIndices[0] = array[offset + 16];     
    vertex.bonesIndices[1] = array[offset + 17];     
    vertex.bonesIndices[2] = array[offset + 18];     
    vertex.bonesIndices[3] = array[offset + 19];     
    
    vertex.animationMatrixID = array[offset + 20]; 
    
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

    view.setFloat32(offset, this.tangent.x, true); offset += 4;
    view.setFloat32(offset, this.tangent.y, true); offset += 4;
    view.setFloat32(offset, this.tangent.z, true); offset += 4;
    view.setFloat32(offset, this.tangent.w, true); offset += 4;
    
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

    vertex.tangent.x = view.getFloat32(offset, true); offset += 4;
    vertex.tangent.y = view.getFloat32(offset, true); offset += 4;
    vertex.tangent.z = view.getFloat32(offset, true); offset += 4;
    vertex.tangent.w = view.getFloat32(offset, true); offset += 4;
    
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
    let hash = "";
    let rawData = this.toFloat32Array();

    rawData[8] = rawData[9] = rawData[10] = rawData[11] = 0.0; // ignore tangents

    for(let i = 0, e = rawData.length; i != e; ++i) hash += (Math.floor(rawData[i] / 1e-6)) + ((i < e - 1) ? "," : "");
    
    return hash;
}
