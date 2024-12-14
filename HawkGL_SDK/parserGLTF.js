
/*
    The MIT License (MIT)

    Copyright (c) 2016 Shuai Shao (shrekshao) and Contributors

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

let NUM_MAX_JOINTS = 256;
let MinimalGLTFLoader = {};

MinimalGLTFLoader.Type2NumOfComponent =
{
    'SCALAR': 1,
    'VEC2':   2,
    'VEC3':   3,
    'VEC4':   4,
    'MAT2':   4,
    'MAT3':   9,
    'MAT4':   16
};

MinimalGLTFLoader.Accessor = function (a, bufferViewObject)
{
    this.bufferView = bufferViewObject;
    this.componentType = a.componentType;   // required
    this.byteOffset = a.byteOffset !== undefined ? a.byteOffset : 0;
    this.byteStride = bufferViewObject.byteStride;
    this.normalized = a.normalized !== undefined ? a.normalized : false;
    this.count = a.count;   // required
    this.type = a.type;     // required
    this.size = MinimalGLTFLoader.Type2NumOfComponent[this.type];

    this.min = a.min;   // @tmp assume required for now (for bbox)
    this.max = a.max;   // @tmp assume required for now (for bbox)

    this.extensions = a.extensions !== undefined ? a.extensions : null;
    this.extras = a.extras !== undefined ? a.extras : null;
};

MinimalGLTFLoader.BufferView = function(bf, bufferData)
{
    this.byteLength = bf.byteLength;    //required
    this.byteOffset = bf.byteOffset !== undefined ? bf.byteOffset : 0;
    this.byteStride = bf.byteStride !== undefined ? bf.byteStride : 0;
    this.target = bf.target !== undefined ? bf.target : null;

    this.data = bufferData.slice(this.byteOffset, this.byteOffset + this.byteLength);

    this.extensions = bf.extensions !== undefined ? bf.extensions : null;
    this.extras = bf.extras !== undefined ? bf.extras : null;
};

MinimalGLTFLoader.Scene = function (gltf, s)
{
    this.name = s.name !== undefined ? s.name : null;
    this.nodes = new Array(s.nodes.length);    // root node object of this scene
    this.matrices = new Array(s.nodes.length);
    
    for (let i = 0, len = s.nodes.length; i < len; i++) {
        this.nodes[i] = gltf.nodes[s.nodes[i]];
    }

    this.extensions = s.extensions !== undefined ? s.extensions : null;
    this.extras = s.extras !== undefined ? s.extras : null;
};

MinimalGLTFLoader.Node = function (loader, n, nodeID)
{
    this.name = n.name !== undefined ? n.name : null;
    this.nodeID = nodeID;
    
    this.matrix = new glMatrix4x4f();
    this.baseMatrix = glMatrix4x4f.identityMatrix();
    this.inverseBindMatrix = glMatrix4x4f.identityMatrix();

    this.getTransformMatrixFromTRS(n.translation, n.rotation, n.scale);
    if(n.hasOwnProperty('matrix')) this.matrix.set(n.matrix);  
    
    this.children = n.children || [];  // init as id, then hook up to node object later
    this.mesh = n.mesh !== undefined ? loader.glTF.meshes[n.mesh] : null;

    this.skin = n.skin !== undefined ? n.skin : null;   // init as id, then hook up to skin object later

    this.extensions = n.extensions !== undefined ? n.extensions : null;
    this.extras = n.extras !== undefined ? n.extras : null;
};

MinimalGLTFLoader.Node.prototype.getTransformMatrixFromTRS = function(translation, rotation, scale)
{
    this.rotation = ((rotation != null) ? new glVector4f(rotation[0], rotation[1], rotation[2], rotation[3]) : new glVector4f(0.0, 0.0, 0.0, 1.0));
    this.translation = ((translation != null) ? new glVector3f(translation[0], translation[1], translation[2]) : new glVector3f(0.0));
    this.scale = ((scale != null) ? new glVector3f(scale[0], scale[1], scale[2]) : new glVector3f(1.0));
    
    if(this.__baseTranslation == null) this.__baseTranslation = new glVector3f(this.translation);
    if(this.__baseRotation    == null) this.__baseRotation    = new glVector4f(this.rotation);
    if(this.__baseScale       == null) this.__baseScale       = new glVector3f(this.scale);

    this.updateMatrixFromTRS();
};

MinimalGLTFLoader.Node.prototype.resetTransform = function()
{
    this.translation.set(this.__baseTranslation);
    this.rotation.set(this.__baseRotation);
    this.scale.set(this.__baseScale);

    this.updateMatrixFromTRS();
};

MinimalGLTFLoader.Node.prototype.updateMatrixFromTRS = function()
{
    let v = this.translation;
    let q = this.rotation;
    let s = this.scale;

    let x = q.x;
    let y = q.y;
    let z = q.z;
    let w = q.w;

    let x2 = x + x;
    let y2 = y + y;
    let z2 = z + z;
  
    let xx = x * x2;
    let xy = x * y2;
    let xz = x * z2;
    let yy = y * y2;
    let yz = y * z2;
    let zz = z * z2;
    let wx = w * x2;
    let wy = w * y2;
    let wz = w * z2;

    this.matrix.__m[0] = (1.0 - (yy + zz)) * s.x;
    this.matrix.__m[1] = (xy + wz) * s.x;
    this.matrix.__m[2] = (xz - wy) * s.x;
    this.matrix.__m[3] = 0.0;
    this.matrix.__m[4] = (xy - wz) * s.y;
    this.matrix.__m[5] = (1.0 - (xx + zz)) * s.y;
    this.matrix.__m[6] = (yz + wx) * s.y;
    this.matrix.__m[7] = 0.0;
    this.matrix.__m[8] = (xz + wy) * s.z;
    this.matrix.__m[9] = (yz - wx) * s.z;
    this.matrix.__m[10] = (1.0 - (xx + yy)) * s.z;
    this.matrix.__m[11] = 0.0;
    this.matrix.__m[12] = v.x;
    this.matrix.__m[13] = v.y;
    this.matrix.__m[14] = v.z;
    this.matrix.__m[15] = 1.0;
}

MinimalGLTFLoader.Mesh = function (loader, m, meshID)
{
    this.meshID = meshID;
    this.name = m.name !== undefined ? m.name : null;

    this.primitives = [];   // required
    
    let p, primitive;

    for (let i = 0, len = m.primitives.length; i < len; ++i) {
        p = m.primitives[i];
        primitive = new MinimalGLTFLoader.Primitive(loader.glTF, p);
        this.primitives.push(primitive);
    }

    this.extensions = m.extensions !== undefined ? m.extensions : null;
    this.extras = m.extras !== undefined ? m.extras : null;
    
};

MinimalGLTFLoader.Primitive = function (gltf, p)
{
    // <attribute name, accessor id>, required
    // get hook up with accessor object in _postprocessing
    this.attributes = p.attributes;
    this.indices = p.indices !== undefined ? p.indices : null;  // accessor id
    
    let attname;
   
    if (this.indices !== null) {
        this.indicesComponentType = gltf.json.accessors[this.indices].componentType;
        this.indicesLength = gltf.json.accessors[this.indices].count;
        this.indicesOffset = (gltf.json.accessors[this.indices].byteOffset || 0);
    } else {
        // assume 'POSITION' is there
        this.drawArraysCount = gltf.json.accessors[this.attributes.POSITION].count;
        this.drawArraysOffset = (gltf.json.accessors[this.attributes.POSITION].byteOffset || 0);
    }

    // hook up accessor object
    for ( attname in this.attributes ) {
        this.attributes[attname] = gltf.accessors[ this.attributes[attname] ];
    }

    this.material = p.material !== undefined ? gltf.materials[p.material] : null;

    this.mode = p.mode !== undefined ? p.mode : 4; // default: gl.TRIANGLES

    this.extensions = p.extensions !== undefined ? p.extensions : null;
    this.extras = p.extras !== undefined ? p.extras : null;
};

MinimalGLTFLoader.TextureInfo = function (json)
{
    this.index = json.index;
    this.texCoord = json.texCoord !== undefined ? json.texCoord : 0 ;

    this.extensions = json.extensions !== undefined ? json.extensions : null;
    this.extras = json.extras !== undefined ? json.extras : null;
};

MinimalGLTFLoader.PbrMetallicRoughness = function (json)
{
    this.baseColorFactor = json.baseColorFactor !== undefined ? json.baseColorFactor : [1, 1, 1, 1];
    this.baseColorTexture = json.baseColorTexture !== undefined ? new MinimalGLTFLoader.TextureInfo(json.baseColorTexture): null;
    this.metallicFactor = json.metallicFactor !== undefined ? json.metallicFactor : 1 ;
    this.roughnessFactor = json.roughnessFactor !== undefined ? json.roughnessFactor : 1 ;
    this.metallicRoughnessTexture = json.metallicRoughnessTexture !== undefined ? new MinimalGLTFLoader.TextureInfo(json.metallicRoughnessTexture): null;

    this.extensions = json.extensions !== undefined ? json.extensions : null;
    this.extras = json.extras !== undefined ? json.extras : null;
};

MinimalGLTFLoader.NormalTextureInfo = function (json)
{
    this.index = json.index;
    this.texCoord = json.texCoord !== undefined ? json.texCoord : 0 ;
    this.scale = json.scale !== undefined ? json.scale : 1 ;

    this.extensions = json.extensions !== undefined ? json.extensions : null;
    this.extras = json.extras !== undefined ? json.extras : null;
};

MinimalGLTFLoader.OcclusionTextureInfo = function (json)
{
    this.index = json.index;
    this.texCoord = json.texCoord !== undefined ? json.texCoord : 0 ;
    this.strength = json.strength !== undefined ? json.strength : 1 ;

    this.extensions = json.extensions !== undefined ? json.extensions : null;
    this.extras = json.extras !== undefined ? json.extras : null;
};

MinimalGLTFLoader.Material = function (m)
{
    if(m == null) m = {};

    this.name = m.name !== undefined ? m.name : null;
    
    this.pbrMetallicRoughness = m.pbrMetallicRoughness !== undefined ? new MinimalGLTFLoader.PbrMetallicRoughness( m.pbrMetallicRoughness ) : new MinimalGLTFLoader.PbrMetallicRoughness({
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 1,
        metallicRoughnessTexture: 1
    });
   
    this.normalTexture = m.normalTexture !== undefined ? new MinimalGLTFLoader.NormalTextureInfo(m.normalTexture) : null;
    this.occlusionTexture = m.occlusionTexture !== undefined ? new MinimalGLTFLoader.OcclusionTextureInfo(m.occlusionTexture) : null;
    this.emissiveTexture = m.emissiveTexture !== undefined ? new MinimalGLTFLoader.TextureInfo(m.emissiveTexture) : null;

    this.emissiveFactor = m.emissiveFactor !== undefined ? m.emissiveFactor : [0, 0, 0];
    this.alphaMode = m.alphaMode !== undefined ? m.alphaMode : "OPAQUE";
    this.alphaCutoff = m.alphaCutoff !== undefined ? m.alphaCutoff : 0.5;
    this.doubleSided = m.doubleSided || false;

    this.extensions = m.extensions !== undefined ? m.extensions : null;
    this.extras = m.extras !== undefined ? m.extras : null;
};

MinimalGLTFLoader.Skin = function (gltf, s, skinID) {
    this.name = s.name !== undefined ? s.name : null;
    this.skinID = skinID;

    this.joints = new Array(s.joints.length);   // required
    let i, len;
    for (i = 0, len = this.joints.length; i < len; i++) {
        this.joints[i] = gltf.nodes[s.joints[i]];
    }

    this.skeleton = s.skeleton !== undefined ? gltf.nodes[s.skeleton] : null;
    this.inverseBindMatrices = s.inverseBindMatrices !== undefined ? gltf.accessors[s.inverseBindMatrices] : null;

    this.extensions = s.extensions !== undefined ? s.extensions : null;
    this.extras = s.extras !== undefined ? s.extras : null;

    if (this.inverseBindMatrices)
    {
        this.inverseBindMatricesData = MinimalGLTFLoader.__getAccessorData(this.inverseBindMatrices); 
        this.inverseBindMatrix = [];  // for calculation
        
        for (i = 0, len = this.inverseBindMatricesData.length; i < len; i += 16) {
            this.inverseBindMatrix.push(new glMatrix4x4f(this.inverseBindMatricesData.slice(i, i + 16)));
        }
    }
};

// animation has no potential plan for progressive rendering I guess
// so everything happens after all buffers are loaded

MinimalGLTFLoader.Target = function (t)
{
    this.nodeID = t.node !== undefined ? t.node : null ;  //id, to be hooked up to object later
 
    switch(t.path) //required, string
    {
        case "translation": this.path = MinimalGLTFLoader.Target.Path.TRANSLATION; break;
        case "rotation":    this.path = MinimalGLTFLoader.Target.Path.ROTATION;    break;
        case "scale":       this.path = MinimalGLTFLoader.Target.Path.SCALE;       break;
    }

    this.extensions = t.extensions !== undefined ? t.extensions : null;
    this.extras = t.extras !== undefined ? t.extras : null;
};

MinimalGLTFLoader.Target.Path = Object.freeze({"TRANSLATION":0, "ROTATION":1, "SCALE":2});

MinimalGLTFLoader.Channel = function (c, animation) {
    this.sampler = animation.samplers[c.sampler];   //required
    this.target = new MinimalGLTFLoader.Target(c.target);     //required

    this.extensions = c.extensions !== undefined ? c.extensions : null;
    this.extras = c.extras !== undefined ? c.extras : null;
};

MinimalGLTFLoader.AnimationSampler = function (gltf, s) {
    this.input = gltf.accessors[s.input];   //required, accessor object
    this.output = gltf.accessors[s.output]; //required, accessor object

    this.inputTypedArray = MinimalGLTFLoader.__getAccessorData(this.input);
    this.outputTypedArray = MinimalGLTFLoader.__getAccessorData(this.output);


    // "LINEAR"
    // "STEP"
    // "CATMULLROMSPLINE"
    // "CUBICSPLINE"
    this.interpolation = s.interpolation !== undefined ? s.interpolation : 'LINEAR' ;
    

    this.extensions = s.extensions !== undefined ? s.extensions : null;
    this.extras = s.extras !== undefined ? s.extras : null;

    // ------- extra runtime info -----------
    // runtime status thing
    this.curIdx = 0;
    // this.curValue = 0;
    this.curValue = new glVector4f();
    this.endT = this.inputTypedArray[this.inputTypedArray.length - 1];
    this.inputMax = this.endT - this.inputTypedArray[0];
};

let animationOutputValueVec4a = new Array(4);
let animationOutputValueVec4b = new Array(4);

MinimalGLTFLoader.AnimationSampler.prototype.getValue = function (t)
{
    if (t > this.endT) {
        t -= this.inputMax * Math.ceil((t - this.endT) / this.inputMax);
        this.curIdx = 0;
    }

    let len = this.inputTypedArray.length;
    while(this.curIdx > 0 && t <= this.inputTypedArray[this.curIdx]) this.curIdx--;
    while(this.curIdx <= len - 2 && t >= this.inputTypedArray[this.curIdx + 1]) this.curIdx++;
    
    if (this.curIdx >= len - 1) {
        // loop
        t -= this.inputMax;
        this.curIdx = 0;
    }

    // @tmp: assume no stride
    let count = MinimalGLTFLoader.Type2NumOfComponent[this.output.type];
    
    let interpolate = ((count === 4) ? function(t) // quaternion slerp
    {
        let qa = new glQuaternion(animationOutputValueVec4a[0], animationOutputValueVec4a[1], animationOutputValueVec4a[2], animationOutputValueVec4a[3]);
        let qb = new glQuaternion(animationOutputValueVec4b[0], animationOutputValueVec4b[1], animationOutputValueVec4b[2], animationOutputValueVec4b[3]);
          
        let q = glQuaternion.slerp(qa, qb, t);
        
        return q.toVector4f();
        
    } : function(t) // vector lerp
    {        
        let va = new glVector4f(animationOutputValueVec4a[0], animationOutputValueVec4a[1], animationOutputValueVec4a[2], animationOutputValueVec4a[3]);
        let vb = new glVector4f(animationOutputValueVec4b[0], animationOutputValueVec4b[1], animationOutputValueVec4b[2], animationOutputValueVec4b[3]);

        return new glVector4f((va.x * (1.0 - t) + vb.x * t),
                              (va.y * (1.0 - t) + vb.y * t),
                              (va.z * (1.0 - t) + vb.z * t),
                              (va.w * (1.0 - t) + vb.w * t));
    });

    let i = this.curIdx;
    let o = i * count;
    let on = o + count;
    
    let u = ((len > 1) ? Math.max(0.0, t - this.inputTypedArray[i]) / (this.inputTypedArray[i + 1] - this.inputTypedArray[i]) : 0.0);
    
    for (let j = 0; j < 4; ++j)
    {
        animationOutputValueVec4a[j] = ((j < count) ? this.outputTypedArray[o  + j] : null);
        animationOutputValueVec4b[j] = ((j < count) ? this.outputTypedArray[on + j] : null);
    }

/*
    switch(this.interpolation) { 
        case 'LINEAR': this.curValue = interpolate(u); break;
    }
*/ 

    this.curValue = interpolate(u);
};

