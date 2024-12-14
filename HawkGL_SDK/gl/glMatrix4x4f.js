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

let glMatrix4x4f = function(matrix)
{
    this.__is_glMatrix4x4f = true;

    this.__m = new Float32Array([ 1.0, 0.0, 0.0, 0.0,
                                  0.0, 1.0, 0.0, 0.0,
                                  0.0, 0.0, 1.0, 0.0,
                                  0.0, 0.0, 0.0, 1.0 ]);

    if(matrix != null) this.set(matrix);
}

glMatrix4x4f.__PiOver180 = (Math.PI / 180.0);

glMatrix4x4f.prototype.set = function(matrix) {
    this.__m.set(((matrix.__is_glMatrix4x4f) ? matrix.__m : matrix));
}

glMatrix4x4f.prototype.setIdentity = function()
{
    let m = this.__m;

    m[0]  = 1.0; m[1]  = 0.0; m[2]  = 0.0; m[3]  = 0.0; 
    m[4]  = 0.0; m[5]  = 1.0; m[6]  = 0.0; m[7]  = 0.0; 
    m[8]  = 0.0; m[9]  = 0.0; m[10] = 1.0; m[11] = 0.0; 
    m[12] = 0.0; m[13] = 0.0; m[14] = 0.0; m[15] = 1.0; 
}

glMatrix4x4f.identityMatrix = function() {
    return new glMatrix4x4f();
}

glMatrix4x4f.translationMatrix = function(x, y, z)
{
    let vector = x;
    if(!vector.__is_glVector3f) vector = new glVector3f(x, y, z);

    let matrix = glMatrix4x4f.identityMatrix();
    let m = matrix.__m;

    m[12] = vector.x;
    m[13] = vector.y;
    m[14] = vector.z;

    return matrix;
}

glMatrix4x4f.lookAtMatrix = function(src, dst, up)
{
    if(up == null) up = new glVector3f(0.0, 1.0, 0.0);
    let forward = glVector3f.normalize(glVector3f.sub(dst, src));
    
    if(glVector3f.cross(forward, up).squaredLength() < 1e-4)
    {
    	up = new glVector3f(1.0, 0.0, 0.0);
    	
		if(glVector3f.cross(forward, up).squaredLength() < 1e-4)
	    {
	    	up = new glVector3f(0.0, 1.0, 0.0);
	    	
			if(glVector3f.cross(forward, up).squaredLength() < 1e-4) up = new glVector3f(0.0, 0.0, 1.0);
		}
	}
    
    let right = glVector3f.normalize(glVector3f.cross(forward, up)); 
    up = glVector3f.cross(right, forward);
     
    let matrix = glMatrix4x4f.identityMatrix();
    let m = matrix.__m;

 	m[1]  = up.x;
	m[5]  = up.y;
	m[9]  = up.z;
    m[0]  = right.x;
	m[4]  = right.y;
	m[8]  = right.z;
	m[2]  = -forward.x;
	m[6]  = -forward.y;
    m[10] = -forward.z;

    return glMatrix4x4f.mul(matrix, glMatrix4x4f.translationMatrix(-src.x, -src.y, -src.z));
}

glMatrix4x4f.translationMatrix = function(x, y, z)
{
    let vector = x;
    if(!vector.__is_glVector3f) vector = new glVector3f(x, y, z);

    let matrix = glMatrix4x4f.identityMatrix();
    let m = matrix.__m;

    m[12] = vector.x;
    m[13] = vector.y;
    m[14] = vector.z;

    return matrix;
}

