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

let glCamera = function(x, y, z, pitch, yaw, roll) 
{
    this.__position     = new glVector3f();
    this.__pitchYawRoll = new glVector3f();

    this.setPosition(x, y, z);
    this.setOrientation(pitch, yaw, roll);

    this.update();    
}

glCamera.__PI = 3.14159265358979323846;
glCamera.__180overPI = (180.0 / glCamera.__PI);
glCamera.__PIover180 = (glCamera.__PI / 180.0);

glCamera.__orientationDifference = function(targetPitchYawRoll, currentPitchYawRoll) {
    return glVector3f.sub(targetPitchYawRoll, currentPitchYawRoll).add(180.0).mod(360.0).sub(180.0);
}

glCamera.prototype.update = function(dt, stiffness)
{
    if(dt == null) dt = 1.0;
    if(stiffness == null) stiffness = 1.0;
    
    dt = Math.min(Math.max(dt * stiffness * 10.0, 0.0), 1.0);
    
    this.__position.add(glVector3f.sub(this.__targetPosition, this.__position).mul(dt));
    this.__pitchYawRoll.add(glCamera.__orientationDifference(this.__targetPitchYawRoll, this.__pitchYawRoll).mul(dt));
}

glCamera.prototype.move = function(x, y, z) {
    this.__targetPosition.add(x, y, z);
}

glCamera.prototype.moveTo = function(x, y, z) {
    this.__targetPosition.set(x, y, z);
}

glCamera.prototype.getPosition = function() {
    return new glVector3f(this.__position);
}

glCamera.prototype.setPosition = function(x, y, z) {
    this.__targetPosition = new glVector3f(x, y, z);
}

glCamera.prototype.rotate = function(pitch, yaw, roll) {
    this.__targetPitchYawRoll.add(pitch, yaw, roll);
}

glCamera.prototype.lookAt = function(x, y, z) {
    this.setDirection(glVector3f.sub(new glVector3f(x, y, z), this.__position));
}

glCamera.prototype.setDirection = function(x, y, z)
{
    let direction = glVector3f.normalize(x, y, z);

    this.__targetPitchYawRoll.y = Math.atan2(direction.x, -direction.z) * glCamera.__180overPI;
    this.__targetPitchYawRoll.x = Math.asin(-direction.y) * glCamera.__180overPI;
}

glCamera.prototype.setOrientation = function(pitch, yaw, roll) {
    this.__targetPitchYawRoll = new glVector3f(pitch, yaw, roll);
}

glCamera.prototype.getOrientationMatrix4x4f = function() 
{
    let matrix = new glMatrix4x4f();

    matrix.mul(glMatrix4x4f.rotationMatrix(this.__pitchYawRoll.x, 1.0, 0.0, 0.0));
    matrix.mul(glMatrix4x4f.rotationMatrix(this.__pitchYawRoll.y, 0.0, 1.0, 0.0));
    matrix.mul(glMatrix4x4f.rotationMatrix(this.__pitchYawRoll.z, 0.0, 0.0, 1.0));
    
    return matrix;
}

glCamera.prototype.getDirection = function()  {
    return glVector3f.normalize(glMatrix4x4f.inverse(this.getOrientationMatrix4x4f()).mul(new glVector3f(0.0, 0.0, -1.0)));
}

glCamera.prototype.getMatrix4x4f = function() 
{
    let matrix = this.getOrientationMatrix4x4f();
    matrix.mul(glMatrix4x4f.translationMatrix(glVector3f.flip(this.__position)));
    
    return matrix;
}

glCamera.prototype.getPitch = function() {
    return this.__pitchYawRoll.x;
}

glCamera.prototype.getYaw = function() {
    return this.__pitchYawRoll.y;
}

glCamera.prototype.getRoll = function() {
    return this.__pitchYawRoll.z;
}

// ----------------------------------------------------------------------------------------

