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

let glVector4f = function(x, y, z, w)
{
    this.__is_glVector4f = true;
    
    this.set(x, y, z, w);  
}

glVector4f.prototype.squaredLength = function() {
    return glVector4f.dot(this, this);
}

glVector4f.prototype.length = function()
{
    let squaredLength = this.squaredLength();
    return ((squaredLength > 0.0) ? Math.sqrt(squaredLength) : 0.0);
}

glVector4f.prototype.normalize = function()
{
    let magnitude = this.length();
			
	if(magnitude > 0.0)
	{
		this.x /= magnitude;
		this.y /= magnitude;
		this.z /= magnitude;
        this.w /= magnitude;
        
	} else this.set(0.0);
}

glVector4f.prototype.set = function(x, y, z, w)
{
    if(x != null && x.__is_glVector4f) 
    {
        this.x = x.x;
        this.y = x.y;
        this.z = x.z;
        this.w = x.w;        
    }
    else if(y != null || z != null || w != null) 
    {
        this.x = ((x != null) ? x : 0.0);
        this.y = ((y != null) ? y : 0.0);
        this.z = ((z != null) ? z : 0.0);
        this.w = ((w != null) ? w : 0.0);

    } else this.x = this.y = this.z = this.w = ((x != null) ? x : 0.0);
}

glVector4f.prototype.abs = function()
{
    this.x = Math.abs(this.x);
    this.y = Math.abs(this.y);
    this.z = Math.abs(this.z);
    this.w = Math.abs(this.w);

    return this;
}

glVector3f.prototype.mod = function(x, y, z, w)
{
    let v = x;
    if(!v.__is_glVector4f) v = new glVector4f(x, y, z, w);

    this.x = this.x - Math.floor(this.x / v.x) * v.x;
    this.y = this.y - Math.floor(this.y / v.y) * v.y;
    this.z = this.z - Math.floor(this.z / v.z) * v.z;
    this.w = this.w - Math.floor(this.w / v.w) * v.w;
    
    return this;
}

glVector4f.prototype.add = function(x, y, z, w)
{    
    let other = x;
    if(!other.__is_glVector4f) other = new glVector4f(x, y, z, w);
    
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    this.w += other.w;

    return this;    
}

glVector4f.prototype.sub = function(x, y, z, w)
{    
    let other = x;
    if(!other.__is_glVector4f) other = new glVector4f(x, y, z, w);
    
    this.x -= other.x;
    this.y -= other.y;
    this.z -= other.z;
    this.w -= other.w;

    return this;    
}

glVector4f.prototype.mul = function(x, y, z, w)
{    
    let other = x;
    if(!other.__is_glVector4f) other = new glVector4f(x, y, z, w);
    
    this.x *= other.x;
    this.y *= other.y;
    this.z *= other.z;
    this.w *= other.w;

    return this;    
}

glVector4f.prototype.div = function(x, y, z, w)
{    
    let other = x;
    if(!other.__is_glVector4f) other = new glVector4f(x, y, z, w);
    
    this.x /= other.x;
    this.y /= other.y;
    this.z /= other.z;
    this.w /= other.w;

    return this;    
}

glVector4f.add = function(a, b) {  
    return (new glVector4f(a)).add(b);
}

glVector4f.sub = function(a, b) {  
    return (new glVector4f(a)).sub(b);
}

glVector4f.mul = function(a, b) {  
    return (new glVector4f(a)).mul(b);
}

glVector4f.div = function(a, b) {  
    return (new glVector4f(a)).div(b);
}

glVector4f.prototype.equals = function(x, y, z, w)
{    
    let other = x;
    if(!other.__is_glVector4f) other = new glVector4f(x, y, z, w);
    
    return (this.x == other.x && this.y == other.y && this.z == other.z && this.w == other.w);  
}

glVector4f.prototype.flip = function()
{
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    this.w = -this.w;

    return this;
}

glVector4f.flip = function(x, y, z, w) {
    return (new glVector4f(x, y, z, w)).flip();
}

glVector4f.abs = function(x, y, z, w) {
    return (new glVector4f(x, y, z, w)).abs();
}

glVector4f.dot = function(a, b) {    
    return (a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
}

glVector4f.normalize = function(x, y, z, w)
{    
    let v = new glVector4f(x, y, z, w);
    v.normalize();
    
    return v;  
}

glVector4f.mod = function(a, b) {
    return new glVector4f(a).mod(b);
}

glVector4f.min = function(a, b) {
    return new glVector4f(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z), Math.min(a.w, b.w));
}

glVector4f.max = function(a, b) {
    return new glVector4f(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z), Math.max(a.w, b.w));
}

glVector4f.equals = function(a, b) {  
    return a.equals(b);
}

glVector4f.distance = function(a, b) {    
    return ((new glVector4f(b)).sub(a)).length();
}

glVector4f.squaredDistance = function(a, b) {    
    return ((new glVector4f(b)).sub(a)).squaredLength();
}

glVector4f.random = function()
{    
    return glVector4f.normalize((-1.0 + 2.0 * Math.random()), 
                                (-1.0 + 2.0 * Math.random()),
                                (-1.0 + 2.0 * Math.random()), 
                                (-1.0 + 2.0 * Math.random()));
}

