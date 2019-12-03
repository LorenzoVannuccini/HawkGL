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
    this.position  = new glVector3f(px, py, pz);
    this.texCoord  = new glVector2f(tc_u, tc_v);
    this.normal    = new glVector3f(nx, ny, nz);
    
    this.bonesWeights = new glVector4f(0.0);
    this.bonesIndices = new glVector4f(-1);
    this.animationMatrixID = -1;
}

glVertex.size = function() {
    return 17;
}

glVertex.clone = function(other)
{
    let vertex = new glVertex();
    
    vertex.position          = new glVector3f(other.position);
    vertex.texCoord          = new glVector2f(other.texCoord);
    vertex.normal            = new glVector3f(other.normal);
    vertex.bonesWeights      = new glVector4f(other.bonesWeights);
    vertex.bonesIndices      = new glVector4f(other.bonesIndices);
    vertex.animationMatrixID = other.animationMatrixID;
    
    return vertex;
}

glVertex.prototype.toFloatArray = function()
{
    let rawData = new Array(glVertex.size());

    rawData[0] = this.position.x;
    rawData[1] = this.position.y;
    rawData[2] = this.position.z;

    rawData[3] = this.texCoord.x;
    rawData[4] = this.texCoord.y;  

    rawData[5] = this.normal.x;
    rawData[6] = this.normal.y;
    rawData[7] = this.normal.z;

    rawData[8]  = this.bonesIndices.x;
    rawData[9]  = this.bonesIndices.y;
    rawData[10] = this.bonesIndices.z;
    rawData[11] = this.bonesIndices.w;

    rawData[12] = this.bonesWeights.x;
    rawData[13] = this.bonesWeights.y;
    rawData[14] = this.bonesWeights.z;
    rawData[15] = this.bonesWeights.w;

    rawData[16] = this.animationMatrixID;
    
    return rawData;
}

glVertex.prototype.toHash = function()
{
    let rawData = this.toFloatArray();
    for(let i = 0, e = rawData.length; i != e; ++i) rawData[i] = rawData[i].toPrecision(4);

    return rawData.toString();
}