let glArcBallCamera = function(ctx, radius)
{
    this.__ctx = ctx;

    this.__dragCoords   = new glVector2f(0.0);
    this.__targetCoords = new glVector2f(0.0);

    this.__orientation = new glQuaternion();
    
    this.setRadius(((radius != null) ? radius : 1.0));
    this.update();
}

glArcBallCamera.__PI = 3.14159265358979323846;
glArcBallCamera.__180overPI = (180.0 / glArcBallCamera.__PI);
glArcBallCamera.__PIover180 = (glArcBallCamera.__PI / 180.0);

glArcBallCamera.prototype.setRadius = function(radius) {
    this.__radius = radius;
}

glArcBallCamera.prototype.update = function(stiffness)
{
    if(stiffness == null) stiffness = 1.0;

    this.__viewport         = this.__ctx.getViewport();  
    this.__modelViewMatrix  = this.__ctx.getModelViewMatrix();
    this.__projectionMatrix = this.__ctx.getProjectionMatrix();
    
    let dragStep = glVector2f.sub(this.__targetCoords, this.__dragCoords).mul(Math.min(Math.max(stiffness, 0.0), 1.0));

    this.__dragCoords.add(Math.pow(Math.abs(dragStep.x), (2.0 - stiffness)) * Math.sign(dragStep.x),
                          Math.pow(Math.abs(dragStep.y), (2.0 - stiffness)) * Math.sign(dragStep.y));  
        
    let dragVector = glVector3f.normalize(this.__dragCoords.x, this.__dragCoords.y, Math.sqrt(Math.max(1.0 - this.__dragCoords.squaredLength(), 0.25)));

    if(this.__dragAnchor != null) 
    {
        let rotationAxis = glVector3f.normalize(glVector3f.cross(this.__dragAnchor, dragVector));
        if(rotationAxis.squaredLength() > 0.0)
        {
            let rotationAngleRadians = glQuaternion.__safeAcos(glVector3f.dot(this.__dragAnchor, dragVector));
            let rotationAngleDegrees = rotationAngleRadians * glArcBallCamera.__180overPI;
            
            this.__orientation.rotate(rotationAxis, rotationAngleDegrees);
        }
    }

    this.__dragAnchor = dragVector;
}

glArcBallCamera.prototype.__sphereToScreenRect = function(position, radius)
{
    let center = this.__modelViewMatrix.mul(position);
    
    let d2 = center.squaredLength();
    let a = Math.sqrt(d2 - radius * radius);

    let right = glVector3f.mul(new glVector3f(-center.z, 0, center.x), (radius / a));
    let up = new glVector3f(0.0, radius, 0.0);
    
    let projectedUp     = this.__projectionMatrix.mul(new glVector4f(up.x,     up.y,     up.z,     0.0));
    let projectedRight  = this.__projectionMatrix.mul(new glVector4f(right.x,  right.y,  right.z,  0.0));
    let projectedCenter = this.__projectionMatrix.mul(new glVector4f(center.x, center.y, center.z, 1.0));
    
    let north  = glVector4f.add(projectedCenter, projectedUp);
    let east   = glVector4f.add(projectedCenter, projectedRight);
    let south  = glVector4f.sub(projectedCenter, projectedUp);
    let west   = glVector4f.sub(projectedCenter, projectedRight);

    north.div(north.w);
    east.div(east.w);
    west.div(west.w);
    south.div(south.w);
    
    let rectMin = new glVector2f(Math.min(Math.min(Math.min(east.x, west.x), north.x), south.x), Math.min(Math.min(Math.min(east.y, west.y), north.y), south.y));
    let rectMax = new glVector2f(Math.max(Math.max(Math.max(east.x, west.x), north.x), south.x), Math.max(Math.max(Math.max(east.y, west.y), north.y), south.y));

    rectMin = (rectMin.mul(0.5).add(0.5)).mul(new glVector2f(this.__viewport.w, this.__viewport.h));
    rectMax = (rectMax.mul(0.5).add(0.5)).mul(new glVector2f(this.__viewport.w, this.__viewport.h));

    let rect =
    {
        center: glVector2f.add(rectMin, rectMax).mul(0.5),
        size: glVector2f.sub(rectMax, rectMin)
    };

    return rect;
}

