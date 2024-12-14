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

let glVector3f = function(x, y, z)
{
    this.__is_glVector3f = true;
    
    this.set(x, y, z);  
}

glVector3f.prototype.squaredLength = function() {
    return glVector3f.dot(this, this);
}

glVector3f.prototype.length = function()
{
    let squaredLength = this.squaredLength();
    return ((squaredLength > 0.0) ? Math.sqrt(squaredLength) : 0.0);
}

glVector3f.prototype.normalize = function()
{
    let magnitude = this.length();
			
	if(magnitude > 0.0)
	{
		this.x /= magnitude;
		this.y /= magnitude;
		this.z /= magnitude;
        
	} else this.set(0.0);
}

glVector3f.prototype.set = function(x, y, z)
{
    if(x != null && x.__is_glVector3f) 
    {
        this.x = x.x;
        this.y = x.y;
        this.z = x.z;    
    }
    else if(y != null || z != null) 
    {
        this.x = ((x != null) ? x : 0.0);
        this.y = ((y != null) ? y : 0.0);
        this.z = ((z != null) ? z : 0.0);

    } else this.x = this.y = this.z = ((x != null) ? x : 0.0);
}

glVector3f.prototype.abs = function()
{
    this.x = Math.abs(this.x);
    this.y = Math.abs(this.y);
    this.z = Math.abs(this.z);

    return this;
}

glVector3f.prototype.mod = function(x, y, z)
{
    let v = x;
    if(!v.__is_glVector3f) v = new glVector3f(x, y, z);

    this.x = this.x - Math.floor(this.x / v.x) * v.x;
    this.y = this.y - Math.floor(this.y / v.y) * v.y;
    this.z = this.z - Math.floor(this.z / v.z) * v.z;
    
    return this;
}

glVector3f.prototype.add = function(x, y, z)
{    
    let other = x;
    if(!other.__is_glVector3f) other = new glVector3f(x, y, z);
    
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;

    return this;    
}

glVector3f.prototype.sub = function(x, y, z)
{    
    let other = x;
    if(!other.__is_glVector3f) other = new glVector3f(x, y, z);
    
    this.x -= other.x;
    this.y -= other.y;
    this.z -= other.z;

    return this;    
}

glVector3f.prototype.mul = function(x, y, z)
{    
    let other = x;
    if(!other.__is_glVector3f) other = new glVector3f(x, y, z);
    
    this.x *= other.x;
    this.y *= other.y;
    this.z *= other.z;

    return this;    
}

glVector3f.prototype.div = function(x, y, z)
{    
    let other = x;
    if(!other.__is_glVector3f) other = new glVector3f(x, y, z);
    
    this.x /= other.x;
    this.y /= other.y;
    this.z /= other.z;

    return this;    
}

glVector3f.add = function(a, b) {  
    return (new glVector3f(a)).add(b);
}

glVector3f.sub = function(a, b) {  
    return (new glVector3f(a)).sub(b);
}

glVector3f.mul = function(a, b) {  
    return (new glVector3f(a)).mul(b);
}

glVector3f.div = function(a, b) {  
    return (new glVector3f(a)).div(b);
}

glVector3f.prototype.equals = function(x, y, z)
{    
    let other = x;
    if(!other.__is_glVector3f) other = new glVector3f(x, y, z);
    
    return (this.x == other.x && this.y == other.y && this.z == other.z);  
}

glVector3f.prototype.flip = function()
{
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;

    return this;
}

glVector3f.flip = function(x, y, z) {
    return (new glVector3f(x, y, z)).flip();
}

glVector3f.abs = function(x, y, z) {
    return (new glVector3f(x, y, z)).abs();
}

glVector3f.normalize = function(x, y, z)
{
    let v = new glVector3f(x, y, z);
    v.normalize();
    
    return v;  
}

glVector3f.mod = function(a, b) {
    return new glVector3f(a).mod(b);
}

glVector3f.min = function(a, b) {
    return new glVector3f(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
}

glVector3f.max = function(a, b) {
    return new glVector3f(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
}

glVector3f.equals = function(a, b) {  
    return a.equals(b);
}

glVector3f.distance = function(a, b) {    
    return ((new glVector3f(b)).sub(a)).length();
}

glVector3f.squaredDistance = function(a, b) {    
    return ((new glVector3f(b)).sub(a)).squaredLength();
}

glVector3f.dot = function(a, b) {    
    return (a.x * b.x + a.y * b.y + a.z * b.z);
}

glVector3f.cross = function(a, b)
{    
    return new glVector3f((a.y * b.z - a.z * b.y),
                          (a.z * b.x - a.x * b.z),
                          (a.x * b.y - a.y * b.x));
}

glVector3f.random = function() {
    return glVector3f.normalize(glVector3f.max(new glVector3f(Math.random(), Math.random(), Math.random()), new glVector3f(1e-6))).mul((Math.random() > 0.5 ? +1.0 : -1.0));
}