MinimalGLTFLoader.Animation = function (gltf, a) {
    this.name = a.name !== undefined ? a.name : null;

    let i, len;

    this.samplers = []; // required, array of animation sampler
    this.timeStart = null;
    this.timeEnd = null;
    
    for (i = 0, len = a.samplers.length; i < len; i++)
    {
        this.samplers[i] = new MinimalGLTFLoader.AnimationSampler(gltf, a.samplers[i]);
        this.timeEnd = ((this.timeEnd != null) ? Math.max(this.timeEnd, this.samplers[i].endT) : this.samplers[i].endT);
        this.timeStart = ((this.timeStart != null) ? Math.min(this.timeStart, this.samplers[i].inputTypedArray[0]) : this.samplers[i].inputTypedArray[0]);
    }

    this.channels = [];     //required, array of channel
    
    for (i = 0, len = a.channels.length; i < len; i++) {
        this.channels[i] = new MinimalGLTFLoader.Channel(a.channels[i], this);
    }

    this.extensions = a.extensions !== undefined ? a.extensions : null;
    this.extras = a.extras !== undefined ? a.extras : null;
};

let gltfAnimation = function(animator, animation, timeStart, timeEnd)
{
    this.__animator  = animator;

    this.__animation = animation;
    this.__name = animation.name;
    
    this.__timeStart = ((timeStart != null) ? timeStart : animation.timeStart);
    this.__timeEnd   = ((timeEnd   != null) ? timeEnd   : animation.timeEnd);
    this.__duration  = (this.__timeEnd - this.__timeStart);
    
    let self = this;
    this.__events = [];

    this.__speed = 1.0;
    this.__setTime(this.__timeStart);    

    this.__repeatMode = glTFAnimator.RepeatMode.REPEAT;
    
    this.__state = animator.__stateManager.createState(function() {
        self.__animator.playAnimation(self, self.__repeatMode, null, self.__transitionTime);
    });
}