glArcBallCamera.prototype.drag = function(x, y)
{            
    y = (this.__ctx.getClientHeight() - y);

    x = (x / this.__ctx.getClientWidth())  * this.__ctx.getWidth();
    y = (y / this.__ctx.getClientHeight()) * this.__ctx.getHeight();
    
    let rect = this.__sphereToScreenRect(new glVector3f(0.0), this.__radius);

    this.__targetCoords.set((x - rect.center.x) / rect.size.x * 2.0, 
                            (y - rect.center.y) / rect.size.y * 2.0);

    if(!this.__dragging)
    {
        this.__dragCoords.set(this.__targetCoords);
        this.__dragAnchor = null;
    }
    
    this.__dragging = true;
}

glArcBallCamera.prototype.setIdentity = function() {
    this.__orientation.setIdentity();
}

glArcBallCamera.prototype.setOrientation = function(axis, degrees) {
    this.__orientation.setOrientation(axis, degrees);
}

glArcBallCamera.prototype.stopDrag = function() {
    this.__dragAnchor = null;
    this.__dragging = false;
}

glArcBallCamera.prototype.getMatrix4x4f = function() {
    return this.__orientation.toMatrix4x4f();
}

// ----------------------------------------------------------------------------------------

let glCinematicCamera = function(ctx)
{
    this.__ctx = ctx;
    
    this.__primitivePoints    = new glPrimitive(ctx);
    this.__primitiveLineStrip = new glPrimitive(ctx);
    
    this.__program = glCinematicCamera.__genProgram(ctx);
    this.__uniformColor = this.__program.getUniform("color");
    this.__uniformPointSize = this.__program.getUniform("pointSize");
    
    this.__keyframes = [];
    this.__keyframeID = 0;
    this.__time = 0.0;

    this.__transform =
    {
        orientation: new glQuaternion(),
        position:    new glVector3f(0.0),
        matrix:      glMatrix4x4f.identityMatrix(),
    };

    this.__shouldTessellate = false;
    this.__shouldUpdate = false;
    this.__shouldSort = false;
    this.__isPlaying = false;
}

glCinematicCamera.__genProgram = function(ctx)
{
    if(glCinematicCamera.__programInstances == null) glCinematicCamera.__programInstances = new Map();

    let program = glCinematicCamera.__programInstances.get(ctx);
    if(program == null) 
    {
        program = new glProgram(ctx, "#version 300 es                                                            \n" +
                                     "precision highp float;                                                     \n" +
                                     "                                                                           \n" +
                                     "uniform mat4 glModelViewProjectionMatrix;                                  \n" +
                                     "uniform float pointSize;                                                   \n" +
                                     "                                                                           \n" +
                                     "void main()                                                                \n" +
                                     "{                                                                          \n" +
                                     "    gl_PointSize = pointSize;                                              \n" +
                                     "    gl_Position = (glModelViewProjectionMatrix * vec4(glVertex.xyz, 1.0)); \n" +
                                     "}                                                                          \n",
                                     
                                     "#version 300 es                               \n" +
                                     "precision mediump float;                      \n" +
                                     "                                              \n" +
                                     "uniform vec4 color;                           \n" +
                                     "                                              \n" +
                                     "layout(location = 0) out lowp vec4 fragColor; \n" +
                                     "                                              \n" +
                                     "void main() {                                 \n" +
                                     "    fragColor = color;                        \n" +
                                     "}                                             \n");

        program.compile();
        program.createUniformFloat("pointSize", 8.0);
        program.createUniformVec4("color", new glVector4f(1.0));

        glCinematicCamera.__programInstances.set(ctx, program);
    }

    return program;
}

glCinematicCamera.__mix = function(x, y, a) {
    return (x * (1.0 - a) + y * a); 
}

glCinematicCamera.__smoothstep = function(edge0, edge1, x)
{
    let t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0.0), 1.0);
    return t * t * (3.0 - 2.0 * t);
}

