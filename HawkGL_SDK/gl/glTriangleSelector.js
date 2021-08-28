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

let glTriangleSelector = function()
{
    this.__triangles = [];

    this.__multiselect = false;
    this.__selectionID = 0;
    
    this.__spacePartitions = new Map();
    this.__voxelsSize = 0.0;
    this.__ready = false;
}

glTriangleSelector.Triangle = function(p0, p1, p2)
{
    this.__is_glTriangleSelectorTriangle = true;

    this.vertices = new Array(3);
    this.__edges  = new Array(3);
    this.__dot    = new Array(3);

    if(p0.__is_glTriangleSelectorTriangle)
    {
        let other = p0;

        this.vertices[0] = new glVector3f(other.vertices[0]);
        this.vertices[1] = new glVector3f(other.vertices[1]);
        this.vertices[2] = new glVector3f(other.vertices[2]);

        this.__edges[0] = new glVector3f(other.__edges[0]);
        this.__edges[1] = new glVector3f(other.__edges[1]);
        this.__edges[2] = new glVector3f(other.__edges[2]);

        this.normal = new glVector3f(other.normal);
        this.area = other.area;

        this.__dot[0] = other.__dot[0];
        this.__dot[1] = other.__dot[1];
        this.__dot[2] = other.__dot[2];
        
        this.__invDenom = other.__invDenom;
       
        this.center = new glVector3f(other.center);
        this.boundingRadius = other.boundingRadius;
    }
    else
    {
        this.vertices[0] = new glVector3f(p0);
        this.vertices[1] = new glVector3f(p1);
        this.vertices[2] = new glVector3f(p2);

        this.__edges[0] = glVector3f.sub(p1, p0);
        this.__edges[1] = glVector3f.sub(p2, p1);
        this.__edges[2] = glVector3f.sub(p2, p0);

        let edge0x2 = glVector3f.cross(this.__edges[0], this.__edges[2]);
        this.normal = glVector3f.normalize(edge0x2);
        this.area = 0.5 * edge0x2.length();

        this.__dot[0] = glVector3f.dot(this.__edges[2], this.__edges[2]);
        this.__dot[1] = glVector3f.dot(this.__edges[2], this.__edges[0]);
        this.__dot[2] = glVector3f.dot(this.__edges[0], this.__edges[0]);
        
        this.__invDenom = (this.__dot[0] * this.__dot[2] - this.__dot[1] * this.__dot[1]);
        if(this.__invDenom != 0.0) this.__invDenom = 1.0 / this.__invDenom;

        let toCircumsphereCenter = glVector3f.div(glVector3f.cross(edge0x2, this.__edges[0]).mul(this.__edges[2].squaredLength()).add(glVector3f.cross(this.__edges[2], edge0x2).mul(this.__edges[0].squaredLength())), 2.0 * edge0x2.squaredLength());
        this.center = glVector3f.add(p0, toCircumsphereCenter);
        this.boundingRadius = toCircumsphereCenter.length();      
    }
}

glTriangleSelector.Triangle.prototype.distance = function(p) // https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
{
    let ba  = this.__edges[0];
    let cb  = this.__edges[1];
    let ac  = glVector3f.flip(this.__edges[2]);
    let pa  = glVector3f.sub(p, this.vertices[0]);
    let pb  = glVector3f.sub(p, this.vertices[1]);
    let pc  = glVector3f.sub(p, this.vertices[2]);
    let nor = glVector3f.cross(ba, ac);

    return Math.sqrt((Math.sign(glVector3f.dot(glVector3f.cross(ba, nor), pa)) +
                      Math.sign(glVector3f.dot(glVector3f.cross(cb, nor), pb)) +
                      Math.sign(glVector3f.dot(glVector3f.cross(ac, nor), pc)) < 2.0)
                      ? Math.min( Math.min(
                      glVector3f.squaredDistance(glVector3f.mul(ba, Math.min(Math.max(glVector3f.dot(ba, pa) / glVector3f.squaredDistance(ba), 0.0), 1.0)).sub(pa)),
                      glVector3f.squaredDistance(glVector3f.mul(cb, Math.min(Math.max(glVector3f.dot(cb, pb) / glVector3f.squaredDistance(cb), 0.0), 1.0)).sub(pb))),
                      glVector3f.squaredDistance(glVector3f.mul(ac, Math.min(Math.max(glVector3f.dot(ac, pc) / glVector3f.squaredDistance(ac), 0.0), 1.0)).sub(pc)))
                      : glVector3f.dot(nor, pa) * glVector3f.dot(nor, pa) / glVector3f.squaredDistance(nor));
}