gltfAnimation.prototype.setRepeatMode = function(repeatMode) {
    this.__repeatMode = repeatMode;
}

gltfAnimation.prototype.getRepeatMode = function() {
    return this.__repeatMode;
}

gltfAnimation.prototype.__slice = function(timeStart, timeEnd)
{
    if(timeStart == null) timeStart = 0.0;
    if(timeEnd   == null) timeEnd = this.getDuration();

    timeStart = Math.min(Math.max(timeStart, 0.0), this.getDuration() * 0.999999);
    timeEnd   = Math.min(Math.max(timeEnd,   0.0), this.getDuration() * 0.999999);
    
    let shouldFlip = false;
    if(timeEnd < timeStart)
    {
        let tmp = timeStart;

        timeStart = timeEnd;
        timeEnd = tmp;

        shouldFlip = true;
    }

    let animation = new gltfAnimation(this.__animator, this.__animation, timeStart, timeEnd);
    if(shouldFlip) animation.flip();

    return animation;
}

gltfAnimation.prototype.onInput = function(input, animation, transitionTime, conditionalFunctor)
{
    if(typeof animation === "string" || animation instanceof String) animation = this.__animator.getAnimation(animation);
    if(animation != null) this.__state.onInput(input, animation.__state, function()
    {
        let shouldPlayAnimation = ((conditionalFunctor != null) ? conditionalFunctor() : true);
        if(shouldPlayAnimation) animation.__transitionTime = transitionTime;
        
        return shouldPlayAnimation;   
    });
}

gltfAnimation.prototype.clearInputs = function() {
    this.__state.clear();
}

gltfAnimation.prototype.getName = function() {
    return this.__name;
}

gltfAnimation.prototype.getDuration = function() {
    return this.__duration;
}

gltfAnimation.prototype.getTime = function() {
    return this.__time;
}

gltfAnimation.prototype.getTimeRate = function()
{
    let rate = this.getTime() / this.getDuration();
    if(this.__speed < 0.0) rate = 1.0 - rate;
    
    return rate;
}

gltfAnimation.prototype.__setTime = function(time) {
    this.__time = this.__lastTime = time;
}

gltfAnimation.__updateID = 0;

gltfAnimation.prototype.__resetTransforms = function()
{
    function resetNodesTransforms(nodes, node)
    {
        if(node.skinned || node.animated) node.resetTransform();
        for(let i = 0, e = node.children.length; i != e; ++i) resetNodesTransforms(nodes, node.children[i]);
    }

    for(let i = 0, len = this.__animator.__scenes.length; i != len; ++i)
    {
        for(let nodes = this.__animator.__scenes[i].nodes, k = 0, e = nodes.length; k != e; ++k) {
            resetNodesTransforms(this.__animator.__nodes, nodes[k]);
        }
    }
}

gltfAnimation.prototype.__createTransitionPose = function(transitionTimeStart, transitionTimeEnd)
{
    function updateTransitionPose(nodes, node)
    {
        if(node.skinned || node.animated)
        { 
            node.transitionPose_translation = new glVector3f(node.translation);    
            node.transitionPose_rotation = new glVector4f(node.rotation);
            node.transitionPose_scale = new glVector3f(node.scale);
            
            node.transitionTimeStart = transitionTimeStart;
            node.transitionTimeEnd = transitionTimeEnd;
        }

        for(let i = 0, e = node.children.length; i != e; ++i) updateTransitionPose(nodes, node.children[i]);
    }

    for(let i = 0, len = this.__animator.__scenes.length; i != len; ++i)
    {
        for(let nodes = this.__animator.__scenes[i].nodes, k = 0, e = nodes.length; k != e; ++k) {
            updateTransitionPose(this.__animator.__nodes, nodes[k]);
        }
    }
}