glMatrix4x4f.rotationMatrix = function(rotationDeg, x, y, z)
{
    let axis = glVector3f.normalize(x, y, z);

    let rotationRadians = (rotationDeg * glMatrix4x4f.__PiOver180);
    
    let sinRad = Math.sin(rotationRadians);
    let cosRad = Math.cos(rotationRadians);

    let matrix = glMatrix4x4f.identityMatrix();
    let m = matrix.__m;

    m[1]  = +axis.z * sinRad + (1.0 - cosRad) * axis.x * axis.y;
    m[2]  = -axis.y * sinRad + (1.0 - cosRad) * axis.x * axis.z;
    
    m[4]  = -axis.z * sinRad + (1.0 - cosRad) * axis.x * axis.y;
    m[6]  = +axis.x * sinRad + (1.0 - cosRad) * axis.y * axis.z;
    
    m[8]  = +axis.y * sinRad + (1.0 - cosRad) * axis.x * axis.z;
    m[9]  = -axis.x * sinRad + (1.0 - cosRad) * axis.y * axis.z;

    m[0]  = 1.0 + (1.0 - cosRad) * (axis.x * axis.x - 1.0);
    m[5]  = 1.0 + (1.0 - cosRad) * (axis.y * axis.y - 1.0);
    m[10] = 1.0 + (1.0 - cosRad) * (axis.z * axis.z - 1.0);
  
    return matrix;
}

glMatrix4x4f.scaleMatrix = function(x, y, z)
{
    let vector = x;
    if(!vector.__is_glVector3f) vector = new glVector3f(x, y, z);

    let matrix = glMatrix4x4f.identityMatrix();
    let m = matrix.__m;

    m[0]  = vector.x;
    m[5]  = vector.y;
    m[10] = vector.z;

    return matrix;
}

glMatrix4x4f.normalMatrix = function(matrix)
{
    let normalMatrix = glMatrix4x4f.inverse(glMatrix4x4f.transpose(matrix));

    // TODO: create glMatrix3x3f object
    normalMatrix.__m[3]  = 0.0;
    normalMatrix.__m[7]  = 0.0;
    normalMatrix.__m[11] = 0.0;
    normalMatrix.__m[12] = 0.0;
    normalMatrix.__m[13] = 0.0;
    normalMatrix.__m[14] = 0.0;
    normalMatrix.__m[15] = 1.0;
    //

    return normalMatrix;
}

glMatrix4x4f.orthographicProjectionMatrix = function(left, right, bottom, top, near, far)
{
    return new glMatrix4x4f([2.0 / (right - left), 0.0,                    0.0,                -((right + left) / (right - left)),
                             0.0,                  2.0 / (top - bottom),   0.0,                -((top + bottom) / (top - bottom)),
                             0.0,                  0.0,                   -2.0 / (far - near), -((far + near)   / (far - near)),
                             0.0,                  0.0,                    0.0,                                           1.0]);    
}

glMatrix4x4f.perspectiveProjectionMatrix = function(fov, aspectRatio, zNear, zFar)
{
    let rangeInv = 1.0 / (zNear - zFar);
    let f = 1.0 / Math.tan(fov * glMatrix4x4f.__PiOver180 * 0.5);
    
    return new glMatrix4x4f([f / aspectRatio, 0.0, 0.0,                           0.0,
                             0.0,             f,   0.0,                           0.0,
                             0.0,             0.0, (zNear + zFar) * rangeInv,    -1.0,
                             0.0,             0.0, zNear * zFar * rangeInv * 2.0, 0.0]);    
}