glTriangleSelector.Triangle.prototype.fill = function(pointsDistance, callback)
{
    if(pointsDistance <= 0.0 || this.boundingRadius <= 0.0) return;
    
    let lengthSide01 = this.__edges[0].squaredLength();
    let lengthSide21 = this.__edges[1].squaredLength();
    let lengthSide02 = this.__edges[2].squaredLength();

    let longestSideL = lengthSide01;
    let longestSideS = this.vertices[0];
    let longestSideE = this.vertices[1];
    let otherSideE   = this.vertices[2];
    
    if(lengthSide21 > lengthSide01)
    {
        longestSideL = lengthSide21;
        longestSideS = this.vertices[1];
        longestSideE = this.vertices[2];
        otherSideE   = this.vertices[0];
    }

    if(lengthSide02 > lengthSide21)
    {
        longestSideL = lengthSide02;
        longestSideS = this.vertices[2];
        longestSideE = this.vertices[0];
        otherSideE   = this.vertices[1];
    }

    longestSideL = Math.sqrt(longestSideL);
    
    let tangent   = glVector3f.normalize(glVector3f.sub(longestSideE, longestSideS));
    let bitangent = glVector3f.normalize(glVector3f.cross(this.normal, tangent));
    
    if(glVector3f.dot(bitangent, glVector3f.sub(otherSideE, longestSideS)) < 0.0) bitangent.flip();

    tangent.mul(pointsDistance);
    bitangent.mul(pointsDistance);

    let nSideSteps = Math.floor(longestSideL / pointsDistance);
    for(let i = 0; i != nSideSteps; ++i)
    {
        let p = glVector3f.add(longestSideS, glVector3f.mul(tangent, i));

        do
        {
            callback(new glVector3f(p));
            p.add(bitangent);

        } while(this.contains(p));
    }

    callback(new glVector3f(this.vertices[0]));
    callback(new glVector3f(this.vertices[1]));
    callback(new glVector3f(this.vertices[2]));
}

glTriangleSelector.Triangle.prototype.contains = function(p)
{
    if(glVector3f.squaredDistance(p, this.center) >= this.boundingRadius * this.boundingRadius) return false;
    
    let pv0 = glVector3f.sub(p, this.vertices[0]);

    let dotv0 = glVector3f.dot(this.__edges[2], pv0);
    let dotv1 = glVector3f.dot(this.__edges[0], pv0);

    let u = (this.__dot[2] * dotv0 - this.__dot[1] * dotv1) * this.__invDenom;
    let v = (this.__dot[0] * dotv1 - this.__dot[1] * dotv0) * this.__invDenom;
    
    return ((u > 0.0) && (v > 0.0) && (u + v < 1.0));           
}