gltfAnimation.prototype.__update = function(time, shouldUpdateAnimationEvents, shouldUpdateTransitionPose)
{
    ++gltfAnimation.__updateID;

    this.__time = Math.min(Math.max(time, 0.0), this.getDuration());
    if(this.__speed < 0.0) time = this.getDuration() - time;
    
    if(shouldUpdateAnimationEvents) this.__updateEvents();

    for(let i = 0, e = this.__animation.channels.length; i != e; ++i)
    {
        let channel = this.__animation.channels[i];
        let sampler = channel.sampler;
        let target  = channel.target;

        if(sampler.__updateID != gltfAnimation.__updateID)
        {
            sampler.__updateID = gltfAnimation.__updateID;
            sampler.getValue(this.__timeStart + this.__time);
        }
        
        let transform = sampler.curValue;
        let node = this.__animator.__nodes[target.nodeID];
        
        if(node.__updateID != gltfAnimation.__updateID)
        {
            node.__updateID = gltfAnimation.__updateID;
            node.resetTransform();
        }

        switch(target.path)
        {
            case MinimalGLTFLoader.Target.Path.TRANSLATION: node.translation.set(transform.x, transform.y, transform.z);           break;
            case MinimalGLTFLoader.Target.Path.ROTATION:    node.rotation.set(transform.x, transform.y, transform.z, transform.w); break;
            case MinimalGLTFLoader.Target.Path.SCALE:       node.scale.set(transform.x, transform.y, transform.z);                 break;
        }

        if(!shouldUpdateTransitionPose) node.transitionTimeStart = node.transitionTimeEnd = 0.0;
        
        if(time >= node.transitionTimeStart && time < node.transitionTimeEnd)
        {
            let t = (time - node.transitionTimeStart) / (node.transitionTimeEnd - node.transitionTimeStart);
        
            node.translation.set((node.transitionPose_translation.x * (1.0 - t) + node.translation.x * t),
                                 (node.transitionPose_translation.y * (1.0 - t) + node.translation.y * t),
                                 (node.transitionPose_translation.z * (1.0 - t) + node.translation.z * t));

            node.scale.set((node.transitionPose_scale.x * (1.0 - t) + node.scale.x * t),
                           (node.transitionPose_scale.y * (1.0 - t) + node.scale.y * t),
                           (node.transitionPose_scale.z * (1.0 - t) + node.scale.z * t));
            
            let qa = new glQuaternion(node.transitionPose_rotation.x, node.transitionPose_rotation.y, node.transitionPose_rotation.z, node.transitionPose_rotation.w);
            let qb = new glQuaternion(node.rotation.x, node.rotation.y, node.rotation.z, node.rotation.w);
                
            let q = glQuaternion.slerp(qa, qb, t);

            node.rotation.set(q.toVector4f());

        } else if(time >= node.transitionTimeEnd) node.transitionTimeStart = node.transitionTimeEnd = 0.0; 

        node.updateMatrixFromTRS();
    }

    let self = this;
    let animationID = 0;
    
    function updateAnimationMatrices(node, parentTransform, sceneMatrices)
    {
        let matrix = sceneMatrices[node.nodeID];
        matrix.set(glMatrix4x4f.mul(parentTransform, node.matrix));

        if(node.name != null && node.name.length > 0) 
        {
            let relativeTransform = self.__animator.__nodesRelativeTransforms.get(node.name);
            if(relativeTransform != null)
            {
                let hasTRS = (relativeTransform.t || relativeTransform.r || relativeTransform.s);
                if(hasTRS)
                {
                    if(relativeTransform.t) node.translation.set(relativeTransform.t);
                    if(relativeTransform.r) node.rotation.set(relativeTransform.r);
                    if(relativeTransform.s) node.scale.set(relativeTransform.s);
                    
                    node.updateMatrixFromTRS();
                }

                if(relativeTransform.m != null) node.matrix.mul(relativeTransform.m);

                matrix.set(glMatrix4x4f.mul(parentTransform, node.matrix));
            }

            self.__animator.__nodesAbsoluteTransforms.set(node.name, matrix);
        }

        if(node.hasMesh && node.animated) self.__animator.__animationMatricesCurrentFrame[animationID++] = glMatrix4x4f.mul(matrix, node.inverseBindMatrix);
        
        if(node.skinned)
        {
            let skin = node.skin;
    
            if(skin.__updateID != gltfAnimation.__updateID)
            {
                skin.__updateID = gltfAnimation.__updateID;
                let inverseTransform = glMatrix4x4f.inverse(glMatrix4x4f.mul(matrix, node.inverseBindMatrix));
                
                for(let joints = skin.joints, i = 0, len = joints.length; i < len; ++i)
                {
                    let jointNode = joints[i];

                    let tmpMat4 = glMatrix4x4f.mul(sceneMatrices[jointNode.nodeID], skin.inverseBindMatrix[i]);
                    tmpMat4 = glMatrix4x4f.mul(inverseTransform, tmpMat4);

                    self.__animator.__bonesMatricesCurrentFrame[skin.baseMatrixID + i] = glMatrix4x4f.mul(tmpMat4, node.inverseBindMatrix);
                    self.__animator.__bonesBindPoseTransforms[skin.baseMatrixID + i] = glMatrix4x4f.mul(node.baseMatrix, glMatrix4x4f.inverse(skin.inverseBindMatrix[i]));
                    self.__animator.__bonesJointsNodeIDs[skin.baseMatrixID + i] = ((node.animated && animationID > 0) ? (animationID - 1) : 255);

                    // if (skin.skeleton !== null) {
                    //     mat4.mul(tmpMat4, inverseSkeletonRootMat4, tmpMat4);
                    // }
                }
            }
        }
            
        for(let i = 0, e = node.children.length; i != e; ++i) updateAnimationMatrices(node.children[i], matrix, sceneMatrices);
    }
    
    for(let i = 0, identityMatrix = glMatrix4x4f.identityMatrix(), len = this.__animator.__scenes.length; i != len; ++i) {
        for(let scene = this.__animator.__scenes[i], nodes = scene.nodes, k = 0, e = nodes.length; k != e; ++k) {
            updateAnimationMatrices(nodes[k], identityMatrix, scene.matrices);
        }
    }
}

gltfAnimation.prototype.__updateEvents = function()
{
    let currentTime = this.__time;
    let lastTime = this.__lastTime;

    this.__lastTime = this.__time;

    if(currentTime < lastTime) 
    {
        let tmp = currentTime;

        currentTime = lastTime;
        lastTime = tmp;
    }

    for(let i = 0, e = this.__events.length; i != e; ++i)
    {
        let event = this.__events[i];
        if(lastTime <= event.__timeEnd && currentTime >= event.__timeStart)
        {
            let t = Math.min(Math.max((this.__time - event.__timeStart) / (event.__timeEnd - event.__timeStart), 0.0), 1.0);
            event.__callback(t);
        }
    }
}

gltfAnimation.prototype.createTimeRangeEvent = function(timeStart, timeEnd, callback)
{
    let epsilon = 0.0000001;

    if(this.__speed < 0.0) 
    {
        timeStart = this.getDuration() - timeStart;
        timeEnd   = this.getDuration() - timeEnd;
    }
    
    timeStart = Math.min(Math.max(timeStart, 0.0), this.getDuration() - epsilon);
    timeEnd   = Math.min(Math.max(timeEnd,   0.0), this.getDuration() - epsilon);

    if(timeEnd < timeStart) 
    {
        let tmp = timeStart;

        timeStart = timeEnd;
        timeEnd = tmp;
    }

    let event =
    {
        __timeStart: timeStart,
        __timeEnd: timeEnd,

        __callback: callback
    };

    this.__events.push(event);

    return event;
}

gltfAnimation.prototype.createTimeEvent = function(time, callback) {
    return this.createTimeRangeEvent(time, time, callback);
}

gltfAnimation.prototype.deleteTimeEvent = function(event)
{
    let index = this.__events.indexOf(event);
    if(index < 0) return false;

    this.__events.splice(index, 1);
    return true;
}

gltfAnimation.prototype.clearTimeEvents = function() {
    this.__events.length = 0;
}

gltfAnimation.prototype.setSpeed = function(speed) {
    this.__speed = Math.abs(speed) * Math.sign(this.__speed);
}

gltfAnimation.prototype.getSpeed = function() {
    return Math.abs(this.__speed);
}

gltfAnimation.prototype.flip = function() {
    this.__speed = -this.__speed;
}

let glTFAnimator = function(glTF)
{
    this.__animations   = new Map();
    this.__stateManager = new StateMachine();
    
    this.__nodes     = glTF.nodes;
    this.__bones     = glTF.bones;
    this.__scenes    = glTF.scenes;
    this.__nodeNames = glTF.nodeNames;
    
    this.__repeatMode = glTFAnimator.RepeatMode.NO_REPEAT;
    this.RepeatMode   = glTFAnimator.RepeatMode;
    
    this.__activeAnimation  = null;
    this.__onFinishCallback = null;
    
    this.__nodesRelativeTransforms = new Map();
    this.__nodesAbsoluteTransforms = new Map();
    
    this.__animationMatricesCurrentFrame = [];
    this.__animationMatricesLastFrame = [];
    this.__bonesMatricesCurrentFrame = [];
    this.__bonesBindPoseTransforms = [];
    this.__bonesMatricesLastFrame = [];
    this.__bonesJointsNodeIDs = [];

    this.__paused = false;
    this.__timeDelta = 0.0;
    this.__time = 0.0;

    this.__shouldUpdateContext = false;

    for(let i = 0, e = glTF.animations.length; i != e; ++i) this.__createAnimation(glTF.animations[i]);
} 

glTFAnimator.RepeatMode = Object.freeze({"REWIND_REPEAT":-2, "REPEAT":-1, "NO_REPEAT":0});