glMatrix4x4f.prototype.__mul_mat4x4 = function(mat4)
{
    let result = new Array(16);

    let m = this.__m;
    let o = mat4.__m;

    result[0]  = (m[0] * o[0]) + (m[4] * o[1]) + (m[8]  * o[2]) + (m[12] * o[3]);
    result[1]  = (m[1] * o[0]) + (m[5] * o[1]) + (m[9]  * o[2]) + (m[13] * o[3]);
    result[2]  = (m[2] * o[0]) + (m[6] * o[1]) + (m[10] * o[2]) + (m[14] * o[3]);
    result[3]  = (m[3] * o[0]) + (m[7] * o[1]) + (m[11] * o[2]) + (m[15] * o[3]);

    result[4]  = (m[0] * o[4]) + (m[4] * o[5]) + (m[8]  * o[6]) + (m[12] * o[7]);
    result[5]  = (m[1] * o[4]) + (m[5] * o[5]) + (m[9]  * o[6]) + (m[13] * o[7]);
    result[6]  = (m[2] * o[4]) + (m[6] * o[5]) + (m[10] * o[6]) + (m[14] * o[7]);
    result[7]  = (m[3] * o[4]) + (m[7] * o[5]) + (m[11] * o[6]) + (m[15] * o[7]);

    result[8]  = (m[0] * o[8]) + (m[4] * o[9]) + (m[8]  * o[10]) + (m[12] * o[11]);
    result[9]  = (m[1] * o[8]) + (m[5] * o[9]) + (m[9]  * o[10]) + (m[13] * o[11]);
    result[10] = (m[2] * o[8]) + (m[6] * o[9]) + (m[10] * o[10]) + (m[14] * o[11]);
    result[11] = (m[3] * o[8]) + (m[7] * o[9]) + (m[11] * o[10]) + (m[15] * o[11]);

    result[12] = (m[0] * o[12]) + (m[4] * o[13]) + (m[8]  * o[14]) + (m[12] * o[15]);
    result[13] = (m[1] * o[12]) + (m[5] * o[13]) + (m[9]  * o[14]) + (m[13] * o[15]);
    result[14] = (m[2] * o[12]) + (m[6] * o[13]) + (m[10] * o[14]) + (m[14] * o[15]);
    result[15] = (m[3] * o[12]) + (m[7] * o[13]) + (m[11] * o[14]) + (m[15] * o[15]);

    this.set(result);

    return this;
}

glMatrix4x4f.prototype.__mul_vec4 = function(vec4)
{
    return new glVector4f(vec4.x * this.__m[0] + vec4.y * this.__m[4] + vec4.z * this.__m[8]  + vec4.w * this.__m[12],
                          vec4.x * this.__m[1] + vec4.y * this.__m[5] + vec4.z * this.__m[9]  + vec4.w * this.__m[13],
                          vec4.x * this.__m[2] + vec4.y * this.__m[6] + vec4.z * this.__m[10] + vec4.w * this.__m[14],
                          vec4.x * this.__m[3] + vec4.y * this.__m[7] + vec4.z * this.__m[11] + vec4.w * this.__m[15]);  
}

glMatrix4x4f.prototype.__mul_vec3 = function(vec3)
{
    return new glVector3f(vec3.x * this.__m[0] + vec3.y * this.__m[4] + vec3.z * this.__m[8]  + this.__m[12],
                          vec3.x * this.__m[1] + vec3.y * this.__m[5] + vec3.z * this.__m[9]  + this.__m[13],
                          vec3.x * this.__m[2] + vec3.y * this.__m[6] + vec3.z * this.__m[10] + this.__m[14]);  
}

glMatrix4x4f.prototype.__mul_aabb = function(aabb) {
    return (new glAABB(aabb)).transform(this);
}

glMatrix4x4f.prototype.mul = function(other)
{
    if(other.__is_glAABB)           return this.__mul_aabb(other);
    else if(other.__is_glVector3f)  return this.__mul_vec3(other);
    else if(other.__is_glVector4f)  return this.__mul_vec4(other);
    else                            return this.__mul_mat4x4(other);
}

glMatrix4x4f.prototype.hash = function()
{
    let hash = new Uint32Array([0.0]);
    let mU32 = new Uint32Array(this.__m.buffer);

    // Prime numbers for mixing
    const p1 = 73856093;
    const p2 = 19349663;
    const p3 = 83492791;

    for (let i = 0; i < 16; ++i)
    {
        let x = 1 + (i % 4);
        let y = 1 + (Math.floor(i / 4));

        hash[0] ^= (mU32[i] * ((x * p1) ^ (y * p2))) ^ p3;
    }

    return hash[0];
}

glMatrix4x4f.compare = function(ma, mb) {
    return (ma.hash() == mb.hash());
}

glMatrix4x4f.mul = function(a, b) {
    return (new glMatrix4x4f(a)).mul(b);
}