glTriangleSelector.Triangle.prototype.intersectsAABB = function(aabbCenter, aabbSize)
{
    aabbSize = glVector3f.mul(aabbSize, 0.5);

    // Translate triangle as conceptually moving AABB to origin
    let v0 = glVector3f.sub(this.vertices[0], aabbCenter);
    let v1 = glVector3f.sub(this.vertices[1], aabbCenter);
    let v2 = glVector3f.sub(this.vertices[2], aabbCenter);

    // Compute edge vectors for triangle
    let f0 = this.__edges[0];
    let f1 = this.__edges[1];
    let f2 = glVector3f.flip(this.__edges[2]);

    // Test axis a00
    let a00 = new glVector3f(0.0, -f0.z, f0.y);
    let p0  = glVector3f.dot(v0, a00);
    let p1  = glVector3f.dot(v1, a00);
    let p2  = glVector3f.dot(v2, a00);
    let r   = aabbSize.y * Math.abs(f0.z) + aabbSize.z * Math.abs(f0.y);
    if(Math.max(-Math.max(Math.max(p0, p1), p2), Math.min(Math.min(p0, p1), p2)) > r) return false;

    // Test axis a01
    let a01 = new glVector3f(0.0, -f1.z, f1.y);
    p0 = glVector3f.dot(v0, a01);
    p1 = glVector3f.dot(v1, a01);
    p2 = glVector3f.dot(v2, a01);
    r  = aabbSize.y * Math.abs(f1.z) + aabbSize.z * Math.abs(f1.y);
    if(Math.max(-Math.max(Math.max(p0, p1), p2), Math.min(Math.min(p0, p1), p2)) > r) return false;

    // Test axis a02
    let a02 = new glVector3f(0.0, -f2.z, f2.y);
    p0 = glVector3f.dot(v0, a02);
    p1 = glVector3f.dot(v1, a02);
    p2 = glVector3f.dot(v2, a02);
    r  = aabbSize.y * Math.abs(f2.z) + aabbSize.z * Math.abs(f2.y);
    if(Math.max(-Math.max(Math.max(p0, p1), p2), Math.min(Math.min(p0, p1), p2)) > r) return false;

    // Test axis a10
    let a10 = new glVector3f(f0.z, 0.0, -f0.x);
    p0 = glVector3f.dot(v0, a10);
    p1 = glVector3f.dot(v1, a10);
    p2 = glVector3f.dot(v2, a10);
    r  = aabbSize.x * Math.abs(f0.z) + aabbSize.z * Math.abs(f0.x);
    if(Math.max(-Math.max(Math.max(p0, p1), p2), Math.min(Math.min(p0, p1), p2)) > r) return false;

    // Test axis a11
    let a11 = new glVector3f(f1.z, 0.0, -f1.x);
    p0 = glVector3f.dot(v0, a11);
    p1 = glVector3f.dot(v1, a11);
    p2 = glVector3f.dot(v2, a11);
    r  = aabbSize.x * Math.abs(f1.z) + aabbSize.z * Math.abs(f1.x);
    if(Math.max(-Math.max(Math.max(p0, p1), p2), Math.min(Math.min(p0, p1), p2)) > r) return false;

    // Test axis a12
    a11 = new glVector3f(f2.z, 0.0, -f2.x);
    p0 = glVector3f.dot(v0, a11);
    p1 = glVector3f.dot(v1, a11);
    p2 = glVector3f.dot(v2, a11);
    r = aabbSize.x * Math.abs(f2.z) + aabbSize.z * Math.abs(f2.x);
    if(Math.max(-Math.max(Math.max(p0, p1), p2), Math.min(Math.min(p0, p1), p2)) > r) return false;

    // Test axis a20
    let a20 = new glVector3f(-f0.y, f0.x, 0.0);
    p0 = glVector3f.dot(v0, a20);
    p1 = glVector3f.dot(v1, a20);
    p2 = glVector3f.dot(v2, a20);
    r  = aabbSize.x * Math.abs(f0.y) + aabbSize.y * Math.abs(f0.x);
    if(Math.max(-Math.max(Math.max(p0, p1), p2), Math.min(Math.min(p0, p1), p2)) > r) return false;

    // Test axis a21
    let a21 = new glVector3f(-f1.y, f1.x, 0.0);
    p0 = glVector3f.dot(v0, a21);
    p1 = glVector3f.dot(v1, a21);
    p2 = glVector3f.dot(v2, a21);
    r = aabbSize.x *  Math.abs(f1.y) + aabbSize.y * Math.abs(f1.x);
    if(Math.max(-Math.max(Math.max(p0, p1), p2), Math.min(Math.min(p0, p1), p2)) > r) return false;

    // Test axis a22
    let a22 = new glVector3f(-f2.y, f2.x, 0.0);
    p0 = glVector3f.dot(v0, a22);
    p1 = glVector3f.dot(v1, a22);
    p2 = glVector3f.dot(v2, a22);
    r  = aabbSize.x * Math.abs(f2.y) + aabbSize.y * Math.abs(f2.x);
    if(Math.max(-Math.max(Math.max(p0, p1), p2), Math.min(Math.min(p0, p1), p2)) > r) return false;

    // region Test the three axes corresponding to the face normals of AABB b (category 1)
    if(Math.max(Math.max(v0.x, v1.x), v2.x) < -aabbSize.x || Math.min(Math.min(v0.x, v1.x), v2.x) > aabbSize.x) return false;
    if(Math.max(Math.max(v0.y, v1.y), v2.y) < -aabbSize.y || Math.min(Math.min(v0.y, v1.y), v2.y) > aabbSize.y) return false;
    if(Math.max(Math.max(v0.z, v1.z), v2.z) < -aabbSize.z || Math.min(Math.min(v0.z, v1.z), v2.z) > aabbSize.z) return false;

    // region Test separating axis corresponding to triangle face normal (category 2)
    let plane_distance = glVector3f.dot(this.normal, v0);
    r = aabbSize.x * Math.abs(this.normal.x) + aabbSize.y * Math.abs(this.normal.y) + aabbSize.z * Math.abs(this.normal.z);

    return (plane_distance <= r);
}

