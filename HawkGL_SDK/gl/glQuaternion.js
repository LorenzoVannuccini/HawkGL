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

let glQuaternion = function(x, y, z, w)
{
    this.__is_glQuaternion = true;
    
    this.__matrix = this.__inverseMatrix = null;
    this.set(x, y, z, w);
}

glQuaternion.__PI = 3.14159265358979323846;
glQuaternion.__180overPI = (180.0 / glQuaternion.__PI);
glQuaternion.__PIover180 = (glQuaternion.__PI / 180.0);

glQuaternion.__safeAcos = function(x) {
    return ((x <= -1.0) ? glQuaternion.__PI : ((x >= 1.0) ? 0.0 : Math.acos(x)));
}

glQuaternion.prototype.set = function(x, y, z, w)
{
    this.__matrixUpdated = this.__inverseMatrixUpdated = false;
    
    if(x != null && x.__is_glMatrix4x4f) {
        this.__setFromMatrix(x);
    }
    else if(x != null && x.__is_glVector3f) {
        this.setOrientation(x, ((y != null) ? y : 0.0));  
    }
    else if(x != null && x.__is_glVector4f) 
    {
        this.__x = x.x;
        this.__y = x.y;
        this.__z = x.z;
        this.__w = x.w;       
    }
    else if(x != null && x.__is_glQuaternion) 
    {
        this.__x = x.__x;
        this.__y = x.__y;
        this.__z = x.__z;
        this.__w = x.__w;       
    }
    else if(x != null && y != null && z != null && w != null) 
    {
        this.__x = x;
        this.__y = y;
        this.__z = z;
        this.__w = w;

    } else this.setIdentity();
}

glQuaternion.prototype.setIdentity = function()
{
    this.__x = 0.0;
    this.__y = 0.0;
    this.__z = 0.0;
    this.__w = 1.0;
    
    if(this.__matrix != null)
    {
        this.__matrix.setIdentity();
        this.__matrixUpdated = true;
    }
    
    if(this.__inverseMatrix != null)
    {
        this.__inverseMatrix.setIdentity();
        this.__inverseMatrixUpdated = true;
    }
}

glQuaternion.prototype.setOrientation = function(axis, degrees)
{
	let halfAngleRads = -degrees * 0.5 * glQuaternion.__PIover180;
	let sinHalfAngleRads = Math.sin(halfAngleRads);
	
	this.__x = axis.x * sinHalfAngleRads;
	this.__y = axis.y * sinHalfAngleRads;
	this.__z = axis.z * sinHalfAngleRads;
	
	this.__w = Math.cos(halfAngleRads);
	
	this.__matrixUpdated = inverseMatrixUpdated = false;
}

glQuaternion.prototype.__setFromMatrix = function(matrix)
{
    let m = matrix.__m;

    let m00 = m[0];
    let m01 = m[1];
    let m02 = m[2];
    
    let m10 = m[4];
    let m11 = m[5];
    let m12 = m[6];
    
    let m20 = m[8];
    let m21 = m[9];
    let m22 = m[10];
    
    this.__x = Math.sqrt(Math.max(0.0, 1.0 + m00 - m11 - m22 )) * 0.5; 
    this.__y = Math.sqrt(Math.max(0.0, 1.0 - m00 + m11 - m22 )) * 0.5;
    this.__z = Math.sqrt(Math.max(0.0, 1.0 - m00 - m11 + m22 )) * 0.5;
    this.__w = Math.sqrt(Math.max(0.0, 1.0 + m00 + m11 + m22 )) * 0.5;
 
    this.__x *= (((this.__x * (m21 - m12)) < 0.0) ? -1.0 : +1.0);
    this.__y *= (((this.__y * (m02 - m20)) < 0.0) ? -1.0 : +1.0);
    this.__z *= (((this.__z * (m10 - m01)) < 0.0) ? -1.0 : +1.0);
    
    this.__matrix = new glMatrix4x4f(matrix);
    m = this.__matrix.__m;

    m[12] = m[13] = m[14] = 0.0;  
    m[15] = 1.0;
    
    this.__matrixUpdated = true;
    this.__inverseMatrixUpdated = false;
}