glCinematicCamera.__computeSplineTangentsVec3 = function(p0, p1, p2, p3)
{
    let dt0 = Math.pow(glVector3f.squaredDistance(p0, p1), 0.25);
    let dt1 = Math.pow(glVector3f.squaredDistance(p1, p2), 0.25);
    let dt2 = Math.pow(glVector3f.squaredDistance(p2, p3), 0.25);
    
    // safety check for repeated points
    if(dt1 < 1e-4) dt1 = 1.0;
    if(dt0 < 1e-4) dt0 = dt1;
    if(dt2 < 1e-4) dt2 = dt1;
    
    // compute tangents when parameterized in [t1,t2]
    let t0 = glVector3f.sub(p1, p0).div(dt0).sub(glVector3f.sub(p2, p0).div(dt0 + dt1)).add(glVector3f.sub(p2, p1).div(dt1));
    let t1 = glVector3f.sub(p2, p1).div(dt1).sub(glVector3f.sub(p3, p1).div(dt1 + dt2)).add(glVector3f.sub(p3, p2).div(dt2));
    
    // rescale tangents for parametrization in [0,1]
    t0 = glVector3f.mul(t0, new glVector3f(dt1));
    t1 = glVector3f.mul(t1, new glVector3f(dt1));    

    return [t0, t1];
}

glCinematicCamera.__interpolateSplineVec3 = function(p1, p2, tangents, t)
{    
    let t2 = t * t;
    let t3 = t2 * t;

    let c2 = glVector3f.mul(new glVector3f(-3.0), p1).add(glVector3f.mul(new glVector3f(3.0), p2)).sub(glVector3f.mul(new glVector3f(2.0), tangents[0])).sub(tangents[1]);
    let c3 = glVector3f.mul(new glVector3f(+2.0), p1).sub(glVector3f.mul(new glVector3f(2.0), p2)).add(tangents[0]).add(tangents[1]);
    
    return glVector3f.add(p1, glVector3f.mul(tangents[0], t)).add(glVector3f.mul(c2, t2)).add(glVector3f.mul(c3, t3));
}

glCinematicCamera.__computeSplineTangentsQuaternion = function(p0, p1, p2, p3)
{
    p0 = new glVector4f(p0.__x, p0.__y, p0.__z, p0.__w);
    p1 = new glVector4f(p1.__x, p1.__y, p1.__z, p1.__w);
    p2 = new glVector4f(p2.__x, p2.__y, p2.__z, p2.__w);
    p3 = new glVector4f(p3.__x, p3.__y, p3.__z, p3.__w);
       
    let dt0 = Math.pow(glVector4f.squaredDistance(p0, p1), 0.25);
    let dt1 = Math.pow(glVector4f.squaredDistance(p1, p2), 0.25);
    let dt2 = Math.pow(glVector4f.squaredDistance(p2, p3), 0.25);
    
    // safety check for repeated points
    if(dt1 < 1e-4) dt1 = 1.0;
    if(dt0 < 1e-4) dt0 = dt1;
    if(dt2 < 1e-4) dt2 = dt1;
    
    // compute tangents when parameterized in [t1,t2]
    let t0 = glVector4f.sub(p1, p0).div(dt0).sub(glVector4f.sub(p2, p0).div(dt0 + dt1)).add(glVector4f.sub(p2, p1).div(dt1));
    let t1 = glVector4f.sub(p2, p1).div(dt1).sub(glVector4f.sub(p3, p1).div(dt1 + dt2)).add(glVector4f.sub(p3, p2).div(dt2));
    
    // rescale tangents for parametrization in [0,1]
    t0 = glVector4f.mul(t0, new glVector4f(dt1));
    t1 = glVector4f.mul(t1, new glVector4f(dt1));    

    return [t0, t1];
}