glTriangleSelector.Triangle.prototype.intersectsRay = function(rayOrigin, rayDir, intersection)
{
    let rov0 = glVector3f.sub(rayOrigin, this.vertices[0]);

    let q = glVector3f.cross(rov0, rayDir);
    let n = glVector3f.cross(this.__edges[0], this.__edges[2]);
    let d = 1.0 / glVector3f.dot(rayDir, n);

    let u = d * -glVector3f.dot(q, this.__edges[2]);
    let v = d * +glVector3f.dot(q, this.__edges[0]);
    let t = d * -glVector3f.dot(n, rov0);
    
    if(t < 0.0 || u < 0.0 || u > 1.0 || v < 0.0 || (u + v) > 1.0) return false;

    if(intersection != null) intersection.set(glVector3f.add(rayOrigin, glVector3f.mul(rayDir, t)));

    return true;
}

glTriangleSelector.Triangle.prototype.intersectsLine = function(lineOrigin, lineEnd, intersection)
{
    let lineDir = glVector3f.sub(lineEnd, lineOrigin);
    let lineLength = lineDir.length();
    if(lineLength > 0.0) lineDir.div(lineLength);

    let intersectionPoint = new glVector3f(0.0);
    if(!this.intersectsRay(lineOrigin, lineDir, intersectionPoint)) return false;

    if(glVector3f.squaredDistance(lineOrigin, intersectionPoint) >= (lineLength * lineLength)) return false;

    if(intersection != null) intersection.set(intersectionPoint);

    return true;
}

glTriangleSelector.Triangle.prototype.intersectsSphere = function(center, radius, contactPoint)
{
    let dist = glVector3f.dot(glVector3f.sub(center, this.vertices[0]), this.normal);
    
    //ifdoubleSided &&*/  dist < 0.0) return false;
    if(dist < -radius || dist > radius) return false;

    let point0 = glVector3f.sub(center, glVector3f.mul(this.normal, dist));
    
    let c0 = glVector3f.cross(glVector3f.sub(point0, this.vertices[0]), this.__edges[0]);
    let c1 = glVector3f.cross(glVector3f.sub(point0, this.vertices[1]), this.__edges[1]);
    let c2 = glVector3f.cross(glVector3f.sub(point0, this.vertices[2]), glVector3f.flip(this.__edges[2]));
    
    if(glVector3f.dot(c0, this.normal) <= 0.0 && glVector3f.dot(c1, this.normal) <= 0.0 && glVector3f.dot(c2, this.normal) <= 0.0)
    {
        if(contactPoint != null) contactPoint.set(point0);
        return true;
    }

    let edgesIntersections = 0;
    let radiusSquared = radius * radius;
    
    if(contactPoint != null) contactPoint.set(0.0);
    
    for(let i = 0; i < 3; ++i)
    {
        let point = glTriangleSelector.__closestPointOnLine(center, this.vertices[i], this.vertices[(i + 1) % 3]);

        if(glVector3f.squaredDistance(center, point) < radiusSquared)
        {
            if(contactPoint != null) contactPoint.add(point);
            ++edgesIntersections;
        }
    }

    if(contactPoint != null && edgesIntersections > 1) contactPoint.div(edgesIntersections);

    return (edgesIntersections > 0);
}