glMatrix4x4f.invertible = function(matrix)
{
    let m = matrix.__m;

    let d12 = (m[2]  * m[7]  - m[3]  * m[6]);
    let d13 = (m[2]  * m[11] - m[3]  * m[10]);
    let d23 = (m[6]  * m[11] - m[7]  * m[10]);
    let d24 = (m[6]  * m[15] - m[7]  * m[14]);
    let d34 = (m[10] * m[15] - m[11] * m[14]);
    let d41 = (m[14] * m[3]  - m[15] * m[2]);
    
    let result = new Array(4);

    result[0] =  (m[5] * d34 - m[9] * d24 + m[13] * d23);
    result[1] = -(m[1] * d34 + m[9] * d41 + m[13] * d13);
    result[2] =  (m[1] * d24 + m[5] * d41 + m[13] * d12);
    result[3] = -(m[1] * d23 - m[5] * d13 + m[9]  * d12);

    let det = m[0] * result[0] + m[4] * result[1] + m[8] * result[2] + m[12] * result[3];

    return (Math.abs(det) > 0.0);
}

glMatrix4x4f.inverse = function(matrix)
{
    let m = matrix.__m;

    let d12 = (m[2]  * m[7]  - m[3]  * m[6]);
    let d13 = (m[2]  * m[11] - m[3]  * m[10]);
    let d23 = (m[6]  * m[11] - m[7]  * m[10]);
    let d24 = (m[6]  * m[15] - m[7]  * m[14]);
    let d34 = (m[10] * m[15] - m[11] * m[14]);
    let d41 = (m[14] * m[3]  - m[15] * m[2]);
    
    let inverseMatrix = new glMatrix4x4f();
    let result = inverseMatrix.__m;

    result[0] =  (m[5] * d34 - m[9] * d24 + m[13] * d23);
    result[1] = -(m[1] * d34 + m[9] * d41 + m[13] * d13);
    result[2] =  (m[1] * d24 + m[5] * d41 + m[13] * d12);
    result[3] = -(m[1] * d23 - m[5] * d13 + m[9]  * d12);

    let det = m[0] * result[0] + m[4] * result[1] + m[8] * result[2] + m[12] * result[3];

    if(Math.abs(det) > 0.0)
    {
       let invDet = 1.0 / det;
       
       result[0] *= invDet;
       result[1] *= invDet;
       result[2] *= invDet;
       result[3] *= invDet;

       result[4] = -(m[4] * d34 - m[8] * d24 + m[12] * d23) * invDet;
       result[5] =  (m[0] * d34 + m[8] * d41 + m[12] * d13) * invDet;
       result[6] = -(m[0] * d24 + m[4] * d41 + m[12] * d12) * invDet;
       result[7] =  (m[0] * d23 - m[4] * d13 + m[8]  * d12) * invDet;

       d12 = m[0]  * m[5]  - m[1]  * m[4];
       d13 = m[0]  * m[9]  - m[1]  * m[8];
       d23 = m[4]  * m[9]  - m[5]  * m[8];
       d24 = m[4]  * m[13] - m[5]  * m[12];
       d34 = m[8]  * m[13] - m[9]  * m[12];
       d41 = m[12] * m[1]  - m[13] * m[0];

       result[8]  =  (m[7] * d34 - m[11] * d24 + m[15] * d23) * invDet;
       result[9]  = -(m[3] * d34 + m[11] * d41 + m[15] * d13) * invDet;
       result[10] =  (m[3] * d24 + m[7]  * d41 + m[15] * d12) * invDet;
       result[11] = -(m[3] * d23 - m[7]  * d13 + m[11] * d12) * invDet;
       result[12] = -(m[6] * d34 - m[10] * d24 + m[14] * d23) * invDet;
       result[13] =  (m[2] * d34 + m[10] * d41 + m[14] * d13) * invDet;
       result[14] = -(m[2] * d24 + m[6]  * d41 + m[14] * d12) * invDet;
       result[15] =  (m[2] * d23 - m[6]  * d13 + m[10] * d12) * invDet;

       return inverseMatrix;
       
    } else return glMatrix4x4f.identityMatrix();
}

glMatrix4x4f.transpose = function(matrix)
{
    let m = matrix.__m;

    return new glMatrix4x4f([m[0], m[4], m[8],  m[12], 
                             m[1], m[5], m[9],  m[13],
                             m[2], m[6], m[10], m[14],
                             m[3], m[7], m[11], m[15]]); 
}