glQuaternion.prototype.__updateMatrix = function()
{
    let xx = this.__x * this.__x;
    let yy = this.__y * this.__y;
    let zz = this.__z * this.__z;

    let xy = this.__x * this.__y;
    let xz = this.__x * this.__z;

    let yz = this.__y * this.__z;

    let wx = this.__w * this.__x;
    let wy = this.__w * this.__y;
    let wz = this.__w * this.__z;

    if(this.__matrix == null) this.__matrix = new glMatrix4x4f(); 
    let m = this.__matrix.__m;
    
    m[0] = 1.0 - 2.0 * ( yy + zz );  
    m[1] = 2.0 * ( xy - wz );  
    m[2] = 2.0 * ( xz + wy );  
    m[3] = 0.0;  

    m[4] = 2.0 * ( xy + wz );  
    m[5] = 1.0 - 2.0 * ( xx + zz );  
    m[6] = 2.0 * ( yz - wx );  
    m[7] = 0.0;  

    m[8] = 2.0 * ( xz - wy );  
    m[9] = 2.0 * ( yz + wx );  
    m[10] = 1.0 - 2.0 * ( xx + yy );  
    m[11] = 0.0;  

    m[12] = m[13] = m[14] = 0.0;  
    m[15] = 1.0;

    this.__matrixUpdated = true;
}

glQuaternion.prototype.toVector3f = function() {
    return glVector3f.normalize(this.toInverseMatrix4x4f().mul(new glVector3f(0.0, 0.0, -1.0)));
}

glQuaternion.prototype.toMatrix4x4f = function()
{
    if(!this.__matrixUpdated) this.__updateMatrix();
    return new glMatrix4x4f(this.__matrix);
}

glQuaternion.prototype.toInverseMatrix4x4f = function()
{
    if(!this.__inverseMatrixUpdated)
    {
        if(!this.__matrixUpdated) this.__updateMatrix();
        this.__inverseMatrix = glMatrix4x4f.inverse(this.__matrix); 

        this.__inverseMatrixUpdated = true;
    }

    return new glMatrix4x4f(this.__inverseMatrix);
}

glQuaternion.prototype.lookAt = function(src, dst, forward)
{
    let target = glVector3f.normalize(glVector3f.sub(dst, src));
    
    if(forward == null) forward = new glVector3f(0.0, 0.0, -1.0);
    
    if(glVector3f.cross(target, forward).squaredLength() < 1e-6)
    {
        forward.add(0.0, 1e-6, 0.0);
        forward.normalize();
    }
    
    if(!this.__matrixUpdated) this.__updateMatrix();
    forward = this.__matrix.mul(forward);
    
    let degrees = glQuaternion.__safeAcos(glVector3f.dot(target, forward)) * glQuaternion.__180overPI;
    if(degrees != 0.0) this.rotate(glVector3f.normalize(glVector3f.cross(target, forward)), degrees);
}

glQuaternion.prototype.rotate = function(axis, degrees)
{
    axis.normalize();
    
    if(degrees != 0.0 && axis.squaredLength() > 0.0) {
        this.set(this.mul(new glQuaternion(axis, degrees)));
    }
}

glQuaternion.prototype.normalize = function()
{
    let squaredLength = this.__x * this.__x + this.__y * this.__y + this.__z * this.__z + this.__w * this.__w;
    if(squaredLength != 1.0)
    {
        let inverseLength = (squaredLength != 0.0 ? (1.0 / Math.sqrt(squaredLength)) : 0.0);

        this.__x *= inverseLength;
        this.__y *= inverseLength;
        this.__z *= inverseLength;
        this.__w *= inverseLength;
        
        this.__matrixUpdated = this.__inverseMatrixUpdated = false;
    }
}