glTriangleSelector.Triangle.prototype.intersectsCapsule = function(startPoint, endPoint, radius, contactPoint)
{
    let capsuleNormal = glVector3f.normalize(glVector3f.sub(endPoint, startPoint)); 
    let lineEndOffset = glVector3f.mul(capsuleNormal, radius);
    let a = glVector3f.add(startPoint, lineEndOffset); 
    let b = glVector3f.sub(endPoint, lineEndOffset);
    
    let t = glVector3f.dot(this.normal, glVector3f.sub(this.vertices[0], startPoint).div(Math.abs(glVector3f.dot(this.normal, capsuleNormal))));
    
    let line_plane_intersection = glVector3f.add(startPoint, glVector3f.mul(capsuleNormal, t));
    
    let reference_point = new glVector3f(line_plane_intersection);
    
    let c0 = glVector3f.cross(glVector3f.sub(line_plane_intersection, this.vertices[0]), this.__edges[0]);
    let c1 = glVector3f.cross(glVector3f.sub(line_plane_intersection, this.vertices[1]), this.__edges[1]);
    let c2 = glVector3f.cross(glVector3f.sub(line_plane_intersection, this.vertices[2]), glVector3f.flip(this.__edges[2]));
    
    let s1 = (glVector3f.dot(c0, this.normal) <= 0.0);
    let s2 = (glVector3f.dot(c1, this.normal) <= 0.0);
    let s3 = (glVector3f.dot(c2, this.normal) <= 0.0);
    
    if(s1 == s2 && s2 == s3)
    {
        for(let i = 0, closestSquaredDistance = null; i < 3; ++i)
        {
            let point = glTriangleSelector.__closestPointOnLine(line_plane_intersection, this.vertices[i], this.vertices[(i + 1) % 3]);

            let squaredDistance = glVector3f.squaredDistance(line_plane_intersection, point);
            if(closestSquaredDistance == null || squaredDistance < closestSquaredDistance)
            {
                closestSquaredDistance = squaredDistance;
                reference_point.set(point);
            }
        }
    }
    
    let center = glTriangleSelector.__closestPointOnLine(reference_point, a, b);
    
    return this.intersectsSphere(center, radius, contactPoint);
}

glTriangleSelector.Triangle.prototype.inRange = function(p, range)
{
    let rSum = (this.boundingRadius + range);
    return (glVector3f.squaredDistance(p, this.center) < rSum * rSum);
}

glTriangleSelector.prototype.__getVoxelCoords = function(p)
{        
    let voxelsHalfSize = this.__voxelsSize * 0.5;
    
    return new glVector3f( Math.floor((p.x + voxelsHalfSize) / this.__voxelsSize),
                           Math.floor((p.y + voxelsHalfSize) / this.__voxelsSize),
                           Math.floor((p.z + voxelsHalfSize) / this.__voxelsSize) );
}

glTriangleSelector.__hash3D = function(p) {
    return (7385609 * p.x + 19349663 * p.y + 83492791 * p.z);
}

glTriangleSelector.prototype.__getVoxel = function(voxelCoords, createIfEmpty)
{
    let voxelHash = glTriangleSelector.__hash3D(voxelCoords);

    let voxel = this.__spacePartitions.get(voxelHash);
    if(voxel == null && createIfEmpty) this.__spacePartitions.set(voxelHash, (voxel = []));

    return voxel;
}

glTriangleSelector.prototype.__marchVoxel = function(rayOrigin, rayDir)
{
    let voxelSize = new glVector3f(this.__voxelsSize);
    let halfVoxelSize = glVector3f.mul(voxelSize, 0.5);

    let voxelCoords = this.__getVoxelCoords(rayOrigin);

    let center = glVector3f.mul(voxelCoords, voxelSize);
    let vmin   = glVector3f.sub(center, halfVoxelSize);
    let vmax   = glVector3f.add(center, halfVoxelSize);

    let t1 = (vmin.x - rayOrigin.x) / rayDir.x;
    let t2 = (vmax.x - rayOrigin.x) / rayDir.x;
    let t3 = (vmin.y - rayOrigin.y) / rayDir.y;
    let t4 = (vmax.y - rayOrigin.y) / rayDir.y;
    let t5 = (vmin.z - rayOrigin.z) / rayDir.z;
    let t6 = (vmax.z - rayOrigin.z) / rayDir.z;
 // let t7 = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    let t8 = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
 // let t9 = (t8 < 0.0 || t7 > t8) ? 0.0 : t7;

    rayOrigin.add(glVector3f.mul(rayDir, t8 * 1.0000001));

    return voxelCoords;
}

glTriangleSelector.prototype.__voxelDistance = function(voxelCoords, p)
{
    let voxelSize = new glVector3f(this.__voxelsSize);
    let voxelPosition = glVector3f.mul(voxelCoords, voxelSize);
    
    let q = glVector3f.abs(glVector3f.sub(p, voxelPosition)).sub(glVector3f.mul(voxelSize, 0.5));

    return Math.max((glVector3f.max(q, new glVector3f(0.0))).length() + Math.min(Math.max(q.x, Math.max(q.y, q.z)), 0.0), 0.0);
}