glCinematicCamera.__interpolateSplineQuaternion = function(p1, p2, tangents, t)
{    
    let t2 = t * t;
    let t3 = t2 * t;

    p1 = new glVector4f(p1.__x, p1.__y, p1.__z, p1.__w);
    p2 = new glVector4f(p2.__x, p2.__y, p2.__z, p2.__w);

    let c2 = glVector4f.mul(new glVector4f(-3.0), p1).add(glVector4f.mul(new glVector4f(3.0), p2)).sub(glVector4f.mul(new glVector4f(2.0), tangents[0])).sub(tangents[1]);
    let c3 = glVector4f.mul(new glVector4f(+2.0), p1).sub(glVector4f.mul(new glVector4f(2.0), p2)).add(tangents[0]).add(tangents[1]);
    
    let q = new glQuaternion(glVector4f.add(p1, glVector4f.mul(tangents[0], t)).add(glVector4f.mul(c2, t2)).add(glVector4f.mul(c3, t3)));
    q.normalize();

    return q;
}

glCinematicCamera.prototype.__getKeyframeControlPoints = function(keyframeID)
{
    let nKeyframes = this.size();
    
    let kID0 = (keyframeID - 1);
    let kID1 = (keyframeID + 0);
    let kID2 = (keyframeID + 1);
    let kID3 = (keyframeID + 2);

    kID0 = Math.max(kID0, 0);
    kID2 = Math.min(kID2, (nKeyframes - 1));
    kID3 = Math.min(kID3, (nKeyframes - 1));

    return [this.__keyframes[kID0], this.__keyframes[kID1], 
            this.__keyframes[kID2], this.__keyframes[kID3]];
}

glCinematicCamera.prototype.__sort = function()
{
    this.__keyframes.sort( function(a, b)
    {
        if(a.time < b.time) return -1;
        if(b.time < a.time) return +1;
        
        return 0;
    });

    this.__shouldSort = false;
}