glTFAnimator.prototype.__createAnimation = function(animation)
{
    if(animation.name == null) animation.name = "untitled";
        
    let collisions = 0;
    let checkAnimationName;

    do
    {
        checkAnimationName = animation.name;
        if(collisions > 0) checkAnimationName += (collisions + 1);

    } while(this.getAnimation(checkAnimationName) != null);

    animation.name = checkAnimationName;

    this.__animations.set(animation.name, new gltfAnimation(this, animation));
}

glTFAnimator.prototype.createSubAnimation = function(name, baseAnimation, timeStart, timeEnd)
{
    if(typeof baseAnimation === "string" || baseAnimation instanceof String) baseAnimation = this.getAnimation(baseAnimation);
    if(baseAnimation == null) return null;

    let animation = baseAnimation.__slice(timeStart, timeEnd);
    animation.__name = name;

    this.__animations.set(name, animation);

    return animation;
}

glTFAnimator.prototype.getAnimations = function()
{
    let nAnimations = this.size();

    let animations = Array.from(this.__animations.keys());
    for(let i = 0; i != nAnimations; ++i) animations[i] = this.__animations.get(animations[i]);

    return animations;
}

glTFAnimator.prototype.getAnimation = function(name) {
    return this.__animations.get(name);
}

glTFAnimator.prototype.getAnimationPlaying = function() {
    return this.__activeAnimation;
}

glTFAnimator.prototype.getNodeName = function(nodeID) {
    return this.__nodeNames.get(nodeID);
}

glTFAnimator.prototype.setTranslation = function(nodeName, translation) 
{
    let transform = this.__nodesRelativeTransforms.get(nodeName);
    if(transform == null) this.__nodesRelativeTransforms.set(nodeName, (transform = {t: null, r: null, s: null, m: null }));
    
    transform.t = new glVector3f(translation);
}

glTFAnimator.prototype.setRotation = function(nodeName, quaternion) 
{
    let transform = this.__nodesRelativeTransforms.get(nodeName);
    if(transform == null) this.__nodesRelativeTransforms.set(nodeName, (transform = {t: null, r: null, s: null, m: null }));
    
    transform.r = quaternion.toVector4f();
}

glTFAnimator.prototype.setScale = function(nodeName, scale) 
{
    let transform = this.__nodesRelativeTransforms.get(nodeName);
    if(transform == null) this.__nodesRelativeTransforms.set(nodeName, (transform = {t: null, r: null, s: null, m: null }));
    
    transform.s = new glVector3f(scale);
}

glTFAnimator.prototype.setTransform = function(nodeName, matrix) 
{
    let transform = this.__nodesRelativeTransforms.get(nodeName);
    if(transform == null) this.__nodesRelativeTransforms.set(nodeName, (transform = {t: null, r: null, s: null, m: null }));
    
    transform.m = new glMatrix4x4f(matrix);
}

glTFAnimator.prototype.getTransform = function(nodeName)
{
    let transform = this.__nodesAbsoluteTransforms.get(nodeName);
    return ((transform != null) ? new glMatrix4x4f(transform) : null);
}

glTFAnimator.prototype.getJointBindPoseTransform = function(jointID) {
    return new glMatrix4x4f(this.__bonesBindPoseTransforms[jointID]);
}

glTFAnimator.prototype.getJointNodeID = function(jointID) {
    return this.__bonesJointsNodeIDs[jointID];
}

glTFAnimator.prototype.getBonesPairs = function() {
    return this.__bones;
}

glTFAnimator.prototype.getAnimatedVertex = function(vertex)
{ 
    if(this.__activeAnimation == null) return vertex;

    let animationMatrix = glMatrix4x4f.identityMatrix(); 
    if(vertex.animationID >= 0 && vertex.animationID < 255) animationMatrix = this.__animationMatricesCurrentFrame[vertex.animationID];

    let hasSkin = false;                                                                                                                                
    let skinMatrix = new glMatrix4x4f([ 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0 ]);

    let weightSum = (vertex.bonesWeights.x + vertex.bonesWeights.y + vertex.bonesWeights.z + vertex.bonesWeights.w);
    if(weightSum <= 0.0) weightSum = 1.0;

    let bonesWeights = [ vertex.bonesWeights.x / weightSum, 
                         vertex.bonesWeights.y / weightSum, 
                         vertex.bonesWeights.z / weightSum, 
                         vertex.bonesWeights.w / weightSum ];

    for(let i = 0; i < 4; ++i)
    {
        if(bonesWeights[i] > 0.0 && vertex.bonesIndices[i] >= 0 && vertex.bonesIndices[i] < 255)
        {
            for(let j = 0; j < 16; ++j) skinMatrix.__m[j] += bonesWeights[i] * this.__bonesMatricesCurrentFrame[vertex.bonesIndices[i]].__m[j];
            hasSkin = true;
        }
    }

    if(hasSkin) animationMatrix.mul(skinMatrix);                                                                                            
    
    let animationNormalMatrix = glMatrix4x4f.normalMatrix(animationMatrix);

    let animatedVertex = new glVertex(vertex);

    animatedVertex.position = glMatrix4x4f.mul(animationMatrix, vertex.position);
    animatedVertex.normal = glMatrix4x4f.mul(animationNormalMatrix, vertex.normal);

    let animatedTangent = new glVector3f(vertex.tangent.x, vertex.tangent.y, vertex.tangent.z);
    animatedTangent = glMatrix4x4f.mul(animationNormalMatrix, animatedTangent);
    animatedVertex.tangent = new glVector4f(animatedTangent.x, animatedTangent.y, animatedTangent.z, vertex.tangent.w);

    animatedVertex.bonesWeights = new glVector4f(0.0);
    animatedVertex.bonesIndices = [-1, -1, -1, -1];
    animatedVertex.animationMatrixID = -1;

    return animatedVertex;
}

glTFAnimator.prototype.playAnimation = function(animation, repeatMode, onFinish, transitionTime)
{
    if(typeof animation === "string" || animation instanceof String) animation = this.getAnimation(animation);
    
    transitionTime = Math.min(Math.max(((transitionTime != null) ? transitionTime : 0.325), 0.0), animation.getDuration() * animation.getSpeed());
    if(transitionTime > 0.0) animation.__createTransitionPose(0.0, transitionTime);

    this.__onFinishCallback = onFinish;
    this.__activeAnimation = animation;

    this.__repeatMode = ((repeatMode != null) ? repeatMode : animation.getRepeatMode());
    this.__stateManager.setState(animation.__state, false);

    this.rewind();
    this.resume();
}

glTFAnimator.prototype.__resetAnimationMatrices = function()
{
    this.__bonesMatricesCurrentFrame.length = 0;
    this.__animationMatricesCurrentFrame.length = 0;
}

glTFAnimator.prototype.__forceUpdate = function(animationTime, shouldUpdateTransitionPose)
{
    let shouldUpdateAnimationEvents = (animationTime != null);
    if(animationTime == null) animationTime = this.__activeAnimation.__time;

    if(shouldUpdateTransitionPose == null) shouldUpdateTransitionPose = true;

    this.__bonesMatricesLastFrame = this.__bonesMatricesCurrentFrame.slice(0);
    this.__animationMatricesLastFrame = this.__animationMatricesCurrentFrame.slice(0);
    
    this.__activeAnimation.__update(animationTime, shouldUpdateAnimationEvents, shouldUpdateTransitionPose);
    
    if(this.__animationMatricesLastFrame.length < 1) this.__animationMatricesLastFrame = this.__animationMatricesCurrentFrame;
    if(this.__bonesMatricesLastFrame.length     < 1) this.__bonesMatricesLastFrame = this.__bonesMatricesCurrentFrame;

    this.__shouldUpdateContext = true;
}