glTriangleSelector.prototype.__voxelizeRay = function(rayOrigin, rayEnd, callback)
{
    let rayPos = new glVector3f(rayOrigin);
    let rayDir = glVector3f.sub(rayEnd, rayPos);
    if(rayDir.squaredLength() > 0.0) rayDir.normalize();
    
    let currVoxelCoords = null;
    let lastVoxelCoords = this.__getVoxelCoords(rayEnd);

    do
    {
        currVoxelCoords = this.__marchVoxel(rayPos, rayDir);
        if(callback(currVoxelCoords) === false) break;

    } while(!glVector3f.equals(currVoxelCoords, lastVoxelCoords));
}

glTriangleSelector.prototype.__voxelizeAABB = function(aabb, callback)
{
    let halfSize = glVector3f.mul(aabb.size, 0.5);

    let min = this.__getVoxelCoords(glVector3f.sub(aabb.position, halfSize));
    let max = this.__getVoxelCoords(glVector3f.add(aabb.position, halfSize));
    
    let nStepsX = ((max.x - min.x) + 1);
    let nStepsY = ((max.y - min.y) + 1);
    let nStepsZ = ((max.z - min.z) + 1);
    
    let nSteps = (nStepsX * nStepsY * nStepsZ);

    for(let x = 0, y, z, voxelCoords = new glVector3f(); x < nSteps; ++x)
    {
        y = Math.floor(x / nStepsX);
        z = Math.floor(y / nStepsY);

        voxelCoords.x = (min.x + (x % nStepsX));
        voxelCoords.y = (min.y + (y % nStepsY));
        voxelCoords.z = (min.z + (z % nStepsZ));
        
        if(callback(voxelCoords) === false) break;
    }
}

glTriangleSelector.prototype.__voxelizeSphere = function(p, radius, callback)
{
    if(radius > 0.0)
    {
        let aabb = new glAABB();
    
        aabb.fit(glVector3f.add(p, new glVector3f(radius)));
        aabb.fit(glVector3f.sub(p, new glVector3f(radius)));

        let self = this;
        this.__voxelizeAABB(aabb, function(voxelCoords) {
            if(self.__voxelDistance(voxelCoords, p) <= radius) return callback(voxelCoords);
        });
    }
}

glTriangleSelector.__capsuleDistance = function(p, a, b, r)
{
    let pa = glVector3f.sub(p, a);
    let ba = glVector3f.sub(b, a);

    let h = Math.min(Math.max(glVector3f.dot(pa, ba) / glVector3f.dot(ba, ba), 0.0), 1.0);

    return (glVector3f.sub(pa, glVector3f.mul(ba, h))).length() - r;
}

glTriangleSelector.__closestPointOnLine = function(p, a, b)
{
  let ab = glVector3f.sub(b, a);
  let lSquared = ab.squaredLength();

  let t = ((lSquared > 0.0) ? (glVector3f.dot(glVector3f.sub(p, a), ab) / lSquared) : 0.0);

  return glVector3f.add(a, glVector3f.mul(ab, Math.min(Math.max(t, 0.0), 1.0)));
}

glTriangleSelector.prototype.__voxelizeCapsule = function(capsuleStart, capsuleEnd, radius, callback)
{
    if(radius > 0.0)
    {
        let aabb = new glAABB();
    
        aabb.fit(glVector3f.add(capsuleStart, new glVector3f(radius)));
        aabb.fit(glVector3f.sub(capsuleStart, new glVector3f(radius)));
        aabb.fit(glVector3f.add(capsuleEnd,   new glVector3f(radius)));
        aabb.fit(glVector3f.sub(capsuleEnd,   new glVector3f(radius)));

        let self = this;
        this.__voxelizeAABB(aabb, function(voxelCoords)
        {
            let voxelPosition = glVector3f.mul(voxelCoords, self.__voxelsSize);
            if(glTriangleSelector.__capsuleDistance(voxelPosition, capsuleStart, capsuleEnd, radius) <= self.__voxelsSize) return callback(voxelCoords);
        });
    }
}

glTriangleSelector.prototype.__voxelizeTriangle = function(triangle, callback)
{
    let aabb = new glAABB();
    
    aabb.fit(triangle.vertices[0]);
    aabb.fit(triangle.vertices[1]);
    aabb.fit(triangle.vertices[2]);
    
    let voxelsSize = new glVector3f(this.__voxelsSize);

    this.__voxelizeAABB(aabb, function(voxelCoords)
    {
        let voxelPosition = glVector3f.mul(voxelCoords, voxelsSize);
        if(triangle.intersectsAABB(voxelPosition, voxelsSize)) return callback(voxelCoords);
    });
}