glCinematicCamera.prototype.__update = function()
{
    if(this.__shouldSort) this.__sort();

    let nKeyframes  = this.__keyframes.length;
    for(let i = 0; i < nKeyframes; ++i)
    {
        let k = this.__getKeyframeControlPoints(i);

        if(glQuaternion.dot(k[1].orientation, k[2].orientation) < 0.0) k[2].orientation.flip();

        k[1].timeDelta = (k[2].time - k[1].time);
    }

    for(let i = (nKeyframes - 2); i >= 0; --i)
    {
        let k1 = this.__getKeyframeControlPoints(i);
        let k2 = this.__getKeyframeControlPoints(i + 1);

        if(k1[1].timeDelta <= 0.0 || k2[1].timeDelta <= 0.0)
        {
            k1[1].positionAcceleration = k1[1].orientationAcceleration = 0.0;
            continue;
        }

        let dtk1 = Math.min(k1[1].timeDelta * 0.5, 0.0001);
        let dtk2 = Math.min(k2[1].timeDelta * 0.5, 0.0001);

        let tk1 = ((k1[1].timeDelta - dtk1) / k1[1].timeDelta);
        let tk2 = (dtk2 / k2[1].timeDelta);
        
        let tangentsPositionk1 = glCinematicCamera.__computeSplineTangentsVec3(k1[0].position, k1[1].position, k1[2].position, k1[3].position);
        let tangentsPositionk2 = glCinematicCamera.__computeSplineTangentsVec3(k2[0].position, k2[1].position, k2[2].position, k2[3].position);

        let tangentsOrientationk1 = glCinematicCamera.__computeSplineTangentsQuaternion(k1[0].orientation, k1[1].orientation, k1[2].orientation, k1[3].orientation);
        let tangentsOrientationk2 = glCinematicCamera.__computeSplineTangentsQuaternion(k2[0].orientation, k2[1].orientation, k2[2].orientation, k2[3].orientation);
        
        let outerSpeedk1 = glVector3f.distance(k1[2].position, glCinematicCamera.__interpolateSplineVec3(k1[1].position, k1[2].position, tangentsPositionk1, tk1)) / dtk1;
        let innerSpeedk2 = glVector3f.distance(k2[1].position, glCinematicCamera.__interpolateSplineVec3(k2[1].position, k2[2].position, tangentsPositionk2, tk2)) / dtk2;
            
        let outerAngularSpeedk1 = (glQuaternion.distance(k1[2].orientation, glCinematicCamera.__interpolateSplineQuaternion(k1[1].orientation, k1[2].orientation, tangentsOrientationk1, tk1)) / glQuaternion.__PI) / dtk1;
        let innerAngularSpeedk2 = (glQuaternion.distance(k2[1].orientation, glCinematicCamera.__interpolateSplineQuaternion(k2[1].orientation, k2[2].orientation, tangentsOrientationk2, tk2)) / glQuaternion.__PI) / dtk2;
            
        k1[1].positionAcceleration    = ((outerSpeedk1        * innerSpeedk2        > 0.0) ? (innerSpeedk2        / outerSpeedk1)        : 1.0);
        k1[1].orientationAcceleration = ((outerAngularSpeedk1 * innerAngularSpeedk2 > 0.0) ? (innerAngularSpeedk2 / outerAngularSpeedk1) : 1.0);
    
        for(let k = 0, e = 10000, lastPositionDivergence = 0.0, lastOrientationDivergence = 0.0; k != e; ++k)
        {
            let outerSpeedk1 = glVector3f.distance(k1[2].position, glCinematicCamera.__interpolateSplineVec3(k1[1].position, k1[2].position, tangentsPositionk1, Math.pow(tk1, k1[1].positionAcceleration))) / dtk1;
            let innerSpeedk2 = glVector3f.distance(k2[1].position, glCinematicCamera.__interpolateSplineVec3(k2[1].position, k2[2].position, tangentsPositionk2, tk2)) / dtk2;
            
            let outerAngularSpeedk1 = (glQuaternion.distance(k1[2].orientation, glCinematicCamera.__interpolateSplineQuaternion(k1[1].orientation, k1[2].orientation, tangentsOrientationk1, Math.pow(tk1, k1[1].orientationAcceleration))) / glQuaternion.__PI) / dtk1;
            let innerAngularSpeedk2 = (glQuaternion.distance(k2[1].orientation, glCinematicCamera.__interpolateSplineQuaternion(k2[1].orientation, k2[2].orientation, tangentsOrientationk2, tk2)) / glQuaternion.__PI) / dtk2;
            
            let positionDivergence    = (innerSpeedk2 - outerSpeedk1);
            let orientationDivergence = (innerAngularSpeedk2 - outerAngularSpeedk1);

            if(Math.abs(positionDivergence) <= 1e-3 && Math.abs(orientationDivergence) <= 1e-3) break;

            k1[1].positionAcceleration    = Math.max(k1[1].positionAcceleration    + (positionDivergence    + lastPositionDivergence)    * 0.001, 0.0);
            k1[1].orientationAcceleration = Math.max(k1[1].orientationAcceleration + (orientationDivergence + lastOrientationDivergence) * 0.001, 0.0);

            lastOrientationDivergence = orientationDivergence;
            lastPositionDivergence = positionDivergence;

         // if(k == e - 1) console.log(positionDivergence.toFixed(4), orientationDivergence.toFixed(4));
        }
    }

    this.__keyframeID = 0;
    this.__duration = this.__keyframes[nKeyframes - 1].time;
    this.__distance = this.__keyframes[nKeyframes - 1].distance;
    
    this.__shouldUpdate = false;
}

