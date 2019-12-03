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

let glVector2f = function(x, y)
{
    this.__is_glVector2f = true;

    this.set(x, y);
}

glVector2f.prototype.squaredLength = function() {
    return glVector2f.dot(this, this);
}

glVector2f.prototype.length = function()
{
    let squaredLength = this.squaredLength();
    return ((squaredLength > 0.0) ? Math.sqrt(squaredLength) : 0.0);
}

glVector2f.prototype.normalize = function()
{
    let magnitude = this.length();
			
	if(magnitude > 0.0)
	{
		this.x /= magnitude;
		this.y /= magnitude;
        
	} else this.set(0.0);
}

glVector2f.prototype.set = function(x, y)
{
    if(x != null && x.__is_glVector2f) 
    {
        this.x = x.x;
        this.y = x.y;  
    }
    else
    {
        this.x = ((x != null) ? x : 0.0);
        this.y = ((y != null) ? y : this.x);
    }
}

glVector2f.prototype.abs = function()
{
    this.x = Math.abs(this.x);
    this.y = Math.abs(this.y);

    return this;
}

glVector2f.prototype.mod = function(x, y)
{
    let v = x;
    if(!v.__is_glVector2f) v = new glVector2f(x, y);

    this.x = this.x - Math.floor(this.x / v.x) * v.x;
    this.y = this.y - Math.floor(this.y / v.y) * v.y;
    
    return this;
}

glVector2f.prototype.add = function(x, y)
{    
    let other = x;
    if(!other.__is_glVector2f) other = new glVector2f(x, y);
    
    this.x += other.x;
    this.y += other.y;
  
    return this;    
}

glVector2f.prototype.sub = function(x, y)
{    
    let other = x;
    if(!other.__is_glVector2f) other = new glVector2f(x, y);
    
    this.x -= other.x;
    this.y -= other.y;
 
    return this;    
}

glVector2f.prototype.mul = function(x, y)
{    
    let other = x;
    if(!other.__is_glVector2f) other = new glVector2f(x, y);
    
    this.x *= other.x;
    this.y *= other.y;
   
    return this;    
}

glVector2f.prototype.div = function(x, y)
{    
    let other = x;
    if(!other.__is_glVector2f) other = new glVector2f(x, y);
    
    this.x /= other.x;
    this.y /= other.y;
  
    return this;    
}

glVector2f.add = function(a, b) {  
    return (new glVector2f(a)).add(b);
}

glVector2f.sub = function(a, b) {  
    return (new glVector2f(a)).sub(b);
}

glVector2f.mul = function(a, b) {  
    return (new glVector2f(a)).mul(b);
}

glVector2f.div = function(a, b) {  
    return (new glVector2f(a)).div(b);
}

glVector2f.prototype.equals = function(x, y)
{    
    let other = x;
    if(!other.__is_glVector2f) other = new glVector2f(x, y);
    
    return (this.x == other.x && this.y == other.y);  
}

glVector2f.prototype.flip = function()
{
    this.x = -this.x;
    this.y = -this.y;

    return this;
}

glVector2f.flip = function(x, y) {
    return (new glVector2f(x, y)).flip();
}

glVector2f.abs = function(x, y) {    
    return (new glVector2f(x, y)).abs();
}

glVector2f.normalize = function(x, y)
{    
    let v = new glVector2f(x, y);
    v.normalize();
    
    return v;  
}

glVector2f.mod = function(a, b) {
    return new glVector2f(a).mod(b);
}
    
glVector2f.min = function(a, b) {
    return new glVector2f(Math.min(a.x, b.x), Math.min(a.y, b.y));
}

glVector2f.max = function(a, b) {
    return new glVector2f(Math.max(a.x, b.x), Math.max(a.y, b.y));
}

glVector2f.distance = function(a, b) {    
    return ((new glVector2f(b)).sub(a)).length();
}

glVector2f.squaredDistance = function(a, b) {    
    return ((new glVector2f(b)).sub(a)).squaredLength();
}

glVector2f.dot = function(a, b) {    
    return (a.x * b.x + a.y * b.y);
}

glVector2f.cross = function(a, b) {
    return (a.x * b.y - a.y * b.x);
}

glVector2f.random = function(a, b)
{    
    return glVector2f.normalize((-1.0 + 2.0 * Math.random()), 
                                (-1.0 + 2.0 * Math.random()));
}