glTriangleSelector.prototype.__updateTriangles = function(meshData)
{
    if(meshData.__is_glPrimitive) meshData = meshData.__vertices;

    let nVertices = meshData.length;
    if(nVertices > 0 && (nVertices % 3) == 0)
    {  
        let nTriangles = (nVertices / 3);
        this.__triangles = new Array(nTriangles);
            
        for(let triangleID = 0; triangleID != nTriangles; ++triangleID)
        {
            this.__triangles[triangleID] = new glTriangleSelector.Triangle( meshData[triangleID * 3 + 0].position,
                                                                            meshData[triangleID * 3 + 1].position, 
                                                                            meshData[triangleID * 3 + 2].position );
        }
    }
}

glTriangleSelector.prototype.__updateSpacePartitions = function(voxelsSize)
{
    this.__spacePartitions.clear();
    this.__voxelsSize = voxelsSize;

    for(let self = this, triangleID = 0, nTriangles = this.__triangles.length; triangleID != nTriangles; ++triangleID)
    {
        this.__voxelizeTriangle(this.__triangles[triangleID], function(voxelCoords) {
            (self.__getVoxel(voxelCoords, true)).push(triangleID);
        });
    }

    this.__spacePartitions.forEach( function(voxel, hash, spacePartitions) {
        spacePartitions.set(hash, new Uint32Array(voxel));
    });

    this.__ready = true;
}

glTriangleSelector.prototype.set = function(meshData, voxelsSize)
{
    this.__updateTriangles(meshData);
    this.__updateSpacePartitions(voxelsSize);
}

glTriangleSelector.prototype.setAsync = function(meshData, voxelsSize, onFinish)
{
    let self = this;

    this.__ready = false;
    this.__spacePartitions.clear();
    
    this.__updateTriangles(meshData);
    this.__voxelsSize = voxelsSize;
        
    let task = new Task([ HawkGL_SDK_relativePath + "gl/glPrimitive.js",  
                          HawkGL_SDK_relativePath + "gl/glMesh.js", 
                          HawkGL_SDK_relativePath + "gl/glVector3f.js",
                          HawkGL_SDK_relativePath + "gl/glAABB.js",  
                          HawkGL_SDK_relativePath + "gl/glTriangleSelector.js" ], 
                               
    function(params)
    {
        let triangleSelector = new glTriangleSelector();

        let nTriangles = params.triangles.length;
        triangleSelector.__triangles = new Array(nTriangles);
        for(let i = 0; i != nTriangles; ++i) triangleSelector.__triangles[i] = new glTriangleSelector.Triangle(params.triangles[i]);

        triangleSelector.__updateSpacePartitions(params.voxelsSize);

        finish(triangleSelector.__spacePartitions);
    });

    task.onFinish( function(spacePartitions)
    {
        self.__spacePartitions = spacePartitions;
        self.__ready = true;

        if(onFinish != null) onFinish(self);
    });

    task.run({triangles: this.__triangles, voxelsSize: voxelsSize});
}

glTriangleSelector.prototype.multiSelectBegin = function()
{
    this.__multiselect = true;
    ++this.__selectionID;
}

glTriangleSelector.prototype.multiSelectEnd = function()
{
    this.__multiselect = false;
    ++this.__selectionID;
}

glTriangleSelector.prototype.selectFromAABB = function(aabb, callback)
{
    if(this.ready() && !this.empty() && !aabb.empty())
    {
        let self = this;
          
        if(!this.__multiselect) ++this.__selectionID;

        this.__voxelizeAABB(aabb, function(voxelCoords)
        {
            let voxel = self.__getVoxel(voxelCoords, false);
            if(voxel != null) for(let i = 0, e = voxel.length; i != e; ++i)
            {
                let triangle = self.__triangles[voxel[i]];
                if(triangle.lastSelectionID != self.__selectionID)
                {
                    triangle.lastSelectionID = self.__selectionID;

                    if(callback(triangle) === false) return false;
                }
            }
        });
    }
}