glCinematicCamera.prototype.__tessellate = function()
{
    if(this.__shouldSort) this.__sort();

    let biasTolerance = 0.00005;
    
    let keyframePoints = [];
    let curveLineStrip = [];
   
    let nKeyframes  = this.__keyframes.length;
    for(let i = 0, lastDirection = null; i < nKeyframes; ++i)
    {
        let k = this.__getKeyframeControlPoints(i);
        let tangents = glCinematicCamera.__computeSplineTangentsVec3(k[0].position, k[1].position, k[2].position, k[3].position);
        
        if(k[1] != k[2]) for(let j = 0, integrationSteps = 1000, lastPoint = null; j <= integrationSteps; ++j)
        {
            let t = (j / integrationSteps);
            
            let p = glCinematicCamera.__interpolateSplineVec3(k[1].position, k[2].position, tangents, t);
            let v = ((lastPoint != null) ? glVector3f.sub(p, lastPoint) : null);
            let d = ((v != null && v.squaredLength() > 0.0) ? glVector3f.normalize(v) : null);
            
            if(lastDirection == null) lastDirection = d;

            if(lastPoint == null || (d != null && (1.0 - Math.max(glVector3f.dot(lastDirection, d), 0.0)) > biasTolerance))
            {
                curveLineStrip.push(new glVertex(p));

                lastDirection = d;
                lastPoint = p;
            }
        }
        
        if(i == nKeyframes - 1) curveLineStrip.push(new glVertex(k[2].position));

        keyframePoints.push(new glVertex(this.__keyframes[i].position));
    }
    
    this.__primitiveLineStrip.set(curveLineStrip);
    this.__primitivePoints.set(keyframePoints);
    
    this.__shouldTessellate = false;
}

glCinematicCamera.prototype.__evaluate = function()
{
    let nKeyframes = this.size();
    
    while(this.__time > this.__keyframes[Math.min(this.__keyframeID + 1, (nKeyframes - 1))].time) {
        this.__keyframeID = Math.min(this.__keyframeID + 1, (nKeyframes - 1));
    }
    
    let k = this.__getKeyframeControlPoints(this.__keyframeID);

    let t = ((this.__time - k[1].time) / k[1].timeDelta);
    if(this.__keyframeID == 0) t *= glCinematicCamera.__smoothstep(0.0, 0.5, t);

    let tPosition    = Math.pow(t, glCinematicCamera.__mix(1.0, k[1].positionAcceleration,    t));
    let tOrientation = Math.pow(t, glCinematicCamera.__mix(1.0, k[1].orientationAcceleration, t));
    
    let positionTangents    = glCinematicCamera.__computeSplineTangentsVec3(k[0].position, k[1].position, k[2].position, k[3].position);
    let orientationTangents = glCinematicCamera.__computeSplineTangentsQuaternion(k[0].orientation, k[1].orientation, k[2].orientation, k[3].orientation);    
    
    let position    = glCinematicCamera.__interpolateSplineVec3(k[1].position, k[2].position, positionTangents, tPosition);
    let orientation = glCinematicCamera.__interpolateSplineQuaternion(k[1].orientation, k[2].orientation, orientationTangents, tOrientation);
    
    this.__transform.position = position;
    this.__transform.orientation = orientation;
    this.__transform.matrix = orientation.toMatrix4x4f().mul(glMatrix4x4f.translationMatrix(glVector3f.flip(position)));
}

glCinematicCamera.prototype.insertKeyframe = function(time, position, orientation)
{
    this.__keyframes.push(
    {
        orientation: new glQuaternion(orientation),
        position: new glVector3f(position),
        time: time,

        orientationAcceleration: 1.0,
        positionAcceleration:    1.0,
        timeDelta:               0.0,
        distance:                0.0,
        speed:                   0.0
    });

    this.__shouldUpdate = this.__shouldTessellate = this.__shouldSort = true;
}

glCinematicCamera.prototype.addKeyframe = function(delay, position, orientation)
{
    let nKeyframes = this.size();
    let prevKeyframeTime = ((nKeyframes > 0) ? this.__keyframes[nKeyframes - 1].time : 0.0);

    this.insertKeyframe((prevKeyframeTime + delay), position, orientation);
}

glCinematicCamera.prototype.getPosition = function() {
    return new glVector3f(this.__transform.position);
}

glCinematicCamera.prototype.getDirection = function() {
    return this.__transform.orientation.toVector3f();
}

glCinematicCamera.prototype.getMatrix4x4f = function() {
    return new glMatrix4x4f(this.__transform.matrix);
}

glCinematicCamera.prototype.clear = function()
{
    this.__keyframes.length = 0;
    this.__shouldTessellate = true;
}