glQuaternion.prototype.__mul_quaternion = function(other)
{
    return new glQuaternion((this.__w * other.__x + this.__x * other.__w + this.__y * other.__z - this.__z * other.__y),
                            (this.__w * other.__y + this.__y * other.__w + this.__z * other.__x - this.__x * other.__z),
                            (this.__w * other.__z + this.__z * other.__w + this.__x * other.__y - this.__y * other.__x),	
                            (this.__w * other.__w - this.__x * other.__x - this.__y * other.__y - this.__z * other.__z));
}

glQuaternion.prototype.__mul_vec3 = function(v)
{
    if(!this.__matrixUpdated) this.__updateMatrix();
    return this.__matrix.mul(v);
}

glQuaternion.prototype.mul = function(other) {
    return (other.__is_glVector3f ? this.__mul_vec3(other) : this.__mul_quaternion(other));
}

glQuaternion.mul = function(a, b) {
    return (new glQuaternion(a)).mul(b);
}

glQuaternion.prototype.flip = function()
{
    this.__x = -this.__x;
    this.__y = -this.__y;
    this.__z = -this.__z;
    this.__w = -this.__w;

    this.__matrixUpdated = this.__inverseMatrixUpdated = false;
    
    return this;
}

glQuaternion.flip = function(x, y, z, w) {
    return (new glQuaternion(x, y, z, w)).flip();
}

glQuaternion.dot = function(a, b) {    
    return (a.__x * b.__x + a.__y * b.__y + a.__z * b.__z + a.__w * b.__w);
}

glQuaternion.lerp = function(a, b, t)
{
	let tb = Math.min(Math.max(t, 0.0), 1.0);
    let ta = 1.0 - tb;

    let q = new glQuaternion(ta * a.__x + tb * b.__x,
                             ta * a.__y + tb * b.__y,
                             ta * a.__z + tb * b.__z,
                             ta * a.__w + tb * b.__w);

    q.normalize();

	return q;
}

glQuaternion.slerp = function(a, b, t)
{
    let tb = Math.min(Math.max(t, 0.0), 1.0);
    let ta = 1.0 - tb;

    let dot = a.__x * b.__x + a.__y * b.__y + a.__z * b.__z + a.__w * b.__w;
    if(dot < 0.0)
    {
        dot = -dot;
        a = glQuaternion.flip(a);
    }
    
    let theta = glQuaternion.__safeAcos(dot);
    let sn = Math.sin(theta);
    
    let epsilon = 1e-6;
    if(Math.abs(sn) <= epsilon) // coplanar
    {
        let forward = b.toVector3f();
        if(glVector3f.dot(a.toVector3f(), forward) >= 0.0) return new glQuaternion(b); // same direction
       
        let up = new glVector3f(0.0, 1.0, 0.0);
        if(glVector3f.cross(forward, up).squaredLength() < epsilon)
        {
            up = new glVector3f(1.0, 0.0, 0.0);
            
            if(glVector3f.cross(forward, up).squaredLength() < epsilon) {
                up = new glVector3f(0.0, 0.0, 1.0);
            }
        }

        let bitangent = glVector3f.normalize(glVector3f.cross(forward, up));
        let normal    = glVector3f.normalize(glVector3f.cross(bitangent, forward));
        
        b.lookAt(new glVector3f(0.0), glVector3f.normalize(glVector3f.add(forward, normal.mul(epsilon)))); // bias toward plane normal

        dot = a.__x * b.__x + a.__y * b.__y + a.__z * b.__z + a.__w * b.__w;
        if(dot < 0.0)
        {
            dot = -dot;
            a = glQuaternion.flip(a);
        }

        theta = glQuaternion.__safeAcos(dot);
        sn = Math.sin(theta);    
    }
    
    let Wa = Math.sin(ta * theta) / sn;
    let Wb = Math.sin(tb * theta) / sn;

    let q = new glQuaternion(Wa * a.__x + Wb * b.__x,
                             Wa * a.__y + Wb * b.__y,
                             Wa * a.__z + Wb * b.__z,
                             Wa * a.__w + Wb * b.__w);
    q.normalize();

    return q;
}

glQuaternion.distance = function(q0, q1)
{
    let dot = glQuaternion.dot(q0, q1);
    return glQuaternion.__safeAcos(2.0 * dot * dot - 1.0);
}