glTFAnimator.prototype.update = function(dt)
{
    if(this.__persistentInput != null) this.input(this.__persistentInput);
    
    if(this.playing())
    {
        let lastTime = this.__time;
        let animationSpeed = this.__activeAnimation.__speed;
        
        this.__timeDelta = Math.abs(animationSpeed) * Math.max(dt, 0.0);
        this.__time += this.__timeDelta;

        let epsilon = 0.0000001;
        
        let shouldStop = false;
        let shouldFlip = (animationSpeed < 0.0);

        let self = this;
        let animationTime = self.__time;
        let animationDuration = self.__activeAnimation.getDuration();
        let iterationID = Math.floor(animationTime / ((animationDuration > 0.0) ? animationDuration : 1.0));

        switch(this.__repeatMode)
        {
            case glTFAnimator.RepeatMode.REWIND_REPEAT:
            {
                if(iterationID % 2 > 0) shouldFlip = !shouldFlip;
                animationTime = (animationTime % animationDuration);
                
            } break;

            case glTFAnimator.RepeatMode.NO_REPEAT:
            {
                animationTime = Math.min(animationTime, animationDuration - epsilon);
                if(animationTime >= animationDuration - epsilon) shouldStop = true;

            } break;

            default: {
                animationTime = (animationTime % animationDuration);
                
            } break;
        }
        
        if(shouldFlip) animationTime = animationDuration - animationTime;
                    
        if(this.__repeatMode > 0 && iterationID > this.__repeatMode)
        {
            animationTime = animationDuration - epsilon;
            shouldStop = true;
        }

        let shouldResetAnimationTime = (Math.floor(lastTime / animationDuration) != iterationID);
        if(shouldResetAnimationTime) 
        {
            this.__activeAnimation.__time = (shouldFlip ? 0.0 : (animationDuration - epsilon));

            if(this.__repeatMode != glTFAnimator.RepeatMode.NO_REPEAT)
            {    
                if(this.__repeatMode == glTFAnimator.RepeatMode.REPEAT || this.__repeatMode > 0) this.__activeAnimation.__updateEvents();
                this.__activeAnimation.__lastTime = (shouldFlip ? (animationDuration - epsilon) : 0.0);
                   
                return this.update(0.0);
            }
        }
        
        let shouldUpdateTransitionPose = (iterationID == 0);
        this.__forceUpdate(animationTime, shouldUpdateTransitionPose);

        if(shouldStop)
        {
            this.__activeAnimation.__time = this.__activeAnimation.getDuration();
            this.__activeAnimation = null;
            
            if(this.__onFinishCallback != null) this.__onFinishCallback(this);
        }
    }
}

glTFAnimator.prototype.setTime = function(time, transitionsTime)
{
    if(this.__activeAnimation != null)
    {
        time = Math.min(Math.max(time, 0.0), this.__activeAnimation.getDuration());
        if(transitionsTime > 0.0) this.__activeAnimation.__createTransitionPose(time, Math.min(time + transitionsTime, this.__activeAnimation.getDuration()));

        this.__activeAnimation.__setTime(time);

        this.__time = time;
        this.update(0.0);
    }
}

glTFAnimator.prototype.__updateContextAnimationMatrices = function()
{
    if(this.__shouldUpdateContext)
    {
        this.__ctx.__animationUniformsBlock.glAnimationMatricesCurrentFrame.set(this.__animationMatricesCurrentFrame);
        this.__ctx.__animationUniformsBlock.glAnimationMatricesLastFrame.set(this.__animationMatricesLastFrame);
        this.__ctx.__animationUniformsBlock.glBonesMatricesCurrentFrame.set(this.__bonesMatricesCurrentFrame);
        this.__ctx.__animationUniformsBlock.glBonesMatricesLastFrame.set(this.__bonesMatricesLastFrame);
        
        this.__shouldUpdateContext = false;
    }
}

glTFAnimator.prototype.getAnimationMatrices = function(){
    return this.__animationMatricesCurrentFrame;
}

glTFAnimator.prototype.getBonesMatrices = function() {
    return this.__bonesMatricesCurrentFrame;
}

glTFAnimator.prototype.bind = function()
{
    if(!this.__ctx.isAnimatorBound(this)) this.__shouldUpdateContext = true;
    this.__ctx.bindAnimator(this);
}

glTFAnimator.prototype.unbind = function() {
    if(this.__ctx.isAnimatorBound(this)) this.__ctx.unbindAnimator();
}

glTFAnimator.prototype.playing = function() {
    return (!this.__paused && this.getAnimationPlaying() != null);
}

glTFAnimator.prototype.pause = function()
{
    if(this.playing()) 
    {
        this.__resetAnimationMatrices();
        this.__forceUpdate();
    }

    this.__paused = true;
}

glTFAnimator.prototype.resume = function() {
    this.__paused = false;
}

glTFAnimator.prototype.stop = function()
{
    this.rewind();
    this.__activeAnimation = null;
}

glTFAnimator.prototype.rewind = function()
{
    this.__time = 0.0;
    
    if(this.__activeAnimation != null)
    {
        this.__activeAnimation.__resetTransforms();
        this.__activeAnimation.__setTime(((this.__activeAnimation.__speed < 0.0) ? this.__activeAnimation.getDuration() : 0.0));
    }
    
    if(this.playing()) 
    {
        this.__resetAnimationMatrices();
        this.__forceUpdate();
    }
}

glTFAnimator.prototype.getTimeDelta = function() {
    return this.__timeDelta;
}

glTFAnimator.prototype.createInput = function() {
    return this.__stateManager.createInput();
}

glTFAnimator.prototype.input = function(input, persistent)
{
    if(persistent) this.__persistentInput = input;
    this.__stateManager.input(input);
}

glTFAnimator.prototype.size = function() {
    return this.__animations.size;
}

MinimalGLTFLoader.glTFModel = function(json)
{
    this.json = json;
    this.defaultScene = json.scene !== undefined ? json.scene : 0;

    this.version = Number(json.asset.version);

    if (json.accessors) {
        this.accessors = new Array(json.accessors.length);
    }

    if (json.bufferViews) {
        this.bufferViews = new Array(json.bufferViews.length);
    }

    if (json.scenes) {
        this.scenes = new Array(json.scenes.length);   // store Scene object
    }

    if (json.nodes) {
        this.nodes = new Array(json.nodes.length);    // store Node object
    }

    if (json.meshes) {
        this.meshes = new Array(json.meshes.length);    // store mesh object
    }

    if (json.materials) {
        this.materials = new Array(json.materials.length);  // store material object
    }

    if (json.textures) {
        this.textures = new Array(json.textures.length);
    }

    if (json.images) {
        this.textures = new Array(json.images.length);
    }

    if (json.skins) {
        this.skins = new Array(json.skins.length);
    }

    if (json.animations) {
        this.animations = new Array(json.animations.length);
    }

    this.extensions = json.extensions !== undefined ? json.extensions : null;
    this.extras = json.extras !== undefined ? json.extras : null;
};

MinimalGLTFLoader.__getAccessorData = function(accessor)
{
    function arrayBuffer2TypedArray(buffer, byteOffset, countOfComponentType, componentType)
    {
        switch(componentType)
        {
            case 5120: return new Int8Array(buffer, byteOffset, countOfComponentType);
            case 5121: return new Uint8Array(buffer, byteOffset, countOfComponentType);
            case 5122: return new Int16Array(buffer, byteOffset, countOfComponentType);
            case 5123: return new Uint16Array(buffer, byteOffset, countOfComponentType);
            case 5124: return new Int32Array(buffer, byteOffset, countOfComponentType);
            case 5125: return new Uint32Array(buffer, byteOffset, countOfComponentType);
            case 5126: return new Float32Array(buffer, byteOffset, countOfComponentType);

            default: return null; 
        }
    }

    return ((accessor != null) ? arrayBuffer2TypedArray( accessor.bufferView.data, 
                                                         accessor.byteOffset, 
                                                         accessor.count * MinimalGLTFLoader.Type2NumOfComponent[accessor.type],
                                                         accessor.componentType ) : null);
}

let glTFLoader = MinimalGLTFLoader.glTFLoader = function ()
{    
    this._init();
    this.glTF = null;

    this.enableGLAvatar = false;
    this.linkSkeletonGltf = null;
};

glTFLoader.prototype._init = function() {
    this._buffers = [];
};