glCinematicCamera.prototype.size = function() {
    return this.__keyframes.length;
}

glCinematicCamera.prototype.empty = function() {
    return (this.size() == 0);
}

glCinematicCamera.prototype.update = function(dt)
{
    if(this.empty()) this.stop();
    if(this.__isPlaying)
    {
        if(this.__shouldUpdate) this.__update();

        this.__time = Math.min(Math.max(this.__time + dt, 0.0), this.__duration);
        this.__evaluate();

        if(this.__time >= this.__duration)
        {
            this.stop();
            if(this.__onFinishCallback != null) this.__onFinishCallback();
        }
    }
}

glCinematicCamera.prototype.isPlaying = function() {
    return this.__isPlaying;
}

glCinematicCamera.prototype.play = function(onFinish)
{
    this.__onFinishCallback = onFinish;
    this.__isPlaying = true;
}

glCinematicCamera.prototype.pause = function() {
    this.__isPlaying = false;
}

glCinematicCamera.prototype.stop = function()
{
    this.pause();
    this.rewind();
}

glCinematicCamera.prototype.rewind = function()
{
    this.__time = 0.0;
    this.__keyframeID = 0;
}

glCinematicCamera.prototype.setTime = function(t)
{
    if(this.__shouldUpdate) this.__update();
    
    this.__time = t % this.__duration;
    this.__keyframeID = 0;
}

glCinematicCamera.prototype.getTime = function() {
    return this.__time;
}

glCinematicCamera.prototype.setDuration = function(t)
{
    if(this.__shouldUpdate) this.__update();
    
    for(let i = 0, e = this.__keyframes.length; i != e; ++i)
    {
        let keyframe = this.__keyframes[i];
        keyframe.time = (keyframe.time / this.__duration) * t;
    }

    this.__shouldUpdate = true;
}

glCinematicCamera.prototype.getDuration = function()
{
    if(this.__shouldUpdate) this.__update();
    return this.__duration;
}

glCinematicCamera.prototype.renderPath = function(r, g, b, a, pointSize)
{
    if(!this.empty())
    {
        if(r == null) r = 1.0;
        if(a == null) a = 1.0;
        if(g == null && b == null) g = b = r;

        if(pointSize == null) pointSize = 8.0;

        if(this.__shouldTessellate) this.__tessellate();

        let gl = this.__ctx.getGL();

        this.__program.bind();
        this.__uniformColor.set(r, g, b, a);
        this.__uniformPointSize.set(pointSize);
        
        this.__primitiveLineStrip.render(gl.LINE_STRIP);
        if(pointSize > 0.0) this.__primitivePoints.render(gl.POINTS);
    }
}

glCinematicCamera.prototype.toString = function()
{
    if(this.__shouldSort) this.__sort();
    
    let s = "function loadCinematicSequence(cinematicCamera)\n{\n\tcinematicCamera.clear();\n";
    
    for(let i = 0, e = this.size(); i != e; ++i)
    {
        let keyframe = this.__keyframes[i];
        
        let px = (keyframe.position.x).toFixed(4);
        let py = (keyframe.position.y).toFixed(4);
        let pz = (keyframe.position.z).toFixed(4);
        
        let qx = (keyframe.orientation.__x).toFixed(4);
        let qy = (keyframe.orientation.__y).toFixed(4);
        let qz = (keyframe.orientation.__z).toFixed(4);
        let qw = (keyframe.orientation.__w).toFixed(4);
        
        let prevKeyframeTime = ((i > 0) ? this.__keyframes[i - 1].time : 0.0);
        let keyframeDelay = (keyframe.time - prevKeyframeTime).toFixed(4);
        
        let formattedPosition    = "new glVector3f("   + px + "," + py + "," + pz + ")";
        let formattedOrientation = "new glQuaternion(" + qx + "," + qy + "," + qz + "," + qw + ")";

        s += "\tcinematicCamera.addKeyframe(" + keyframeDelay + ", " + formattedPosition + ", " + formattedOrientation + ");\n";
    }

    s += "}";

    return s;
}