glTriangleSelector.prototype.selectFromSphere = function(p, radius, callback)
{
    if(this.ready() && !this.empty() && radius > 0.0)
    {
        let aabb = new glAABB();
    
        aabb.fit(glVector3f.add(p, new glVector3f(radius)));
        aabb.fit(glVector3f.sub(p, new glVector3f(radius)));

        if(!this.__multiselect) ++this.__selectionID;
        
        let intersectionPoint = new glVector3f();
                        
        let self = this;
        this.__voxelizeAABB(aabb, function(voxelCoords)
        {
            let voxel = self.__getVoxel(voxelCoords, false);
            if(voxel != null && self.__voxelDistance(voxelCoords, p) <= radius) for(let i = 0, e = voxel.length; i != e; ++i)
            {
                let triangle = self.__triangles[voxel[i]];
                if(triangle.lastSelectionID != self.__selectionID)
                {
                    triangle.lastSelectionID = self.__selectionID;

                    if(triangle.inRange(p, radius))
                    {
                        if(triangle.intersectsSphere(p, radius, intersectionPoint)) {
                            return callback(triangle, intersectionPoint);
                        }
                    }    
                }
            }
        });
    }
}

glTriangleSelector.prototype.selectFromRay = function(rayOrigin, rayEnd, callback)
{
    let self = this;
    let voxelIntersectionsInfo = [];
    let intersectionPoint = new glVector3f(0.0);
    
    if(!this.__multiselect) ++this.__selectionID;

    function closestIntersectionInfo(a, b)
    {
        let sda = glVector3f.squaredDistance(rayOrigin, a.intersectionPoint);
        let sdb = glVector3f.squaredDistance(rayOrigin, b.intersectionPoint);
        
        return ((sda > sdb) ? 1 : ((sdb > sda) ? -1 : 0));
    }

    this.__voxelizeRay(rayOrigin, rayEnd, function(voxelCoords)
    {
        let voxel = self.__getVoxel(voxelCoords, false);
        if(voxel != null) 
        {
            voxelIntersectionsInfo.length = 0;

            for(let i = 0, e = voxel.length; i != e; ++i)
            {
                let triangle = self.__triangles[voxel[i]];
                if(triangle.lastSelectionID != self.__selectionID)
                {
                    triangle.lastSelectionID = self.__selectionID;

                    if(triangle.intersectsLine(rayOrigin, rayEnd, intersectionPoint)) {
                        voxelIntersectionsInfo.push({ triangle: triangle, intersectionPoint: new glVector3f(intersectionPoint) });    
                    }
                }
            }

            voxelIntersectionsInfo.sort(closestIntersectionInfo);

            for(let i = 0, e = voxelIntersectionsInfo.length; i != e; ++i)
            {
                let intersectionInfo = voxelIntersectionsInfo[i];
                if(callback(intersectionInfo.triangle, intersectionInfo.intersectionPoint) === false) return false;
            }
        }
    });
}

glTriangleSelector.prototype.selectFromCapsule = function(capsuleStart, capsuleEnd, radius, callback)
{
    let self = this;
    let voxelIntersectionsInfo = [];
    let intersectionPoint  = new glVector3f(0.0);
    
    if(!this.__multiselect) ++this.__selectionID;

    function closestIntersectionInfo(a, b)
    {
        let sda = glVector3f.squaredDistance(capsuleStart, a.intersectionPoint);
        let sdb = glVector3f.squaredDistance(capsuleStart, b.intersectionPoint);
        
        return ((sda > sdb) ? 1 : ((sdb > sda) ? -1 : 0));
    }

    this.__voxelizeCapsule(capsuleStart, capsuleEnd, radius, function(voxelCoords)
    {
        let voxel = self.__getVoxel(voxelCoords, false);
        if(voxel != null) 
        {
            voxelIntersectionsInfo.length = 0;

            for(let i = 0, e = voxel.length; i != e; ++i)
            {
                let triangle = self.__triangles[voxel[i]];
                if(triangle.lastSelectionID != self.__selectionID)
                {
                    triangle.lastSelectionID = self.__selectionID;

                    if(triangle.intersectsCapsule(capsuleStart, capsuleEnd, radius, intersectionPoint, intersectionSphere)) {
                        voxelIntersectionsInfo.push({ triangle: triangle, intersectionPoint: new glVector3f(intersectionPoint) });    
                    }
                }
            }

            voxelIntersectionsInfo.sort(closestIntersectionInfo);

            for(let i = 0, e = voxelIntersectionsInfo.length; i != e; ++i)
            {
                let intersectionInfo = voxelIntersectionsInfo[i];  
                if(callback(intersectionInfo.triangle, intersectionInfo.intersectionPoint) === false) return false;
            }
        }
    });
}

glTriangleSelector.prototype.ready = function() {
    return this.__ready;
}

glTriangleSelector.prototype.size = function() {
    return this.__triangles.length;
}

glTriangleSelector.prototype.empty = function() {
    return (this.size() == 0);
}