glTFLoader.prototype._postprocess = function ()
{
    // bufferviews
    if (this.glTF.bufferViews) {
        for (let i = 0, leni = this.glTF.bufferViews.length; i < leni; i++) {
            this.glTF.bufferViews[i] = new MinimalGLTFLoader.BufferView(this.glTF.json.bufferViews[i], this._buffers[ this.glTF.json.bufferViews[i].buffer ]);
        }
    }

    // accessors
    if (this.glTF.accessors) {
        for (let i = 0, leni = this.glTF.accessors.length; i < leni; i++) {
            this.glTF.accessors[i] = new MinimalGLTFLoader.Accessor(this.glTF.json.accessors[i], this.glTF.bufferViews[ this.glTF.json.accessors[i].bufferView ]);
        }
    }

    // load all materials
    if (this.glTF.materials) {
        for (let i = 0, leni = this.glTF.materials.length; i < leni; i++) {
            this.glTF.materials[i] = new MinimalGLTFLoader.Material(this.glTF.json.materials[i]);
        }
    }

    // mesh
    for (let i = 0, leni = this.glTF.meshes.length; i < leni; i++) {
        this.glTF.meshes[i] = new MinimalGLTFLoader.Mesh(this, this.glTF.json.meshes[i], i);
    }

    // node
    for (let i = 0, leni = this.glTF.nodes.length; i < leni; i++) {
        this.glTF.nodes[i] = new MinimalGLTFLoader.Node(this, this.glTF.json.nodes[i], i);
    }

    // node: hook up children
    for (let i = 0, leni = this.glTF.nodes.length; i < leni; i++) {
        for (let node = this.glTF.nodes[i], j = 0, lenj = node.children.length; j < lenj; j++) {
            node.children[j] = this.glTF.nodes[ node.children[j] ];
        }
    }

    for (let i = 0, leni = this.glTF.scenes.length; i < leni; i++) {
        this.glTF.scenes[i] = new MinimalGLTFLoader.Scene(this.glTF, this.glTF.json.scenes[i]);
    }

    for(let mid = 0, lenMeshes = this.glTF.meshes.length; mid < lenMeshes; mid++)
    {
        let mesh = this.glTF.meshes[mid];
        
        for(let i = 0, e = mesh.primitives.length; i != e; ++i)
        {
            primitive = mesh.primitives[i];
            if(primitive.mode != 4) continue;
            
            primitive.vertices = [];
            
            let positionsBuffer = MinimalGLTFLoader.__getAccessorData(primitive.attributes.POSITION);
            if(positionsBuffer == null) continue;

            let texCoordsBuffer = MinimalGLTFLoader.__getAccessorData(primitive.attributes.TEXCOORD_0);
            let normalsBuffer   = MinimalGLTFLoader.__getAccessorData(primitive.attributes.NORMAL);
            
            let joints0Buffer   = MinimalGLTFLoader.__getAccessorData(primitive.attributes.JOINTS_0);
            let joints1Buffer   = MinimalGLTFLoader.__getAccessorData(primitive.attributes.JOINTS_1);
            
            let weights0Buffer  = MinimalGLTFLoader.__getAccessorData(primitive.attributes.WEIGHTS_0);
            let weights1Buffer  = MinimalGLTFLoader.__getAccessorData(primitive.attributes.WEIGHTS_1);
            
            if(joints1Buffer != null || weights1Buffer != null) console.warn("glTFLoader Skinning Warning: maximum supported bones per vertex is 4");

            let indices = MinimalGLTFLoader.__getAccessorData(this.glTF.accessors[primitive.indices]);
 
            if(indices == null) 
            {
                let nVertices = (positionsBuffer.length / primitive.attributes.POSITION.size);
                
                indices = new Uint32Array(nVertices);
                for(let i = 0; i != nVertices; ++i) indices[i] = i;    
            } 

            for(let k = 0, e = indices.length; k != e; ++k)
            {
                let index = indices[k];
                let vertex = new glVertex();

                vertex.position.x = positionsBuffer[index * 3 + 0];
                vertex.position.y = positionsBuffer[index * 3 + 1];
                vertex.position.z = positionsBuffer[index * 3 + 2];
            
                if(texCoordsBuffer != null)
                {
                    vertex.texCoord.x =       texCoordsBuffer[index * 2 + 0];
                    vertex.texCoord.y = 1.0 - texCoordsBuffer[index * 2 + 1];
                }
            
                if(normalsBuffer != null)
                {
                    vertex.normal.x = normalsBuffer[index * 3 + 0];
                    vertex.normal.y = normalsBuffer[index * 3 + 1];
                    vertex.normal.z = normalsBuffer[index * 3 + 2];
                }

                if(weights0Buffer != null)
                {
                    vertex.bonesWeights.x = weights0Buffer[index * 4 + 0];
                    vertex.bonesWeights.y = weights0Buffer[index * 4 + 1];
                    vertex.bonesWeights.z = weights0Buffer[index * 4 + 2];
                    vertex.bonesWeights.w = weights0Buffer[index * 4 + 3];

                    vertex.bonesWeights.normalize();
                }
                
                if(joints0Buffer != null)
                {
                    vertex.bonesIndices[0] = joints0Buffer[index * 4 + 0];
                    vertex.bonesIndices[1] = joints0Buffer[index * 4 + 1];
                    vertex.bonesIndices[2] = joints0Buffer[index * 4 + 2];
                    vertex.bonesIndices[3] = joints0Buffer[index * 4 + 3];
                }
            
                primitive.vertices.push(vertex);
                mesh.triangulated = true;
            }
        }
    }
    
    // load animations (when all accessors are loaded correctly)
    if (this.glTF.animations) { 
        for (i = 0, leni = this.glTF.animations.length; i < leni; i++) {
            this.glTF.animations[i] = new MinimalGLTFLoader.Animation(this.glTF, this.glTF.json.animations[i]);
        }
    }

    let joints;
    // if (this.glTF.skins) {
    if (this.glTF.json.skins) {
        for (let i = 0, leni = this.glTF.skins.length, baseMatrixID = 0; i < leni; i++) {
            this.glTF.skins[i] = new MinimalGLTFLoader.Skin(this.glTF, this.glTF.json.skins[i], i);
            
            joints = this.glTF.skins[i].joints;
            for (j = 0, lenj = joints.length; j < lenj; j++) {
                // this.glTF.nodes[ joints[j] ].jointID = j;
                joints[j].jointID = j;
            }
            
            this.glTF.skins[i].baseMatrixID = baseMatrixID;
            baseMatrixID += joints.length;
        } 
    }

    for (i = 0, leni = this.glTF.nodes.length; i < leni; i++) {
        node = this.glTF.nodes[i];
        if (node.skin !== null) {
            if (typeof node.skin == 'number') {
                // usual skin, hook up
                node.skin = this.glTF.skins[ node.skin ];
                node.skinned = true;

                for(let joints = node.skin.joints, j = 0, e = joints.length; j != e; ++j) joints[j].isJoint = true;
                
            } else {
                // assume gl_avatar is in use
                // do nothing
            }
        }
    } 

    if(this.glTF.animations)
    { 
        for(let i = 0, e = this.glTF.animations.length; i != e; ++i) for(let animation = this.glTF.animations[i], j = 0, je = animation.channels.length; j != je; ++j)
        {
            channel = animation.channels[j];
            node = this.glTF.nodes[channel.target.nodeID];
            
            node.animated = true;
        }
    }

    let GroupInfo = function(material)
    {
        this.mesh = new glMesh(null);
        
        this.textureNormal = -1;
        this.textureDiffuse = -1;
        this.textureEmissive = -1;
        this.textureAmbientOcclusion = -1;
        this.textureMetallicRoughness = -1;

        this.diffuseMultiplier   = new glVector3f(1.0);
        this.emissiveMultiplier  = new glVector3f(1.0);
        this.metallicMultiplier  = 1.0;
        this.roughnessMultiplier = 1.0;

        if(material == null) material = new MinimalGLTFLoader.Material();
        this.doubleSided = (material.doubleSided ? true : false);

        if(material.normalTexture != null) this.textureNormal = material.normalTexture.index;
        if(material.emissiveTexture != null) this.textureEmissive = material.emissiveTexture.index;
        if(material.occlusionTexture != null) this.textureAmbientOcclusion = material.occlusionTexture.index;
        if(material.pbrMetallicRoughness.baseColorTexture != null) this.textureDiffuse = material.pbrMetallicRoughness.baseColorTexture.index;
        if(material.pbrMetallicRoughness.metallicRoughnessTexture != null) this.textureMetallicRoughness = material.pbrMetallicRoughness.metallicRoughnessTexture.index;   
        
        if(this.textureNormal == null) this.textureNormal = -1;
        if(this.textureDiffuse == null) this.textureDiffuse = -1;
        if(this.textureEmissive == null) this.textureEmissive = -1;
        if(this.textureAmbientOcclusion == null) this.textureAmbientOcclusion = -1;
        if(this.textureMetallicRoughness == null) this.textureMetallicRoughness = -1;
        
        if(material.pbrMetallicRoughness.baseColorFactor != null) this.diffuseMultiplier.set(material.pbrMetallicRoughness.baseColorFactor[0], material.pbrMetallicRoughness.baseColorFactor[1], material.pbrMetallicRoughness.baseColorFactor[2]);
        if(material.emissiveFactor != null) this.emissiveMultiplier.set(material.emissiveFactor[0], material.emissiveFactor[1], material.emissiveFactor[2]);
        if(material.pbrMetallicRoughness.roughnessFactor != null) this.roughnessMultiplier = material.pbrMetallicRoughness.roughnessFactor;
        if(material.pbrMetallicRoughness.metallicFactor != null) this.metallicMultiplier = material.pbrMetallicRoughness.metallicFactor;
    
        if(material.extensions != null && material.extensions.KHR_materials_pbrSpecularGlossiness != null)
        {
            let extension = material.extensions.KHR_materials_pbrSpecularGlossiness;
            
            if(this.textureDiffuse < 0 && extension.diffuseTexture != null) this.textureDiffuse = extension.diffuseTexture.index;
            if(extension.diffuseFactor != null) this.diffuseMultiplier.set(extension.diffuseFactor[0], extension.diffuseFactor[1], extension.diffuseFactor[2]);
        
            if(this.textureDiffuse == null) this.textureDiffuse = -1;
        }
    };

    GroupInfo.prototype.hookTextures = function(textures)
    {
        this.textureNormal = ((this.textureNormal >= 0) ? textures[this.textureNormal] : null);
        this.textureDiffuse = ((this.textureDiffuse >= 0) ? textures[this.textureDiffuse] : null);
        this.textureEmissive = ((this.textureEmissive >= 0) ? textures[this.textureEmissive] : null);
        this.textureAmbientOcclusion = ((this.textureAmbientOcclusion >= 0) ? textures[this.textureAmbientOcclusion] : null);
        this.textureMetallicRoughness = ((this.textureMetallicRoughness >= 0) ? textures[this.textureMetallicRoughness] : null);
    }

    GroupInfo.prototype.__toHash = function()
    {
        const separator = ":";
        
        return ( this.textureNormal                   + separator + 
                 this.textureDiffuse                  + separator + 
                 this.textureEmissive                 + separator +
                 this.textureMetallicRoughness        + separator +
                 this.textureAmbientOcclusion         + separator +
  
                 this.diffuseMultiplier.x.toFixed(3)  + separator + 
                 this.diffuseMultiplier.y.toFixed(3)  + separator + 
                 this.diffuseMultiplier.z.toFixed(3)  + separator +
  
                 this.emissiveMultiplier.x.toFixed(3) + separator + 
                 this.emissiveMultiplier.y.toFixed(3) + separator + 
                 this.emissiveMultiplier.z.toFixed(3) + separator +
  
                 this.roughnessMultiplier             + separator +
                 this.metallicMultiplier              + separator +
                 this.doubleSided );    
    }
    
    let self = this;
    this.glTF.bones = [];
    this.glTF.nodeNames = new Map();
    let mappedGroups = new Map();
    
    let jointID = 0;
    let animationMatrixID = 0;
    function processNode(lastJointID, node, parentTransform, sceneMatrices, animated)
    {
        let matrix = sceneMatrices[node.nodeID];
        if(matrix == null) matrix = sceneMatrices[node.nodeID] = new glMatrix4x4f();

        matrix.set(glMatrix4x4f.mul(parentTransform, node.matrix));
        node.baseMatrix = new glMatrix4x4f(matrix);

        if(animated) node.animated = true;
        node.hasMesh = (node.mesh != null && node.mesh.triangulated);
        
        if(node.hasMesh)
        {
            for(let i = 0, e = node.mesh.primitives.length; i != e; ++i)
            {
                primitive = node.mesh.primitives[i];

                let isPrimitiveTriangulated = (primitive.mode == 4 && primitive.vertices.length > 0);
                if(isPrimitiveTriangulated)
                {
                    let groupInfo = new GroupInfo(primitive.material);
                    let groupID = groupInfo.__toHash();

                    let group = mappedGroups.get(groupID);
                    if(group == null) mappedGroups.set(groupID, (group = groupInfo));
                    
                    let mesh = new glMesh(null, primitive.vertices);
                    let shouldTransformMesh = true;

                    if(node.skinned || node.animated)
                    {
                        for(let i = 0, e = mesh.__vertices.length; i != e; ++i)
                        {
                            let vertex = mesh.__vertices[i];
                            
                            let vertexHasAnimations = node.animated;
                            let vertexHasSkinning = (node.skinned && (vertex.bonesIndices[0] >= 0 || vertex.bonesIndices[1] >= 0 || vertex.bonesIndices[2] >= 0 || vertex.bonesIndices[3] >= 0));

                            if(vertexHasSkinning)
                            {
                                vertex.bonesIndices[0] += node.skin.baseMatrixID;
                                vertex.bonesIndices[1] += node.skin.baseMatrixID;
                                vertex.bonesIndices[2] += node.skin.baseMatrixID;
                                vertex.bonesIndices[3] += node.skin.baseMatrixID;
                            }

                            if(vertexHasAnimations) vertex.animationMatrixID = animationMatrixID;
                        } 

                        if(glMatrix4x4f.invertible(matrix)) node.inverseBindMatrix = glMatrix4x4f.inverse(matrix);
                        else shouldTransformMesh = false;
                    }

                    if(shouldTransformMesh) mesh.transform(matrix);

                    group.mesh.add(mesh);  
                }
            }

            if(node.animated) ++animationMatrixID;
        }

        if(node.isJoint)
        {
            jointID++;
            
            if(lastJointID != null) self.glTF.bones.push([lastJointID, (jointID - 1)]);
            lastJointID = (jointID - 1);

            self.glTF.nodeNames.set(lastJointID, node.name);
        }
           
        node.mesh       = null;
        node.extras     = null;
        node.extensions = null;
        
        delete node.mesh; 
        delete node.extras; 
        delete node.extensions; 
        
        for(let i = 0, e = node.children.length; i != e; ++i) processNode(lastJointID, node.children[i], matrix, sceneMatrices, node.animated);
    }

    for(let i = 0, len = this.glTF.scenes.length, identityMatrix = glMatrix4x4f.identityMatrix(); i != len; ++i) {
        for(let scene = this.glTF.scenes[i], nodes = scene.nodes, k = 0, e = nodes.length; k != e; ++k) processNode(null, nodes[k], identityMatrix, scene.matrices);
    }

    this.groups = [];
    
    let loader = this;
    mappedGroups.forEach( function(group)
    {
        group.hookTextures(loader.glTF.textures);
        loader.groups.push(group);
    });
    
    if(this.glTF.animations) this.animator = new glTFAnimator(this.glTF);
};

glTFLoader.prototype.parseGLTF = function(json, bufferLoaderCallback, textureLoaderCallback, onLoadCallback)
{
    this._init();
   
    let loader = this;
    loader.glTF = new MinimalGLTFLoader.glTFModel(json);

    let pendingTasks = new DispatchQueue(); 
        
    if(json.buffers) for(let i in json.buffers) pendingTasks.createTask( function(task)
    {
        bufferLoaderCallback(json.buffers[i].uri, function(arrayBuffer)
        { 
            loader._buffers[task.index] = arrayBuffer;
            task.done();
        });
        
    }).index = i;

    if(json.images) for(let i in json.images) pendingTasks.createTask( function(task)
    {
        textureLoaderCallback(json.images[i].uri, function(texture)
        {
            loader.glTF.textures[task.index] = texture;
            task.done();
        });

    }).index = i;

    pendingTasks.onFinish( function()
    {
        loader._postprocess();
        if(onLoadCallback != null) onLoadCallback(loader.groups, loader.animator, loader.glTF.json);
    });

    pendingTasks.dispatch();
};
