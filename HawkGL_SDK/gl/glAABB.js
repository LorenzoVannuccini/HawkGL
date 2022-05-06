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

let glAABB = function(position, size)
{
    this.__is_glAABB = true;
    
    this.clear();

    if(position != null) this.set(position, size);
}

glAABB.__cornerKernel = [ new glVector3f(+0.5, +0.5, +0.5),
                          new glVector3f(+0.5, +0.5, -0.5),
                          new glVector3f(+0.5, -0.5, +0.5),
                          new glVector3f(+0.5, -0.5, -0.5),
                          new glVector3f(-0.5, +0.5, +0.5),
                          new glVector3f(-0.5, +0.5, -0.5),
                          new glVector3f(-0.5, -0.5, +0.5),
                          new glVector3f(-0.5, -0.5, -0.5) ];

glAABB.prototype.set = function(position, size)
{
    if(position.__is_glAABB)
    {
        let aabb = position;

        position = aabb.position;
        size = aabb.size;
    }

    this.position.set(position);
    this.size.set(size);

    this.__empty = false;
}

glAABB.prototype.clear = function()
{
    this.size     = new glVector3f(0.0);
    this.position = new glVector3f(0.0);

    this.__empty = true;
}

glAABB.prototype.empty = function() {
    return this.__empty;
}

glAABB.prototype.fit = function(other)
{
    if(other.__is_glAABB) this.__fit_aabb(other);
    else if(other.__is_glVector3f) this.__fit_vec3(other);
}

glAABB.prototype.__fit_vec3 = function(point) 
{
    if(!this.empty())
    {
        let halfSize = glVector3f.mul(this.size, 0.5);
        
        let aabbMin = glVector3f.min(glVector3f.sub(this.position, halfSize), point);
        let aabbMax = glVector3f.max(glVector3f.add(this.position, halfSize), point);
    
        this.size = glVector3f.abs(glVector3f.sub(aabbMax, aabbMin));
        this.position = glVector3f.add(aabbMin, aabbMax).mul(0.5);
        
    } else this.set(point, new glVector3f(0.0));

    this.__empty = false;
}

glAABB.prototype.__fit_aabb = function(aabb) {
    for(let i = 0; i < 8; ++i) this.__fit_vec3(glVector3f.add(aabb.position, glVector3f.mul(aabb.size, glAABB.__cornerKernel[i])));
}

glAABB.prototype.contains = function(other)
{
    if(other.__is_glAABB) return this.__contains_aabb(other);
    else if(other.__is_glVector3f) return this.__contains_vec3(other);
}

glAABB.prototype.__contains_vec3 = function(point) 
{
    if(this.empty()) return false;
    
    let halfSize = glVector3f.mul(this.size, 0.5);
    let clampedPoint = glVector3f.max(glVector3f.sub(this.position, halfSize), glVector3f.min(glVector3f.add(this.position, halfSize), point));

    return clampedPoint.equals(point);
}

glAABB.prototype.__contains_aabb = function(aabb) 
{
    if(this.empty() || aabb.empty()) return false;
    
    for(let i = 0; i < 8; ++i)
    {
        let cornerA = glVector3f.add(this.position, glVector3f.mul(this.size, glAABB.__cornerKernel[i]));
        let cornerB = glVector3f.add(aabb.position, glVector3f.mul(aabb.size, glAABB.__cornerKernel[i]));
    
        if(this.__contains_vec3(cornerB) || aabb.__contains_vec3(cornerA)) return true;
    }

    return false;
}

glAABB.prototype.transform = function(matrix)
{
    if(!this.empty())
    {
        let aabbMin = new glVector3f(0.0);
        let aabbMax = new glVector3f(0.0);

        for(let i = 0; i < 8; ++i)
        {
            let corner = matrix.mul(glVector3f.add(this.position, glVector3f.mul(this.size, glAABB.__cornerKernel[i])));

            if(i == 0)
            {
                aabbMin.set(corner);
                aabbMax.set(corner);
            }
            else
            {
                aabbMin.x = Math.min(aabbMin.x, corner.x);
                aabbMin.y = Math.min(aabbMin.y, corner.y);
                aabbMin.z = Math.min(aabbMin.z, corner.z);

                aabbMax.x = Math.max(aabbMax.x, corner.x);
                aabbMax.y = Math.max(aabbMax.y, corner.y);
                aabbMax.z = Math.max(aabbMax.z, corner.z);
            }
        }

        this.size = glVector3f.abs(glVector3f.sub(aabbMax, aabbMin));
        this.position = glVector3f.add(aabbMin, aabbMax).mul(0.5);
    }

    return this;
}
